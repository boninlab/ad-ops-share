import { validatePowerlinkDescription } from './powerlinkText.js';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserContext, Page } from 'playwright-core';
import type { PowerlinkImageAsset, ShoppingSearchConfig } from '../schema.js';
import { openChromeSession, type BrowserSession } from './browser.js';
import { waitForDomSettled } from './dom.js';
import { RunLogger } from './log.js';

export type PowerlinkApiRunResult = {
  runDir: string;
  adGroupId: string;
  adId: string;
  keywordCount: number;
  keywordBatchCount: number;
  shoppingWebExtensionId?: string;
  imageExtensionIds: string[];
  subLinksExtensionId?: string;
  promotionExtensionId?: string;
  headlineExtensionIds: string[];
  extraDescriptionExtensionId?: string;
  uploadedImageIds: string[];
  finalUrl?: string;
};

type PowerlinkApiRunPayload = Pick<
  ShoppingSearchConfig,
  'naverAdsUrl' | 'naverAdAccountId' | 'naverCustomerId' | 'powerlink'
>;

type BrowserImageAsset = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
};

type PowerlinkBrowserPayload = {
  config: PowerlinkApiRunPayload;
  images: BrowserImageAsset[];
};

export class NaverPowerlinkApiAutomation {
  constructor(private readonly config: ShoppingSearchConfig) {}

  async runInContext(context: BrowserContext): Promise<PowerlinkApiRunResult> {
    validatePowerlinkDescription(this.config.powerlink.material.description);
    const runDir = path.resolve(
      this.config.runOutputDir,
      `${new Date().toISOString().replace(/[:.]/g, '-')}-${slug(this.config.powerlink.adGroup.name)}-powerlink-http`
    );
    const logger = new RunLogger(runDir);
    await logger.init();

    try {
      const page = await this.openAdsPage(context);
      await logger.screenshot(page, '00-before-powerlink-http-run').catch(() => undefined);

      const images = await this.readImageAssets();
      logger.info('starting HTTP powerlink registration');
      logger.info(`keyword count: ${this.config.powerlink.keywords.length}`);
      logger.info(`image count: ${images.length}`);

      const result = await this.executeRegistration(page, images);
      logger.info(`ad group created: ${result.adGroupId}`);
      logger.info(`keywords created: ${result.keywordCount} in ${result.keywordBatchCount} batch(es)`);
      logger.info(`text ad created: ${result.adId}`);
      if (result.shoppingWebExtensionId) {
        logger.info(`shopping web extension created: ${result.shoppingWebExtensionId}`);
      }
      logger.info(`image extensions created: ${result.imageExtensionIds.length}`);
      logger.info(`text/link extensions created: ${[
        result.subLinksExtensionId,
        result.promotionExtensionId,
        result.extraDescriptionExtensionId,
        ...result.headlineExtensionIds
      ].filter(Boolean).length}`);

      const finalUrl = this.adGroupUrl(result.adGroupId);
      if (finalUrl) {
        logger.info(`opening final ad group page: ${finalUrl}`);
        await page.goto(finalUrl, { waitUntil: 'domcontentloaded' });
        await waitForDomSettled(page);
        await logger.screenshot(page, '99-final-powerlink-adgroup-page').catch(() => undefined);
      }

      const finalResult = { runDir, ...result, finalUrl };
      await writeFile(path.join(runDir, 'http-result.json'), `${JSON.stringify(finalResult, null, 2)}\n`, 'utf8');
      return finalResult;
    } finally {
      await logger.flush();
    }
  }

  async run(): Promise<PowerlinkApiRunResult> {
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
    const adAccountId = extractAdAccountId(this.config.powerlink.campaignUrl) ?? this.config.naverAdAccountId;
    if (!adAccountId) {
      return undefined;
    }

    return `https://ads.naver.com/manage/ad-accounts/${adAccountId}/sa/adgroups/${adGroupId}`;
  }

