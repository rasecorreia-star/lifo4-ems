import { Pool, PoolClient } from 'pg';
import { logger } from '../../lib/logger.js';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'lifo4_ems',
      user: process.env.DB_USER || 'lifo4admin',
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });

    pool.on('error', (err) => {
      logger.error('PostgreSQL pool error', { error: err.message });
    });
  }
  return pool;
}

/** Run a function within a transaction. Rolls back on error. */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Set the current organization context for Row-Level Security. */
export async function setOrgContext(client: PoolClient, orgId: string): Promise<void> {
  await client.query(`SELECT set_config('app.current_org_id', $1, TRUE)`, [orgId]);
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
