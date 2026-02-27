import { Queue, QueueOptions } from 'bullmq';
import Redis from 'ioredis';

export interface JobData {
  recordingId: string;
  [key: string]: any;
}

export function createQueue(name: string, redis: Redis, options?: Partial<QueueOptions>): Queue<JobData> {
  return new Queue<JobData>(name, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      },
    },
    ...options,
  });
}

export const QUEUE_NAMES = {
  VAD: 'vad',
  TRANSCRIPTION: 'transcription',
  SUMMARIZATION: 'summarization',
  INDEXING: 'indexing',
  CHAPTERS: 'chapters',
  EXPORT: 'export',
} as const;
