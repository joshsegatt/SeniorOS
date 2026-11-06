/** @typedef {import('./store.js').GiftCard} GiftCard */

/** @param {number} cents */
export function formatEuros(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}€${euros}.${String(abs % 100).padStart(2, '0')}`;
}

const LABELS = { issue: 'Card issued', redeem: 'Order', credit: 'Refund' };

/**
 * The lines of the card history shown in the customer account, newest first.
 * @param {GiftCard} card
 */
export function statementLines(card) {
  return [...card.history]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((e) => `${e.at.slice(0, 10)}  ${LABELS[e.kind].padEnd(11)} ${e.ref.padEnd(10)} ${formatEuros(e.amountCents).padStart(10)}`);
}
