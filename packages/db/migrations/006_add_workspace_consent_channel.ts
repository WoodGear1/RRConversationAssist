import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add consent_channel_id to workspaces as fallback
  pgm.addColumn('workspaces', {
    consent_channel_id: {
      type: 'varchar(20)',
      comment: 'Fallback Discord channel ID for consent messages if guild settings are not configured',
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('workspaces', 'consent_channel_id');
}
