import test from 'node:test';
import assert from 'node:assert/strict';
import { placeOrder } from '../src/checkout/place.js';
import { quote } from '../src/checkout/quote.js';
import { createOrderRepo } from '../src/orders/repo.js';
import { carrierManifests } from '../src/warehouse/manifest.js';
import { confirmationEmail } from '../src/emails/confirmation.js';
import { sendPendingConfirmations } from '../src/jobs/send-confirmations.js';

const now = () => new Date('2026-10-15T09:30:00Z');
const address = { name: 'Ana Lima', street: 'Rua Augusta 100', postcode: '1100-053', city: 'Lisboa', country: 'PT' };
const input = (extra = {}) => ({ email: 'Ana@Example.com', lines: [{ sku: 'MUG-1', qty: 2, unitCents: 1250 }], shippingMethod: 'standard', address, ...extra });

test('quotes: standard is free from 50 euros, express never is', () => {
  assert.deepEqual(quote([{ sku: 'A', qty: 1, unitCents: 2500 }], 'standard'), { subtotalCents: 2500, shippingCents: 490, totalCents: 2990 });
  assert.deepEqual(quote([{ sku: 'A', qty: 2, unitCents: 2500 }], 'standard'), { subtotalCents: 5000, shippingCents: 0, totalCents: 5000 });
  assert.deepEqual(quote([{ sku: 'A', qty: 2, unitCents: 2500 }], 'express'), { subtotalCents: 5000, shippingCents: 990, totalCents: 5990 });
  assert.throws(() => quote([], 'drone'), /unknown shipping method/);
});

test('placing an order validates the checkout', () => {
  const orders = createOrderRepo();
  const bad = placeOrder(input({ email: 'x', shippingMethod: 'drone', address: { ...address, city: ' ', country: 'FR' } }), { orders, now });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.errors, { email: 'invalid email', shippingMethod: 'unknown shipping method', 'address.city': 'required', 'address.country': 'we ship to Portugal and Spain' });
  assert.equal(placeOrder(input({ address: null }), { orders, now }).ok, false);
  assert.equal(orders.list().length, 0);
});

test('a placed order is stored and read back', () => {
  const table = [];
  const placed = placeOrder(input(), { orders: createOrderRepo(table), now });
  assert.equal(placed.ok, true);
  const again = createOrderRepo(table).get(placed.order.id);
  assert.equal(again.email, 'ana@example.com');
  assert.equal(again.shippingMethod, 'standard');
  assert.deepEqual(again.address, address);
  assert.equal(again.totalCents, 2990);
});

test('carrier manifests list the day\'s parcels per carrier', () => {
  const orders = createOrderRepo();
  placeOrder(input(), { orders, now });
  placeOrder(input({ shippingMethod: 'express' }), { orders, now });
  placeOrder(input(), { orders, now: () => new Date('2026-10-16T09:00:00Z') });
  assert.deepEqual(carrierManifests(orders, '2026-10-15'), {
    ctt: ['ord_1001;Ana Lima;Rua Augusta 100;1100-053;Lisboa;PT'],
    dhl: ['ord_1002;Ana Lima;Rua Augusta 100;1100-053;Lisboa;PT'],
  });
});

test('confirmation emails go out once per order', async () => {
  const orders = createOrderRepo();
  placeOrder(input({ shippingMethod: 'express' }), { orders, now });
  const outbox = [];
  const mailer = { send: async (m) => { outbox.push(m); } };
  assert.deepEqual(await sendPendingConfirmations(orders, mailer, now), { sent: 1 });
  assert.deepEqual(await sendPendingConfirmations(orders, mailer, now), { sent: 0 });
  assert.equal(outbox[0].to, 'ana@example.com');
  assert.match(outbox[0].text, /Delivery: Express delivery/);
  assert.match(outbox[0].text, /Shipping to:\n {2}Ana Lima\n {2}Rua Augusta 100\n {2}1100-053 Lisboa, PT/);
  assert.equal(confirmationEmail(orders.list()[0]).subject, 'Kiosk Ceramics: order ord_1001 confirmed');
});
