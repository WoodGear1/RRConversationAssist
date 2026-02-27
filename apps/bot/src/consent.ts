import { TextChannel, DMChannel, GuildMember } from 'discord.js';
import { pool } from './db';
import { config } from './config';

export async function sendConsentMessage(
  recordingId: string,
  channelId: string,
  guildId: string,
  initiatorDiscordUserId: string,
  initiatorDisplayName: string
): Promise<string | null> {
  try {
    // Get guild settings and workspace fallback for consent channel
    const guildResult = await pool.query(
      `SELECT 
         g.discord_guild_id, 
         g.id as guild_db_id,
         gs.consent_channel_id as guild_consent_channel_id, 
         gs.consent_message_template,
         w.consent_channel_id as workspace_consent_channel_id
       FROM guilds g
       LEFT JOIN guild_settings gs ON gs.guild_id = g.id
       INNER JOIN workspace_guilds wg ON wg.guild_id = g.id
       INNER JOIN workspaces w ON w.id = wg.workspace_id
       WHERE g.discord_guild_id = $1`,
      [guildId]
    );

    const guild = guildResult.rows[0];
    // Use guild-specific channel if set, otherwise fallback to workspace channel
    const consentChannelId = guild?.guild_consent_channel_id || guild?.workspace_consent_channel_id;

    // Try to get channel (would need bot instance, for now return placeholder)
    // In real implementation, this would use the bot's client
    const baseUrl = config.web?.baseUrl || process.env.WEB_BASE_URL || 'https://app.rrconversationassist.com';
    const termsUrl = `${baseUrl}/terms`;
    const privacyUrl = `${baseUrl}/privacy`;
    
    const defaultMessage = `🔴 Запись началась в голосовом канале. Инициатор: ${initiatorDisplayName}. Запись будет доступна после обработки.

📋 [Условия использования](${termsUrl}) | 🔒 [Политика конфиденциальности](${privacyUrl})`;
    
    const messageTemplate =
      guild?.consent_message_template ||
      defaultMessage;

    // For now, return a placeholder message ID
    // In real implementation, this would:
    // 1. Try to send to Text in Voice channel (if available)
    // 2. Fallback to consent_channel_id from settings
    // 3. Fallback to DM to initiator

    const messageId = `consent_${recordingId}_${Date.now()}`;

    // Save consent message info
    await pool.query(
      `UPDATE recordings 
       SET consent_message_id = $1, consent_channel_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [messageId, consentChannelId || channelId, recordingId]
    );

    return messageId;
  } catch (error) {
    console.error('Error sending consent message:', error);
    return null;
  }
}
