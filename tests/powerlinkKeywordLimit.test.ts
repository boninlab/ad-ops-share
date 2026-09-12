import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { PowerlinkConfigSchema } from '../src/schema.js';

test('pasting over 1000 keywords keeps the first 1000 and reports the omitted count', () => {
  const source = readFileSync('web/app.js', 'utf8');
  let message = '';
  const fields = { powerlinkKeywordList: { value: '' }, powerlinkKeywordCount: { textContent: '', classList: { toggle() {} } } };
  const context = vm.createContext({ fields, normalizeText: (s: string) => s.normalize('NFC'), setStatus: (s: string) => { message = s; } });
  for (const name of ['parsePowerlinkKeywords', 'enforcePowerlinkKeywordLimit', 'renderPowerlinkKeywordCount']) {
    const start = source.indexOf(`function ${name}(`);
    vm.runInContext(source.slice(start, source.indexOf('\n}\n', start) + 3), context);
  }
  fields.powerlinkKeywordList.value = Array.from({ length: 1000 }, (_, i) => `키워드${i}`).join('\n');
  vm.runInContext('enforcePowerlinkKeywordLimit()', context);
  assert.equal(message, '');
  fields.powerlinkKeywordList.value += ',추가키워드\n\n';
  vm.runInContext('enforcePowerlinkKeywordLimit()', context);
  assert.equal(fields.powerlinkKeywordList.value.split('\n').length, 1000);
  assert.equal(fields.powerlinkKeywordList.value.split('\n').at(-1), '키워드999');
  assert.match(message, /초과 1개/);
  assert.match(fields.powerlinkKeywordCount.textContent, /1,000 \/ 1,000/);
});

test('server accepts 1000 keywords and rejects 1001', () => {
  assert.ok(PowerlinkConfigSchema.safeParse({ keywords: Array(1000).fill('청바지') }).success);
  assert.equal(PowerlinkConfigSchema.safeParse({ keywords: Array(1001).fill('청바지') }).success, false);
});
