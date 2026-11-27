// SMTP relay adapter (in-memory stand-in with the production semantics).
// A send either fails BEFORE the relay accepted the message (connection reset,
// greeting timeout) or is accepted and delivered: there is no
// "delivered but reported as failed" case with this relay.

export class SmtpError extends Error {
  constructor(code, message) {
    super(message ?? code);
    this.name = 'SmtpError';
    this.code = code;
  }
}

export function createTransport() {
  const delivered = [];
  const pendingFailures = [];

  return {
    async deliver(message, smtp) {
      if (pendingFailures.length) {
        const code = pendingFailures.shift();
        throw new SmtpError(code, `${code} from ${smtp.host}`);
      }
      delivered.push({ ...message, relay: smtp.host, smtpUser: smtp.user });
      return { accepted: [message.to] };
    },

    /** Test/replay hook: the next n deliveries fail with `code`. */
    failNext(n, code = 'ECONNRESET') {
      for (let i = 0; i < n; i++) pendingFailures.push(code);
    },

    delivered() {
      return delivered.map((m) => ({ ...m }));
    },
  };
}
