import { Job } from 'bullmq';
import { pool } from '../db';
import { config } from '../config';
import { JobData } from '@rrconversationassist/jobs';
import { createHmac } from 'crypto';

export async function processWebhook(job: Job<JobData>): Promise<void> {
  const { recordingId, integrationId } = job.data;

  console.log(`[Webhook] Processing webhook for recording ${recordingId}, integration ${integrationId}`);

  // Get integration config
  const integrationResult = await pool.query(
    'SELECT type, config_json FROM integrations WHERE id = $1 AND enabled = true',
    [integrationId]
  );

  if (integrationResult.rows.length === 0) {
    throw new Error(`Integration ${integrationId} not found or disabled`);
  }

  const integration = integrationResult.rows[0];

  if (integration.type !== 'webhook' && integration.type !== 'generic') {
    throw new Error(`Integration type ${integration.type} not supported for webhook`);
  }

  const webhookUrl = integration.config_json?.webhook_url;

  if (!webhookUrl) {
    throw new Error('webhook_url not configured');
  }

  // Get recording and summary data
  const recordingResult = await pool.query(
    `SELECT r.id, r.title, r.started_at, r.ended_at, r.duration_ms,
            g.name as guild_name, vc.name as channel_name
     FROM recordings r
     LEFT JOIN guilds g ON g.id = r.guild_id
     LEFT JOIN voice_channels vc ON vc.id = r.voice_channel_id
     WHERE r.id = $1`,
    [recordingId]
  );

  if (recordingResult.rows.length === 0) {
    throw new Error(`Recording ${recordingId} not found`);
  }

  const recording = recordingResult.rows[0];

  // Get latest summary
  const summaryResult = await pool.query(
    `SELECT sr.result_json, st.name as template_name
     FROM summary_runs sr
     INNER JOIN summary_templates st ON st.id = sr.template_id
     WHERE sr.recording_id = $1 AND sr.status = 'completed'
     ORDER BY sr.created_at DESC LIMIT 1`,
    [recordingId]
  );

  const summary = summaryResult.rows[0]?.result_json || null;

  // Build payload
  const payload = {
    recording_id: recording.id,
    title: recording.title || `${recording.guild_name} - ${recording.channel_name}`,
    link: `${process.env.WEB_BASE_URL || 'http://localhost:3000'}/recordings/${recording.id}`,
    started_at: recording.started_at,
    ended_at: recording.ended_at,
    duration_ms: recording.duration_ms,
    action_items: summary?.action_items || [],
    decisions: summary?.decisions || [],
    risks: summary?.risks || [],
  };

  // Generate HMAC signature
  const secret = process.env.WEBHOOK_SECRET || '';
  const signature = createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  // Send webhook
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
      'X-Timestamp': Date.now().toString(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Webhook failed: ${response.status} ${errorText}`);
  }

  console.log(`[Webhook] Successfully sent webhook for recording ${recordingId}`);
}
