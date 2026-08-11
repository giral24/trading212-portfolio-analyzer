import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { getEnv } from '@/lib/env';

import * as schema from './schema';

export type DrizzleDatabase = PostgresJsDatabase<typeof schema>;

let database: DrizzleDatabase | undefined;

/** Lazily creates the local database client only when server code executes. */
export function getDb(): DrizzleDatabase {
  if (database === undefined) {
    const { databaseUrl } = getEnv();
    database = drizzle(postgres(databaseUrl), { schema });
  }

  return database;
}
