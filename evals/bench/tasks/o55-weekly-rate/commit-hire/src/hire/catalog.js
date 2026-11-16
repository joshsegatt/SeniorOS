// Rates and deposits in Swiss centimes. weeklyRateCents is null for items we only hire by the day.
export const EQUIPMENT = [
  { id: 'exc-8t', name: 'Excavator 8 t', dailyRateCents: 18000, weeklyRateCents: 90000, depositCents: 150000 },
  { id: 'cmp-90', name: 'Plate compactor 90 kg', dailyRateCents: 6500, weeklyRateCents: 32500, depositCents: 30000 },
  { id: 'mix-140', name: 'Concrete mixer 140 l', dailyRateCents: 3500, weeklyRateCents: 17500, depositCents: 20000 },
  { id: 'scf-6m', name: 'Scaffold tower 6 m', dailyRateCents: 4000, weeklyRateCents: null, depositCents: 25000 },
];

export function getItem(id) {
  const item = EQUIPMENT.find((e) => e.id === id);
  if (!item) throw new Error(`unknown item: ${id}`);
  return item;
}
