import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from './config';

const isLocal = config.databaseUrl?.includes('localhost') || config.databaseUrl?.includes('127.0.0.1');

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 1500,
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}
