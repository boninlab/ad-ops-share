import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import path from 'node:path';
import type { BrowserContext, Locator, Page } from 'playwright-core';
import type { SelectorConfig, ShoppingSearchConfig, ShoppingSearchProductConfig } from '../schema.js';
import { openChromeSession, type BrowserSession } from './browser.js';
import { chooseByText, clickByText, fillByLabelOrPlaceholder, waitForDomSettled, waitForText } from './dom.js';
import { RunLogger } from './log.js';

export type ShoppingSearchRunResult = {
  runDir: string;
  browserSession?: BrowserSession;
};

export type ShoppingSearchStepResult = {
  runDir: string;
  message: string;
};

export class ShoppingSearchAutomationError extends Error {
  constructor(
    message: string,
    readonly runDir: string,
    readonly browserSession?: BrowserSession,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'ShoppingSearchAutomationError';
  }
}

export class NaverShoppingSearchAutomation {
  constructor(
    private readonly config: ShoppingSearchConfig,
    private readonly selectors: SelectorConfig
  ) {}

  async login() {
    const session = await this.openSession();
    const page = await this.openPage(session.context);
    await page.goto(this.config.naverAdsUrl, { waitUntil: 'domcontentloaded' });

    console.log('Chrome에서 네이버 검색광고 계정 로그인을 완료한 뒤 Enter를 누르세요.');
    const rl = createInterface({ input, output });
    await rl.question('');
    rl.close();

    await session.close();
  }

  async run(options: {
    dryRun: boolean;
    keepBrowserOpenOnManual?: boolean;
    keepBrowserOpenOnError?: boolean;
  }): Promise<ShoppingSearchRunResult> {
    const runDir = path.resolve(
      this.config.runOutputDir,
      `${new Date().toISOString().replace(/[:.]/g, '-')}-${slug(this.config.campaign.name)}`
    );
    const logger = new RunLogger(runDir);
    await logger.init();

    const session = await this.openSession();
    const page = await this.openPage(session.context);
    let closeSession = true;

    try {
      logger.info(`opening ${this.config.naverAdsUrl}`);
      await page.goto(this.config.naverAdsUrl, { waitUntil: 'domcontentloaded' });
      await waitForDomSettled(page);
      await waitForText(page, [...this.requiredButton('createAd'), '로그인'], 30000).catch((error) => {
        logger.warn(`initial page readiness check did not find expected text: ${error.message}`);
      });
      await logger.screenshot(page, '01-opened');
      await logger.domSummary(page, '01-opened');

      await this.createCampaign(page, logger);
      await this.createAdGroup(page, logger);
      await this.addProducts(page, logger);

      await logger.screenshot(page, '90-before-create-ads');

      if (options.dryRun || this.config.submitMode === 'manual') {
        logger.warn('manual mode: stopped before final 광고만들기');
        if (options.keepBrowserOpenOnManual) {
          closeSession = false;
          return { runDir, browserSession: session };
        }

        return { runDir };
      }

      logger.info('submitMode=auto: attempting final 광고만들기');
      await this.submitAndApplyMaterial(page, logger);
      return { runDir };
    } catch (error) {
      await logger.screenshot(page, 'error').catch(() => undefined);
      await logger.domSummary(page, 'error').catch(() => undefined);
      if (options.keepBrowserOpenOnError) {
        closeSession = false;
        const message = error instanceof Error ? error.message : String(error);
        throw new ShoppingSearchAutomationError(message, runDir, session, { cause: error });
      }

      throw error;
    } finally {
      await logger.flush();
      if (closeSession) {
        await session.close();
      }
    }
  }

