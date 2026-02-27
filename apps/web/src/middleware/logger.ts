import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '@/lib/logger';

const logger = createLogger({ service: 'web' });

/**
 * Middleware to add requestId and logging
 */
export function withLogging(handler: (req: NextRequest, context?: any) => Promise<NextResponse>) {
  return async (req: NextRequest, context?: any) => {
    const requestId = uuidv4();
    const startTime = Date.now();

    // Create logger with request context
    const requestLogger = createLogger({
      service: 'web',
      requestId,
      method: req.method,
      path: req.nextUrl.pathname,
    });

    // Add requestId to response headers
    const response = await handler(req, context);
    response.headers.set('X-Request-ID', requestId);

    const duration = Date.now() - startTime;

    // Log request
    requestLogger.info('Request completed', {
      status: response.status,
      duration,
    });

    return response;
  };
}
