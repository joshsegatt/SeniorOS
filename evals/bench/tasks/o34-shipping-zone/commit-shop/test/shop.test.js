import test from 'node:test';
import assert from 'node:assert/strict';
import { createShopStore } from '../src/shop/store.js';
import { formatAddress, saveCheckoutAddress } from '../src/shop/addresses.js';
import { shippingRate } from '../src/shop/shipping.js';
import { vatRate } from '../src/shop/tax.js';
import { deliveryEstimate } from '../src/shop/delivery.js';
import { placeOrder } from '../src/shop/orders.js';
import { postAddress } from '../src/api/mobile-addresses.js';
import { importAddressesCsv } from '../src/import/customers-csv.js';

const t0 = new Date('2026-10-19T19:00:00Z');
const form = (country) => ({ name: 'Lena Hoffmann', street: 'Kastanienallee 41', postcode: '10435', city: 'Berlin', country });

test('shipping rates by destination', () => {
  const store = createShopStore();
  assert.equal(shippingRate(saveCheckoutAddress(store, 'c-1', form('DE'))), 490);
  assert.equal(shippingRate(saveCheckoutAddress(store, 'c-1', form('at'))), 990);
  assert.equal(shippingRate(saveCheckoutAddress(store, 'c-1', form('CH'))), 2490);
  assert.throws(() => saveCheckoutAddress(store, 'c-1', form('XX')), /ship/);
});

test('VAT and delivery estimates by destination', () => {
  const store = createShopStore();
  const berlin = saveCheckoutAddress(store, 'c-1', form('DE'));
  const amsterdam = saveCheckoutAddress(store, 'c-1', form('NL'));
  const zurich = saveCheckoutAddress(store, 'c-1', form('CH'));
  assert.deepEqual([vatRate(berlin), vatRate(amsterdam), vatRate(zurich)], [0.19, 0.21, 0]);
  assert.deepEqual(deliveryEstimate(berlin, t0), { from: '2026-10-20', to: '2026-10-21' });
  assert.deepEqual(deliveryEstimate(zurich, t0), { from: '2026-10-26', to: '2026-11-02' });
});

test('an order to a German address', () => {
  const store = createShopStore();
  const a = saveCheckoutAddress(store, 'c-1', form('DE'));
  const order = placeOrder(store, { customerId: 'c-1', addressId: a.id, items: [{ sku: 'MUG-07', qty: 2, price: 1490 }] }, () => t0);
  assert.deepEqual({ subtotal: order.subtotal, shipping: order.shipping, vat: order.vat, total: order.total }, { subtotal: 2980, shipping: 490, vat: 659, total: 4129 });
  assert.equal(order.deliveryBy, '2026-10-21');
  assert.throws(() => placeOrder(store, { customerId: 'c-2', addressId: a.id, items: [{ sku: 'MUG-07', qty: 1, price: 1490 }] }), /address/);
});

test('the app can add an address', () => {
  const store = createShopStore();
  const res = postAddress(store, 'c-1', { name: 'Lena Hoffmann', street: 'Oderberger Str. 12', postcode: '10435', city: 'Berlin', country: 'Germany' });
  assert.equal(res.status, 201);
  assert.equal(store.addressesOf('c-1').length, 1);
  assert.equal(formatAddress(store.addressesOf('c-1')[0]), 'Lena Hoffmann, Oderberger Str. 12, 10435 Berlin, Germany');
  assert.equal(postAddress(store, 'c-1', { name: 'X', street: 'Y', postcode: '1', city: 'Z', country: 'Atlantis' }).status, 422);
  assert.equal(postAddress(store, 'c-1', { name: 'X', street: '', postcode: '1', city: 'Z', country: 'Germany' }).status, 422);
});

test('importing B2B addresses from the ERP', () => {
  const store = createShopStore();
  const csv = 'customer_id,name,street,postcode,city,country\nc-9,Nordhaus GmbH,Hafenstr. 3,20457,Hamburg,DE\nc-9,Nordhaus GmbH,Hauptplatz 1,8010,Graz,at\nc-9,Bad,Row 1,1,X,ZZ\n';
  const { imported, errors } = importAddressesCsv(store, csv);
  assert.equal(imported.length, 2);
  assert.deepEqual(errors.map((e) => e.line), [4]);
  assert.deepEqual(store.addressesOf('c-9').map(shippingRate), [490, 990]);
  assert.equal(formatAddress(store.addressesOf('c-9')[1]), 'Nordhaus GmbH, Hauptplatz 1, 8010 Graz, Austria');
});
