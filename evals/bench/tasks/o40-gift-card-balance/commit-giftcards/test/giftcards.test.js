import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileBackend } from '../src/giftcards/backend.js';
import { createGiftCardStore } from '../src/giftcards/store.js';
import { blockGiftCard, getBalance, issueGiftCard, normalizeCode } from '../src/giftcards/cards.js';
import { redeemGiftCard } from '../src/giftcards/redeem.js';
import { creditGiftCard } from '../src/giftcards/credit.js';
import { formatEuros, statementLines } from '../src/giftcards/statement.js';
import { createOrderStore } from '../src/orders/store.js';
import { placeOrder } from '../src/orders/checkout.js';
import { cancelOrder } from '../src/orders/cancel.js';

const at = (iso) => () => new Date(iso);

test('codes are normalised', () => {
  assert.equal(normalizeCode(' gc-7q2m '), 'GC-7Q2M');
  assert.throws(() => normalizeCode('7Q2M'), /invalid gift card code/);
});

test('a card is redeemed until it runs out', async () => {
  const store = createGiftCardStore();
  await issueGiftCard(store, { code: 'GC-7Q2M', amountCents: 5000, ref: 'sale-1' });
  const first = await redeemGiftCard(store, { code: 'GC-7Q2M', amountCents: 4000, orderId: 'o-1' });
  assert.deepEqual(first, { code: 'GC-7Q2M', redeemedCents: 4000, balanceCents: 1000 });
  await assert.rejects(redeemGiftCard(store, { code: 'GC-7Q2M', amountCents: 4000, orderId: 'o-2' }), /insufficient balance/);
  assert.equal(await getBalance(store, 'GC-7Q2M'), 1000);
});

test('blocked cards cannot pay but can be credited', async () => {
  const store = createGiftCardStore();
  await issueGiftCard(store, { code: 'GC-B10K', amountCents: 2000, ref: 'sale-2' });
  await blockGiftCard(store, 'GC-B10K');
  await assert.rejects(redeemGiftCard(store, { code: 'GC-B10K', amountCents: 100, orderId: 'o-3' }), /blocked/);
  const credited = await creditGiftCard(store, { code: 'GC-B10K', amountCents: 500, ref: 'o-0' });
  assert.equal(credited.balanceCents, 2500);
});

test('cancelling an order puts the money back on the card', async () => {
  const stores = { cards: createGiftCardStore(), orders: createOrderStore() };
  await issueGiftCard(stores.cards, { code: 'GC-ABCD', amountCents: 5000, ref: 'sale-3' });
  const order = await placeOrder(stores, { customerId: 'c-1', totalCents: 3250, giftCard: 'gc-abcd' });
  assert.equal(order.status, 'paid');
  assert.equal(await getBalance(stores.cards, 'GC-ABCD'), 1750);
  await cancelOrder(stores, order.id);
  await cancelOrder(stores, order.id);
  assert.equal(await getBalance(stores.cards, 'GC-ABCD'), 5000);
});

test('statement lines, newest first', async () => {
  const store = createGiftCardStore();
  await issueGiftCard(store, { code: 'GC-S7AT', amountCents: 10000, ref: 'sale-4' }, at('2026-10-01T10:00:00Z'));
  await redeemGiftCard(store, { code: 'GC-S7AT', amountCents: 2599, orderId: 'o-50211' }, at('2026-10-03T10:00:00Z'));
  const lines = statementLines(/** @type {any} */ (await store.get('GC-S7AT')));
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^2026-10-03 {2}Order +o-50211 +-€25\.99$/);
  assert.equal(formatEuros(123456), '€1,234.56');
});

test('the file backend keeps cards between restarts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gc-'));
  try {
    const path = join(dir, 'giftcards.json');
    await issueGiftCard(createGiftCardStore(fileBackend(path)), { code: 'GC-F1LE', amountCents: 700, ref: 'sale-5' });
    const reopened = createGiftCardStore(fileBackend(path));
    assert.equal(await getBalance(reopened, 'GC-F1LE'), 700);
    assert.equal((await reopened.list()).length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
