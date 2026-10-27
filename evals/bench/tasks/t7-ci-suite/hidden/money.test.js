import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney } from '../../src/money.js';
import { renderReceipt } from '../../src/receipt.js';

test('the currency comes after the amount', () => {
  assert.equal(formatMoney(1250), '12.50 CHF');
  assert.equal(formatMoney(5), '0.05 CHF');
  assert.equal(formatMoney(990, 'EUR'), '9.90 EUR');
});

test('receipts use the new format', () => {
  assert.match(renderReceipt([{ name: 'Tea', cents: 450 }]), /^Tea +4\.50 CHF\nTOTAL +4\.50 CHF$/);
});
