import test from 'node:test';
import assert from 'node:assert/strict';
import { placeOrder } from '../../src/checkout/place.js';
import { quote } from '../../src/checkout/quote.js';
import { createOrderRepo } from '../../src/orders/repo.js';
import { carrierManifests } from '../../src/warehouse/manifest.js';
import { confirmationEmail } from '../../src/emails/confirmation.js';
import { sendPendingConfirmations } from '../../src/jobs/send-confirmations.js';

const now = () => new Date('2026-10-15T09:30:00Z');
const address = { name: 'Ana Lima', street: 'Rua Augusta 100', postcode: '1100-053', city: 'Lisboa', country: 'PT' };
const lines = [{ sku: 'MUG-1', qty: 1, unitCents: 1250 }];
const pickup = (extra = {}) => ({ email: 'rui@example.com', lines, shippingMethod: 'pickup', ...extra });

test('pickup orders need no delivery address and ship for free', () => {
  const orders = createOrderRepo();
  const placed = placeOrder(pickup(), { orders, now });
  assert.equal(placed.ok, true, JSON.stringify(placed.errors));
  assert.equal(placed.order.shippingMethod, 'pickup');
  assert.equal(placed.order.shippingCents, 0);
  assert.equal(placed.order.totalCents, 1250);
  assert.equal(placeOrder(pickup({ address: null }), { orders, now }).ok, true);
});

test('pickup is free whatever the cart total', () => {
  assert.deepEqual(quote([{ sku: 'A', qty: 1, unitCents: 900 }], 'pickup'), { subtotalCents: 900, shippingCents: 0, totalCents: 900 });
  assert.deepEqual(quote([{ sku: 'A', qty: 3, unitCents: 9000 }], 'pickup'), { subtotalCents: 27000, shippingCents: 0, totalCents: 27000 });
});

test('delivered orders still need an address', () => {
  const orders = createOrderRepo();
  const res = placeOrder({ email: 'rui@example.com', lines, shippingMethod: 'standard' }, { orders, now });
  assert.equal(res.ok, false);
  assert.ok(res.errors['address.street']);
  assert.equal(placeOrder({ email: 'rui@example.com', lines, shippingMethod: 'drone' }, { orders, now }).ok, false);
});

test('a pickup order is stored and read back as a pickup order', () => {
  const table = [];
  const { order } = placeOrder(pickup(), { orders: createOrderRepo(table), now });
  const again = createOrderRepo(JSON.parse(JSON.stringify(table))).get(order.id);
  assert.equal(again.shippingMethod, 'pickup');
  assert.equal(again.totalCents, 1250);
});

test('pickup orders are not sent to any carrier', () => {
  const orders = createOrderRepo();
  placeOrder({ email: 'ana@example.com', lines, shippingMethod: 'standard', address }, { orders, now });
  placeOrder(pickup(), { orders, now });
  placeOrder({ email: 'ana@example.com', lines, shippingMethod: 'express', address }, { orders, now });
  const manifests = carrierManifests(orders, '2026-10-15');
  assert.deepEqual(Object.keys(manifests).sort(), ['ctt', 'dhl']);
  assert.deepEqual(manifests.ctt, ['ord_1001;Ana Lima;Rua Augusta 100;1100-053;Lisboa;PT']);
  assert.deepEqual(manifests.dhl, ['ord_1003;Ana Lima;Rua Augusta 100;1100-053;Lisboa;PT']);
});

test('the confirmation job tells pickup customers where to collect their order', async () => {
  const table = [];
  placeOrder(pickup(), { orders: createOrderRepo(table), now });
  const orders = createOrderRepo(JSON.parse(JSON.stringify(table)));
  const outbox = [];
  assert.deepEqual(await sendPendingConfirmations(orders, { send: async (m) => { outbox.push(m); } }, now), { sent: 1 });
  const { to, text } = outbox[0];
  assert.equal(to, 'rui@example.com');
  assert.match(text, /Rua das Flores 12, 4050-265 Porto/);
  assert.doesNotMatch(text, /undefined|null/);
  assert.match(text, /Shipping: free/);
});

test('delivered orders keep their confirmation email', () => {
  const orders = createOrderRepo();
  const { order } = placeOrder({ email: 'ana@example.com', lines, shippingMethod: 'standard', address }, { orders, now });
  const { text } = confirmationEmail(order);
  assert.match(text, /Shipping to:\n {2}Ana Lima\n {2}Rua Augusta 100\n {2}1100-053 Lisboa, PT/);
  assert.doesNotMatch(text, /Rua das Flores/);
});
