import { convert, checkRate } from './convert.js';
import { exponent } from './currencies.js';

const PIVOT = 'USD';

export class RateTable {
  #quotes = new Map();

  set(from, to, rate) {
    exponent(from);
    exponent(to);
    this.#quotes.set(`${from}>${to}`, checkRate(rate));
    return this;
  }

  // Rate as a decimal string, or undefined when there is no direct/inverse quote.
  #leg(from, to) {
    if (from === to) return '1';
    const direct = this.#quotes.get(`${from}>${to}`);
    if (direct) return direct;
    const inverse = this.#quotes.get(`${to}>${from}`);
    if (inverse) return String(1 / Number(inverse));
    return undefined;
  }

  convert(amount, from, to) {
    const leg = this.#leg(from, to);
    if (leg) return convert(amount, from, to, leg);
    const first = this.#leg(from, PIVOT);
    const second = this.#leg(PIVOT, to);
    if (!first || !second) throw new RangeError(`no rate for ${from} -> ${to}`);
    return convert(convert(amount, from, PIVOT, first), PIVOT, to, second);
  }
}
