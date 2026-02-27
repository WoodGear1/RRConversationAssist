import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../app/api/auth/[...nextauth]/route';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Apply rate limiting to API route
 * Returns null if allowed, or NextResponse with 429 if rate limited
 */
export async function applyApiRateLimit(req: NextRequest): Promise<NextResponse | null> {
  // Get session to identify user
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

  // Create key based on user_id (if authenticated) or IP
  const key = userId
    ? `rate-limit:api:user:${userId}`
    : `rate-limit:api:ip:${ip}`;

  const { allowed, result } = await rateLimit(req, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: userId ? 100 : 20, // More requests for authenticated users
    keyGenerator: () => key,
  });

  if (!allowed && result) {
    return NextResponse.json(
      {
        error: 'Слишком много запросов. Попробуйте позже.',
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.reset.toString(),
          'Retry-After': result.retryAfter?.toString() || '60',
        },
      }
    );
  }

  return null;
}
