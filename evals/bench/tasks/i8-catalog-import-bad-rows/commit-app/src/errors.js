export const REASONS = Object.freeze([
  'column_count',
  'missing_sku',
  'missing_name',
  'invalid_price',
  'invalid_stock',
  'duplicate_sku',
]);

export class ImportRowError extends Error {
  constructor(reason, message, line) {
    super(`line ${line}: ${message}`);
    this.name = 'ImportRowError';
    this.reason = reason;
    this.line = line;
  }
}
