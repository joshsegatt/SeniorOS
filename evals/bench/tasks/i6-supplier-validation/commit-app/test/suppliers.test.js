import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupplierStore } from '../src/suppliers/supplierStore.js';

test('store keeps a valid supplier', () => {
  const store = createSupplierStore();
  const s = store.add({ name: 'Moulins de Sion', email: 'Vente@Moulins.ch', country: 'CH', postalCode: '1950' });
  assert.equal(s.id, 'S-1');
  assert.equal(s.email, 'vente@moulins.ch');
  assert.equal(store.list().length, 1);
});
