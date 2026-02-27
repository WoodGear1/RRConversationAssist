import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/workspace';
import pool from '@/lib/db';

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

    const { guildDiscordId, channelId } = await request.json();

    if (!guildDiscordId || !channelId) {
      return NextResponse.json(
        { error: 'guildDiscordId и channelId обязательны' },
        { status: 400 }
      );
    }

    // Get user's Discord ID
    const discordResult = await pool.query(
      'SELECT discord_user_id FROM user_discord_links WHERE user_id = $1',
      [session.user.id]
    );

    if (discordResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Discord аккаунт не привязан' },
        { status: 400 }
      );
    }

    const initiatorDiscordUserId = discordResult.rows[0].discord_user_id;

    // Call bot API to start recording
    const botResponse = await fetch('http://bot:3001/api/recordings/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId,
        guildDiscordId,
        channelId,
        initiatorUserId: session.user.id,
        initiatorDiscordUserId,
      }),
    });

    if (!botResponse.ok) {
      const error = await botResponse.json();
      return NextResponse.json(
        { error: error.error || 'Ошибка при запуске записи' },
        { status: botResponse.status }
      );
    }

    const data = await botResponse.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error starting recording:', error);
    return NextResponse.json(
      { error: 'Ошибка при запуске записи' },
      { status: 500 }
    );
  }
}
