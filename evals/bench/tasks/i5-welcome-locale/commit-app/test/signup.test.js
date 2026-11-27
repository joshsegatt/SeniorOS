import test from 'node:test';
import assert from 'node:assert/strict';
import { createUserStore } from '../src/users.js';
import { createInviteStore } from '../src/invites.js';
import { createMemoryMailer } from '../src/mail/memoryMailer.js';
import { signupWithEmail } from '../src/signup/emailSignup.js';
import { acceptInvite } from '../src/signup/inviteSignup.js';
import { signupWithSso } from '../src/signup/ssoSignup.js';

test('email signup creates the user and sends one welcome email', () => {
  const users = createUserStore();
  const mailer = createMemoryMailer();
  const user = signupWithEmail({ users, mailer }, { email: 'Ana@Example.com', name: 'Ana', password: 'longenough', locale: 'en' });
  assert.equal(user.email, 'ana@example.com');
  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0].to, 'ana@example.com');
  assert.equal(mailer.sent[0].subject, 'Welcome to TeamDesk');
});

test('email signup rejects short passwords', () => {
  const users = createUserStore();
  const mailer = createMemoryMailer();
  assert.throws(() => signupWithEmail({ users, mailer }, { email: 'a@b.ch', name: 'A', password: 'short' }));
  assert.equal(mailer.sent.length, 0);
});

test('invite signup sends the welcome email in the invite language', () => {
  const users = createUserStore();
  const mailer = createMemoryMailer();
  const invites = createInviteStore([{ token: 't1', email: 'luc@acme.ch', locale: 'fr', team: 'ops' }]);
  acceptInvite({ users, invites, mailer }, { token: 't1', name: 'Luc' });
  assert.equal(mailer.sent[0].lang, 'fr');
  assert.throws(() => acceptInvite({ users, invites, mailer }, { token: 't1', name: 'Luc' }));
});

test('sso signup sends the welcome email in the claimed language', () => {
  const users = createUserStore();
  const mailer = createMemoryMailer();
  signupWithSso({ users, mailer }, { email: 'jonas@acme.de', name: 'Jonas', locale: 'de' });
  assert.equal(mailer.sent[0].lang, 'de');
  assert.equal(mailer.sent[0].subject, 'Willkommen bei TeamDesk');
});
