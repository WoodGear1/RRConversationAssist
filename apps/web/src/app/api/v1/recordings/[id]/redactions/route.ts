import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  if (session.user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Только админ может просматривать redactions' },
      { status: 403 }
    );
  }

  try {
    const result = await pool.query(
      `SELECT id, start_ms, end_ms, reason, created_by, created_at
       FROM redactions
       WHERE recording_id = $1
       ORDER BY start_ms`,
      [params.id]
    );

    return NextResponse.json({ redactions: result.rows });
  } catch (error) {
    console.error('Error fetching redactions:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении redactions' },
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

  if (session.user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Только админ может создавать redactions' },
      { status: 403 }
    );
  }

  try {
    const { intervals, reason } = await request.json();

    if (!Array.isArray(intervals) || intervals.length === 0) {
      return NextResponse.json(
        { error: 'intervals должен быть непустым массивом' },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== 'string') {
      return NextResponse.json(
        { error: 'reason обязателен' },
        { status: 400 }
      );
    }

    const created = [];

    for (const interval of intervals) {
      if (
        typeof interval.start_ms !== 'number' ||
        typeof interval.end_ms !== 'number' ||
        interval.start_ms >= interval.end_ms
      ) {
        continue;
      }

      const result = await pool.query(
        `INSERT INTO redactions (
          recording_id, start_ms, end_ms, reason, created_by
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id, start_ms, end_ms, reason, created_at`,
        [
          params.id,
          interval.start_ms,
          interval.end_ms,
          reason,
          session.user.id,
        ]
      );

      created.push(result.rows[0]);
    }

    return NextResponse.json({ redactions: created });
  } catch (error) {
    console.error('Error creating redactions:', error);
    return NextResponse.json(
      { error: 'Ошибка при создании redactions' },
      { status: 500 }
    );
  }
}
