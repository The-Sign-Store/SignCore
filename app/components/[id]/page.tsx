import Link from 'next/link';
import { notFound } from 'next/navigation';
import { withDb } from '@/lib/db';
import { showIfVariables, calcVariables, overrideVariables } from '@/lib/specs';
import ComponentHeader from './ComponentHeader';
import FieldList from './FieldList';

export const dynamic = 'force-dynamic';

export default async function ComponentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await withDb(async (db) => {
    const c = await db.one('SELECT * FROM components WHERE component_id=$1', [decodeURIComponent(id)]);
    if (!c) return null;
    const [fields, products, rules, drawings] = await Promise.all([
      db.q('SELECT * FROM component_fields WHERE component_id=$1 ORDER BY sort_order, id', [c.component_id]),
      db.q(`SELECT product_name, section_title, include, default_overrides FROM product_components WHERE component_id=$1 ORDER BY product_name, sort_order`, [c.component_id]),
      db.q(`SELECT r.rule_id, r.standard, r.active FROM design_guide_rules r
            WHERE EXISTS (SELECT 1 FROM design_guide_rule_components x WHERE x.rule_id=r.rule_id AND x.component_id=$1)
               OR r.match_rule ~ ('COMPONENT\\s*[!~]?=[^|]*\\m' || $1 || '\\M') ORDER BY r.sort_order`, [c.component_id]),
      db.q(`SELECT d.drawing_id, d.title FROM detail_drawings d JOIN detail_drawing_components x USING (drawing_id) WHERE x.component_id=$1 ORDER BY d.sort_order`, [c.component_id]),
    ]);
    return { c, fields, products, rules, drawings };
  });
  if (!data) notFound();
  const { c, fields, products, rules, drawings } = data;

  const vars = new Set(fields.map((f) => f.variable));
  const issues: string[] = [];
  for (const f of fields) {
    for (const v of showIfVariables(f.show_if)) if (!vars.has(v)) issues.push(`${f.variable}: Show If uses ${v}, which is not a field here.`);
    if (f.field_type === 'calc') for (const v of calcVariables(f.options)) if (!vars.has(v)) issues.push(`${f.variable}: calculation uses {${v}}, which is not a field here.`);
  }
  for (const p of products) for (const v of overrideVariables(p.default_overrides)) if (!vars.has(v)) issues.push(`${p.product_name}: product default sets ${v}, which is not a field here.`);

  return (
    <div className="stack">
      <div className="head">
        <div>
          <div className="crumbs"><Link href="/components">Components</Link> /</div>
          <h1>{c.display_name} <span className="mono muted small">{c.component_id}</span></h1>
          {c.description && <p className="sub">{c.description}</p>}
        </div>
      </div>
      <div className="grid2">
        <div className="stack">
          <FieldList componentId={c.component_id} fields={fields} />
          <ComponentHeader c={c} />
        </div>
        <aside className="stack">
          {issues.length > 0 && (
            <div className="card"><div className="hd"><h3>Check these</h3><span className="chip warn">{issues.length}</span></div>
              <div className="bd"><ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{issues.map((i, k) => <li key={k}>{i}</li>)}</ul></div></div>
          )}
          <div className="card"><div className="hd"><h3>Used in products</h3><span className="chip">{new Set(products.map((p) => p.product_name)).size}</span></div>
            <div className="bd small">{products.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>{products.map((p, i) => (
                <li key={i}><Link href={`/products/${encodeURIComponent(p.product_name)}`}>{p.product_name}</Link>{p.section_title && p.section_title !== c.display_name && <span className="muted"> · {p.section_title}</span>} <span className="muted">({p.include})</span></li>))}</ul>
            ) : <span className="muted">Not in any product yet. Add it from a product page.</span>}</div></div>
          <div className="card"><div className="hd"><h3>Design Guide rules</h3><span className="chip">{rules.length}</span></div>
            <div className="bd small">{rules.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>{rules.map((r) => (
                <li key={r.rule_id}><Link href={`/guide/${r.rule_id}`} className="mono">{r.rule_id}</Link> <span className={r.active ? '' : 'muted'}>{r.standard.slice(0, 90)}{r.standard.length > 90 ? '…' : ''}</span></li>))}</ul>
            ) : <span className="muted">No rules name this component. Rules that apply to every proof still apply.</span>}</div></div>
          <div className="card"><div className="hd"><h3>Detail drawings</h3><span className="chip">{drawings.length}</span></div>
            <div className="bd small">{drawings.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>{drawings.map((d) => <li key={d.drawing_id}><Link href={`/drawings/${d.drawing_id}`}>{d.title || d.drawing_id}</Link></li>)}</ul>
            ) : <span className="muted">None listed for this component.</span>}</div></div>
        </aside>
      </div>
    </div>
  );
}
