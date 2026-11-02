import test from 'node:test';
import assert from 'node:assert/strict';
import { assessRisk, pathWords } from '../src/core/risk-engine.js';

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
  const paths = ['src/billing/refunds.ts', 'app/payments/views.py', 'src/services/processPayment.ts', 'lib/stripe_webhook.rb',
    'src/Checkout.tsx', 'internal/invoice/pdf.go', 'src/APIPayment.ts', 'src/v2Payment.ts', 'PAYMENT/x.ts', 'src/my payment/x.ts',
    'src/chargeback.ts', 'src/orders/refunded.ts'];
  for (const path of paths) {
    const result = assessRisk([{ status: 'M', path }]);
    assert.ok(result.signals.some((signal) => signal.code === 'payments'), path);
    assert.notEqual(result.level, 'low', path);
  }
});

test('password, encryption and signing code is at least medium risk', () => {
  const paths = ['pkg/crypto/aes.go', 'src/utils/encrypt.js', 'app/signing/keys.py', 'lib/HMAC.ts', 'src/KMSClient.ts',
    'src/BCryptHasher.cs', 'src/resetPassword.ts', 'src/sign/verifySignature.ts', 'src/passwordless/login.ts'];
  for (const path of paths) {
    const result = assessRisk([{ status: 'M', path }]);
    assert.ok(result.signals.some((signal) => signal.code === 'crypto'), path);
    assert.notEqual(result.level, 'low', path);
  }
});

test('a password file under auth/ counts once, as auth (review finding)', () => {
  const result = assessRisk([{ status: 'M', path: 'src/auth/password-reset.ts' }]);
  assert.deepEqual(result.signals.map((signal) => signal.code), ['auth']);
  assert.equal(result.level, 'medium');
});

test('words that only contain those terms do not count (no false positives)', () => {
  const paths = ['src/utils/rehashing.ts', 'src/discharge.ts', 'src/battery/charge.ts', 'src/ev/ChargeLevel.tsx',
    'src/surcharges-banner.css', 'src/checkouts-ui/list.ts', 'src/designing.ts', 'src/hashmap.ts', 'src/paymentsheet.ts'];
  for (const path of paths) {
    const result = assessRisk([{ status: 'M', path }]);
    assert.ok(!result.signals.some((signal) => signal.code === 'payments' || signal.code === 'crypto'), path);
  }
});

test('path words split on separators, spaces, camelCase and acronyms', () => {
  assert.deepEqual([...pathWords('src/APIPayment.ts')], ['src', 'api', 'payment', 'ts']);
  assert.deepEqual([...pathWords('lib/HMAC_v2.ts')], ['lib', 'hmac', 'v2', 'ts']);
  assert.deepEqual([...pathWords('My Billing/argon2Hash.py')], ['my', 'billing', 'argon2', 'hash', 'py']);
});
