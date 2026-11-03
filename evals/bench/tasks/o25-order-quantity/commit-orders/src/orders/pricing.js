export const VAT_RATE = 0.2;
export const FREE_SHIPPING_FROM = 5000;
export const SHIPPING_CENTS = 490;

/** Totals in cents for order lines ({ qty, unitCents }); unit prices exclude VAT. */
export function priceLines(lines) {
  const subtotalCents = lines.reduce((sum, l) => sum + l.qty * l.unitCents, 0);
  const shippingCents = subtotalCents >= FREE_SHIPPING_FROM ? 0 : SHIPPING_CENTS;
  const vatCents = Math.round((subtotalCents + shippingCents) * VAT_RATE);
  return { subtotalCents, shippingCents, vatCents, totalCents: subtotalCents + shippingCents + vatCents };
}
