import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getUserWorkspaces, getCurrentWorkspaceId } from '@/lib/workspace';
import pool from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    const workspaces = await getUserWorkspaces(session.user.id);
    const currentWorkspaceId = await getCurrentWorkspaceId();

    return NextResponse.json({
      workspaces,
      currentWorkspaceId,
    });
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении workspace' },
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
    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Название workspace обязательно' },
        { status: 400 }
      );
    }

    // Create workspace
    const workspaceResult = await pool.query(
      'INSERT INTO workspaces (name, owner_user_id) VALUES ($1, $2) RETURNING id, name, owner_user_id, created_at',
      [name.trim(), session.user.id]
    );

    const workspace = workspaceResult.rows[0];

    // Add creator as admin member
    await pool.query(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
      [workspace.id, session.user.id, 'admin']
    );

    return NextResponse.json(workspace);
  } catch (error) {
    console.error('Error creating workspace:', error);
    return NextResponse.json(
      { error: 'Ошибка при создании workspace' },
      { status: 500 }
    );
  }
}
