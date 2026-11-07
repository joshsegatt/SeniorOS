// Any Claude Code plugin as a bench arm: `--packs name=source`, so a pack's author can measure it without editing
// the bench. A source is a local plugin folder, or a git repository pinned to a full commit, so a result names
// exactly the code that ran:
//
//   --packs mine=../my-plugin
//   --packs theirs=https://github.com/owner/repo@<40-hex commit>
//   --packs theirs=owner/repo@<40-hex commit>#plugins/theirs     (the plugin in a subfolder)
//
// A pinned repository is cloned once into the bench home and checked out at that commit. The plugin runs exactly as
// `claude --plugin-dir` would load it for a user (its skills, hooks and commands), inside the run's own repository.
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { BENCH_HOME, git } from './util.mjs';

const NAME = /^[a-z0-9][a-z0-9-]{0,30}$/;
const COMMIT = /^[0-9a-f]{40}$/;

/**
 * Parses `name=source,name=source`.
 * @param {string} spec
 * @param {string[]} reserved arm names a pack may not take
 * @returns {{ name: string, kind: 'local' | 'git', source: string, url?: string, commit?: string, subdir?: string }[]}
 */
export function parsePacks(spec, reserved = []) {
  const packs = [];
  for (const entry of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    const eq = entry.indexOf('=');
    if (eq < 1) throw new Error(`--packs entry "${entry}" needs name=source.`);
    const name = entry.slice(0, eq);
    const source = entry.slice(eq + 1);
    if (!NAME.test(name)) throw new Error(`Pack name "${name}": use lowercase letters, digits and dashes (up to 31).`);
    if (reserved.includes(name)) throw new Error(`Pack name "${name}" is a built-in arm; pick another name.`);
    if (packs.some((p) => p.name === name)) throw new Error(`Pack name "${name}" is given twice.`);
    const git = /^(?<repo>.+)@(?<commit>[^@#]+)(?:#(?<subdir>.+))?$/.exec(source);
    // A Windows path never has "@", so "@" marks a pinned repository.
    if (git?.groups) {
      const { repo, commit, subdir } = git.groups;
      if (!COMMIT.test(commit)) throw new Error(`Pack "${name}": pin a full 40-character commit after "@", not "${commit}", so the result names the code that ran.`);
      if (subdir && (isAbsolute(subdir) || subdir.split(/[\\/]/).includes('..'))) throw new Error(`Pack "${name}": the folder after "#" must stay inside the repository.`);
      const url = /^[\w.-]+\/[\w.-]+$/.test(repo) ? `https://github.com/${repo}.git` : repo;
      if (!/^https:\/\//.test(url)) throw new Error(`Pack "${name}": clone over https (owner/repo or an https URL), not "${repo}".`);
      packs.push({ name, kind: 'git', source, url, commit, subdir });
    } else {
      packs.push({ name, kind: 'local', source });
    }
  }
  return packs;
}

/**
 * Where a checkout came from: its commit, and whether it had uncommitted changes. Null fields outside git.
 * @param {string} dir
 * @param {string} source what to call it in a result (a repository name or a path)
 */
export function gitProvenance(dir, source) {
  const head = existsSync(dir) ? git(dir, ['rev-parse', 'HEAD'], false) : null;
  if (head?.code !== 0) return { source, commit: null };
  const dirty = git(dir, ['status', '--porcelain'], false).out.trim() !== '';
  return { source, commit: head.out.trim(), dirty };
}

/**
 * The plugin folder of a pack, cloning a pinned repository on first use, and where it came from.
 * @param {ReturnType<typeof parsePacks>[number]} pack
 * @returns {{ dir: string, provenance: { source: string, commit: string | null, dirty?: boolean } }}
 */
export function resolvePack(pack) {
  let root;
  let provenance;
  if (pack.kind === 'git') {
    root = join(BENCH_HOME, 'packs', `${pack.name}-${pack.commit.slice(0, 12)}`);
    if (!existsSync(join(root, '.git'))) {
      rmSync(root, { recursive: true, force: true });
      mkdirSync(root, { recursive: true });
      git(root, ['init', '-q']);
      git(root, ['remote', 'add', 'origin', pack.url]);
      git(root, ['fetch', '-q', '--depth', '1', 'origin', pack.commit]);
    }
    git(root, ['checkout', '-q', '--force', pack.commit]);
    git(root, ['clean', '-q', '-fdx']);
    provenance = { source: pack.source, url: pack.url, commit: pack.commit, ...(pack.subdir ? { subdir: pack.subdir } : {}) };
  } else {
    root = resolve(pack.source);
    provenance = gitProvenance(root, pack.source);
  }
  const dir = pack.subdir ? join(root, pack.subdir) : root;
  if (!existsSync(join(dir, '.claude-plugin', 'plugin.json'))) {
    throw new Error(`Pack "${pack.name}": no .claude-plugin/plugin.json in ${dir}. Point at the plugin folder (add #subfolder for a repository).`);
  }
  return { dir, provenance };
}
