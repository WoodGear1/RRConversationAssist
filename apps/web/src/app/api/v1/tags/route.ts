import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/workspace';
import pool from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    const workspaceId = await getCurrentWorkspaceId();

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace не выбран' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      'SELECT id, name, color, icon, created_at FROM tags WHERE workspace_id = $1 ORDER BY name',
      [workspaceId]
    );

    return NextResponse.json({ tags: result.rows });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении тегов' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    const workspaceId = await getCurrentWorkspaceId();

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace не выбран' },
        { status: 400 }
      );
    }

    const { name, color, icon } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Название тега обязательно' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO tags (workspace_id, name, color, icon)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id, name) DO UPDATE SET color = $3, icon = $4
       RETURNING id, name, color, icon, created_at`,
      [workspaceId, name.trim(), color || null, icon || null]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating tag:', error);
    return NextResponse.json(
      { error: 'Ошибка при создании тега' },
      { status: 500 }
    );
  }
}
