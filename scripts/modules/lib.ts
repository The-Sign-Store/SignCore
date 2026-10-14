// SignCore modules: read and write the modules/ folder, convert to and from database rows, validate.
import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import Ajv from 'ajv';

export const ROOT = process.cwd(); // npm scripts run from the repo root
export const MODULES = path.join(ROOT, 'modules');

// ---------- types (mirror schemas/*.schema.json) ----------
export type Scalar = string | number;
export type Field = {
  variable: string; label?: string; column?: number | string; type: string; default?: Scalar; options?: Scalar[];
  show_if?: string; required?: boolean; hide_values?: Scalar[]; signos?: string; notes?: string;
};
export type Route = { department: string; when?: string; work?: string };
export type Material = { item: string; signos?: string; when?: string; qty?: Scalar; unit?: string; department?: string; notes?: string };
export type Component = {
  schema: 'signcore.component/v1'; id: string; name: string; version: string; order?: number; description?: string;
  show_as_tool?: boolean; repeatable?: boolean; fields: Field[]; routing?: Route[]; materials?: Material[];
};
export type Section = { component: string; title?: string; include?: 'required' | 'optional-on' | 'optional-off'; repeatable?: boolean; page_group?: number; defaults?: Record<string, Scalar> };
export type LegacyField = { variable: string; column?: number | string; default?: Scalar; options?: string };
export type Product = { schema: 'signcore.product/v1'; name: string; version: string; order?: number; sections: Section[]; legacy_fields?: LegacyField[] };
export type AppliesTo = { components?: string[]; when?: string };
export type Rule = { schema: 'signcore.rule/v1'; id: string; version: string; section: string; order: number; basis: 'House' | 'SignOS' | 'Industry'; active?: boolean; applies_to?: AppliesTo; standard: string; why?: string; how_to?: string };
export type Drawing = { schema: 'signcore.drawing/v1'; id: string; version: string; title: string; category?: string; order?: number; active?: boolean; applies_to?: AppliesTo; notes?: string; svg: string };
export type Department = { key: string; name: string; notes?: string };
export type ModuleSet = { components: Component[]; products: Product[]; rules: Rule[]; drawings: Drawing[]; departments: Department[] };

// ---------- small helpers ----------
const str = (v: unknown) => (v === null || v === undefined ? undefined : String(v));
const nonEmpty = <T>(a: T[] | undefined) => (a && a.length ? a : undefined);
/** Drop undefined keys so YAML output stays tidy and comparisons are stable. */
export function compact<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0))) as T;
}
export const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const zoneToColumn = (z: string | null) => (z == null ? undefined : /^COLUMN (\d+)$/.test(z) ? Number(z.slice(7)) : z);
const columnToZone = (c: number | string | undefined) => (c === undefined ? null : typeof c === 'number' || /^\d+$/.test(String(c)) ? `COLUMN ${c}` : String(c));
const splitPipes = (s: string | null) => (s ? s.split('|') : undefined);
const joinPipes = (a: Scalar[] | undefined) => (a && a.length ? a.map(String).join('|') : null);
export function parseOverrides(s: string | null): Record<string, string> | undefined {
  if (!s) return undefined;
  const out: Record<string, string> = {};
  for (const part of s.split(';')) { const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim(); }
  return Object.keys(out).length ? out : undefined;
}
export const joinOverrides = (d: Record<string, Scalar> | undefined) => (d && Object.keys(d).length ? Object.entries(d).map(([k, v]) => `${k}=${v}`).join('; ') : null);
const INCLUDE_TO_FILE: Record<string, Section['include']> = { 'Required': 'required', 'Optional-On': 'optional-on', 'Optional-Off': 'optional-off' };
const INCLUDE_TO_DB = Object.fromEntries(Object.entries(INCLUDE_TO_FILE).map(([a, b]) => [b, a]));
export const wrapSvg = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" font-family="Arial, sans-serif">\n${inner}\n</svg>\n`;
export function unwrapSvg(file: string) {
  const m = file.match(/^\s*<svg[^>]*>\n?([\s\S]*?)\n?<\/svg>\s*$/);
  return m ? m[1] : file.trim();
}

