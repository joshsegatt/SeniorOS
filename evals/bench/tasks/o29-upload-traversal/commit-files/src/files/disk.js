import { posix } from 'node:path';

export class FileMissing extends Error {
  constructor(path) {
    super(`no such file: ${path}`);
    this.name = 'FileMissing';
  }
}

/** The server's disk (in memory for tests): absolute POSIX paths, resolved like the real filesystem does. */
export function createDisk(files = {}) {
  const store = new Map(Object.entries(files).map(([p, c]) => [posix.resolve('/', p), c]));
  return {
    read(path) {
      const abs = posix.resolve('/', path);
      if (!store.has(abs)) throw new FileMissing(abs);
      return store.get(abs);
    },
    write(path, content) {
      store.set(posix.resolve('/', path), content);
    },
    exists: (path) => store.has(posix.resolve('/', path)),
  };
}
