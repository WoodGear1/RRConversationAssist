import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  // Check if user is admin
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const isActive = searchParams.get('is_active');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = `
      SELECT 
        u.id,
        u.email,
        u.role,
        u.is_active,
        u.created_at,
        u.updated_at,
        udl.discord_user_id,
        udl.discord_username,
        udl.discord_discriminator,
        udl.discord_avatar
      FROM users u
      LEFT JOIN user_discord_links udl ON udl.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (u.email ILIKE $${paramIndex} OR udl.discord_username ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      query += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (isActive !== null) {
      query += ` AND u.is_active = $${paramIndex}`;
      params.push(isActive === 'true');
      paramIndex++;
    }

    query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM users u WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (search) {
      countQuery += ` AND u.email ILIKE $${countParamIndex}`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    if (role) {
      countQuery += ` AND u.role = $${countParamIndex}`;
      countParams.push(role);
      countParamIndex++;
    }

    if (isActive !== null) {
      countQuery += ` AND u.is_active = $${countParamIndex}`;
      countParams.push(isActive === 'true');
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    return NextResponse.json({
      users: result.rows,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении пользователей' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  // Check if user is admin
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  try {
    const { email, password, role = 'user', is_active = true } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email и пароль обязательны' },
        { status: 400 }
      );
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'Пользователь с таким email уже существует' },
        { status: 400 }
      );
    }

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role, is_active, created_at`,
      [email, passwordHash, role, is_active]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Ошибка при создании пользователя' },
      { status: 500 }
    );
  }
}
