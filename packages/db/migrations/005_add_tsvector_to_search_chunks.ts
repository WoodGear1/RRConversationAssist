import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add tsvector column to search_chunks for full-text search
  // This is a generated column that automatically updates when text changes
  pgm.sql(`
    ALTER TABLE search_chunks 
    ADD COLUMN IF NOT EXISTS text_vector tsvector 
    GENERATED ALWAYS AS (to_tsvector('russian', COALESCE(text, ''))) STORED;
  `);

  // Create GIN index for fast full-text search
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS search_chunks_text_vector_idx 
    ON search_chunks 
    USING gin (text_vector);
  `);

  // Update existing rows to populate text_vector
  // (This is automatically done by the GENERATED column, but we can force it)
  pgm.sql(`
    UPDATE search_chunks 
    SET text = text 
    WHERE text_vector IS NULL;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop index
  pgm.sql(`
    DROP INDEX IF EXISTS search_chunks_text_vector_idx;
  `);

  // Drop column
  pgm.sql(`
    ALTER TABLE search_chunks 
    DROP COLUMN IF EXISTS text_vector;
  `);
}
