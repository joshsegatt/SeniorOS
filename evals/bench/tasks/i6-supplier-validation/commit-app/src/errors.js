export class ValidationError extends Error {
  constructor(errors) {
    super(`invalid fields: ${Object.keys(errors).join(', ')}`);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}
