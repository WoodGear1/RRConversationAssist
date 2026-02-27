import { headers } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get or create request ID from headers
 */
export function getRequestId(): string {
  const headersList = headers();
  const existingId = headersList.get('x-request-id');
  
  if (existingId) {
    return existingId;
  }
  
  return uuidv4();
}

/**
 * Create a logger with request context
 */
export function createRequestLogger(requestId?: string) {
  const { createLogger } = require('@/lib/logger');
  return createLogger({
    service: 'web',
    requestId: requestId || getRequestId(),
  });
}
