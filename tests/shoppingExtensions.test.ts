import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { registerShoppingExtensions } from '../src/automation/shoppingExtensions.js';

test('shopping extensions target the active modal, not trailing background controls', async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(3000);
    const requests: unknown[] = [];
    await page.route('**/*', async route => {
      if (route.request().method() === 'POST') {
        requests.push(route.request().postDataJSON());
        await route.fulfill({ json: { nccAdExtensionId: `extension-${requests.length}` } });
      } else await route.fulfill({ contentType: 'text/html', body: '<html></html>' });
    });
    await page.goto('https://ads.naver.com/test');
    await page.setContent(`
      <button>확장 소재</button><button id="add">새 확장 소재</button>
      <div id="menu" hidden><button role="menuitem">네이버 톡톡</button><button role="menuitem">추가홍보문구</button></div>
      <div class="ad-cms-modal-wrap" hidden style="position:fixed;inset:0;background:white;z-index:10">
        <h2></h2><div id="fields"></div><button id="save">저장</button>
      </div>
      <input role="combobox" aria-label="background filter"><button id="background-save">저장</button>
      <div hidden>http://talk.naver.com/sample</div><div id="rows"></div>
      <script>
        const modal = document.querySelector('.ad-cms-modal-wrap');
        let kind, selected;
        document.querySelector('#add').onclick = () => document.querySelector('#menu').hidden = false;
        document.querySelectorAll('[role=menuitem]').forEach(item => item.onclick = () => {
          kind = item.textContent;
          document.querySelector('#menu').hidden = true;
          modal.hidden = false;
          modal.querySelector('h2').textContent = '새 확장 소재 추가 (' + kind + ')';
          document.querySelector('#fields').innerHTML = kind === '네이버 톡톡'
            ? '<input role="combobox" aria-label="channel">'
            : '<input id="catalog-promotion-basictext"><input id="catalog-promotion-additionaltext">';
          const combo = modal.querySelector('[role=combobox]');
          if (combo) combo.onclick = () => setTimeout(() => {
            const option = document.createElement('div');
            option.textContent = 'http://talk.naver.com/sample';
            option.style = 'position:fixed;top:150px;z-index:20;background:white';
            document.body.append(option);
            option.onclick = () => { selected = option.textContent; option.remove(); };
          }, 150);
        });
        document.querySelector('#save').onclick = async () => {
          const payload = kind === '네이버 톡톡' ? {kind, selected} : {
            kind, text1: document.querySelector('#catalog-promotion-basictext').value,
            text2: document.querySelector('#catalog-promotion-additionaltext').value
          };
          const response = await fetch('/apis/sa/api/ncc/ad-extensions', {method:'POST', body:JSON.stringify(payload)});
          const result = await response.json();
          modal.hidden = true;
          const row = document.createElement('div');
          row.id = 'lock-' + result.nccAdExtensionId;
          row.textContent = kind;
          document.querySelector('#rows').append(row);
        };
      </script>`);
    const progress: string[] = [];
    const ids = await registerShoppingExtensions(page, {
      useTalkTalk: true, talkTalkUrl: 'http://talk.naver.com/sample',
      promotionText1: '테스트 문구', promotionText2: '추가 테스트 문구'
    }, async id => { progress.push(id); });
    assert.deepEqual(ids, ['extension-1', 'extension-2']);
    assert.deepEqual(progress, ids);
    assert.deepEqual(requests, [
      { kind: '네이버 톡톡', selected: 'http://talk.naver.com/sample' },
      { kind: '추가홍보문구', text1: '테스트 문구', text2: '추가 테스트 문구' }
    ]);
  } finally {
    await browser.close();
  }
});
