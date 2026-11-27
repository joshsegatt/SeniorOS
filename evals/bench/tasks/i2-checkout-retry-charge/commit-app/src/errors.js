export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class OutOfStockError extends Error {
  constructor(sku) {
    super(`out of stock: ${sku}`);
    this.name = 'OutOfStockError';
    this.sku = sku;
  }
}

export class FulfillmentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FulfillmentError';
  }
}
