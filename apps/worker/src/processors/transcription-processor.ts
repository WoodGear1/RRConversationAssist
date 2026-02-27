import { Job } from 'bullmq';
import { pool } from '../db';
import { getObject } from '../s3';
import { config } from '../config';
import { JobData } from '@rrconversationassist/jobs';
import { updateRecordingStatus } from '@rrconversationassist/db';
import { createLogger } from '../logger';

const logger = createLogger({ service: 'worker', processor: 'transcription' });

export async function processTranscription(job: Job<JobData>): Promise<void> {
  const { recordingId } = job.data;

  console.log(`[Transcription] Processing recording ${recordingId}`);

  try {
    // Check if recording exists and is in correct status
  const recordingResult = await pool.query(
    'SELECT id, status, duration_ms FROM recordings WHERE id = $1',
    [recordingId]
  );

  if (recordingResult.rows.length === 0) {
    throw new Error(`Recording ${recordingId} not found`);
  }

  const recording = recordingResult.rows[0];

  if (recording.status !== 'vad_done' && recording.status !== 'audio_ready') {
    console.log(`[Transcription] Recording ${recordingId} is not ready for transcription, skipping`);
    return;
  }

  // Check if transcript already exists (idempotency)
  const existingTranscript = await pool.query(
    'SELECT id FROM transcripts WHERE recording_id = $1 AND is_official = true ORDER BY version DESC LIMIT 1',
    [recordingId]
  );

  if (existingTranscript.rows.length > 0) {
    console.log(`[Transcription] Transcript already exists for recording ${recordingId}, skipping`);
    return;
  }

  // Get audio tracks
  const tracksResult = await pool.query(
    'SELECT id, discord_user_id, object_key FROM audio_tracks WHERE recording_id = $1 AND track_type = $2',
    [recordingId, 'user']
  );

  if (tracksResult.rows.length === 0) {
    throw new Error(`No audio tracks found for recording ${recordingId}`);
  }

  // Update status to transcribing
  await updateRecordingStatus(pool, recordingId, 'transcribing');

  // Create transcript record
  const transcriptResult = await pool.query(
    `INSERT INTO transcripts (
      recording_id, version, provider, model, is_official
    ) VALUES ($1, 1, 'openai', 'whisper-1', true)
    RETURNING id`,
    [recordingId]
  );

  const transcriptId = transcriptResult.rows[0].id;

  // Process each track
  for (const track of tracksResult.rows) {
    try {
      // Get audio from S3
      const audioBuffer = await getObject(track.object_key);

      // Call OpenAI transcription API
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: 'audio/opus' });
      formData.append('file', blob, 'audio.opus');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'segment');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.openai.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const transcriptionResult = await response.json();

      // Save segments
      if (transcriptionResult.segments && Array.isArray(transcriptionResult.segments)) {
        for (const segment of transcriptionResult.segments) {
          await pool.query(
            `INSERT INTO transcript_segments (
              transcript_id, discord_user_id, start_ms, end_ms, text
            ) VALUES ($1, $2, $3, $4, $5)`,
            [
              transcriptId,
              track.discord_user_id,
              Math.round(segment.start * 1000),
              Math.round(segment.end * 1000),
              segment.text,
            ]
          );
        }
      } else if (transcriptionResult.text) {
        // Fallback: single segment
        await pool.query(
          `INSERT INTO transcript_segments (
            transcript_id, discord_user_id, start_ms, end_ms, text
          ) VALUES ($1, $2, 0, $3, $4)`,
          [
            transcriptId,
            track.discord_user_id,
            recording.duration_ms || 0,
            transcriptionResult.text,
          ]
        );
      }
    } catch (error) {
      console.error(`Error transcribing track ${track.id}:`, error);
      // Continue with other tracks
    }
  }

  // Update recording status
  await updateRecordingStatus(pool, recordingId, 'transcript_ready');

  // Log event
  await pool.query(
    `INSERT INTO recording_events (
      recording_id, ts, type, payload_json
    ) VALUES ($1, $2, 'transcript_ready', '{}'::jsonb)`,
    [recordingId, recording.duration_ms || 0]
  );

    jobLogger.info('Transcription processing completed');
  } catch (error: any) {
    jobLogger.error('Transcription processing failed', { 
      error: error.message,
      stack: error.stack,
      recordingId 
    });
    
    // Log event for retry attempts
    try {
      await pool.query(
        `INSERT INTO recording_events (
          recording_id, ts, type, payload_json
        ) VALUES ($1, $2, $3, $4::jsonb)`,
        [
          recordingId,
          Date.now(),
          'transcription_retry',
          JSON.stringify({
            error: error.message,
            jobId: job.id,
          }),
        ]
      );
    } catch (eventError) {
      jobLogger.error('Failed to log retry event', { error: eventError });
    }
    
    throw error;
  }
}
