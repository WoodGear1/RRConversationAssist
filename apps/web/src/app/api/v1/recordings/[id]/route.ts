import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { NextResponse } from 'next/server';
import { getAllowedRanges, filterSegmentsByRanges } from '@/lib/acl';
import { getPresignedUrl } from '@/lib/s3';
import pool from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    // Get recording
    const recordingResult = await pool.query(
      `SELECT r.*, g.name as guild_name, g.discord_guild_id,
              vc.name as channel_name, vc.discord_channel_id
       FROM recordings r
       LEFT JOIN guilds g ON g.id = r.guild_id
       LEFT JOIN voice_channels vc ON vc.id = r.voice_channel_id
       WHERE r.id = $1`,
      [params.id]
    );

    if (recordingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 });
    }

    const recording = recordingResult.rows[0];

    // Get allowed ranges
    const allowedRanges = await getAllowedRanges(params.id, session.user.id);

    if (allowedRanges.length === 0) {
      return NextResponse.json(
        { error: 'Нет доступа к записи' },
        { status: 403 }
      );
    }

    // Get participants
    const participantsResult = await pool.query(
      `SELECT rp.discord_user_id, rp.display_name, rp.avatar_url
       FROM recording_participants rp
       WHERE rp.recording_id = $1`,
      [params.id]
    );

    const participants = await Promise.all(
      participantsResult.rows.map(async (p) => {
        // Get intervals for this participant
        const intervalsResult = await pool.query(
          `SELECT start_ts, end_ts 
           FROM participant_intervals 
           WHERE recording_id = $1 AND discord_user_id = $2
           ORDER BY start_ts`,
          [params.id, p.discord_user_id]
        );

        const intervals = intervalsResult.rows.map((r) => ({
          start_ms: Number(r.start_ts),
          end_ms: r.end_ts ? Number(r.end_ts) : recording.duration_ms || 0,
        }));

        // Filter by user's allowed ranges
        const userAllowedRanges = allowedRanges;
        const filteredIntervals = intervals.filter((interval) =>
          userAllowedRanges.some(
            (range) =>
              interval.start_ms < range.end_ms && interval.end_ms > range.start_ms
          )
        );

        return {
          discord_user_id: p.discord_user_id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          allowed_ranges_ms: filteredIntervals,
        };
      })
    );

    // Get audio tracks
    const tracksResult = await pool.query(
      'SELECT id, discord_user_id, track_type, object_key FROM audio_tracks WHERE recording_id = $1',
      [params.id]
    );

    const media = await Promise.all(
      tracksResult.rows.map(async (track) => {
        const url = await getPresignedUrl(track.object_key, 3600);
        return {
          type: track.track_type,
          discord_user_id: track.discord_user_id,
          url,
          expires_in: 3600,
        };
      })
    );

    // Get transcript if available
    let transcript = null;
    const transcriptResult = await pool.query(
      `SELECT ts.id, ts.version
       FROM transcripts ts
       WHERE ts.recording_id = $1 AND ts.is_official = true
       ORDER BY ts.version DESC LIMIT 1`,
      [params.id]
    );

    if (transcriptResult.rows.length > 0) {
      const transcriptId = transcriptResult.rows[0].id;

      // Get segments
      const segmentsResult = await pool.query(
        `SELECT discord_user_id, start_ms, end_ms, text
         FROM transcript_segments
         WHERE transcript_id = $1
         ORDER BY start_ms`,
        [transcriptId]
      );

      // Filter segments by allowed ranges
      const filteredSegments = filterSegmentsByRanges(
        segmentsResult.rows,
        allowedRanges
      );

      transcript = {
        segments: filteredSegments.map((s) => ({
          speaker: s.discord_user_id,
          start_ms: s.start_ms,
          end_ms: s.end_ms,
          text: s.text,
        })),
      };
    }

    // Format response according to spec
    const response = {
      recording: {
        id: recording.id,
        guild: {
          id: recording.discord_guild_id,
          name: recording.guild_name,
        },
        channel: {
          id: recording.discord_channel_id,
          name: recording.channel_name,
        },
        started_at: recording.started_at,
        ended_at: recording.ended_at,
        duration_ms: recording.duration_ms,
        status: recording.status,
      },
      participants,
      media: {
        playback: {
          type: 'url',
          url: media[0]?.url || null,
        },
      },
      transcript,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching recording:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении записи' },
      { status: 500 }
    );
  }
}
