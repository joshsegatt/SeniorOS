import test from 'node:test';
import assert from 'node:assert/strict';
import { assessRisk } from '../src/core/risk-engine.js';

test('text-only change remains low risk', () => {
  const result = assessRisk([{ status: 'M', path: 'README.md' }]);
  assert.equal(result.level, 'low');
  assert.equal(result.score, 0);
});

test('auth plus migration becomes high or critical', () => {
  const result = assessRisk([
    { status: 'M', path: 'src/auth/session.ts' },
    { status: 'A', path: 'migrations/004_add_sessions.sql' }
  ]);
  assert.ok(['high', 'critical'].includes(result.level));
  assert.ok(result.score >= 6);
});

test('secret surface is treated as high risk', () => {
  const result = assessRisk([{ status: 'M', path: '.env.production' }]);
  assert.equal(result.level, 'high');
  assert.ok(result.signals.some((signal) => signal.code === 'secrets'));
});

test('payment, billing and refund code is at least medium risk', () => {
  for (const path of ['src/billing/refunds.ts', 'app/payments/views.py', 'src/services/processPayment.ts', 'lib/stripe_webhook.rb', 'src/Checkout.tsx', 'internal/invoice/pdf.go']) {
    const result = assessRisk([{ status: 'M', path }]);
    assert.ok(result.signals.some((signal) => signal.code === 'payments'), path);
    assert.notEqual(result.level, 'low', path);
  }
});

test('password, encryption and signing code is at least medium risk', () => {
  for (const path of ['src/auth/password-reset.ts', 'pkg/crypto/aes.go', 'src/utils/encrypt.js', 'app/signing/keys.py', 'lib/hmac.ts', 'src/resetPassword.ts']) {
    const result = assessRisk([{ status: 'M', path }]);
    assert.ok(result.signals.some((signal) => signal.code === 'crypto'), path);
    assert.notEqual(result.level, 'low', path);
  }
});

test('words that only contain those terms do not count (no false positives)', () => {
  for (const path of ['src/utils/rehashing.ts', 'src/discharge.ts', 'docs/encrypted-at-rest-faq.md', 'src/surcharges-banner.css', 'src/checkouts-ui/list.ts', 'src/designing.ts', 'src/hashmap.ts']) {
    const result = assessRisk([{ status: 'M', path }]);
    assert.ok(!result.signals.some((signal) => signal.code === 'payments' || signal.code === 'crypto'), path);
  }
});
