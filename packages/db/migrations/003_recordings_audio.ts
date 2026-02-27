import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Recordings
  pgm.createTable('recordings', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    workspace_id: {
      type: 'uuid',
      notNull: true,
      references: 'workspaces(id)',
      onDelete: 'CASCADE',
    },
    guild_id: {
      type: 'uuid',
      references: 'guilds(id)',
      onDelete: 'SET NULL',
    },
    voice_channel_id: {
      type: 'uuid',
      references: 'voice_channels(id)',
      onDelete: 'SET NULL',
    },
    discord_channel_id: {
      type: 'varchar(20)',
    },
    initiator_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    initiator_discord_user_id: {
      type: 'varchar(20)',
    },
    source: {
      type: 'varchar(20)',
      notNull: true,
      default: 'discord',
      check: "source IN ('discord', 'upload')",
    },
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'created',
      check: "status IN ('created', 'recording', 'uploaded', 'audio_ready', 'vad_done', 'chapters_draft_ready', 'transcribing', 'transcript_ready', 'indexing_ready', 'indexed', 'summaries_ready', 'ready', 'failed')",
    },
    started_at: {
      type: 'timestamp',
      notNull: true,
    },
    ended_at: {
      type: 'timestamp',
    },
    duration_ms: {
      type: 'integer',
    },
    title: {
      type: 'varchar(500)',
    },
    consent_message_id: {
      type: 'varchar(20)',
    },
    consent_channel_id: {
      type: 'varchar(20)',
    },
    failed_reason: {
      type: 'text',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('recordings', 'workspace_id');
  pgm.createIndex('recordings', 'guild_id');
  pgm.createIndex('recordings', 'voice_channel_id');
  pgm.createIndex('recordings', 'initiator_user_id');
  pgm.createIndex('recordings', 'started_at');
  pgm.createIndex('recordings', 'status');
  pgm.createIndex('recordings', 'source');

  // Recording participants
  pgm.createTable('recording_participants', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    recording_id: {
      type: 'uuid',
      notNull: true,
      references: 'recordings(id)',
      onDelete: 'CASCADE',
    },
    discord_user_id: {
      type: 'varchar(20)',
      notNull: true,
    },
    display_name: {
      type: 'varchar(255)',
    },
    avatar_url: {
      type: 'varchar(500)',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('recording_participants', 'recording_id');
  pgm.createIndex('recording_participants', 'discord_user_id');
  pgm.createUniqueIndex('recording_participants', ['recording_id', 'discord_user_id']);

  // Participant intervals (for ACL)
  pgm.createTable('participant_intervals', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    recording_id: {
      type: 'uuid',
      notNull: true,
      references: 'recordings(id)',
      onDelete: 'CASCADE',
    },
    discord_user_id: {
      type: 'varchar(20)',
      notNull: true,
    },
    start_ts: {
      type: 'bigint',
      notNull: true,
      comment: 'Timestamp in milliseconds from recording start',
    },
    end_ts: {
      type: 'bigint',
      comment: 'Timestamp in milliseconds from recording start, NULL if still active',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('participant_intervals', 'recording_id');
  pgm.createIndex('participant_intervals', 'discord_user_id');
  pgm.createIndex('participant_intervals', ['recording_id', 'discord_user_id']);
  pgm.createIndex('participant_intervals', ['recording_id', 'start_ts', 'end_ts']);

  // Audio tracks
  pgm.createTable('audio_tracks', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    recording_id: {
      type: 'uuid',
      notNull: true,
      references: 'recordings(id)',
      onDelete: 'CASCADE',
    },
    discord_user_id: {
      type: 'varchar(20)',
      comment: 'NULL for mixed track',
    },
    track_type: {
      type: 'varchar(20)',
      notNull: true,
      default: 'user',
      check: "track_type IN ('user', 'mixed')",
    },
    object_key: {
      type: 'varchar(500)',
      notNull: true,
    },
    duration_ms: {
      type: 'integer',
    },
    codec: {
      type: 'varchar(50)',
    },
    sample_rate: {
      type: 'integer',
    },
    channels: {
      type: 'integer',
    },
    file_size_bytes: {
      type: 'bigint',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('audio_tracks', 'recording_id');
  pgm.createIndex('audio_tracks', 'discord_user_id');
  pgm.createIndex('audio_tracks', ['recording_id', 'track_type']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('audio_tracks');
  pgm.dropTable('participant_intervals');
  pgm.dropTable('recording_participants');
  pgm.dropTable('recordings');
}
