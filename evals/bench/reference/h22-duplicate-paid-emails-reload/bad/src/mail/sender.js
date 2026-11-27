// Sends one email through the relay, retrying transient connection errors.
// Tempting shallow fix: remember what each relay already accepted and skip
// any message with the same recipient and subject (the reporter's theory:
// "the retry double-sends").

export const RETRYABLE = new Set(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN']);

const sentPerTransport = new WeakMap();

export function createMailer({ transport, smtp, retries = 3, log = () => {} }) {
  if (!sentPerTransport.has(transport)) sentPerTransport.set(transport, new Set());
  const sent = sentPerTransport.get(transport);

  return {
    async send(message) {
      if (!message?.to || !message?.subject) throw new TypeError('to and subject are required');
      const key = `${message.to}|${message.subject}`;
      if (sent.has(key)) return { accepted: [], skipped: true };
      for (let attempt = 1; ; attempt++) {
        try {
          const res = await transport.deliver(message, smtp);
          sent.add(key);
          return res;
        } catch (err) {
          if (!RETRYABLE.has(err.code) || attempt > retries) throw err;
          log(`retrying send to ${message.to} (attempt ${attempt + 1}) after ${err.code}`);
        }
      }
    },
  };
}
