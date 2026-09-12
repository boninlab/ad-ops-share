import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserContext, Page } from 'playwright-core';
import type { ShoppingSearchConfig } from '../schema.js';
import { openChromeSession, type BrowserSession } from './browser.js';
import { registerShoppingExtensions } from './shoppingExtensions.js';
import { RunLogger } from './log.js';
import { waitForDomSettled } from './dom.js';

export type ShoppingSearchApiRunResult = {
  runDir: string;
  campaignId: string;
  adGroupId: string;
  adId: string;
  productReferenceKey: string;
  productMallProductId: string;
  excludedMediaCount: number;
  extensionIds: string[];
  finalUrl?: string;
};

type ApiRunPayload = Pick<
  ShoppingSearchConfig,
  'naverAdsUrl' | 'naverAdAccountId' | 'naverCustomerId' | 'campaign' | 'adGroup' | 'material' | 'products'
>;

export class NaverShoppingSearchApiAutomation {
  constructor(private readonly config: ShoppingSearchConfig) {}

  async runInContext(context: BrowserContext): Promise<ShoppingSearchApiRunResult> {
    const runDir = path.resolve(
      this.config.runOutputDir,
      `${new Date().toISOString().replace(/[:.]/g, '-')}-${slug(this.config.campaign.name)}-http`
    );
    const logger = new RunLogger(runDir);
    await logger.init();

    try {
      if ((this.config.extensions.useTalkTalk || this.config.extensions.promotionText1) && !this.config.naverAdAccountId) {
        throw new Error('확장 소재 등록에 필요한 네이버 광고 계정 ID가 없습니다.');
      }
      const page = await this.openAdsPage(context);
      await logger.screenshot(page, '00-before-http-run').catch(() => undefined);

      logger.info('starting HTTP shopping search registration');
      const result = await this.executeRegistration(page);
      logger.info(`campaign created: ${result.campaignId}`);
      logger.info(`ad group created: ${result.adGroupId}`);
      logger.info(`product ad created: ${result.adId}`);
      logger.info(`excluded media count: ${result.excludedMediaCount}`);

      const finalUrl = this.adGroupUrl(result.adGroupId);
      const extensionIds: string[] = [];
      const saveProgress = () => writeFile(path.join(runDir, 'http-result.json'),
        `${JSON.stringify({ runDir, ...result, extensionIds, finalUrl }, null, 2)}\n`, 'utf8');
      await saveProgress();
      if (finalUrl) {
        logger.info(`opening final ad group page: ${finalUrl}`);
        await page.goto(finalUrl, { waitUntil: 'domcontentloaded' });
        await waitForDomSettled(page);
        try {
          await registerShoppingExtensions(page, this.config.extensions, async (id) => {
            extensionIds.push(id);
            logger.info(`extension created: ${id}`);
            await saveProgress();
          });
        } catch (error) {
          await logger.screenshot(page, '98-extension-error').catch(() => undefined);
          throw new Error(`광고그룹과 상품 광고는 생성됐지만 확장 소재 등록에 실패했습니다. 전체 등록을 다시 실행하지 말고 광고그룹에서 확인하세요: ${finalUrl} · ${error instanceof Error ? error.message : String(error)}`);
        }
        await logger.screenshot(page, '99-final-adgroup-page').catch(() => undefined);
      }

      const finalResult = { runDir, ...result, extensionIds, finalUrl };
      await writeFile(path.join(runDir, 'http-result.json'), `${JSON.stringify(finalResult, null, 2)}\n`, 'utf8');
      return finalResult;
    } finally {
      await logger.flush();
    }
  }

  async run(): Promise<ShoppingSearchApiRunResult> {
    const session = await this.openSession();

    try {
      return await this.runInContext(session.context);
    } finally {
      await session.close();
    }
  }

  private async openSession(): Promise<BrowserSession> {
    return openChromeSession({
      mode: this.config.browserMode,
      profileDir: this.config.chromeProfileDir,
      cdpUrl: this.config.browserCdpUrl
    });
  }

  private adGroupUrl(adGroupId: string) {
    if (!this.config.naverAdAccountId) {
      return undefined;
    }

    return `https://ads.naver.com/manage/ad-accounts/${this.config.naverAdAccountId}/sa/adgroups/${adGroupId}`;
  }

  private async openAdsPage(context: BrowserContext) {
    const page =
      context.pages().find((currentPage) => currentPage.url().includes('ads.naver.com')) ??
      context.pages().find((currentPage) => currentPage.url().includes('manage.searchad.naver.com')) ??
      (await context.newPage());

    const accountCreateUrl = this.config.naverAdAccountId
      ? `https://ads.naver.com/manage/ad-accounts/${this.config.naverAdAccountId}/sa/create?advisedCampaignType=SHOPPING`
      : undefined;

    if (accountCreateUrl && !page.url().includes(`/manage/ad-accounts/${this.config.naverAdAccountId}/`)) {
      await page.goto(accountCreateUrl, { waitUntil: 'domcontentloaded' });
      await waitForDomSettled(page);
      return page;
    }

    if (!page.url().includes('ads.naver.com')) {
      await page.goto(this.config.naverAdsUrl, { waitUntil: 'domcontentloaded' });
      await waitForDomSettled(page);
    }

    return page;
  }

