'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { withTx, logChange } from '@/lib/db';
import { currentActor } from '@/lib/auth';
import { clean, ok, fail, type Result } from '@/lib/specs';

const pgCode = (e: unknown) => (e as { code?: string })?.code;

export async function saveDrawing(_: Result | null, fd: FormData): Promise<Result> {
  const original = clean(fd.get('original_id'));
  const id = (clean(fd.get('drawing_id')) || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (!/^[A-Z0-9_]+$/.test(id)) return fail('Drawing ID uses capitals, numbers and underscores, e.g. MNT_TAPE.');
  const svg = clean(fd.get('svg_markup'));
  if (svg && /<svg[\s>]/i.test(svg)) return fail('Leave out the <svg> wrapper. SignCore adds it and draws on a 100 x 100 grid.');
  if (svg && /<script|\son\w+=/i.test(svg)) return fail('Drawings cannot contain scripts or event handlers.');
  const order = clean(fd.get('sort_order'));
  if (order && !/^-?\d+$/.test(order)) return fail('Order must be a whole number.');
  const comps = fd.getAll('components').map(String);
  const vals = [id, clean(fd.get('category')), clean(fd.get('title')), clean(fd.get('match_rule')), order ? Number(order) : null, fd.get('active') === 'on', svg, clean(fd.get('notes'))];
  const actor = await currentActor();
  try {
    await withTx(async (db) => {
      const before = original ? await db.one('SELECT * FROM detail_drawings WHERE drawing_id=$1', [original]) : null;
      if (original) await db.q(`UPDATE detail_drawings SET drawing_id=$1, category=$2, title=$3, match_rule=$4, sort_order=$5, active=$6, svg_markup=$7, notes=$8, updated_at=now() WHERE drawing_id=$9`, [...vals, original]);
      else await db.q(`INSERT INTO detail_drawings (drawing_id, category, title, match_rule, sort_order, active, svg_markup, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, vals);
      await db.q('DELETE FROM detail_drawing_components WHERE drawing_id=$1', [id]);
      for (const [i, c] of comps.entries()) await db.q('INSERT INTO detail_drawing_components (drawing_id, component_id, position) VALUES ($1,$2,$3)', [id, c, i]);
      const after = await db.one('SELECT * FROM detail_drawings WHERE drawing_id=$1', [id]);
      await logChange(db, actor, 'drawing', id, original ? 'update' : 'create', original ? `Updated drawing ${id}` : `Added drawing ${id}`, before, { ...after, components: comps });
    });
  } catch (e) { if (pgCode(e) === '23505') return fail(`Drawing ${id} already exists.`); throw e; }
  revalidatePath('/drawings', 'layout');
  if (!original || original !== id) redirect(`/drawings/${id}`);
  return ok('Drawing saved.');
}

export async function deleteDrawing(_: Result | null, fd: FormData): Promise<Result> {
  const id = String(fd.get('drawing_id'));
  const actor = await currentActor();
  await withTx(async (db) => {
    const before = await db.one('DELETE FROM detail_drawings WHERE drawing_id=$1 RETURNING *', [id]);
    if (before) await logChange(db, actor, 'drawing', id, 'delete', `Deleted drawing ${id}`, before, null);
  });
  revalidatePath('/drawings', 'layout');
  redirect('/drawings');
}
