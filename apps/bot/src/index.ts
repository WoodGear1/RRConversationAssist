import { Client, GatewayIntentBits, Events, VoiceState } from 'discord.js';
import { joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import { config } from './config';
import { createRecording, stopRecording, addParticipantInterval, endParticipantInterval } from './recording';
import { VoiceHandler } from './voice-handler';
import { sendConsentMessage } from './consent';
import { pool } from './db';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { createLogger } from './logger';

const logger = createLogger({ service: 'bot' });

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const vadQueue = new Queue('vad', { connection: redis });

async function triggerProcessingPipeline(recordingId: string): Promise<void> {
  // Add VAD job to queue
  await vadQueue.add('vad', { recordingId });
  logger.info('Triggered processing pipeline', { recordingId });
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

const activeRecordings = new Map<string, VoiceHandler>();

client.once(Events.ClientReady, (readyClient) => {
  logger.info('Bot ready', { botTag: readyClient.user.tag, botId: readyClient.user.id });
  
  // Check bot permissions in guilds
  readyClient.guilds.cache.forEach(async (guild) => {
    const me = await guild.members.fetch(readyClient.user!.id);
    const permissions = me.permissions;
    
    const required = ['Connect', 'Speak', 'ViewChannel', 'SendMessages'];
    const missing = required.filter(p => !permissions.has(p));
    
    if (missing.length > 0) {
      logger.warn('Bot missing permissions', { guildId: guild.id, guildName: guild.name, missingPermissions: missing });
    }
  });
});

// Handle voice state updates (participants joining/leaving)
client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
  const channelId = newState.channelId || oldState.channelId;
  if (!channelId) return;

  // Find active recording for this channel
  const recording = Array.from(activeRecordings.entries()).find(
    ([_, handler]) => handler.getChannelId() === channelId
  );

  if (!recording) return;

  const [recordingId, handler] = recording;
  const userId = newState.member?.id || oldState.member?.id;
  if (!userId || userId === client.user?.id) return;

  const currentTime = Date.now();
  const recordingStartTime = handler.startedAt.getTime();
  const ts = currentTime - recordingStartTime;

  // User joined
  if (!oldState.channelId && newState.channelId === channelId) {
    handler.subscribeToUser(userId);
    await addParticipantInterval(recordingId, userId, ts);
  }

  // User left
  if (oldState.channelId === channelId && !newState.channelId) {
    handler.unsubscribeFromUser(userId);
    await endParticipantInterval(recordingId, userId, ts);
  }
});

// API endpoint handler (would be called from web app)
// For now, using a simple command-based approach
// In production, this would be an HTTP server or WebSocket

async function startRecording(
  workspaceId: string,
  guildDiscordId: string,
  channelId: string,
  initiatorUserId: string,
  initiatorDiscordUserId: string
): Promise<string> {
  const guild = client.guilds.cache.find(g => g.id === guildDiscordId);
  if (!guild) {
    throw new Error('Guild not found');
  }

  const channel = guild.channels.cache.get(channelId);
  if (!channel || !channel.isVoiceBased()) {
    throw new Error('Voice channel not found');
  }

  // Get guild ID from database
  const guildResult = await pool.query(
    'SELECT id FROM guilds WHERE discord_guild_id = $1',
    [guildDiscordId]
  );

  if (guildResult.rows.length === 0) {
    throw new Error('Guild not found in database');
  }

  const guildId = guildResult.rows[0].id;

  // Create recording in DB
  const recordingId = await createRecording(
    workspaceId,
    guildId,
    channelId,
    initiatorUserId,
    initiatorDiscordUserId
  );

  // Join voice channel
  const connection = joinVoiceChannel({
    channelId: channelId,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

  // Wait for connection to be ready
  connection.on(VoiceConnectionStatus.Ready, async () => {
    logger.info('Connected to voice channel', { channelId, recordingId });

    // Create voice handler
    const handler = new VoiceHandler(connection, recordingId, channelId);
    activeRecordings.set(recordingId, handler);

    // Subscribe to current participants
    const voiceChannel = await guild.channels.fetch(channelId);
    if (voiceChannel?.isVoiceBased()) {
      const members = voiceChannel.members;
      members.forEach((member) => {
        if (member.id !== client.user?.id) {
          handler.subscribeToUser(member.id);
          const ts = Date.now() - handler.startedAt.getTime();
          addParticipantInterval(recordingId, member.id, ts);
        }
      });
    }

    // Send consent message
    const initiatorMember = await guild.members.fetch(initiatorDiscordUserId).catch(() => null);
    const initiatorDisplayName = initiatorMember?.displayName || 'Неизвестный';
    
    await sendConsentMessage(
      recordingId,
      channelId,
      guildDiscordId,
      initiatorDiscordUserId,
      initiatorDisplayName
    );
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    logger.warn('Disconnected from voice channel', { channelId, recordingId });
    
    // Stop recording
    const handler = activeRecordings.get(recordingId);
    if (handler) {
      await handler.stop();
      activeRecordings.delete(recordingId);
      await stopRecording(recordingId);
      
      // Trigger processing pipeline
      await triggerProcessingPipeline(recordingId);
    }
  });

  return recordingId;
}

async function stopRecordingById(recordingId: string): Promise<void> {
  const handler = activeRecordings.get(recordingId);
  if (handler) {
    await handler.stop();
    activeRecordings.delete(recordingId);
    await stopRecording(recordingId);
  }
}

// Simple HTTP server for API calls from web app
import { createServer } from 'http';

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/recordings/start') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const { workspaceId, guildDiscordId, channelId, initiatorUserId, initiatorDiscordUserId } = JSON.parse(body);
        const recordingId = await startRecording(
          workspaceId,
          guildDiscordId,
          channelId,
          initiatorUserId,
          initiatorDiscordUserId
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ recordingId }));
      } catch (error: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else if (req.method === 'POST' && req.url?.startsWith('/api/recordings/')) {
    const recordingId = req.url.split('/').pop();
    if (recordingId) {
      try {
        await stopRecordingById(recordingId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3001, () => {
  logger.info('Bot HTTP server started', { port: 3001 });
});

// Login
client.login(config.discord.token).catch((error) => {
  logger.error('Bot login error', { error });
  process.exit(1);
});
