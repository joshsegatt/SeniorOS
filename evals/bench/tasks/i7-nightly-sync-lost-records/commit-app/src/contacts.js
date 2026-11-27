export function normalizeContact(raw) {
  if (raw == null || raw.id == null) throw new Error('contact without id');
  return {
    id: String(raw.id),
    name: String(raw.name ?? '').trim(),
    email: String(raw.email ?? '').trim().toLowerCase(),
    updatedAt: new Date(raw.updatedAt).toISOString(),
  };
}

// Latest version wins; on a tie the incoming (remote) version wins.
export function mergeContact(existing, incoming) {
  if (!existing) return incoming;
  return incoming.updatedAt >= existing.updatedAt ? incoming : existing;
}
