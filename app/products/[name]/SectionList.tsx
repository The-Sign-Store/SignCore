'use client';
import { useState } from 'react';
import Link from 'next/link';
import ActionForm, { Submit, ConfirmButton } from '@/components/ActionForm';
import MiniAction from '@/components/MiniAction';
import { HELP, INCLUDE } from '@/lib/specs';
import { saveSection, moveSection, deleteSection } from '../actions';

type Comp = { component_id: string; display_name: string; repeatable: boolean; vars: string[] };

export default function SectionList({ product, sections, components }: { product: string; sections: any[]; components: Comp[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="card flat">
      <div className="hd"><h2>Sections <span className="muted small" style={{ textTransform: 'none', letterSpacing: 0 }}>· {sections.length}</span></h2>
        <button type="button" className="primary" onClick={() => setOpen('new')}>+ Add section</button></div>
      <div className="bd">
        {sections.length === 0 && open !== 'new' && <div className="empty">No sections yet. Add the components this product is built from.</div>}
        {sections.map((s, i) => (
          <div key={s.id}>
            <div className={`frow${open === String(s.id) ? ' open' : ''}`} style={{ gridTemplateColumns: '52px minmax(0,1.4fr) minmax(0,1fr) minmax(0,1.4fr) auto' }}>
              <div className="row" style={{ gap: 0 }}>
                <MiniAction action={moveSection} values={{ id: s.id, dir: 'up', product_name: product }} label={<span className="icon">↑</span>} title="Move up" className={`ghost${i === 0 ? ' invisible' : ''}`} />
                <MiniAction action={moveSection} values={{ id: s.id, dir: 'down', product_name: product }} label={<span className="icon">↓</span>} title="Move down" className={`ghost${i === sections.length - 1 ? ' invisible' : ''}`} />
              </div>
              <div><div className="var">{s.section_title || s.display_name}</div>
                <div className="lbl"><Link href={`/components/${s.component_id}`}>{s.display_name}</Link> <span className="mono">{s.component_id}</span></div></div>
              <div className="pill-list"><span className={`chip${s.include === 'Required' ? ' on' : ' warn'}`}>{s.include}</span>{s.repeatable && <span className="chip">Repeatable</span>}{s.page_group != null && <span className="chip">Page {s.page_group}</span>}</div>
              <div className="def mono small">{s.default_overrides || <span style={{ fontFamily: 'var(--f-ui)' }}>Component defaults</span>}</div>
              <div className="acts"><button type="button" onClick={() => setOpen(open === String(s.id) ? null : String(s.id))}>{open === String(s.id) ? 'Close' : 'Edit'}</button></div>
            </div>
            {open === String(s.id) && <SectionForm product={product} s={s} components={components} onDone={() => setOpen(null)} />}
          </div>
        ))}
        {open === 'new' && <SectionForm product={product} s={{ include: 'Required' }} components={components} onDone={() => setOpen(null)} />}
      </div>
    </div>
  );
}

function SectionForm({ product, s, components, onDone }: { product: string; s: any; components: Comp[]; onDone: () => void }) {
  const isNew = !s.id;
  const [comp, setComp] = useState<string>(s.component_id || '');
  const c = components.find((x) => x.component_id === comp);
  const key = s.id ?? 'new';
  return (
    <div className="fedit">
      <ActionForm action={saveSection} onSuccess={(r) => { if (!r.warnings?.length) onDone(); }}>
        <input type="hidden" name="product_name" value={product} />
        {!isNew && <input type="hidden" name="id" value={s.id} />}
        <div className="fgrid">
          <label className="f">Component<select name="component_id" id={`s-comp-${key}`} value={comp} onChange={(e) => setComp(e.target.value)} required>
            <option value="" disabled>Choose a component…</option>
            {components.map((x) => <option key={x.component_id} value={x.component_id}>{x.display_name} ({x.component_id})</option>)}</select></label>
          <label className="f">Section title<input type="text" name="section_title" id={`s-title-${key}`} defaultValue={s.section_title || ''} placeholder={c?.display_name || 'Shown as the section heading'} /></label>
          <label className="f">Include<select name="include" id={`s-inc-${key}`} defaultValue={s.include}>{INCLUDE.map((v) => <option key={v}>{v}</option>)}</select><span className="h">{HELP.include}</span></label>
          <label className="f">Page group<input type="number" name="page_group" id={`s-pg-${key}`} min={1} step={1} defaultValue={s.page_group ?? ''} /><span className="h">{HELP.pageGroup}</span></label>
          <label className="check"><input type="checkbox" name="repeatable" id={`s-rep-${key}`} defaultChecked={isNew ? !!c?.repeatable : !!s.repeatable} /> Repeatable (adds “+ Add another”)</label>
          <label className="f wide">Product-specific defaults<input type="text" name="default_overrides" id={`s-ovr-${key}`} className="code" defaultValue={s.default_overrides || ''} placeholder="SIDEDNESS=Double Sided; MOUNTING=Pole Mount" />
            <span className="h">{HELP.overrides}</span>
            {c && c.vars.length > 0 && <span className="h">Fields on {c.display_name}: <span className="mono">{c.vars.join(' · ')}</span></span>}</label>
        </div>
        <div className="row" style={{ marginTop: 12 }}><Submit>{isNew ? 'Add section' : 'Save section'}</Submit><button type="button" onClick={onDone}>Cancel</button></div>
      </ActionForm>
      {!isNew && (
        <ActionForm action={deleteSection}>
          <input type="hidden" name="id" value={s.id} /><input type="hidden" name="product_name" value={product} />
          <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end' }}><ConfirmButton label="Remove section" confirm="Click again to remove it from this product" /></div>
        </ActionForm>
      )}
    </div>
  );
}