// ---------- database rows -> modules ----------
type Q = (sql: string, params?: unknown[]) => Promise<any[]>;
export async function fromDatabase(q: Q): Promise<ModuleSet> {
  const comps = await q('SELECT * FROM components ORDER BY sort_order, component_id');
  const fields = await q('SELECT * FROM component_fields ORDER BY component_id, sort_order, id');
  const components: Component[] = comps.map((c) => compact({
    schema: 'signcore.component/v1' as const, id: c.component_id, name: c.display_name, version: c.version ?? '1.0.0', order: c.sort_order,
    description: str(c.description), show_as_tool: c.show_as_tool, repeatable: c.repeatable,
    fields: fields.filter((f) => f.component_id === c.component_id).map((f): Field => compact({
      variable: f.variable, label: f.label && f.label !== f.variable ? f.label : undefined, column: zoneToColumn(f.zone), type: f.field_type,
      default: str(f.default_value), options: splitPipes(f.options), show_if: str(f.show_if), required: f.required || undefined,
      hide_values: splitPipes(f.hide_values), signos: str(f.signos_ref), notes: str(f.notes),
    })),
    routing: nonEmpty(c.routing as Route[]), materials: nonEmpty(c.materials as Material[]),
  }));
  const prods = await q('SELECT * FROM products ORDER BY sort_order, product_name');
  const sections = await q('SELECT * FROM product_components ORDER BY product_name, sort_order, id');
  const legacy = await q('SELECT * FROM product_fields ORDER BY product_name, sort_order, id');
  const products: Product[] = prods.map((p) => compact({
    schema: 'signcore.product/v1' as const, name: p.product_name, version: p.version ?? '1.0.0', order: p.sort_order,
    sections: sections.filter((s) => s.product_name === p.product_name).map((s): Section => compact({
      component: s.component_id, title: str(s.section_title), include: INCLUDE_TO_FILE[s.include], repeatable: s.repeatable,
      page_group: s.page_group ?? undefined, defaults: parseOverrides(s.default_overrides),
    })),
    legacy_fields: nonEmpty(legacy.filter((f) => f.product_name === p.product_name).map((f): LegacyField => compact({
      variable: f.variable, column: zoneToColumn(f.zone), default: str(f.default_value), options: str(f.options),
    }))),
  }));
  const rules: Rule[] = (await q(`SELECT r.*, coalesce(array_agg(x.component_id ORDER BY x.position) FILTER (WHERE x.component_id IS NOT NULL), '{}') AS comps
      FROM design_guide_rules r LEFT JOIN design_guide_rule_components x USING (rule_id) GROUP BY r.rule_id ORDER BY r.sort_order, r.rule_id`)).map((r) => compact({
    schema: 'signcore.rule/v1' as const, id: r.rule_id, version: r.version ?? '1.0.0', section: r.section_name, order: r.sort_order, basis: r.basis, active: r.active ? undefined : false,
    applies_to: appliesTo(r.comps, r.match_rule), standard: r.standard, why: str(r.why), how_to: str(r.coreldraw_how_to),
  }));
  const drawings: Drawing[] = (await q(`SELECT d.*, coalesce(array_agg(x.component_id ORDER BY x.position) FILTER (WHERE x.component_id IS NOT NULL), '{}') AS comps
      FROM detail_drawings d LEFT JOIN detail_drawing_components x USING (drawing_id) GROUP BY d.drawing_id ORDER BY d.sort_order, d.drawing_id`)).map((d) => compact({
    schema: 'signcore.drawing/v1' as const, id: d.drawing_id, version: d.version ?? '1.0.0', title: d.title, category: str(d.category), order: d.sort_order ?? undefined,
    active: d.active ? undefined : false, applies_to: appliesTo(d.comps, d.match_rule), notes: str(d.notes), svg: d.svg_markup ?? '',
  }));
  let departments: Department[] = [];
  try { departments = (await q('SELECT key, name, notes FROM departments ORDER BY sort_order, key')).map((d) => compact({ key: d.key, name: d.name, notes: str(d.notes) })); } catch { /* table added by migration 002 */ }
  return { components, products, rules, drawings, departments };
}
function appliesTo(comps: string[], when: string | null): AppliesTo | undefined {
  const a = compact({ components: nonEmpty(comps), when: str(when) });
  return Object.keys(a).length ? a : undefined;
}

