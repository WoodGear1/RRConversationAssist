import { Job } from 'bullmq';
import { pool } from '../db';
import { config } from '../config';
import { JobData } from '@rrconversationassist/jobs';
import { updateRecordingStatus } from '@rrconversationassist/db';

export async function processChapters(job: Job<JobData>): Promise<void> {
  const { recordingId } = job.data;

  console.log(`[Chapters] Processing recording ${recordingId}`);

  try {
    // Get transcript
  const transcriptResult = await pool.query(
    `SELECT ts.id, ts.version
     FROM transcripts ts
     WHERE ts.recording_id = $1 AND ts.is_official = true
     ORDER BY ts.version DESC LIMIT 1`,
    [recordingId]
  );

  if (transcriptResult.rows.length === 0) {
    throw new Error(`No transcript found for recording ${recordingId}`);
  }

  const transcriptId = transcriptResult.rows[0].id;

  // Check if chapters already exist (idempotency)
  const existingChapters = await pool.query(
    'SELECT id FROM chapters WHERE recording_id = $1 ORDER BY version DESC LIMIT 1',
    [recordingId]
  );

  if (existingChapters.rows.length > 0) {
    console.log(`[Chapters] Chapters already exist for recording ${recordingId}, skipping`);
    return;
  }

  // Get segments
  const segmentsResult = await pool.query(
    'SELECT start_ms, end_ms, text FROM transcript_segments WHERE transcript_id = $1 ORDER BY start_ms',
    [transcriptId]
  );

  if (segmentsResult.rows.length === 0) {
    throw new Error(`No segments found for transcript ${transcriptId}`);
  }

  // Chunk into 30-90 second blocks
  const chunks: Array<{ start_ms: number; end_ms: number; text: string }> = [];
  let currentChunk = { start_ms: 0, end_ms: 0, text: '' };
  const MIN_CHUNK_DURATION = 30000; // 30 seconds
  const MAX_CHUNK_DURATION = 90000; // 90 seconds

  for (const segment of segmentsResult.rows) {
    if (currentChunk.text === '') {
      currentChunk.start_ms = segment.start_ms;
    }

    const newText = currentChunk.text + (currentChunk.text ? ' ' : '') + segment.text;
    const duration = segment.end_ms - currentChunk.start_ms;

    if (duration >= MAX_CHUNK_DURATION) {
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

  // Save last chunk if it meets minimum duration
  if (currentChunk.text && currentChunk.end_ms - currentChunk.start_ms >= MIN_CHUNK_DURATION) {
    chunks.push(currentChunk);
  }

  // Generate chapter titles using LLM
  const chapterItems = [];

  for (const chunk of chunks) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.openai.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Ты помощник для создания названий глав. Верни только название главы без дополнительного текста.',
            },
            {
              role: 'user',
              content: `Создай краткое название (2-5 слов) для этого фрагмента транскрипта:\n\n${chunk.text.substring(0, 500)}`,
            },
          ],
          max_tokens: 20,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const label = result.choices[0].message.content.trim();
        chapterItems.push({
          label: label || 'Без названия',
          start_ms: chunk.start_ms,
          end_ms: chunk.end_ms,
        });
      } else {
        chapterItems.push({
          label: 'Без названия',
          start_ms: chunk.start_ms,
          end_ms: chunk.end_ms,
        });
      }
    } catch (error) {
      console.error('Error generating chapter title:', error);
      chapterItems.push({
        label: 'Без названия',
        start_ms: chunk.start_ms,
        end_ms: chunk.end_ms,
      });
    }
  }

  // Save chapters
  await pool.query(
    `INSERT INTO chapters (
      recording_id, version, items_json
    ) VALUES ($1, 1, $2::jsonb)`,
    [recordingId, JSON.stringify(chapterItems)]
  );

  // Update recording status if needed (only if still in transcript_ready)
  try {
    await updateRecordingStatus(pool, recordingId, 'chapters_draft_ready');
  } catch (error) {
    // Status might have already changed, ignore
    console.log(`[Chapters] Could not update status for ${recordingId}, may have already changed`);
  }

    console.log(`[Chapters] Completed for recording ${recordingId}, created ${chapterItems.length} chapters`);
  } catch (error: any) {
    console.error(`[Chapters] Error processing recording ${recordingId}:`, error);
    try {
      await updateRecordingStatus(pool, recordingId, 'failed', error.message);
    } catch (statusError) {
      console.error(`[Chapters] Failed to update status to failed:`, statusError);
    }
    throw error;
  }
}
