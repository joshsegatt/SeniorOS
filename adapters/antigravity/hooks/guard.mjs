// PreToolUse (run_command): force a human confirmation for destructive or irreversible commands,
// even when terminal auto-execution is set to Turbo. Everything else passes through unchanged.
import { log, runHook } from './lib.mjs';

/** @type {Array<[RegExp, string]>} [pattern, reason]; patterns run against the whole command line. */
export const RULES = [
  // File deletion
  [/\brm\s+(-\w*[rR]\w*|--recursive)\b/, 'recursive file deletion'],
  // PowerShell accepts any prefix of a parameter name (`-r`, `-rec`), and `ri`, `del`, `erase`, `rd` are its aliases.
  [/\b(Remove-Item|ri|del|erase|rd|rmdir)\b[^|;\n]*\s-r(e(c(u(r(se?)?)?)?)?)?\b/i, 'recursive file deletion'],
  [/\b(rd|rmdir)\s+\/s\b/i, 'recursive folder deletion'],
  [/\bdel\s+[^|;\n]*\/s\b/i, 'recursive file deletion'],
  [/\b(rimraf|del-cli)\s+\S/, 'recursive file deletion'],
  [/\bfind\b[^|;\n]*\s(-delete\b|-exec(dir)?\s+(rm|del|unlink|shred)\b)/, 'deleting the files find matches'],
  [/\brsync\b[^|;\n]*\s--(delete(-\w+)?|remove-source-files)\b/, 'rsync deleting files at the destination'],
  // An interpreter one-liner deletes through calls, not shell syntax.
  [/\b(node|python3?|py|ruby|perl|php|deno|bun)\b[^|]*?\s-(e|c|-eval)\b.*(shutil\.rmtree|\b(rmSync|rm|rmdirSync|rmdir)\s*\([^)]*recursive\s*:\s*true|FileUtils\.rm_r|remove_dir_all)/i, 'recursive file deletion'],
  // Git history and uncommitted work
  [/\bgit\s+push\b[^|;\n]*(\s--force\b|\s-f\b|--force-with-lease|\s\+\S+)/, 'force push (rewrites remote history)'],
  [/\bgit\s+push\b[^|;\n]*\s--mirror\b/, 'mirror push (overwrites and deletes remote branches)'],
  [/\bgit\s+push\b[^|;\n]*(\s--delete\b|\s-d\b|\s:\S+|\s--prune\b)/, 'deleting a remote branch or tag'],
  [/\bgit\s+reset\s+[^|;\n]*--hard\b/, 'git reset --hard (discards work)'],
  [/\bgit\s+clean\s+-\w*f/, 'git clean (deletes untracked files)'],
  [/\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/, 'discarding all local changes'],
  [/\bgit\s+branch\s+[^|;\n]*-D\b/, 'deleting a branch without a merge check'],
  [/\bgit\s+branch\b(?=[^|;\n]*\s(-\w*d\w*|--delete)\b)(?=[^|;\n]*\s(-\w*f\w*|--force)\b)/, 'deleting a branch without a merge check'],
  [/\bgit\s+update-ref\s+[^|;\n]*-d\b/, 'deleting a git ref'],
  [/\bgit\s+(reflog\s+(expire|delete)\b|gc\b[^|;\n]*--prune=(now|all)\b|prune\b)/, 'deleting the recovery points of lost commits'],
  [/\bgit\s+worktree\s+remove\b[^|;\n]*(\s-f\b|\s--force\b)/, 'removing a worktree with uncommitted changes'],
  [/\bgit\s+stash\s+(drop|clear)\b/, 'deleting stashed work'],
  [/\bgit\s+(rebase|filter-branch|filter-repo)\b/, 'history rewrite'],
  // Databases
  [/\b(drop\s+(table|database|schema)|truncate\s+table)\b/i, 'deleting database data'],
  [/\bdelete\s+from\s+[\w."`\[\]]+\s*(;|"|'|$)/i, 'DELETE without WHERE'],
  [/\bprisma\s+migrate\s+reset\b|\bprisma\s+db\s+push\b[^|;\n]*--accept-data-loss/, 'Prisma reset / data loss'],
  [/\bdrizzle-kit\s+(push|drop)\b/, 'direct schema change via Drizzle'],
  [/\bsupabase\s+db\s+(reset|push)\b/, 'Supabase database reset/push'],
  [/\bredis-cli\b[^|;\n]*\b(flushall|flushdb)\b/i, 'deleting database data'],
  [/\b(mongo|mongosh)\b[^|\n]*(dropDatabase\s*\(|\.drop\s*\(\s*\)|deleteMany\s*\(\s*\{\s*\}\s*\))/, 'deleting database data'],
  // Publish / deploy / infra
  [/\b(npm|pnpm|yarn)\s+(publish|unpublish|deprecate)\b(?![^|;\n]*--dry-run)/, 'publishing a package'],
  [/\b(cargo\s+publish|twine\s+upload|gem\s+push|poetry\s+publish|uv\s+publish|flit\s+publish|dotnet\s+nuget\s+push)\b(?![^|;\n]*--dry-run)/, 'publishing a package'],
  [/\b(docker|podman)\s+(image\s+)?push\b/, 'publishing a container image'],
  [/\bvercel\b(?!\s+(dev|env\s+pull|link|login|logout|whoami|logs|inspect|ls|list|pull|--version|-v|help)\b)/, 'Vercel deployment'],
  [/\b(firebase|netlify|fly|flyctl|railway)\s+deploy\b|\bwrangler\s+(deploy|publish)\b/, 'deployment'],
  [/\bgcloud\b[^|;\n]*\b(deploy|delete)\b/, 'Google Cloud deploy/delete'],
  [/\bkubectl\s+(apply|delete|replace)\b/, 'Kubernetes cluster change'],
  [/\bterraform\s+(apply|destroy)\b/, 'infrastructure change'],
  [/\bdocker\s+(system\s+prune|volume\s+(rm|prune))\b/, 'deleting Docker data'],
  [/\bgh\s+(release\s+(create|delete)|repo\s+(delete|archive)|pr\s+merge|issue\s+delete|secret\s+delete|variable\s+delete)\b/, 'irreversible GitHub action'],
  [/\bgh\s+api\b[^|;\n]*(-X|--method)[\s=]*["']?DELETE\b/i, 'irreversible GitHub action'],
  [/\baws\s+s3\s+(rm\b[^|;\n]*--recursive|rb\b|sync\b[^|;\n]*\s--delete\b)|\baws\s+[\w-]+\s+(delete|terminate|remove|deregister)-[\w-]+/, 'deleting cloud resources'],
  [/\bhelm\s+(uninstall|delete)\b|\bheroku\s+(apps:destroy|pg:reset)\b|\bpulumi\s+(up|destroy)\b|\b(az|doctl)\s+[^|;\n]*\bdelete\b/, 'infrastructure change'],
  // Remote code, system, secrets
  [/\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^|\n]*\|\s*(sh|bash|zsh|iex|Invoke-Expression|pwsh|powershell)\b/i, 'running a script downloaded from the internet'],
  [/\b(Format-Volume|diskpart|bcdedit|Stop-Computer|Restart-Computer|Set-ExecutionPolicy)\b|\bformat\s+[a-z]:|\breg\s+delete\b|\bshutdown\s+[/-]/i, 'system change'],
  [/\bdd\b[^|;\n]*\bof=\/dev\/(?!null\b)|\b(mkfs(\.\w+)?|wipefs)\s/, 'system change'],
  [/^\s*(printenv|env|Get-ChildItem\s+env:|gci\s+env:|dir\s+env:|ls\s+env:)\s*$/i, 'printing environment variables (secrets) into the transcript'],
  [/\b(echo|printf|Write-Output|Write-Host)\b[^|;\n]*\$(\{|env:)?\w*(SECRET|TOKEN|PASSWORD|PASSWD|_KEY|CREDENTIALS?)\b/i, 'printing a secret into the transcript'],
  [/\b(cat|type|more|less|Get-Content|gc)\s+[^|;\n]*\.env(?!\.(example|sample|template)\b)(\.\w+)?(\s|"|'|$)/i, 'printing .env secrets into the transcript'],
  [/\bgit\s+add\s+[^|;\n]*\.env(\s|$)/, 'committing a secrets file'],
];

export const AGENT_CONFIG_REASON = "changing the agent's own settings, hooks or plugins";

/**
 * The agent's own configuration in every host SeniorOS supports: settings, hooks and installed plugins. Turning a
 * guard off is the user's call, so changing these needs their confirmation; reading them stays free. Skills folders
 * are not here: installing or editing skills is ordinary work.
 */
const AGENT_CONFIG = [
  /\.claude[\\/]+(settings(\.local)?\.json|plugins[\\/])/i,
  /\.codex[\\/]+(config\.toml|hooks\.json|requirements\.toml|plugins[\\/])/i,
  /\.cursor[\\/]+(hooks\.json|plugins[\\/])/i,
  /(^|[\\/\s"'=])opencode\.jsonc?(?![\w.-])/i,
  /(\.opencode|[\\/]opencode)[\\/]+plugins?[\\/]/i,
  /\.gemini[\\/]+(config[\\/]+(hooks|hooks\.json|config\.json|skills\.json)|GEMINI\.md)/i,
];

/** @param {unknown} path */
export const isAgentConfigPath = (path) => typeof path === 'string' && AGENT_CONFIG.some((r) => r.test(path));

// Shell operations that change a file. Redirections to the null device are not writes.
const WRITES = /(^|[^<>=!-])>{1,2}|\b(rm|del|erase|rd|rmdir|mv|move|cp|copy|tee|truncate|touch|chmod|ln|unlink|Set-Content|Add-Content|Out-File|Remove-Item|Move-Item|Copy-Item|New-Item|Rename-Item|Clear-Content)\b|\bsed\s+(-\w+\s+)*-i|\bperl\s+-\w*i|\bgit\s+(checkout|restore|rm|mv)\b/i;
const INTERPRETER = /\b(node|python3?|py|ruby|perl|php|deno|bun|pwsh|powershell)\b[^|]*?\s-(e|c|Command)\b/i;
const INTERPRETER_WRITE = /write|append|unlink|\brm(Sync|tree|dir)?\b|rename|remove|delete|truncate|copy|move|Set-Content|Out-File|\bopen\([^)]*["'][wax]/i;

/** True when a single shell command changes one of the agent's own configuration files. */
function changesAgentConfig(segment) {
  if (!isAgentConfigPath(segment)) return false;
  const s = segment.replace(/\d*>+\s*(\/dev\/null|\$null|nul)(?![\w.])/gi, ' ').replace(/\d*>&\d/g, ' ');
  // Writes are looked for in the whole command, quotes included: quoted text can run (`"$(tee …)"`, `bash -lc "…"`),
  // and no list of wrappers is complete. The price is that a `>` inside a quoted pattern also asks.
  if (WRITES.test(s)) return true;
  // An interpreter's script writes through calls, not shell syntax.
  return INTERPRETER.test(s) && INTERPRETER_WRITE.test(s);
}

/**
 * Splits a command line into the commands it chains (`&&`, `||`, `;`, newlines), leaving quoted arguments whole:
 * `node -e "a(); b()"` is one command.
 * @param {string} command
 */
function splitOutsideQuotes(command) {
  const parts = [];
  let current = '';
  let quote = '';
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === '\\' && quote === '"' && i + 1 < command.length) { current += c + command[++i]; continue; }
      if (c === quote) quote = '';
      current += c;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; current += c; continue; }
    const two = command.slice(i, i + 2);
    if (two === '&&' || two === '||') { parts.push(current); current = ''; i++; continue; }
    if (c === ';' || c === '\n' || c === '\r') { parts.push(current); current = ''; continue; }
    current += c;
  }
  parts.push(current);
  return parts;
}

// Regenerable build/dependency folders: deleting only these is routine, not destructive.
const REGENERABLE = /^(\.\/|\.\\)?(node_modules|dist|build|out|\.next|\.nuxt|\.turbo|\.cache|\.parcel-cache|\.vite|coverage|target|__pycache__|\.pytest_cache)[\\/]?$/i;
const DELETE_CMD = /^\s*(rm|Remove-Item|ri|rd|rmdir|del|rimraf)\b/i;
const CMD_STYLE = /^\s*(rd|rmdir|del)\b/i;

/**
 * True only when every deletion target is a regenerable folder. Options start with `-`; a `/x` switch counts as
 * an option only for cmd-style commands, so a POSIX absolute path such as `/home/user/project` stays a target.
 * @param {string} command
 */
function onlyRegenerableTargets(segment) {
  if (/[|;&\n]/.test(segment)) return false;
  // `npx rimraf dist` is the same deletion as `rimraf dist`.
  const command = segment.replace(/^\s*(npx|bunx|(pnpm|yarn)\s+dlx)\s+(-y\s+|--yes\s+)?/, '');
  if (/^\s*git\s+clean\b/.test(command)) return gitCleanOnlyRegenerable(command);
  if (!DELETE_CMD.test(command)) return false;
  const cmdStyle = CMD_STYLE.test(command);
  const targets = command.trim().split(/[\s,]+/).slice(1)
    .filter((t) => t && !t.startsWith('-') && !(cmdStyle && /^\/[a-z]$/i.test(t)))
    .map((t) => t.replace(/^["']|["']$/g, ''));
  return targets.length > 0 && targets.every((t) => REGENERABLE.test(t));
}

/**
 * `git clean` limited by pathspec to regenerable folders (`git clean -fdX -- dist coverage`). Without a pathspec it
 * cleans the whole tree, including ignored user data such as a local database or `.env.local`, so it stays flagged.
 * @param {string} command
 */
function gitCleanOnlyRegenerable(command) {
  const tokens = command.trim().split(/\s+/).slice(2).map((t) => t.replace(/^["']|["']$/g, ''));
  const paths = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '-e' || t === '--exclude') { i++; continue; }
    if (t.startsWith('-')) continue;
    paths.push(t);
  }
  return paths.length > 0 && paths.every((p) => REGENERABLE.test(p));
}

// git's global options come before the subcommand (`git -C ../app push --force`); without them, every git rule sees
// the subcommand where it expects it.
const GIT_GLOBALS = /\bgit((?:\s+(?:-[Cc]\s+(?:"[^"]*"|'[^']*'|\S+)|--(?:git-dir|work-tree|namespace|exec-path|config-env)(?:=|\s+)(?:"[^"]*"|'[^']*'|\S+)|--no-pager|--paginate|-p|-P|--bare|--no-replace-objects|--literal-pathspecs|--glob-pathspecs|--noglob-pathspecs|--icase-pathspecs|--no-optional-locks))+)(?=\s)/g;
const withoutGitGlobals = (segment) => segment.replace(GIT_GLOBALS, 'git');

// A commit message, title or search pattern is text, not a command: `git commit -m "drop rimraf"` deletes nothing.
// Only quoted values the shell cannot run are blanked: double quotes with `$(…)` or backticks still execute.
const MESSAGE = /(\s(?:-m|--message|-t|--title|-b|--body|--grep|--notes?|--subject)(?:=|\s+))("(?:[^"$`\\]|\\[^$`])*"|'[^']*')/g;
const withoutMessages = (segment) => segment.replace(MESSAGE, '$1""');

/**
 * A pathspec that reaches more than one file: `.`, a folder, a glob, or a name without an extension. The text cannot
 * tell a folder from a file without an extension, so `git restore Makefile` also asks.
 */
function broadPathspec(spec) {
  const p = spec.replace(/^["']|["']$/g, '');
  if (p === '.' || p === './' || p === ':/' || /[*?[]/.test(p) || /[\\/]$/.test(p) || p.startsWith(':(')) return true;
  return !/\.[\w-]+$/.test(p.split(/[\\/]/).pop() ?? '');
}

/**
 * `git checkout`, `restore` and `switch` that throw away uncommitted changes beyond one file: `-f`, or a folder,
 * `.` or a glob as the pathspec. One file (`git restore src/a.ts`) is routine. `git checkout name` without `--` is
 * usually a branch switch, which git refuses when it would lose changes, so it is not flagged.
 * @param {string} segment
 */
function discardsChanges(segment) {
  const m = /\bgit\s+(checkout|restore|switch)\b(.*)$/.exec(segment);
  if (!m) return false;
  const [, sub, rest] = m;
  const tokens = (rest ?? '').split(/[|;&]/)[0].trim().split(/\s+/).filter(Boolean);
  if (tokens.some((t) => t === '-f' || t === '--force' || t === '--discard-changes')) return true;
  if (sub === 'switch') return false;
  const dash = tokens.indexOf('--');
  if (sub === 'checkout') return dash >= 0 && tokens.slice(dash + 1).some(broadPathspec);
  // restore: staging only (`--staged` without `--worktree`) keeps the files as they are.
  if (tokens.some((t) => t === '--staged' || t === '-S') && !tokens.some((t) => t === '--worktree' || t === '-W')) return false;
  const specs = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i] ?? '';
    if (i > dash && dash >= 0) { specs.push(t); continue; }
    if (t === '--source' || t === '-s') { i++; continue; }
    if (t.startsWith('-')) continue;
    specs.push(t);
  }
  return specs.some(broadPathspec);
}

/**
 * Returns why a command needs human confirmation, or null when it may run.
 * @param {unknown} command
 * @returns {string | null}
 */
export function classify(command) {
  if (typeof command !== 'string' || !command.trim()) return null;
  // Agents chain commands (`cd <repo> && rm -rf dist && git status`): judge each one on its own, so a harmless
  // `cd` does not cost a build folder its exemption and one command's argument cannot complete another's pattern.
  // Pipes stay inside a segment, so `curl … | sh` is still seen whole. Both splits are judged: the plain one, as
  // before, and one that keeps quoted arguments whole, so a `;` inside `node -e "…"` cannot cut a script in two.
  const segments = new Set([...command.split(/&&|\|\||;|\r?\n/), ...splitOutsideQuotes(command)]);
  for (const raw of segments) {
    const segment = withoutMessages(withoutGitGlobals(raw));
    if (!segment.trim() || onlyRegenerableTargets(segment)) continue;
    if (changesAgentConfig(segment)) return AGENT_CONFIG_REASON;
    for (const [pattern, reason] of RULES) if (pattern.test(segment)) return reason;
    if (discardsChanges(segment)) return 'discarding uncommitted changes';
  }
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

// Run only as the hook itself, not when another script (such as the Claude Code guard) imports classify().
if (/[\\/]guard\.mjs$/.test(process.argv[1] ?? '')) {
  const passthrough = { decision: passthroughFrom(process.argv) };
  await runHook('PreToolUse', async (input) => {
    const command = commandOf(input.toolCall);
    const reason = classify(command);
    if (!reason) return passthrough;
    log('PreToolUse', { decision: 'force_ask', reason, command: String(command).slice(0, 300) });
    return { decision: 'force_ask', reason: `SeniorOS guard: ${reason}. Confirm before running.` };
  }, passthrough);
}
