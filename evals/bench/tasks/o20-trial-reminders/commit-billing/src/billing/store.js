/**
 * In-memory account store (production uses the same interface over Postgres).
 * @typedef {{ id: string, company: string, ownerEmail: string, plan: 'trial' | 'pro' | 'free', trialEndsAt: string | null, createdAt: string, salesRep?: string }} Account
 */
export function createAccountStore() {
  /** @type {Account[]} */
  const accounts = [];
  let seq = 300;
  return {
    nextId() {
      seq += 1;
      return `a-${seq}`;
    },
    /** @param {Account} account */
    insert(account) {
      accounts.push({ ...account });
      return { ...account };
    },
    /** @param {string} id @param {Partial<Account>} patch */
    update(id, patch) {
      const found = accounts.find((a) => a.id === id);
      if (!found) throw new Error(`unknown account ${id}`);
      Object.assign(found, patch);
      return { ...found };
    },
    /** @param {string} id */
    get(id) {
      const found = accounts.find((a) => a.id === id);
      return found ? { ...found } : null;
    },
    all() {
      return accounts.map((a) => ({ ...a }));
    },
  };
}
