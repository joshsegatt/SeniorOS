import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { generateRules } from '../scripts/gen-rules.js';

// The routing rules reach every host's adapter. A routing fix made in one copy and missed in another makes the same
// task route differently per host: the copies come from rules/core.md, and the parts that decide routing are checked.
const root = process.cwd();
const files = [
  'rules/senioros.md',
  ...readdirSync(path.join(root, 'adapters'))
    .map((dir) => `adapters/${dir}/rules.md`)
    .filter((file) => existsSync(path.join(root, file))),
];

const bullet = (text: string, name: string) => text.split('\n').find((line) => line.startsWith(`- **${name}`)) ?? '';

test('every host has the routing rules', () => {
  assert.ok(files.length >= 6, files.join(', '));
});

test('every host routes the same surfaces and the same planning cases', () => {
  for (const file of files) {
    const text = readFileSync(path.join(root, file), 'utf8');
    const lowRisk = bullet(text, 'Low-risk edits');
    const routing = bullet(text, 'Routing');
    assert.match(lowRisk, /Renaming or reshaping a field, key or type that other modules or saved data read is not a low-risk edit, and neither is a reported bug, even when the report names the one function to fix\./, file);
    assert.match(text, /Changing code to fix the cause of the reported problem is not one of them, wherever that code is; rewriting data already saved is\./, file);
    assert.match(routing, /`senior-debugging`, which fixes the cause even when it sits in another module than the one reported\./, file);
    assert.match(routing, /\(auth, data, stored records, migrations, public APIs, CI, deployment\)/, file);
    assert.match(routing, /when it also has several steps, changes a shared contract or stored data, or can fail halfway, plan it before the first edit: find every reader of what changes and the data already saved in the old shape, and decide what happens if a step fails halfway, runs twice or meets old data./, file);
    for (const skill of ['senior-engineering', 'senior-debugging', 'senior-code-review', 'senior-finish']) assert.ok(routing.includes(`\`${skill}\``), `${file}: ${skill}`);
  }
});

test('hosts other than Antigravity share the low-risk and routing bullets word for word', () => {
  const shared = files.filter((file) => !file.includes('antigravity'));
  const [first = '', ...rest] = shared.map((file) => readFileSync(path.join(root, file), 'utf8'));
  for (const [i, text] of rest.entries()) {
    for (const name of ['Low-risk edits', 'Routing', 'Approval boundary', 'Proof']) {
      assert.equal(bullet(text, name), bullet(first, name), `${shared[i + 1]}: ${name}`);
    }
  }
});

test('every host but Antigravity gets its rules from rules/core.md', () => {
  const generated = Object.keys(JSON.parse(readFileSync(path.join(root, 'rules', 'hosts.json'), 'utf8')) as Record<string, string>).sort();
  assert.deepEqual(generated, files.filter((file) => !file.includes('antigravity')).sort());
});

test('generated rules match rules/core.md (edit the template, then npm run gen:rules)', () => {
  assert.deepEqual(generateRules(root, true), []);
});
