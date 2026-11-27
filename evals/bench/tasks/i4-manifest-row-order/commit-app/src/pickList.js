import { packingSlipLines } from './packingSlip.js';
import { lineWeightKg, formatKg } from './weights.js';

// Dock pick list (ADR-011): heaviest line first so heavy goods are loaded at
// the bottom. Internal document, never sent to the carrier.
export function pickList(store, shipmentId) {
  return packingSlipLines(store, shipmentId)
    .map((l) => ({ sku: l.sku, qty: l.qty, weightKg: formatKg(lineWeightKg(l)), position: l.position }))
    .sort((a, b) => Number(b.weightKg) - Number(a.weightKg) || a.position - b.position);
}
