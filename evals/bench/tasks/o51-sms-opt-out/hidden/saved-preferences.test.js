import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDocs } from '../../src/settings/store.js';
import { loadPreferences, savePreferences } from '../../src/settings/preferences.js';
import { setPushEnabled, shouldPush } from '../../src/settings/push.js';
import { patchPreferences } from '../../src/api/account.js';
import { smsRecipients } from '../../src/notify/sms.js';
import { shouldEmail } from '../../src/notify/email.js';
import { settingsForm } from '../../src/web/settings-page.js';

/** Documents as they are in production: saved before the rename (notify), after it (channels), or by the app on an old one (both). */
function production() {
  return loadDocs({
    'u-old': { language: 'fr', theme: 'dark', newsletter: true, notify: { email: false, sms: false } },
    'u-new': { language: 'en', theme: 'light', newsletter: false, channels: { email: true, sms: false, push: true } },
    'u-both': { language: 'de', theme: 'system', newsletter: false, notify: { email: false, sms: false }, channels: { push: true } },
  });
}

const sms = (store, id) => smsRecipients(store, [{ id, phone: '+41790000009' }]).length === 1;
const boxes = (store, id) => settingsForm(store, id).notifications.map((n) => `${n.name}:${n.checked}`);

test('documents saved before the rename keep their choices', () => {
  const store = production();
  assert.equal(sms(store, 'u-old'), false);
  assert.equal(shouldEmail(store, 'u-old', 'order'), false);
  assert.equal(shouldEmail(store, 'u-old', 'newsletter'), true);
  assert.deepEqual(boxes(store, 'u-old'), ['email:false', 'sms:false', 'push:false']);
});

test('documents saved after the rename are read as saved', () => {
  const store = production();
  assert.equal(sms(store, 'u-new'), false);
  assert.equal(shouldPush(store, 'u-new'), true);
  assert.deepEqual(boxes(store, 'u-new'), ['email:true', 'sms:false', 'push:true']);
});

test('an old document the app turned push on for keeps its email and SMS choices', () => {
  const store = production();
  assert.equal(sms(store, 'u-both'), false);
  assert.equal(shouldEmail(store, 'u-both', 'order'), false);
  assert.equal(shouldPush(store, 'u-both'), true);
  assert.deepEqual(boxes(store, 'u-both'), ['email:false', 'sms:false', 'push:true']);
});

test('the reported case: changing the language keeps the SMS opt-out, saved under the new key only', () => {
  const store = production();
  savePreferences(store, 'u-old', { language: 'it' });
  assert.equal(sms(store, 'u-old'), false);
  assert.equal(shouldEmail(store, 'u-old', 'order'), false);
  assert.equal(loadPreferences(store, 'u-old').language, 'it');
  const doc = store.get('u-old');
  assert.ok(!('notify' in doc), `old key still written: ${JSON.stringify(doc)}`);
  assert.equal(doc.channels.sms, false);
  assert.equal(doc.channels.email, false);
});

test('saving a document that has both keys keeps every choice', () => {
  const store = production();
  savePreferences(store, 'u-both', { theme: 'dark' });
  assert.deepEqual(loadPreferences(store, 'u-both').channels, { email: false, sms: false, push: true });
  const doc = store.get('u-both');
  assert.ok(!('notify' in doc), `old key still written: ${JSON.stringify(doc)}`);
  assert.equal(doc.channels.sms, false);
  assert.equal(doc.channels.push, true);
});

test('turning push on for an old document, then saving, keeps email and SMS off', () => {
  const store = production();
  setPushEnabled(store, 'u-old', true);
  assert.equal(sms(store, 'u-old'), false);
  assert.equal(shouldPush(store, 'u-old'), true);
  savePreferences(store, 'u-old', { newsletter: false });
  assert.deepEqual(loadPreferences(store, 'u-old'), { language: 'fr', theme: 'dark', newsletter: false, channels: { email: false, sms: false, push: true } });
  assert.ok(!('notify' in store.get('u-old')));
});

test('switching one channel from the app keeps the others from the old document', () => {
  const store = production();
  const res = patchPreferences(store, 'u-old', { channels: { sms: true } });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.channels, { email: false, sms: true, push: false });
  assert.equal(sms(store, 'u-old'), true);
  assert.equal(shouldEmail(store, 'u-old', 'order'), false);
});

test('saving what was loaded changes nothing, whatever the shape of the document', () => {
  const store = production();
  for (const id of ['u-old', 'u-new', 'u-both']) {
    const before = loadPreferences(store, id);
    savePreferences(store, id, before);
    savePreferences(store, id, loadPreferences(store, id));
    assert.deepEqual(loadPreferences(store, id), before, id);
    assert.ok(!('notify' in store.get(id)), id);
  }
});
