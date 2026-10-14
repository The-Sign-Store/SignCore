import Link from 'next/link';
import { withDb } from '@/lib/db';
import Filter from '@/components/Filter';
import Svg from '@/components/Svg';

export const dynamic = 'force-dynamic';

export default async function DrawingsPage() {
  const rows = await withDb((db) => db.q(`SELECT d.*, coalesce(string_agg(x.component_id, ', ' ORDER BY x.position), '') AS comps
    FROM detail_drawings d LEFT JOIN detail_drawing_components x USING (drawing_id) GROUP BY d.drawing_id ORDER BY d.category, d.sort_order`));
  const cats = [...new Set(rows.map((r) => r.category || 'Other'))];
  return (
    <div className="stack">
      <div className="head">
        <div><h1>Detail Drawings</h1><p className="sub">Small construction drawings SignCore adds to a proof page when its specs match.</p></div>
        <div className="row"><Filter target="draw-list" id="draw-filter" placeholder="Search drawings" /><Link className="btn primary" href="/drawings/new">+ New drawing</Link></div>
      </div>
      <div id="draw-list" className="stack">
        {cats.map((cat) => (
          <section key={cat} data-group className="stack" style={{ gap: 8 }}>
            <h2>{cat}</h2>
            <div className="thumbs">{rows.filter((r) => (r.category || 'Other') === cat).map((d) => (
              <Link key={d.drawing_id} href={`/drawings/${d.drawing_id}`} className="thumb" data-filter={`${d.drawing_id} ${d.title} ${d.comps} ${d.match_rule || ''}`}>
                <Svg markup={d.svg_markup} title={d.title || d.drawing_id} />
                <b className="small">{d.title || d.drawing_id}</b>
                <span className="mono small muted">{d.drawing_id}</span>
                {!d.active && <span className="chip off" style={{ alignSelf: 'start' }}>Inactive</span>}
              </Link>))}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
