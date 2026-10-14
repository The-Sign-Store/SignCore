import Link from 'next/link';
import { withDb } from '@/lib/db';
import Filter from '@/components/Filter';
import NewProduct from './NewProduct';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const rows = await withDb((db) => db.q(`
    SELECT p.product_name,
      coalesce(json_agg(json_build_object('c', c.display_name, 'i', pc.include) ORDER BY pc.sort_order) FILTER (WHERE pc.id IS NOT NULL), '[]') AS sections,
      (SELECT count(*) FROM product_fields f WHERE f.product_name=p.product_name)::int AS legacy
    FROM products p LEFT JOIN product_components pc USING (product_name) LEFT JOIN components c USING (component_id)
    GROUP BY p.product_name, p.sort_order ORDER BY p.product_name`));
  return (
    <div className="stack">
      <div className="head">
        <div><h1>Products</h1><p className="sub">What a salesperson picks in SignCore. Each product is a list of component sections, in proof order.</p></div>
        <Filter target="prod-list" id="prod-filter" placeholder="Search products" />
      </div>
      <div className="card flat"><div className="bd tbl-wrap">
        <table id="prod-list">
          <thead><tr><th>Product</th><th className="num">Sections</th><th>Components, in order</th></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.product_name} data-filter={`${p.product_name} ${p.sections.map((s: any) => s.c).join(' ')}`}>
              <td><Link href={`/products/${encodeURIComponent(p.product_name)}`}><b>{p.product_name}</b></Link></td>
              <td className="num">{p.sections.length || <span className="chip warn">Legacy</span>}</td>
              <td><div className="pill-list">{p.sections.length ? p.sections.map((s: any, i: number) => (
                <span key={i} className={`chip${s.i === 'Required' ? '' : ' warn'}`} title={s.i}>{s.c}{s.i !== 'Required' ? ' (optional)' : ''}</span>))
                : <span className="small muted">Uses {p.legacy} legacy fields from Product_Schema. Add sections to switch it to components.</span>}</div></td>
            </tr>))}
          </tbody>
        </table>
      </div></div>
      <NewProduct />
    </div>
  );
}
