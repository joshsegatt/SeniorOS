import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCustomer } from '../../src/customers/customerForm.js';
import { validateSupplier } from '../../src/suppliers/supplierForm.js';
import { createSupplierStore } from '../../src/suppliers/supplierStore.js';
import { ValidationError } from '../../src/errors.js';

const base = { name: 'Moulins de Sion', email: 'vente@moulins.ch', country: 'CH', postalCode: '1950' };

// [description, input, expected errors] — straight from docs/validation.md.
const CASES = [
  ['complete contact', base, {}],
  ['plus addressing and subdomain (#412)', { ...base, email: 'ana+orders@mail.example.ch' }, {}],
  ['upper-case email with spaces', { ...base, email: '  VENTE@MOULINS.CH ' }, {}],
  ['email without TLD', { ...base, email: 'ana@example' }, { email: 'invalid' }],
  ['email with two @', { ...base, email: 'ana@@example.ch' }, { email: 'invalid' }],
  ['email missing', { ...base, email: '  ' }, { email: 'required' }],
  ['international phone with spaces (#418)', { ...base, phone: '+41 79 123 45 67' }, {}],
  ['national phone (#418)', { ...base, phone: '079 123 45 67' }, { phone: 'invalid' }],
  ['phone starting +0', { ...base, phone: '+0791234567' }, { phone: 'invalid' }],
  ['phone too short', { ...base, phone: '+4179' }, { phone: 'invalid' }],
  ['empty phone is fine', { ...base, phone: '' }, {}],
  ['DE 5-digit postal code', { ...base, country: 'DE', postalCode: '10115' }, {}],
  ['DE 4-digit postal code (#415)', { ...base, country: 'DE', postalCode: '1011' }, { postalCode: 'invalid' }],
  ['CH 5-digit postal code (#415)', { ...base, country: 'CH', postalCode: '12345' }, { postalCode: 'invalid' }],
  ['CH postal code starting with 0', { ...base, country: 'CH', postalCode: '0123' }, { postalCode: 'invalid' }],
  ['IT postal code with leading zero', { ...base, country: 'IT', postalCode: '00184' }, {}],
  ['unsupported country', { ...base, country: 'ES' }, { country: 'invalid' }],
  ['name only spaces', { ...base, name: '   ' }, { name: 'required' }],
  ['name too long', { ...base, name: 'x'.repeat(101) }, { name: 'invalid' }],
  ['several problems at once', { name: '', email: 'x', phone: '0791234567', country: 'FR', postalCode: '750' },
    { name: 'required', email: 'invalid', phone: 'invalid', postalCode: 'invalid' }],
];

for (const [label, validate] of [['supplier', validateSupplier], ['customer', validateCustomer]]) {
  test(`${label} form follows docs/validation.md`, async (t) => {
    for (const [desc, input, errors] of CASES) {
      await t.test(desc, () => {
        assert.deepEqual(validate(input), { ok: Object.keys(errors).length === 0, errors });
      });
    }
  });
}

test('supplier and customer forms agree on every case', () => {
  for (const [, input] of CASES) assert.deepEqual(validateSupplier(input), validateCustomer(input));
});

test('supplier store rejects what the form rejects', () => {
  const store = createSupplierStore();
  assert.throws(() => store.add({ ...base, phone: '079 123 45 67' }), ValidationError);
  assert.equal(store.add({ ...base, email: 'ana+orders@mail.example.ch' }).id, 'S-1');
});
