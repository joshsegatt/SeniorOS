// SeniorOS plugin for OpenCode 1.x, loaded from `"plugin": ["senioros"]` in opencode.json (the package's `main`).
// - registers the `senior-*` skills;
// - adds the routing rules to the system prompt;
// - stops destructive or irreversible shell commands (OpenCode's tool hook can only let a call through or fail it,
//   so a flagged command fails and the agent is told to let the user run it);
// - when a session goes idle with changed code, runs the finish gate and, on failing checks, sends the agent back.
// Every hook fails open except the guard, whose only job is to stop a command.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from '../shared/guard.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SKILLS = resolve(here, '..', '..', 'skills');
const GATE = join(here, 'gate.mjs');

let rules = '';
try {
  rules = readFileSync(join(here, 'rules.md'), 'utf8');
} catch {}

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

export const SeniorOSPlugin = async ({ client, directory }) => {
  const running = new Set();

  /** Subagent sessions report to their parent, which gets its own gate. */
  async function isChild(sessionID) {
    try {
      const res = await client.session.get({ path: { id: sessionID } });
      return Boolean((res?.data ?? res)?.parentID);
    } catch {
      return false;
    }
  }

  return {
    config: async (config) => {
      try {
        addSkills(config);
      } catch {}
    },

    'experimental.chat.system.transform': async (_input, output) => {
      if (rules && Array.isArray(output?.system) && !output.system.some((s) => s.includes('SeniorOS: engineering harness'))) {
        output.system.push(rules);
      }
    },

    'tool.execute.before': async (input, output) => {
      const message = guardDecision(input?.tool, output?.args);
      if (message) throw new Error(message);
    },

    event: async ({ event }) => {
      if (event?.type !== 'session.idle') return;
      const sessionID = event.properties?.sessionID;
      if (!sessionID || running.has(sessionID)) return;
      running.add(sessionID);
      try {
        if (await isChild(sessionID)) return;
        const reason = await runGate(directory, sessionID);
        if (reason) {
          await client.session.promptAsync({ path: { id: sessionID }, body: { parts: [{ type: 'text', text: reason }] } });
        }
      } catch {
        // Fail open: the agent may finish.
      } finally {
        running.delete(sessionID);
      }
    },
  };
};

export default { id: 'senioros', server: SeniorOSPlugin };
