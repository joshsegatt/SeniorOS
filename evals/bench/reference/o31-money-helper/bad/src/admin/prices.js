import { toCents } from '../lib/money.js';

/** Saves the price form of the admin product page; form fields arrive as the browser posts them. */
export function savePriceForm(products, id, form) {
  const product = products.get(id);
  if (!product) throw new RangeError(`no product ${id}`);
  const priceCents = toCents(form.price);
  const compareAtCents = toCents(form.compareAt) || null;
  if (priceCents <= 0) throw new RangeError('the price must be positive');
  if (compareAtCents !== null && compareAtCents <= priceCents) throw new RangeError('the compare-at price must be higher than the price');
  Object.assign(product, { priceCents, compareAtCents });
  return { ...product };
}
