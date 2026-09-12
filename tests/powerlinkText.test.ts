import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validatePowerlinkDescription } from '../src/automation/powerlinkText.js';

test('rejects the reported 19-character description with either keyword syntax', () => {
  for (const token of ['keyword', '키워드']) {
    assert.throws(() => validatePowerlinkDescription(`트렌디한 {${token}:청남방} 365일 무료배송!`), /현재 19자/);
  }
});

test('accepts 20 and 45 characters and rejects 46', () => {
  for (const length of [20, 45]) {
    assert.doesNotThrow(() => validatePowerlinkDescription('가'.repeat(length)));
  }
  assert.throws(() => validatePowerlinkDescription('가'.repeat(46)), /현재 46자/);
  assert.doesNotThrow(() => validatePowerlinkDescription('트렌디한 {keyword:청남방} 365일 무료배송!!'));
});
