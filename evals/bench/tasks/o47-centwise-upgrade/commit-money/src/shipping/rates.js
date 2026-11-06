/** Shipping price in cents by zone and parcel weight (grams). Free above the threshold. */
const TABLE = {
  domestic: [[2000, 495], [10000, 695], [Infinity, 1195]],
  eu: [[2000, 995], [10000, 1495], [Infinity, 2495]],
};
const FREE_ABOVE_CENTS = 7500;

export function shippingFor(zone, grams, subtotalCents) {
  const rows = TABLE[zone];
  if (!rows) throw new RangeError(`unknown zone "${zone}"`);
  if (zone === 'domestic' && subtotalCents >= FREE_ABOVE_CENTS) return 0;
  return rows.find(([max]) => grams <= max)[1];
}
