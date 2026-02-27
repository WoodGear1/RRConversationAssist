import { Job } from 'bullmq';
import { pool } from '../db';
import { JobData } from '@rrconversationassist/jobs';
import { updateRecordingStatus } from '@rrconversationassist/db';

export async function processVAD(job: Job<JobData>): Promise<void> {
  const { recordingId } = job.data;

  console.log(`[VAD] Processing recording ${recordingId}`);

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

    if (recording.status !== 'audio_ready') {
      console.log(`[VAD] Recording ${recordingId} is not in audio_ready status, skipping`);
      return;
    }

    // Check if VAD already processed (idempotency)
    const existingVAD = await pool.query(
      'SELECT id FROM vad_runs WHERE recording_id = $1 ORDER BY version DESC LIMIT 1',
      [recordingId]
    );

    if (existingVAD.rows.length > 0) {
      console.log(`[VAD] VAD already processed for recording ${recordingId}, skipping`);
      return;
    }

    // TODO: Implement actual VAD processing
    // For now, create a placeholder VAD run
    await pool.query(
      `INSERT INTO vad_runs (
        recording_id, version, provider, params_json, speech_ranges_json
      ) VALUES ($1, 1, 'silero', '{}'::jsonb, $2::jsonb)`,
      [
        recordingId,
        JSON.stringify([{ start_ms: 0, end_ms: recording.duration_ms || 0 }]),
      ]
    );

    // Update recording status
    await updateRecordingStatus(pool, recordingId, 'vad_done');

    // Log event
    await pool.query(
      `INSERT INTO recording_events (
        recording_id, ts, type, payload_json
      ) VALUES ($1, $2, 'vad_ready', '{}'::jsonb)`,
      [recordingId, recording.duration_ms || 0]
    );

    console.log(`[VAD] Completed for recording ${recordingId}`);
  } catch (error: any) {
    console.error(`[VAD] Error processing recording ${recordingId}:`, error);
    try {
      await updateRecordingStatus(pool, recordingId, 'failed', error.message);
    } catch (statusError) {
      console.error(`[VAD] Failed to update status to failed:`, statusError);
    }
    throw error;
  }
}
