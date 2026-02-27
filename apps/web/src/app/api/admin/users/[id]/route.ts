import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
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
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  try {
    const result = await pool.query(
      `SELECT 
        u.id,
        u.email,
        u.role,
        u.is_active,
        u.created_at,
        u.updated_at,
        udl.discord_user_id,
        udl.discord_username,
        udl.discord_discriminator,
        udl.discord_avatar,
        udl.created_at as discord_linked_at
      FROM users u
      LEFT JOIN user_discord_links udl ON udl.user_id = u.id
      WHERE u.id = $1`,
      [params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    // Get user's workspaces
    const workspacesResult = await pool.query(
      `SELECT w.id, w.name, wm.role, wm.created_at
       FROM workspaces w
       INNER JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = $1
       ORDER BY wm.created_at DESC`,
      [params.id]
    );

    return NextResponse.json({
      ...result.rows[0],
      workspaces: workspacesResult.rows,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении пользователя' },
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

  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  try {
    const { role, is_active, password } = await request.json();

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) {
        return NextResponse.json(
          { error: 'Неверная роль' },
          { status: 400 }
        );
      }
      updates.push(`role = $${paramIndex}`);
      values.push(role);
      paramIndex++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      values.push(is_active);
      paramIndex++;
    }

    if (password !== undefined) {
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramIndex}`);
      values.push(passwordHash);
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'Нет полей для обновления' },
        { status: 400 }
      );
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(params.id);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, email, role, is_active, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Ошибка при обновлении пользователя' },
      { status: 500 }
    );
  }
}
