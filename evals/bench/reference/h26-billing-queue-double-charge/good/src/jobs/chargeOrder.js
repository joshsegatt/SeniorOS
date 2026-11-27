// chargeOrder job: charge the customer for an order, mark it paid, email the receipt.
//
// The job can run more than once (retry after a failure or timeout, or a new
// worker picking up a job a killed worker left running). The idempotency key is
// therefore the same for every run of the job: the gateway then replays the
// first charge instead of creating a second one, and answers
// `idempotency_in_progress` while the first request is still being processed,
// which fails this attempt and lets the queue retry later.

export function createChargeOrderHandler({ orders, gateway, mailer }) {
  return async function chargeOrder({ orderId }, { jobId }) {
    const order = orders.get(orderId);
    if (!order) throw new Error(`order ${orderId} not found`);

    const charge = await gateway.charge({
      customerId: order.customerId,
      amountCents: order.totalCents,
      currency: order.currency,
      idempotencyKey: jobId,
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
