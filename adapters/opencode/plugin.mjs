// SeniorOS plugin for OpenCode 1.x, loaded from `"plugin": ["senioros"]` in opencode.json (the package's `main`).
// - registers the `senior-*` skills;
// - adds the routing rules to the system prompt;
// - stops destructive or irreversible shell commands (OpenCode's tool hook can only let a call through or fail it,
//   so a flagged command fails and the agent is told to let the user run it);
// - when a session goes idle with changed code, runs the finish gate and, on failing checks, sends the agent back.
// Every hook fails open except the guard, whose only job is to stop a command.
//
// The module exports only the plugin function: OpenCode 1.x loaders up to at least 1.2 call every export as
// `fn(input)`, and later 1.x loaders treat a default export that is a function the same way.
import { addSkills, guardDecision, rules, runGate } from './lib.mjs';

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

export default SeniorOSPlugin;
