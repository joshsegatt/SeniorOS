// In-memory outbox; the real SMTP relay drains it every minute.

export function createOutbox() {
  const sent = [];
  return {
    send(message) {
      if (!message?.to || !message?.subject) throw new TypeError('to and subject are required');
      sent.push({ ...message });
    },
    messages() {
      return sent.map((m) => ({ ...m }));
    },
  };
}
