import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { ShoppingSearchConfigSchema } from '../src/schema.js';
import { NaverPowerlinkApiAutomation } from '../src/automation/naverPowerlinkApi.js';

test('Powerlink uploads actual 640px square images before creating ads', async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  try {
    for (const scenario of ['sizes', 'corrupt', 'upload-failure']) {
      const page = await browser.newPage();
      // All traffic is isolated: these tests never reach the advertising account.
      await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
      await page.goto('https://ads.naver.com/manage/ad-accounts/1234');
      await page.evaluate('globalThis.__name = (target) => target;');
      const images = await page.evaluate(() => {
        return [[500, 500], [1200, 500], [400, 1000], [640, 640], [1600, 1600]].map(([width, height]) => {
          const canvas = document.createElement('canvas');
          canvas.width = width!;
          canvas.height = height!;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = 'red';
          ctx.fillRect(0, 0, width!, height!);
          return { fileName: `${width}x${height}.png`, mimeType: 'image/png', dataUrl: canvas.toDataURL() };
        });
      });
      await page.evaluate((scenario) => {
        const state = { calls: [] as string[], uploads: [] as any[], extensionRequests: [] as any[] };
        (window as any).testState = state;
        window.fetch = async (input, options) => {
          const url = String(input);
          const method = options?.method ?? 'GET';
          state.calls.push(method + ' ' + url);
          let data: any = {};
          if (url.includes('uploadAndCreate')) {
            if (scenario === 'upload-failure') return new Response('upload failed', { status: 400 });
            const form = options!.body as FormData;
            const file = form.get('image') as File;
            const bitmap = await createImageBitmap(file);
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(bitmap, 0, 0);
            state.uploads.push({
              width: bitmap.width, height: bitmap.height, type: file.type,
              corner: Array.from(ctx.getImageData(0, 0, 1, 1).data),
              center: Array.from(ctx.getImageData(320, 320, 1, 1).data)
            });
            bitmap.close();
            data = { imagePath: '/image/' + state.uploads.length, imageId: 'img-' + state.uploads.length };
          } else if (url.includes('/adAccounts/')) data = { customerId: 1234 };
          else if (url.includes('/channels')) data = [{ enabled: true, channelTp: 'MALL', channelKey: 'https://shop.example.com', nccBusinessChannelId: 'channel', referenceKey: 'mall' }];
          else if (url.includes('/campaigns/')) data = { campaignTp: 'WEB_SITE' };
          else if (url.includes('/validator/')) data = [];
          else if (url.includes('/media?')) data = [{ type: 'media', id: 1 }];
          else if (url.endsWith('/adgroups')) data = { nccAdgroupId: 'group' };
          else if (url.includes('/keywords?')) data = JSON.parse(options!.body as string);
          else if (url.endsWith('/ads')) data = { nccAdId: 'ad' };
          else if (url.endsWith('/ad-extensions')) {
            const extension = JSON.parse(options!.body as string);
            state.extensionRequests.push(extension);
            data = { nccAdExtensionId: 'extension-' + extension.type + '-' + state.extensionRequests.length };
          }
          else throw new Error('Unexpected request: ' + url);
          return new Response(JSON.stringify(data), { status: 200 });
        };
      }, scenario);
      const config = ShoppingSearchConfigSchema.parse(JSON.parse(readFileSync('data/shopping-search-campaign.example.json', 'utf8')));
      config.powerlink.material.productLink = 'https://shop.example.com/product/123';
      config.powerlink.keywords = ['테스트'];
      const automation = new NaverPowerlinkApiAutomation(config) as any;
      if (scenario === 'corrupt') images[1]!.dataUrl = 'data:image/png;base64,aW52YWxpZA==';
      if (scenario === 'sizes') {
        const result = await automation.executeRegistration(page, images);
        assert.equal(result.imageExtensionIds.length, images.length);
      } else {
        await assert.rejects(automation.executeRegistration(page, images), scenario === 'corrupt' ? /이미지 준비 실패/ : /upload failed/);
      }
      const state = await page.evaluate(() => (window as any).testState);
      const groupIndex = state.calls.indexOf('POST /apis/sa/api/ncc/adgroups');
      if (scenario === 'sizes') {
        assert.equal(state.uploads.length, 5);
        for (const upload of state.uploads) {
          assert.equal(upload.width, 640);
          assert.equal(upload.height, 640);
          assert.equal(upload.type, 'image/jpeg');
          assert.ok(upload.center[0] > 240 && upload.center[1] < 15);
        }
        for (const index of [1, 2]) assert.ok(state.uploads[index].corner.slice(0, 3).every((value: number) => value > 240));
        assert.ok(groupIndex > state.calls.findLastIndex((call: string) => call.includes('uploadAndCreate')));
        assert.deepEqual(
          state.extensionRequests.map((request: any) => request.type),
          ['SHOPPING_WEB', ...Array(images.length).fill('POWER_LINK_IMAGE'), 'SUB_LINKS', 'DESCRIPTION', 'HEADLINE', 'HEADLINE', 'DESCRIPTION_EXTRA']
        );
        assert.deepEqual(state.extensionRequests.at(-5).adExtension, [
          { name: '상의', final: 'https://smartstore.naver.com/sample' },
          { name: '하의', final: 'https://smartstore.naver.com/sample' },
          { name: '1+1', final: 'https://smartstore.naver.com/sample' },
          { name: '당일출고', final: 'https://smartstore.naver.com/sample' }
        ]);
        assert.deepEqual(state.extensionRequests.at(-4).adExtension, { description: '데일리 와이드핏' });
        assert.deepEqual(state.extensionRequests.at(-3).adExtension, { headline: '여유로운 와이드핏' });
        assert.deepEqual(state.extensionRequests.at(-2).adExtension, { headline: '데일리 데님 팬츠' });
        assert.deepEqual(state.extensionRequests.at(-1).adExtension, { description: '편안한 와이드핏 청바지로 일상의 스타일을 완성하세요' });
      } else {
        assert.equal(groupIndex, -1, 'invalid images must not leave a partially created ad group');
        assert.ok(!state.calls.some((call: string) => /\/ncc\/(ads|keywords|ad-extensions)/.test(call)));
        if (scenario === 'corrupt') assert.ok(!state.calls.some((call: string) => call.includes('uploadAndCreate')));
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
