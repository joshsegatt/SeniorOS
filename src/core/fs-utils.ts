import { access, mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';

export async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson<T>(filePath: string): Promise<T | null> {
  if (!(await exists(filePath))) return null;
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

export async function writeFileIfMissing(filePath: string, content: string): Promise<boolean> {
  if (await exists(filePath)) return false;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
  return true;
}

export async function copyDirSafe(source: string, destination: string, force: boolean): Promise<'created' | 'replaced'> {
  const destinationExists = await exists(destination);
  if (destinationExists && !force) {
    throw new Error(`Refusing to overwrite existing path: ${destination}. Re-run with --force only if replacement is intentional.`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force });
  return destinationExists ? 'replaced' : 'created';
}
