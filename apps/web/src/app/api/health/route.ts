import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export async function GET() {
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

  // Check S3 (MinIO)
  try {
    const response = await fetch(`${process.env.S3_ENDPOINT}/minio/health/live`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      checks.s3 = { status: 'ok' };
    } else {
      checks.s3 = { status: 'error', message: `HTTP ${response.status}` };
    }
  } catch (error: any) {
    checks.s3 = { status: 'error', message: error.message };
  }

  const allHealthy = Object.values(checks).every((check) => check.status === 'ok');
  const status = allHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}
