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
