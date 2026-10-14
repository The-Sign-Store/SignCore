'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { withTx, logChange, type Db } from '@/lib/db';
import { currentActor } from '@/lib/auth';
import { clean, ok, fail, type Result, overrideVariables, INCLUDE } from '@/lib/specs';

const pgCode = (e: unknown) => (e as { code?: string })?.code;
const path = (name: string) => `/products/${encodeURIComponent(name)}`;

async function renumber(db: Db, product: string) {
  await db.q(`UPDATE product_components p SET sort_order = s.n FROM (
      SELECT id, row_number() OVER (ORDER BY sort_order, id) n FROM product_components WHERE product_name=$1) s WHERE p.id=s.id`, [product]);
  await db.q('UPDATE products SET updated_at=now() WHERE product_name=$1', [product]);
}

export async function createProduct(_: Result | null, fd: FormData): Promise<Result> {
  const name = clean(fd.get('product_name'));
  if (!name) return fail('Enter a product name.');
  const actor = await currentActor();
  try {
    await withTx(async (db) => {
      await db.q('INSERT INTO products (product_name, sort_order) VALUES ($1,(SELECT coalesce(max(sort_order),0)+10 FROM products))', [name]);
      await logChange(db, actor, 'product', name, 'create', `Created product ${name}`);
    });
  } catch (e) { if (pgCode(e) === '23505') return fail(`There is already a product called ${name}.`); throw e; }
  revalidatePath('/products');
  redirect(path(name));
}

export async function renameProduct(_: Result | null, fd: FormData): Promise<Result> {
  const from = String(fd.get('original_name')); const to = clean(fd.get('product_name'));
  if (!to) return fail('The product name cannot be empty.');
  if (to === from) return ok('No change.');
  const actor = await currentActor();
  try {
    await withTx(async (db) => {
      await db.q('UPDATE products SET product_name=$2, updated_at=now() WHERE product_name=$1', [from, to]);
      await logChange(db, actor, 'product', to, 'rename', `Renamed product ${from} to ${to}`, { product_name: from }, { product_name: to });
    });
  } catch (e) { if (pgCode(e) === '23505') return fail(`There is already a product called ${to}.`); throw e; }
  revalidatePath('/products', 'layout');
  redirect(path(to));
}

export async function deleteProduct(_: Result | null, fd: FormData): Promise<Result> {
  const name = String(fd.get('product_name'));
  const actor = await currentActor();
  await withTx(async (db) => {
    const sections = await db.q('SELECT * FROM product_components WHERE product_name=$1 ORDER BY sort_order', [name]);
    const legacy = await db.q('SELECT * FROM product_fields WHERE product_name=$1 ORDER BY sort_order', [name]);
    await db.q('DELETE FROM products WHERE product_name=$1', [name]);
    await logChange(db, actor, 'product', name, 'delete', `Deleted product ${name} (${sections.length} sections)`, { sections, legacy }, null);
  });
  revalidatePath('/products', 'layout');
  redirect('/products');
}

export async function saveSection(_: Result | null, fd: FormData): Promise<Result> {
  const id = clean(fd.get('id'));
  const product = String(fd.get('product_name'));
  const componentId = clean(fd.get('component_id'));
  if (!componentId) return fail('Choose a component.');
  const include = String(fd.get('include') || 'Required');
  if (!(INCLUDE as readonly string[]).includes(include)) return fail('Choose Required, Optional-On or Optional-Off.');
  const pg = clean(fd.get('page_group'));
  if (pg && !/^\d+$/.test(pg)) return fail('Page group must be a whole number, or blank.');
  const overrides = clean(fd.get('default_overrides'));
  if (overrides && overrides.split(';').some((p) => p.trim() && !p.includes('='))) return fail('Write defaults as VAR=value; VAR=value.');
  const vals = [componentId, clean(fd.get('section_title')), include, fd.get('repeatable') === 'on', overrides, pg ? Number(pg) : null];
  const actor = await currentActor();
  const warnings: string[] = [];
  await withTx(async (db) => {
    const vars = new Set((await db.q('SELECT variable FROM component_fields WHERE component_id=$1', [componentId])).map((r) => r.variable));
    for (const v of overrideVariables(overrides)) if (!vars.has(v)) warnings.push(`${v} is not a field on ${componentId}, so SignCore will ignore that default.`);
    if (id) {
      const before = await db.one('SELECT * FROM product_components WHERE id=$1', [id]);
      const after = await db.one(`UPDATE product_components SET component_id=$2, section_title=$3, include=$4, repeatable=$5, default_overrides=$6, page_group=$7 WHERE id=$1 RETURNING *`, [id, ...vals]);
      await logChange(db, actor, 'assembly', product, 'update', `Updated section ${after.section_title || componentId} in ${product}`, before, after);
    } else {
      const after = await db.one(`INSERT INTO product_components (product_name, sort_order, component_id, section_title, include, repeatable, default_overrides, page_group)
        VALUES ($1,(SELECT coalesce(max(sort_order),0)+1 FROM product_components WHERE product_name=$1),$2,$3,$4,$5,$6,$7) RETURNING *`, [product, ...vals]);
      await logChange(db, actor, 'assembly', product, 'create', `Added ${componentId} to ${product}`, null, after);
    }
    await renumber(db, product);
  });
  revalidatePath(path(product)); revalidatePath('/products');
  return ok(id ? 'Section saved.' : 'Section added.', warnings);
}

export async function moveSection(_: Result | null, fd: FormData): Promise<Result> {
  const id = Number(fd.get('id')); const product = String(fd.get('product_name')); const dir = fd.get('dir') === 'up' ? -1 : 1;
  const actor = await currentActor();
  await withTx(async (db) => {
    await renumber(db, product);
    const s = await db.one('SELECT id, sort_order, component_id FROM product_components WHERE id=$1', [id]);
    const o = s && await db.one('SELECT id, sort_order FROM product_components WHERE product_name=$1 AND sort_order=$2', [product, s.sort_order + dir]);
    if (!s || !o) return;
    await db.q('UPDATE product_components SET sort_order = CASE id WHEN $1 THEN $3::int WHEN $2 THEN $4::int END WHERE id IN ($1,$2)', [s.id, o.id, o.sort_order, s.sort_order]);
    await logChange(db, actor, 'assembly', product, 'reorder', `Moved ${s.component_id} ${dir < 0 ? 'up' : 'down'} in ${product}`);
  });
  revalidatePath(path(product));
  return ok('Moved.');
}

export async function deleteSection(_: Result | null, fd: FormData): Promise<Result> {
  const id = Number(fd.get('id')); const product = String(fd.get('product_name'));
  const actor = await currentActor();
  await withTx(async (db) => {
    const before = await db.one('DELETE FROM product_components WHERE id=$1 RETURNING *', [id]);
    if (before) await logChange(db, actor, 'assembly', product, 'delete', `Removed ${before.section_title || before.component_id} from ${product}`, before, null);
    await renumber(db, product);
  });
  revalidatePath(path(product)); revalidatePath('/products');
  return ok('Section removed.');
}
