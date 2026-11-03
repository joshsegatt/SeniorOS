import { createCustomerStore } from './customers.js';

/**
 * Local dev data shaped like the production CRM (about 24k customers today).
 * @param {number} [count]
 */
export function demoCustomers(count = 24_000) {
  const first = ['Ada', 'Bob', 'Cy', 'Dana', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo', 'Jo'];
  const last = ['Lovelace', 'Marley', 'Young', 'Scully', 'Wiesel', 'Wray', 'Grissom', 'Mori', 'Andric', 'March'];
  return Array.from({ length: count }, (_, i) => ({
    id: `cu-${i + 1}`,
    email: `${first[i % 10].toLowerCase()}.${last[(i * 7) % 10].toLowerCase()}${i}@example.com`,
    name: `${first[i % 10]} ${last[(i * 7) % 10]}`,
    kind: /** @type {'customer'} */ ('customer'),
    newsletter: i % 4 === 0,
  }));
}

export function demoStore() {
  return createCustomerStore(demoCustomers());
}
