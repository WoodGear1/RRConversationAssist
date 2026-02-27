import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/workspace';
import pool from '@/lib/db';

// This endpoint would be called by the bot when it's added to a guild
// For now, it's a placeholder that can be called manually or via webhook
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

    // Verify user has access
    const memberResult = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, session.user.id]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Нет доступа к workspace' },
        { status: 403 }
      );
    }

    const { guilds } = await request.json();

    if (!Array.isArray(guilds)) {
      return NextResponse.json(
        { error: 'guilds должен быть массивом' },
        { status: 400 }
      );
    }

    const syncedGuilds = [];

    for (const guild of guilds) {
      if (!guild.discord_guild_id || !guild.name) {
        continue;
      }

      // Upsert guild
      const guildResult = await pool.query(
        `INSERT INTO guilds (discord_guild_id, name, icon)
         VALUES ($1, $2, $3)
         ON CONFLICT (discord_guild_id)
         DO UPDATE SET name = $2, icon = $3, updated_at = CURRENT_TIMESTAMP
         RETURNING id, discord_guild_id, name, icon`,
        [guild.discord_guild_id, guild.name, guild.icon || null]
      );

      const guildRecord = guildResult.rows[0];

      // Link to workspace if not already linked
      await pool.query(
        `INSERT INTO workspace_guilds (workspace_id, guild_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [workspaceId, guildRecord.id]
      );

      syncedGuilds.push(guildRecord);
    }

    return NextResponse.json({ guilds: syncedGuilds });
  } catch (error) {
    console.error('Error syncing guilds:', error);
    return NextResponse.json(
      { error: 'Ошибка при синхронизации гильдий' },
      { status: 500 }
    );
  }
}
