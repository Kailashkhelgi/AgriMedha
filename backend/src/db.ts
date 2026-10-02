import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from './config';

const hasDbUrl = Boolean(config.databaseUrl && config.databaseUrl.trim().length > 0);
const isLocal = config.databaseUrl?.includes('localhost') || config.databaseUrl?.includes('127.0.0.1');

export const pool = new Pool({
  connectionString: hasDbUrl ? config.databaseUrl : undefined,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 1000,
});

let dbOfflineUntil = 0;
const DB_RETRY_INTERVAL_MS = 30000; // 30-second cooldown if offline before retrying

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  if (!hasDbUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  const now = Date.now();
  if (now < dbOfflineUntil) {
    throw new Error('Database is temporarily offline (cooldown active)');
  }

  try {
    const res = await pool.query<T>(text, params);
    dbOfflineUntil = 0; // reset on successful query
    return res;
  } catch (err) {
    dbOfflineUntil = Date.now() + DB_RETRY_INTERVAL_MS;
    throw err;
  }
}
