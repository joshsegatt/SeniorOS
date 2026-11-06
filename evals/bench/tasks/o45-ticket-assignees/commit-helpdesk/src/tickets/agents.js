// The support team. `lead` gets escalations nobody else is assigned to.
export const AGENTS = [
  { id: 'lena', name: 'Lena', role: 'lead' },
  { id: 'marco', name: 'Marco', role: 'billing' },
  { id: 'priya', name: 'Priya', role: 'support' },
  { id: 'tomas', name: 'Tomas', role: 'support' },
];

export const TEAM_LEAD = 'lena';

/** @param {string} id */
export function isAgent(id) {
  return AGENTS.some((a) => a.id === id);
}
