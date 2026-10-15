// Applies db/migrations/*.sql that have not run yet, in name order, each in its own transaction.
//   DATABASE_URL=<owner connection> npm run db:migrate
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';

export async function migrate(client, log = console.log) {
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const dir = new URL('../db/migrations/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  let n = 0;
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = (await readFile(new URL(f, dir), 'utf8')).replace(/^\s*(BEGIN|COMMIT);\s*$/gim, '');
    await client.query('BEGIN');
    try { await client.query(sql); await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]); await client.query('COMMIT'); }
    catch (e) { await client.query('ROLLBACK'); throw new Error(`${f}: ${e.message}`); }
    log(`Applied ${f}`); n++;
  }
  if (!n) log('Database is up to date.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('Set DATABASE_URL (the owner connection) first.'); process.exit(1); }
  const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: true } });
  await client.connect();
  try { await migrate(client); } catch (e) { console.error(e.message); process.exitCode = 1; } finally { await client.end(); }
}
