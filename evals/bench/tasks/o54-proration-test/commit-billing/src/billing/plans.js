export const PLANS = {
  starter: { id: 'starter', name: 'Starter', priceCents: 900 },
  team: { id: 'team', name: 'Team', priceCents: 2900 },
  business: { id: 'business', name: 'Business', priceCents: 7900 },
};

export function getPlan(id) {
  const plan = PLANS[id];
  if (!plan) throw new Error(`unknown plan: ${id}`);
  return plan;
}