  async advanceCurrentPage(
    context: BrowserContext,
    options: { submitFinal?: boolean } = {}
  ): Promise<ShoppingSearchStepResult> {
    const runDir = path.resolve(
      this.config.runOutputDir,
      `${new Date().toISOString().replace(/[:.]/g, '-')}-${slug(this.config.campaign.name)}-step`
    );
    const logger = new RunLogger(runDir);
    await logger.init();

    const page = await this.openPage(context);

    try {
      await waitForDomSettled(page);
      await logger.screenshot(page, '00-current');
      await logger.domSummary(page, '00-current');

      const screen = await this.detectCurrentScreen(page);
      logger.info(`detected screen: ${screen}`);

      if (screen === 'campaign-list') {
        await clickByText(page, ['새 캠페인', ...this.requiredButton('createAd')], 30000);
        await waitForDomSettled(page);
        await logger.screenshot(page, '05-ad-create-opened');
        return { runDir, message: '광고 만들기 시작 화면 도착' };
      }

      if (screen === 'campaign-objective') {
        await chooseByText(page, this.requiredChoice('campaignCreationByObjective')).catch((error) => {
          logger.warn(`campaign objective tab was not selected automatically: ${error.message}`);
        });
        await waitForDomSettled(page);
        await chooseByText(page, this.requiredChoice('campaignObjectiveOnlineSales')).catch((error) => {
          logger.warn(`online sales objective was not selected automatically: ${error.message}`);
        });
        await this.chooseShoppingSearchCampaignType(page, logger);
        await clickByText(page, this.requiredButton('saveAndContinue'));
        await waitForDomSettled(page);
        await logger.screenshot(page, '10-campaign-settings-ready');
        return { runDir, message: '쇼핑검색 캠페인 설정 화면 도착' };
      }

      if (screen === 'campaign-settings') {
        await this.fillCampaignDetails(page, logger);
        await this.saveAndContinue(page, logger, '20-campaign-done');
        await waitForText(page, this.requiredChoice('adGroupTypeShoppingMallProduct'), 10000);
        await logger.screenshot(page, '21-ad-group-type-ready');
        return { runDir, message: '캠페인 저장 완료, 광고그룹 유형 화면 도착' };
      }

      if (screen === 'ad-group-type') {
        await this.chooseAdGroupTypeShoppingMallProduct(page, logger);
        await this.saveAndContinue(page, logger, '31-ad-group-type-done');
        await waitForText(page, this.requiredField('adGroupName'), 10000);
        await logger.screenshot(page, '32-ad-group-settings-ready');
        return { runDir, message: '광고그룹 유형 저장 완료, 광고그룹 설정 화면 도착' };
      }

      if (screen === 'ad-group-settings') {
        await this.fillAdGroupDetails(page, logger);
        await waitForText(page, this.requiredField('productId'), 10000).catch(() =>
          waitForText(page, this.requiredField('productSearch'), 10000)
        );
        await logger.screenshot(page, '33-product-search-ready');
        return { runDir, message: '광고그룹 저장 완료, 상품 검색 화면 도착' };
      }

      if (screen === 'product-search') {
        await this.addProducts(page, logger);
        await logger.screenshot(page, '90-before-create-ads');
        return { runDir, message: '상품 추가 완료, 광고 만들기 직전 화면 도착' };
      }

      if (screen === 'before-submit') {
        if (!options.submitFinal) {
          await logger.screenshot(page, '90-before-create-ads');
          return { runDir, message: '광고 만들기 직전 화면에서 대기 중' };
        }

        await this.submitAndApplyMaterial(page, logger);
        return { runDir, message: '최종 광고 등록 및 소재 설정 완료' };
      }

      throw new Error('현재 화면을 자동화 단계로 판별하지 못했습니다.');
    } catch (error) {
      await logger.screenshot(page, 'error').catch(() => undefined);
      await logger.domSummary(page, 'error').catch(() => undefined);
      throw error;
    } finally {
      await logger.flush();
    }
  }

  private async openSession() {
    return openChromeSession({
      mode: this.config.browserMode,
      profileDir: this.config.chromeProfileDir,
      cdpUrl: this.config.browserCdpUrl
    });
  }

  private async openPage(context: BrowserContext) {
    const existingNaverPage = context.pages().find((page) => {
      const url = page.url();
      return url.includes('manage.searchad.naver.com') || url.includes('ads.naver.com');
    });

    if (existingNaverPage) {
      return existingNaverPage;
    }

    const blankPage = context.pages().find((page) => page.url() === 'about:blank');
    return blankPage ?? context.newPage();
  }

