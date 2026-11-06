import test from 'node:test';
import assert from 'node:assert/strict';
import { createGiftCardStore } from '../../src/giftcards/store.js';
import { blockGiftCard, issueGiftCard } from '../../src/giftcards/cards.js';
import { redeemGiftCard } from '../../src/giftcards/redeem.js';

test('blocking a card while it is being used keeps both the block and the balance', async () => {
  const store = createGiftCardStore();
  await issueGiftCard(store, { code: 'GC-7Q2M', amountCents: 5000, ref: 'sale-1' });
  const [redeemed] = await Promise.allSettled([
    redeemGiftCard(store, { code: 'GC-7Q2M', amountCents: 4000, orderId: 'o-1' }),
    blockGiftCard(store, 'GC-7Q2M'),
  ]);
  const card = await store.get('GC-7Q2M');
  assert.equal(card.status, 'blocked');
  assert.equal(card.balanceCents, redeemed.status === 'fulfilled' ? 1000 : 5000);
});
