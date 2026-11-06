/** @param {number} cents */
export function formatEuros(cents) {
  const euros = Math.floor(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `€${euros}.${String(cents % 100).padStart(2, '0')}`;
}

/** Emails waiting for the mail worker. */
export function createOutbox() {
  /** @type {{ to: string, subject: string, text: string }[]} */
  const messages = [];
  return {
    messages,
    /** @param {import('../orders/orders.js').Order} order */
    async orderConfirmation(order) {
      const lines = order.lines.map((l) => `${l.qty} x ${l.name}  ${formatEuros(l.totalCents)}`);
      messages.push({
        to: `customer:${order.customerId}`,
        subject: `Your order ${order.id}`,
        text: [...lines, `Total ${formatEuros(order.totalCents)}`].join('\n'),
      });
    },
  };
}