// ---------- modules folder <-> ModuleSet ----------
const yamlOpts = { lineWidth: 110, minContentWidth: 40 } as const;
function header(schemaFile: string, depth: number) { return `# yaml-language-server: $schema=${'../'.repeat(depth)}schemas/${schemaFile}\n`; }

export async function writeFolder(set: ModuleSet, dir = MODULES) {
  for (const sub of ['components', 'products', 'library/design-guide', 'library/drawings']) {
    await rm(path.join(dir, sub), { recursive: true, force: true }); await mkdir(path.join(dir, sub), { recursive: true });
  }
  for (const c of set.components) {
    await mkdir(path.join(dir, 'components', c.id), { recursive: true });
    await writeFile(path.join(dir, 'components', c.id, 'component.yaml'), header('component.schema.json', 3) + YAML.stringify(c, yamlOpts));
  }
  for (const p of set.products) await writeFile(path.join(dir, 'products', `${slug(p.name)}.yaml`), header('product.schema.json', 2) + YAML.stringify(p, yamlOpts));
  for (const r of set.rules) await writeFile(path.join(dir, 'library/design-guide', `${r.id}.yaml`), header('rule.schema.json', 3) + YAML.stringify(r, yamlOpts));
  for (const d of set.drawings) {
    const { svg, ...meta } = d;
    await writeFile(path.join(dir, 'library/drawings', `${d.id}.yaml`), header('drawing.schema.json', 3) + YAML.stringify(meta, yamlOpts));
    await writeFile(path.join(dir, 'library/drawings', `${d.id}.svg`), wrapSvg(svg));
  }
  if (set.departments.length) await writeFile(path.join(dir, 'library/departments.yaml'), header('departments.schema.json', 2) + YAML.stringify({ schema: 'signcore.departments/v1', departments: set.departments }, yamlOpts));
}

export type FileError = { file: string; message: string };
export async function readFolder(dir = MODULES): Promise<{ set: ModuleSet; files: Record<string, unknown>; errors: FileError[] }> {
  const errors: FileError[] = []; const files: Record<string, unknown> = {};
  const load = async (rel: string) => {
    try { const doc = YAML.parse(await readFile(path.join(dir, rel), 'utf8')); files[rel] = doc; return doc; }
    catch (e) { errors.push({ file: rel, message: `Not valid YAML: ${(e as Error).message.split('\n')[0]}` }); return undefined; }
  };
  const list = async (rel: string) => (existsSync(path.join(dir, rel)) ? (await readdir(path.join(dir, rel))).sort() : []);
  const set: ModuleSet = { components: [], products: [], rules: [], drawings: [], departments: [] };
  for (const id of await list('components')) {
    const c = await load(`components/${id}/component.yaml`);
    if (c) { if (c.id !== id) errors.push({ file: `components/${id}/component.yaml`, message: `id ${c.id} does not match its folder name ${id}.` }); set.components.push(c); }
  }
  for (const f of (await list('products')).filter((f) => f.endsWith('.yaml'))) { const p = await load(`products/${f}`); if (p) set.products.push(p); }
  for (const f of (await list('library/design-guide')).filter((f) => f.endsWith('.yaml'))) {
    const r = await load(`library/design-guide/${f}`);
    if (r) { if (`${r.id}.yaml` !== f) errors.push({ file: `library/design-guide/${f}`, message: `id ${r.id} does not match the file name.` }); set.rules.push(r); }
  }
  for (const f of (await list('library/drawings')).filter((f) => f.endsWith('.yaml'))) {
    const d = await load(`library/drawings/${f}`);
    if (!d) continue;
    const svgFile = path.join(dir, 'library/drawings', f.replace(/\.yaml$/, '.svg'));
    if (!existsSync(svgFile)) { errors.push({ file: `library/drawings/${f}`, message: `Missing ${path.basename(svgFile)}.` }); continue; }
    set.drawings.push({ ...d, svg: unwrapSvg(await readFile(svgFile, 'utf8')) });
  }
  if (existsSync(path.join(dir, 'library/departments.yaml'))) set.departments = (await load('library/departments.yaml'))?.departments ?? [];
  set.components.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
  set.products.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
  set.rules.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  set.drawings.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
  return { set, files, errors };
}

