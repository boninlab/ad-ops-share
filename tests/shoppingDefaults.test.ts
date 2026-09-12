import assert from 'node:assert/strict';
import test from 'node:test';
import { ShoppingSearchConfigSchema } from '../src/schema.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('legacy opt-out still enables TalkTalk and 26-character names are rejected', () => {
  const config = JSON.parse(readFileSync('data/shopping-search-campaign.example.json', 'utf8'));
  config.extensions.useTalkTalk = false;
  assert.equal(ShoppingSearchConfigSchema.parse(config).extensions.useTalkTalk, true);
  config.material.exposureProductName = '가'.repeat(25);
  assert.ok(ShoppingSearchConfigSchema.safeParse(config).success);
  config.material.exposureProductName += '나';
  assert.equal(ShoppingSearchConfigSchema.safeParse(config).success, false);
});

test('product URL replaces stale ID and exposure input is limited immediately', () => {
  const source = readFileSync('web/app.js', 'utf8');
  const functions = ['syncCommonProductUrl', 'extractProductIdFromUrl', 'renderExposureProductNameCounter'];
  const fields = { commonProductUrl: { value: 'https://smartstore.naver.com/sample/products/123456?source=test' }, productId: { value: 'sample' }, exposureProductName: { value: '가'.repeat(26) } };
  const counter = { textContent: '' };
  const context = vm.createContext({ fields, document: { querySelector: () => counter }, MAX_SHOPPING_EXPOSURE_PRODUCT_NAME_LENGTH: 25, limitTextLength: (s: string, n: number) => Array.from(s).slice(0, n).join(''), countTextLength: (s: string) => Array.from(s).length });
  for (const name of functions) {
    const start = source.indexOf(`function ${name}(`);
    const end = source.indexOf('\n}\n', start) + 3;
    vm.runInContext(source.slice(start, end), context);
  }
  vm.runInContext('syncCommonProductUrl(); renderExposureProductNameCounter();', context);
  assert.equal(fields.productId.value, '123456');
  assert.equal(fields.exposureProductName.value.length, 25);
  assert.equal(counter.textContent, '25/25자');
});
