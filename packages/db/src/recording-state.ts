// Recording state machine
// Defines valid state transitions and provides functions to manage recording status

import { RecordingStatus } from './types';
import { Pool } from 'pg';

// Define valid state transitions
const VALID_TRANSITIONS: Record<RecordingStatus, RecordingStatus[]> = {
  created: ['recording', 'uploaded', 'failed'],
  recording: ['audio_ready', 'failed'],
  uploaded: ['audio_ready', 'failed'],
  audio_ready: ['vad_done', 'transcribing', 'failed'], // Can skip VAD and go directly to transcription
  vad_done: ['transcribing', 'failed'],
  chapters_draft_ready: ['transcript_ready', 'failed'],
  transcribing: ['transcript_ready', 'failed'],
  transcript_ready: ['chapters_draft_ready', 'indexing_ready', 'failed'],
  indexing_ready: ['indexed', 'failed'],
  indexed: ['summaries_ready', 'ready', 'failed'],
  summaries_ready: ['ready', 'failed'],
  ready: [], // Terminal state
  failed: [], // Terminal state
};

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  from: RecordingStatus,
  to: RecordingStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get all valid next states for a given status
 */
export function getValidNextStates(status: RecordingStatus): RecordingStatus[] {
  return VALID_TRANSITIONS[status] ?? [];
}

/**
 * Update recording status with validation
 * Throws an error if the transition is invalid
 */
export async function updateRecordingStatus(
  pool: Pool,
  recordingId: string,
  newStatus: RecordingStatus,
  failedReason?: string
): Promise<void> {
  // Get current status
  const result = await pool.query<{ status: RecordingStatus }>(
    'SELECT status FROM recordings WHERE id = $1',
    [recordingId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Recording ${recordingId} not found`);
  }

  const currentStatus = result.rows[0].status;

  // Check if transition is valid
  if (!isValidTransition(currentStatus, newStatus)) {
    throw new Error(
      `Invalid state transition from ${currentStatus} to ${newStatus}. ` +
        `Valid next states: ${getValidNextStates(currentStatus).join(', ')}`
    );
  }

  // Update status
  if (newStatus === 'failed' && failedReason) {
    await pool.query(
      `UPDATE recordings 
       SET status = $1, failed_reason = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [newStatus, failedReason, recordingId]
    );
  } else {
    await pool.query(
      `UPDATE recordings 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [newStatus, recordingId]
    );
  }
}

/**
 * Get status progression percentage (0-100)
 */
export function getStatusProgress(status: RecordingStatus): number {
  const progressMap: Record<RecordingStatus, number> = {
    created: 0,
    recording: 10,
    uploaded: 15,
    audio_ready: 20,
    vad_done: 30,
    transcribing: 40,
    transcript_ready: 50,
    chapters_draft_ready: 55,
    indexing_ready: 60,
    indexed: 70,
    summaries_ready: 85,
    ready: 100,
    failed: 0,
  };

  return progressMap[status] ?? 0;
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: RecordingStatus): string {
  const labels: Record<RecordingStatus, string> = {
    created: 'Создана',
    recording: 'Идёт запись',
    uploaded: 'Загружена',
    audio_ready: 'Аудио готово',
    vad_done: 'VAD выполнен',
    transcribing: 'Транскрибируется',
    transcript_ready: 'Транскрипт готов',
    chapters_draft_ready: 'Главы готовы',
    indexing_ready: 'Готово к индексации',
    indexed: 'Проиндексировано',
    summaries_ready: 'Саммари готовы',
    ready: 'Готово',
    failed: 'Ошибка',
  };

  return labels[status] ?? status;
}

/**
 * Check if status is terminal (ready or failed)
 */
export function isTerminalStatus(status: RecordingStatus): boolean {
  return status === 'ready' || status === 'failed';
}
