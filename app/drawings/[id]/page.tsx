import Link from 'next/link';
import { notFound } from 'next/navigation';
import { withDb } from '@/lib/db';
import DrawingForm, { DeleteDrawing } from './DrawingForm';

export const dynamic = 'force-dynamic';

export default async function DrawingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === 'new';
  const data = await withDb(async (db) => {
    const d = isNew ? null : await db.one('SELECT * FROM detail_drawings WHERE drawing_id=$1', [id.toUpperCase()]);
    if (!isNew && !d) return null;
    return {
      d,
      comps: d ? (await db.q('SELECT component_id FROM detail_drawing_components WHERE drawing_id=$1 ORDER BY position', [d.drawing_id])).map((r) => r.component_id) : [],
      components: await db.q('SELECT component_id, display_name FROM components ORDER BY display_name'),
      categories: (await db.q('SELECT DISTINCT category FROM detail_drawings WHERE category IS NOT NULL ORDER BY 1')).map((r) => r.category),
    };
  });
  if (!data) notFound();
  return (
    <div className="stack">
      <div className="head"><div>
        <div className="crumbs"><Link href="/drawings">Detail Drawings</Link> /</div>
        <h1>{isNew ? 'New drawing' : data.d!.title || data.d!.drawing_id}</h1>
      </div></div>
      <DrawingForm d={data.d} comps={data.comps} components={data.components} categories={data.categories} />
      {!isNew && <div className="card"><div className="bd"><DeleteDrawing id={data.d!.drawing_id} /></div></div>}
    </div>
  );
}
