import pg from 'pg';
const { Pool } = pg;

export interface DatabaseConfig {
  connectionString: string;
  ssl?: boolean;
}

export function createPool(config: DatabaseConfig): pg.Pool {
  return new Pool({
    connectionString: config.connectionString,
    ssl: config.ssl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

export * from './types';
export * from './recording-state';