  private async createCampaign(page: Page, logger: RunLogger) {
    logger.info('step 1: campaign');

    await clickByText(page, this.requiredButton('createAd'), 30000);
    await waitForDomSettled(page);
    await logger.screenshot(page, '10-ad-create-start');

    await chooseByText(page, this.requiredChoice('campaignCreationByObjective')).catch((error) => {
      logger.warn(`campaign objective tab was not selected automatically: ${error.message}`);
    });
    await waitForDomSettled(page);
    await logger.screenshot(page, '11-campaign-objective-tab');

    await chooseByText(page, this.requiredChoice('campaignObjectiveOnlineSales')).catch((error) => {
      logger.warn(`online sales objective was not selected automatically: ${error.message}`);
    });

    await this.chooseShoppingSearchCampaignType(page, logger);
    await clickByText(page, this.requiredButton('saveAndContinue')).catch((error) => {
      logger.warn(`campaign type next button was not clicked automatically: ${error.message}`);
    });
    await waitForDomSettled(page);

    await this.fillCampaignDetails(page, logger);

    await this.saveAndContinue(page, logger, '20-campaign-done');
    await waitForText(page, this.requiredChoice('adGroupTypeShoppingMallProduct'), 10000);
  }

  private async fillCampaignDetails(page: Page, logger: RunLogger) {
    await fillByLabelOrPlaceholder(page, this.requiredField('campaignName'), this.config.campaign.name);

    if (this.config.campaign.dailyBudget !== undefined) {
      await fillByLabelOrPlaceholder(page, this.requiredField('campaignDailyBudget'), this.config.campaign.dailyBudget)
        .catch((error) => logger.warn(`campaign daily budget was not filled automatically: ${error.message}`));
    }

    if (this.config.campaign.useBudgetDistribution) {
      await chooseByText(page, this.requiredChoice('budgetDistribution')).catch((error) => {
        logger.warn(`budget distribution was not selected automatically: ${error.message}`);
      });
    }
  }

  private async createAdGroup(page: Page, logger: RunLogger) {
    logger.info('step 2: ad group');

    await this.chooseAdGroupTypeShoppingMallProduct(page, logger);
    await this.saveAndContinue(page, logger, '31-ad-group-type-done');
    await this.fillAdGroupDetails(page, logger);
  }

  private async fillAdGroupDetails(page: Page, logger: RunLogger) {
    await fillByLabelOrPlaceholder(page, this.requiredField('adGroupName'), this.config.adGroup.name);

    if (this.config.adGroup.mallName) {
      await fillByLabelOrPlaceholder(page, this.requiredField('mallName'), this.config.adGroup.mallName).catch(
        (error) => logger.warn(`mall name was not filled automatically: ${error.message}`)
      );
      await chooseByText(page, this.requiredButton('search')).catch((error) => {
        logger.warn(`mall search was not clicked automatically: ${error.message}`);
      });
    }

    if (this.config.adGroup.shoppingPartnerCenterId) {
      await fillByLabelOrPlaceholder(
        page,
        this.requiredField('shoppingPartnerCenterId'),
        this.config.adGroup.shoppingPartnerCenterId
      ).catch((error) => logger.warn(`shopping partner center ID was not filled automatically: ${error.message}`));
    }

    await fillByLabelOrPlaceholder(page, this.requiredField('defaultBidPrice'), this.config.adGroup.defaultBidPrice);

    if (this.config.adGroup.dailyBudget !== undefined) {
      await fillByLabelOrPlaceholder(page, this.requiredField('adGroupDailyBudget'), this.config.adGroup.dailyBudget)
        .catch((error) => logger.warn(`ad group daily budget was not filled automatically: ${error.message}`));
    }

    await this.saveAndContinue(page, logger, '30-ad-group-done');
  }

