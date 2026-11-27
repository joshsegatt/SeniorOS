import { convertExact, parseRate, checkRate } from './convert.js';
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

  // Exact { num, den } for a direct or inverse quote, or undefined.
  #leg(from, to) {
    if (from === to) return { num: 1n, den: 1n };
    const direct = this.#quotes.get(`${from}>${to}`);
    if (direct) return parseRate(direct);
    const inverse = this.#quotes.get(`${to}>${from}`);
    if (inverse) {
      const { num, den } = parseRate(inverse);
      return { num: den, den: num };
    }
    return undefined;
  }

  rate(from, to) {
    exponent(from);
    exponent(to);
    const leg = this.#leg(from, to);
    if (leg) return leg;
    const first = this.#leg(from, PIVOT);
    const second = this.#leg(PIVOT, to);
    if (!first || !second) throw new RangeError(`no rate for ${from} -> ${to}`);
    return { num: first.num * second.num, den: first.den * second.den };
  }

  convert(amount, from, to) {
    if (typeof amount !== 'bigint') throw new TypeError('amount must be a bigint');
    return convertExact(amount, from, to, this.rate(from, to));
  }
}
