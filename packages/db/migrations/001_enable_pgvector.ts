import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('CREATE EXTENSION IF NOT EXISTS vector;');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP EXTENSION IF EXISTS vector;');
}
