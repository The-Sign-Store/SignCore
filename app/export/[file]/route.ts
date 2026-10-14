import { withDb } from '@/lib/db';
import { SHEET_EXPORTS, toCsv, sqlBackup } from '@/lib/exports';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const stamp = new Date().toISOString().slice(0, 10);
  if (file === 'backup.sql') {
    const sql = await withDb(sqlBackup);
    return new Response(sql, { headers: { 'content-type': 'application/sql; charset=utf-8', 'content-disposition': `attachment; filename="signcore-backup-${stamp}.sql"` } });
  }
  const name = file.replace(/\.csv$/, '');
  const spec = SHEET_EXPORTS[name];
  if (!spec) return new Response('Unknown export', { status: 404 });
  const rows = await withDb(spec.rows);
  return new Response('﻿' + toCsv(spec.headers, rows), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${spec.tab}-${stamp}.csv"` },
  });
}