  private async chooseAdGroupTypeShoppingMallProduct(page: Page, logger: RunLogger) {
    const firstRadio = page.locator('input[type="radio"]').first();

    try {
      await firstRadio.check({ force: true, timeout: 3000 });
      await waitForDomSettled(page);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`shopping mall product ad group type was not selected by first radio: ${message}`);
    }

    const locators = [
      page.getByLabel('쇼핑몰 상품형', { exact: false }),
      page.locator('label').filter({ hasText: '쇼핑몰 상품형' }),
      page.locator('xpath=//*[normalize-space(.)="쇼핑몰 상품형"]/ancestor::*[self::label or self::button or @role="button"][1]'),
      page.locator('xpath=//*[normalize-space(.)="쇼핑몰 상품형"]/ancestor::*[self::div][.//input][1]'),
      page.getByText('쇼핑몰 상품형', { exact: true })
    ];

    for (const locator of locators) {
      const count = await locator.count().catch(() => 0);
      for (let index = 0; index < count; index += 1) {
        const current = locator.nth(index);

        try {
          await current.waitFor({ state: 'visible', timeout: 3000 });
          await current.click({ timeout: 3000 });
          await waitForDomSettled(page);
          return;
        } catch {
          // Try the next visible representation of the same card.
        }
      }
    }

