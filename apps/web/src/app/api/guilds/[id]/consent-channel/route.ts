import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/workspace';
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
    const workspaceId = await getCurrentWorkspaceId();

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace не выбран' },
        { status: 400 }
      );
    }

    // Verify guild belongs to workspace
    const guildResult = await pool.query(
      `SELECT g.id FROM guilds g
       INNER JOIN workspace_guilds wg ON wg.guild_id = g.id
       WHERE g.id = $1 AND wg.workspace_id = $2`,
      [params.id, workspaceId]
    );

    if (guildResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Гильдия не найдена в workspace' },
        { status: 404 }
      );
    }

    const { consent_channel_id, consent_message_template } = await request.json();

    // Upsert guild settings
    await pool.query(
      `INSERT INTO guild_settings (guild_id, consent_channel_id, consent_message_template)
       VALUES ($1, $2, $3)
       ON CONFLICT (guild_id)
       DO UPDATE SET
         consent_channel_id = $2,
         consent_message_template = $3,
         updated_at = CURRENT_TIMESTAMP`,
      [params.id, consent_channel_id || null, consent_message_template || null]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating consent channel:', error);
    return NextResponse.json(
      { error: 'Ошибка при обновлении канала consent' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    // Verify guild belongs to workspace
    const guildResult = await pool.query(
      `SELECT g.id FROM guilds g
       INNER JOIN workspace_guilds wg ON wg.guild_id = g.id
       WHERE g.id = $1 AND wg.workspace_id = $2`,
      [params.id, workspaceId]
    );

    if (guildResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Гильдия не найдена в workspace' },
        { status: 404 }
      );
    }

    // Get guild settings
    const settingsResult = await pool.query(
      'SELECT consent_channel_id, consent_message_template FROM guild_settings WHERE guild_id = $1',
      [params.id]
    );

    return NextResponse.json(settingsResult.rows[0] || {
      consent_channel_id: null,
      consent_message_template: null,
    });
  } catch (error) {
    console.error('Error fetching consent channel:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении настроек канала consent' },
      { status: 500 }
    );
  }
}
