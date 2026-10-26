// PreToolUse (run_command): force a human confirmation for destructive or irreversible commands,
// even when terminal auto-execution is set to Turbo. Everything else passes through unchanged.
import { log, runHook } from './lib.mjs';

/** @type {Array<[RegExp, string]>} [pattern, reason]; patterns run against the whole command line. */
export const RULES = [
  // File deletion
  [/\brm\s+(-\w*[rR]\w*|--recursive)\b/, 'recursive file deletion'],
  [/\bRemove-Item\b[^|;\n]*-Recurse/i, 'recursive file deletion'],
  [/\b(rd|rmdir)\s+\/s\b/i, 'recursive folder deletion'],
  [/\bdel\s+[^|;\n]*\/s\b/i, 'recursive file deletion'],
  // Git history and uncommitted work
  [/\bgit\s+push\b[^|;\n]*(\s--force\b|\s-f\b|--force-with-lease|\s\+\S+)/, 'force push (rewrites remote history)'],
  [/\bgit\s+push\b[^|;\n]*(\s--delete\b|\s-d\b|\s:\S+)/, 'deleting a remote branch or tag'],
  [/\bgit\s+reset\s+[^|;\n]*--hard\b/, 'git reset --hard (discards work)'],
  [/\bgit\s+clean\s+-\w*f/, 'git clean (deletes untracked files)'],
  [/\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/, 'discarding all local changes'],
  [/\bgit\s+branch\s+[^|;\n]*-D\b/, 'deleting a branch without a merge check'],
  [/\bgit\s+stash\s+(drop|clear)\b/, 'deleting stashed work'],
  [/\bgit\s+(rebase|filter-branch|filter-repo)\b/, 'history rewrite'],
  // Databases
  [/\b(drop\s+(table|database|schema)|truncate\s+table)\b/i, 'deleting database data'],
  [/\bdelete\s+from\s+[\w."`\[\]]+\s*(;|"|'|$)/i, 'DELETE without WHERE'],
  [/\bprisma\s+migrate\s+reset\b|\bprisma\s+db\s+push\b[^|;\n]*--accept-data-loss/, 'Prisma reset / data loss'],
  [/\bdrizzle-kit\s+(push|drop)\b/, 'direct schema change via Drizzle'],
  [/\bsupabase\s+db\s+(reset|push)\b/, 'Supabase database reset/push'],
  // Publish / deploy / infra
  [/\b(npm|pnpm|yarn)\s+publish\b/, 'publishing a package'],
  [/\bvercel\b(?!\s+(dev|env\s+pull|link|login|logout|whoami|logs|inspect|ls|list|pull|--version|-v|help)\b)/, 'Vercel deployment'],
  [/\b(firebase|netlify|fly|flyctl|railway)\s+deploy\b|\bwrangler\s+(deploy|publish)\b/, 'deployment'],
  [/\bgcloud\b[^|;\n]*\b(deploy|delete)\b/, 'Google Cloud deploy/delete'],
  [/\bkubectl\s+(apply|delete|replace)\b/, 'Kubernetes cluster change'],
  [/\bterraform\s+(apply|destroy)\b/, 'infrastructure change'],
  [/\bdocker\s+(system\s+prune|volume\s+(rm|prune))\b/, 'deleting Docker data'],
  [/\bgh\s+(release\s+create|repo\s+delete|pr\s+merge)\b/, 'irreversible GitHub action'],
  // Remote code, system, secrets
  [/\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^|\n]*\|\s*(sh|bash|zsh|iex|Invoke-Expression|pwsh|powershell)\b/i, 'running a script downloaded from the internet'],
  [/\b(Format-Volume|diskpart|bcdedit|Stop-Computer|Restart-Computer|Set-ExecutionPolicy)\b|\bformat\s+[a-z]:|\breg\s+delete\b|\bshutdown\s+[/-]/i, 'system change'],
  [/\b(cat|type|more|less|Get-Content|gc)\s+[^|;\n]*\.env(?!\.(example|sample|template)\b)(\.\w+)?(\s|"|'|$)/i, 'printing .env secrets into the transcript'],
  [/\bgit\s+add\s+[^|;\n]*\.env(\s|$)/, 'committing a secrets file'],
  // The agent editing its own guardrails
  [/\.gemini[\\/]+(config[\\/]+(hooks|hooks\.json|config\.json|skills\.json)|GEMINI\.md)/i, "changing the agent's own rules or hooks"],
];

// Regenerable build/dependency folders: deleting only these is routine, not destructive.
const REGENERABLE = /^(\.\/|\.\\)?(node_modules|dist|build|out|\.next|\.nuxt|\.turbo|\.cache|\.parcel-cache|\.vite|coverage|target|__pycache__|\.pytest_cache)[\\/]?$/i;
const DELETE_CMD = /^\s*(rm|Remove-Item|ri|rd|rmdir|del)\b/i;

/** @param {string} command */
function onlyRegenerableTargets(command) {
  if (!DELETE_CMD.test(command) || /[|;&\n]/.test(command)) return false;
  const targets = command.trim().split(/[\s,]+/).slice(1)
    .filter((t) => t && !/^-|^\//.test(t))
    .map((t) => t.replace(/^["']|["']$/g, ''));
  return targets.length > 0 && targets.every((t) => REGENERABLE.test(t));
}

/**
 * Returns why a command needs human confirmation, or null when it may run.
 * @param {unknown} command
 * @returns {string | null}
 */
export function classify(command) {
  if (typeof command !== 'string' || !command.trim()) return null;
  if (onlyRegenerableTargets(command)) return null;
  for (const [pattern, reason] of RULES) if (pattern.test(command)) return reason;
  return null;
}

/** @param {any} toolCall */
function commandOf(toolCall) {
  const args = toolCall?.args ?? {};
  return args.CommandLine ?? args.commandLine ?? args.command ?? args.Command ?? '';
}

/**
 * Decision for commands the guard does not flag. Antigravity denies a call whose hook gives no decision,
 * so the guard always answers. `ask` keeps Antigravity's own permission flow (and its Always Allow list);
 * `allow` runs unflagged commands without a prompt, matching Turbo auto-execution.
 * @param {string[]} argv
 */
export function passthroughFrom(argv) {
  const value = argv.find((a) => a.startsWith('--passthrough='))?.split('=')[1];
  return value === 'allow' ? 'allow' : 'ask';
}

if (process.argv[1]?.endsWith('guard.mjs')) {
  const passthrough = { decision: passthroughFrom(process.argv) };
  await runHook('PreToolUse', async (input) => {
    const command = commandOf(input.toolCall);
    const reason = classify(command);
    if (!reason) return passthrough;
    log('PreToolUse', { decision: 'force_ask', reason, command: String(command).slice(0, 300) });
    return { decision: 'force_ask', reason: `SeniorOS guard: ${reason}. Confirm before running.` };
  }, passthrough);
}
