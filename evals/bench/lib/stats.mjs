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

/**
 * Two-sided Fisher exact test: is `a` passes of `n1` runs different from `b` passes of `n2`? Returns the p-value, the
 * probability of a split at least this uneven if both arms had the same pass rate.
 */
export function fisher(a, n1, b, n2) {
  const passes = a + b;
  const total = n1 + n2;
  const prob = (x) => Math.exp(logFact(passes) + logFact(total - passes) + logFact(n1) + logFact(n2)
    - logFact(x) - logFact(passes - x) - logFact(n1 - x) - logFact(n2 - passes + x) - logFact(total));
  const observed = prob(a);
  let p = 0;
  for (let x = Math.max(0, passes - n2); x <= Math.min(passes, n1); x++) {
    const q = prob(x);
    if (q <= observed * (1 + 1e-9)) p += q;
  }
  return Math.min(1, p);
}

/** "7/10 (35–93%)": the count with its Wilson interval. */
export function passWithInterval(k, n) {
  if (!n) return '-';
  const [lo, hi] = wilson(k, n);
  return `${k}/${n} (${Math.round(lo * 100)}–${Math.round(hi * 100)}%)`;
}

/**
 * What one passing run costs: the average cost per run times the runs, over the passes. Runs without a cost (a
 * timeout, a host that reports none) count at the average. Null when nothing passed or no run reported a cost.
 */
export function costPerPass(runs) {
  const costs = runs.map((r) => r.outcome?.costUsd).filter((c) => typeof c === 'number');
  const passes = runs.filter((r) => r.pass).length;
  if (!costs.length || !passes) return null;
  return (costs.reduce((s, c) => s + c, 0) / costs.length) * runs.length / passes;
}
