import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Job } from 'bullmq';
import { processSummarization } from '../../src/processors/summarization-processor';
import { pool } from '../../src/db';

// Mock dependencies
jest.mock('../../src/db');
jest.mock('../../src/config', () => ({
  config: {
    openai: {
      apiKey: 'test-key',
    },
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('Summarization Processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should validate summary template schema', async () => {
    const mockJob = {
      id: 'test-job',
      data: {
        recordingId: 'test-recording',
        templateId: 'test-template',
      },
    } as Job;

    // Mock database responses
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ id: 'test-recording', status: 'transcript_ready', duration_ms: 60000 }],
    });

    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{
        id: 'test-template',
        prompt: 'Test prompt',
        output_schema_json: { type: 'object', properties: {} },
      }],
    });

    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [],
    });

    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ id: 'test-transcript' }],
    });

    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ start_ms: 0, end_ms: 1000, text: 'Test text' }],
    });

    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ id: 'test-summary-run' }],
    });

    // Mock OpenAI API
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ summary: 'Test summary' }),
          },
        }],
      }),
    });

    // Mock final updates
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

    await expect(processSummarization(mockJob)).resolves.not.toThrow();
  });

  it('should handle idempotency - skip if summary exists', async () => {
    const mockJob = {
      id: 'test-job',
      data: {
        recordingId: 'test-recording',
        templateId: 'test-template',
      },
    } as Job;

    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ id: 'test-recording', status: 'transcript_ready', duration_ms: 60000 }],
    });

    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{
        id: 'test-template',
        prompt: 'Test prompt',
        output_schema_json: {},
      }],
    });

    // Summary already exists
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ id: 'existing-summary' }],
    });

    await processSummarization(mockJob);

    // Should not call OpenAI
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
