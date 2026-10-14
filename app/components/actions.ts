'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { withTx, logChange, type Db } from '@/lib/db';
import { currentActor } from '@/lib/auth';
import {
  clean, linesToOptions, ok, fail, type Result, showIfVariables, calcVariables,
  renameInShowIf, renameInOverrides, renameInCalc,
} from '@/lib/specs';

const pgCode = (e: unknown) => (e as { code?: string })?.code;
const toId = (s: string) => s.trim().toUpperCase().replace(/[\s-]+/g, '_').replace(/[^A-Z0-9_]/g, '');

async function renumber(db: Db, componentId: string) {
  await db.q(`UPDATE component_fields f SET sort_order = s.n * 10 FROM (
      SELECT id, row_number() OVER (ORDER BY sort_order, id) n FROM component_fields WHERE component_id = $1) s
    WHERE f.id = s.id`, [componentId]);
}
async function touch(db: Db, componentId: string) {
  await db.q('UPDATE components SET updated_at = now() WHERE component_id = $1', [componentId]);
}

// ---------- components ----------
export async function createComponent(_: Result | null, fd: FormData): Promise<Result> {
  const id = toId(String(fd.get('component_id') || ''));
  const name = clean(fd.get('display_name'));
  if (!id) return fail('Enter a component ID, e.g. WALL_PANEL.');
  if (!name) return fail('Enter a display name.');
  const actor = await currentActor();
  try {
    await withTx(async (db) => {
      await db.q(`INSERT INTO components (component_id, display_name, show_as_tool, repeatable, description, sort_order)
                  VALUES ($1,$2,$3,$4,$5,(SELECT coalesce(max(sort_order),0)+10 FROM components))`,
        [id, name, fd.get('show_as_tool') === 'on', fd.get('repeatable') === 'on', clean(fd.get('description'))]);
      await logChange(db, actor, 'component', id, 'create', `Created component ${id}`);
    });
  } catch (e) {
    if (pgCode(e) === '23505') return fail(`A component with ID ${id} already exists.`);
    throw e;
  }
  revalidatePath('/components');
  redirect(`/components/${id}`);
}

export async function updateComponent(_: Result | null, fd: FormData): Promise<Result> {
  const oldId = String(fd.get('original_id'));
  const newId = toId(String(fd.get('component_id') || ''));
  const name = clean(fd.get('display_name'));
  if (!newId) return fail('The component ID cannot be empty.');
  if (!name) return fail('The display name cannot be empty.');
  const actor = await currentActor();
  const warnings: string[] = [];
  try {
    await withTx(async (db) => {
      const before = await db.one('SELECT * FROM components WHERE component_id = $1', [oldId]);
      if (!before) throw new Error('missing');
      await db.q(`UPDATE components SET component_id=$2, display_name=$3, show_as_tool=$4, repeatable=$5, description=$6, updated_at=now()
                  WHERE component_id=$1`, [oldId, newId, name, fd.get('show_as_tool') === 'on', fd.get('repeatable') === 'on', clean(fd.get('description'))]);
      if (newId !== oldId) {
        const refs = await db.q(`SELECT 'rule ' || rule_id AS ref FROM design_guide_rules WHERE match_rule ~ $1
                                 UNION ALL SELECT 'drawing ' || drawing_id FROM detail_drawings WHERE match_rule ~ $1`, [`\\m${oldId}\\M`]);
        if (refs.length) warnings.push(`${oldId} is still named in the Match Rule of ${refs.map((r) => r.ref).join(', ')}. Update those by hand.`);
      }
      const after = await db.one('SELECT * FROM components WHERE component_id = $1', [newId]);
      await logChange(db, actor, 'component', newId, newId !== oldId ? 'rename' : 'update',
        newId !== oldId ? `Renamed component ${oldId} to ${newId}` : `Updated component ${newId}`, before, after);
    });
  } catch (e) {
    if (pgCode(e) === '23505') return fail(`A component with ID ${newId} already exists.`);
    if ((e as Error).message === 'missing') return fail('This component no longer exists. Reload the page.');
    throw e;
  }
  revalidatePath('/components', 'layout');
  if (newId !== oldId) redirect(`/components/${newId}`);
  return ok('Component saved.', warnings);
}

