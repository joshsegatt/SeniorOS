import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSkillManifest } from '../src/core/skill-manifest.js';

const LF = '---\nname: demo-skill\ndescription: Does a thing. Use when a thing is needed.\n---\n\n# Demo\n\nBody.\n';

test('parses LF manifests', () => {
  const manifest = parseSkillManifest(LF);
  assert.equal(manifest.name, 'demo-skill');
  assert.equal(manifest.description, 'Does a thing. Use when a thing is needed.');
  assert.equal(manifest.bodyLineCount, 4);
});

test('parses CRLF manifests from Windows checkouts identically', () => {
  assert.deepEqual(parseSkillManifest(LF.replace(/\n/g, '\r\n')), parseSkillManifest(LF));
});

test('ignores a UTF-8 BOM', () => {
  assert.equal(parseSkillManifest(`﻿${LF}`).name, 'demo-skill');
});

test('rejects missing frontmatter', () => {
  assert.throws(() => parseSkillManifest('# No frontmatter\n'), /missing YAML frontmatter/);
});

test('rejects invalid names', () => {
  assert.throws(() => parseSkillManifest(LF.replace('demo-skill', 'Demo Skill')), /invalid name/);
});

test('rejects block-scalar descriptions the validator cannot read', () => {
  const folded = '---\nname: demo-skill\ndescription: >\n  Folded text.\n---\nBody\n';
  assert.throws(() => parseSkillManifest(folded), /single line/);
});

test('rejects oversized bodies', () => {
  const body = Array.from({ length: 501 }, (_, i) => `line ${i}`).join('\n');
  assert.throws(() => parseSkillManifest(`---\nname: demo-skill\ndescription: ok\n---\n${body}\n`), /body has 501 lines/);
});

test('rejects skills at or over the 20,000-byte compaction limit, counting UTF-8 bytes', () => {
  // 100 lines of 200 bytes each (two-byte characters) stay under the line limit but exceed the byte limit.
  const body = Array.from({ length: 100 }, () => 'é'.repeat(100)).join('\n');
  assert.throws(() => parseSkillManifest(`---\nname: demo-skill\ndescription: ok\n---\n${body}\n`), /bytes; keep it under 20000/);
});
