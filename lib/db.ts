import 'server-only';
import { Client, Pool, type PoolClient, type QueryResultRow } from 'pg';

export type Db = {
  q<T extends QueryResultRow = any>(sql: string, params?: unknown[]): Promise<T[]>;
  one<T extends QueryResultRow = any>(sql: string, params?: unknown[]): Promise<T | undefined>;
};

const isWorkers = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';

function connectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Add your Neon connection string to the environment.');
  return url;
}

function sslFor(url: string) {
  return /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: true };
}

let pool: Pool | undefined;
function getPool() {
  if (!pool) {
    const url = connectionString();
    pool = new Pool({ connectionString: url, ssl: sslFor(url), max: 5, idleTimeoutMillis: 10_000 });
  }
  return pool;
}

function wrap(c: Client | PoolClient): Db {
  return {
    async q(sql, params) { return (await c.query(sql, params as any[])).rows; },
    async one(sql, params) { return (await c.query(sql, params as any[])).rows[0]; },
  };
}

/** Run work on one connection. Cloudflare Workers cannot reuse sockets across requests, so they get a fresh client. */
export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  if (isWorkers) {
    const url = connectionString();
    const c = new Client({ connectionString: url, ssl: sslFor(url) });
    await c.connect();
    try { return await fn(wrap(c)); } finally { await c.end().catch(() => {}); }
  }
  const c = await getPool().connect();
  try { return await fn(wrap(c)); } finally { c.release(); }
}

/** Same as withDb, inside a transaction that rolls back on any error. */
export async function withTx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return withDb(async (db) => {
    await db.q('BEGIN');
    try { const r = await fn(db); await db.q('COMMIT'); return r; }
    catch (e) { await db.q('ROLLBACK').catch(() => {}); throw e; }
  });
}

export async function logChange(db: Db, actor: string, entity: string, entityId: string, action: string, summary: string, before?: unknown, after?: unknown) {
  await db.q(
    'INSERT INTO change_log (actor, entity, entity_id, action, summary, before, after) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [actor, entity, entityId, action, summary, before === undefined ? null : JSON.stringify(before), after === undefined ? null : JSON.stringify(after)],
  );
}
