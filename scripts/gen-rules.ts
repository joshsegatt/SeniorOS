import path from 'node:path';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// The routing rules every host loads come from one template, rules/core.md, so a fix lands in all of them at once.
// Each host fills in only its first line, how skills load there (rules/hosts.json). Antigravity keeps its own
// hand-written rules (it was measured with that wording); tests/rules-sync.test.ts checks its routing parts.

/** Every generated rules file, by path from the repository root, with its content. */
export function renderRules(root: string): Map<string, string> {
  const template = readFileSync(path.join(root, 'rules', 'core.md'), 'utf8');
  if (template.split('{{skills}}').length !== 2) throw new Error('rules/core.md must hold exactly one {{skills}} line');
  const hosts = JSON.parse(readFileSync(path.join(root, 'rules', 'hosts.json'), 'utf8')) as Record<string, string>;
  return new Map(Object.entries(hosts).map(([file, skills]) => [file, template.split('{{skills}}').join(skills)]));
}

// The Claude plugin directory takes from unverified publishers only Markdown, text, JSON and images, and no hooks,
// so it lists a skills-only copy in plugins/senioros/. The guard and the finish gate stay in the full plugin.
const DIRECTORY_PLUGIN = 'plugins/senioros';

/** The skills-only plugin for the Claude directory: copies of the skills, license and icon, and its manifest. */
export function renderDirectoryPlugin(root: string): Map<string, Buffer> {
  const read = (file: string) => readFileSync(path.join(root, file));
  const files = new Map<string, Buffer>();
  for (const file of listFiles(root, 'skills')) files.set(`${DIRECTORY_PLUGIN}/${file}`, read(file));
  files.set(`${DIRECTORY_PLUGIN}/LICENSE`, read('LICENSE'));
  files.set(`${DIRECTORY_PLUGIN}/.claude-plugin/icon.png`, read('.claude-plugin/icon.png'));
  const full = JSON.parse(read('.claude-plugin/plugin.json').toString('utf8')) as Record<string, unknown>;
  // Listing fields only: anything else in the full manifest (hooks, MCP servers) the directory would refuse.
  const fields = ['name', 'displayName', 'version', 'author', 'homepage', 'repository', 'documentationUrl', 'supportUrl', 'license', 'keywords'];
  const manifest = {
    ...Object.fromEntries(fields.filter((key) => key in full).map((key) => [key, full[key]])),
    description:
      'Skills that trace a bug to its cause, size the process to the risk of each change, and review and finish with real checks. ' +
      'The guard and the finish gate come with the full plugin from the repository.',
  };
  files.set(`${DIRECTORY_PLUGIN}/.claude-plugin/plugin.json`, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
  return files;
}

/** Files under `dir` (relative to `root`, with forward slashes), sorted; none when `dir` is missing. */
function listFiles(root: string, dir: string): string[] {
  try {
    return readdirSync(path.join(root, dir), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/** Writes the generated files; with `check`, only lists the ones that differ from their sources. */
export function generateRules(root: string, check = false): string[] {
  const stale: string[] = [];
  const outputs: [string, Buffer][] = [
    ...[...renderRules(root)].map(([file, content]): [string, Buffer] => [file, Buffer.from(content)]),
    ...renderDirectoryPlugin(root),
  ];
  // A skill removed from skills/ must not stay in the directory copy.
  const expected = new Set(outputs.map(([file]) => file));
  for (const file of listFiles(root, `${DIRECTORY_PLUGIN}/skills`)) {
    if (expected.has(file)) continue;
    stale.push(file);
    if (!check) rmSync(path.join(root, file));
  }
  for (const [file, content] of outputs) {
    const target = path.join(root, file);
    let current = Buffer.alloc(0);
    try {
      current = readFileSync(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; // a missing file is stale; others are errors
    }
    if (current.equals(content)) continue;
    stale.push(file);
    if (!check) {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
  }
  return stale;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes('--check');
  const stale = generateRules(process.cwd(), check);
  if (check && stale.length) {
    console.error(`Out of date: ${stale.join(', ')}. Edit the source (rules/core.md, rules/hosts.json, skills/ or .claude-plugin/), then run npm run gen:rules.`);
    process.exitCode = 1;
  } else {
    console.log(stale.length ? `${check ? 'Stale' : 'Wrote'}: ${stale.join(', ')}` : 'Rules up to date.');
  }
}
