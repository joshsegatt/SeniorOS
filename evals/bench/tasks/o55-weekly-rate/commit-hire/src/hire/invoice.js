/** 144000 -> "CHF 1'440.00" (Swiss thousands separator) */
export function formatChf(cents) {
  if (!Number.isInteger(cents)) throw new Error(`not a whole number of centimes: ${cents}`);
  const abs = Math.abs(cents);
  const francs = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${cents < 0 ? '-' : ''}CHF ${francs}.${String(abs % 100).padStart(2, '0')}`;
}

/** Invoice lines for a quote; the deposit is shown but is not part of the total. */
export function invoiceLines(item, q) {
  const lines = [{ description: `${item.name}, ${q.days} hire day${q.days === 1 ? '' : 's'} (${q.pickupDay} to ${q.returnDay})`, amountCents: q.hireCents }];
  if (q.waiverCents) lines.push({ description: 'Damage waiver', amountCents: q.waiverCents });
  return { lines, totalCents: lines.reduce((s, l) => s + l.amountCents, 0), depositCents: q.depositCents };
}
