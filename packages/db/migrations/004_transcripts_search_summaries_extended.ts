import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Transcripts
  pgm.createTable('transcripts', {
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
    version: {
      type: 'integer',
      notNull: true,
      default: 1,
    },
    provider: {
      type: 'varchar(50)',
      notNull: true,
      default: 'openai',
    },
    model: {
      type: 'varchar(100)',
    },
    is_official: {
      type: 'boolean',
      notNull: true,
      default: true,
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

  pgm.createIndex('transcripts', 'recording_id');
  pgm.createIndex('transcripts', ['recording_id', 'version']);
  pgm.createIndex('transcripts', ['recording_id', 'is_official']);

  // Transcript segments
  pgm.createTable('transcript_segments', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    transcript_id: {
      type: 'uuid',
      notNull: true,
      references: 'transcripts(id)',
      onDelete: 'CASCADE',
    },
    discord_user_id: {
      type: 'varchar(20)',
    },
    start_ms: {
      type: 'integer',
      notNull: true,
    },
    end_ms: {
      type: 'integer',
      notNull: true,
    },
    text: {
      type: 'text',
      notNull: true,
    },
    words_json: {
      type: 'jsonb',
      comment: 'Word-level timestamps if available',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('transcript_segments', 'transcript_id');
  pgm.createIndex('transcript_segments', 'discord_user_id');
  pgm.createIndex('transcript_segments', ['transcript_id', 'start_ms', 'end_ms']);

  // Search chunks (for semantic and full-text search)
  pgm.createTable('search_chunks', {
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
    transcript_id: {
      type: 'uuid',
      references: 'transcripts(id)',
      onDelete: 'CASCADE',
    },
    text: {
      type: 'text',
      notNull: true,
    },
    embedding: {
      type: 'vector(1536)',
      comment: 'OpenAI embedding dimension',
    },
    start_ms: {
      type: 'integer',
      notNull: true,
    },
    end_ms: {
      type: 'integer',
      notNull: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('search_chunks', 'recording_id');
  pgm.createIndex('search_chunks', 'transcript_id');
  pgm.createIndex('search_chunks', ['recording_id', 'start_ms', 'end_ms']);
  
  // GIN index for full-text search (will be created after adding tsvector column)
  // pgm.createIndex('search_chunks', 'text_vector', { method: 'gin' });
  
  // HNSW index for vector similarity search
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS search_chunks_embedding_idx 
    ON search_chunks 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  `);

  // Summary templates
  pgm.createTable('summary_templates', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    prompt: {
      type: 'text',
      notNull: true,
    },
    output_schema_json: {
      type: 'jsonb',
      notNull: true,
    },
    owner_user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'SET NULL',
      comment: 'NULL for global templates',
    },
    is_default: {
      type: 'boolean',
      notNull: true,
      default: false,
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

  pgm.createIndex('summary_templates', 'owner_user_id');
  pgm.createIndex('summary_templates', 'is_default');

  // Summary runs
  pgm.createTable('summary_runs', {
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
    template_id: {
      type: 'uuid',
      notNull: true,
      references: 'summary_templates(id)',
      onDelete: 'CASCADE',
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'queued',
      check: "status IN ('queued', 'processing', 'completed', 'failed')",
    },
    result_json: {
      type: 'jsonb',
    },
    raw_response: {
      type: 'text',
      comment: 'Raw LLM response before validation',
    },
    error_message: {
      type: 'text',
    },
    is_outdated: {
      type: 'boolean',
      notNull: true,
      default: false,
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

  pgm.createIndex('summary_runs', 'recording_id');
  pgm.createIndex('summary_runs', 'template_id');
  pgm.createIndex('summary_runs', 'status');
  pgm.createIndex('summary_runs', 'is_outdated');

  // VAD runs
  pgm.createTable('vad_runs', {
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
    version: {
      type: 'integer',
      notNull: true,
      default: 1,
    },
    provider: {
      type: 'varchar(50)',
      notNull: true,
      check: "provider IN ('silero', 'ffmpeg', 'webrtc')",
    },
    params_json: {
      type: 'jsonb',
    },
    speech_ranges_json: {
      type: 'jsonb',
      notNull: true,
      comment: 'Array of {start_ms, end_ms} intervals',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('vad_runs', 'recording_id');
  pgm.createIndex('vad_runs', ['recording_id', 'version']);

  // Chapters
  pgm.createTable('chapters', {
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
    version: {
      type: 'integer',
      notNull: true,
      default: 1,
    },
    items_json: {
      type: 'jsonb',
      notNull: true,
      comment: 'Array of {label, start_ms, end_ms}',
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

  pgm.createIndex('chapters', 'recording_id');
  pgm.createIndex('chapters', ['recording_id', 'version']);

  // Recording events
  pgm.createTable('recording_events', {
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
    ts: {
      type: 'bigint',
      notNull: true,
      comment: 'Timestamp in milliseconds from recording start',
    },
    type: {
      type: 'varchar(50)',
      notNull: true,
    },
    actor_discord_user_id: {
      type: 'varchar(20)',
    },
    payload_json: {
      type: 'jsonb',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('recording_events', 'recording_id');
  pgm.createIndex('recording_events', ['recording_id', 'ts']);
  pgm.createIndex('recording_events', 'type');

  // Redactions
  pgm.createTable('redactions', {
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
    start_ms: {
      type: 'integer',
      notNull: true,
    },
    end_ms: {
      type: 'integer',
      notNull: true,
    },
    reason: {
      type: 'text',
      notNull: true,
    },
    created_by: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('redactions', 'recording_id');
  pgm.createIndex('redactions', ['recording_id', 'start_ms', 'end_ms']);

  // Projects
  pgm.createTable('projects', {
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
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    description: {
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

  pgm.createIndex('projects', 'workspace_id');

  // Tags
  pgm.createTable('tags', {
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
    name: {
      type: 'varchar(100)',
      notNull: true,
    },
    color: {
      type: 'varchar(7)',
      comment: 'Hex color code',
    },
    icon: {
      type: 'varchar(50)',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('tags', 'workspace_id');
  pgm.createUniqueIndex('tags', ['workspace_id', 'name']);

  // Recording tags (many-to-many)
  pgm.createTable('recording_tags', {
    recording_id: {
      type: 'uuid',
      notNull: true,
      references: 'recordings(id)',
      onDelete: 'CASCADE',
    },
    tag_id: {
      type: 'uuid',
      notNull: true,
      references: 'tags(id)',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    primaryKey: ['recording_id', 'tag_id'],
  });

  pgm.createIndex('recording_tags', 'recording_id');
  pgm.createIndex('recording_tags', 'tag_id');

  // Recording project (many-to-many, but typically one project per recording)
  pgm.createTable('recording_project', {
    recording_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'recordings(id)',
      onDelete: 'CASCADE',
    },
    project_id: {
      type: 'uuid',
      notNull: true,
      references: 'projects(id)',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('recording_project', 'project_id');

  // Shares
  pgm.createTable('shares', {
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
    share_id: {
      type: 'varchar(100)',
      notNull: true,
      unique: true,
      comment: 'Short token for URL',
    },
    allowed_ranges_override: {
      type: 'jsonb',
      comment: 'Override allowed ranges for this share',
    },
    expires_at: {
      type: 'timestamp',
    },
    mode: {
      type: 'varchar(20)',
      notNull: true,
      default: 'anyone',
      check: "mode IN ('anyone', 'authenticated', 'restricted')",
    },
    with_comments: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    revoked: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    created_by: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('shares', 'recording_id');
  pgm.createIndex('shares', 'share_id');
  pgm.createIndex('shares', 'expires_at');

  // Integrations
  pgm.createTable('integrations', {
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
    type: {
      type: 'varchar(50)',
      notNull: true,
      check: "type IN ('weeek', 'webhook', 'generic')",
    },
    enabled: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    config_json: {
      type: 'jsonb',
      comment: 'Non-sensitive config, secrets in .env',
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

  pgm.createIndex('integrations', 'workspace_id');
  pgm.createIndex('integrations', 'type');

  // Integration mappings (discord_user_id -> external_user_id)
  pgm.createTable('integration_mappings', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    integration_id: {
      type: 'uuid',
      notNull: true,
      references: 'integrations(id)',
      onDelete: 'CASCADE',
    },
    discord_user_id: {
      type: 'varchar(20)',
      notNull: true,
    },
    external_user_id: {
      type: 'varchar(255)',
      notNull: true,
    },
    external_task_id: {
      type: 'varchar(255)',
      comment: 'For tracking created tasks',
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

  pgm.createIndex('integration_mappings', 'integration_id');
  pgm.createIndex('integration_mappings', 'discord_user_id');
  pgm.createUniqueIndex('integration_mappings', ['integration_id', 'discord_user_id']);

  // Add tsvector column to search_chunks for full-text search
  pgm.sql(`
    ALTER TABLE search_chunks 
    ADD COLUMN text_vector tsvector 
    GENERATED ALWAYS AS (to_tsvector('russian', text)) STORED;
  `);

  pgm.sql(`
    CREATE INDEX search_chunks_text_vector_idx 
    ON search_chunks 
    USING gin(text_vector);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('integration_mappings');
  pgm.dropTable('integrations');
  pgm.dropTable('shares');
  pgm.dropTable('recording_project');
  pgm.dropTable('recording_tags');
  pgm.dropTable('tags');
  pgm.dropTable('projects');
  pgm.dropTable('redactions');
  pgm.dropTable('recording_events');
  pgm.dropTable('chapters');
  pgm.dropTable('vad_runs');
  pgm.dropTable('summary_runs');
  pgm.dropTable('summary_templates');
  pgm.dropTable('search_chunks');
  pgm.dropTable('transcript_segments');
  pgm.dropTable('transcripts');
}
