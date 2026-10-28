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
  const ada = customers.create({ name: 'Ada', email: 'Ada@example.com', country: 'CH', password: 'pw-ada', newsletter: true });
  const bob = customers.create({ name: 'Bob', email: 'bob@example.com', country: 'DE', password: 'pw-bob' });
  return { db, customers, auth: createAuth(db), orders: createOrders(db), ada, bob };
}

test('customers are listed by name and searchable', () => {
  const { customers } = setup();
  assert.deepEqual(customers.list().map((c) => c.name), ['Ada', 'Bob']);
  assert.deepEqual(customers.search('BOB').map((c) => c.name), ['Bob']);
  assert.deepEqual(customers.search('example').map((c) => c.name), ['Ada', 'Bob']);
});

test('emails are unique and stored lowercase', () => {
  const { customers, ada } = setup();
  assert.equal(ada.email, 'ada@example.com');
  assert.throws(() => customers.create({ name: 'Ada 2', email: 'ADA@example.com', country: 'CH', password: 'x' }));
});

test('login returns a session token and authenticate resolves it', () => {
  const { auth, ada } = setup();
  const token = auth.login('ada@example.com', 'pw-ada');
  assert.equal(auth.authenticate(token).id, ada.id);
  assert.throws(() => auth.login('ada@example.com', 'wrong'));
  assert.equal(auth.authenticate('nope'), null);
});

test('newsletter goes to customers who opted in', () => {
  const { db } = setup();
  assert.deepEqual(newsletterRecipients(db), ['ada@example.com']);
});

test('removing a customer', () => {
  const { customers, ada } = setup();
  customers.remove(ada.id);
  assert.deepEqual(customers.list().map((c) => c.name), ['Bob']);
  assert.throws(() => customers.remove('missing'));
});

test('orders belong to a customer', () => {
  const { orders, ada } = setup();
  orders.place(ada.id, 1200);
  orders.place(ada.id, 300);
  assert.equal(orders.forCustomer(ada.id).length, 2);
  assert.throws(() => orders.place('missing', 100));
});
