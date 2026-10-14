import Link from 'next/link';
import { withDb } from '@/lib/db';
import Filter from '@/components/Filter';

export const dynamic = 'force-dynamic';

export default async function GuidePage() {
  const { sections, rules } = await withDb(async (db) => ({
    sections: await db.q('SELECT section_name FROM design_guide_sections ORDER BY sort_order'),
    rules: await db.q(`SELECT r.*, coalesce(string_agg(x.component_id, ', ' ORDER BY x.position), '') AS comps
                       FROM design_guide_rules r LEFT JOIN design_guide_rule_components x USING (rule_id) GROUP BY r.rule_id ORDER BY r.sort_order`),
  }));
  return (
    <div className="stack">
      <div className="head">
        <div><h1>Design Guide</h1><p className="sub">{rules.length} rules. SignCore's Design Help Center shows the active rules that apply to the products in a proof package.</p></div>
        <div className="row"><Filter target="guide-list" id="guide-filter" placeholder="Search rules" /><Link className="btn primary" href="/guide/new">+ New rule</Link></div>
      </div>
      <div id="guide-list" className="stack">
        {sections.map((s) => {
          const rs = rules.filter((r) => r.section_name === s.section_name);
          return (
            <div className="card flat" key={s.section_name} data-group>
              <div className="hd"><h2>{s.section_name}</h2><span className="chip">{rs.length}</span></div>
              <div className="bd tbl-wrap"><table><tbody>{rs.map((r) => (
                <tr key={r.rule_id} data-filter={`${r.rule_id} ${r.standard} ${r.why || ''} ${r.comps} ${r.match_rule || ''}`}>
                  <td style={{ width: 60 }}><Link href={`/guide/${r.rule_id}`} className="mono"><b>{r.rule_id}</b></Link></td>
                  <td><Link href={`/guide/${r.rule_id}`} style={{ color: 'inherit' }}>{r.standard}</Link>
                    <div className="small muted" style={{ marginTop: 3 }}>{r.comps ? `Applies to ${r.comps}` : r.match_rule ? <>When <span className="mono">{r.match_rule}</span></> : 'Every proof'}</div></td>
                  <td style={{ width: 150 }}><div className="pill-list"><span className="chip">{r.basis}</span>{!r.active && <span className="chip off">Inactive</span>}</div></td>
                </tr>))}</tbody></table></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
