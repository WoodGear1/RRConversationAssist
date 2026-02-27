import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getAllowedRanges, filterSegmentsByRanges } from '@/lib/acl';
import pool from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    // Get allowed ranges
    const allowedRanges = await getAllowedRanges(params.id, session.user.id);

    if (allowedRanges.length === 0) {
      return NextResponse.json(
        { error: 'Нет доступа к записи' },
        { status: 403 }
      );
    }

    const { format, include_audio } = await request.json();

    const formats = ['json', 'markdown', 'srt', 'vtt'];
    if (!formats.includes(format)) {
      return NextResponse.json(
        { error: `Формат должен быть одним из: ${formats.join(', ')}` },
        { status: 400 }
      );
    }

    // Get transcript
    const transcriptResult = await pool.query(
      `SELECT ts.id, ts.version
       FROM transcripts ts
       WHERE ts.recording_id = $1 AND ts.is_official = true
       ORDER BY ts.version DESC LIMIT 1`,
      [params.id]
    );

    if (transcriptResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Транскрипт не найден' },
        { status: 404 }
      );
    }

    const transcriptId = transcriptResult.rows[0].id;

    // Get segments (filtered by ACL)
    const segmentsResult = await pool.query(
      `SELECT discord_user_id, start_ms, end_ms, text
       FROM transcript_segments
       WHERE transcript_id = $1
       ORDER BY start_ms`,
      [transcriptId]
    );

    const filteredSegments = filterSegmentsByRanges(
      segmentsResult.rows,
      allowedRanges
    );

    // Get redactions (for admin)
    let redactions: Array<{ start_ms: number; end_ms: number }> = [];
    if (session.user.role === 'admin') {
      const redactionsResult = await pool.query(
        'SELECT start_ms, end_ms FROM redactions WHERE recording_id = $1',
        [params.id]
      );
      redactions = redactionsResult.rows;
    }

    // Generate export based on format
    let content = '';
    const contentType = 'text/plain';

    if (format === 'json') {
      content = JSON.stringify(
        {
          recording_id: params.id,
          segments: filteredSegments.map((s) => ({
            speaker: s.discord_user_id,
            start_ms: s.start_ms,
            end_ms: s.end_ms,
            text: s.text,
          })),
        },
        null,
        2
      );
    } else if (format === 'markdown') {
      content = filteredSegments
        .map(
          (s) =>
            `**${formatTime(s.start_ms)}** - ${s.discord_user_id || 'Неизвестный'}\n${s.text}\n`
        )
        .join('\n');
    } else if (format === 'srt') {
      content = filteredSegments
        .map((s, index) => {
          const start = formatSRTTime(s.start_ms);
          const end = formatSRTTime(s.end_ms);
          return `${index + 1}\n${start} --> ${end}\n${s.text}\n`;
        })
        .join('\n');
    } else if (format === 'vtt') {
      content = `WEBVTT\n\n${filteredSegments
        .map((s) => {
          const start = formatVTTTime(s.start_ms);
          const end = formatVTTTime(s.end_ms);
          return `${start} --> ${end}\n${s.discord_user_id || 'Неизвестный'}: ${s.text}\n`;
        })
        .join('\n')}`;
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="recording-${params.id}.${format}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting:', error);
    return NextResponse.json(
      { error: 'Ошибка при экспорте' },
      { status: 500 }
    );
  }
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatSRTTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

function formatVTTTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}
