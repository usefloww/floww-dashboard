import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Lazy initialization to avoid issues with Vite SSR
let _client: postgres.Sql | null = null;
let _db: PostgresJsDatabase<typeof schema> | null = null;

function getConnectionString(): string {
  return process.env.DATABASE_URL || 'postgresql://admin:secret@localhost:5432/postgres';
}

/**
 * Get the postgres client (lazy initialization)
 */
export function getClient(): postgres.Sql {
  if (!_client) {
    _client = postgres(getConnectionString());
  }
  return _client;
}

/**
 * Get the drizzle database instance (lazy initialization)
 */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!_db) {
    _db = drizzle(getClient(), { schema });
  }
  return _db;
}

// Export type for use in other modules
export type Database = PostgresJsDatabase<typeof schema>;
