import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getAllowedRanges, isRangeAllowed } from '@/lib/acl';
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
    const isAdmin = session.user.role === 'admin';

    // Get allowed ranges
    const allowedRanges = await getAllowedRanges(params.id, session.user.id);

    if (allowedRanges.length === 0 && !isAdmin) {
      return NextResponse.json(
        { error: 'Нет доступа к записи' },
        { status: 403 }
      );
    }

    const { edits } = await request.json();

    if (!Array.isArray(edits)) {
      return NextResponse.json(
        { error: 'edits должен быть массивом' },
        { status: 400 }
      );
    }

    // Get current transcript
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

    const currentTranscript = transcriptResult.rows[0];

    // Validate edits against ACL (for non-admin)
    if (!isAdmin) {
      for (const edit of edits) {
        if (edit.start_ms !== undefined && edit.end_ms !== undefined) {
          if (!isRangeAllowed(edit.start_ms, edit.end_ms, allowedRanges)) {
            return NextResponse.json(
              { error: 'Попытка редактирования вне разрешённого диапазона' },
              { status: 403 }
            );
          }
        }
      }
    }

    // Create new version
    const newVersion = currentTranscript.version + 1;

    const newTranscriptResult = await pool.query(
      `INSERT INTO transcripts (
        recording_id, version, provider, model, is_official
      ) VALUES ($1, $2, $3, $4, false)
      RETURNING id`,
      [
        params.id,
        newVersion,
        currentTranscript.provider || 'openai',
        currentTranscript.model || null,
      ]
    );

    const newTranscriptId = newTranscriptResult.rows[0].id;

    // Get current segments
    const segmentsResult = await pool.query(
      'SELECT * FROM transcript_segments WHERE transcript_id = $1 ORDER BY start_ms',
      [currentTranscript.id]
    );

    // Apply edits
    const updatedSegments = [...segmentsResult.rows];

    for (const edit of edits) {
      if (edit.type === 'update') {
        const index = updatedSegments.findIndex((s) => s.id === edit.segment_id);
        if (index >= 0) {
          if (edit.text !== undefined) {
            updatedSegments[index].text = edit.text;
          }
          if (edit.discord_user_id !== undefined) {
            updatedSegments[index].discord_user_id = edit.discord_user_id;
          }
        }
      } else if (edit.type === 'split') {
        const index = updatedSegments.findIndex((s) => s.id === edit.segment_id);
        if (index >= 0) {
          const segment = updatedSegments[index];
          const splitTime = edit.split_at_ms;

          const first = {
            ...segment,
            end_ms: splitTime,
          };

          const second = {
            ...segment,
            id: `new_${Date.now()}`,
            start_ms: splitTime,
          };

          updatedSegments.splice(index, 1, first, second);
        }
      } else if (edit.type === 'merge') {
        const indices = edit.segment_ids
          .map((id: string) => updatedSegments.findIndex((s) => s.id === id))
          .filter((i: number) => i >= 0)
          .sort((a: number, b: number) => a - b);

        if (indices.length >= 2) {
          const first = updatedSegments[indices[0]];
          const last = updatedSegments[indices[indices.length - 1]];

          const merged = {
            ...first,
            end_ms: last.end_ms,
            text: updatedSegments
              .slice(indices[0], indices[indices.length - 1] + 1)
              .map((s) => s.text)
              .join(' '),
          };

          // Remove merged segments and insert merged one
          for (let i = indices.length - 1; i >= 0; i--) {
            updatedSegments.splice(indices[i], 1);
          }
          updatedSegments.splice(indices[0], 0, merged);
        }
      }
    }

    // Save new segments
    for (const segment of updatedSegments) {
      await pool.query(
        `INSERT INTO transcript_segments (
          transcript_id, discord_user_id, start_ms, end_ms, text
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          newTranscriptId,
          segment.discord_user_id,
          segment.start_ms,
          segment.end_ms,
          segment.text,
        ]
      );
    }

    return NextResponse.json({
      transcript_id: newTranscriptId,
      version: newVersion,
      is_official: false,
    });
  } catch (error) {
    console.error('Error editing transcript:', error);
    return NextResponse.json(
      { error: 'Ошибка при редактировании транскрипта' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    const isAdmin = session.user.role === 'admin';

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Только админ может публиковать версии' },
        { status: 403 }
      );
    }

    const { transcript_id } = await request.json();

    // Mark draft as official and old as non-official
    await pool.query(
      `UPDATE transcripts 
       SET is_official = false 
       WHERE recording_id = $1 AND is_official = true`,
      [params.id]
    );

    await pool.query(
      `UPDATE transcripts 
       SET is_official = true, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [transcript_id]
    );

    // Trigger re-indexing
    // await indexingQueue.add('indexing', { recordingId: params.id });

    // Mark summaries as outdated
    await pool.query(
      `UPDATE summary_runs 
       SET is_outdated = true, updated_at = CURRENT_TIMESTAMP 
       WHERE recording_id = $1`,
      [params.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error publishing transcript:', error);
    return NextResponse.json(
      { error: 'Ошибка при публикации транскрипта' },
      { status: 500 }
    );
  }
}
