import { NextRequest, NextResponse } from 'next/server';
import { getAllowedRanges, isRangeAllowed } from '@/lib/acl';
import { getServerSession } from 'next-auth';
import { authOptions } from '../app/api/auth/[...nextauth]/route';

export interface ACLContext {
  userId: string;
  recordingId: string;
  allowedRanges: Array<{ start_ms: number; end_ms: number }>;
  isAdmin: boolean;
}

/**
 * Get ACL context for a recording
 */
export async function getACLContext(
  recordingId: string,
  userId: string
): Promise<ACLContext | null> {
  const allowedRanges = await getAllowedRanges(recordingId, userId);

  if (allowedRanges.length === 0) {
    return null; // No access
  }

  // Check if admin
  const userResult = await getAllowedRanges(recordingId, userId);
  // This is a simplified check - in real implementation, check user.role
  const isAdmin = false; // TODO: Get from session

  return {
    userId,
    recordingId,
    allowedRanges,
    isAdmin,
  };
}

/**
 * Middleware to check ACL for recording access
 */
export async function requireRecordingAccess(
  request: NextRequest,
  recordingId: string
): Promise<{ context: ACLContext } | { error: NextResponse }> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: 'Не авторизован' }, { status: 401 }),
    };
  }

  const context = await getACLContext(recordingId, session.user.id);

  if (!context) {
    return {
      error: NextResponse.json(
        { error: 'Нет доступа к записи' },
        { status: 403 }
      ),
    };
  }

  return { context };
}
