import test from 'node:test';
import assert from 'node:assert/strict';
import { createUserStore } from '../../src/users.js';
import { createInviteStore } from '../../src/invites.js';
import { createMemoryMailer } from '../../src/mail/memoryMailer.js';
import { TEMPLATES } from '../../src/mail/templates.js';
import { signupWithEmail } from '../../src/signup/emailSignup.js';
import { acceptInvite } from '../../src/signup/inviteSignup.js';
import { signupWithSso } from '../../src/signup/ssoSignup.js';

function deps(invites = []) {
  return { users: createUserStore(), mailer: createMemoryMailer(), invites: createInviteStore(invites) };
}

function assertWelcome(mailer, to, lang) {
  assert.equal(mailer.sent.length, 1, 'exactly one welcome email');
  const [msg] = mailer.sent;
  assert.equal(msg.to, to.toLowerCase());
  assert.equal(msg.lang, lang);
  assert.equal(msg.subject, TEMPLATES[lang].subject);
}

test('email signup: welcome email in the language picked on the form', () => {
  for (const [locale, lang] of [['fr', 'fr'], ['de', 'de'], ['pt', 'pt']]) {
    const d = deps();
    signupWithEmail(d, { email: `u-${locale}@example.com`, name: 'U', password: 'longenough', locale });
    assertWelcome(d.mailer, `u-${locale}@example.com`, lang);
  }
});

test('email signup without a locale falls back to English', () => {
  const d = deps();
  signupWithEmail(d, { email: 'x@example.com', name: 'X', password: 'longenough' });
  assertWelcome(d.mailer, 'x@example.com', 'en');
});

test('invite signup: regional locales resolve to their language', () => {
  for (const [locale, lang] of [['de-CH', 'de'], ['pt-BR', 'pt'], ['fr-CH', 'fr']]) {
    const d = deps([{ token: `t-${locale}`, email: `inv-${locale}@acme.ch`, locale, team: 'ops' }]);
    const user = acceptInvite(d, { token: `t-${locale}`, name: 'Inv' });
    assertWelcome(d.mailer, `inv-${locale}@acme.ch`, lang);
    assert.equal(user.locale, locale, 'stored locale stays raw (docs/signup.md)');
  }
});

test('sso signup: POSIX and upper-case locale claims resolve to their language', () => {
  for (const [locale, lang] of [['pt_BR', 'pt'], ['de_DE', 'de'], ['FR', 'fr']]) {
    const d = deps();
    signupWithSso(d, { email: `sso-${locale}@idp.example`, name: 'S', locale });
    assertWelcome(d.mailer, `sso-${locale}@idp.example`, lang);
  }
});

test('unsupported locales fall back to English on every path', () => {
  const a = deps([{ token: 'tj', email: 'jp@acme.ch', locale: 'ja-JP', team: 'ops' }]);
  acceptInvite(a, { token: 'tj', name: 'J' });
  assertWelcome(a.mailer, 'jp@acme.ch', 'en');

  const b = deps();
  signupWithSso(b, { email: 'it@idp.example', name: 'I', locale: 'it_IT' });
  assertWelcome(b.mailer, 'it@idp.example', 'en');
});
