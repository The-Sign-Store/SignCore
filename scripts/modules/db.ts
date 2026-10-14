import pg from 'pg';
export async function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL first.');
  const c = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: true } });
  await c.connect();
  return { q: async (sql: string, params?: unknown[]) => (await c.query(sql, params as any[])).rows, end: () => c.end() };
}
