import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../src/accounts/db.js';
import { createCustomers } from '../src/accounts/customers.js';
import { createOrders } from '../src/accounts/orders.js';
import { revenueByCountry } from '../src/reports/revenue.js';

test('revenue is summed per customer country', () => {
  const db = createDb();
  const customers = createCustomers(db);
  const orders = createOrders(db);
  const ada = customers.create({ name: 'Ada', email: 'ada@example.com', country: 'CH', password: 'a' });
  const eve = customers.create({ name: 'Eve', email: 'eve@example.com', country: 'CH', password: 'e' });
  const bob = customers.create({ name: 'Bob', email: 'bob@example.com', country: 'DE', password: 'b' });
  orders.place(ada.id, 1000);
  orders.place(eve.id, 250);
  orders.place(bob.id, 400);
  assert.deepEqual(revenueByCountry(customers, orders), { CH: 1250, DE: 400 });
});
