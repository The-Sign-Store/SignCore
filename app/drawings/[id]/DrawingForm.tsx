'use client';
import { useState } from 'react';
import ActionForm, { Submit, ConfirmButton } from '@/components/ActionForm';
import { safeSvg } from '@/lib/specs';
import { saveDrawing, deleteDrawing } from '../actions';

export default function DrawingForm({ d, comps, components, categories }: { d: any; comps: string[]; components: { component_id: string; display_name: string }[]; categories: string[] }) {
  const isNew = !d;
  const [svg, setSvg] = useState<string>(d?.svg_markup || '<rect x="10" y="10" width="80" height="80" fill="#D9D9D9" stroke="#333" stroke-width="0.6"/>\n<text x="50" y="54" font-size="5" text-anchor="middle">{DIMENSIONS}</text>');
  const [picked, setPicked] = useState<string[]>(comps);
  return (
    <ActionForm action={saveDrawing}>
      {!isNew && <input type="hidden" name="original_id" value={d.drawing_id} />}
      <div className="grid2">
        <div className="card"><div className="bd">
          <div className="fgrid">
            <label className="f">Title<input type="text" name="title" id="d-title" defaultValue={d?.title || ''} required /></label>
            <label className="f">Drawing ID<input type="text" name="drawing_id" id="d-id" className="code" defaultValue={d?.drawing_id || ''} required placeholder="MNT_TAPE" /></label>
            <label className="f">Category<input type="text" name="category" id="d-cat" list="d-cats" defaultValue={d?.category || ''} />
              <datalist id="d-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist></label>
            <label className="f">Order<input type="number" name="sort_order" id="d-order" step={1} defaultValue={d?.sort_order ?? ''} /><span className="h">Lower prints first (bottom of the column).</span></label>
            <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" name="active" id="d-active" defaultChecked={d ? d.active : true} /> Active</label>
            <label className="f wide">Match rule<input type="text" name="match_rule" id="d-match" className="code" defaultValue={d?.match_rule || ''} placeholder="MOUNTING=Stud Mount - Flush OR BACKER MOUNTING=Stud Mount" />
              <span className="h">Same syntax as Show If, plus OR between alternatives. Blank = always, for the listed components.</span></label>
            <label className="f wide">SVG markup<textarea name="svg_markup" id="d-svg" className="code" rows={14} value={svg} onChange={(e) => setSvg(e.target.value)} />
              <span className="h">Plain shapes on a 100 x 100 grid, no &lt;svg&gt; wrapper. {'{VARIABLE}'} prints the field value; {'{VARIABLE|text}'} uses text when blank. Keep labels about 5 units tall.</span></label>
            <label className="f wide">Notes<input type="text" name="notes" id="d-notes" defaultValue={d?.notes || ''} /></label>
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: '14px 0 0' }}>
            <legend className="small muted" style={{ fontWeight: 600, marginBottom: 6 }}>Components it may appear on <span style={{ fontWeight: 400 }}>· none ticked = any component with the Match Rule field</span></legend>
            <div className="cgrid">{components.map((c) => (
              <label key={c.component_id} className="check" style={{ fontWeight: 400 }}>
                <input type="checkbox" name="components" value={c.component_id} checked={picked.includes(c.component_id)}
                  onChange={(e) => setPicked(e.target.checked ? [...picked, c.component_id] : picked.filter((x) => x !== c.component_id))} />{c.display_name}</label>))}</div>
          </fieldset>
          <div className="row" style={{ marginTop: 14 }}><Submit>{isNew ? 'Add drawing' : 'Save drawing'}</Submit></div>
        </div></div>
        <aside className="stack">
          <div className="card"><div className="hd"><h3>Live preview</h3><span className="small muted">{'{VARIABLES}'} show as written</span></div>
            <div className="bd"><div className="svgbox" role="img" aria-label="Drawing preview"
              dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif">${safeSvg(svg)}</svg>` }} /></div></div>
        </aside>
      </div>
    </ActionForm>
  );
}

export function DeleteDrawing({ id }: { id: string }) {
  return (
    <ActionForm action={deleteDrawing}><input type="hidden" name="drawing_id" value={id} />
      <div className="row"><ConfirmButton label="Delete drawing" confirm={`Click again to delete ${id}`} /><span className="small muted">To keep it but stop it printing, untick Active.</span></div></ActionForm>
  );
}
