import Link from 'next/link';
import { withDb } from '@/lib/db';
import Filter from '@/components/Filter';
import NewComponent from './NewComponent';

export const dynamic = 'force-dynamic';

export default async function ComponentsPage() {
  const rows = await withDb((db) => db.q(`
    SELECT c.*, (SELECT count(*) FROM component_fields f WHERE f.component_id=c.component_id)::int AS fields,
           (SELECT count(DISTINCT product_name) FROM product_components p WHERE p.component_id=c.component_id)::int AS products
    FROM components c ORDER BY c.sort_order, c.component_id`));
  return (
    <div className="stack">
      <div className="head">
        <div><h1>Components</h1><p className="sub">The building blocks of every product. Open one to edit its fields, defaults and options.</p></div>
        <Filter target="comp-list" id="comp-filter" placeholder="Search components" />
      </div>
      <div className="card flat"><div className="bd tbl-wrap">
        <table id="comp-list">
          <thead><tr><th>Component</th><th>ID</th><th className="num">Fields</th><th className="num">Products</th><th>Options</th><th>Description</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.component_id} data-filter={`${c.component_id} ${c.display_name} ${c.description || ''}`}>
                <td><Link href={`/components/${c.component_id}`}><b>{c.display_name}</b></Link></td>
                <td className="mono small">{c.component_id}</td>
                <td className="num">{c.fields}</td>
                <td className="num">{c.products || <span className="muted">0</span>}</td>
                <td><div className="pill-list">{c.show_as_tool && <span className="chip">Tool</span>}{c.repeatable && <span className="chip">Repeatable</span>}</div></td>
                <td className="small muted">{c.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
      <NewComponent />
    </div>
  );
}
