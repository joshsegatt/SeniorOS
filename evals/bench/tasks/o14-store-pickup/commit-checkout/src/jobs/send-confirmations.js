import { confirmationEmail } from '../emails/confirmation.js';

/**
 * Runs every minute: sends the confirmation email of every order that has not had one yet.
 * @param {ReturnType<import('../orders/repo.js').createOrderRepo>} orders
 * @param {{ send(message: { to: string, subject: string, text: string }): Promise<void> }} mailer
 * @param {() => Date} [now]
 */
export async function sendPendingConfirmations(orders, mailer, now = () => new Date()) {
  let sent = 0;
  for (const order of orders.list()) {
    if (order.confirmationSentAt) continue;
    await mailer.send(confirmationEmail(order));
    orders.markConfirmationSent(order.id, now().toISOString());
    sent += 1;
  }
  return { sent };
}
