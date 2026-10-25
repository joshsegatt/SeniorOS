import type { RiskLevel, RiskReport, RiskSignal } from '../types.js';
import type { ChangedFile } from './git.js';
import { globToRegExp, type RiskRuleConfig } from './config.js';

interface Rule {
  code: string;
  points: number;
  reason: string;
  pattern: RegExp;
}

const RULES: Rule[] = [
  { code: 'auth', points: 4, reason: 'Authentication or authorization behavior changed.', pattern: /(^|\/)(auth|middleware|permissions?|rbac|acl)(\/|\.|$)|session|oauth|jwt/i },
  { code: 'database', points: 3, reason: 'Database schema or migration surface changed.', pattern: /(^|\/)(migrations?|schema|drizzle|prisma)(\/|\.|$)|\.sql$/i },
  { code: 'secrets', points: 6, reason: 'Secret or environment configuration surface changed.', pattern: /(^|\/)(\.env|secrets?|credentials?)(\.|\/|$)/i },
  { code: 'infra', points: 3, reason: 'Deployment or infrastructure configuration changed.', pattern: /terraform|\.tf$|dockerfile|docker-compose|wrangler|vercel\.json|kubernetes|k8s|helm/i },
  { code: 'ci', points: 2, reason: 'CI/CD behavior changed.', pattern: /(^|\/)\.github\/workflows\/|gitlab-ci|circleci|buildkite/i },
  { code: 'dependencies', points: 2, reason: 'Dependency manifest or lockfile changed.', pattern: /package(-lock)?\.json$|pnpm-lock\.yaml$|yarn\.lock$|bun\.lock|pyproject\.toml$|requirements.*\.txt$|go\.mod$|cargo\.toml$/i },
  { code: 'public-api', points: 2, reason: 'Public interface surface may have changed.', pattern: /(^|\/)(api|routes?|controllers?|graphql)(\/|\.|$)/i }
];

function levelFor(score: number): RiskLevel {
  if (score >= 10) return 'critical';
  if (score >= 6) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

export interface RiskOptions {
  /** Project rules from `.senior/config.json`, added to the built-in rules. */
  extraRules?: RiskRuleConfig[];
  /** Globs for paths that do not count toward risk. They never hide the built-in secrets rule. */
  ignore?: string[];
}

export function assessRisk(allFiles: ChangedFile[], options: RiskOptions = {}): RiskReport {
  const signals: RiskSignal[] = [];
  const ignoreMatchers = (options.ignore ?? []).map(globToRegExp);
  const isIgnored = (file: ChangedFile) => ignoreMatchers.some((matcher) => matcher.test(file.path));
  const files = allFiles.filter((file) => !isIgnored(file));
  const ignored = allFiles.filter(isIgnored).map((file) => file.path);

  const rules: Rule[] = [
    ...RULES,
    ...(options.extraRules ?? []).map((rule) => ({ ...rule, pattern: new RegExp(rule.pattern, 'i') }))
  ];

  for (const rule of rules) {
    // Secrets are checked against every changed file, ignored or not.
    const candidates = rule.code === 'secrets' ? allFiles : files;
    const matched = candidates.filter((file) => rule.pattern.test(file.path)).map((file) => file.path);
    if (matched.length > 0) {
      signals.push({ code: rule.code, points: rule.points, reason: rule.reason, files: matched });
    }
  }

  const deleted = files.filter((file) => file.status.includes('D')).map((file) => file.path);
  if (deleted.length > 0) {
    signals.push({ code: 'deletion', points: Math.min(4, 1 + deleted.length), reason: 'Files were deleted.', files: deleted });
  }

  if (files.length >= 20) {
    signals.push({ code: 'broad-change', points: 3, reason: `Broad change set touches ${files.length} files.`, files: files.map((file) => file.path) });
  } else if (files.length >= 8) {
    signals.push({ code: 'wide-change', points: 1, reason: `Change set touches ${files.length} files.`, files: files.map((file) => file.path) });
  }

  const score = signals.reduce((sum, signal) => sum + signal.points, 0);
  const level = levelFor(score);
  const gates = level === 'low'
    ? ['proportionate verification']
    : level === 'medium'
      ? ['light plan', 'targeted tests', 'diff review']
      : level === 'high'
        ? ['explicit acceptance criteria', 'full relevant verification', 'independent review', 'rollback/recovery check']
        : ['explicit acceptance criteria', 'human approval for destructive/external actions', 'full verification', 'independent review', 'rollback/recovery plan'];

  return { level, score, signals, gates, files: files.map((file) => file.path), ignored };
}
