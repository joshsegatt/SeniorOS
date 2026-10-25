import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { destinationFor } from '../src/core/install.js';

test('claude project skills path', () => {
  assert.equal(destinationFor('/tmp/project', 'claude', 'project'), path.join('/tmp/project', '.claude', 'skills'));
});

test('codex project skills path', () => {
  assert.equal(destinationFor('/tmp/project', 'codex', 'project'), path.join('/tmp/project', '.codex', 'skills'));
});

test('claude user skills path', () => {
  assert.equal(destinationFor('/tmp/project', 'claude', 'user'), path.join(os.homedir(), '.claude', 'skills'));
});
