import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getAllowedRanges } from '@/lib/acl';
import pool from '@/lib/db';

export async function PUT(
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

    const { project_id } = await request.json();

    if (project_id === null) {
      // Remove project
      await pool.query(
        'DELETE FROM recording_project WHERE recording_id = $1',
        [params.id]
      );
    } else {
      // Set project
      await pool.query(
        `INSERT INTO recording_project (recording_id, project_id)
         VALUES ($1, $2)
         ON CONFLICT (recording_id) DO UPDATE SET project_id = $2`,
        [params.id, project_id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting project:', error);
    return NextResponse.json(
      { error: 'Ошибка при установке проекта' },
      { status: 500 }
    );
  }
}
