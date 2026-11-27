// Display helper for printed schedules: 1234567 -> '12,345.67'.
export function formatCents(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const units = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${units}.${String(abs % 100).padStart(2, '0')}`;
}
