/** Weight of the physical items in a set of resolved lines. Digital items weigh nothing. */
export function shippableGrams(lines) {
  return lines.reduce((grams, { item, qty }) => grams + (item.digital ? 0 : item.weightGrams * qty), 0);
}

/** Shipping price in cents (Swiss Post tiers, one consignment). */
export function quoteShipping(lines) {
  const grams = shippableGrams(lines);
  if (grams === 0) return 0;
  if (grams <= 2000) return 700;
  if (grams <= 10000) return 1200;
  return 2500;
}
