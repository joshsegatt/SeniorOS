import { NotFoundError } from './errors.js';

// The packing slip goes in the parcel and a copy is sent to the carrier.
// Order is by `position`; cancelled lines (qty 0) are left out (ADR-009).
export function packingSlipLines(store, shipmentId) {
  if (!store.getShipment(shipmentId)) throw new NotFoundError(`shipment ${shipmentId}`);
  return store
    .linesFor(shipmentId)
    .filter((l) => l.qty > 0)
    .sort((a, b) => a.position - b.position);
}

export function renderPackingSlip(store, shipmentId) {
  const s = store.getShipment(shipmentId);
  const lines = packingSlipLines(store, shipmentId);
  return [
    `Packing slip ${s.id} — ${s.customer}`,
    ...lines.map((l, i) => `${i + 1}. ${l.sku} x${l.qty} ${l.description}`),
  ].join('\n');
}
