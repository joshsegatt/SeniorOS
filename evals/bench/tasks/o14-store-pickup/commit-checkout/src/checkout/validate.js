import { shippingMethod } from '../shipping/methods.js';

const COUNTRIES = ['PT', 'ES'];

/**
 * @typedef {{ name: string, street: string, postcode: string, city: string, country: string }} Address
 * @typedef {{ sku: string, qty: number, unitCents: number }} Line
 * @typedef {{ email?: string, lines?: Line[], shippingMethod?: string, address?: Partial<Address> | null }} CheckoutInput
 */

/** @param {CheckoutInput} input @returns {Record<string, string>} errors by field, empty when valid */
export function validateCheckout(input) {
  /** @type {Record<string, string>} */
  const errors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.email ?? '').trim())) errors.email = 'invalid email';
  if (!Array.isArray(input.lines) || input.lines.length === 0) errors.lines = 'the cart is empty';
  else if (input.lines.some((l) => !Number.isInteger(l.qty) || l.qty <= 0 || !Number.isInteger(l.unitCents) || l.unitCents < 0)) errors.lines = 'invalid line';
  if (!shippingMethod(String(input.shippingMethod ?? ''))) errors.shippingMethod = 'unknown shipping method';

  const a = input.address ?? {};
  for (const field of ['name', 'street', 'postcode', 'city']) {
    if (!String(a[field] ?? '').trim()) errors[`address.${field}`] = 'required';
  }
  if (!COUNTRIES.includes(String(a.country ?? ''))) errors['address.country'] = 'we ship to Portugal and Spain';
  return errors;
}
