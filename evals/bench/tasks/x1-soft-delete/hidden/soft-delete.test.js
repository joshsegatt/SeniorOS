import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../../src/accounts/db.js';
import { createCustomers } from '../../src/accounts/customers.js';
import { createAuth } from '../../src/accounts/auth.js';
import { createOrders } from '../../src/accounts/orders.js';
import { newsletterRecipients } from '../../src/marketing/newsletter.js';
import { revenueByCountry } from '../../src/reports/revenue.js';

function setup() {
  const db = createDb();
  const customers = createCustomers(db);
  const orders = createOrders(db);
  const auth = createAuth(db);
  const ada = customers.create({ name: 'Ada', email: 'ada@example.com', country: 'CH', password: 'pw-ada', newsletter: true });
  const bob = customers.create({ name: 'Bob', email: 'bob@example.com', country: 'DE', password: 'pw-bob', newsletter: true });
  const cy = customers.create({ name: 'Cy', email: 'cy@example.com', country: 'CH', password: 'pw-cy' });
  orders.place(ada.id, 1000);
  orders.place(ada.id, 500);
  orders.place(bob.id, 400);
  orders.place(cy.id, 250);
  return { db, customers, orders, auth, ada, bob, cy };
}

const authenticateOrNull = (auth, token) => {
  try {
    return auth.authenticate(token) ?? null;
  } catch {
    return null;
  }
};

test('remove keeps the record with a deletedAt timestamp', () => {
  const { db, customers, ada } = setup();
  customers.remove(ada.id);
  assert.ok(db.customers.has(ada.id), 'the customer record was wiped');
  assert.ok(db.customers.get(ada.id).deletedAt, 'deletedAt is not set');
});

test('deleted customers disappear from the list and search', () => {
  const { customers, ada } = setup();
  customers.remove(ada.id);
  assert.deepEqual(customers.list().map((c) => c.name), ['Bob', 'Cy']);
  assert.deepEqual(customers.search('ada').map((c) => c.name), []);
  assert.deepEqual(customers.search('example').map((c) => c.name), ['Bob', 'Cy']);
});

test('deleted customers stop getting the newsletter', () => {
  const { db, customers, ada } = setup();
  customers.remove(ada.id);
  assert.deepEqual(newsletterRecipients(db), ['bob@example.com']);
});

test('deleted customers cannot sign in', () => {
  const { customers, auth, ada } = setup();
  customers.remove(ada.id);
  assert.throws(() => auth.login('ada@example.com', 'pw-ada'));
  assert.ok(auth.login('bob@example.com', 'pw-bob'));
});

test('sessions opened before the deletion no longer give access', () => {
  const { customers, auth, ada, bob } = setup();
  const adaToken = auth.login('ada@example.com', 'pw-ada');
  const bobToken = auth.login('bob@example.com', 'pw-bob');
  customers.remove(ada.id);
  assert.equal(authenticateOrNull(auth, adaToken), null, 'a deleted customer is still signed in');
  assert.equal(authenticateOrNull(auth, bobToken)?.id, bob.id);
});

test('orders of a deleted customer are kept', () => {
  const { customers, orders, ada } = setup();
  customers.remove(ada.id);
  assert.equal(orders.forCustomer(ada.id).length, 2);
  assert.equal(orders.all().length, 4);
});

test('the revenue report still counts orders of deleted customers', () => {
  const { customers, orders, ada, bob } = setup();
  const before = revenueByCountry(customers, orders);
  assert.deepEqual(before, { CH: 1750, DE: 400 });
  customers.remove(ada.id);
  customers.remove(bob.id);
  assert.deepEqual(revenueByCountry(customers, orders), before);
});
