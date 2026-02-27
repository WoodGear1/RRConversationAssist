import {
  VoiceConnection,
  VoiceReceiver,
} from '@discordjs/voice';
import { Readable } from 'stream';
import { uploadToS3, saveAudioTrack } from './recording';

export class VoiceHandler {
  private connection: VoiceConnection;
  private receiver: VoiceReceiver;
  private recordingId: string;
  private channelId: string;
  private startedAt: Date;
  private participantStreams: Map<string, {
    stream: Readable;
    startTs: number;
    chunks: Buffer[];
  }> = new Map();

  constructor(connection: VoiceConnection, recordingId: string, channelId: string) {
    this.connection = connection;
    this.receiver = connection.receiver;
    this.recordingId = recordingId;
    this.channelId = channelId;
    this.startedAt = new Date();
  }

  getRecordingId(): string {
    return this.recordingId;
  }

  getChannelId(): string {
    return this.channelId;
  }

  subscribeToUser(userId: string): void {
    if (this.participantStreams.has(userId)) {
      return; // Already subscribed
    }

    const startTs = Date.now() - this.startedAt.getTime();

    // Create readable stream for this user
    const chunks: Buffer[] = [];
    const stream = new Readable({
      read() {
        // Stream will be populated by receiver
      },
    });

    // Subscribe to user's audio
    const audioStream = this.receiver.subscribe(userId, {
      end: {
        behavior: 0, // Keep stream open
      },
    });

    // Pipe audio to our stream
    audioStream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      stream.push(chunk);
    });

    audioStream.on('end', () => {
      stream.push(null);
    });

    this.participantStreams.set(userId, {
      stream,
      startTs,
      chunks,
    });

    // Log participant joined
    this.logParticipantEvent(userId, 'participant_joined', startTs);
  }

  unsubscribeFromUser(userId: string): void {
    const participant = this.participantStreams.get(userId);
    if (!participant) {
      return;
    }

    const endTs = Date.now() - this.startedAt.getTime();

    // End the stream
    participant.stream.push(null);

    // Save audio track to S3
    this.saveParticipantTrack(userId, participant.chunks, participant.startTs, endTs);

    // Log participant left
    this.logParticipantEvent(userId, 'participant_left', endTs);

    this.participantStreams.delete(userId);
  }

  private async saveParticipantTrack(
    userId: string,
    chunks: Buffer[],
    startTs: number,
    endTs: number
  ): Promise<void> {
    try {
      // Combine all chunks
      const audioBuffer = Buffer.concat(chunks);
      const durationMs = endTs - startTs;

      if (audioBuffer.length === 0 || durationMs <= 0) {
        return;
      }

      // Generate object key
      const objectKey = `recordings/${this.recordingId}/tracks/${userId}.opus`;

      // Upload to S3
      await uploadToS3(objectKey, audioBuffer, 'audio/opus');

      // Save track metadata
      await saveAudioTrack(
        this.recordingId,
        userId,
        objectKey,
        durationMs,
        'opus',
        48000, // Discord Opus default
        2, // Stereo
        audioBuffer.length
      );
    } catch (error) {
      console.error(`Error saving track for user ${userId}:`, error);
    }
  }

  private async logParticipantEvent(
    userId: string,
    type: string,
    ts: number
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO recording_events (
          recording_id, ts, type, actor_discord_user_id, payload_json
        ) VALUES ($1, $2, $3, $4, '{}'::jsonb)`,
        [this.recordingId, ts, type, userId]
      );
    } catch (error) {
      console.error('Error logging event:', error);
    }
  }

  async stop(): Promise<void> {
    // Unsubscribe from all users
    for (const userId of this.participantStreams.keys()) {
      this.unsubscribeFromUser(userId);
    }

    // Destroy receiver
    this.receiver.destroy();
  }
}
