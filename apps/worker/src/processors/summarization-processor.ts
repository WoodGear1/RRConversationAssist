import { Job } from 'bullmq';
import { pool } from '../db';
import { config } from '../config';
import { JobData } from '@rrconversationassist/jobs';

export async function processSummarization(job: Job<JobData>): Promise<void> {
  const { recordingId, templateId } = job.data;

  console.log(`[Summarization] Processing recording ${recordingId} with template ${templateId}`);

  // Check if recording exists and has transcript
  const recordingResult = await pool.query(
    'SELECT id, status, duration_ms FROM recordings WHERE id = $1',
    [recordingId]
  );

  if (recordingResult.rows.length === 0) {
    throw new Error(`Recording ${recordingId} not found`);
  }

  // Get template
  const templateResult = await pool.query(
    'SELECT id, prompt, output_schema_json FROM summary_templates WHERE id = $1',
    [templateId]
  );

  if (templateResult.rows.length === 0) {
    throw new Error(`Template ${templateId} not found`);
  }

  const template = templateResult.rows[0];

  // Check if summary already exists (idempotency)
  const existingSummary = await pool.query(
    'SELECT id FROM summary_runs WHERE recording_id = $1 AND template_id = $2 AND status = $3',
    [recordingId, templateId, 'completed']
  );

  if (existingSummary.rows.length > 0) {
    console.log(`[Summarization] Summary already exists for recording ${recordingId}, skipping`);
    return;
  }

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

  // Get segments
  const segmentsResult = await pool.query(
    'SELECT start_ms, end_ms, text FROM transcript_segments WHERE transcript_id = $1 ORDER BY start_ms',
    [transcriptId]
  );

  const transcriptText = segmentsResult.rows.map((s) => s.text).join(' ');

  // Create summary run
  const summaryRunResult = await pool.query(
    `INSERT INTO summary_runs (
      recording_id, template_id, status
    ) VALUES ($1, $2, 'processing')
    RETURNING id`,
    [recordingId, templateId]
  );

  const summaryRunId = summaryRunResult.rows[0].id;

  try {
    // Call OpenAI for summarization
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
            content: template.prompt,
          },
          {
            role: 'user',
            content: `Транскрипт записи:\n\n${transcriptText}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'summary_result',
            schema: template.output_schema_json,
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    const resultJson = JSON.parse(content);

    // Validate against schema (basic check)
    // TODO: Use proper JSON Schema validator

    // Save result
    await pool.query(
      `UPDATE summary_runs 
       SET status = 'completed', result_json = $1::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(resultJson), summaryRunId]
    );

    // Log event
    await pool.query(
      `INSERT INTO recording_events (
        recording_id, ts, type, payload_json
      ) VALUES ($1, $2, 'summary_ready', $3::jsonb)`,
      [recordingId, recordingResult.rows[0].duration_ms || 0, JSON.stringify({ template_id: templateId })]
    );

    console.log(`[Summarization] Completed for recording ${recordingId}`);
  } catch (error: any) {
    // Mark as failed
    await pool.query(
      `UPDATE summary_runs 
       SET status = 'failed', error_message = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [error.message, summaryRunId]
    );

    // Log event
    await pool.query(
      `INSERT INTO recording_events (
        recording_id, ts, type, payload_json
      ) VALUES ($1, $2, 'summary_failed', $3::jsonb)`,
      [
        recordingId,
        recordingResult.rows[0].duration_ms || 0,
        JSON.stringify({ error: error.message }),
      ]
    );

    throw error;
  }
}
