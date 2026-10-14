'use client';
import { useState } from 'react';
import ActionForm, { Submit, ConfirmButton } from '@/components/ActionForm';
import { BASIS, HELP } from '@/lib/specs';
import { saveRule, deleteRule } from '../actions';

type Section = { section_name: string; sort_order: number; last_id: string | null; last_order: number | null };

function nextId(last: string | null, ids: string[]) {
  const m = last?.match(/^([A-Z]+)(\d+)$/);
  if (!m) return '';
  for (let n = Number(m[2]) + 1; n < 1000; n++) { const id = m[1] + String(n).padStart(m[2].length, '0'); if (!ids.includes(id)) return id; }
  return '';
}

export default function RuleForm({ rule, comps, sections, components, ids }: { rule: any; comps: string[]; sections: Section[]; components: { component_id: string; display_name: string }[]; ids: string[] }) {
  const isNew = !rule;
  const [section, setSection] = useState<string>(rule?.section_name || sections[0]?.section_name || '__new__');
  const sec = sections.find((s) => s.section_name === section);
  const [ruleId, setRuleId] = useState<string>(rule?.rule_id || nextId(sec?.last_id ?? null, ids));
  const [order, setOrder] = useState<number>(rule?.sort_order ?? (sec?.last_order ?? 0) + 5);
  const [picked, setPicked] = useState<string[]>(comps);
  const onSection = (v: string) => {
    setSection(v);
    if (isNew) { const s = sections.find((x) => x.section_name === v); setRuleId(nextId(s?.last_id ?? null, ids)); setOrder((s?.last_order ?? 0) + 5); }
  };
  return (
    <div className="grid2">
      <div className="card"><div className="bd">
        <ActionForm action={saveRule}>
          {!isNew && <input type="hidden" name="original_id" value={rule.rule_id} />}
          <div className="fgrid">
            <label className="f">Section<select name="section_name" id="r-sec" value={section} onChange={(e) => onSection(e.target.value)}>
              {sections.map((s) => <option key={s.section_name} value={s.section_name}>{s.section_name}</option>)}<option value="__new__">New section…</option></select></label>
            {section === '__new__' && <label className="f">New section name<input type="text" name="new_section" id="r-newsec" required placeholder="PUSH-THRU SIGNS" /></label>}
            <label className="f">Rule ID<input type="text" name="rule_id" id="r-id" className="code" value={ruleId} onChange={(e) => setRuleId(e.target.value.toUpperCase())} required /></label>
            <label className="f">Order<input type="number" name="sort_order" id="r-order" value={order} onChange={(e) => setOrder(Number(e.target.value))} step={1} required /><span className="h">Sorts rules; sections print in the order they first appear.</span></label>
            <label className="f">Basis<select name="basis" id="r-basis" defaultValue={rule?.basis || 'House'}>{BASIS.map((b) => <option key={b}>{b}</option>)}</select>
              <span className="h">House = our design standard · SignOS = our equipment / material data · Industry = sign industry standard</span></label>
            <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" name="active" id="r-active" defaultChecked={rule ? rule.active : true} /> Active (shown in SignCore)</label>
            <label className="f wide">Standard<textarea name="standard" id="r-std" rows={4} defaultValue={rule?.standard || ''} required /></label>
            <label className="f wide">Why<textarea name="why" id="r-why" rows={2} defaultValue={rule?.why || ''} /></label>
            <label className="f wide">CorelDRAW how-to<textarea name="coreldraw_how_to" id="r-how" rows={3} defaultValue={rule?.coreldraw_how_to || ''} /></label>
            <label className="f wide">Match rule<input type="text" name="match_rule" id="r-match" className="code" defaultValue={rule?.match_rule || ''} /><span className="h">{HELP.matchRule} Blank with no components = applies to every package.</span></label>
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: '14px 0 0' }}>
            <legend className="small muted" style={{ fontWeight: 600, marginBottom: 6 }}>Limit to components <span style={{ fontWeight: 400 }}>· none ticked = any component</span></legend>
            <div className="cgrid">{components.map((c) => (
              <label key={c.component_id} className="check" style={{ fontWeight: 400 }}>
                <input type="checkbox" name="components" value={c.component_id} checked={picked.includes(c.component_id)}
                  onChange={(e) => setPicked(e.target.checked ? [...picked, c.component_id] : picked.filter((x) => x !== c.component_id))} />{c.display_name}</label>))}</div>
          </fieldset>
          <div className="row" style={{ marginTop: 14 }}><Submit>{isNew ? 'Add rule' : 'Save rule'}</Submit></div>
        </ActionForm>
      </div></div>
      {!isNew && (
        <aside className="card"><div className="hd"><h3>Remove</h3></div><div className="bd stack small">
          <p className="muted" style={{ margin: 0 }}>To hide a rule but keep it, untick Active instead.</p>
          <ActionForm action={deleteRule}><input type="hidden" name="rule_id" value={rule.rule_id} /><ConfirmButton label="Delete rule" confirm={`Click again to delete ${rule.rule_id}`} /></ActionForm>
        </div></aside>
      )}
    </div>
  );
}
