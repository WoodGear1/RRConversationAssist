import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/workspace';
import { getAllowedRanges } from '@/lib/acl';
import pool from '@/lib/db';
import { createRequestLogger } from '@/lib/request-id';
import { headers } from 'next/headers';

export async function GET(request: Request) {
  const requestId = headers().get('x-request-id') || crypto.randomUUID();
  const logger = createRequestLogger(requestId);
  
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    logger.warn('Unauthorized request');
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401, headers: { 'X-Request-ID': requestId } });
  }

  try {
    logger.info('Fetching recordings', { userId: session.user.id });
    const workspaceId = await getCurrentWorkspaceId();

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace не выбран' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const guildId = searchParams.get('guild_id');
    const channelId = searchParams.get('channel_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const participantId = searchParams.get('participant_id');
    const source = searchParams.get('source');

    // Build query
    let query = `
      SELECT r.id, r.started_at, r.ended_at, r.duration_ms, r.status, r.source,
             g.name as guild_name, g.discord_guild_id,
             vc.name as channel_name, vc.discord_channel_id
      FROM recordings r
      LEFT JOIN guilds g ON g.id = r.guild_id
      LEFT JOIN voice_channels vc ON vc.id = r.voice_channel_id
      WHERE r.workspace_id = $1
    `;

    const params: any[] = [workspaceId];
    let paramIndex = 2;

    if (guildId) {
      query += ` AND r.guild_id = $${paramIndex}`;
      params.push(guildId);
      paramIndex++;
    }

    if (channelId) {
      query += ` AND r.voice_channel_id = $${paramIndex}`;
      params.push(channelId);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND r.started_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND r.started_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (source) {
      query += ` AND r.source = $${paramIndex}`;
      params.push(source);
      paramIndex++;
    }

    query += ' ORDER BY r.started_at DESC LIMIT 100';

    const result = await pool.query(query, params);

    // Filter by ACL - only recordings where user has at least one interval
    const userDiscordResult = await pool.query(
      'SELECT discord_user_id FROM user_discord_links WHERE user_id = $1',
      [session.user.id]
    );

    const discordUserId =
      userDiscordResult.rows.length > 0
        ? userDiscordResult.rows[0].discord_user_id
        : null;

    const isAdmin = session.user.role === 'admin';

    const filteredRecordings = [];

    for (const recording of result.rows) {
      if (isAdmin) {
        filteredRecordings.push(recording);
        continue;
      }

      if (!discordUserId) {
        continue;
      }

      // Check if user has any intervals in this recording
      const intervalsResult = await pool.query(
        'SELECT id FROM participant_intervals WHERE recording_id = $1 AND discord_user_id = $2 LIMIT 1',
        [recording.id, discordUserId]
      );

      if (intervalsResult.rows.length > 0) {
        filteredRecordings.push(recording);
      }
    }

    return NextResponse.json(filteredRecordings);
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении записей' },
      { status: 500, headers: { 'X-Request-ID': requestId } }
    );
  }
}
