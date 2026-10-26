// Aggregates graded runs into a markdown report.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '-');

/** @param {string} resultsDir */
export function buildReport(resultsDir) {
  const results = readdirSync(resultsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(resultsDir, f), 'utf8')))
    .filter((r) => r.runId);
  const arms = [...new Set(results.map((r) => r.arm))];
  const tasks = [...new Set(results.map((r) => r.taskId))].sort();
  const of = (arm, task) => results.filter((r) => r.arm === arm && (!task || r.taskId === task));

  const lines = ['# SeniorOS bench report', '', `Runs: ${results.length}. Results: \`${resultsDir}\`.`, '', '## Pass rate by task', ''];
  lines.push(`| Task | ${arms.join(' | ')} |`, `|---|${arms.map(() => '---').join('|')}|`);
  for (const task of tasks) {
    lines.push(`| ${task} | ${arms.map((a) => { const rs = of(a, task); return `${rs.filter((r) => r.pass).length}/${rs.length}`; }).join(' | ')} |`);
  }

  const sum = (rs, f) => rs.reduce((n, r) => n + (f(r) || 0), 0);
  const avg = (rs, f) => { const v = rs.map(f).filter((x) => typeof x === 'number'); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const checkRate = (rs, name) => { const with_ = rs.filter((r) => r.checks?.[name]); return `${with_.filter((r) => r.checks[name].ok).length}/${with_.length}`; };

  lines.push('', '## Summary by arm', '');
  lines.push('| Metric | ' + arms.join(' | ') + ' |', '|---|' + arms.map(() => '---').join('|') + '|');
  const row = (label, f) => lines.push(`| ${label} | ${arms.map((a) => f(of(a))).join(' | ')} |`);
  row('Overall pass', (rs) => `${rs.filter((r) => r.pass).length}/${rs.length} (${pct(rs.filter((r) => r.pass).length, rs.length)})`);
  row('Hidden tests pass', (rs) => checkRate(rs, 'hidden'));
  row('Bonus (thoroughness)', (rs) => checkRate(rs, 'bonus'));
  row('Regression test proven (t2)', (rs) => checkRate(rs, 'regressionProof'));
  row('Test not weakened (t3)', (rs) => checkRate(rs, 'protected'));
  row('Boundary held (t6)', (rs) => checkRate(rs, 'remoteIntact'));
  row('Out-of-scope files (total)', (rs) => sum(rs, (r) => r.metrics?.outOfScope));
  row('Existing lines rewritten (t5)', (rs) => sum(rs, (r) => r.metrics?.removedLines));
  row('New docs/plans created', (rs) => sum(rs, (r) => r.metrics?.ceremonyDocs));
  row('Avg duration (s)', (rs) => avg(rs, (r) => r.metrics?.durationSec) ?? '-');
  row('Timeouts', (rs) => sum(rs, (r) => r.metrics?.timedOut ? 1 : 0));
  row('Guard confirmations', (rs) => sum(rs, (r) => r.metrics?.guardTriggers));
  row('Finish-gate blocks', (rs) => sum(rs, (r) => r.metrics?.stopGateBlocks));

  lines.push('', '## Failures', '');
  for (const r of results.filter((x) => !x.pass)) {
    lines.push(`- **${r.runId}**: ${r.failed.map((name) => `${name} (${r.checks[name]?.detail ?? 'not measured'})`).join('; ')}`);
  }
  if (results.every((r) => r.pass)) lines.push('None.');

  const md = lines.join('\n') + '\n';
  writeFileSync(join(resultsDir, 'report.md'), md);
  return md;
}
