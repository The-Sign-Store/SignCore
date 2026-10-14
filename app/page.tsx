import Link from 'next/link';
import { withDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Overview() {
  const d = await withDb(async (db) => ({
    counts: await db.one(`SELECT (SELECT count(*) FROM components)::int AS components, (SELECT count(*) FROM component_fields)::int AS fields,
      (SELECT count(*) FROM products)::int AS products, (SELECT count(*) FROM design_guide_rules WHERE active)::int AS rules,
      (SELECT count(*) FROM detail_drawings WHERE active)::int AS drawings`),
    recent: await db.q('SELECT changed_at, actor, summary, action FROM change_log ORDER BY changed_at DESC, id DESC LIMIT 8'),
    unused: await db.q(`SELECT component_id, display_name FROM components c WHERE NOT EXISTS (SELECT 1 FROM product_components p WHERE p.component_id=c.component_id) ORDER BY display_name`),
  }));
  const tiles: [string, number, string][] = [
    ['Components', d.counts.components, '/components'], ['Fields', d.counts.fields, '/components'], ['Products', d.counts.products, '/products'],
    ['Active rules', d.counts.rules, '/guide'], ['Active drawings', d.counts.drawings, '/drawings'],
  ];
  return (
    <div className="stack">
      <div className="head"><div><h1>Overview</h1><p className="sub">Edit SignCore's specs here. Changes save to the database right away and are recorded in Change History.</p></div></div>
      <div className="stats">{tiles.map(([label, n, href]) => (
        <Link key={label} href={href} className="card stat" style={{ color: 'inherit', textDecoration: 'none' }}><b>{n}</b><span className="muted small">{label}</span></Link>))}</div>
      <div className="grid2">
        <div className="card flat"><div className="hd"><h2>Recent changes</h2><Link href="/history" className="small">All changes</Link></div>
          <div className="bd tbl-wrap"><table><tbody>{d.recent.map((r, i) => (
            <tr key={i}><td className="small muted" style={{ whiteSpace: 'nowrap' }}>{new Date(r.changed_at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'short', timeStyle: 'short' })}</td>
              <td>{r.summary}</td><td className="small muted">{r.actor}</td></tr>))}</tbody></table></div></div>
        <div className="card"><div className="hd"><h3>Components not in any product</h3><span className="chip">{d.unused.length}</span></div>
          <div className="bd small">{d.unused.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{d.unused.map((c) => <li key={c.component_id}><Link href={`/components/${c.component_id}`}>{c.display_name}</Link></li>)}</ul>
            : <span className="muted">Every component is used by at least one product.</span>}
            </div></div>
      </div>
    </div>
  );
}
