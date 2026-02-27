import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // TODO: Implement migration
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // TODO: Implement rollback
}
