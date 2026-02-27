import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../app/api/auth/[...nextauth]/route';
import { createRateLimitHandler } from '@/lib/rate-limit';

/**
 * Rate limit for login endpoint (by IP)
 */
export const loginRateLimit = createRateLimitHandler({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  keyGenerator: (req) => {
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
    return `rate-limit:login:${ip}`;
  },
});

/**
 * Rate limit for API endpoints (by user_id and IP)
 * Re-export from api-rate-limit for convenience
 */
export { applyApiRateLimit as apiRateLimit } from './api-rate-limit';
