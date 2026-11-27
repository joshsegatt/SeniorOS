export function lineWeightKg(line) {
  return line.qty * line.unitWeightKg;
}

// ADR-004: kilograms, three decimals.
export function formatKg(kg) {
  return (Math.round(kg * 1000) / 1000).toFixed(3);
}
