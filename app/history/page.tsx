import Link from 'next/link';
import { withDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const LINK: Record<string, (id: string) => string | null> = {
  component: (id) => `/components/${id}`,
  field: (id) => `/components/${id.split('.')[0]}`,
  product: (id) => `/products/${encodeURIComponent(id)}`,
  assembly: (id) => `/products/${encodeURIComponent(id)}`,
  rule: (id) => `/guide/${id}`,
  drawing: (id) => `/drawings/${id}`,
};

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const rows = await withDb((db) => db.q('SELECT id, changed_at, actor, entity, entity_id, action, summary, before, after FROM change_log ORDER BY changed_at DESC, id DESC LIMIT 51 OFFSET $1', [(page - 1) * 50]));
  return (
    <div className="stack">
      <div className="head"><div><h1>Change History</h1><p className="sub">Every edit, newest first, with who made it. Open a row to see the values before and after.</p></div></div>
      <div className="card flat"><div className="bd tbl-wrap"><table>
        <thead><tr><th>When</th><th>Who</th><th>Change</th><th>Action</th></tr></thead>
        <tbody>{rows.slice(0, 50).map((r) => {
          const href = LINK[r.entity]?.(r.entity_id);
          return (
            <tr key={r.id}>
              <td className="small" style={{ whiteSpace: 'nowrap' }}>{new Date(r.changed_at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })}</td>
              <td className="small">{r.actor}</td>
              <td>{href && r.action !== 'delete' ? <Link href={href}>{r.summary}</Link> : r.summary}
                {(r.before || r.after) && <details className="more"><summary>Before and after</summary><Diff before={r.before} after={r.after} /></details>}</td>
              <td><span className={`chip${r.action === 'delete' ? ' off' : r.action === 'create' ? ' on' : ''}`}>{r.action}</span></td>
            </tr>);
        })}</tbody></table></div></div>
      <div className="row">{page > 1 && <Link className="btn" href={`/history?page=${page - 1}`}>Newer</Link>}{rows.length > 50 && <Link className="btn" href={`/history?page=${page + 1}`}>Older</Link>}</div>
    </div>
  );
}

function Diff({ before, after }: { before: any; after: any }) {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].filter((k) => !['updated_at', 'id'].includes(k));
  const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  const changed = keys.filter((k) => fmt(before?.[k]) !== fmt(after?.[k]));
  if (!changed.length) return <p className="small muted">No field values changed.</p>;
  return (
    <table className="small" style={{ marginTop: 6 }}><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
      <tbody>{changed.map((k) => <tr key={k}><td className="mono">{k}</td><td style={{ color: 'var(--bad)', overflowWrap: 'anywhere' }}>{fmt(before?.[k]).slice(0, 400)}</td><td style={{ color: 'var(--ok)', overflowWrap: 'anywhere' }}>{fmt(after?.[k]).slice(0, 400)}</td></tr>)}</tbody></table>
  );
}
