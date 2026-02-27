import Redis from 'ioredis';
import { createQueue, QUEUE_NAMES } from '@rrconversationassist/jobs';
import { config } from './config';

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
});

export const vadQueue = createQueue(QUEUE_NAMES.VAD, redis);
export const transcriptionQueue = createQueue(QUEUE_NAMES.TRANSCRIPTION, redis);
export const summarizationQueue = createQueue(QUEUE_NAMES.SUMMARIZATION, redis);
export const indexingQueue = createQueue(QUEUE_NAMES.INDEXING, redis);
export const chaptersQueue = createQueue(QUEUE_NAMES.CHAPTERS, redis);
export const exportQueue = createQueue(QUEUE_NAMES.EXPORT, redis);
