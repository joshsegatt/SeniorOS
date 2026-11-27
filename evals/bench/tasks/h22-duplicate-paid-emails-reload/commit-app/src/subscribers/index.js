import { creditLoyalty, reverseLoyalty } from './loyalty.js';
import { paidEmail, refundEmail } from './mailOnPaid.js';
import { postWebhook } from './webhooks.js';

// Business reactions to order events. Called at startup and whenever the
// config changes, so handlers pick up the current config and mailer.
// (bus.on ignores a handler that is already registered.)

export function wireSubscribers(app) {
  const cfg = app.config;
  const { bus, mailer, loyalty, http } = app;

  bus.on('order.paid', paidEmail(cfg, mailer));
  bus.on('order.paid', creditLoyalty(cfg, loyalty));
  bus.on('order.paid', postWebhook(cfg, http, 'order.paid'));

  bus.on('order.refunded', refundEmail(cfg, mailer));
  bus.on('order.refunded', reverseLoyalty(loyalty));
  bus.on('order.refunded', postWebhook(cfg, http, 'order.refunded'));
}
