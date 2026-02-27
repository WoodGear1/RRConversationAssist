import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getAllowedRanges, isRangeAllowed, TimeRange } from './acl';
import { getPresignedUrl } from './s3';
import pool from './db';

export interface MediaUrlOptions {
  recordingId: string;
  trackType?: 'user' | 'mixed';
  discordUserId?: string;
  startMs?: number;
  endMs?: number;
  ttl?: number; // Time to live in seconds, default 3600 (1 hour)
}

export interface MediaUrlResult {
  url: string;
  expires_in: number;
  allowed_ranges: TimeRange[];
}

/**
 * Get pre-signed URL for media with ACL and allowed_ranges check
 * Throws error if access is denied
 */
export async function getMediaUrl(
  userId: string,
  options: MediaUrlOptions
): Promise<MediaUrlResult> {
  const {
    recordingId,
    trackType = 'user',
    discordUserId,
    startMs,
    endMs,
    ttl = 3600,
  } = options;

  // Get allowed ranges
  const allowedRanges = await getAllowedRanges(recordingId, userId);

  if (allowedRanges.length === 0) {
    throw new Error('Нет доступа к записи');
  }

  // Check if requested range is allowed
  if (startMs !== undefined && endMs !== undefined) {
    if (!isRangeAllowed(startMs, endMs, allowedRanges)) {
      throw new Error('Запрашиваемый диапазон недоступен');
    }
  }

  // Get audio track
  let trackQuery =
    'SELECT object_key FROM audio_tracks WHERE recording_id = $1 AND track_type = $2';
  const trackParams: any[] = [recordingId, trackType];

  if (trackType === 'user' && discordUserId) {
    trackQuery += ' AND discord_user_id = $3';
    trackParams.push(discordUserId);
  }

  const trackResult = await pool.query(trackQuery, trackParams);

  if (trackResult.rows.length === 0) {
    throw new Error('Аудио-трек не найден');
  }

  const objectKey = trackResult.rows[0].object_key;

  // Generate pre-signed URL
  const url = await getPresignedUrl(objectKey, ttl);

  return {
    url,
    expires_in: ttl,
    allowed_ranges: allowedRanges,
  };
}
