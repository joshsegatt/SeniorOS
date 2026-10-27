// Switches the global Antigravity customization between bench arms, and restores the user's own config.
//
// Every arm runs the same model with ONLY its pack loaded: the user's global skills folder is parked,
// global rules are replaced, and skills/hooks are registered per arm. The original files are backed up
// once and restored byte-for-byte by `restoreArms()`.
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BENCH_HOME, BENCH_SRC, GEMINI_HOME, REPO_ROOT, SUPERPOWERS_DIR } from './util.mjs';

const CONFIG = join(GEMINI_HOME, 'config');
const STATE = join(BENCH_HOME, 'arm-state.json');
/** Files the bench replaces, relative to GEMINI_HOME. */
const MANAGED = ['GEMINI.md', 'AGENTS.md', 'config/skills.json', 'config/hooks.json'];
const SKILLS_DIR = join(CONFIG, 'skills');
const PARKED_SKILLS = join(CONFIG, 'skills.bench-parked');

const fwd = (p) => p.replace(/\\/g, '/');
/** Antigravity splits hook commands on whitespace without a shell: no quotes, and no spaces in paths. */
function node(script, ...args) {
  const path = fwd(script);
  if (/\s/.test(path)) throw new Error(`Hook path contains a space, which Antigravity cannot run: ${path}. Move the repository to a path without spaces.`);
  return ['node', path, ...args].join(' ');
}
const ADAPTER_HOOKS = join(REPO_ROOT, 'adapters', 'antigravity', 'hooks');
const MARKER = join(BENCH_SRC, 'hooks', 'marker.mjs');

/** Lets the runner see when a conversation starts and stops, in every arm. */
const markerHooks = () => ({
  'bench-marker': {
    SessionStart: [{ type: 'command', command: node(MARKER, 'SessionStart'), timeout: 10 }],
    Stop: [{ type: 'command', command: node(MARKER, 'Stop'), timeout: 10 }],
  },
});

// Built lazily so a bad path fails when an arm is applied, not when the module loads.
// The guard passes unflagged commands with `allow`, like the hookless arms under Turbo auto-execution.
const senioros = () => ({
  'senioros-context': { SessionStart: [{ type: 'command', command: node(join(ADAPTER_HOOKS, 'session-start.mjs')), timeout: 20 }] },
  'senioros-guard': { PreToolUse: [{ matcher: 'run_command', hooks: [{ type: 'command', command: node(join(ADAPTER_HOOKS, 'guard.mjs'), '--passthrough=allow'), timeout: 10 }] }] },
  'senioros-late-context': { PreInvocation: [{ type: 'command', command: node(join(ADAPTER_HOOKS, 'context.mjs')), timeout: 20 }] },
  'senioros-track': { PostToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: node(join(ADAPTER_HOOKS, 'track.mjs')), timeout: 10 }] }] },
  'senioros-finish-gate': { Stop: [{ type: 'command', command: node(join(ADAPTER_HOOKS, 'stop-gate.mjs')), timeout: 300 }] },
});

const NO_RULES = '<!-- SeniorOS bench: no global rules for this arm -->\n';

/** @type {Record<string, { description: string, rules: () => string, skills: () => string[], hooks: () => object }>} */
export const ARMS = {
  none: {
    description: 'Model only: no pack, no global rules, no hooks.',
    rules: () => NO_RULES,
    skills: () => [],
    hooks: () => ({}),
  },
  superpowers: {
    description: 'Superpowers as its Antigravity plugin ships: skills only, bootstrapped by the using-superpowers description.',
    rules: () => NO_RULES,
    skills: () => [fwd(join(SUPERPOWERS_DIR, 'skills'))],
    hooks: () => ({}),
  },
  senioros: {
    description: 'SeniorOS Antigravity adapter: senior-* skills, routing rules and the three hooks.',
    rules: () => readFileSync(join(REPO_ROOT, 'adapters', 'antigravity', 'rules.md'), 'utf8'),
    skills: () => [fwd(join(REPO_ROOT, 'skills'))],
    hooks: senioros,
  },
  'senioros-skills': {
    description: 'SeniorOS skills and rules without hooks (isolates the effect of the hooks).',
    rules: () => readFileSync(join(REPO_ROOT, 'adapters', 'antigravity', 'rules.md'), 'utf8'),
    skills: () => [fwd(join(REPO_ROOT, 'skills'))],
    hooks: () => ({}),
  },
};

export function armState() {
  return existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : null;
}

function saveState(state) {
  mkdirSync(BENCH_HOME, { recursive: true });
  writeFileSync(STATE, JSON.stringify(state, null, 2));
}

/** Backs up the user's config once; later calls reuse the same backup. */
function ensureBackup() {
  const existing = armState();
  if (existing) return existing;
  if (existsSync(PARKED_SKILLS)) throw new Error(`${PARKED_SKILLS} already exists without bench state. Restore it by hand first.`);
  const backupDir = join(BENCH_HOME, 'config-backup', new Date().toISOString().replace(/[:.]/g, '-'));
  mkdirSync(backupDir, { recursive: true });
  /** @type {Record<string, boolean>} */
  const files = {};
  for (const rel of MANAGED) {
    const src = join(GEMINI_HOME, rel);
    files[rel] = existsSync(src);
    if (files[rel]) {
      mkdirSync(join(backupDir, rel, '..'), { recursive: true });
      copyFileSync(src, join(backupDir, rel));
    }
  }
  const parkedSkills = existsSync(SKILLS_DIR);
  if (parkedSkills) renameSync(SKILLS_DIR, PARKED_SKILLS);
  const state = { backupDir, files, parkedSkills, arm: null, since: new Date().toISOString() };
  saveState(state);
  return state;
}

/** @param {string} name */
export function applyArm(name) {
  const arm = ARMS[name];
  if (!arm) throw new Error(`Unknown arm "${name}". Known: ${Object.keys(ARMS).join(', ')}`);
  if (name === 'superpowers' && !existsSync(join(SUPERPOWERS_DIR, 'skills', 'using-superpowers', 'SKILL.md'))) {
    throw new Error(`Superpowers not found at ${SUPERPOWERS_DIR}. Clone obra/superpowers there or set SENIOROS_BENCH_SUPERPOWERS.`);
  }
  const state = ensureBackup();
  mkdirSync(CONFIG, { recursive: true });
  writeFileSync(join(GEMINI_HOME, 'GEMINI.md'), arm.rules());
  writeFileSync(join(GEMINI_HOME, 'AGENTS.md'), NO_RULES);
  writeFileSync(join(CONFIG, 'skills.json'), JSON.stringify({ entries: arm.skills().map((path) => ({ path })) }, null, 2) + '\n');
  writeFileSync(join(CONFIG, 'hooks.json'), JSON.stringify({ ...markerHooks(), ...arm.hooks() }, null, 2) + '\n');
  saveState({ ...state, arm: name });
}

/** Puts the user's own Antigravity config back exactly as it was. Safe to call when nothing is applied. */
export function restoreArms() {
  const state = armState();
  if (!state) return false;
  for (const [rel, existed] of Object.entries(state.files)) {
    const target = join(GEMINI_HOME, rel);
    if (existed) copyFileSync(join(state.backupDir, rel), target);
    else rmSync(target, { force: true });
  }
  if (state.parkedSkills) {
    if (existsSync(SKILLS_DIR)) throw new Error(`${SKILLS_DIR} was recreated during the bench; merge it with ${PARKED_SKILLS} by hand.`);
    renameSync(PARKED_SKILLS, SKILLS_DIR);
  }
  rmSync(STATE, { force: true });
  return true;
}
