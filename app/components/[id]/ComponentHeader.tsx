'use client';
import ActionForm, { Submit, ConfirmButton } from '@/components/ActionForm';
import { updateComponent, deleteComponent } from '../actions';

export default function ComponentHeader({ c }: { c: any }) {
  return (
    <div className="card">
      <div className="hd"><h2>Component settings</h2></div>
      <div className="bd stack">
        <ActionForm action={updateComponent}>
          <input type="hidden" name="original_id" value={c.component_id} />
          <div className="fgrid">
            <label className="f">Display name<input type="text" name="display_name" id="comp-name" defaultValue={c.display_name} required /></label>
            <label className="f">Component ID<input type="text" name="component_id" id="comp-id" className="code" defaultValue={c.component_id} required />
              <span className="h">Renaming updates products, rules and drawings that list it.</span></label>
            <label className="f wide">Description<input type="text" name="description" id="comp-desc" defaultValue={c.description || ''} /></label>
            <label className="check"><input type="checkbox" name="show_as_tool" id="comp-tool" defaultChecked={c.show_as_tool} /> Show as tool</label>
            <label className="check"><input type="checkbox" name="repeatable" id="comp-rep" defaultChecked={c.repeatable} /> Repeatable</label>
          </div>
          <div className="row" style={{ marginTop: 12 }}><Submit>Save settings</Submit></div>
        </ActionForm>
        <ActionForm action={deleteComponent}>
          <input type="hidden" name="component_id" value={c.component_id} />
          <div className="row"><ConfirmButton label="Delete component" confirm="Click again to delete it and all its fields" /><span className="small muted">Only possible when no product uses it.</span></div>
        </ActionForm>
      </div>
    </div>
  );
}
