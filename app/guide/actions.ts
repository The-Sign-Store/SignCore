'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { withTx, logChange } from '@/lib/db';
import { currentActor } from '@/lib/auth';
import { clean, ok, fail, type Result, BASIS } from '@/lib/specs';

const pgCode = (e: unknown) => (e as { code?: string })?.code;

export async function saveRule(_: Result | null, fd: FormData): Promise<Result> {
  const original = clean(fd.get('original_id'));
  const ruleId = (clean(fd.get('rule_id')) || '').toUpperCase();
  if (!/^[A-Z]{1,3}\d{1,3}$/.test(ruleId)) return fail('Rule ID is a letter code plus a number, e.g. K07.');
  let section = clean(fd.get('section_name'));
  const newSection = clean(fd.get('new_section'));
  if (section === '__new__') section = newSection?.toUpperCase() || null;
  if (!section) return fail('Choose a section, or type a new one.');
  const standard = clean(fd.get('standard'));
  if (!standard) return fail('The standard (the rule itself) cannot be empty.');
  const basis = String(fd.get('basis') || 'House');
  if (!(BASIS as readonly string[]).includes(basis)) return fail('Basis must be House, SignOS or Industry.');
  const order = Number(fd.get('sort_order'));
  if (!Number.isInteger(order)) return fail('Order must be a whole number.');
  const comps = fd.getAll('components').map(String);
  const actor = await currentActor();
  try {
    await withTx(async (db) => {
      await db.q(`INSERT INTO design_guide_sections (section_name, sort_order) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [section, order]);
      const before = original ? await db.one('SELECT * FROM design_guide_rules WHERE rule_id=$1', [original]) : null;
      const vals = [ruleId, section, clean(fd.get('match_rule')), standard, clean(fd.get('why')), clean(fd.get('coreldraw_how_to')), basis, order, fd.get('active') === 'on'];
      if (original) {
        await db.q(`UPDATE design_guide_rules SET rule_id=$1, section_name=$2, match_rule=$3, standard=$4, why=$5, coreldraw_how_to=$6, basis=$7, sort_order=$8, active=$9, updated_at=now() WHERE rule_id=$10`, [...vals, original]);
      } else {
        await db.q(`INSERT INTO design_guide_rules (rule_id, section_name, match_rule, standard, why, coreldraw_how_to, basis, sort_order, active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, vals);
      }
      const beforeComps = (await db.q('SELECT component_id FROM design_guide_rule_components WHERE rule_id=$1 ORDER BY position', [ruleId])).map((r) => r.component_id);
      await db.q('DELETE FROM design_guide_rule_components WHERE rule_id=$1', [ruleId]);
      for (const [i, c] of comps.entries()) await db.q('INSERT INTO design_guide_rule_components (rule_id, component_id, position) VALUES ($1,$2,$3)', [ruleId, c, i]);
      await db.q('DELETE FROM design_guide_sections s WHERE NOT EXISTS (SELECT 1 FROM design_guide_rules r WHERE r.section_name=s.section_name)');
      const after = await db.one('SELECT * FROM design_guide_rules WHERE rule_id=$1', [ruleId]);
      await logChange(db, actor, 'rule', ruleId, original ? (original !== ruleId ? 'rename' : 'update') : 'create',
        original ? `Updated rule ${ruleId}` : `Added rule ${ruleId}`, before && { ...before, components: beforeComps }, { ...after, components: comps });
    });
  } catch (e) { if (pgCode(e) === '23505') return fail(`Rule ${ruleId} already exists. Pick another ID.`); throw e; }
  revalidatePath('/guide', 'layout');
  if (!original || original !== ruleId) redirect(`/guide/${ruleId}`);
  return ok('Rule saved.');
}

export async function deleteRule(_: Result | null, fd: FormData): Promise<Result> {
  const id = String(fd.get('rule_id'));
  const actor = await currentActor();
  await withTx(async (db) => {
    const before = await db.one('DELETE FROM design_guide_rules WHERE rule_id=$1 RETURNING *', [id]);
    await db.q('DELETE FROM design_guide_sections s WHERE NOT EXISTS (SELECT 1 FROM design_guide_rules r WHERE r.section_name=s.section_name)');
    if (before) await logChange(db, actor, 'rule', id, 'delete', `Deleted rule ${id}`, before, null);
  });
  revalidatePath('/guide', 'layout');
  redirect('/guide');
}
