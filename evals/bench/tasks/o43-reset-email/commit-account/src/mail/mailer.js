import { readFile } from 'node:fs/promises';

const TEMPLATES = new URL('./templates/', import.meta.url);

/** The transport refused the message (relay down, mailbox rejected). The HTTP layer answers 503. */
export class EmailUnavailableError extends Error {
  /** @param {string} to @param {unknown} cause */
  constructor(to, cause) {
    super(`could not send email to ${to}`, { cause });
    this.name = 'EmailUnavailableError';
  }
}

/** @param {string} name */
async function loadTemplate(name) {
  if (!/^[a-z-]+$/.test(name)) throw new Error(`bad template name: ${name}`);
  const text = await readFile(new URL(`${name}.txt`, TEMPLATES), 'utf8');
  const [first, ...rest] = text.split('\n');
  return { subject: first.replace(/^Subject:\s*/, ''), body: rest.join('\n') };
}

/** @param {string} text @param {Record<string, string>} vars */
export function render(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in vars)) throw new Error(`missing template variable: ${key}`);
    return vars[key];
  });
}

/**
 * Renders `templates/<name>.txt` and hands the message to the transport. Resolves once the transport has
 * accepted it; rejects with EmailUnavailableError when the transport refuses it.
 * @param {{ send(message: { to: string, subject: string, body: string }): Promise<void> }} transport
 * @param {string} name @param {string} to @param {Record<string, string>} vars
 */
export async function sendTemplate(transport, name, to, vars) {
  const template = await loadTemplate(name);
  const message = { to, subject: render(template.subject, vars), body: render(template.body, vars) };
  try {
    await transport.send(message);
  } catch (err) {
    throw new EmailUnavailableError(to, err);
  }
}
