// PreInvocation: when the agent has started working in a repository whose context it has not received
// (a conversation without a workspace, or a second repository), inject that project's context before the
// next model call. Runs before every model call, so the common path is a single small file read.
import { contextMessage, gitRootOf, log, projectSection, runHook, takeUninjected } from './lib.mjs';

await runHook('PreInvocation', async (input) => {
  const fresh = takeUninjected(input);
  if (fresh.length === 0) return {};
  const message = contextMessage(fresh.map((root) => projectSection(root, Boolean(gitRootOf(root)))));
  log('PreInvocation', { injected: fresh, chars: message.length });
  return { injectSteps: [{ systemMessage: { systemMessage: message } }] };
});
