// Customer emails for order events.

function chf(cents) {
  return `CHF ${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export function paidEmail(cfg, mailer) {
  return (order) =>
    mailer.send({
      from: cfg.mail.from,
      replyTo: cfg.mail.replyTo,
      to: order.email,
      subject: `Payment received - order ${order.id}`,
      text: `Thank you for shopping at ${cfg.shopName}! We received ${chf(order.totalCents)} for order ${order.id}. Questions? Just reply to ${cfg.mail.replyTo}.`,
    });
}

export function refundEmail(cfg, mailer) {
  return (order) =>
    mailer.send({
      from: cfg.mail.from,
      replyTo: cfg.mail.replyTo,
      to: order.email,
      subject: `Refund issued - order ${order.id}`,
      text: `We refunded ${chf(order.totalCents)} for order ${order.id}. It can take 3-5 days to show up.`,
    });
}
