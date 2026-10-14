'use client';
import ActionForm, { Submit } from '@/components/ActionForm';
import { createComponent } from './actions';

export default function NewComponent() {
  return (
    <div className="card">
      <div className="hd"><h2>Add a component</h2></div>
      <div className="bd">
        <ActionForm action={createComponent}>
          <div className="fgrid">
            <label className="f">Display name<input type="text" name="display_name" id="new-comp-name" placeholder="Wall Panel" required /></label>
            <label className="f">Component ID<input type="text" name="component_id" id="new-comp-id" className="code" placeholder="WALL_PANEL" required /><span className="h">Capitals and underscores. Used by products and rules.</span></label>
            <label className="f wide">Description<input type="text" name="description" id="new-comp-desc" /></label>
            <label className="check"><input type="checkbox" name="show_as_tool" id="new-comp-tool" /> Show as tool</label>
            <label className="check"><input type="checkbox" name="repeatable" id="new-comp-rep" /> Repeatable</label>
          </div>
          <div className="row" style={{ marginTop: 12 }}><Submit>Create component</Submit></div>
        </ActionForm>
      </div>
    </div>
  );
}
