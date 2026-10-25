import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { exists } from './fs-utils.js';

export const CONFIG_PATH = '.senior/config.json';

export interface ProofCheckConfig {
  name: string;
  /** Shell command; exit code 0 means pass. */
  command: string;
}

export interface RiskRuleConfig {
  code: string;
  points: number;
  reason: string;
  /** Regular expression tested against repository-relative paths (forward slashes). */
  pattern: string;
}

export interface ProofConfig {
  checks: ProofCheckConfig[];
}

export interface RiskConfig {
  ignore: string[];
  rules: RiskRuleConfig[];
}

export interface SeniorConfig {
  schemaVersion: 1;
  proof?: ProofConfig;
  risk?: RiskConfig;
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function onlyKeys(value: Json, allowed: string[], where: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new ConfigError(`${where}: unknown key "${key}" (allowed: ${allowed.join(', ')})`);
  }
}

function nonEmptyString(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new ConfigError(`${where} must be a non-empty string`);
  return value;
}

function parseProof(value: unknown): ProofConfig {
  if (!isObject(value)) throw new ConfigError('proof must be an object');
  onlyKeys(value, ['checks'], 'proof');
  if (!Array.isArray(value.checks) || value.checks.length === 0) throw new ConfigError('proof.checks must be a non-empty array');
  const names = new Set<string>();
  const checks = value.checks.map((item, index) => {
    const where = `proof.checks[${index}]`;
    if (!isObject(item)) throw new ConfigError(`${where} must be an object`);
    onlyKeys(item, ['name', 'command'], where);
    const name = nonEmptyString(item.name, `${where}.name`);
    if (names.has(name)) throw new ConfigError(`${where}.name "${name}" is duplicated`);
    names.add(name);
    return { name, command: nonEmptyString(item.command, `${where}.command`) };
  });
  return { checks };
}

function parseRisk(value: unknown): RiskConfig {
  if (!isObject(value)) throw new ConfigError('risk must be an object');
  onlyKeys(value, ['ignore', 'rules'], 'risk');

  const ignore = value.ignore ?? [];
  if (!Array.isArray(ignore)) throw new ConfigError('risk.ignore must be an array of glob strings');
  ignore.forEach((glob, index) => nonEmptyString(glob, `risk.ignore[${index}]`));

  const rawRules = value.rules ?? [];
  if (!Array.isArray(rawRules)) throw new ConfigError('risk.rules must be an array');
  const rules = rawRules.map((item, index) => {
    const where = `risk.rules[${index}]`;
    if (!isObject(item)) throw new ConfigError(`${where} must be an object`);
    onlyKeys(item, ['code', 'points', 'reason', 'pattern'], where);
    const code = nonEmptyString(item.code, `${where}.code`);
    if (!/^[a-z0-9-]+$/.test(code)) throw new ConfigError(`${where}.code must use lowercase letters, digits and dashes`);
    if (typeof item.points !== 'number' || !Number.isInteger(item.points) || item.points < 1 || item.points > 10) {
      throw new ConfigError(`${where}.points must be an integer from 1 to 10`);
    }
    const pattern = nonEmptyString(item.pattern, `${where}.pattern`);
    try {
      new RegExp(pattern, 'i');
    } catch (error) {
      throw new ConfigError(`${where}.pattern is not a valid regular expression: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { code, points: item.points, reason: nonEmptyString(item.reason, `${where}.reason`), pattern };
  });

  return { ignore: ignore as string[], rules };
}

/** Validates a parsed config object. Unknown keys are errors so typos never silently disable a gate. */
export function parseConfig(value: unknown): SeniorConfig {
  if (!isObject(value)) throw new ConfigError('config must be a JSON object');
  onlyKeys(value, ['$schema', 'schemaVersion', 'proof', 'risk'], 'config');
  if (value.schemaVersion !== 1) throw new ConfigError('schemaVersion must be 1');
  const config: SeniorConfig = { schemaVersion: 1 };
  if (value.proof !== undefined) config.proof = parseProof(value.proof);
  if (value.risk !== undefined) config.risk = parseRisk(value.risk);
  return config;
}

/** Loads `.senior/config.json` from `root`. Returns null when the file does not exist. */
export async function loadConfig(root: string): Promise<SeniorConfig | null> {
  const file = path.join(root, CONFIG_PATH);
  if (!(await exists(file))) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse((await readFile(file, 'utf8')).replace(/^﻿/, ''));
  } catch (error) {
    throw new ConfigError(`${CONFIG_PATH} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return parseConfig(parsed);
  } catch (error) {
    if (error instanceof ConfigError) throw new ConfigError(`${CONFIG_PATH}: ${error.message}`);
    throw error;
  }
}

/** Converts a path glob (`*`, `**`, `?`) to an anchored regular expression. */
export function globToRegExp(glob: string): RegExp {
  let source = '';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i]!;
    if (char === '*') {
      if (glob[i + 1] === '*') {
        const slash = glob[i + 2] === '/';
        source += slash ? '(?:.*/)?' : '.*';
        i += slash ? 2 : 1;
      } else {
        source += '[^/]*';
      }
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += /[\\^$.|+()[\]{}]/.test(char) ? `\\${char}` : char;
    }
  }
  return new RegExp(`^${source}$`);
}
