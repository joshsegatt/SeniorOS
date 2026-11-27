import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMailer } from '../src/mail/sender.js';
import { createTransport } from '../src/mail/transport.js';

const smtp = { host: 'smtp.test', user: 'u' };
const msg = { from: 'a@x.example', to: 'b@example.ch', subject: 'hi', text: 't' };

test('transient connection errors are retried and the mail is delivered once', async () => {
  const transport = createTransport();
  const logs = [];
  transport.failNext(2, 'ECONNRESET');
  await createMailer({ transport, smtp, log: (l) => logs.push(l) }).send(msg);
  assert.equal(transport.delivered().length, 1);
  assert.equal(logs.length, 2);
  assert.match(logs[0], /retrying send to b@example.ch/);
});

test('permanent errors are not retried', async () => {
  const transport = createTransport();
  transport.failNext(1, 'EAUTH');
  await assert.rejects(createMailer({ transport, smtp }).send(msg), { code: 'EAUTH' });
  await createMailer({ transport, smtp }).send(msg);
  assert.equal(transport.delivered().length, 1);
});

test('gives up after the retry budget', async () => {
  const transport = createTransport();
  transport.failNext(5, 'ETIMEDOUT');
  await assert.rejects(createMailer({ transport, smtp, retries: 3 }).send(msg), { code: 'ETIMEDOUT' });
  assert.equal(transport.delivered().length, 0);
});
