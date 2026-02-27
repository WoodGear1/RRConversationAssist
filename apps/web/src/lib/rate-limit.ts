import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: NextRequest) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

export interface RateLimitResult {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
  retryAfter?: number; // Seconds until retry
}

/**
 * Rate limit middleware
 */
export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions
): Promise<{ allowed: boolean; result?: RateLimitResult }> {
  const {
    windowMs,
    maxRequests,
    keyGenerator,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  // Generate key
  const key = keyGenerator
    ? keyGenerator(req)
    : `rate-limit:${getClientIdentifier(req)}`;

  // Get current count
  const current = await redis.incr(key);

  // Set expiration on first request
  if (current === 1) {
    await redis.pexpire(key, windowMs);
  }

  // Get TTL
  const ttl = await redis.pttl(key);
  const reset = Math.floor((Date.now() + ttl) / 1000);

  const remaining = Math.max(0, maxRequests - current);
  const allowed = current <= maxRequests;

  const result: RateLimitResult = {
    limit: maxRequests,
    remaining,
    reset,
    retryAfter: allowed ? undefined : Math.ceil(ttl / 1000),
  };

  return { allowed, result };
}

/**
 * Get client identifier (IP address)
 */
function getClientIdentifier(req: NextRequest): string {
  // Try to get real IP from headers (for proxies/load balancers)
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to connection remote address (not available in Next.js)
  return 'unknown';
}

/**
 * Create rate limit handler for API routes
 */
export function createRateLimitHandler(options: RateLimitOptions) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    const { allowed, result } = await rateLimit(req, options);

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

    return null; // Continue to next handler
  };
}
