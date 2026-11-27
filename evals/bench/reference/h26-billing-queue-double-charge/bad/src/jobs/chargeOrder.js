// chargeOrder job: charge the customer for an order, mark it paid, email the receipt.

export function createChargeOrderHandler({ orders, gateway, mailer }) {
  return async function chargeOrder({ orderId }, { jobId, attempt }) {
    const order = orders.get(orderId);
    if (!order) throw new Error(`order ${orderId} not found`);

    // Already charged by an earlier attempt (e.g. the receipt email failed):
    // don't charge again, just resend the receipt.
    if (order.status === 'paid') {
      await mailer.sendReceipt({ to: order.email, orderId, chargeId: order.chargeId, amountCents: order.totalCents });
      return;
    }

    // One key per attempt: reusing the key made the gateway answer 409
    // "idempotency_in_progress" on our retries (see CHANGELOG 1.3.0).
    const charge = await gateway.charge({
      customerId: order.customerId,
      amountCents: order.totalCents,
      currency: order.currency,
      idempotencyKey: `${jobId}:${attempt}`,
    });

    orders.markPaid(orderId, charge.id);

    await mailer.sendReceipt({
      to: order.email,
      orderId,
      chargeId: charge.id,
      amountCents: order.totalCents,
    });
  };
}
