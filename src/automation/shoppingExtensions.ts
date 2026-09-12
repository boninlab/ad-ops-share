import type { Locator, Page } from 'playwright-core';
import type { ShoppingSearchConfig } from '../schema.js';

/** Register extensions on the ad group through Naver's own validated forms. */
export async function registerShoppingExtensions(
  page: Page,
  settings: ShoppingSearchConfig['extensions'],
  onRegistered: (id: string) => Promise<void> = async () => {}
) {
  const ids: string[] = [];

  await page.getByRole('button', { name: '확장 소재', exact: true }).click();
  const addButton = page.getByRole('button', { name: '새 확장 소재', exact: true });
  await addButton.waitFor({ state: 'visible' });

  const open = async (name: string) => {
    await addButton.click();
    await page.getByRole('menuitem', { name, exact: true }).click();
    const dialog = page.locator('.ad-cms-modal-wrap').filter({
      has: page.getByText(`새 확장 소재 추가 (${name})`, { exact: true })
    }).filter({ visible: true });
    await dialog.waitFor({ state: 'visible' });
    return dialog;
  };
  const save = async (name: string, dialog: Locator) => {
    const [response] = await Promise.all([
      page.waitForResponse((response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/apis/sa/api/ncc/ad-extensions', { timeout: 20000 }),
      dialog.getByRole('button', { name: '저장', exact: true }).click()
    ]);
    const body = await response.json();
    if (!response.ok() || !body?.nccAdExtensionId) {
      throw new Error(`${name} 등록 실패: ${JSON.stringify(body)}`);
    }
    ids.push(body.nccAdExtensionId);
    await onRegistered(body.nccAdExtensionId);
    await dialog.waitFor({ state: 'hidden' });
    await page.locator(`[id="lock-${body.nccAdExtensionId}"]`).waitFor({ state: 'visible' });
  };

  {
    const existingTalk = page.getByRole('row').filter({ has: page.getByText('네이버 톡톡', { exact: true }) });
    if (await existingTalk.count()) {
      if (!(await existingTalk.innerText()).includes(settings.talkTalkUrl.replace(/^https?:/, ''))) {
        throw new Error('이 광고그룹에 다른 네이버 톡톡이 이미 등록되어 있습니다.');
      }
    } else {
      const dialog = await open('네이버 톡톡');
      // Background table filters can occur after the modal in DOM order.
      await dialog.getByRole('combobox').click();
      // Select menus may be portaled outside the modal and load asynchronously.
      const channel = page.getByText(settings.talkTalkUrl, { exact: true }).filter({ visible: true });
      try {
        await channel.waitFor({ state: 'visible', timeout: 10000 });
      } catch {
        throw new Error(`비즈채널에서 네이버 톡톡을 찾지 못했습니다: ${settings.talkTalkUrl}`);
      }
      await channel.click();
      await save('네이버 톡톡', dialog);
    }
  }

  if (settings.promotionText1) {
    const dialog = await open('추가홍보문구');
    await dialog.locator('#catalog-promotion-basictext').fill(settings.promotionText1);
    if (settings.promotionText2) {
      await dialog.locator('#catalog-promotion-additionaltext').fill(settings.promotionText2);
    }
    await save('추가홍보문구', dialog);
  }
  return ids;
}
