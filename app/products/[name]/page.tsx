import Link from 'next/link';
import { notFound } from 'next/navigation';
import { withDb } from '@/lib/db';
import SectionList from './SectionList';
import ProductSettings from './ProductSettings';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent((await params).name);
  const data = await withDb(async (db) => {
    const p = await db.one('SELECT * FROM products WHERE product_name=$1', [name]);
    if (!p) return null;
    const [sections, components, legacy] = await Promise.all([
      db.q(`SELECT pc.*, c.display_name FROM product_components pc JOIN components c USING (component_id) WHERE product_name=$1 ORDER BY sort_order`, [name]),
      db.q(`SELECT c.component_id, c.display_name, c.repeatable, coalesce(array_agg(f.variable ORDER BY f.sort_order) FILTER (WHERE f.id IS NOT NULL), '{}') AS vars
            FROM components c LEFT JOIN component_fields f USING (component_id) GROUP BY c.component_id ORDER BY c.display_name`),
      db.q('SELECT * FROM product_fields WHERE product_name=$1 ORDER BY sort_order', [name]),
    ]);
    return { p, sections, components, legacy };
  });
  if (!data) notFound();
  const { p, sections, components, legacy } = data;

  // Proof page preview: sections sharing a page group share a page, max 2 per page.
  const pages: string[][] = [];
  const groups = new Map<string, string[]>();
  for (const s of sections) { const k = s.page_group == null ? `solo-${s.id}` : `g${s.page_group}`; groups.set(k, [...(groups.get(k) || []), s.section_title || s.display_name]); }
  for (const g of groups.values()) for (let i = 0; i < g.length; i += 2) pages.push(g.slice(i, i + 2));

  return (
    <div className="stack">
      <div className="head"><div>
        <div className="crumbs"><Link href="/products">Products</Link> /</div>
        <h1>{p.product_name}</h1>
        <p className="sub">Sections print on the proof in this order. Edit a section to change its include setting, page group or product-specific defaults.</p>
      </div></div>
      <div className="grid2">
        <div className="stack">
          <SectionList product={p.product_name} sections={sections} components={components} />
          {legacy.length > 0 && (
            <div className="card flat"><div className="hd"><h2>Legacy fields</h2><span className="small muted">From Product_Schema. Read only here; SignCore uses them only when the product has no sections.</span></div>
              <div className="bd tbl-wrap"><table><thead><tr><th>Column</th><th>Variable</th><th>Default</th><th>Options</th></tr></thead>
                <tbody>{legacy.map((f) => <tr key={f.id}><td className="small">{f.zone}</td><td><b>{f.variable}</b></td><td className="small">{f.default_value}</td><td className="small muted">{f.options}</td></tr>)}</tbody></table></div></div>
          )}
          <ProductSettings name={p.product_name} />
        </div>
        <aside className="stack">
          <div className="card"><div className="hd"><h3>Proof pages</h3><span className="chip">{pages.length}</span></div>
            <div className="bd small">{pages.length ? <ol style={{ margin: 0, paddingLeft: 18 }}>{pages.map((pg, i) => <li key={i}>{pg.join(' + ')}</li>)}</ol>
              : <span className="muted">Add a section to see the pages.</span>}
              <p className="muted" style={{ marginBottom: 0 }}>Approximate. SignCore also pairs leftover single sections from neighboring groups.</p></div></div>
        </aside>
      </div>
    </div>
  );
}
