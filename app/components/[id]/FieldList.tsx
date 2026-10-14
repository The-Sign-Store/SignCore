'use client';
import { useState } from 'react';
import ActionForm, { Submit, ConfirmButton } from '@/components/ActionForm';
import MiniAction from '@/components/MiniAction';
import { FIELD_TYPES, TYPE_MAP, ZONES, HELP, optionsToLines } from '@/lib/specs';
import { saveField, moveField, deleteField } from '../actions';

type Field = Record<string, any>;

export default function FieldList({ componentId, fields }: { componentId: string; fields: Field[] }) {
  const [open, setOpen] = useState<string | null>(null); // field id, or "new:<zone>"
  const zones = [...ZONES, ...[...new Set(fields.map((f) => f.zone || ''))].filter((z) => !ZONES.includes(z))];
  const used = zones.filter((z) => fields.some((f) => (f.zone || '') === z));
  const nextZone = ZONES.find((z) => !used.includes(z));
  const shown = nextZone ? [...used, nextZone] : used;

  return (
    <div className="card flat">
      <div className="hd">
        <h2>Fields <span className="muted small" style={{ textTransform: 'none', letterSpacing: 0 }}>· {fields.length}</span></h2>
        <span className="small muted">Columns match the preview columns in SignCore. Order within a column is the order on the proof.</span>
      </div>
      <div className="bd">
        {shown.map((zone) => {
          const zf = fields.filter((f) => (f.zone || '') === zone);
          return (
            <section className="zone" key={zone || 'none'} aria-label={zone || 'No column'}>
              <div className="zone-hd"><span>{zone || 'No column'} {zf.length > 0 && `· ${zf.length}`}</span>
                <button type="button" className="ghost small" onClick={() => setOpen(`new:${zone}`)}>+ Add field</button></div>
              {zf.length === 0 && open !== `new:${zone}` && <div className="empty small">No fields in this column yet.</div>}
              {zf.map((f, i) => (
                <div key={f.id}>
                  <div className={`frow${open === String(f.id) ? ' open' : ''}`}>
                    <div className="row" style={{ gap: 0 }}>
                      <MiniAction action={moveField} values={{ id: f.id, dir: 'up', component_id: componentId }} label={<span className="icon">↑</span>} title={`Move ${f.variable} up`} className={`ghost${i === 0 ? ' invisible' : ''}`} />
                      <MiniAction action={moveField} values={{ id: f.id, dir: 'down', component_id: componentId }} label={<span className="icon">↓</span>} title={`Move ${f.variable} down`} className={`ghost${i === zf.length - 1 ? ' invisible' : ''}`} />
                    </div>
                    <div><div className="var">{f.variable}</div>{f.label && f.label !== f.variable && <div className="lbl">Proof label: {f.label}</div>}</div>
                    <div className="typ pill-list"><span className="chip type">{f.field_type}</span>{f.required && <span className="chip on">Required</span>}{f.show_if && <span className="chip warn" title={f.show_if}>Conditional</span>}</div>
                    <div className="def">{f.default_value ? <>Default <b>{f.default_value}</b></> : <span>No default</span>}{f.options && f.field_type !== 'calc' && <> · {f.options.split('|').length} option{f.options.split('|').length === 1 ? '' : 's'}</>}</div>
                    <div className="acts"><button type="button" onClick={() => setOpen(open === String(f.id) ? null : String(f.id))}>{open === String(f.id) ? 'Close' : 'Edit'}</button></div>
                  </div>
                  {open === String(f.id) && <FieldForm componentId={componentId} field={f} onDone={() => setOpen(null)} />}
                </div>
              ))}
              {open === `new:${zone}` && <FieldForm componentId={componentId} field={{ zone, field_type: 'select', required: true }} onDone={() => setOpen(null)} />}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function FieldForm({ componentId, field, onDone }: { componentId: string; field: Field; onDone: () => void }) {
  const isNew = !field.id;
  const [type, setType] = useState<string>(field.field_type || 'select');
  const t = TYPE_MAP[type];
  const key = field.id ?? `new-${field.zone}`;
  return (
    <div className="fedit">
      <ActionForm action={saveField} onSuccess={(r) => { if (!r.warnings?.length && isNew) onDone(); }} resetOnSuccess={isNew}>
        <input type="hidden" name="component_id" value={componentId} />
        {!isNew && <input type="hidden" name="id" value={field.id} />}
        <div className="fgrid">
          <label className="f">Variable<input type="text" name="variable" id={`f-var-${key}`} className="code" defaultValue={field.variable || ''} required placeholder="RETAINER SIZE" />
            <span className="h">{isNew ? 'The name rules and Show If refer to.' : 'Renaming also updates Show If, calcs and product defaults that use it.'}</span></label>
          <label className="f">Proof label<input type="text" name="label" id={`f-label-${key}`} defaultValue={field.label || ''} placeholder="RETAINER" /></label>
          <label className="f">Column<select name="zone" id={`f-zone-${key}`} defaultValue={field.zone || ''}>
            {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}<option value="">No column</option></select></label>
          <label className="f">Input type<select name="field_type" id={`f-type-${key}`} value={type} onChange={(e) => setType(e.target.value)}>
            {FIELD_TYPES.map((ft) => <option key={ft.value} value={ft.value}>{ft.label} ({ft.value})</option>)}
            {!TYPE_MAP[type] && <option value={type}>{type}</option>}</select></label>
          {t && <p className="helpline wide" style={{ margin: 0 }}>{t.help}</p>}
          <label className="f">Default value<input type="text" name="default_value" id={`f-def-${key}`} defaultValue={field.default_value || ''} />{t?.default && <span className="h">{t.default}</span>}</label>
          <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" name="required" id={`f-req-${key}`} defaultChecked={!!field.required} /> Required (shows MISSING when blank)</label>
          <label className="f wide">Options<textarea name="options" id={`f-opt-${key}`} className="code" rows={Math.min(10, Math.max(3, (field.options || '').split('|').length + 1))} defaultValue={optionsToLines(field.options)} />
            <span className="h">{t?.options || 'One per line. Saved with | between them.'}</span></label>
          <label className="f wide">Show only if<input type="text" name="show_if" id={`f-show-${key}`} className="code" defaultValue={field.show_if || ''} placeholder="MOUNTING=Wall Mount" /><span className="h">{HELP.showIf}</span></label>
          <label className="f">Don't print when value is<textarea name="hide_values" id={`f-hide-${key}`} rows={2} defaultValue={optionsToLines(field.hide_values)} /><span className="h">One per line, e.g. None. The proof leaves the field out.</span></label>
          <label className="f">SignOS reference<input type="text" name="signos_ref" id={`f-signos-${key}`} className="code" defaultValue={field.signos_ref || ''} /></label>
          <label className="f wide">Notes<input type="text" name="notes" id={`f-notes-${key}`} defaultValue={field.notes || ''} /></label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <Submit>{isNew ? 'Add field' : 'Save field'}</Submit>
          <button type="button" onClick={onDone}>Cancel</button>
        </div>
      </ActionForm>
      {!isNew && (
        <ActionForm action={deleteField} onSuccess={(r) => { if (!r.warnings?.length) onDone(); }}>
          <input type="hidden" name="id" value={field.id} /><input type="hidden" name="component_id" value={componentId} />
          <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end' }}><ConfirmButton label="Delete field" confirm={`Click again to delete ${field.variable}`} /></div>
        </ActionForm>
      )}
    </div>
  );
}
