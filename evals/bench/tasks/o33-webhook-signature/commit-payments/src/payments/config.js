import { readFileSync } from 'node:fs';

/** Production settings live in config/paylane.local.json on the server (see README). */
export function loadPaylaneConfig(path = new URL('../../config/paylane.local.json', import.meta.url)) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
