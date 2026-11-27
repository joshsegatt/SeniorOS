import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/config.js';
import { CONFIG } from './helpers.js';

test('config is validated and frozen', () => {
  const cfg = loadConfig(CONFIG);
  assert.equal(cfg.loyalty.pointsPerChf, 1);
  assert.ok(Object.isFrozen(cfg.mail));
  assert.throws(() => loadConfig({ ...CONFIG, mail: { from: 'nope' } }), /mail.from/);
  assert.throws(() => loadConfig({ ...CONFIG, webhooks: { urls: ['http://plain'] } }), /https/);
});

test('reload swaps the running config', () => {
  const app = createApp(CONFIG);
  app.reloadConfig({ ...CONFIG, version: 'test-2', loyalty: { pointsPerChf: 3 } });
  assert.equal(app.config.version, 'test-2');
  assert.equal(app.config.loyalty.pointsPerChf, 3);
  assert.ok(app.logs.includes('config reloaded (version test-2)'));
});

test('an invalid reload from the watcher is rejected and logged', () => {
  const app = createApp(CONFIG);
  let listener;
  app.watchConfig({ on: (_event, fn) => (listener = fn) });
  listener({ ...CONFIG, smtp: {} });
  assert.equal(app.config.version, 'test-1');
  assert.ok(app.logs.some((l) => /config reload rejected: invalid config: smtp.host/.test(l)));
});
