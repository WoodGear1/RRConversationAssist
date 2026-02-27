import pool from './db';

export interface TimeRange {
  start_ms: number;
  end_ms: number;
}

/**
 * Get allowed time ranges for a user in a recording
 * Returns array of [start_ms, end_ms] ranges
 */
export async function getAllowedRanges(
  recordingId: string,
  userId: string
): Promise<TimeRange[]> {
  // Check if user is admin
  const userResult = await pool.query(
    'SELECT role FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return [];
  }

  const user = userResult.rows[0];

  // Admin has full access
  if (user.role === 'admin') {
    const recordingResult = await pool.query(
      'SELECT duration_ms FROM recordings WHERE id = $1',
      [recordingId]
    );

    if (recordingResult.rows.length === 0) {
      return [];
    }

    const duration = recordingResult.rows[0].duration_ms || 0;
    return [{ start_ms: 0, end_ms: duration }];
  }

  // Get user's Discord ID
  const discordResult = await pool.query(
    'SELECT discord_user_id FROM user_discord_links WHERE user_id = $1',
    [userId]
  );

  if (discordResult.rows.length === 0) {
    return [];
  }

  const discordUserId = discordResult.rows[0].discord_user_id;

  // Get recording source
  const recordingResult = await pool.query(
    'SELECT source FROM recordings WHERE id = $1',
    [recordingId]
  );

  if (recordingResult.rows.length === 0) {
    return [];
  }

  const source = recordingResult.rows[0].source;

  if (source === 'discord') {
    // Get participant intervals
    const intervalsResult = await pool.query(
      `SELECT start_ts, end_ts 
       FROM participant_intervals 
       WHERE recording_id = $1 AND discord_user_id = $2
       ORDER BY start_ts`,
      [recordingId, discordUserId]
    );

    if (intervalsResult.rows.length === 0) {
      return [];
    }

    // Merge overlapping intervals
    const intervals = intervalsResult.rows.map((r) => ({
      start_ms: Number(r.start_ts),
      end_ms: r.end_ts ? Number(r.end_ts) : Infinity,
    }));

    return mergeIntervals(intervals);
  } else if (source === 'upload') {
    // TODO: Get upload access intervals from upload_access table
    // For now, return empty (no access by default for uploads)
    return [];
  }

  return [];
}

function mergeIntervals(intervals: TimeRange[]): TimeRange[] {
  if (intervals.length === 0) {
    return [];
  }

  // Sort by start_ms
  intervals.sort((a, b) => a.start_ms - b.start_ms);

  const merged: TimeRange[] = [];
  let current = { ...intervals[0] };

  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i];

    if (next.start_ms <= current.end_ms) {
      // Overlapping, merge
      current.end_ms = Math.max(current.end_ms, next.end_ms);
    } else {
      // Not overlapping, save current and start new
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);

  // Filter out infinite end_ms (replace with recording duration if needed)
  return merged.map((range) => ({
    start_ms: range.start_ms,
    end_ms: range.end_ms === Infinity ? Number.MAX_SAFE_INTEGER : range.end_ms,
  }));
}

/**
 * Check if a time range intersects with allowed ranges
 */
export function isRangeAllowed(
  startMs: number,
  endMs: number,
  allowedRanges: TimeRange[]
): boolean {
  if (allowedRanges.length === 0) {
    return false;
  }

  return allowedRanges.some(
    (range) => startMs < range.end_ms && endMs > range.start_ms
  );
}

/**
 * Filter segments by allowed ranges
 */
export function filterSegmentsByRanges<T extends { start_ms: number; end_ms: number }>(
  segments: T[],
  allowedRanges: TimeRange[]
): T[] {
  if (allowedRanges.length === 0) {
    return [];
  }

  return segments.filter((segment) =>
    isRangeAllowed(segment.start_ms, segment.end_ms, allowedRanges)
  );
}
