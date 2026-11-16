import { getProduct, isSoldOut } from '../catalog/products.js';
import { normalizeEmail, sendEmail } from '../email/outbox.js';
import { productUrl } from './urls.js';

/** @typedef {ReturnType<import('../catalog/store.js').createStore>} Store */
/** @typedef {import('../catalog/products.js').Product} Product */

// Legal (#218): a sign-up is consent for one email and may be kept for 90 days at most.
const KEEP_MS = 90 * 86_400_000;

/**
 * "Email me when it's back" on a sold-out product page (#218).
 * @param {Store} store
 * @param {string} sku
 * @param {string} email
 * @param {() => Date} [now]
 */
export function subscribeBackInStock(store, sku, email, now = () => new Date()) {
  const address = normalizeEmail(email);
  const product = getProduct(store, sku);
  if (!isSoldOut(product)) throw new Error('product is in stock');
  const existing = store.find('backInStock', (s) => s.sku === sku && s.email === address);
  if (existing) return existing;
  return store.insert('backInStock', { id: store.nextId('bis'), sku, email: address, createdAt: now().toISOString() });
}

/** @param {Store} store @param {string} sku */
export function waitingCount(store, sku) {
  return store.all('backInStock').filter((s) => s.sku === sku).length;
}

/**
 * Call after every stock change. When the product just came back, emails everyone waiting (oldest sign-up first)
 * and closes their sign-ups; sign-ups older than 90 days are dropped without an email.
 * @param {Store} store
 * @param {Product} before
 * @param {Product} after
 * @param {() => Date} [now]
 */
export function notifyIfBackInStock(store, before, after, now = () => new Date()) {
  if (!isSoldOut(before) || isSoldOut(after)) return 0;
  const sentAt = now().getTime();
  const signups = store.all('backInStock').filter((s) => s.sku === after.sku);
  store.remove('backInStock', (s) => s.sku === after.sku);
  let sent = 0;
  for (const signup of signups) {
    if (sentAt - Date.parse(signup.createdAt) > KEEP_MS) continue;
    sendEmail(store, { to: signup.email, template: 'back-in-stock', data: { sku: after.sku, title: after.title, url: productUrl(after) } }, now);
    sent += 1;
  }
  return sent;
}