    logger.warn('shopping mall product ad group type was not selected by structured locators; trying text fallback');
    await chooseByText(page, this.requiredChoice('adGroupTypeShoppingMallProduct'), 10000);
    await waitForDomSettled(page);
  }

  private async chooseShoppingSearchCampaignType(page: Page, logger: RunLogger) {
    const recommendedShoppingSearch = page
      .locator(
        'xpath=//*[normalize-space(.)="광고주님의 목적에 맞는 광고를 모아서 추천해 드립니다."]/following::*[normalize-space(.)="쇼핑검색"][1]'
      )
      .first();

    try {
      await recommendedShoppingSearch.click({ timeout: 5000 });
      await waitForDomSettled(page);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`recommended shopping search type was not selected automatically: ${message}`);
    }

    await chooseByText(page, this.requiredChoice('campaignTypeShoppingSearch'));
    await waitForDomSettled(page);
  }

  private async addProducts(page: Page, logger: RunLogger) {
    logger.info('step 3: products');

    for (const [index, product] of this.config.products.entries()) {
      await this.addProduct(page, logger, product, index + 1);
    }
  }

  private async addProduct(
    page: Page,
    logger: RunLogger,
    product: ShoppingSearchProductConfig,
    index: number
  ) {
    logger.info(`product ${index}: ${product.query}`);

    const searchField =
      product.searchType === 'productId'
        ? [...this.requiredField('productId'), ...this.requiredField('productSearch')]
        : [...this.requiredField('productName'), ...this.requiredField('productSearch')];

    if (product.searchType === 'productId') {
      await this.selectProductIdSearchType(page, logger);
    }

    await fillByLabelOrPlaceholder(page, searchField, product.query);
    await clickByText(page, this.requiredButton('search'));
    await waitForDomSettled(page);
    await logger.screenshot(page, `40-product-${index}-search`);

    if (product.expectedName) {
      await this.selectExpectedProductResult(page, logger, product);
    } else {
      await this.selectSingleProductResult(page, logger, product);
    }

    await clickByText(page, this.requiredButton('addProduct'));
    await waitForDomSettled(page);
    await logger.screenshot(page, `50-product-${index}-added`);
  }

  private async selectExpectedProductResult(
    page: Page,
    logger: RunLogger,
    product: ShoppingSearchProductConfig
  ) {
    const expectedName = product.expectedName.trim();
    const row = await this.productRowByText(page, expectedName);

    if (row) {
      logger.info(`expected product result selected: ${expectedName}`);
      await this.clickProductRow(row);
      return;
    }

    logger.warn(`expected product row was not found; trying direct text click: ${expectedName}`);
    await chooseByText(page, [expectedName]);
  }

  private async selectSingleProductResult(
    page: Page,
    logger: RunLogger,
    product: ShoppingSearchProductConfig
  ) {
    const rows = await this.productResultRows(page);

    if (!rows.length) {
      throw new Error(`상품 검색 결과를 찾지 못했습니다: ${product.query}`);
    }

    if (rows.length > 1) {
      const candidates = rows
        .slice(0, 5)
        .map((row, index) => `${index + 1}. ${compact(row.text).slice(0, 120)}`)
        .join(' / ');
      throw new Error(
        `쇼핑몰 상품 ID 검색 결과가 여러 개입니다. 입력한 ID를 확인하세요. 후보: ${candidates}`
      );
    }

    const result = rows[0];
    if (!result) {
      throw new Error(`상품 검색 결과를 찾지 못했습니다: ${product.query}`);
    }

    logger.info(`single product result selected: ${compact(result.text).slice(0, 160)}`);
  }

  private async selectProductIdSearchType(page: Page, logger: RunLogger) {
    const productIdChoices = this.requiredChoice('productSearchTypeProductId');

    const selectedNativeOption = await page.evaluate((choices) => {
      for (const select of document.querySelectorAll('select')) {
        const option = Array.from(select.options).find((currentOption) => {
          const text = currentOption.textContent?.replace(/\s+/g, ' ').trim() ?? '';
          return choices.some((choice) => text.includes(choice));
        });

        if (option) {
          select.value = option.value;
          select.dispatchEvent(new Event('input', { bubbles: true }));
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }

      return false;
    }, productIdChoices);

    if (!selectedNativeOption) {
      try {
        await chooseByText(page, productIdChoices, 1500);
      } catch {
        logger.info('product ID search option was not visible; opening product search type selector');
        await clickByText(page, this.requiredField('productName'), 1500);
        await waitForDomSettled(page);
        await chooseByText(page, productIdChoices);
      }
    }

    await waitForDomSettled(page);
    await chooseByText(page, this.requiredChoice('productSearchProductIdTypeMall'));
    await waitForDomSettled(page);
  }

  private async productResultRows(page: Page) {
    const locators = [
      page.locator('tr').filter({ hasText: /등록가능|등록불가/ }),
      page.locator('[role="row"]').filter({ hasText: /등록가능|등록불가/ })
    ];

    for (const locator of locators) {
      const rows: Array<{ locator: Locator; text: string }> = [];
      const count = await locator.count().catch(() => 0);

      for (let index = 0; index < count; index += 1) {
        const row = locator.nth(index);
        const text = compact((await row.innerText().catch(() => '')) ?? '');

        if (text && !/상품명|상태|입찰가|선택/.test(text)) {
          rows.push({ locator: row, text });
        }
      }

      if (rows.length) {
        return rows;
      }
    }

    return [];
  }

  private async productRowByText(page: Page, text: string) {
    const locators = [
      page.locator('tr').filter({ hasText: text }),
      page.locator('[role="row"]').filter({ hasText: text })
    ];

    for (const locator of locators) {
      const count = await locator.count().catch(() => 0);

      for (let index = 0; index < count; index += 1) {
        const row = locator.nth(index);
        const rowText = compact((await row.innerText().catch(() => '')) ?? '');

        if (rowText.includes(text) && !/상품명|상태|입찰가|선택/.test(rowText)) {
          return row;
        }
      }
    }

    return undefined;
  }

  private async clickProductRow(row: Locator) {
    const checkbox = row.locator('input[type="checkbox"], [role="checkbox"]').first();

    if ((await checkbox.count().catch(() => 0)) > 0) {
      await checkbox.click({ timeout: 2500 }).catch(() => undefined);
      return;
    }

    await row.click({ timeout: 2500 });
  }

  private async applyMaterialSettings(page: Page, logger: RunLogger) {
    const exposureProductName = this.config.material.exposureProductName.trim();

    if (!exposureProductName) {
      logger.info('material exposure product name is empty; skipping material edit');
      return;
    }

    logger.info(`step 4: material exposure product name = ${exposureProductName}`);

    await clickByText(page, this.requiredButton('confirm'));
    await waitForDomSettled(page);
    await logger.screenshot(page, '100-after-create-confirm');

    await clickByText(page, this.requiredButton('details'));
    await waitForDomSettled(page);
    await logger.screenshot(page, '101-material-details');

    await clickByText(page, this.requiredButton('edit'));
    await waitForDomSettled(page);
    await logger.screenshot(page, '102-material-edit-open');

    await fillByLabelOrPlaceholder(page, this.requiredField('exposureProductName'), exposureProductName);
    await logger.screenshot(page, '103-material-exposure-filled');

    await clickByText(page, this.requiredButton('save'));
    await waitForDomSettled(page);
    await logger.screenshot(page, '104-material-saved');
  }

  private async submitAndApplyMaterial(page: Page, logger: RunLogger) {
    await clickByText(page, this.requiredButton('createAds'));
    await waitForDomSettled(page);
    await logger.screenshot(page, '99-created');
    await this.applyMaterialSettings(page, logger);
  }

  private async saveAndContinue(page: Page, logger: RunLogger, screenshotName: string) {
    await clickByText(page, this.requiredButton('saveAndContinue'));
    await waitForDomSettled(page);
    await logger.screenshot(page, screenshotName);
    await this.throwKnownValidationError(page);
  }

  private async detectCurrentScreen(page: Page) {
    const bodyText = compact((await page.locator('body').innerText({ timeout: 3000 }).catch(() => '')) ?? '');

    if (bodyText.includes('쇼핑검색 캠페인 만들기')) {
      return 'campaign-settings' as const;
    }

    if (bodyText.includes('목적 선택하고 시작하기') && bodyText.includes('빠르게 광고 시작하기')) {
      return 'campaign-objective' as const;
    }

    if (bodyText.includes('쇼핑몰 상품형') && !bodyText.includes('광고그룹 이름')) {
      return 'ad-group-type' as const;
    }

    if (bodyText.includes('광고그룹 이름') || bodyText.includes('광고그룹명')) {
      return 'ad-group-settings' as const;
    }

    if (bodyText.includes('상품 검색') || bodyText.includes('검색 조건 설정') || bodyText.includes('상품ID')) {
      return 'product-search' as const;
    }

    if (bodyText.includes('광고 성과지표') || bodyText.includes('새 캠페인') || /캠페인 \d+개 결과/.test(bodyText)) {
      return 'campaign-list' as const;
    }

    if (bodyText.includes('광고 만들기 완료') || bodyText.includes('광고만들기')) {
      return 'before-submit' as const;
    }

    return 'unknown' as const;
  }

  private async throwKnownValidationError(page: Page) {
    const bodyText = compact((await page.locator('body').innerText({ timeout: 1000 }).catch(() => '')) ?? '');
    const knownMessages = [
      '이미 사용 중인 캠페인 이름입니다',
      '하루예산은 50원~1,000,000,000원 사이로 입력하세요',
      '광고그룹 유형을 선택해 주세요',
      '필수 항목을 입력해 주세요'
    ];
    const foundMessage = knownMessages.find((message) => bodyText.includes(message));

    if (foundMessage) {
      throw new Error(`네이버 광고 설정 화면 오류: ${foundMessage}`);
    }
  }

  private requiredButton(name: string) {
    return requiredCandidates(this.selectors.buttons, name);
  }

  private requiredField(name: string) {
    return requiredCandidates(this.selectors.fields, name);
  }

  private requiredChoice(name: string) {
    return requiredCandidates(this.selectors.choices, name);
  }
}

function requiredCandidates(record: Record<string, string[]>, key: string) {
  const candidates = record[key];
  if (!candidates?.length) {
    throw new Error(`Missing selector candidates for ${key}`);
  }

  return candidates;
}

function slug(value: string) {
  return value.replace(/[^a-zA-Z0-9가-힣._-]+/g, '-').replace(/^-|-$/g, '');
}

function compact(value: string) {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}
