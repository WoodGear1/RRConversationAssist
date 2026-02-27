import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
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

  try {
    // Check if user has access to workspace
    const memberResult = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [params.id, session.user.id]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Нет доступа к workspace' },
        { status: 403 }
      );
    }

    // Get workspace details
    const workspaceResult = await pool.query(
      'SELECT id, name, owner_user_id, created_at, updated_at FROM workspaces WHERE id = $1',
      [params.id]
    );

    if (workspaceResult.rows.length === 0) {
      return NextResponse.json({ error: 'Workspace не найден' }, { status: 404 });
    }

    // Get guilds
    const guildsResult = await pool.query(
      `SELECT g.id, g.discord_guild_id, g.name, g.icon, wg.created_at
       FROM guilds g
       INNER JOIN workspace_guilds wg ON wg.guild_id = g.id
       WHERE wg.workspace_id = $1
       ORDER BY g.name`,
      [params.id]
    );

    return NextResponse.json({
      ...workspaceResult.rows[0],
      guilds: guildsResult.rows,
    });
  } catch (error) {
    console.error('Error fetching workspace:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении workspace' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    // Check if user is admin or owner
    const memberResult = await pool.query(
      `SELECT wm.role, w.owner_user_id
       FROM workspace_members wm
       INNER JOIN workspaces w ON w.id = wm.workspace_id
       WHERE wm.workspace_id = $1 AND wm.user_id = $2`,
      [params.id, session.user.id]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Нет доступа к workspace' },
        { status: 403 }
      );
    }

    const member = memberResult.rows[0];
    const isOwner = member.owner_user_id === session.user.id;
    const isAdmin = member.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Недостаточно прав для редактирования' },
        { status: 403 }
      );
    }

    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Название workspace обязательно' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      'UPDATE workspaces SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name, owner_user_id, updated_at',
      [name.trim(), params.id]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating workspace:', error);
    return NextResponse.json(
      { error: 'Ошибка при обновлении workspace' },
      { status: 500 }
    );
  }
}
