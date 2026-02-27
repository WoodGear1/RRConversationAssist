import { Worker } from 'bullmq';
import { redis, vadQueue, transcriptionQueue, indexingQueue, summarizationQueue, chaptersQueue, exportQueue } from './queues';
import { processVAD } from './processors/vad-processor';
import { processTranscription } from './processors/transcription-processor';
import { processIndexing } from './processors/indexing-processor';
import { processSummarization } from './processors/summarization-processor';
import { processChapters } from './processors/chapters-processor';
import { processWebhook } from './processors/webhook-processor';
import { pool } from './db';
import { updateRecordingStatus } from '@rrconversationassist/db';

console.log('🚀 Worker service starting...');

// Create workers
const vadWorker = new Worker('vad', processVAD, { connection: redis });
const transcriptionWorker = new Worker('transcription', processTranscription, { connection: redis });
const indexingWorker = new Worker('indexing', processIndexing, { connection: redis });
const summarizationWorker = new Worker('summarization', processSummarization, { connection: redis });
const chaptersWorker = new Worker('chapters', processChapters, { connection: redis });

// Error handlers
vadWorker.on('completed', (job) => {
  console.log(`[VAD] Job ${job.id} completed`);
});

vadWorker.on('failed', (job, err) => {
  console.error(`[VAD] Job ${job?.id} failed:`, err);
});

transcriptionWorker.on('completed', (job) => {
  console.log(`[Transcription] Job ${job.id} completed`);
});

transcriptionWorker.on('failed', (job, err) => {
  console.error(`[Transcription] Job ${job?.id} failed:`, err);
});

indexingWorker.on('completed', (job) => {
  console.log(`[Indexing] Job ${job.id} completed`);
});

indexingWorker.on('failed', (job, err) => {
  console.error(`[Indexing] Job ${job?.id} failed:`, err);
});

summarizationWorker.on('completed', (job) => {
  console.log(`[Summarization] Job ${job.id} completed`);
});

summarizationWorker.on('failed', (job, err) => {
  console.error(`[Summarization] Job ${job?.id} failed:`, err);
});

chaptersWorker.on('completed', (job) => {
  console.log(`[Chapters] Job ${job.id} completed`);
});

chaptersWorker.on('failed', (job, err) => {
  console.error(`[Chapters] Job ${job?.id} failed:`, err);
});

// Pipeline: after recording stops, trigger VAD -> transcription -> indexing
// This would be called from bot or web API
export async function triggerProcessingPipeline(recordingId: string): Promise<void> {
  // Add VAD job
  await vadQueue.add('vad', { recordingId });

  // VAD completion will trigger transcription (via event or separate trigger)
  // For now, we'll set up a listener
  vadQueue.on('completed', async (job) => {
    if (job.returnvalue === undefined) {
      // VAD completed, trigger transcription
      await transcriptionQueue.add('transcription', { recordingId: job.data.recordingId });
    }
  });

  transcriptionQueue.on('completed', async (job) => {
    // Transcription completed, trigger chapters and indexing
    await chaptersQueue.add('chapters', { recordingId: job.data.recordingId });
    await indexingQueue.add('indexing', { recordingId: job.data.recordingId });
  });

  indexingQueue.on('completed', async (job) => {
    // Indexing completed, check if recording should be marked as ready
    await checkAndMarkRecordingReady(job.data.recordingId);
  });

  summarizationQueue.on('completed', async (job) => {
    // Summarization completed, check if recording should be marked as ready
    await checkAndMarkRecordingReady(job.data.recordingId);
  });
}

/**
 * Check if recording is ready (indexed + at least one summary) and update status
 */
async function checkAndMarkRecordingReady(recordingId: string): Promise<void> {
  try {
    // Get recording status
    const recordingResult = await pool.query<{ status: string }>(
      'SELECT status FROM recordings WHERE id = $1',
      [recordingId]
    );

    if (recordingResult.rows.length === 0) {
      return;
    }

    const status = recordingResult.rows[0].status;

    // Only check if we're in indexed or summaries_ready state
    if (status !== 'indexed' && status !== 'summaries_ready') {
      return;
    }

    // Check if indexed
    if (status !== 'indexed') {
      return;
    }

    // Check if at least one summary exists
    const summaryResult = await pool.query(
      'SELECT id FROM summary_runs WHERE recording_id = $1 AND status = $2 LIMIT 1',
      [recordingId, 'completed']
    );

    if (summaryResult.rows.length > 0) {
      // Mark as summaries_ready first, then ready
      try {
        await updateRecordingStatus(pool, recordingId, 'summaries_ready');
        await updateRecordingStatus(pool, recordingId, 'ready');
      } catch (error) {
        // Status might have already changed, ignore
        console.log(`[Worker] Could not update status to ready for ${recordingId}`);
      }

      // Trigger webhooks
      const integrationsResult = await pool.query(
        `SELECT i.id FROM integrations i
         INNER JOIN recordings r ON r.workspace_id = i.workspace_id
         WHERE r.id = $1 AND i.enabled = true AND i.type IN ('webhook', 'generic')`,
        [recordingId]
      );

      // Trigger webhooks
      for (const integration of integrationsResult.rows) {
        // Would add to webhook queue
        // await webhookQueue.add('webhook', { recordingId, integrationId: integration.id });
      }
    }
  } catch (error) {
    console.error(`[Worker] Error checking recording ready status:`, error);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down workers...');
  await vadWorker.close();
  await transcriptionWorker.close();
  await indexingWorker.close();
  await summarizationWorker.close();
  await chaptersWorker.close();
  await redis.quit();
  await pool.end();
  process.exit(0);
});

console.log('✅ Workers started and ready');
