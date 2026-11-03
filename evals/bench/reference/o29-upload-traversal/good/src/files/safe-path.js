import { posix } from 'node:path';

export class BadPath extends Error {
  constructor(path) {
    super(`path outside the allowed folder: ${path}`);
    this.name = 'BadPath';
  }
}

/** Joins user-supplied parts under `root` and refuses anything that resolves outside it (after decoding). */
export function inside(root, ...parts) {
  const full = posix.resolve(root, ...parts.map((p) => String(p).replace(/^\/+/, '')));
  if (!full.startsWith(root + '/') || full.includes('\0')) throw new BadPath(parts.join('/'));
  return full;
}
