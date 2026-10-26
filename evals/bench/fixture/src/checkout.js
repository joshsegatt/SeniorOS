import { labels } from './labels.js';

export function renderCheckoutButton(disabled = false) {
  return `<button class="checkout" aria-label="Buy now"${disabled ? ' disabled' : ''}>${labels.checkoutButton}</button>`;
}

export function renderEmptyCart() {
  return `<p class="empty">${labels.emptyCart}</p>`;
}
