import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocStore } from '../src/settings/store.js';
import { loadPreferences, savePreferences } from '../src/settings/preferences.js';
import { patchPreferences } from '../src/api/account.js';
import { smsRecipients } from '../src/notify/sms.js';
import { shouldEmail } from '../src/notify/email.js';

test('a customer without saved preferences gets the defaults', () => {
  const store = createDocStore();
  assert.deepEqual(loadPreferences(store, 'u-1'), { language: 'de', theme: 'system', newsletter: false, notify: { email: true, sms: true } });
});

test('saving changes only the fields sent', () => {
  const store = createDocStore();
  savePreferences(store, 'u-1', { notify: { sms: false } });
  const prefs = savePreferences(store, 'u-1', { language: 'fr' });
  assert.equal(prefs.language, 'fr');
  assert.deepEqual(prefs.notify, { email: true, sms: false });
  assert.deepEqual(smsRecipients(store, [{ id: 'u-1', phone: '+41790000001' }, { id: 'u-2', phone: '+41790000002' }]), ['+41790000002']);
  assert.equal(shouldEmail(store, 'u-1', 'order'), true);
});

test('the API rejects unknown fields and values', () => {
  const store = createDocStore();
  assert.equal(patchPreferences(store, 'u-1', { language: 'es' }).status, 400);
  assert.equal(patchPreferences(store, 'u-1', { role: 'admin' }).status, 400);
  assert.equal(patchPreferences(store, 'u-1', { notify: { fax: true } }).status, 400);
  assert.equal(patchPreferences(store, 'u-1', { theme: 'dark' }).body.theme, 'dark');
});
