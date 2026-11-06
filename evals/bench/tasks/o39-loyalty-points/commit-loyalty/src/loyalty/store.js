/**
 * In-memory loyalty store (production uses the same interface over Postgres).
 * @typedef {{ id: string, name: string, email: string, cardNumber: string, joinedAt: string }} Member
 * @typedef {{ id: string, receipt: string, customerId: string, storeId: string, totalCents: number, purchasedAt: string, channel: 'register' | 'app' }} Purchase
 */
export function createLoyaltyStore() {
  /** @type {Member[]} */
  const members = [];
  /** @type {Purchase[]} */
  const purchases = [];
  const seq = { c: 100, p: 5000 };
  return {
    /** @param {'c' | 'p'} kind */
    nextId(kind) {
      seq[kind] += 1;
      return `${kind}_${seq[kind]}`;
    },
    /** @param {Member} member */
    insertMember(member) {
      members.push({ ...member });
      return { ...member };
    },
    /** @param {string} id */
    getMember(id) {
      const found = members.find((m) => m.id === id);
      return found ? { ...found } : null;
    },
    /** @param {string} cardNumber */
    findMemberByCard(cardNumber) {
      const found = members.find((m) => m.cardNumber === cardNumber);
      return found ? { ...found } : null;
    },
    /** @param {Purchase} purchase */
    insertPurchase(purchase) {
      purchases.push({ ...purchase });
      return { ...purchase };
    },
    /** @param {string} receipt */
    hasReceipt(receipt) {
      return purchases.some((p) => p.receipt === receipt);
    },
    /** @param {string} customerId */
    purchasesFor(customerId) {
      return purchases.filter((p) => p.customerId === customerId).map((p) => ({ ...p }));
    },
    purchases() {
      return purchases.map((p) => ({ ...p }));
    },
  };
}
