import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/store.js';
import { buildManifestCsv } from '../../src/manifest.js';
import { packingSlipLines } from '../../src/packingSlip.js';
import { pickList } from '../../src/pickList.js';
import { NotFoundError } from '../../src/errors.js';

// Insertion order, position order and weight order are all different here.
function seed() {
  return createStore({
    shipments: [
      { id: 'SH-2001', customer: 'Carrelages Favre', carrier: 'planzer' },
      { id: 'SH-2002', customer: 'Empty Ltd', carrier: 'planzer' },
    ],
    lines: [
      { shipmentId: 'SH-2001', position: 3, sku: 'A-PALLET', description: 'Pallet wrap', qty: 1, unitWeightKg: 22.5 },
      { shipmentId: 'SH-2001', position: 1, sku: 'B-SCREWS', description: 'Screws, 4x40 "Torx"', qty: 5, unitWeightKg: 0.2 },
      { shipmentId: 'SH-2001', position: 4, sku: 'C-CANCEL', description: 'Cancelled mortar', qty: 0, unitWeightKg: 50 },
      { shipmentId: 'SH-2001', position: 2, sku: 'D-TILES', description: 'Floor tiles 30x30', qty: 12, unitWeightKg: 1.85 },
      { shipmentId: 'SH-2001', position: 5, sku: 'E-GLUE', description: 'Tile glue', qty: 3, unitWeightKg: 1.1 },
      { shipmentId: 'SH-2002', position: 1, sku: 'Z-ONLY', description: 'Cancelled', qty: 0, unitWeightKg: 1 },
    ],
  });
}

function rows(csv) {
  return csv.replace(/\r\n/g, '\n').trimEnd().split('\n');
}

test('ADR-012: manifest rows are in packing slip order, not heaviest first', () => {
  const store = seed();
  const skus = rows(buildManifestCsv(store, 'SH-2001')).slice(1).map((r) => r.split(',')[0]);
  assert.deepEqual(skus, packingSlipLines(store, 'SH-2001').map((l) => l.sku));
  assert.deepEqual(skus, ['B-SCREWS', 'D-TILES', 'A-PALLET', 'E-GLUE']);
});

test('manifest content: header, quoting, kg with three decimals', () => {
  assert.deepEqual(rows(buildManifestCsv(seed(), 'SH-2001')), [
    'sku,description,qty,weight_kg',
    'B-SCREWS,"Screws, 4x40 ""Torx""",5,1.000',
    'D-TILES,Floor tiles 30x30,12,22.200',
    'A-PALLET,Pallet wrap,1,22.500',
    'E-GLUE,Tile glue,3,3.300',
  ]);
});

test('cancelled lines are never exported', () => {
  const store = seed();
  assert.doesNotMatch(buildManifestCsv(store, 'SH-2001'), /C-CANCEL/);
  assert.deepEqual(rows(buildManifestCsv(store, 'SH-2002')), ['sku,description,qty,weight_kg']);
});

test('unknown shipment throws NotFoundError', () => {
  assert.throws(() => buildManifestCsv(seed(), 'SH-404'), NotFoundError);
});

test('dock pick list still lists the heaviest line first', () => {
  assert.deepEqual(pickList(seed(), 'SH-2001').map((l) => l.sku), ['A-PALLET', 'D-TILES', 'E-GLUE', 'B-SCREWS']);
});