// ---------- validation ----------
const VAR_IN_SHOWIF = (expr: string) => expr.split('&').map((c) => c.trim().match(/^(.+?)\s*(!=|~=|=)/)?.[1].trim()).filter((x): x is string => !!x);
const VAR_IN_CALC = (expr: string) => [...expr.matchAll(/\{([^}|]+)(\|[^}]*)?\}/g)].map((m) => m[1].trim());
const COLOR_TABS = ['LED', 'COIL', 'TRIMCAP', 'ACM', 'ACRYLIC', 'PVC', 'CORO'];

export async function validate(dir = MODULES): Promise<{ errors: FileError[]; warnings: FileError[]; set: ModuleSet }> {
  const { set, files, errors } = await readFolder(dir);
  const warnings: FileError[] = [];
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const f of ['component', 'product', 'rule', 'drawing', 'departments']) ajv.addSchema(JSON.parse(await readFile(path.join(ROOT, 'schemas', `${f}.schema.json`), 'utf8')), `${f}.schema.json`);
  const schemaFor = (file: string) => file.startsWith('components/') ? 'component' : file.startsWith('products/') ? 'product'
    : file.includes('design-guide/') ? 'rule' : file.includes('drawings/') ? 'drawing' : 'departments';
  for (const [file, doc] of Object.entries(files)) {
    const v = ajv.getSchema(`${schemaFor(file)}.schema.json`)!;
    if (!v(doc)) for (const e of v.errors ?? []) errors.push({ file, message: `${e.instancePath || '(top)'} ${e.message}${e.params && 'allowedValues' in e.params ? `: ${(e.params as any).allowedValues.join(', ')}` : ''}` });
  }
  const err = (file: string, message: string) => errors.push({ file, message });
  const warn = (file: string, message: string) => warnings.push({ file, message });

  const compIds = new Set(set.components.map((c) => c.id));
  const varsOf = new Map(set.components.map((c) => [c.id, new Set((c.fields ?? []).map((f) => f.variable))]));
  const depts = new Set(set.departments.map((d) => d.key));
  for (const c of set.components) {
    const file = `components/${c.id}/component.yaml`;
    const vars = varsOf.get(c.id)!;
    const seen = new Set<string>();
    for (const f of c.fields ?? []) {
      if (seen.has(f.variable)) err(file, `Field ${f.variable} appears twice.`); seen.add(f.variable);
      if (f.show_if) for (const v of VAR_IN_SHOWIF(f.show_if)) if (!vars.has(v)) err(file, `${f.variable}: show_if uses ${v}, which is not a field of ${c.id}.`);
      if (f.type === 'calc') for (const o of f.options ?? []) for (const v of VAR_IN_CALC(String(o))) if (!vars.has(v)) err(file, `${f.variable}: calc uses {${v}}, which is not a field of ${c.id}.`);
      if (f.type === 'calc' && (f.options ?? []).some((o) => String(o).trim().startsWith('='))) err(file, `${f.variable}: a calc must not start with =.`);
      if (f.type === 'db' && !(f.options ?? []).every((o) => COLOR_TABS.includes(String(o)))) err(file, `${f.variable}: db fields take one of ${COLOR_TABS.join(', ')}.`);
      if (f.type === 'autoqty' && f.options?.length && !vars.has(String(f.options[0]))) err(file, `${f.variable}: autoqty points at ${f.options[0]}, which is not a field.`);
      if ((f.type === 'select' || f.type === 'color') && f.default !== undefined && f.options?.length && !f.options.map(String).includes(String(f.default)))
        warn(file, `${f.variable}: default "${f.default}" is not one of the options.`);
      if (f.type === 'select' && !f.options?.length) err(file, `${f.variable}: a select needs options.`);
    }
    for (const r of c.routing ?? []) {
      if (depts.size && !depts.has(r.department)) err(file, `routing: unknown department ${r.department}.`);
      if (r.when) for (const v of VAR_IN_SHOWIF(r.when)) if (!vars.has(v)) err(file, `routing (${r.department}): when uses ${v}, which is not a field.`);
      if (r.work) for (const v of VAR_IN_CALC(r.work)) if (!vars.has(v)) err(file, `routing (${r.department}): {${v}} is not a field.`);
    }
    for (const m of c.materials ?? []) {
      if (m.when) for (const v of VAR_IN_SHOWIF(m.when)) if (!vars.has(v)) err(file, `materials (${m.item}): when uses ${v}, which is not a field.`);
      if (typeof m.qty === 'string') for (const v of VAR_IN_CALC(m.qty)) if (!vars.has(v)) err(file, `materials (${m.item}): qty uses {${v}}, which is not a field.`);
      if (m.department && depts.size && !depts.has(m.department)) err(file, `materials (${m.item}): unknown department ${m.department}.`);
    }
  }
  const names = new Set<string>();
  for (const p of set.products) {
    const file = `products/${slug(p.name)}.yaml`;
    if (names.has(p.name)) err(file, `Two products are named ${p.name}.`); names.add(p.name);
    for (const s of p.sections ?? []) {
      if (!compIds.has(s.component)) { err(file, `Section uses ${s.component}, which is not a component.`); continue; }
      for (const v of Object.keys(s.defaults ?? {})) if (!varsOf.get(s.component)!.has(v)) err(file, `${s.title || s.component}: default sets ${v}, which is not a field of ${s.component}.`);
    }
    if (!p.sections?.length && !p.legacy_fields?.length) warn(file, 'This product has no sections.');
  }
  for (const [kind, items] of [['library/design-guide', set.rules], ['library/drawings', set.drawings]] as const) {
    const ids = new Set<string>();
    for (const it of items as (Rule | Drawing)[]) {
      const file = `${kind}/${it.id}.yaml`;
      if (ids.has(it.id)) err(file, `ID ${it.id} is used twice.`); ids.add(it.id);
      for (const c of it.applies_to?.components ?? []) if (!compIds.has(c)) err(file, `applies_to lists ${c}, which is not a component.`);
      const m = it.applies_to?.when?.match(/COMPONENT\s*[!~]?=\s*([A-Z0-9_|]+)/);
      if (m) for (const c of m[1].split('|')) if (c && !compIds.has(c)) err(file, `when names component ${c}, which does not exist.`);
    }
  }
  for (const d of set.drawings) {
    if (/<script|\son\w+\s*=/i.test(d.svg)) err(`library/drawings/${d.id}.svg`, 'Drawings cannot contain scripts or event handlers.');
    if (!d.svg.trim()) warn(`library/drawings/${d.id}.svg`, 'The drawing is empty.');
  }
  return { errors, warnings, set };
}

