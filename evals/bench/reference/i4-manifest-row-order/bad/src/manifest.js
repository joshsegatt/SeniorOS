import { packingSlipLines } from './packingSlip.js';
import { toCsv } from './csv.js';
import { lineWeightKg, formatKg } from './weights.js';

// Carrier manifest CSV — ticket SHIP-214, implemented literally:
// same lines as the packing slip, sorted heaviest first (requirement 3).
export function buildManifestCsv(store, shipmentId) {
  const rows = packingSlipLines(store, shipmentId)
    .sort((a, b) => lineWeightKg(b) - lineWeightKg(a))
    .map((l) => [l.sku, l.description, l.qty, formatKg(lineWeightKg(l))]);
  return toCsv(['sku', 'description', 'qty', 'weight_kg'], rows);
}
