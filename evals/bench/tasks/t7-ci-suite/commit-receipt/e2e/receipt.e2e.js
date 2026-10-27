import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReceipt } from '../src/receipt.js';

test('prints a counter receipt', () => {
  const receipt = renderReceipt([{ name: 'Tea', cents: 450 }, { name: 'Cake', cents: 800 }]);
  assert.equal(receipt, ['Tea       CHF 4.50', 'Cake      CHF 8.00', 'TOTAL     CHF 12.50'].join('\n'));
});
