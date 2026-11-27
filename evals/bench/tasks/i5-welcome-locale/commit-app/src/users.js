export class DuplicateUserError extends Error {
  constructor(email) {
    super(`user ${email} already exists`);
    this.name = 'DuplicateUserError';
  }
}

export function createUserStore() {
  const byEmail = new Map();
  return {
    add({ email, name, locale, source }) {
      const key = email.trim().toLowerCase();
      if (byEmail.has(key)) throw new DuplicateUserError(key);
      const user = { id: byEmail.size + 1, email: key, name, locale, source };
      byEmail.set(key, user);
      return { ...user };
    },
    findByEmail(email) {
      const u = byEmail.get(email.trim().toLowerCase());
      return u ? { ...u } : null;
    },
    count() {
      return byEmail.size;
    },
  };
}
