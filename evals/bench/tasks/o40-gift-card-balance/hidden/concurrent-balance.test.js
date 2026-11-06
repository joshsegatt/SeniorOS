import test from 'node:test';
import assert from 'node:assert/strict';
import { createGiftCardStore } from '../../src/giftcards/store.js';
import { getBalance, issueGiftCard } from '../../src/giftcards/cards.js';
import { redeemGiftCard } from '../../src/giftcards/redeem.js';
import { creditGiftCard } from '../../src/giftcards/credit.js';
import { createOrderStore } from '../../src/orders/store.js';
import { placeOrder } from '../../src/orders/checkout.js';
import { cancelOrder } from '../../src/orders/cancel.js';

async function cardWith(cents, code = 'GC-7Q2M') {
  const store = createGiftCardStore();
  await issueGiftCard(store, { code, amountCents: cents, ref: 'sale-1' });
  return store;
}

const kinds = async (store, code, kind) => (await store.get(code)).history.filter((e) => e.kind === kind);

test('the reported case: two €40 orders at once on a €50 card, only one is paid', async () => {
  const store = await cardWith(5000);
  const results = await Promise.allSettled([
    redeemGiftCard(store, { code: 'GC-7Q2M', amountCents: 4000, orderId: 'o-61377' }),
    redeemGiftCard(store, { code: 'GC-7Q2M', amountCents: 4000, orderId: 'o-61378' }),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1, 'exactly one redemption succeeds');
  const refused = results.find((r) => r.status === 'rejected');
  assert.match(String(refused?.reason?.message), /insufficient balance/);
  assert.equal(await getBalance(store, 'GC-7Q2M'), 1000);
  assert.equal((await kinds(store, 'GC-7Q2M', 'redeem')).length, 1);
});

test('three €20 orders at once on a €50 card: two are paid and both show in the history', async () => {
  const store = await cardWith(5000);
  const results = await Promise.allSettled(
    ['o-1', 'o-2', 'o-3'].map((orderId) => redeemGiftCard(store, { code: 'GC-7Q2M', amountCents: 2000, orderId })),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 2);
  assert.equal(await getBalance(store, 'GC-7Q2M'), 1000);
  assert.equal((await kinds(store, 'GC-7Q2M', 'redeem')).length, 2);
});

test('a refund credited while the card is being used is not lost', async () => {
  const store = await cardWith(5000);
  await Promise.all([
    redeemGiftCard(store, { code: 'GC-7Q2M', amountCents: 4000, orderId: 'o-2' }),
    creditGiftCard(store, { code: 'GC-7Q2M', amountCents: 2000, ref: 'o-1' }),
  ]);
  assert.equal(await getBalance(store, 'GC-7Q2M'), 3000);
  assert.equal((await kinds(store, 'GC-7Q2M', 'redeem')).length, 1);
  assert.equal((await kinds(store, 'GC-7Q2M', 'credit')).length, 1);
});

test('two refunds credited at once both land', async () => {
  const store = await cardWith(5000);
  await Promise.all([
    creditGiftCard(store, { code: 'GC-7Q2M', amountCents: 1000, ref: 'o-1' }),
    creditGiftCard(store, { code: 'GC-7Q2M', amountCents: 1500, ref: 'o-2' }),
  ]);
  assert.equal(await getBalance(store, 'GC-7Q2M'), 7500);
});

test('the nightly cancellation and a new order on the same card at once', async () => {
  const stores = { cards: await cardWith(6000, 'GC-H4NA'), orders: createOrderStore() };
  const old = await placeOrder(stores, { customerId: 'c-1', totalCents: 1000, giftCard: 'GC-H4NA' });
  const [fresh] = await Promise.all([
    placeOrder(stores, { customerId: 'c-1', totalCents: 4000, giftCard: 'GC-H4NA' }),
    cancelOrder(stores, old.id),
  ]);
  assert.equal(fresh.status, 'paid');
  assert.equal(await getBalance(stores.cards, 'GC-H4NA'), 2000);
});

test('different cards do not wait on each other and stay correct', async () => {
  const store = await cardWith(5000, 'GC-AAAA');
  await issueGiftCard(store, { code: 'GC-BBBB', amountCents: 3000, ref: 'sale-2' });
  await Promise.all([
    redeemGiftCard(store, { code: 'GC-AAAA', amountCents: 500, orderId: 'o-1' }),
    redeemGiftCard(store, { code: 'GC-BBBB', amountCents: 700, orderId: 'o-2' }),
    redeemGiftCard(store, { code: 'GC-AAAA', amountCents: 500, orderId: 'o-3' }),
  ]);
  assert.equal(await getBalance(store, 'GC-AAAA'), 4000);
  assert.equal(await getBalance(store, 'GC-BBBB'), 2300);
});

test('a refused redemption does not block the card for the next one', async () => {
  const store = await cardWith(1000);
  await assert.rejects(redeemGiftCard(store, { code: 'GC-7Q2M', amountCents: 5000, orderId: 'o-1' }), /insufficient balance/);
  await redeemGiftCard(store, { code: 'GC-7Q2M', amountCents: 1000, orderId: 'o-2' });
  assert.equal(await getBalance(store, 'GC-7Q2M'), 0);
});
