import { packingSlipLines } from './packingSlip.js';
import { toCsv } from './csv.js';
import { lineWeightKg, formatKg } from './weights.js';

// Carrier manifest CSV — ticket SHIP-214.
// Row order is the packing slip order (ADR-012): the carrier reconciles by
// row sequence. Heavy-first loading is served by the pick list (ADR-011).
export function buildManifestCsv(store, shipmentId) {
  const rows = packingSlipLines(store, shipmentId).map((l) => [
    l.sku,
    l.description,
    l.qty,
    formatKg(lineWeightKg(l)),
  ]);
  return toCsv(['sku', 'description', 'qty', 'weight_kg'], rows);
}
