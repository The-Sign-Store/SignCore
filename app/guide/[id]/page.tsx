import Link from 'next/link';
import { notFound } from 'next/navigation';
import { withDb } from '@/lib/db';
import RuleForm from './RuleForm';

export const dynamic = 'force-dynamic';

export default async function RulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === 'new';
  const data = await withDb(async (db) => {
    const rule = isNew ? null : await db.one('SELECT * FROM design_guide_rules WHERE rule_id=$1', [id.toUpperCase()]);
    if (!isNew && !rule) return null;
    const comps = rule ? (await db.q('SELECT component_id FROM design_guide_rule_components WHERE rule_id=$1 ORDER BY position', [rule.rule_id])).map((r) => r.component_id) : [];
    const sections = await db.q(`SELECT s.section_name, s.sort_order,
        (SELECT r.rule_id FROM design_guide_rules r WHERE r.section_name=s.section_name ORDER BY r.sort_order DESC LIMIT 1) AS last_id,
        (SELECT max(r.sort_order) FROM design_guide_rules r WHERE r.section_name=s.section_name) AS last_order
      FROM design_guide_sections s ORDER BY s.sort_order`);
    const components = await db.q('SELECT component_id, display_name FROM components ORDER BY display_name');
    const ids = (await db.q('SELECT rule_id FROM design_guide_rules')).map((r) => r.rule_id);
    return { rule, comps, sections, components, ids };
  });
  if (!data) notFound();
  return (
    <div className="stack">
      <div className="head"><div>
        <div className="crumbs"><Link href="/guide">Design Guide</Link> /</div>
        <h1>{isNew ? 'New rule' : <>Rule <span className="mono">{data.rule!.rule_id}</span></>}</h1>
        <p className="sub">Standard is the rule, Why is the reason shown to new designers, and How-to is the CorelDRAW steps. {'{VARIABLE}'} in the standard prints that spec value.</p>
      </div></div>
      <RuleForm rule={data.rule} comps={data.comps} sections={data.sections} components={data.components} ids={data.ids} />
    </div>
  );
}
