import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getAllowedRanges, filterSegmentsByRanges } from '@/lib/acl';
import pool from '@/lib/db';

export async function GET(
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

    // Get official transcript
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

    // Get segments
    const segmentsResult = await pool.query(
      `SELECT discord_user_id, start_ms, end_ms, text
       FROM transcript_segments
       WHERE transcript_id = $1
       ORDER BY start_ms`,
      [transcriptId]
    );

    // Filter by allowed ranges
    const filteredSegments = filterSegmentsByRanges(
      segmentsResult.rows,
      allowedRanges
    );

    return NextResponse.json({
      segments: filteredSegments,
    });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении транскрипта' },
      { status: 500 }
    );
  }
}
