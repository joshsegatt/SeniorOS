const AMOUNT = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

export class InvalidAmount extends TypeError {
  constructor(value) {
    super(`invalid amount: ${JSON.stringify(value)}`);
    this.name = 'InvalidAmount';
  }
}

/**
 * Cents from a number of euros (19.99) or a decimal string ("19.99", "-5", "0.5"). Exact for strings: no float
 * rounding on the way.
 */
export function toCents(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new InvalidAmount(value);
    return Math.round(value * 100);
  }
  const match = typeof value === 'string' ? AMOUNT.exec(value.trim()) : null;
  if (!match) throw new InvalidAmount(value);
  const cents = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'));
  return match[1] ? -cents : cents;
}

/** "€19.99" style display. */
export function formatCents(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}€${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
