import { cookies } from 'next/headers';
import pool from './db';

const WORKSPACE_COOKIE = 'workspace_id';

export async function getCurrentWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(WORKSPACE_COOKIE)?.value || null;
}

export async function setCurrentWorkspaceId(workspaceId: string) {
  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}

export async function getUserWorkspaces(userId: string) {
  const result = await pool.query(
    `SELECT w.id, w.name, w.owner_user_id, w.created_at
     FROM workspaces w
     INNER JOIN workspace_members wm ON wm.workspace_id = w.id
     WHERE wm.user_id = $1
     ORDER BY w.created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function getWorkspaceGuilds(workspaceId: string) {
  const result = await pool.query(
    `SELECT g.id, g.discord_guild_id, g.name, g.icon, wg.created_at
     FROM guilds g
     INNER JOIN workspace_guilds wg ON wg.guild_id = g.id
     WHERE wg.workspace_id = $1
     ORDER BY g.name`,
    [workspaceId]
  );
  return result.rows;
}
