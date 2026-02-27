import { Job } from 'bullmq';
import { pool } from '../db';
import { config } from '../config';
import { JobData } from '@rrconversationassist/jobs';
import { updateRecordingStatus } from '@rrconversationassist/db';

export async function processIndexing(job: Job<JobData>): Promise<void> {
  const { recordingId } = job.data;

  console.log(`[Indexing] Processing recording ${recordingId}`);

  try {
    // Check if recording exists and has transcript
  const recordingResult = await pool.query(
    'SELECT id, status, duration_ms FROM recordings WHERE id = $1',
    [recordingId]
  );

  if (recordingResult.rows.length === 0) {
    throw new Error(`Recording ${recordingId} not found`);
  }

  const recording = recordingResult.rows[0];

  if (recording.status !== 'transcript_ready' && recording.status !== 'indexing_ready') {
    console.log(`[Indexing] Recording ${recordingId} is not ready for indexing, skipping`);
    return;
  }

  // Get official transcript
  const transcriptResult = await pool.query(
    'SELECT id FROM transcripts WHERE recording_id = $1 AND is_official = true ORDER BY version DESC LIMIT 1',
    [recordingId]
  );

  if (transcriptResult.rows.length === 0) {
    throw new Error(`No transcript found for recording ${recordingId}`);
  }

  const transcriptId = transcriptResult.rows[0].id;

  // Check if already indexed (idempotency)
  const existingChunks = await pool.query(
    'SELECT id FROM search_chunks WHERE recording_id = $1 AND transcript_id = $2 LIMIT 1',
    [recordingId, transcriptId]
  );

  if (existingChunks.rows.length > 0) {
    console.log(`[Indexing] Recording ${recordingId} already indexed, skipping`);
    return;
  }

  // Get transcript segments
  const segmentsResult = await pool.query(
    'SELECT id, start_ms, end_ms, text FROM transcript_segments WHERE transcript_id = $1 ORDER BY start_ms',
    [transcriptId]
  );

  if (segmentsResult.rows.length === 0) {
    throw new Error(`No segments found for transcript ${transcriptId}`);
  }

  // Update status
  await updateRecordingStatus(pool, recordingId, 'indexing_ready');

  // Chunk segments (20-60 seconds or 200-500 tokens)
  const chunks: Array<{ start_ms: number; end_ms: number; text: string }> = [];
  let currentChunk = { start_ms: 0, end_ms: 0, text: '' };
  const CHUNK_DURATION_MS = 30000; // 30 seconds
  const CHUNK_MAX_TOKENS = 300;

  for (const segment of segmentsResult.rows) {
    if (currentChunk.text === '') {
      currentChunk.start_ms = segment.start_ms;
    }

    const newText = currentChunk.text + (currentChunk.text ? ' ' : '') + segment.text;
    const duration = segment.end_ms - currentChunk.start_ms;
    const estimatedTokens = newText.split(/\s+/).length;

    if (
      duration >= CHUNK_DURATION_MS ||
      estimatedTokens >= CHUNK_MAX_TOKENS ||
      segment.end_ms - currentChunk.start_ms >= 60000
    ) {
      // Save current chunk
      currentChunk.end_ms = segment.end_ms;
      currentChunk.text = newText;
      chunks.push({ ...currentChunk });

      // Start new chunk
      currentChunk = { start_ms: segment.start_ms, end_ms: segment.end_ms, text: segment.text };
    } else {
      currentChunk.end_ms = segment.end_ms;
      currentChunk.text = newText;
    }
  }

  // Save last chunk
  if (currentChunk.text) {
    chunks.push(currentChunk);
  }

  // Generate embeddings and save chunks
  for (const chunk of chunks) {
    try {
      // Get embedding from OpenAI
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.openai.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: chunk.text,
        }),
      });

      if (!embeddingResponse.ok) {
        const error = await embeddingResponse.text();
        throw new Error(`OpenAI embedding error: ${error}`);
      }

      const embeddingResult = await embeddingResponse.json();
      const embedding = embeddingResult.data[0].embedding;

      // Save chunk with embedding
      await pool.query(
        `INSERT INTO search_chunks (
          recording_id, transcript_id, text, embedding, start_ms, end_ms
        ) VALUES ($1, $2, $3, $4::vector, $5, $6)`,
        [
          recordingId,
          transcriptId,
          chunk.text,
          JSON.stringify(embedding),
          chunk.start_ms,
          chunk.end_ms,
        ]
      );
    } catch (error) {
      console.error(`Error indexing chunk:`, error);
      // Continue with other chunks
    }
  }

  // Update recording status
  await updateRecordingStatus(pool, recordingId, 'indexed');

  // Log event
  await pool.query(
    `INSERT INTO recording_events (
      recording_id, ts, type, payload_json
    ) VALUES ($1, $2, 'index_ready', '{}'::jsonb)`,
    [recordingId, recording.duration_ms || 0]
  );

    console.log(`[Indexing] Completed for recording ${recordingId}, created ${chunks.length} chunks`);
  } catch (error: any) {
    console.error(`[Indexing] Error processing recording ${recordingId}:`, error);
    try {
      await updateRecordingStatus(pool, recordingId, 'failed', error.message);
    } catch (statusError) {
      console.error(`[Indexing] Failed to update status to failed:`, statusError);
    }
    throw error;
  }
}
