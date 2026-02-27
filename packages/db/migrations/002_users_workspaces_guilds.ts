import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Users table
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: 'varchar(255)',
    },
    role: {
      type: 'varchar(20)',
      notNull: true,
      default: 'user',
      check: "role IN ('user', 'admin')",
    },
    is_active: {
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

  pgm.createIndex('users', 'email');
  pgm.createIndex('users', 'role');
  pgm.createIndex('users', 'is_active');

  // User Discord links
  pgm.createTable('user_discord_links', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    discord_user_id: {
      type: 'varchar(20)',
      notNull: true,
      unique: true,
    },
    discord_username: {
      type: 'varchar(255)',
    },
    discord_discriminator: {
      type: 'varchar(4)',
    },
    discord_avatar: {
      type: 'varchar(255)',
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

  pgm.createIndex('user_discord_links', 'user_id');
  pgm.createIndex('user_discord_links', 'discord_user_id');
  pgm.createUniqueIndex('user_discord_links', ['user_id', 'discord_user_id']);

  // Workspaces
  pgm.createTable('workspaces', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    owner_user_id: {
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
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('workspaces', 'owner_user_id');

  // Workspace members (many-to-many)
  pgm.createTable('workspace_members', {
    workspace_id: {
      type: 'uuid',
      notNull: true,
      references: 'workspaces(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    role: {
      type: 'varchar(20)',
      notNull: true,
      default: 'member',
      check: "role IN ('member', 'admin')",
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    primaryKey: ['workspace_id', 'user_id'],
  });

  pgm.createIndex('workspace_members', 'workspace_id');
  pgm.createIndex('workspace_members', 'user_id');

  // Guilds
  pgm.createTable('guilds', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    discord_guild_id: {
      type: 'varchar(20)',
      notNull: true,
      unique: true,
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    icon: {
      type: 'varchar(255)',
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

  pgm.createIndex('guilds', 'discord_guild_id');

  // Workspace guilds (many-to-many)
  pgm.createTable('workspace_guilds', {
    workspace_id: {
      type: 'uuid',
      notNull: true,
      references: 'workspaces(id)',
      onDelete: 'CASCADE',
    },
    guild_id: {
      type: 'uuid',
      notNull: true,
      references: 'guilds(id)',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    primaryKey: ['workspace_id', 'guild_id'],
  });

  pgm.createIndex('workspace_guilds', 'workspace_id');
  pgm.createIndex('workspace_guilds', 'guild_id');

  // Guild settings
  pgm.createTable('guild_settings', {
    guild_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'guilds(id)',
      onDelete: 'CASCADE',
    },
    consent_channel_id: {
      type: 'varchar(20)',
    },
    consent_message_template: {
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

  // Voice channels
  pgm.createTable('voice_channels', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    guild_id: {
      type: 'uuid',
      notNull: true,
      references: 'guilds(id)',
      onDelete: 'CASCADE',
    },
    discord_channel_id: {
      type: 'varchar(20)',
      notNull: true,
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
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

  pgm.createIndex('voice_channels', 'guild_id');
  pgm.createIndex('voice_channels', 'discord_channel_id');
  pgm.createUniqueIndex('voice_channels', ['guild_id', 'discord_channel_id']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('voice_channels');
  pgm.dropTable('guild_settings');
  pgm.dropTable('workspace_guilds');
  pgm.dropTable('guilds');
  pgm.dropTable('workspace_members');
  pgm.dropTable('workspaces');
  pgm.dropTable('user_discord_links');
  pgm.dropTable('users');
}
