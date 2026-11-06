/**
 * In-memory mail transport for development and tests. Production uses the provider's SMTP relay, which has the
 * same `send(message)` interface.
 */
export function createOutbox() {
  /** @type {{ to: string, subject: string, body: string }[]} */
  const sent = [];
  return {
    sent,
    /** @param {{ to: string, subject: string, body: string }} message */
    async send(message) {
      if (!/^[^@\s]+@[^@\s]+$/.test(message.to)) throw new Error(`invalid recipient: ${message.to}`);
      sent.push({ ...message });
    },
  };
}