  private async executeRegistration(page: Page) {
    const payload: ApiRunPayload = {
      naverAdsUrl: this.config.naverAdsUrl,
      naverAdAccountId: this.config.naverAdAccountId,
      naverCustomerId: this.config.naverCustomerId,
      campaign: this.config.campaign,
      adGroup: this.config.adGroup,
      material: this.config.material,
      products: this.config.products
    };

    const script = `(() => {
      const config = ${JSON.stringify(payload)};

      const compact = (value) => String(value ?? '').normalize('NFC').replace(/\\s+/g, ' ').trim();
      const nowIso = () => new Date().toISOString();
      const firstProduct = config.products[0];

      const getCookie = (name) => {
        const prefix = name + '=';
        const found = document.cookie
          .split(';')
          .map((part) => part.trim())
          .find((part) => part.startsWith(prefix));
        return found ? decodeURIComponent(found.slice(prefix.length)) : '';
      };

      const discoverCustomerId = () => {
        const storages = [window.localStorage, window.sessionStorage];
        for (const storage of storages) {
          for (let index = 0; index < storage.length; index += 1) {
            const key = storage.key(index) ?? '';
            const value = storage.getItem(key) ?? '';
            const text = key + ' ' + value;
            const match =
              text.match(/customerId["':\\s]+([0-9]{4,})/i) ??
              text.match(/adCustomerId["':\\s]+([0-9]{4,})/i);
            if (match?.[1]) {
              return Number(match[1]);
            }
          }
        }

        return undefined;
      };

      const parseResponse = async (response) => {
        const text = await response.text();
        try {
          return text ? JSON.parse(text) : null;
        } catch {
          return text;
        }
      };

      const xsrfToken = getCookie('XSRF-TOKEN') || getCookie('XSRF_TOKEN') || getCookie('csrfToken');

      const request = async (method, path, body, customerId) => {
        const headers = {
          accept: 'application/json, text/plain, */*',
          'cache-control': 'no-cache',
          'x-accept-language': 'ko-KR'
        };

        if (xsrfToken) {
          headers['x-xsrf-token'] = xsrfToken;
        }

        if (customerId) {
          headers['x-ad-customer-id'] = String(customerId);
        }

        if (body !== undefined) {
          headers['content-type'] = 'application/json';
        }

        const response = await fetch(path, {
          method,
          credentials: 'include',
          headers,
          body: body === undefined ? undefined : JSON.stringify(body)
        });
        const data = await parseResponse(response);

        if (!response.ok) {
          const detail = typeof data === 'string' ? data : JSON.stringify(data);
          throw new Error(method + ' ' + path + ' failed: ' + response.status + ' ' + detail);
        }

        return data;
      };

      const discoverCustomerIdFromAccount = async () => {
        const accountIdFromPath = location.pathname.split('/manage/ad-accounts/')[1]?.split('/')[0];
        const adAccountId = Number(accountIdFromPath) || config.naverAdAccountId;
        if (!adAccountId) {
          return undefined;
        }

        const result = await request(
          'GET',
          '/apis/ad-account/v2/adAccounts/' + adAccountId,
          undefined,
          undefined
        );
        const customerId = Number(
          result?.adAccount?.masterCustomerId ??
            result?.adAccount?.customerId ??
            result?.masterCustomerId ??
            result?.customerId
        );

        return Number.isFinite(customerId) && customerId > 0 ? customerId : undefined;
      };

      const getCustomerId = async () =>
        (await discoverCustomerIdFromAccount()) || config.naverCustomerId || discoverCustomerId();

      const getChannels = async () => {
        const customerId = await getCustomerId();
        if (!customerId) {
          throw new Error('광고주 customerId를 찾지 못했습니다. 광고 계정 접근 권한과 로그인을 확인해 주세요.');
        }

        const channels = await request('GET', '/apis/sa/api/ncc/channels?channelTp=MALL', undefined, customerId);
        return { channels, customerId };
      };

      const isNaverMedia = (media) => {
        const name = compact(media.name);
        return media.naverMedia === true || name.startsWith('네이버') || name.toUpperCase().startsWith('NAVER');
      };

      const buildMediaTarget = (mediaList) => {
        const excludedMedia = mediaList
          .filter((media) => media.type === 'media')
          .filter((media) => !isNaverMedia(media));
        const excludedMediaIds = excludedMedia.map((media) => media.id);

        return {
          target: {
            type: 2,
            contents: ['naver'],
            search: ['naver'],
            black: {
              media: excludedMediaIds,
              mediaGroup: []
            },
            white: {}
          },
          targetTp: 'MEDIA_TARGET',
          debug: {
            excludedMedia: excludedMedia.map((media) => ({
              id: media.id,
              name: media.name,
              grade: media.grade,
              naverMedia: media.naverMedia,
              networkTypes: media.networkTypes
            }))
          }
        };
      };

      const buildCampaignPayload = (customerId) => {
        const timestamp = nowIso();
        return {
          campaignTp: 'SHOPPING',
          customerId,
          dailyBudget: config.campaign.dailyBudget,
          delFlag: false,
          deliveryMethod: 'ACCELERATED',
          editTm: timestamp,
          expectCost: 0,
          name: config.campaign.name,
          regTm: timestamp,
          status: 'ELIGIBLE',
          statusReason: 'ELIGIBLE',
          trackingMode: config.campaign.useAutoTracking ? 'AUTO_TRACKING_MODE' : 'TRACKING_DISABLED',
          useDailyBudget: true,
          usePeriod: false,
          userLock: false
        };
      };

      const buildAdGroupPayload = ({ customerId, campaignId, channel, mediaTarget }) => ({
        adRollingType: 'ROUND_ROBIN',
        adgroupAttrJson: {},
        adgroupType: 'SHOPPING',
        bidAmt: config.adGroup.defaultBidPrice,
        budgetLock: false,
        customerId,
        dailyBudget: config.adGroup.dailyBudget,
        delFlag: false,
        expectCost: 0,
        mobileChannelId: channel.nccBusinessChannelId,
        mobileChannelKey: channel.channelKey,
        mobileNetworkBidWeight: 120,
        name: config.adGroup.name,
        nccCampaignId: campaignId,
        pcChannelId: channel.nccBusinessChannelId,
        pcChannelKey: channel.channelKey,
        pcNetworkBidWeight: 60,
        targetSummary: {},
        useCntsNetworkBidAmt: false,
        useDailyBudget: true,
        userLock: false,
        targets: [
          mediaTarget,
          { target: { pc: true, mobile: true }, targetTp: 'PC_MOBILE_TARGET' },
          { target: null, targetTp: 'REGIONAL_TARGET' },
          { target: null, targetTp: 'PERIOD_TARGET' },
          { target: { male: true, female: true, unknown: true }, targetTp: 'GENDER_TARGET' },
          { target: null, targetTp: 'TIME_WEEKLY_TARGET' },
          { target: null, targetTp: 'GENDER_WEIGHT_TARGET' },
          { target: null, targetTp: 'AGE_TARGET' },
          { target: [], targetTp: 'RESTRICT_KEYWORD_TARGET' }
        ],
        systemBiddingType: 'NONE',
        agreeSystemBidding: false,
        useCntsNetworkBidWeight: false,
        useExpSearch: true,
        expSearchBudgetRatio: 100,
        sharedExpSearchBudgetRatio: 100,
        crawlStatus: null
      });

      const findProduct = async ({ customerId, channels }) => {
        if (!firstProduct?.query) {
          throw new Error('쇼핑몰 상품 ID가 비어 있습니다.');
        }

        const query = compact(firstProduct.query);
        const searchParams = new URLSearchParams({
          page: '0-2000-RGST_YMDT_DESC',
          includeNonRegistrable: 'true'
        });

        if (firstProduct.searchType === 'productId') {
          searchParams.set('mallPids', query);
        } else {
          searchParams.set('prodNm', query);
        }

        let nonRegistrableProduct;
        const lookupErrors = [];

        for (const channel of channels) {
          let result;

          try {
            result = await request(
              'GET',
              '/apis/sa/api/ncc/channels/' +
                channel.nccBusinessChannelId +
                '/shopping-products?' +
                searchParams.toString(),
              undefined,
              customerId
            );
          } catch (error) {
            lookupErrors.push(error instanceof Error ? error.message : String(error));
            continue;
          }

          const products = Array.isArray(result?.products) ? result.products : [];
          const product = products.find((candidate) => {
            if (firstProduct.searchType === 'productId') {
              return String(candidate.mallProductId) === query;
            }

            const productName = compact(candidate.productName || candidate.productTitle);
            return productName.includes(query);
          });

          if (!product) {
            continue;
          }

          if (product.registrable === false) {
            nonRegistrableProduct = product;
            continue;
          }

          return { channel, product };
        }

        if (nonRegistrableProduct) {
          throw new Error('네이버 광고 등록 불가 상품입니다: ' + query);
        }

        if (lookupErrors.length === channels.length) {
          throw new Error('상품 조회 API 호출에 모두 실패했습니다: ' + lookupErrors[0]);
        }

        throw new Error('연결된 쇼핑몰에서 상품을 찾지 못했습니다: ' + query);
      };

      return (async () => {
        if (!location.hostname.endsWith('ads.naver.com')) {
          throw new Error('네이버 광고 도메인에서만 HTTP 등록을 실행할 수 있습니다. 로그인 열기로 열린 Chrome 창에서 다시 실행하세요.');
        }

        const { channels, customerId } = await getChannels();
        const enabledChannels = Array.isArray(channels)
          ? channels.filter(
              (item) => item.enabled !== false && item.nccBusinessChannelId && item.channelKey
            )
          : [];
        if (enabledChannels.length === 0) {
          throw new Error('사용 가능한 쇼핑몰 채널을 찾지 못했습니다.');
        }

        const { channel, product } = await findProduct({ customerId, channels: enabledChannels });
        const mediaList = await request(
          'GET',
          '/apis/sa/api/media?campaignType=SHOPPING&majorOnly=true&newChannel=true&skipOffedChannel=true',
          undefined,
          customerId
        );
        const mediaTarget = buildMediaTarget(Array.isArray(mediaList) ? mediaList : []);
        const mediaTargetForRequest = {
          target: mediaTarget.target,
          targetTp: mediaTarget.targetTp
        };
        const exposureProductName = compact(config.material.exposureProductName);
        if (exposureProductName) {
          const validation = await request(
            'POST',
            '/apis/sa/validator/ncc',
            {
              locale: 'ko_KR',
              ads: [
                {
                  productName: exposureProductName,
                  type: 'product'
                }
              ]
            },
            customerId
          );
          const validationResult = Array.isArray(validation) ? validation[0] : undefined;
          if (validationResult?.status && validationResult.status !== 'ALLOW') {
            throw new Error('노출용 상품명 검수 실패: ' + JSON.stringify(validationResult));
          }
        }

        const campaign = await request('POST', '/apis/sa/api/ncc/campaigns', buildCampaignPayload(customerId), customerId);
        if (!campaign?.nccCampaignId) {
          throw new Error('캠페인 생성 응답에서 캠페인 ID를 찾지 못했습니다.');
        }
        const adGroup = await request(
          'POST',
          '/apis/sa/api/ncc/adgroups',
          buildAdGroupPayload({
            customerId,
            campaignId: campaign.nccCampaignId,
            channel,
            mediaTarget: mediaTargetForRequest
          }),
          customerId
        );
        if (!adGroup?.nccAdgroupId) {
          throw new Error('광고그룹 생성 응답에서 광고그룹 ID를 찾지 못했습니다.');
        }
        const createdAds = await request(
          'POST',
          '/apis/sa/api/ncc/ads?isList=true',
          [
            {
              ad: {},
              adAttr: {
                useGroupBidAmt: true,
                bidAmt: 50
              },
              customerId,
              nccAdgroupId: adGroup.nccAdgroupId,
              referenceKey: product.id,
              type: 'SHOPPING_PRODUCT_AD'
            }
          ],
          customerId
        );
        const createdAd = Array.isArray(createdAds) ? createdAds[0] : undefined;
        if (!createdAd?.nccAdId) {
          throw new Error('상품 광고 생성 응답에서 광고 ID를 찾지 못했습니다.');
        }

        if (exposureProductName) {
          await request(
            'PUT',
            '/apis/sa/api/ncc/ads/' + createdAd.nccAdId + '?fields=ad',
            {
              ...createdAd,
              ad: {
                ...(createdAd.ad ?? {}),
                productName: exposureProductName
              },
              labels: [],
              campaignTp: 'SHOPPING',
              bidAmt: config.adGroup.defaultBidPrice
            },
            customerId
          );
        }

        return {
          campaignId: campaign.nccCampaignId,
          adGroupId: adGroup.nccAdgroupId,
          adId: createdAd.nccAdId,
          productReferenceKey: product.id,
          productMallProductId: product.mallProductId,
          excludedMediaCount: mediaTarget.target.black.media.length,
          debug: {
            requestedMediaTarget: mediaTargetForRequest,
            excludedMedia: mediaTarget.debug.excludedMedia,
            savedMediaTarget: adGroup.targets?.find((target) => target.targetTp === 'MEDIA_TARGET')
          }
        };
      })();
    })()`;

    return page.evaluate(script) as Promise<{
      campaignId: string;
      adGroupId: string;
      adId: string;
      productReferenceKey: string;
      productMallProductId: string;
      excludedMediaCount: number;
    }>;
  }
}

function slug(value: string) {
  return value.replace(/[^a-zA-Z0-9가-힣._-]+/g, '-').replace(/^-|-$/g, '');
}
