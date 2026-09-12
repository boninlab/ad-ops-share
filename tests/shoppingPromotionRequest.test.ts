import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ShoppingSearchConfigSchema } from '../src/schema.js';
import { NaverShoppingPromotionApiAutomation } from '../src/automation/naverShoppingPromotionApi.js';

// Run the actual page callback against Naver's client interface without creating ads.
async function runStep(failure?: { method: string; status: number }) {
  const config = ShoppingSearchConfigSchema.parse(JSON.parse(readFileSync('data/shopping-search-campaign.example.json', 'utf8')));
  config.shoppingPromotion.material.landingUrl = 'https://smartstore.naver.com/sample/products/123';
  const calls: Record<string, any>[] = [];
  const client = { request: async (options: Record<string, any>) => {
    calls.push(options);
    if (options.method === failure?.method) {
      throw { response: { status: failure.status, data: '<html>Forbidden</html>' } };
    }
    return { data: options.method === 'post' ? { adSet: { no: 1234 } } : {} };
  } };
  const globals = globalThis as any;
  const saved = { window: globals.window, location: globals.location, __name: globals.__name };
  globals.__name = (value: unknown) => value;
  globals.location = new URL('https://ads.naver.com/manage/ad-accounts/1000000/da/ad/create/adSet?campaignNo=1000004');
  globals.window = {
    history: { state: null, replaceState: (_state: unknown, _title: string, url: string) => { globals.location = new URL(url); } },
    webpackChunkreact_app: { push: (chunk: any[]) => chunk[2]((id: number) => {
      assert.equal(id, 39207);
      return { $L: { instance: client } };
    }) }
  };
  try {
    const automation = new NaverShoppingPromotionApiAutomation(config) as any;
    const result = await automation.executeRegistrationStep({ evaluate: (fn: any, payload: any) => fn(payload) }, {
      config, image: { fileName: 'unused.png', mimeType: 'image/png', dataUrl: '', size: 0 }
    });
    return { calls, result };
  } catch (error) {
    return { calls, error };
  } finally {
    Object.assign(globals, saved);
  }
}

test('ad set creation uses Naver client with a serializable form object', async () => {
  const { calls, result, error } = await runStep();
  assert.equal(error, undefined);
  assert.equal(result.adSetNo, '1234');
  assert.equal(calls.length, 2);
  const post = calls[1]!;
  assert.equal(post.baseURL, '/apis/gfa');
  assert.equal(post.url, '/v2.0/adAccounts/1000000/adSets');
  assert.equal(typeof post.data, 'object');
  assert.equal(post.data['adSet.campaignNo'], '1000004');
  assert.equal(post.data['adSet.useAutoFrequency'], 'true');
  assert.equal('adSet.quota' in post.data, false);
  assert.equal('adSet.frequencyAdUnit' in post.data, false);
  assert.equal(post.showErrorPopup, false);
  assert.equal(post.headers['x-xsrf-token'], undefined);
});

test('403 on POST is reported once without an automatic retry', async () => {
  const { calls, error } = await runStep({ method: 'post', status: 403 });
  assert.equal(calls.filter(call => call.method === 'post').length, 1);
  assert.match(String(error), /HTTP 403/);
  assert.doesNotMatch(String(error), /<html>/);
});

test('unauthorized campaign lookup stops before creation', async () => {
  const { calls, error } = await runStep({ method: 'get', status: 401 });
  assert.equal(calls.length, 1);
  assert.match(String(error), /HTTP 401/);
});