export async function deleteComponent(_: Result | null, fd: FormData): Promise<Result> {
  const id = String(fd.get('component_id'));
  const actor = await currentActor();
  const res = await withTx(async (db) => {
    const used = await db.q('SELECT DISTINCT product_name FROM product_components WHERE component_id = $1 ORDER BY 1', [id]);
    if (used.length) return fail(`Remove ${id} from these products first: ${used.map((u) => u.product_name).join(', ')}.`);
    const before = await db.one('SELECT * FROM components WHERE component_id = $1', [id]);
    const fields = await db.q('SELECT * FROM component_fields WHERE component_id = $1 ORDER BY sort_order', [id]);
    await db.q('DELETE FROM components WHERE component_id = $1', [id]);
    await logChange(db, actor, 'component', id, 'delete', `Deleted component ${id} and its ${fields.length} fields`, { ...before, fields }, null);
    return null;
  });
  if (res) return res;
  revalidatePath('/components', 'layout');
  redirect('/components');
}

// ---------- fields ----------
export async function saveField(_: Result | null, fd: FormData): Promise<Result> {
  const fieldId = clean(fd.get('id'));
  const componentId = String(fd.get('component_id'));
  const variable = (clean(fd.get('variable')) || '').toUpperCase().replace(/\s+/g, ' ');
  if (!variable) return fail('Enter a variable name, e.g. RETAINER SIZE.');
  if (/[=&|;{}]/.test(variable)) return fail('Variable names cannot contain = & | ; { or }. SignCore uses those characters in rules.');
  const type = clean(fd.get('field_type')) || 'text';
  const values = {
    zone: clean(fd.get('zone')),
    label: clean(fd.get('label')),
    field_type: type,
    default_value: clean(fd.get('default_value')),
    options: linesToOptions(String(fd.get('options') || '')),
    show_if: clean(fd.get('show_if')),
    required: fd.get('required') === 'on',
    signos_ref: clean(fd.get('signos_ref')),
    notes: clean(fd.get('notes')),
    hide_values: linesToOptions(String(fd.get('hide_values') || '')),
  };
  const actor = await currentActor();
  const warnings: string[] = [];
  try {
    await withTx(async (db) => {
      const vars = new Set((await db.q('SELECT variable FROM component_fields WHERE component_id=$1', [componentId])).map((r) => r.variable));
      if (fieldId) {
        const before = await db.one('SELECT * FROM component_fields WHERE id=$1', [fieldId]);
        if (!before) throw new Error('missing');
        await db.q(`UPDATE component_fields SET variable=$2, zone=$3, label=$4, field_type=$5, default_value=$6, options=$7, show_if=$8,
                    required=$9, signos_ref=$10, notes=$11, hide_values=$12 WHERE id=$1`,
          [fieldId, variable, values.zone, values.label, values.field_type, values.default_value, values.options, values.show_if,
           values.required, values.signos_ref, values.notes, values.hide_values]);
        if (before.variable !== variable) {
          vars.delete(before.variable); vars.add(variable);
          const n = await propagateRename(db, componentId, before.variable, variable, actor);
          if (n) warnings.push(`Renamed ${before.variable} to ${variable} in ${n} Show If, calc or product default setting${n === 1 ? '' : 's'}.`);
          const global = await db.q(`SELECT 'rule ' || rule_id AS ref FROM design_guide_rules WHERE position(upper($1) in upper(coalesce(match_rule,'') || ' ' || standard)) > 0
                                     UNION ALL SELECT 'drawing ' || drawing_id FROM detail_drawings WHERE position(upper($1) in upper(coalesce(match_rule,'') || ' ' || coalesce(svg_markup,''))) > 0`, [before.variable]);
          if (global.length) warnings.push(`${before.variable} also appears in ${global.map((g) => g.ref).join(', ')}. Check those if they meant this field.`);
        }
        const after = await db.one('SELECT * FROM component_fields WHERE id=$1', [fieldId]);
        await logChange(db, actor, 'field', `${componentId}.${variable}`, 'update', `Updated field ${variable} on ${componentId}`, before, after);
      } else {
        const r = await db.one(`INSERT INTO component_fields (component_id, variable, sort_order, zone, label, field_type, default_value, options, show_if, required, signos_ref, notes, hide_values)
                    VALUES ($1,$2,(SELECT coalesce(max(sort_order),0)+10 FROM component_fields WHERE component_id=$1),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
          [componentId, variable, values.zone, values.label, values.field_type, values.default_value, values.options, values.show_if,
           values.required, values.signos_ref, values.notes, values.hide_values]);
        vars.add(variable);
        await logChange(db, actor, 'field', `${componentId}.${variable}`, 'create', `Added field ${variable} to ${componentId}`, null, r);
      }
      for (const v of showIfVariables(values.show_if)) if (!vars.has(v)) warnings.push(`Show If uses ${v}, which is not a field on ${componentId}.`);
      if (type === 'calc') for (const v of calcVariables(values.options)) if (!vars.has(v)) warnings.push(`The calculation uses {${v}}, which is not a field on ${componentId}.`);
      if (values.default_value && type === 'select' && values.options && !values.options.split('|').includes(values.default_value))
        warnings.push(`The default "${values.default_value}" is not one of the options.`);
      await touch(db, componentId);
    });
  } catch (e) {
    if (pgCode(e) === '23505') return fail(`${componentId} already has a field called ${variable}.`);
    if ((e as Error).message === 'missing') return fail('This field no longer exists. Reload the page.');
    throw e;
  }
  revalidatePath(`/components/${componentId}`);
  return ok(fieldId ? `Saved ${variable}.` : `Added ${variable}.`, warnings);
}

async function propagateRename(db: Db, componentId: string, from: string, to: string, actor: string) {
  let n = 0;
  for (const f of await db.q('SELECT id, show_if, options, field_type FROM component_fields WHERE component_id=$1', [componentId])) {
    const showIf = renameInShowIf(f.show_if, from, to);
    const options = f.field_type === 'calc' ? renameInCalc(f.options, from, to) : f.options;
    if (showIf !== f.show_if || options !== f.options) {
      await db.q('UPDATE component_fields SET show_if=$2, options=$3 WHERE id=$1', [f.id, showIf, options]); n++;
    }
  }
  for (const p of await db.q('SELECT id, product_name, default_overrides FROM product_components WHERE component_id=$1 AND default_overrides IS NOT NULL', [componentId])) {
    const o = renameInOverrides(p.default_overrides, from, to);
    if (o !== p.default_overrides) {
      await db.q('UPDATE product_components SET default_overrides=$2 WHERE id=$1', [p.id, o]); n++;
      await logChange(db, actor, 'assembly', p.product_name, 'update', `Renamed ${from} to ${to} in ${p.product_name} defaults`, { default_overrides: p.default_overrides }, { default_overrides: o });
    }
  }
  return n;
}

export async function moveField(_: Result | null, fd: FormData): Promise<Result> {
  const id = Number(fd.get('id')); const dir = fd.get('dir') === 'up' ? -1 : 1;
  const componentId = String(fd.get('component_id'));
  const actor = await currentActor();
  await withTx(async (db) => {
    await renumber(db, componentId);
    const f = await db.one('SELECT id, variable, zone, sort_order FROM component_fields WHERE id=$1', [id]);
    if (!f) return;
    const other = await db.one(
      `SELECT id, sort_order FROM component_fields WHERE component_id=$1 AND zone IS NOT DISTINCT FROM $2 AND sort_order ${dir < 0 ? '<' : '>'} $3
       ORDER BY sort_order ${dir < 0 ? 'DESC' : 'ASC'} LIMIT 1`, [componentId, f.zone, f.sort_order]);
    if (!other) return;
    await db.q('UPDATE component_fields SET sort_order = CASE id WHEN $1 THEN $3::int WHEN $2 THEN $4::int END WHERE id IN ($1,$2)', [f.id, other.id, other.sort_order, f.sort_order]);
    await logChange(db, actor, 'field', `${componentId}.${f.variable}`, 'reorder', `Moved ${f.variable} ${dir < 0 ? 'up' : 'down'} on ${componentId}`);
    await touch(db, componentId);
  });
  revalidatePath(`/components/${componentId}`);
  return ok('Moved.');
}

export async function deleteField(_: Result | null, fd: FormData): Promise<Result> {
  const id = Number(fd.get('id')); const componentId = String(fd.get('component_id'));
  const actor = await currentActor();
  const warnings: string[] = [];
  let variable = '';
  await withTx(async (db) => {
    const before = await db.one('DELETE FROM component_fields WHERE id=$1 RETURNING *', [id]);
    if (!before) return;
    variable = before.variable;
    const deps = await db.q(`SELECT variable FROM component_fields WHERE component_id=$1 AND (show_if ILIKE '%'||$2||'%' OR (field_type='calc' AND options LIKE '%{'||$2||'}%'))`, [componentId, before.variable]);
    if (deps.length) warnings.push(`These fields still refer to ${before.variable}: ${deps.map((d) => d.variable).join(', ')}.`);
    await logChange(db, actor, 'field', `${componentId}.${before.variable}`, 'delete', `Deleted field ${before.variable} from ${componentId}`, before, null);
    await touch(db, componentId);
  });
  revalidatePath(`/components/${componentId}`);
  return ok(variable ? `Deleted ${variable}.` : 'Already deleted.', warnings);
}
