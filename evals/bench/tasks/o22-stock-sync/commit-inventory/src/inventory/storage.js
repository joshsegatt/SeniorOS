import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

/** Production storage: the catalog document on the app server's disk. @param {string} path */
export function fileStorage(path) {
  return {
    read() {
      return existsSync(path) ? readFileSync(path, 'utf8') : null;
    },
    /** @param {string} text */
    write(text) {
      writeFileSync(`${path}.tmp`, text);
      renameSync(`${path}.tmp`, path);
    },
  };
}

/** For tests and local scripts. @param {string | null} [initial] */
export function memoryStorage(initial = null) {
  let text = initial;
  return {
    read() {
      return text;
    },
    /** @param {string} next */
    write(next) {
      text = next;
    },
  };
}
