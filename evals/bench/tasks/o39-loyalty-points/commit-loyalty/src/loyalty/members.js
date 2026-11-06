/**
 * A customer activates the loyalty card they got at the counter (in the app or on the website).
 * @param {ReturnType<import('./store.js').createLoyaltyStore>} store
 * @param {{ name: string, email: string, cardNumber: string }} input
 * @param {() => Date} [now]
 */
export function activateCard(store, input, now = () => new Date()) {
  const name = String(input.name ?? '').trim();
  const email = String(input.email ?? '').trim().toLowerCase();
  const cardNumber = String(input.cardNumber ?? '').trim().toUpperCase();
  if (!name) throw new Error('name is required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid email');
  if (!/^LC-\d{4}$/.test(cardNumber)) throw new Error('invalid card number');
  if (store.findMemberByCard(cardNumber)) throw new Error(`card ${cardNumber} is already active`);
  return store.insertMember({ id: store.nextId('c'), name, email, cardNumber, joinedAt: now().toISOString() });
}
