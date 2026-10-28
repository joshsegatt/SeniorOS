// Helpers for the OpenCode plugin. They live outside plugin.mjs because OpenCode 1.x loaders call every export of
// the plugin module as a plugin initializer.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from '../shared/guard.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SKILLS = resolve(here, '..', '..', 'skills');
const GATE = join(here, 'gate.mjs');

/** The routing rules added to the system prompt, or '' when the file cannot be read. */
export const rules = (() => {
  try {
    return readFileSync(join(here, 'rules.md'), 'utf8');
  } catch {
    return '';
  }
})();

/** @param {string} reason */
export const denyMessage = (reason) =>
  `SeniorOS guard: ${reason}. This command was not run. Show the user exactly what it would change or lose, and ` +
  'ask them to run it themselves if they confirm. Do not try another command that does the same thing.';

/**
 * The guard's decision for one tool call: a message to fail it with, or null to let it run.
 * @param {string} tool
 * @param {any} args
 */
export function guardDecision(tool, args) {
  if (tool !== 'bash') return null;
  const reason = classify(args?.command);
  return reason ? denyMessage(reason) : null;
}

/** Adds the skills folder to OpenCode's config: `skills` is an array in newer configs, `{ paths }` in older ones. */
export function addSkills(config) {
  if (Array.isArray(config.skills)) {
    if (!config.skills.includes(SKILLS)) config.skills.push(SKILLS);
    return;
  }
  config.skills = config.skills || {};
  config.skills.paths = config.skills.paths || [];
  if (!config.skills.paths.includes(SKILLS)) config.skills.paths.push(SKILLS);
}

/**
 * Runs the finish gate in a child Node process.
 * @returns {Promise<string | null>} why the agent must go back, or null
 */
export function runGate(cwd, sessionId) {
  return new Promise((done) => {
    let out = '';
    let child;
    try {
      child = spawn('node', [GATE], { cwd, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    } catch {
      done(null);
      return;
    }
    child.stdout.on('data', (d) => (out += d));
    child.on('error', () => done(null));
    child.on('close', () => {
      try {
        done(JSON.parse(out).reason ?? null);
      } catch {
        done(null);
      }
    });
    child.stdin.end(JSON.stringify({ cwd, sessionId }));
  });
}
