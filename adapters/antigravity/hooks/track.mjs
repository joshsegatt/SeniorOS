// PostToolUse: remember which git repositories the agent changes, so the stop gate can prove them even
// when the conversation has no workspace folder. Read-only tools are ignored.
import { addTrackedRoots, gitRootOf, log, pathsInArgs, runHook, trackedRoots } from './lib.mjs';

const MUTATING = /write|replace|edit|create|delete|move|rename|run_command/i;

await runHook('PostToolUse', async (input) => {
  const name = String(input.toolCall?.name ?? '');
  if (!MUTATING.test(name)) return {};
  const known = new Set(trackedRoots(input));
  const roots = [];
  for (const path of pathsInArgs(input.toolCall?.args)) {
    const root = gitRootOf(path);
    if (root && !known.has(root)) { roots.push(root); known.add(root); }
  }
  if (roots.length) log('PostToolUse', { tool: name, tracked: addTrackedRoots(input, roots) });
  return {};
});
