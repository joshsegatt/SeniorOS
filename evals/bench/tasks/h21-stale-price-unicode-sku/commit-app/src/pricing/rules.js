// Gross shelf price = net + VAT, rounded to 5 Rappen (Swiss cash rounding).

export function roundTo5(cents) {
  return Math.round(cents / 5) * 5;
}

export function computeGross(product) {
  const exact = (product.netCents * (1000 + product.vatPermille)) / 1000;
  return roundTo5(exact);
}
