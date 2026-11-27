import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLanguage } from '../src/i18n.js';

test('resolves base language from any locale shape', () => {
  assert.equal(resolveLanguage('pt-BR'), 'pt');
  assert.equal(resolveLanguage('pt_BR'), 'pt');
  assert.equal(resolveLanguage('FR'), 'fr');
  assert.equal(resolveLanguage('de-CH'), 'de');
});

test('falls back to English', () => {
  assert.equal(resolveLanguage('ja-JP'), 'en');
  assert.equal(resolveLanguage(''), 'en');
  assert.equal(resolveLanguage(undefined), 'en');
});
