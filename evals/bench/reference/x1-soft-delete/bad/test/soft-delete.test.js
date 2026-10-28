import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../src/accounts/db.js';
import { createCustomers } from '../src/accounts/customers.js';
import { createAuth } from '../src/accounts/auth.js';
import { createOrders } from '../src/accounts/orders.js';
import { newsletterRecipients } from '../src/marketing/newsletter.js';

function setup() {
  const db = createDb();
  const customers = createCustomers(db);
  const ada = customers.create({ name: 'Ada', email: 'ada@example.com', country: 'CH', password: 'pw-ada', newsletter: true });
  const bob = customers.create({ name: 'Bob', email: 'bob@example.com', country: 'DE', password: 'pw-bob', newsletter: true });
  return { db, customers, auth: createAuth(db), orders: createOrders(db), ada, bob };
}

test('soft delete keeps the record and the orders', () => {
  const { db, customers, orders, ada } = setup();
  orders.place(ada.id, 1000);
  customers.remove(ada.id);
  assert.ok(db.customers.get(ada.id).deletedAt);
  assert.equal(orders.forCustomer(ada.id).length, 1);
});

test('deleted customers are hidden from list, search and newsletter', () => {
  const { db, customers, ada } = setup();
  customers.remove(ada.id);
  assert.deepEqual(customers.list().map((c) => c.name), ['Bob']);
  assert.deepEqual(customers.search('ada'), []);
  assert.deepEqual(newsletterRecipients(db), ['bob@example.com']);
});

test('deleted customers lose access', () => {
  const { customers, auth, ada } = setup();
  const token = auth.login('ada@example.com', 'pw-ada');
  customers.remove(ada.id);
  assert.throws(() => auth.login('ada@example.com', 'pw-ada'));
  assert.equal(auth.authenticate(token), null);
});
