import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocStore } from '../src/settings/store.js';
import { loadPreferences, savePreferences } from '../src/settings/preferences.js';
import { setPushEnabled, shouldPush } from '../src/settings/push.js';
import { patchPreferences } from '../src/api/account.js';
import { smsRecipients } from '../src/notify/sms.js';
import { shouldEmail } from '../src/notify/email.js';
import { settingsForm } from '../src/web/settings-page.js';

test('a customer without saved preferences gets the defaults', () => {
  const store = createDocStore();
  assert.deepEqual(loadPreferences(store, 'u-1'), { language: 'de', theme: 'system', newsletter: false, channels: { email: true, sms: true, push: false } });
});

test('saving changes only the fields sent', () => {
  const store = createDocStore();
  savePreferences(store, 'u-1', { channels: { sms: false } });
  const prefs = savePreferences(store, 'u-1', { language: 'fr' });
  assert.equal(prefs.language, 'fr');
  assert.deepEqual(prefs.channels, { email: true, sms: false, push: false });
  assert.deepEqual(smsRecipients(store, [{ id: 'u-1', phone: '+41790000001' }, { id: 'u-2', phone: '+41790000002' }]), ['+41790000002']);
  assert.equal(shouldEmail(store, 'u-1', 'order'), true);
  assert.equal(shouldEmail(store, 'u-1', 'newsletter'), false);
});

test('the app turns push notifications on and off', () => {
  const store = createDocStore();
  savePreferences(store, 'u-1', { channels: { email: false } });
  setPushEnabled(store, 'u-1', true);
  assert.equal(shouldPush(store, 'u-1'), true);
  assert.deepEqual(settingsForm(store, 'u-1').notifications.map((n) => `${n.name}:${n.checked}`), ['email:false', 'sms:true', 'push:true']);
  setPushEnabled(store, 'u-1', false);
  assert.equal(shouldPush(store, 'u-1'), false);
});

test('the API rejects unknown fields and values', () => {
  const store = createDocStore();
  assert.equal(patchPreferences(store, 'u-1', { language: 'es' }).status, 400);
  assert.equal(patchPreferences(store, 'u-1', { role: 'admin' }).status, 400);
  assert.equal(patchPreferences(store, 'u-1', { channels: { fax: true } }).status, 400);
  assert.equal(patchPreferences(store, 'u-1', { channels: { push: 'yes' } }).status, 400);
  assert.equal(patchPreferences(store, 'u-1', { theme: 'dark' }).body.theme, 'dark');
});