  private async openAdsPage(context: BrowserContext) {
    const page =
      context.pages().find((currentPage) => currentPage.url().includes('ads.naver.com')) ??
      context.pages().find((currentPage) => currentPage.url().includes('manage.searchad.naver.com')) ??
      (await context.newPage());

    if (!page.url().includes('ads.naver.com') || !page.url().includes(this.config.powerlink.campaignId)) {
      await page.goto(this.config.powerlink.campaignUrl, { waitUntil: 'domcontentloaded' });
      await waitForDomSettled(page);
    }

    return page;
  }

  private async readImageAssets() {
    const assets = this.config.powerlink.imageAssets ?? [];
    if (assets.length === 0) {
      throw new Error('파워링크 확장 소재 이미지가 저장되어 있지 않습니다.');
    }

    return Promise.all(
      assets.map(async (asset) => ({
        fileName: asset.fileName,
        mimeType: asset.mimeType || guessMimeType(asset.fileName),
        dataUrl: await imageAssetToDataUrl(asset)
      }))
    );
  }

  private async executeRegistration(page: Page, images: BrowserImageAsset[]) {
    await page.evaluate('globalThis.__name = (target) => target;');

    const payload: PowerlinkBrowserPayload = {
      config: {
        naverAdsUrl: this.config.naverAdsUrl,
        naverAdAccountId: this.config.naverAdAccountId,
        naverCustomerId: this.config.naverCustomerId,
        powerlink: this.config.powerlink
      },
      images
    };

    return page.evaluate((browserPayload: PowerlinkBrowserPayload) => {
      const config = browserPayload.config;
      const powerlink = config.powerlink;

      const compact = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
      const nowIso = () => new Date().toISOString();
      const keywordBatchSize = 100;

      const getCookie = (name: string) => {
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
              text.match(/customerId["':\s]+([0-9]{4,})/i) ??
              text.match(/adCustomerId["':\s]+([0-9]{4,})/i);
            if (match?.[1]) {
              return Number(match[1]);
            }
          }
        }

        return undefined;
      };

      const parseResponse = async (response: Response) => {
        const text = await response.text();
        try {
          return text ? JSON.parse(text) : null;
        } catch {
          return text;
        }
      };

      const xsrfToken = getCookie('XSRF-TOKEN') || getCookie('XSRF_TOKEN') || getCookie('csrfToken');

      const request = async (method: string, requestPath: string, body: unknown, customerId?: number) => {
        const headers: Record<string, string> = {
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

        const response = await fetch(requestPath, {
          method,
          credentials: 'include',
          headers,
          body: body === undefined ? undefined : JSON.stringify(body)
        });
        const data = await parseResponse(response);

        if (!response.ok) {
          const detail = typeof data === 'string' ? data : JSON.stringify(data);
          throw new Error(method + ' ' + requestPath + ' failed: ' + response.status + ' ' + detail);
        }

        return data;
      };

      const requestMultipart = async (requestPath: string, body: FormData, customerId: number) => {
        const headers: Record<string, string> = {
          accept: 'application/json, text/plain, */*',
          'cache-control': 'no-cache',
          'x-accept-language': 'ko-KR',
          'x-ad-customer-id': String(customerId)
        };

        if (xsrfToken) {
          headers['x-xsrf-token'] = xsrfToken;
        }

        const response = await fetch(requestPath, {
          method: 'POST',
          credentials: 'include',
          headers,
          body
        });
        const data = await parseResponse(response);

        if (!response.ok) {
          const detail = typeof data === 'string' ? data : JSON.stringify(data);
          throw new Error('POST ' + requestPath + ' failed: ' + response.status + ' ' + detail);
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

      const channelMatchesLink = (channel: any, productLink: string) => {
        const channelKey = compact(channel?.channelKey).replace(/\/+$/, '');
        return Boolean(channelKey && productLink.replace(/\/+$/, '').startsWith(channelKey));
      };

      const getSiteChannel = async (productLink: string, customerId: number) => {
        const channels = await request(
          'GET',
          '/apis/sa/api/ncc/channels?channelTp=SITE',
          undefined,
          customerId
        );
        const enabledChannels = Array.isArray(channels) ? channels.filter((item) => item.enabled !== false) : [];
        const channel = enabledChannels.find((item) => channelMatchesLink(item, productLink)) ?? enabledChannels[0];
        if (!channel?.nccBusinessChannelId || !channel?.channelKey) {
          throw new Error('사용 가능한 SITE 비즈채널을 찾지 못했습니다.');
        }

        return channel;
      };

      const getMallChannel = async (customerId: number) => {
        const channels = await request('GET', '/apis/sa/api/ncc/channels?customerId=' + customerId, undefined, customerId);
        const enabledChannels = Array.isArray(channels)
          ? channels.filter((item) => item.channelTp === 'MALL' && item.enabled !== false && item.referenceKey)
          : [];
        return enabledChannels.find((item) => channelMatchesLink(item, assertValidProductLink())) ?? enabledChannels[0];
      };

      const buildMediaTarget = (mediaList: unknown[]) => {
        const medias = mediaList.filter((item: any) => item?.type === 'media').map((item: any) => item.id);
        const mediaGroups = mediaList.filter((item: any) => item?.type === 'group').map((item: any) => item.id);

        if (medias.length === 0 && mediaGroups.length === 0) {
          throw new Error('파워링크 매체 타겟 목록을 만들지 못했습니다.');
        }

        return {
          target: {
            type: 3,
            black: {},
            white: {
              media: medias,
              mediaGroup: mediaGroups
            }
          },
          targetTp: 'MEDIA_TARGET'
        };
      };

      const buildAdGroupPayload = ({
        customerId,
        siteChannel,
        mediaTarget
      }: {
        customerId: number;
        siteChannel: any;
        mediaTarget: any;
      }) => ({
        adRollingType: 'PERFORMANCE',
        adgroupAttrJson: {},
        adgroupType: 'WEB_SITE',
        bidAmt: powerlink.adGroup.defaultBidPrice,
        budgetLock: false,
        customerId,
        dailyBudget: powerlink.adGroup.dailyBudget,
        delFlag: false,
        expectCost: 0,
        mobileChannelId: siteChannel.nccBusinessChannelId,
        mobileChannelKey: siteChannel.channelKey,
        mobileNetworkBidWeight: 120,
        name: powerlink.adGroup.name,
        nccCampaignId: powerlink.campaignId,
        pcChannelId: siteChannel.nccBusinessChannelId,
        pcChannelKey: siteChannel.channelKey,
        pcNetworkBidWeight: 60,
        targetSummary: {},
        useCntsNetworkBidAmt: false,
        useDailyBudget: true,
        userLock: powerlink.adGroup.userLock,
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

      const chunk = <T>(items: T[], size: number) => {
        const batches: T[][] = [];
        for (let index = 0; index < items.length; index += size) {
          batches.push(items.slice(index, index + size));
        }

        return batches;
      };

      const assertValidProductLink = () => {
        const productLink = compact(powerlink.material.productLink);
        if (!/^https?:\/\//i.test(productLink)) {
          throw new Error('파워링크 제품 링크가 올바른 URL이 아닙니다.');
        }

        return productLink;
      };

      const toAdTextToken = (value: string) =>
        value.replace(/\{keyword:/gi, '{키워드:').replace(/\{keyword\}/gi, '{키워드}');

      const validateTextAd = async (customerId: number) => {
        const validation = await request(
          'POST',
          '/apis/sa/validator/ncc',
          {
            locale: 'ko_KR',
            ads: [
              {
                headline: powerlink.material.headline,
                type: 'text'
              },
              {
                description: powerlink.material.description,
                type: 'text'
              }
            ]
          },
          customerId
        );
        const failed = Array.isArray(validation)
          ? validation.find((item) => item?.status && item.status !== 'ALLOW')
          : undefined;
        if (failed) {
          throw new Error('파워링크 소재 문구 검수 실패: ' + JSON.stringify(failed));
        }
      };

      const dataUrlToBlob = (image: BrowserImageAsset) => {
        const match = image.dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
        if (!match?.[2]) {
          throw new Error('이미지 데이터 형식이 올바르지 않습니다: ' + image.fileName);
        }

        const mimeType = match[1] || image.mimeType || 'image/png';
        const binary = atob(match[2]);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }

        return new Blob([bytes], { type: mimeType });
      };

      const uploadImage = async (customerId: number, image: BrowserImageAsset) => {
        const formData = new FormData();
        formData.append('image', dataUrlToBlob(image), image.fileName);
        formData.append('fileName', image.fileName);
        formData.append('imageType', 'AD_EXTENSION_COMMON_640');
        const uploaded = await requestMultipart('/apis/sa/api/tool/imageLibrary/uploadAndCreate/base64', formData, customerId);
        if (!uploaded?.imagePath) {
          throw new Error('이미지 업로드 응답에서 imagePath를 찾지 못했습니다.');
        }

        return uploaded;
      };

      const prepareImage = async (image: BrowserImageAsset): Promise<BrowserImageAsset> => {
        // Normalize the actual pixels, not just the metadata sent to Naver.
        const objectUrl = URL.createObjectURL(dataUrlToBlob(image));
        try {
          const source = new Image();
          source.src = objectUrl;
          await source.decode();
          if (!source.naturalWidth || !source.naturalHeight) {
            throw new Error('이미지 크기를 읽을 수 없습니다.');
          }
          const size = 640;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const context = canvas.getContext('2d');
          if (!context) {
            throw new Error('이미지 변환 기능을 사용할 수 없습니다.');
          }
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, size, size);
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          const scale = Math.min(size / source.naturalWidth, size / source.naturalHeight);
          const width = source.naturalWidth * scale;
          const height = source.naturalHeight * scale;
          context.drawImage(source, (size - width) / 2, (size - height) / 2, width, height);
          return {
            fileName: image.fileName.replace(/\.[^.]+$/, '') + '-640.jpg',
            mimeType: 'image/jpeg',
            dataUrl: canvas.toDataURL('image/jpeg', 0.95)
          };
        } catch (error) {
          throw new Error('파워링크 이미지 준비 실패 (' + image.fileName + '): ' +
            (error instanceof Error ? error.message : String(error)));
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };

      const buildExtensionPayload = ({
        customerId,
        ownerId,
        type,
        adExtension,
        pcChannelId,
        mobileChannelId
      }: {
        customerId: number;
        ownerId: string;
        type: string;
        adExtension: unknown;
        pcChannelId: string | null;
        mobileChannelId: string | null;
      }) => {
        const timestamp = nowIso();
        return {
          adExtension,
          customerId,
          delFlag: false,
          inspectRequestTm: timestamp,
          inspectStatus: 'UNDER_REVIEW',
          mobileChannelId,
          nccAdExtensionId: '',
          ownerId,
          pcChannelId,
          regTm: timestamp,
          schedule: null,
          status: 'PAUSED',
          statusReason: 'AD_EXTENSION_UNDER_REVIEW',
          type,
          usePeriod: false,
          userLock: false,
          periodStartDt: null,
          periodEndDt: null
        };
      };

      return (async () => {
        if (!location.hostname.endsWith('ads.naver.com')) {
          throw new Error('네이버 광고 도메인에서만 HTTP 등록을 실행할 수 있습니다. 로그인 열기로 열린 Chrome 창에서 다시 실행하세요.');
        }

        if (!powerlink.keywords.length) {
          throw new Error('파워링크 키워드 목록이 비어 있습니다.');
        }

        if (browserPayload.images.length === 0) {
          throw new Error('파워링크 확장 소재 이미지가 비어 있습니다.');
        }

        const customerId = Number(await getCustomerId());
        if (!customerId) {
          throw new Error('광고주 customerId를 찾지 못했습니다. 광고 계정 접근 권한과 로그인을 확인해 주세요.');
        }
        const productLink = assertValidProductLink();
        const siteChannel = await getSiteChannel(productLink, customerId);
        const campaign = await request(
          'GET',
          '/apis/sa/api/ncc/campaigns/' + encodeURIComponent(powerlink.campaignId),
          undefined,
          customerId
        );
        if (campaign?.campaignTp && campaign.campaignTp !== 'WEB_SITE') {
          throw new Error('선택한 캠페인이 파워링크 캠페인이 아닙니다: ' + powerlink.campaignId);
        }
        const mallChannel = await getMallChannel(customerId);
        if (!mallChannel?.nccBusinessChannelId || !mallChannel?.referenceKey) {
          throw new Error('쇼핑정보 확장소재에 사용할 MALL 비즈채널을 찾지 못했습니다.');
        }
        await validateTextAd(customerId);
        const preparedImages = [];
        for (const image of browserPayload.images) {
          preparedImages.push(await prepareImage(image));
        }

        const mediaList = await request(
          'GET',
          '/apis/sa/api/media?campaignType=WEB_SITE&includeNaverBlog=false&name=' +
            encodeURIComponent('네이버') +
            '&newChannel=true&skipOffedChannel=true',
          undefined,
          customerId
        );
        const mediaTarget = buildMediaTarget(Array.isArray(mediaList) ? mediaList : []);
        // Fail image preparation/upload before creating any campaign entities.
        const uploadedImages = [];
        for (const image of preparedImages) {
          uploadedImages.push(await uploadImage(customerId, image));
        }
        const adGroup = await request(
          'POST',
          '/apis/sa/api/ncc/adgroups',
          buildAdGroupPayload({
            customerId,
            siteChannel,
            mediaTarget
          }),
          customerId
        );
        if (!adGroup?.nccAdgroupId) {
          throw new Error('광고그룹 생성 응답에서 광고그룹 ID를 찾지 못했습니다.');
        }

        const keywordBatches = chunk(powerlink.keywords, keywordBatchSize);
        const createdKeywords: unknown[] = [];
        for (const batch of keywordBatches) {
          const created = await request(
            'POST',
            '/apis/sa/api/ncc/keywords?nccAdgroupId=' + encodeURIComponent(adGroup.nccAdgroupId),
            batch.map((keyword) => ({
              customerId,
              nccAdgroupId: adGroup.nccAdgroupId,
              keyword,
              attr: {}
            })),
            customerId
          );
          if (Array.isArray(created)) {
            createdKeywords.push(...created);
          }
        }
        if (createdKeywords.length !== powerlink.keywords.length) {
          throw new Error(
            '파워링크 키워드 등록 응답 수가 요청 수와 다릅니다: 요청 ' +
              powerlink.keywords.length +
              '개, 응답 ' +
              createdKeywords.length +
              '개'
          );
        }

        const textAd = await request(
          'POST',
          '/apis/sa/api/ncc/ads',
          {
            customerId,
            type: 'TEXT_45',
            nccAdgroupId: adGroup.nccAdgroupId,
            userLock: 0,
            ad: {
              headline: toAdTextToken(powerlink.material.headline),
              description: toAdTextToken(powerlink.material.description),
              pc: {
                display: siteChannel.channelKey,
                final: productLink
              },
              mobile: {
                display: siteChannel.channelKey,
                final: productLink
              }
            }
          },
          customerId
        );
        if (!textAd?.nccAdId) {
          throw new Error('파워링크 소재 생성 응답에서 광고 ID를 찾지 못했습니다.');
        }

        const shoppingWebExtension = await request(
          'POST',
          '/apis/sa/api/ncc/ad-extensions',
          buildExtensionPayload({
            customerId,
            ownerId: adGroup.nccAdgroupId,
            type: 'SHOPPING_WEB',
            adExtension: {
              view: mallChannel.channelKey,
              mallSeq: mallChannel.referenceKey
            },
            pcChannelId: mallChannel.nccBusinessChannelId,
            mobileChannelId: mallChannel.nccBusinessChannelId
          }),
          customerId
        );

        const imageExtensions = [];
        for (const uploaded of uploadedImages) {
          const imageExtension = await request(
            'POST',
            '/apis/sa/api/ncc/ad-extensions',
            buildExtensionPayload({
              customerId,
              ownerId: adGroup.nccAdgroupId,
              type: 'POWER_LINK_IMAGE',
              adExtension: {
                imagePath: uploaded.imagePath
              },
              pcChannelId: null,
              mobileChannelId: null
            }),
            customerId
          );
          imageExtensions.push(imageExtension);
        }

        const createAdGroupExtension = (type: string, adExtension: unknown) =>
          request(
            'POST',
            '/apis/sa/api/ncc/ad-extensions',
            buildExtensionPayload({
              customerId,
              ownerId: adGroup.nccAdgroupId,
              type,
              adExtension,
              pcChannelId: null,
              mobileChannelId: null
            }),
            customerId
          );

        const configuredExtensions = powerlink.extensions;
        const subLinksExtension = configuredExtensions.subLinks.length
          ? await createAdGroupExtension('SUB_LINKS', configuredExtensions.subLinks)
          : undefined;
        const promotionExtension = configuredExtensions.promotionText
          ? await createAdGroupExtension('DESCRIPTION', { description: configuredExtensions.promotionText })
          : undefined;
        const headlineExtensions = [];
        for (const headline of configuredExtensions.headlines) {
          headlineExtensions.push(await createAdGroupExtension('HEADLINE', { headline }));
        }
        const extraDescriptionExtension = configuredExtensions.extraDescription
          ? await createAdGroupExtension('DESCRIPTION_EXTRA', { description: configuredExtensions.extraDescription })
          : undefined;

        return {
          adGroupId: adGroup.nccAdgroupId,
          adId: textAd.nccAdId,
          keywordCount: createdKeywords.length,
          keywordBatchCount: keywordBatches.length,
          shoppingWebExtensionId: shoppingWebExtension?.nccAdExtensionId,
          imageExtensionIds: imageExtensions
            .map((item) => item?.nccAdExtensionId)
            .filter((item): item is string => Boolean(item)),
          subLinksExtensionId: subLinksExtension?.nccAdExtensionId,
          promotionExtensionId: promotionExtension?.nccAdExtensionId,
          headlineExtensionIds: headlineExtensions
            .map((item) => item?.nccAdExtensionId)
            .filter((item): item is string => Boolean(item)),
          extraDescriptionExtensionId: extraDescriptionExtension?.nccAdExtensionId,
          uploadedImageIds: uploadedImages.map((item) => item?.imageId).filter((item): item is string => Boolean(item)),
          debug: {
            requestedMediaTarget: mediaTarget,
            savedMediaTarget: adGroup.targets?.find((target: any) => target.targetTp === 'MEDIA_TARGET')
          }
        };
      })();
    }, payload) as Promise<{
      adGroupId: string;
      adId: string;
      keywordCount: number;
      keywordBatchCount: number;
      shoppingWebExtensionId?: string;
      imageExtensionIds: string[];
      subLinksExtensionId?: string;
      promotionExtensionId?: string;
      headlineExtensionIds: string[];
      extraDescriptionExtensionId?: string;
      uploadedImageIds: string[];
    }>;
  }
}

async function imageAssetToDataUrl(asset: PowerlinkImageAsset) {
  const filePath = path.isAbsolute(asset.path) ? asset.path : path.resolve(asset.path);
  const buffer = await readFile(filePath);
  const mimeType = asset.mimeType || guessMimeType(asset.fileName);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function guessMimeType(fileName: string) {
  const extname = path.extname(fileName).toLowerCase();
  if (extname === '.jpg' || extname === '.jpeg') {
    return 'image/jpeg';
  }

  if (extname === '.webp') {
    return 'image/webp';
  }

  if (extname === '.gif') {
    return 'image/gif';
  }

  return 'image/png';
}

function extractAdAccountId(url: string) {
  const match = url.match(/\/ad-accounts\/([0-9]+)/);
  return match?.[1] ? Number(match[1]) : undefined;
}

function slug(value: string) {
  return value.replace(/[^a-zA-Z0-9가-힣._-]+/g, '-').replace(/^-|-$/g, '');
}
