// Small-sample statistics for pass rates: the bench runs 2 to 5 trials per cell, so a raw "5/5 vs 3/5" needs its
// uncertainty next to it.

/** Wilson score interval for `k` passes in `n` runs, at about 95% (z = 1.96). Returns [low, high] in 0..1. */
export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1];
  const p = k / n;
  const z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z / (1 + z2 / n)) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

const logFact = (() => {
  const cache = [0];
  return (n) => {
    for (let i = cache.length; i <= n; i++) cache[i] = cache[i - 1] + Math.log(i);
    return cache[n];
  };
})();

const count = (k, n) => Number.isInteger(k) && Number.isInteger(n) && k >= 0 && n >= 0 && k <= n;

/**
 * The hypergeometric distribution of the first arm's passes in one 2x2 table: index x holds P(first arm passes x),
 * given the table's totals. Starts at x = `from`.
 */
function hypergeometric(a, n1, b, n2) {
  const passes = a + b;
  const total = n1 + n2;
  const from = Math.max(0, passes - n2);
  const to = Math.min(passes, n1);
  const probs = [];
  for (let x = from; x <= to; x++) {
    probs.push(Math.exp(logFact(passes) + logFact(total - passes) + logFact(n1) + logFact(n2)
      - logFact(x) - logFact(passes - x) - logFact(n1 - x) - logFact(n2 - passes + x) - logFact(total)));
  }
  return { from, probs };
}

/** Two-sided p: the probability of every outcome no more likely than the observed one. */
function twoSided(dist, observed) {
  const p0 = dist.probs[observed - dist.from] ?? 0;
  return Math.min(1, dist.probs.reduce((s, q) => (q <= p0 * (1 + 1e-9) ? s + q : s), 0));
}

/**
 * Two-sided Fisher exact test: is `a` passes of `n1` runs different from `b` passes of `n2`? Returns the p-value, the
 * probability of a split at least this uneven if both arms had the same pass rate.
 */
export function fisher(a, n1, b, n2) {
  if (!count(a, n1) || !count(b, n2)) throw new Error(`fisher: bad counts ${a}/${n1}, ${b}/${n2}`);
  return twoSided(hypergeometric(a, n1, b, n2), a);
}

/**
 * Stratified exact test (conditional on each stratum's totals): one 2x2 table per task, `[a, n1, b, n2]`, the first
 * arm's passes and runs against the second's. Pooling every run of an arm as one pass rate treats an easy and a hard
 * task as the same draw; this compares the arms within each task and adds the evidence up. Two-sided p.
 */
export function stratifiedExact(tables) {
  let dist = { from: 0, probs: [1] };
  let observed = 0;
  for (const [a, n1, b, n2] of tables) {
    if (!count(a, n1) || !count(b, n2)) throw new Error(`stratifiedExact: bad counts ${a}/${n1}, ${b}/${n2}`);
    const h = hypergeometric(a, n1, b, n2);
    observed += a;
    // Convolution: the sum of independent per-task counts.
    const probs = new Array(dist.probs.length + h.probs.length - 1).fill(0);
    dist.probs.forEach((p, i) => h.probs.forEach((q, j) => { probs[i + j] += p * q; }));
    dist = { from: dist.from + h.from, probs };
  }
  return twoSided(dist, observed);
}

/** A p-value for a table cell: three decimals, or "<0.001". */
export const formatP = (p) => (p < 0.001 ? '<0.001' : p.toFixed(3));

/** "7/10 (35–93%)": the count with its Wilson interval. */
export function passWithInterval(k, n) {
  if (!n) return '-';
  const [lo, hi] = wilson(k, n);
  return `${k}/${n} (${Math.round(lo * 100)}–${Math.round(hi * 100)}%)`;
}

/**
 * What one passing run costs: every run's cost, over the passes. A run without a cost (a timeout, whose host reported
 * none) counts at the arm's most expensive run, since timeouts are the longest runs. Null when nothing passed or no
 * run reported a cost.
 */
export function costPerPass(runs) {
  const costs = runs.map((r) => r.outcome?.costUsd).filter((c) => typeof c === 'number');
  const passes = runs.filter((r) => r.pass).length;
  if (!costs.length || !passes) return null;
  const missing = runs.length - costs.length;
  return (costs.reduce((s, c) => s + c, 0) + missing * Math.max(...costs)) / passes;
}
