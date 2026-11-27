import { JobQueue } from './queue.js';
import { createChargeOrderHandler } from './jobs/chargeOrder.js';

export { JobQueue, AttemptTimeoutError } from './queue.js';
export { JobStore } from './jobStore.js';
export { OrderRepo } from './orders.js';
export { GatewayError, createHttpGateway } from './gateway.js';
export { createFakeClock, systemClock } from './clock.js';

// Wires the billing worker: one queue with the chargeOrder handler.
export function createBillingWorker({ store, orders, gateway, mailer, clock, logger, ...queueOptions }) {
  const queue = new JobQueue({
    store,
    clock,
    logger,
    handlers: { chargeOrder: createChargeOrderHandler({ orders, gateway, mailer }) },
    ...queueOptions,
  });
  return {
    queue,
    chargeOrder: (orderId) => queue.enqueue('chargeOrder', { orderId }, { id: `charge-${orderId}` }),
  };
}

// Used by bin/worker in production.
export function installShutdown(worker, proc = process) {
  proc.on('SIGTERM', () => {
    worker.queue.stop();
    proc.exit(0);
  });
}
