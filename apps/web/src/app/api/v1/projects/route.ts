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
      'SELECT id, name, description, created_at, updated_at FROM projects WHERE workspace_id = $1 ORDER BY name',
      [workspaceId]
    );

    return NextResponse.json({ projects: result.rows });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении проектов' },
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

    const { name, description } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Название проекта обязательно' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO projects (workspace_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, created_at, updated_at`,
      [workspaceId, name.trim(), description || null]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Ошибка при создании проекта' },
      { status: 500 }
    );
  }
}
