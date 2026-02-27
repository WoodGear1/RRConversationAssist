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

  try {
    const result = await pool.query(
      `SELECT id, name, description, prompt, output_schema_json, owner_user_id, is_default, created_at, updated_at
       FROM summary_templates
       WHERE id = $1 AND (owner_user_id IS NULL OR owner_user_id = $2)`,
      [params.id, session.user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Шаблон не найден' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении шаблона' },
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
    // Check ownership
    const templateResult = await pool.query(
      'SELECT owner_user_id FROM summary_templates WHERE id = $1',
      [params.id]
    );

    if (templateResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Шаблон не найден' },
        { status: 404 }
      );
    }

    const template = templateResult.rows[0];
    const isAdmin = session.user.role === 'admin';
    const isOwner = template.owner_user_id === session.user.id;

    if (!isAdmin && !isOwner && template.owner_user_id !== null) {
      return NextResponse.json(
        { error: 'Нет прав для редактирования шаблона' },
        { status: 403 }
      );
    }

    const { name, description, prompt, output_schema_json } = await request.json();

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(description);
      paramIndex++;
    }

    if (prompt !== undefined) {
      updates.push(`prompt = $${paramIndex}`);
      values.push(prompt);
      paramIndex++;
    }

    if (output_schema_json !== undefined) {
      try {
        JSON.parse(output_schema_json);
      } catch {
        return NextResponse.json(
          { error: 'output_schema_json должен быть валидным JSON' },
          { status: 400 }
        );
      }
      updates.push(`output_schema_json = $${paramIndex}::jsonb`);
      values.push(output_schema_json);
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
      `UPDATE summary_templates 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, description, prompt, output_schema_json, owner_user_id, updated_at`,
      values
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { error: 'Ошибка при обновлении шаблона' },
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
    // Check ownership
    const templateResult = await pool.query(
      'SELECT owner_user_id FROM summary_templates WHERE id = $1',
      [params.id]
    );

    if (templateResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Шаблон не найден' },
        { status: 404 }
      );
    }

    const template = templateResult.rows[0];
    const isAdmin = session.user.role === 'admin';
    const isOwner = template.owner_user_id === session.user.id;

    if (!isAdmin && !isOwner && template.owner_user_id !== null) {
      return NextResponse.json(
        { error: 'Нет прав для удаления шаблона' },
        { status: 403 }
      );
    }

    await pool.query('DELETE FROM summary_templates WHERE id = $1', [params.id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Ошибка при удалении шаблона' },
      { status: 500 }
    );
  }
}
