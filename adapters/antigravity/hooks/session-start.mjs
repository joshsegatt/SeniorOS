// SessionStart: inject compact project context (stack + SeniorOS decisions) for the workspace folders.
// Conversations without a workspace get the same context later, from context.mjs.
import { contextMessage, log, markInjected, projectSection, runHook, workspaceRoots } from './lib.mjs';

await runHook('SessionStart', async (input) => {
  const roots = workspaceRoots(input);
  if (roots.length === 0) {
    log('SessionStart', { roots: 0, workspacePaths: (input.workspacePaths ?? []).length });
    return {};
  }
  const message = contextMessage(roots.map(({ root, git }) => projectSection(root, git)));
  markInjected(input, roots.map((r) => r.root));
  log('SessionStart', { roots: roots.length, chars: message.length });
  return { injectSteps: [{ systemMessage: { systemMessage: message } }] };
});
