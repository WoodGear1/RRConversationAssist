import { pool } from './db';
import { uploadToS3 } from './s3';
import { updateRecordingStatus } from '@rrconversationassist/db';

export interface RecordingState {
  recordingId: string;
  channelId: string;
  guildId: string;
  initiatorUserId: string;
  initiatorDiscordUserId: string;
  startedAt: Date;
  participants: Map<string, ParticipantStream>;
}

export interface ParticipantStream {
  discordUserId: string;
  stream: Readable;
  startTs: number;
  buffer: Buffer[];
}

export async function createRecording(
  workspaceId: string,
  guildId: string,
  channelId: string,
  initiatorUserId: string,
  initiatorDiscordUserId: string
): Promise<string> {
  const result = await pool.query(
    `INSERT INTO recordings (
      workspace_id, guild_id, discord_channel_id,
      initiator_user_id, initiator_discord_user_id,
      source, status, started_at
    ) VALUES ($1, $2, $3, $4, $5, 'discord', 'recording', CURRENT_TIMESTAMP)
    RETURNING id`,
    [workspaceId, guildId, channelId, initiatorUserId, initiatorDiscordUserId]
  );

  const recordingId = result.rows[0].id;

  // Log recording started event
  await pool.query(
    `INSERT INTO recording_events (
      recording_id, ts, type, actor_discord_user_id, payload_json
    ) VALUES ($1, 0, 'recording_started', $2, '{}'::jsonb)`,
    [recordingId, initiatorDiscordUserId]
  );

  return recordingId;
}

export async function stopRecording(recordingId: string): Promise<void> {
  const endedAt = new Date();

  // Get recording start time
  const recordingResult = await pool.query(
    'SELECT started_at FROM recordings WHERE id = $1',
    [recordingId]
  );

  if (recordingResult.rows.length === 0) {
    throw new Error('Recording not found');
  }

  const startedAt = new Date(recordingResult.rows[0].started_at);
  const durationMs = endedAt.getTime() - startedAt.getTime();

  await pool.query(
    `UPDATE recordings 
     SET ended_at = $1, duration_ms = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [endedAt, durationMs, recordingId]
  );

  // Update status using state machine
  await updateRecordingStatus(pool, recordingId, 'audio_ready');

  // Log recording stopped event
  await pool.query(
    `INSERT INTO recording_events (
      recording_id, ts, type, payload_json
    ) VALUES ($1, $2, 'recording_stopped', '{}'::jsonb)`,
    [recordingId, durationMs]
  );
}

export async function addParticipantInterval(
  recordingId: string,
  discordUserId: string,
  startTs: number
): Promise<void> {
  await pool.query(
    `INSERT INTO participant_intervals (
      recording_id, discord_user_id, start_ts
    ) VALUES ($1, $2, $3)`,
    [recordingId, discordUserId, startTs]
  );
}

export async function endParticipantInterval(
  recordingId: string,
  discordUserId: string,
  endTs: number
): Promise<void> {
  await pool.query(
    `UPDATE participant_intervals 
     SET end_ts = $1 
     WHERE recording_id = $2 
       AND discord_user_id = $3 
       AND end_ts IS NULL`,
    [endTs, recordingId, discordUserId]
  );
}

export async function saveAudioTrack(
  recordingId: string,
  discordUserId: string | null,
  objectKey: string,
  durationMs: number,
  codec: string,
  sampleRate: number,
  channels: number,
  fileSizeBytes: number
): Promise<void> {
  await pool.query(
    `INSERT INTO audio_tracks (
      recording_id, discord_user_id, track_type, object_key,
      duration_ms, codec, sample_rate, channels, file_size_bytes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      recordingId,
      discordUserId,
      discordUserId ? 'user' : 'mixed',
      objectKey,
      durationMs,
      codec,
      sampleRate,
      channels,
      fileSizeBytes,
    ]
  );
}

export async function logEvent(
  recordingId: string,
  ts: number,
  type: string,
  actorDiscordUserId: string | null,
  payload: Record<string, any> = {}
): Promise<void> {
  await pool.query(
    `INSERT INTO recording_events (
      recording_id, ts, type, actor_discord_user_id, payload_json
    ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [recordingId, ts, type, actorDiscordUserId, JSON.stringify(payload)]
  );
}
