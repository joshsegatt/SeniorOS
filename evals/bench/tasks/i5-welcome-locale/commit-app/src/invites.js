export class InvalidInviteError extends Error {
  constructor() {
    super('invite is invalid or already used');
    this.name = 'InvalidInviteError';
  }
}

// invites: [{ token, email, locale, team }]
export function createInviteStore(invites = []) {
  const open = new Map(invites.map((i) => [i.token, { ...i }]));
  return {
    take(token) {
      const invite = open.get(token);
      if (!invite) throw new InvalidInviteError();
      open.delete(token);
      return invite;
    },
  };
}
