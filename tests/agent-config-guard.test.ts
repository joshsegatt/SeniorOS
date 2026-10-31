import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const load = async <T>(...parts: string[]) => (await import(pathToFileURL(path.join(root, ...parts)).href)) as T;
const shared = await load<{
  classify: (c: string) => string | null;
  patchTargets: (p: unknown) => string[];
  editReason: (paths: unknown[]) => string | null;
  AGENT_CONFIG_REASON: string;
}>('adapters', 'shared', 'guard.mjs');
const claude = await load<{ decide: (raw: string) => { hookSpecificOutput: { permissionDecision: string } } | null }>('adapters', 'claude-code', 'hooks', 'pretool-guard.mjs');
const codex = await load<{ decide: (raw: string) => { hookSpecificOutput: { permissionDecision: string } } | null }>('adapters', 'codex', 'hooks', 'guard.mjs');
const opencode = await load<{ guardDecision: (tool: string, args: object) => string | null }>('adapters', 'opencode', 'lib.mjs');

// An agent that can rewrite its host's settings, hooks or plugins can switch the guard and the finish gate off.
const changes = [
  'echo {} > ~/.claude/settings.json',
  'rm -rf ~/.claude/plugins/cache/senioros',
  'Set-Content C:\\Users\\me\\.claude\\settings.local.json "{}"',
  'Set-Content C:\\Users\\me\\.codex\\config.toml x',
  'mv hooks.json .codex/hooks.json',
  'sed -i "s/true/false/" .cursor/hooks.json',
  'cp mine.json opencode.json',
  'Remove-Item ~/.config/opencode/plugins/senioros.mjs',
  'git checkout -- .claude/settings.json',
  `node -e "require('fs').writeFileSync('.claude/settings.json', '{}')"`,
  `python -c "open('.codex/config.toml', 'w').write('')"`,
  'Set-Content C:\\Users\\me\\.gemini\\config\\hooks.json x',
  'cd app && tee .cursor/hooks.json < new.json',
  // Review findings on #24: a shell redirection after an interpreter, and a `;` inside a quoted script.
  `python -c "print('{}')" > .gemini/config/hooks.json`,
  `node -e "const fs = require('fs'); fs.writeFileSync('.gemini/config/hooks.json', '{}')"`,
  `node -e "const fs = require('fs'); fs.writeFileSync('.claude/settings.json', '{}')" && git status`,
  // Quoted text can run: shell scripts, combined options and command substitutions (review findings on #25).
  `bash -c "echo {} > ~/.claude/settings.json"`,
  `bash -lc "echo x > .claude/settings.json"`,
  `echo "$(tee .claude/settings.json < new.json)"`,
  `pwsh -Command "'{}' | Set-Content .codex/hooks.json"`,
  // A `>` inside quotes also asks: quoted text cannot be told apart from code that runs.
  'grep ">" .cursor/hooks.json',
];
const reads = [
  'cat ~/.claude/settings.json',
  'cat .claude/settings.json 2>/dev/null',
  'Get-Content $HOME\\.codex\\config.toml',
  'grep -n hooks .cursor/hooks.json',
  `node -e "console.log(require('./opencode.json'))"`,
  'ls .claude/plugins',
  'jq . opencode.json',
  'cat ~/.gemini/GEMINI.md',
  `python -c "import json; print(len(json.load(open('.codex/hooks.json'))))"`,
  // Not agent configuration: plugin manifests in a repository, skills, ordinary files.
  'cat .codex-plugin/plugin.json > /tmp/manifest.json',
  'cp skills/a/SKILL.md .claude/skills/a/SKILL.md',
  'echo hi > notes.txt',
];

test('guard asks before a shell command changes the agent configuration, and lets reads through', () => {
  for (const command of changes) assert.equal(shared.classify(command), shared.AGENT_CONFIG_REASON, command);
  for (const command of reads) assert.equal(shared.classify(command), null, command);
});

test('patch targets cover added, updated, deleted and moved files', () => {
  const patch = [
    '*** Begin Patch',
    '*** Update File: src/a.ts',
    '*** Move to: src/b.ts',
    '*** Add File: C:\\Users\\me\\.codex\\hooks.json',
    '*** Delete File: old.txt',
    '*** End Patch',
  ].join('\n');
  assert.deepEqual(shared.patchTargets(patch), ['src/a.ts', 'src/b.ts', 'C:\\Users\\me\\.codex\\hooks.json', 'old.txt']);
  assert.equal(shared.editReason(shared.patchTargets(patch)), shared.AGENT_CONFIG_REASON);
  assert.equal(shared.editReason(['src/a.ts', undefined]), null);
  assert.deepEqual(shared.patchTargets(undefined), []);
});

test('each host guards its file-edit tools, not only the shell', () => {
  const ask = (raw: object) => claude.decide(JSON.stringify(raw))?.hookSpecificOutput.permissionDecision;
  assert.equal(ask({ tool_name: 'Edit', tool_input: { file_path: '/home/me/.claude/settings.json' } }), 'ask');
  assert.equal(ask({ tool_name: 'Write', tool_input: { file_path: 'C:\\repo\\.claude\\settings.local.json' } }), 'ask');
  assert.equal(ask({ tool_name: 'Edit', tool_input: { file_path: '/repo/src/a.ts' } }), undefined);
  // The edit tools carry no command: a file whose contents mention `rm -rf` is not a destructive command.
  assert.equal(ask({ tool_name: 'Write', tool_input: { file_path: '/repo/run.sh', content: 'rm -rf src' } }), undefined);
  assert.equal(ask({ tool_name: 'Bash', tool_input: { command: 'git push --force origin main' } }), 'ask');

  const deny = (raw: object) => codex.decide(JSON.stringify(raw))?.hookSpecificOutput.permissionDecision;
  assert.equal(deny({ tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Update File: /home/me/.codex/config.toml\n*** End Patch' } }), 'deny');
  // A patch that only adds a script mentioning `rm -rf` is judged by the files it writes.
  assert.equal(deny({ tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Add File: clean.sh\n+rm -rf build\n*** End Patch' } }), undefined);
  assert.equal(deny({ tool_name: 'Bash', tool_input: { command: 'echo x > ~/.codex/hooks.json' } }), 'deny');

  assert.match(opencode.guardDecision('edit', { filePath: '/home/me/.config/opencode/opencode.json' }) ?? '', /SeniorOS guard/);
  assert.match(opencode.guardDecision('write', { filePath: 'C:\\repo\\.opencode\\plugins\\x.mjs' }) ?? '', /SeniorOS guard/);
  assert.match(opencode.guardDecision('apply_patch', { patchText: '*** Update File: opencode.json\n' }) ?? '', /SeniorOS guard/);
  assert.equal(opencode.guardDecision('edit', { filePath: '/repo/src/a.ts' }), null);
  assert.match(opencode.guardDecision('bash', { command: 'rm -rf src' }) ?? '', /SeniorOS guard/);
});
