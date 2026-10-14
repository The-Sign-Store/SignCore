'use client';
import ActionForm, { Submit, ConfirmButton } from '@/components/ActionForm';
import { renameProduct, deleteProduct } from '../actions';

export default function ProductSettings({ name }: { name: string }) {
  return (
    <div className="card"><div className="hd"><h2>Product settings</h2></div><div className="bd stack">
      <ActionForm action={renameProduct}>
        <input type="hidden" name="original_name" value={name} />
        <div className="row"><label className="f" style={{ flex: 1, minWidth: 220 }}>Product name<input type="text" name="product_name" id="prod-name" defaultValue={name} required /></label>
          <div style={{ alignSelf: 'end' }}><Submit>Rename</Submit></div></div>
      </ActionForm>
      <ActionForm action={deleteProduct}>
        <input type="hidden" name="product_name" value={name} />
        <div className="row"><ConfirmButton label="Delete product" confirm="Click again to delete the product and its sections" /><span className="small muted">Components themselves are kept.</span></div>
      </ActionForm>
    </div></div>
  );
}
