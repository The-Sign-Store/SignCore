import 'server-only';
import type { Db } from './db';

const yes = (b: boolean) => (b ? 'Yes' : 'No');

/** Each export matches a Google Sheet tab: same tab name, same headers, same Yes/No conventions. */
export const SHEET_EXPORTS: Record<string, { tab: string; headers: string[]; rows: (db: Db) => Promise<unknown[][]> }> = {
  'component-registry': {
    tab: 'Component_Registry',
    headers: ['Component_ID', 'Display_Name', 'Show_As_Tool', 'Repeatable', 'Description'],
    rows: async (db) => (await db.q('SELECT * FROM components ORDER BY sort_order, component_id')).map((c) =>
      [c.component_id, c.display_name, yes(c.show_as_tool), yes(c.repeatable), c.description]),
  },
  'component-schema': {
    tab: 'Component_Schema',
    headers: ['Component_ID', 'Zone', 'Variable', 'Label', 'Type', 'Default', 'Options', 'Show_If', 'Required', 'SignOS_Ref', 'Notes', 'Hide_Values'],
    rows: async (db) => (await db.q(`SELECT f.* FROM component_fields f JOIN components c USING (component_id) ORDER BY c.sort_order, c.component_id, f.sort_order, f.id`)).map((f) =>
      [f.component_id, f.zone, f.variable, f.label, f.field_type, f.default_value, f.options, f.show_if, f.required ? 'Yes' : '', f.signos_ref, f.notes, f.hide_values]),
  },
  'product-assembly': {
    tab: 'Product_Assembly',
    headers: ['Product', 'Order', 'Component_ID', 'Section_Title', 'Include', 'Repeatable', 'Default_Overrides', 'Page_Group'],
    rows: async (db) => (await db.q(`SELECT pc.* FROM product_components pc JOIN products p USING (product_name) ORDER BY p.sort_order, p.product_name, pc.sort_order`)).map((s) =>
      [s.product_name, s.sort_order, s.component_id, s.section_title, s.include, yes(s.repeatable), s.default_overrides, s.page_group]),
  },
  'design-guide': {
    tab: 'Design_Guide',
    headers: ['Rule_ID', 'Section', 'Components', 'Match_Rule', 'Standard', 'Why', 'CorelDRAW_How_To', 'Basis', 'Order', 'Active'],
    rows: async (db) => (await db.q(`SELECT r.*, string_agg(x.component_id, ',' ORDER BY x.position) AS comps FROM design_guide_rules r
        LEFT JOIN design_guide_rule_components x USING (rule_id) GROUP BY r.rule_id ORDER BY r.sort_order, r.rule_id`)).map((r) =>
      [r.rule_id, r.section_name, r.comps, r.match_rule, r.standard, r.why, r.coreldraw_how_to, r.basis, r.sort_order, yes(r.active)]),
  },
  'detail-drawings': {
    tab: 'Detail_Drawings',
    headers: ['Drawing_ID', 'Category', 'Title', 'Components', 'Match_Rule', 'Order', 'Active', 'SVG_Markup', 'Notes'],
    rows: async (db) => (await db.q(`SELECT d.*, string_agg(x.component_id, ',' ORDER BY x.position) AS comps FROM detail_drawings d
        LEFT JOIN detail_drawing_components x USING (drawing_id) GROUP BY d.drawing_id ORDER BY d.sort_order NULLS LAST, d.drawing_id`)).map((d) =>
      [d.drawing_id, d.category, d.title, d.comps, d.match_rule, d.sort_order, yes(d.active), d.svg_markup, d.notes]),
  },
};

export function toCsv(headers: string[], rows: unknown[][]) {
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** Tables in foreign-key order, for a restorable data backup. */
const BACKUP_TABLES = [
  'meta', 'readme', 'components', 'component_fields', 'products', 'product_components', 'product_fields', 'retired_product_fields',
  'detail_drawings', 'detail_drawing_components', 'design_guide_sections', 'design_guide_rules', 'design_guide_rule_components',
  'sw_colors', 'pms_colors', 'oracal_colors', 'rowmark_colors', 'material_colors', 'quick_colors', 'materials',
  'ada_pictograms', 'signos_reference', 'proof_template', 'change_log',
];

function lit(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

export async function sqlBackup(db: Db) {
  const out: string[] = [
    `-- SignCore data backup, ${new Date().toISOString()}`,
    '-- Restore into a database created with db/schema.sql:  psql "$DATABASE_URL" -f this-file.sql',
    'BEGIN;',
    `TRUNCATE ${BACKUP_TABLES.slice().reverse().join(', ')} RESTART IDENTITY CASCADE;`,
  ];
  for (const t of BACKUP_TABLES) {
    const rows = await db.q(`SELECT * FROM ${t}`);
    if (!rows.length) continue;
    const cols = Object.keys(rows[0]);
    out.push(`\n-- ${t}: ${rows.length} rows`);
    for (let i = 0; i < rows.length; i += 200) {
      out.push(`INSERT INTO ${t} (${cols.join(', ')}) VALUES\n` + rows.slice(i, i + 200).map((r) => `(${cols.map((c) => lit(r[c])).join(', ')})`).join(',\n') + ';');
    }
  }
  const seqs = await db.q(`SELECT c.relname AS tbl, a.attname AS col FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
     JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND pg_get_serial_sequence(c.relname::text, a.attname::text) IS NOT NULL`);
  for (const s of seqs) out.push(`SELECT setval(pg_get_serial_sequence('${s.tbl}', '${s.col}'), coalesce((SELECT max(${s.col}) FROM ${s.tbl}), 0) + 1, false);`);
  out.push('COMMIT;\n');
  return out.join('\n');
}
