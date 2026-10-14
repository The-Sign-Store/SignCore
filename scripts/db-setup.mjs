// One-time setup: creates the tables and loads the SignCore data into the database in DATABASE_URL.
// Usage:  DATABASE_URL="postgresql://..." npm run db:setup
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) { console.error('Set DATABASE_URL to your Neon connection string first.'); process.exit(1); }
const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: true } });
await client.connect();
const { rows } = await client.query(`SELECT to_regclass('public.components') AS t`);
if (rows[0].t) { console.error('The tables already exist in this database. Setup only runs on an empty database.'); await client.end(); process.exit(1); }
for (const f of ['db/schema.sql', 'db/seed.sql']) {
  process.stdout.write(`Running ${f}… `);
  await client.query(await readFile(new URL(`../${f}`, import.meta.url), 'utf8'));
  console.log('done');
}
const c = await client.query('SELECT (SELECT count(*) FROM components) AS components, (SELECT count(*) FROM component_fields) AS fields, (SELECT count(*) FROM design_guide_rules) AS rules');
console.log('Loaded:', c.rows[0]);
await client.end();
