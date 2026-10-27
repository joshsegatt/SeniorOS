// PostToolUse: remember which git repositories the agent touches (any tool) and changes (mutating tools),
// so context.mjs can give it the project context and the stop gate can prove the changed ones, even when
// the conversation has no workspace folder.
import { gitRootOf, log, pathsInArgs, recordRoots, runHook } from './lib.mjs';

const MUTATING = /write|replace|edit|create|delete|move|rename|run_command/i;

await runHook('PostToolUse', async (input) => {
  const name = String(input.toolCall?.name ?? '');
  const roots = [...new Set(pathsInArgs(input.toolCall?.args).map(gitRootOf).filter(Boolean))];
  if (roots.length === 0) return {};
  const before = JSON.stringify(recordRoots(input, {}));
  const state = recordRoots(input, MUTATING.test(name) ? { edited: roots } : { seen: roots });
  if (JSON.stringify(state) !== before) log('PostToolUse', { tool: name, seen: state.seen, edited: state.edited });
  return {};
});
