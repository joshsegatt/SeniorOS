import { validateSupplier } from './supplierForm.js';
import { ValidationError } from '../errors.js';

export function createSupplierStore() {
  const rows = [];
  return {
    add(input) {
      const { ok, errors } = validateSupplier(input);
      if (!ok) throw new ValidationError(errors);
      const supplier = { id: `S-${rows.length + 1}`, ...input, email: String(input.email ?? '').trim().toLowerCase() };
      rows.push(supplier);
      return { ...supplier };
    },
    list() {
      return rows.map((r) => ({ ...r }));
    },
  };
}