// ---------- modules -> database (publish) ----------
export async function toDatabase(q: Q, set: ModuleSet, gitSha?: string) {
  const out = { components: 0, fields: 0, products: 0, sections: 0, rules: 0, drawings: 0 };
  // Upsert components first so products and links can point at them; remove modules deleted from the folder.
  const keepComps = set.components.map((c) => c.id);
  for (const [i, c] of set.components.entries()) {
    await q(`INSERT INTO components (component_id, display_name, show_as_tool, repeatable, description, sort_order, version, routing, materials, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
             ON CONFLICT (component_id) DO UPDATE SET display_name=EXCLUDED.display_name, show_as_tool=EXCLUDED.show_as_tool, repeatable=EXCLUDED.repeatable,
               description=EXCLUDED.description, sort_order=EXCLUDED.sort_order, version=EXCLUDED.version, routing=EXCLUDED.routing, materials=EXCLUDED.materials, updated_at=now()`,
      [c.id, c.name, !!c.show_as_tool, !!c.repeatable, c.description ?? null, c.order ?? (i + 1) * 10, c.version, JSON.stringify(c.routing ?? []), JSON.stringify(c.materials ?? [])]);
    await q('DELETE FROM component_fields WHERE component_id=$1', [c.id]);
    for (const [j, f] of (c.fields ?? []).entries()) {
      await q(`INSERT INTO component_fields (component_id, variable, sort_order, zone, label, field_type, default_value, options, show_if, required, signos_ref, notes, hide_values)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [c.id, f.variable, (j + 1) * 10, columnToZone(f.column), f.label ?? f.variable, f.type, str(f.default) ?? null, joinPipes(f.options), f.show_if ?? null,
         !!f.required, f.signos ?? null, f.notes ?? null, joinPipes(f.hide_values)]);
      out.fields++;
    }
    await recordVersion(q, 'component', c.id, c.version, c, gitSha); out.components++;
  }
  const keepProds = set.products.map((p) => p.name);
  for (const [i, p] of set.products.entries()) {
    await q(`INSERT INTO products (product_name, sort_order, version, updated_at) VALUES ($1,$2,$3,now())
             ON CONFLICT (product_name) DO UPDATE SET sort_order=EXCLUDED.sort_order, version=EXCLUDED.version, updated_at=now()`, [p.name, p.order ?? (i + 1) * 10, p.version]);
    await q('DELETE FROM product_components WHERE product_name=$1', [p.name]);
    for (const [j, s] of (p.sections ?? []).entries()) {
      await q(`INSERT INTO product_components (product_name, sort_order, component_id, section_title, include, repeatable, default_overrides, page_group) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [p.name, j + 1, s.component, s.title ?? null, INCLUDE_TO_DB[s.include ?? 'required'], !!s.repeatable, joinOverrides(s.defaults), s.page_group ?? null]);
      out.sections++;
    }
    await q('DELETE FROM product_fields WHERE product_name=$1', [p.name]);
    for (const [j, f] of (p.legacy_fields ?? []).entries())
      await q('INSERT INTO product_fields (product_name, variable, sort_order, zone, default_value, options) VALUES ($1,$2,$3,$4,$5,$6)',
        [p.name, f.variable, (j + 1) * 10, columnToZone(f.column), str(f.default) ?? null, f.options ?? null]);
    await recordVersion(q, 'product', p.name, p.version, p, gitSha); out.products++;
  }
  // Rules: sections first (ordered by their first rule), then rules and links.
  const firstOrder = new Map<string, number>();
  for (const r of set.rules) if (!firstOrder.has(r.section) || r.order < firstOrder.get(r.section)!) firstOrder.set(r.section, r.order);
  for (const [name, order] of firstOrder) await q(`INSERT INTO design_guide_sections (section_name, sort_order) VALUES ($1,$2) ON CONFLICT (section_name) DO UPDATE SET sort_order=EXCLUDED.sort_order`, [name, order]);
  for (const r of set.rules) {
    await q(`INSERT INTO design_guide_rules (rule_id, section_name, match_rule, standard, why, coreldraw_how_to, basis, sort_order, active, version, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
             ON CONFLICT (rule_id) DO UPDATE SET section_name=EXCLUDED.section_name, match_rule=EXCLUDED.match_rule, standard=EXCLUDED.standard, why=EXCLUDED.why,
               coreldraw_how_to=EXCLUDED.coreldraw_how_to, basis=EXCLUDED.basis, sort_order=EXCLUDED.sort_order, active=EXCLUDED.active, version=EXCLUDED.version, updated_at=now()`,
      [r.id, r.section, r.applies_to?.when ?? null, r.standard, r.why ?? null, r.how_to ?? null, r.basis, r.order, r.active !== false, r.version]);
    await q('DELETE FROM design_guide_rule_components WHERE rule_id=$1', [r.id]);
    for (const [j, c] of (r.applies_to?.components ?? []).entries()) await q('INSERT INTO design_guide_rule_components (rule_id, component_id, position) VALUES ($1,$2,$3)', [r.id, c, j]);
    await recordVersion(q, 'rule', r.id, r.version, r, gitSha); out.rules++;
  }
  for (const d of set.drawings) {
    await q(`INSERT INTO detail_drawings (drawing_id, category, title, match_rule, sort_order, active, svg_markup, notes, version, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
             ON CONFLICT (drawing_id) DO UPDATE SET category=EXCLUDED.category, title=EXCLUDED.title, match_rule=EXCLUDED.match_rule, sort_order=EXCLUDED.sort_order,
               active=EXCLUDED.active, svg_markup=EXCLUDED.svg_markup, notes=EXCLUDED.notes, version=EXCLUDED.version, updated_at=now()`,
      [d.id, d.category ?? null, d.title, d.applies_to?.when ?? null, d.order ?? null, d.active !== false, d.svg, d.notes ?? null, d.version]);
    await q('DELETE FROM detail_drawing_components WHERE drawing_id=$1', [d.id]);
    for (const [j, c] of (d.applies_to?.components ?? []).entries()) await q('INSERT INTO detail_drawing_components (drawing_id, component_id, position) VALUES ($1,$2,$3)', [d.id, c, j]);
    await recordVersion(q, 'drawing', d.id, d.version, d, gitSha); out.drawings++;
  }
  for (const [i, d] of set.departments.entries())
    await q(`INSERT INTO departments (key, name, notes, sort_order) VALUES ($1,$2,$3,$4) ON CONFLICT (key) DO UPDATE SET name=EXCLUDED.name, notes=EXCLUDED.notes, sort_order=EXCLUDED.sort_order`, [d.key, d.name, d.notes ?? null, i]);
  // Remove what was deleted from the folder (products first: they reference components).
  await q('DELETE FROM products WHERE NOT (product_name = ANY($1))', [keepProds]);
  await q('DELETE FROM components WHERE NOT (component_id = ANY($1))', [keepComps]);
  await q('DELETE FROM design_guide_rules WHERE NOT (rule_id = ANY($1))', [set.rules.map((r) => r.id)]);
  await q('DELETE FROM design_guide_sections s WHERE NOT EXISTS (SELECT 1 FROM design_guide_rules r WHERE r.section_name=s.section_name)');
  await q('DELETE FROM detail_drawings WHERE NOT (drawing_id = ANY($1))', [set.drawings.map((d) => d.id)]);
  if (set.departments.length) await q('DELETE FROM departments WHERE NOT (key = ANY($1))', [set.departments.map((d) => d.key)]);
  return out;
}
async function recordVersion(q: Q, kind: string, id: string, version: string, content: unknown, gitSha?: string) {
  // Same version re-published with different content is refused: bump the version instead.
  const prev = await q('SELECT content FROM module_versions WHERE kind=$1 AND module_id=$2 AND version=$3', [kind, id, version]);
  if (prev.length) {
    if (!sameJson(prev[0].content, content))
      throw new Error(`${kind} ${id} changed but is still version ${version}. Bump its version.`);
    return;
  }
  await q('INSERT INTO module_versions (kind, module_id, version, content, git_sha) VALUES ($1,$2,$3,$4,$5)', [kind, id, version, JSON.stringify(content), gitSha ?? null]);
}
function sameJson(a: unknown, b: unknown): boolean { return canon(a) === canon(JSON.parse(JSON.stringify(b))); }
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canon((v as any)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
