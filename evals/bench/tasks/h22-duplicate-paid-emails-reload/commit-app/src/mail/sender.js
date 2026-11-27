// Sends one email through the relay, retrying transient connection errors.
// The relay never accepts a message on a failed attempt (see transport.js),
// so retrying these codes cannot produce a second copy.

export const RETRYABLE = new Set(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN']);

export function createMailer({ transport, smtp, retries = 3, log = () => {} }) {
  return {
    async send(message) {
      if (!message?.to || !message?.subject) throw new TypeError('to and subject are required');
      for (let attempt = 1; ; attempt++) {
        try {
          return await transport.deliver(message, smtp);
        } catch (err) {
          if (!RETRYABLE.has(err.code) || attempt > retries) throw err;
          log(`retrying send to ${message.to} (attempt ${attempt + 1}) after ${err.code}`);
        }
      }
    },
  };
}
