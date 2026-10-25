export interface SkillManifest {
  name: string;
  description: string;
  bodyLineCount: number;
}

export const MAX_DESCRIPTION_LENGTH = 1024;
export const MAX_BODY_LINES = 500;

/**
 * Parses and validates the YAML frontmatter of a SKILL.md file.
 * Line endings are normalized first so Windows checkouts (CRLF) validate the same as Linux.
 */
export function parseSkillManifest(raw: string): SkillManifest {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!frontmatter) throw new Error('missing YAML frontmatter');

  const fields = frontmatter[1] ?? '';
  const name = fields.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = fields.match(/^description:\s*(.+)$/m)?.[1]?.trim();

  if (!name) throw new Error('missing name');
  if (!/^[a-z0-9-]{1,64}$/.test(name)) throw new Error(`invalid name: ${name}`);
  if (!description) throw new Error('missing description');
  if (/^[>|][-+]?$/.test(description)) throw new Error('description must be a single line; block scalars are not supported');
  if (description.length > MAX_DESCRIPTION_LENGTH) throw new Error(`description has ${description.length} characters; keep it <= ${MAX_DESCRIPTION_LENGTH}`);

  const body = text.slice(frontmatter[0].length);
  const bodyLineCount = body.length === 0 ? 0 : body.replace(/\n$/, '').split('\n').length;
  if (bodyLineCount > MAX_BODY_LINES) throw new Error(`body has ${bodyLineCount} lines; keep it <= ${MAX_BODY_LINES}`);

  return { name, description, bodyLineCount };
}
