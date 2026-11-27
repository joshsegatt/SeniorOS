import test from 'node:test';
import assert from 'node:assert/strict';
import { isEmail, isPhone, isPostalCode, isCountry, isBlank } from '../src/validate.js';

test('isEmail', () => {
  assert.ok(isEmail('ana+orders@mail.example.ch'));
  assert.ok(isEmail(' ANA@EXAMPLE.CH '));
  assert.ok(!isEmail('ana@example'));
  assert.ok(!isEmail('ana@@example.ch'));
});

test('isPhone', () => {
  assert.ok(isPhone('+41 79 123 45 67'));
  assert.ok(!isPhone('079 123 45 67'));
  assert.ok(!isPhone('+0791234567'));
});

test('isPostalCode depends on the country', () => {
  assert.ok(isPostalCode('CH', '1003'));
  assert.ok(!isPostalCode('CH', '12345'));
  assert.ok(isPostalCode('DE', '10115'));
  assert.ok(!isPostalCode('DE', '1011'));
});

test('isCountry and isBlank', () => {
  assert.ok(isCountry('IT'));
  assert.ok(!isCountry('ES'));
  assert.ok(isBlank('  '));
  assert.ok(!isBlank('x'));
});
