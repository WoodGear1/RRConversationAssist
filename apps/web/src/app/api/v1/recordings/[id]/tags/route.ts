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

    const result = await pool.query(
      `SELECT t.id, t.name, t.color, t.icon
       FROM tags t
       INNER JOIN recording_tags rt ON rt.tag_id = t.id
       WHERE rt.recording_id = $1
       ORDER BY t.name`,
      [params.id]
    );

    return NextResponse.json({ tags: result.rows });
  } catch (error) {
    console.error('Error fetching recording tags:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении тегов записи' },
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

    const { tag_ids } = await request.json();

    if (!Array.isArray(tag_ids)) {
      return NextResponse.json(
        { error: 'tag_ids должен быть массивом' },
        { status: 400 }
      );
    }

    // Check limit (max 10 tags per recording)
    const currentCount = await pool.query(
      'SELECT COUNT(*) as count FROM recording_tags WHERE recording_id = $1',
      [params.id]
    );

    if (
      parseInt(currentCount.rows[0].count) + tag_ids.length >
      10
    ) {
      return NextResponse.json(
        { error: 'Максимум 10 тегов на запись' },
        { status: 400 }
      );
    }

    // Add tags
    for (const tagId of tag_ids) {
      await pool.query(
        `INSERT INTO recording_tags (recording_id, tag_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [params.id, tagId]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding tags:', error);
    return NextResponse.json(
      { error: 'Ошибка при добавлении тегов' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const { tag_id } = await request.json();

    if (!tag_id) {
      return NextResponse.json(
        { error: 'tag_id обязателен' },
        { status: 400 }
      );
    }

    await pool.query(
      'DELETE FROM recording_tags WHERE recording_id = $1 AND tag_id = $2',
      [params.id, tag_id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing tag:', error);
    return NextResponse.json(
      { error: 'Ошибка при удалении тега' },
      { status: 500 }
    );
  }
}
