import { EventEmitter } from 'node:events';
import { createApp } from './app.js';

// Replays an operations journal (data/ops-*.json) against a fresh app.
// Journal: { config: {...}, ops: [ { at, op, ... } ] }
//   order.create { order }     order.pay { id }     order.refund { id }
//   config.change { config }   (delivered through the config watcher)
//   smtp.flaky { failures, code? }

export async function replay(journal, deps) {
  const app = createApp(journal.config, deps);
  const watcher = new EventEmitter();
  app.watchConfig(watcher);

  for (const step of journal.ops) {
    switch (step.op) {
      case 'order.create':
        app.orders.create(step.order);
        break;
      case 'order.pay':
        await app.orders.pay(step.id);
        break;
      case 'order.refund':
        await app.orders.refund(step.id);
        break;
      case 'config.change':
        watcher.emit('change', step.config);
        break;
      case 'smtp.flaky':
        app.transport.failNext(step.failures, step.code);
        break;
      default:
        throw new Error(`unknown op ${step.op} at ${step.at}`);
    }
  }
  return app;
}
