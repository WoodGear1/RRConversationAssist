import { Job } from 'bullmq';
import { pool } from '../db';
import { config } from '../config';
import { JobData } from '@rrconversationassist/jobs';

export async function processWEEEK(job: Job<JobData>): Promise<void> {
  const { recordingId, actionItemIds } = job.data;

  console.log(`[WEEEK] Processing WEEEK integration for recording ${recordingId}`);

  // Get integration config
  const integrationResult = await pool.query(
    `SELECT i.id, i.config_json, im.discord_user_id, im.weeek_user_id
     FROM integrations i
     INNER JOIN recordings r ON r.workspace_id = i.workspace_id
     LEFT JOIN integration_mappings im ON im.integration_id = i.id
     WHERE i.type = 'weeek' AND i.enabled = true AND r.id = $1
     LIMIT 1`,
    [recordingId]
  );

  if (integrationResult.rows.length === 0) {
    throw new Error('WEEEK integration not found or disabled');
  }

  const integration = integrationResult.rows[0];
  const weeekApiKey = process.env.WEEEK_API_KEY;
  const weeekProjectId = integration.config_json?.project_id;

  if (!weeekApiKey || !weeekProjectId) {
    throw new Error('WEEEK API key or project ID not configured');
  }

  // Get summary with action items
  const summaryResult = await pool.query(
    `SELECT sr.result_json
     FROM summary_runs sr
     WHERE sr.recording_id = $1 AND sr.status = 'completed'
     ORDER BY sr.created_at DESC LIMIT 1`,
    [recordingId]
  );

  if (summaryResult.rows.length === 0) {
    throw new Error('No summary found for recording');
  }

  const summary = summaryResult.rows[0].result_json;
  const actionItems = summary.action_items || [];

  // Filter by actionItemIds if provided
  const itemsToCreate = actionItemIds
    ? actionItems.filter((item: any, index: number) =>
        actionItemIds.includes(index)
      )
    : actionItems;

  // Get recording link
  const recordingLink = `${process.env.WEB_BASE_URL || 'http://localhost:3000'}/recordings/${recordingId}`;

  // Create tasks in WEEEK
  for (const item of itemsToCreate) {
    try {
      // Map assignee
      const assignee = item.assignee
        ? integrationResult.rows.find((r) => r.discord_user_id === item.assignee)?.weeek_user_id
        : null;

      // Build task description with evidence
      const evidenceText = item.evidence
        ?.map((ev: any) => `[${formatTime(ev.start_ms)}] ${ev.quote}`)
        .join('\n\n') || '';

      const description = `${item.text}\n\nИсточник: ${recordingLink}\n\nЦитаты:\n${evidenceText}`;

      // Create task via WEEEK API
      const response = await fetch('https://api.weeek.net/v1/tasks', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${weeekApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: weeekProjectId,
          title: item.text,
          description,
          assignee_id: assignee || null,
          due_date: null, // Could be calculated
          priority: 'normal',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`WEEEK API error: ${error}`);
      }

      const taskResult = await response.json();

      // Save external_task_id
      await pool.query(
        `INSERT INTO integration_mappings (
          integration_id, discord_user_id, external_user_id, external_task_id
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (integration_id, discord_user_id) 
        DO UPDATE SET external_task_id = $4, updated_at = CURRENT_TIMESTAMP`,
        [
          integration.id,
          item.assignee || null,
          assignee || null,
          taskResult.id || taskResult.task_id,
        ]
      );
    } catch (error) {
      console.error(`Error creating WEEEK task for item:`, error);
      // Continue with other items
    }
  }

  console.log(`[WEEEK] Completed for recording ${recordingId}, created ${itemsToCreate.length} tasks`);
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
