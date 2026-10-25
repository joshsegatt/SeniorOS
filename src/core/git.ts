import { execFileSync } from 'node:child_process';

export interface ChangedFile {
  status: string;
  path: string;
}

export function getChangedFiles(root: string): ChangedFile[] {
  try {
    const output = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });

    return output
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const status = line.slice(0, 2).trim() || 'M';
        const rawPath = line.slice(3).trim();
        const filePath = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1)! : rawPath;
        return { status, path: filePath.replace(/^"|"$/g, '') };
      });
  } catch {
    return [];
  }
}
