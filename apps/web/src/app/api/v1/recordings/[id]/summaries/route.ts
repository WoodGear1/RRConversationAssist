import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getAllowedRanges } from '@/lib/acl';
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

    // Get summaries
    const summariesResult = await pool.query(
      `SELECT sr.id, sr.status, sr.result_json, sr.created_at, sr.updated_at,
              st.name as template_name, st.id as template_id
       FROM summary_runs sr
       INNER JOIN summary_templates st ON st.id = sr.template_id
       WHERE sr.recording_id = $1 AND sr.status = 'completed'
       ORDER BY sr.created_at DESC`,
      [params.id]
    );

    const isAdmin = session.user.role === 'admin';

    // Filter evidence in summaries for non-admins
    const summaries = summariesResult.rows.map((summary) => {
      if (!summary.result_json) {
        return summary;
      }

      const result = summary.result_json;

      if (isAdmin) {
        return summary;
      }

      // Filter evidence by allowed ranges
      const filterEvidence = (items: any[]) => {
        if (!Array.isArray(items)) {
          return items;
        }

        return items.map((item) => {
          if (item.evidence && Array.isArray(item.evidence)) {
            item.evidence = item.evidence.filter((ev: any) => {
              if (ev.start_ms !== undefined && ev.end_ms !== undefined) {
                return allowedRanges.some(
                  (range) =>
                    ev.start_ms < range.end_ms && ev.end_ms > range.start_ms
                );
              }
              return true;
            });
          }
          return item;
        });
      };

      if (result.decisions) {
        result.decisions = filterEvidence(result.decisions);
      }

      if (result.action_items) {
        result.action_items = filterEvidence(result.action_items);
      }

      if (result.risks) {
        result.risks = filterEvidence(result.risks);
      }

      if (result.topics) {
        result.topics = filterEvidence(result.topics);
      }

      return {
        ...summary,
        result_json: result,
      };
    });

    return NextResponse.json({ summaries });
  } catch (error) {
    console.error('Error fetching summaries:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении саммари' },
      { status: 500 }
    );
  }
}

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

    const { template_id } = await request.json();

    if (!template_id) {
      return NextResponse.json(
        { error: 'template_id обязателен' },
        { status: 400 }
      );
    }

    // Check if transcript exists
    const transcriptResult = await pool.query(
      'SELECT id FROM transcripts WHERE recording_id = $1 AND is_official = true LIMIT 1',
      [params.id]
    );

    if (transcriptResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Транскрипт не готов' },
        { status: 400 }
      );
    }

    // Create summary run
    const summaryRunResult = await pool.query(
      `INSERT INTO summary_runs (recording_id, template_id, status)
       VALUES ($1, $2, 'queued')
       RETURNING id, status, created_at`,
      [params.id, template_id]
    );

    const summaryRun = summaryRunResult.rows[0];

    // Add to queue (would call worker API or use BullMQ directly)
    // For now, placeholder
    // await summarizationQueue.add('summarization', { recordingId: params.id, templateId: template_id });

    return NextResponse.json(summaryRun);
  } catch (error) {
    console.error('Error creating summary:', error);
    return NextResponse.json(
      { error: 'Ошибка при создании саммари' },
      { status: 500 }
    );
  }
}
