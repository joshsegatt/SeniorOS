import { validateCustomer } from './customerForm.js';
import { ValidationError } from '../errors.js';

export function createCustomerStore() {
  const rows = [];
  return {
    add(input) {
      const { ok, errors } = validateCustomer(input);
      if (!ok) throw new ValidationError(errors);
      const customer = { id: `C-${rows.length + 1}`, ...input, email: input.email.trim().toLowerCase() };
      rows.push(customer);
      return { ...customer };
    },
    list() {
      return rows.map((r) => ({ ...r }));
    },
  };
}
