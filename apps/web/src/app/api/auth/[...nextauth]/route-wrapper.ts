import { NextRequest, NextResponse } from 'next/server';
import { loginRateLimit } from '@/middleware/rate-limit';
import { handler } from './route';

/**
 * Wrapper for NextAuth handler with rate limiting
 */
export async function GET(req: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await loginRateLimit(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Continue to NextAuth handler
  return handler(req as any);
}

export async function POST(req: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await loginRateLimit(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Continue to NextAuth handler
  return handler(req as any);
}
