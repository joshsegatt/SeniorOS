import { subscribe } from '../subscriptions.js';

/** Sample subscriptions shared by the billing tests. */
export function northwind() {
  return subscribe('sub-311', 'Northwind Traders', 'team', '2025-12-20');
}

export function lumen() {
  return subscribe('sub-207', 'Lumen Studio', 'starter', '2026-03-01');
}
