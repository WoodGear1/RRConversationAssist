import { IncomingMessage, ServerResponse } from 'http';
import { pool } from './db';
import Redis from 'ioredis';
import { Client } from 'discord.js';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export async function healthCheck(req: IncomingMessage, res: ServerResponse, client?: Client) {
  const checks: Record<string, { status: 'ok' | 'error'; message?: string }> = {};

  // Check database
  try {
    await pool.query('SELECT 1');
    checks.database = { status: 'ok' };
  } catch (error: any) {
    checks.database = { status: 'error', message: error.message };
  }

  // Check Redis
  try {
    await redis.ping();
    checks.redis = { status: 'ok' };
  } catch (error: any) {
    checks.redis = { status: 'error', message: error.message };
  }

  // Check Discord client
  try {
    // Check if client is ready
    if (client && client.isReady()) {
      checks.discord = { status: 'ok' };
    } else {
      checks.discord = { status: 'error', message: 'Client not ready' };
    }
  } catch (error: any) {
    checks.discord = { status: 'error', message: error.message };
  }

  const allHealthy = Object.values(checks).every((check) => check.status === 'ok');
  const statusCode = allHealthy ? 200 : 503;

  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  }));
}
