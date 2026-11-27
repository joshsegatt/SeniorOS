// Demo data used by the visible tests and local experiments.
export const sampleSeed = {
  shipments: [
    { id: 'SH-1001', customer: 'Boulangerie Rochat', carrier: 'planzer' },
    { id: 'SH-1002', customer: 'Garage du Lac', carrier: 'planzer' },
  ],
  lines: [
    { shipmentId: 'SH-1001', position: 2, sku: 'FLR-25', description: 'Flour T65 25kg', qty: 4, unitWeightKg: 25 },
    { shipmentId: 'SH-1001', position: 1, sku: 'YST-01', description: 'Dry yeast', qty: 10, unitWeightKg: 0.5 },
    { shipmentId: 'SH-1001', position: 3, sku: 'BOX-S', description: 'Pastry boxes, small', qty: 200, unitWeightKg: 0.04 },
    { shipmentId: 'SH-1002', position: 1, sku: 'OIL-5W', description: 'Engine oil 5W-30 "Pro"', qty: 6, unitWeightKg: 4.6 },
    { shipmentId: 'SH-1002', position: 2, sku: 'FLT-09', description: 'Oil filter', qty: 0, unitWeightKg: 0.35 },
  ],
};
