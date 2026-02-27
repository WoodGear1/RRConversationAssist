import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    // Get templates: global (owner_user_id IS NULL) and user's own
    const result = await pool.query(
      `SELECT id, name, description, prompt, output_schema_json, owner_user_id, is_default, created_at, updated_at
       FROM summary_templates
       WHERE owner_user_id IS NULL OR owner_user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [session.user.id]
    );

    return NextResponse.json({ templates: result.rows });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении шаблонов' },
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
    const { name, description, prompt, output_schema_json } = await request.json();

    if (!name || !prompt || !output_schema_json) {
      return NextResponse.json(
        { error: 'name, prompt и output_schema_json обязательны' },
        { status: 400 }
      );
    }

    // Validate JSON schema
    try {
      JSON.parse(output_schema_json);
    } catch {
      return NextResponse.json(
        { error: 'output_schema_json должен быть валидным JSON' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO summary_templates (name, description, prompt, output_schema_json, owner_user_id)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING id, name, description, prompt, output_schema_json, owner_user_id, created_at, updated_at`,
      [name, description || null, prompt, output_schema_json, session.user.id]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Ошибка при создании шаблона' },
      { status: 500 }
    );
  }
}
