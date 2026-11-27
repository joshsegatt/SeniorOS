export function createMemoryMailer() {
  const sent = [];
  return {
    sent,
    send(message) {
      if (!message.to) throw new Error('mailer: missing recipient');
      const stored = { ...message, id: sent.length + 1 };
      sent.push(stored);
      return stored;
    },
  };
}
