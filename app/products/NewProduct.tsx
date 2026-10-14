'use client';
import ActionForm, { Submit } from '@/components/ActionForm';
import { createProduct } from './actions';

export default function NewProduct() {
  return (
    <div className="card"><div className="hd"><h2>Add a product</h2></div><div className="bd">
      <ActionForm action={createProduct}>
        <div className="row"><label className="f" style={{ flex: 1, minWidth: 220 }}>Product name<input type="text" name="product_name" id="new-prod" placeholder="Wall Panel Sign" required /></label>
          <div style={{ alignSelf: 'end' }}><Submit>Create product</Submit></div></div>
      </ActionForm>
    </div></div>
  );
}
