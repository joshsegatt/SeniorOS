import test from 'node:test';
import assert from 'node:assert/strict';
import { createShopStore } from '../../src/shop/store.js';
import { formatAddress, saveCheckoutAddress } from '../../src/shop/addresses.js';
import { shippingRate } from '../../src/shop/shipping.js';
import { vatRate } from '../../src/shop/tax.js';
import { deliveryEstimate } from '../../src/shop/delivery.js';
import { placeOrder } from '../../src/shop/orders.js';
import { postAddress } from '../../src/api/mobile-addresses.js';
import { importAddressesCsv } from '../../src/import/customers-csv.js';

const t0 = new Date('2026-10-19T19:26:03Z');

/** An address added from the app's address screen, as the app sends it. */
function fromApp(store, customerId, city, postcode, country) {
  const res = postAddress(store, customerId, { name: 'Lena Hoffmann', street: 'Oderberger Str. 12', postcode, city, country });
  assert.equal(res.status, 201);
  return store.getAddress(/** @type {{ id: string }} */ (res.body).id);
}

test('the reported case: a Berlin address added in the app pays domestic shipping', () => {
  const store = createShopStore();
  const berlin = fromApp(store, 'c-2207', 'Berlin', '10435', 'Germany');
  assert.equal(shippingRate(berlin), 490);
});

test('an order to an address added in the app is charged German VAT', () => {
  const store = createShopStore();
  const berlin = fromApp(store, 'c-2207', 'Berlin', '10435', 'Germany');
  assert.equal(vatRate(berlin), 0.19);
  const order = placeOrder(store, { customerId: 'c-2207', addressId: berlin.id, items: [{ sku: 'KTL-02', qty: 1, price: 3450 }, { sku: 'TEA-03', qty: 2, price: 1990 }] }, () => t0);
  assert.deepEqual({ subtotal: order.subtotal, shipping: order.shipping, vat: order.vat, total: order.total }, { subtotal: 7430, shipping: 490, vat: 1505, total: 9425 });
});

test('the delivery estimate for an address added in the app is domestic', () => {
  const store = createShopStore();
  const berlin = fromApp(store, 'c-2207', 'Berlin', '10435', 'Germany');
  assert.deepEqual(deliveryEstimate(berlin, t0), { from: '2026-10-20', to: '2026-10-21' });
  const order = placeOrder(store, { customerId: 'c-2207', addressId: berlin.id, items: [{ sku: 'MUG-07', qty: 1, price: 1490 }] }, () => t0);
  assert.equal(order.deliveryBy, '2026-10-21');
});

test('other EU countries picked in the app get EU shipping, VAT and delivery', () => {
  const store = createShopStore();
  const vienna = fromApp(store, 'c-2207', 'Wien', '1070', 'Austria');
  assert.equal(shippingRate(vienna), 990);
  assert.equal(vatRate(vienna), 0.2);
  assert.deepEqual(deliveryEstimate(vienna, t0), { from: '2026-10-22', to: '2026-10-24' });
  const zurich = fromApp(store, 'c-2207', 'Zürich', '8001', 'Switzerland');
  assert.equal(shippingRate(zurich), 2490);
  assert.equal(vatRate(zurich), 0);
});

test('addresses from the app still show the country name and unknown countries are refused', () => {
  const store = createShopStore();
  const berlin = fromApp(store, 'c-2207', 'Berlin', '10435', 'Germany');
  assert.equal(formatAddress(berlin), 'Lena Hoffmann, Oderberger Str. 12, 10435 Berlin, Germany');
  assert.equal(postAddress(store, 'c-2207', { name: 'X', street: 'Y', postcode: '1', city: 'Z', country: 'Atlantis' }).status, 422);
});

test('web checkout and ERP import addresses are unchanged', () => {
  const store = createShopStore();
  const web = saveCheckoutAddress(store, 'c-1', { name: 'A', street: 'B 1', postcode: '10115', city: 'Berlin', country: 'de' });
  assert.equal(shippingRate(web), 490);
  assert.equal(vatRate(web), 0.19);
  importAddressesCsv(store, 'customer_id,name,street,postcode,city,country\nc-9,Nordhaus GmbH,Hauptplatz 1,8010,Graz,AT\n');
  const [graz] = store.addressesOf('c-9');
  assert.equal(shippingRate(graz), 990);
  assert.equal(formatAddress(graz), 'Nordhaus GmbH, Hauptplatz 1, 8010 Graz, Austria');
});
