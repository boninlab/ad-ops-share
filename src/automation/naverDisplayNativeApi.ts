import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserContext, Page, Response } from 'playwright-core';
import type { PowerlinkImageAsset, ShoppingSearchConfig } from '../schema.js';
import { openChromeSession, type BrowserSession } from './browser.js';
import { waitForDomSettled } from './dom.js';
import { RunLogger } from './log.js';

export type DisplayNativeApiRunResult = {
  runDir: string;
  adSetNo: string;
  creativeNo?: string;
  realCreativeNo?: string;
  profileImageNo?: string;
  uploadedImageNos: Record<DisplayNativeAdImageSlot, string>;
  finalUrl?: string;
};

type DisplayNativeApiRunPayload = Pick<ShoppingSearchConfig, 'naverAdAccountId' | 'displayNative'>;

type DisplayNativeImageSlot = 'profile' | DisplayNativeAdImageSlot;
type DisplayNativeAdImageSlot = 'square' | 'wide' | 'tall' | 'banner';

type BrowserImageAsset = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  size: number;
};

type DisplayNativeBrowserPayload = {
  config: DisplayNativeApiRunPayload;
  images: Record<DisplayNativeImageSlot, BrowserImageAsset>;
  adSetNo?: string;
};

type DisplayNativeResolvedAssetSelection = {
  adSetNo: string;
  profileImageNo?: string;
  profileImageUrl?: string;
  adImageUrls?: Record<DisplayNativeAdImageSlot, string>;
  uploadedImageNos: Record<DisplayNativeAdImageSlot, string>;
  needsUiCreative?: boolean;
};

type GfaPhoto = {
  no?: number | string;
  adAccountNo?: number | string;
  sizeGroupNo?: number | string;
  imageUrl?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  filename?: string;
  createdAt?: string;
};

const displayNativeImageSlots: DisplayNativeImageSlot[] = ['profile', 'square', 'wide', 'tall', 'banner'];

export class NaverDisplayNativeApiAutomation {
  constructor(private readonly config: ShoppingSearchConfig) {}

  async runInContext(context: BrowserContext): Promise<DisplayNativeApiRunResult> {
    const runDir = path.resolve(
      this.config.runOutputDir,
      `${new Date().toISOString().replace(/[:.]/g, '-')}-${slug(this.config.displayNative.adGroup.name)}-display-native-http`
    );
    const logger = new RunLogger(runDir);
    await logger.init();

    try {
      const page = await this.openAdsPage(context);
      await logger.screenshot(page, '00-before-display-native-http-run').catch(() => undefined);

      const images = await this.readImageAssets();
      logger.info('starting HTTP display native registration');
      logger.info(`ad group name: ${this.config.displayNative.adGroup.name}`);
      logger.info(`image count: ${Object.keys(images).length}`);

      const result = await this.executeRegistration(page, images, logger);
      logger.info(`ad set created: ${result.adSetNo}`);
      if (result.creativeNo) {
        logger.info(`creative draft created: ${result.creativeNo}`);
      }
      if (result.realCreativeNo) {
        logger.info(`real creative created: ${result.realCreativeNo}`);
      }

      const finalUrl = this.adSetUrl(result.adSetNo);
      if (finalUrl) {
        logger.info(`opening final ad set page: ${finalUrl}`);
        await page.goto(finalUrl, { waitUntil: 'domcontentloaded' });
        await waitForDomSettled(page);
        await logger.screenshot(page, '99-final-display-native-adset-page').catch(() => undefined);
      }

      const finalResult = { runDir, ...result, finalUrl };
      await writeFile(path.join(runDir, 'http-result.json'), `${JSON.stringify(finalResult, null, 2)}\n`, 'utf8');
      return finalResult;
    } finally {
      await logger.flush();
    }
  }

  async run(): Promise<DisplayNativeApiRunResult> {
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

  private adSetUrl(adSetNo: string) {
    const adAccountId = this.adAccountId();
    if (!adAccountId) {
      return undefined;
    }

    return `https://ads.naver.com/manage/ad-accounts/${adAccountId}/da/dashboard/campaign/${this.config.displayNative.campaignId}/adSet/${adSetNo}`;
  }

  private creativeCreateUrl(adSetNo: string) {
    const adAccountId = this.adAccountId();
    if (!adAccountId) {
      return undefined;
    }

    return `https://ads.naver.com/manage/ad-accounts/${adAccountId}/da/ad/create/creative?campaignNo=${this.config.displayNative.campaignId}&adSetNo=${adSetNo}`;
  }

  private adAccountId() {
    return extractAdAccountId(this.config.displayNative.campaignUrl) ?? this.config.naverAdAccountId;
  }

  private async openAdsPage(context: BrowserContext) {
    const page =
      context.pages().find((currentPage) => currentPage.url().includes('ads.naver.com')) ??
      context.pages().find((currentPage) => currentPage.url().includes('manage.searchad.naver.com')) ??
      (await context.newPage());

    if (!page.url().includes('ads.naver.com') || !page.url().includes(this.config.displayNative.campaignId)) {
      await page.goto(this.config.displayNative.campaignUrl, { waitUntil: 'domcontentloaded' });
      await waitForDomSettled(page);
    }

    return page;
  }

  private async readImageAssets() {
    const assets = this.config.displayNative.imageAssets ?? {};
    const images: Partial<Record<DisplayNativeImageSlot, BrowserImageAsset>> = {};

    for (const slot of displayNativeImageSlots) {
      const asset = assets[slot] as PowerlinkImageAsset | undefined;
      if (!asset) {
        throw new Error(displayNativeImageLabel(slot) + '가 저장되어 있지 않습니다.');
      }

      images[slot] = {
        fileName: asset.fileName,
        mimeType: asset.mimeType || guessMimeType(asset.fileName),
        dataUrl: await imageAssetToDataUrl(asset),
        size: asset.size ?? 0
      };
    }

    return images as Record<DisplayNativeImageSlot, BrowserImageAsset>;
  }

  private async executeRegistration(page: Page, images: Record<DisplayNativeImageSlot, BrowserImageAsset>, logger: RunLogger) {
    await page.evaluate('globalThis.__name = (target) => target;');

    const payloadBase: DisplayNativeBrowserPayload = {
      config: {
        naverAdAccountId: this.config.naverAdAccountId,
        displayNative: this.config.displayNative
      },
      images
    };

    logger.info('display native step: create ad set request start');
    const firstResult = await this.executeRegistrationStep(page, payloadBase);
    logger.info(
      `display native step: create ad set request done: ${firstResult.adSetNo}, needsCreativeRoute=${Boolean(firstResult.needsCreativeRoute)}`
    );
    if (!firstResult.needsCreativeRoute) {
      return firstResult;
    }

    const creativeUrl = this.creativeCreateUrl(firstResult.adSetNo);
    if (!creativeUrl) {
      throw new Error('소재 생성 화면 URL을 만들지 못했습니다.');
    }

    logger.info(`display native step: open creative route: ${creativeUrl}`);
    await page.goto(creativeUrl, { waitUntil: 'domcontentloaded' });
    await waitForDomSettled(page);
    await page.evaluate('globalThis.__name = (target) => target;');

    logger.info('display native step: resolve creative assets start');
    const finalResult = await this.executeRegistrationStep(page, {
      ...payloadBase,
      adSetNo: firstResult.adSetNo
    });
    logger.info(
      `display native step: resolve creative assets done: needsUiCreative=${Boolean(finalResult.needsUiCreative)}, images=${JSON.stringify(
        finalResult.uploadedImageNos
      )}`
    );
    if (finalResult.needsCreativeRoute) {
      throw new Error('소재 생성 화면 로드 후에도 등록이 재개되지 않았습니다.');
    }

    if (finalResult.needsUiCreative) {
      logger.info('display native step: UI creative submit start');
      const uiResult = await this.submitCreativeViaUi(page, finalResult, logger);
      logger.info('display native step: UI creative submit done');
      return {
        ...finalResult,
        ...uiResult,
        needsUiCreative: false
      };
    }

    return finalResult;
  }

  private async executeRegistrationStep(page: Page, payload: DisplayNativeBrowserPayload) {
    return page.evaluate((browserPayload: DisplayNativeBrowserPayload) => {
      const config = browserPayload.config;
      const displayNative = config.displayNative;
      const adImageSlots: DisplayNativeAdImageSlot[] = ['banner', 'wide', 'square', 'tall'];
      const adImageTemplateCodes: Record<DisplayNativeAdImageSlot, string[]> = {
        banner: ['NATIVE_SINGLE_IMAGE_V2', 'NATIVE_SINGLE_IMAGE_PC'],
        wide: ['FEED_SINGLE_IMAGE'],
        square: ['FEED_SINGLE_IMAGE_SQUARE'],
        tall: ['FEED_SINGLE_IMAGE_2TO3']
      };
      const adImageSizeGroupNos: Record<DisplayNativeAdImageSlot, number> = {
        banner: 8,
        wide: 2,
        square: 15,
        tall: 20
      };
      const adImageUploadSizeGroupNos = [2, 15, 20, 8];
      const ageRanges: Record<string, { from: number; to: number }> = {
        '14-18': { from: 14, to: 18 },
        '19-24': { from: 19, to: 24 },
        '25-29': { from: 25, to: 29 },
        '30-34': { from: 30, to: 34 },
        '35-39': { from: 35, to: 39 },
        '40-44': { from: 40, to: 44 },
        '45-49': { from: 45, to: 49 },
        '50-54': { from: 50, to: 54 },
        '55-59': { from: 55, to: 59 },
        '60+': { from: 60, to: 200 }
      };

      const compact = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

      const extractAdAccountId = (url: string) => {
        const match = url.match(/\/ad-accounts\/([0-9]+)/);
        return match?.[1] ? Number(match[1]) : undefined;
      };

      const adAccountNo = Number(
        extractAdAccountId(location.pathname) || extractAdAccountId(displayNative.campaignUrl) || config.naverAdAccountId
      );

      const adSetCreateUrl = () =>
        `${location.origin}/manage/ad-accounts/${adAccountNo}/da/ad/create/adSet?campaignNo=${encodeURIComponent(
          displayNative.campaignId
        )}`;

      const creativeCreateUrl = (adSetNo: string) =>
        `${location.origin}/manage/ad-accounts/${adAccountNo}/da/ad/create/creative?campaignNo=${encodeURIComponent(
          displayNative.campaignId
        )}&adSetNo=${encodeURIComponent(adSetNo)}`;

      const applyReferrerRoute = (referrer?: string) => {
        if (referrer && location.href !== referrer) {
          window.history.replaceState(window.history.state, '', referrer);
        }
      };

      type NaverGfaClient = {
        request: (options: Record<string, unknown>) => Promise<{ data: unknown }>;
      };
      const loadRequestClient = (): NaverGfaClient => {
        const target = window as unknown as { webpackChunkreact_app?: unknown[] };
        let requireModule: ((id: number) => { $L?: { instance?: NaverGfaClient } }) | undefined;
        if (!target.webpackChunkreact_app) {
          throw new Error('네이버 광고 화면이 초기화되지 않았습니다. 로그인 후 다시 시도하세요.');
        }
        target.webpackChunkreact_app.push([
          [`codex-gfa-client-${Date.now()}-${Math.random()}`], {},
          (runtimeRequire: typeof requireModule) => { requireModule = runtimeRequire; }
        ]);
        // Naver's current shared GFA client supplies fresh XSRF and account headers.
        const client = requireModule?.(39207)?.$L?.instance;
        if (!client?.request) {
          throw new Error('네이버 광고 요청 모듈을 찾지 못했습니다. 페이지를 새로고침하거나 도구 업데이트가 필요합니다.');
        }
        return client;
      };
      const request = async (method: string, requestPath: string, body?: unknown, headers?: Record<string, string>, referrer?: string) => {
        applyReferrerRoute(referrer);
        const isGfa = requestPath.startsWith('/apis/gfa/');
        try {
          const response = await loadRequestClient().request({
            method: method.toLowerCase(),
            baseURL: isGfa ? '/apis/gfa' : '',
            url: isGfa ? requestPath.slice('/apis/gfa'.length) : requestPath,
            data: body,
            headers,
            timeout: 60000,
            withCredentials: true,
            showErrorPopup: false
          });
          return response.data;
        } catch (error) {
          const failure = error as { response?: { status?: number; data?: unknown }; message?: string };
          const status = failure.response?.status;
          if (status === 401 || status === 403) {
            throw new Error(`네이버가 요청을 거부했습니다 (HTTP ${status}). 로그인 세션 또는 광고 계정의 등록 권한을 확인하세요. 자동 재시도는 하지 않았습니다. [${method} ${requestPath}]`);
          }
          const data = failure.response?.data;
          const detail = typeof data === 'string'
            ? data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)
            : data ? JSON.stringify(data).slice(0, 500) : failure.message ?? String(error);
          throw new Error(`${method} ${requestPath} failed${status ? `: ${status}` : ''}: ${detail}`);
        }
      };

      const requestJson = async (method: string, requestPath: string, referrer?: string) => request(method, requestPath, undefined, undefined, referrer);

      const requestForm = async (requestPath: string, params: URLSearchParams, referrer?: string) =>
        request(
          'POST',
          requestPath,
          Object.fromEntries(params),
          {
            'content-type': 'application/x-www-form-urlencoded'
          },
          referrer
        );

      const requestMultipart = async (requestPath: string, body: FormData, referrer?: string) =>
        request('POST', requestPath, body, undefined, referrer);

      const loadNaverGfaApi = () => {
        const target = window as unknown as {
          webpackChunkreact_app?: unknown[];
        };
        const chunks = (target.webpackChunkreact_app = target.webpackChunkreact_app ?? []);
        let webpackRequire:
          | ((
              moduleId: number
            ) => {
              Owq?: (
                adAccountNo: number,
                body: Record<string, unknown>,
                query: Record<string, unknown>,
                options?: Record<string, unknown>
              ) => Promise<{ data?: { images?: GfaPhoto[] } }>;
              RMw?: (
                adAccountNo: number,
                creativeType: string,
                query: Record<string, unknown>,
                options: Record<string, unknown>,
                version?: string
              ) => Promise<{ data?: { no?: number | string; realCreativeNo?: number | string } }>;
            })
          | undefined;

        chunks.push([
          [`codex-${Date.now()}-${Math.random()}`],
          {},
          (runtimeRequire: typeof webpackRequire) => {
            webpackRequire = runtimeRequire;
          }
        ]);

        const api = webpackRequire?.(25901);
        if (!api) {
          throw new Error('네이버 광고 화면의 내부 API 모듈을 찾지 못했습니다.');
        }

        return api;
      };

      const append = (params: URLSearchParams, key: string, value: unknown) => {
        if (value === undefined || value === null || value === '') {
          return;
        }

        params.append(key, String(value));
      };

      const localDateTimeValue = (date: Date) => {
        const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
        return offsetDate.toISOString().slice(0, 16);
      };

      const effectiveStartTime = () => {
        const configured = compact(displayNative.adGroup.startAt).slice(0, 16);
        const parsed = new Date(configured);
        if (configured && !Number.isNaN(parsed.getTime()) && parsed.getTime() >= Date.now() + 30 * 60 * 1000) {
          return configured;
        }

        return localDateTimeValue(new Date(Date.now() + 40 * 60 * 1000));
      };

      const dataUrlToFile = (image: BrowserImageAsset) => {
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

        return new File([bytes], image.fileName, { type: mimeType });
      };

      const uploadPhotos = async (sizeGroupNos: number[], imagesToUpload: BrowserImageAsset[], referrer?: string) => {
        applyReferrerRoute(referrer);
        let lastError: unknown;

        try {
          const api = loadNaverGfaApi();
          if (typeof api.Owq === 'function') {
            const response = await api.Owq(
              adAccountNo,
              {
                files: imagesToUpload.map((image) => dataUrlToFile(image))
              },
              {
                sizeGroupNos
              },
              {
                headers: {
                  'Content-Type': 'multipart/form-data'
                },
                showErrorPopup: false
              }
            );
            const images = response?.data?.images;
            if (Array.isArray(images) && images.length > 0) {
              return images;
            }
            lastError = new Error('네이버 내부 이미지 업로드 응답이 비어 있습니다: ' + JSON.stringify(response?.data ?? response));
          }
        } catch (error) {
          lastError = error;
        }

        const query = sizeGroupNos.map((sizeGroupNo) => 'sizeGroupNos=' + encodeURIComponent(String(sizeGroupNo))).join('&');
        const requestPath = `/apis/gfa/v1/adAccounts/${adAccountNo}/photos/upload/multiple?${query}`;
        const formData = new FormData();
        for (const image of imagesToUpload) {
          formData.append('files', dataUrlToFile(image), image.fileName);
        }

        try {
          const uploaded = (await requestMultipart(requestPath, formData, referrer)) as { images?: GfaPhoto[] };
          if (Array.isArray(uploaded.images) && uploaded.images.length > 0) {
            return uploaded.images;
          }
          lastError = new Error('이미지 업로드 응답이 비어 있습니다: ' + JSON.stringify(uploaded));
        } catch (error) {
          lastError = error;
        }

        throw lastError instanceof Error ? lastError : new Error(String(lastError));
      };

      const findPhotoBySizeGroup = (images: GfaPhoto[], sizeGroupNo: number) =>
        images.find((image) => Number(image.sizeGroupNo) === sizeGroupNo);

      const adImageSlotFromPhoto = (image: GfaPhoto): DisplayNativeAdImageSlot | undefined => {
        if (Number(image.sizeGroupNo) === 8 || (image.width === 342 && image.height === 228)) {
          return 'banner';
        }
        if (Number(image.sizeGroupNo) === 2 || (image.width === 1200 && image.height === 628)) {
          return 'wide';
        }
        if (Number(image.sizeGroupNo) === 15 || (image.width === 1200 && image.height === 1200)) {
          return 'square';
        }
        if (Number(image.sizeGroupNo) === 20 || (image.width === 1200 && image.height === 1800)) {
          return 'tall';
        }
        return undefined;
      };

      const resolveProfileImage = async (referrer?: string) => {
        const searched = (await requestJson(
          'GET',
          `/apis/gfa/v1.1/adAccounts/${adAccountNo}/photos/search?sizeGroupNos=1&page=0&size=40&sort=no%2Cdesc`,
          referrer
        )) as { content?: GfaPhoto[] };
        const images = Array.isArray(searched.content) ? searched.content : [];
        return images.find((photo) => Number(photo.fileSize) === Number(browserPayload.images.profile.size));
      };

      const getProfileName = async (referrer?: string) => {
        const bundle = (await requestJson(
          'GET',
          `/apis/gfa/v1/adAccounts/${adAccountNo}/bundle?bundleTypes=bandProfile`,
          referrer
        )) as { bandProfile?: { name?: string } };
        return compact(bundle?.bandProfile?.name) || '샘플스토어';
      };

      const hydrateCreativeRoute = async (adSetNo: string, referrer: string) => {
        await Promise.allSettled([
          requestJson('GET', '/apis/gfa/anonymous/v1/regulations/downtime.notice/entire', referrer),
          requestJson(
            'GET',
            `/apis/ad-account/v1.1/adAccounts/${adAccountNo}/agreeTerms?agreementTypeCodes=COMPOSITION_CREATIVE&agreementTypeCodes=MOTION_COMPOSITION_CREATIVE`,
            referrer
          ),
          requestJson('GET', `/apis/gfa/v1.1/adAccounts/${adAccountNo}/campaigns/${displayNative.campaignId}`, referrer),
          requestJson('GET', `/apis/gfa/v1.5/adAccounts/${adAccountNo}/adSets/${adSetNo}`, referrer),
          requestJson('GET', `/apis/gfa/v1/adAccounts/${adAccountNo}/creatives/shopping/availableDomains`, referrer),
          requestJson(
            'GET',
            `/apis/gfa/v1.1/adAccounts/${adAccountNo}/adSets/${adSetNo}/creativeTemplates?isCreate=true`,
            referrer
          )
        ]);

        await requestJson('POST', `/apis/ad-account/v1/adAccounts/${adAccountNo}/approach`, referrer).catch(() => undefined);
      };

      const searchAdPhotos = async (referrer: string) => {
        const searched = (await requestJson(
          'GET',
          `/apis/gfa/v1.1/adAccounts/${adAccountNo}/photos/search?sizeGroupNos=2&sizeGroupNos=15&sizeGroupNos=20&sizeGroupNos=8&sizeGroupNos=8&page=0&size=40&sort=no%2Cdesc`,
          referrer
        )) as { content?: GfaPhoto[] };
        return Array.isArray(searched.content) ? searched.content : [];
      };

      const findUploadedPhotoFallback = (
        photos: GfaPhoto[],
        slot: DisplayNativeAdImageSlot,
        imageAsset: BrowserImageAsset
      ) => {
        const sizeGroupNo = adImageSizeGroupNos[slot];
        const exactSizeMatch = photos.find(
          (photo) => Number(photo.sizeGroupNo) === sizeGroupNo && Number(photo.fileSize) === Number(imageAsset.size)
        );
        if (exactSizeMatch) {
          return exactSizeMatch;
        }

        return undefined;
      };

      const buildAdSetParams = () => {
        const params = new URLSearchParams();
        append(params, 'adSet.name', displayNative.adGroup.name);
        append(params, 'adSet.bidGoal', 'MAX_CONV');
        append(params, 'adSet.bidType', 'CPC');
        append(params, 'adSet.bidStrategy', 'BID_CAP');
        append(params, 'adSet.bidStrategyValue', displayNative.adGroup.bidStrategyValue);
        append(params, 'adSet.budgetType', 'DAILY');
        append(params, 'adSet.budgetAmount', displayNative.adGroup.dailyBudget);
        append(params, 'adSet.targetingType', 'AUDIENCE');
        append(params, 'adSet.allDevice', true);
        append(params, 'adSet.allPlacementGroup', false);
        ['M_SMARTCHANNEL', 'M_FEED', 'M_MAIN', 'M_BANNER'].forEach((code, index) => {
          append(params, `adSet.placementGroupCodes[${index}]`, code);
        });
        append(params, 'adSet.adultOnly', false);
        append(params, 'adSet.includeUnknownLocation', false);
        append(params, 'adSet.locationExpandNearby', false);
        append(params, 'adSet.includeInterestLocation', false);
        append(params, 'adSet.interestIntersection', true);
        append(params, 'adSet.includeUnknownInterest', false);
        append(params, 'adSet.includeBroadTargeting', false);
        append(params, 'adSet.includeFeedAutoTargeting', false);
        append(params, 'adSet.startTime', effectiveStartTime());
        append(params, 'adSet.ongoing', true);
        append(params, 'adSet.accelerated', false);
        append(params, 'adSet.creativeChooserType', 'CTR_WEIGHTED_RANDOM');
        append(params, 'adSet.useAutoFrequency', false);
        append(params, 'adSet.quota', 2);
        append(params, 'adSet.frequencyAdUnit', 'AD_SET');
        append(params, 'adSet.campaignNo', displayNative.campaignId);
        ['DESKTOP', 'MOBILE'].forEach((deviceType, index) => {
          append(params, `device.deviceTypes[${index}]`, deviceType);
        });
        ['ANDROID', 'IOS'].forEach((platform, index) => {
          append(params, `device.platforms[${index}]`, platform);
        });

        const genderCodes = [
          ...displayNative.demographics.genders.map((gender) => (gender === 'female' ? 'F' : 'M')),
          ...(displayNative.demographics.includeUnknownGender ? ['U'] : [])
        ];
        genderCodes.forEach((gender, index) => {
          append(params, `demographic.genders[${index}]`, gender);
        });

        const selectedAgeKeys =
          displayNative.demographics.ageMode === 'all' ? Object.keys(ageRanges) : displayNative.demographics.ages;
        const selectedAgeRanges = selectedAgeKeys
          .map((age) => ageRanges[age])
          .filter((ageRange): ageRange is { from: number; to: number } => Boolean(ageRange));
        if (displayNative.demographics.includeUnknownAge) {
          selectedAgeRanges.push({ from: -1, to: -1 });
        }
        selectedAgeRanges.forEach((ageRange, index) => {
          append(params, `demographic.ageRanges[${index}].from`, ageRange.from);
          append(params, `demographic.ageRanges[${index}].to`, ageRange.to);
        });

        [
          { code: 9095, recommended: false },
          { code: 20084, recommended: false }
        ].forEach((keyword, index) => {
          append(params, `thirdInterestKeywords[${index}].code`, keyword.code);
          append(params, `thirdInterestKeywords[${index}].recommended`, keyword.recommended);
        });
        append(params, 'purchaseIntents[0].code', 60);
        append(params, 'purchaseIntents[0].recommended', false);
        append(params, 'interestKeywordsCount', 2);

        return params;
      };

      const appendProfileImage = (params: URLSearchParams, image: GfaPhoto) => {
        append(params, 'profile.image.no', image.no);
        append(params, 'profile.image.adAccountNo', image.adAccountNo ?? adAccountNo);
        append(params, 'profile.image.sizeGroupNo', image.sizeGroupNo ?? 1);
        append(params, 'profile.image.imageUrl', image.imageUrl);
        append(params, 'profile.image.width', image.width ?? 300);
        append(params, 'profile.image.height', image.height ?? 300);
        append(params, 'profile.image.fileSize', image.fileSize ?? 0);
        append(params, 'profile.image.filename', image.filename);
        append(params, 'profile.image.createdAt', image.createdAt);
      };

      const profileImageObject = (image: GfaPhoto) => ({
        no: image.no,
        adAccountNo: image.adAccountNo ?? adAccountNo,
        sizeGroupNo: image.sizeGroupNo ?? 1,
        imageUrl: image.imageUrl,
        width: image.width ?? 300,
        height: image.height ?? 300,
        fileSize: image.fileSize ?? 0,
        filename: image.filename,
        createdAt: image.createdAt
      });

      const buildCreativeParams = ({
        adSetNo,
        profileName,
        profileImage,
        adImages
      }: {
        adSetNo: string;
        profileName: string;
        profileImage: GfaPhoto;
        adImages: Record<DisplayNativeAdImageSlot, GfaPhoto>;
      }) => {
        const descriptions = displayNative.material.descriptions;
        const params = new URLSearchParams();
        append(params, 'adSetNo', adSetNo);
        append(params, 'creativeName', displayNative.adGroup.name);
        append(params, 'name', displayNative.adGroup.name);
        append(params, 'creativeType', 'SINGLE_IMAGE');
        append(params, 'profile.name', profileName);
        append(params, 'profile.imageNo', profileImage.no);
        appendProfileImage(params, profileImage);
        append(params, 'creativeMessage', displayNative.material.adText);

        adImageSlots.forEach((slot, index) => {
          const image = adImages[slot];
          append(params, `singleImageMedias[${index}].title`, descriptions.short1);
          append(params, `singleImageMedias[${index}].content`, descriptions.short2);
          append(params, `singleImageMedias[${index}].text3rd`, descriptions.short3);
          append(params, `singleImageMedias[${index}].text4th`, descriptions.long1);
          append(params, `singleImageMedias[${index}].text5th`, descriptions.long2);
          append(params, `singleImageMedias[${index}].callToAction`, '더 알아보기');
          append(params, `singleImageMedias[${index}].link`, displayNative.material.landingUrl);
          append(params, `singleImageMedias[${index}].imageNo`, image.no);
          append(params, `singleImageMedias[${index}].imageUrl`, image.imageUrl);
          adImageTemplateCodes[slot].forEach((code, codeIndex) => {
            append(params, `singleImageMedias[${index}].creativeTemplateCodes[${codeIndex}]`, code);
          });
        });

        return params;
      };

      const buildCreativeBody = ({
        adSetNo,
        profileName,
        profileImage,
        adImages
      }: {
        adSetNo: string;
        profileName: string;
        profileImage: GfaPhoto;
        adImages: Record<DisplayNativeAdImageSlot, GfaPhoto>;
      }) => {
        const descriptions = displayNative.material.descriptions;

        return {
          adSetNo,
          creativeName: displayNative.adGroup.name,
          name: displayNative.adGroup.name,
          creativeType: 'SINGLE_IMAGE',
          profile: {
            name: profileName,
            imageNo: profileImage.no,
            image: profileImageObject(profileImage)
          },
          creativeMessage: displayNative.material.adText,
          singleImageMedias: adImageSlots.map((slot) => {
            const image = adImages[slot];
            return {
              title: descriptions.short1,
              content: descriptions.short2,
              text3rd: descriptions.short3,
              text4th: descriptions.long1,
              text5th: descriptions.long2,
              callToAction: '더 알아보기',
              link: displayNative.material.landingUrl,
              imageNo: image.no,
              imageUrl: image.imageUrl,
              creativeTemplateCodes: adImageTemplateCodes[slot]
            };
          })
        };
      };

      const createDraftCreative = async ({
        adSetNo,
        profileName,
        profileImage,
        adImages,
        referrer
      }: {
        adSetNo: string;
        profileName: string;
        profileImage: GfaPhoto;
        adImages: Record<DisplayNativeAdImageSlot, GfaPhoto>;
        referrer: string;
      }) => {
        applyReferrerRoute(referrer);

        try {
          const api = loadNaverGfaApi();
          if (typeof api.RMw === 'function') {
            const response = await api.RMw(
              adAccountNo,
              'SINGLE_IMAGE',
              {},
              {
                body: buildCreativeBody({ adSetNo, profileName, profileImage, adImages }),
                showErrorPopup: false
              },
              '1.3'
            );
            if (response?.data) {
              return response.data;
            }
          }
        } catch {
          // 내부 API 래퍼 호출이 불가능한 경우에만 원래 HTTP 요청으로 재시도합니다.
        }

        return (await requestForm(
          `/apis/gfa/v1.3/adAccounts/${adAccountNo}/creatives/draft/creativeType/SINGLE_IMAGE`,
          buildCreativeParams({
            adSetNo,
            profileName,
            profileImage,
            adImages
          }),
          referrer
        )) as { no?: number | string; realCreativeNo?: number | string };
      };

      return (async () => {
        if (!location.hostname.endsWith('ads.naver.com')) {
          throw new Error('네이버 광고 도메인에서만 HTTP 등록을 실행할 수 있습니다. 로그인 열기로 열린 Chrome 창에서 다시 실행하세요.');
        }

        if (!adAccountNo) {
          throw new Error('디스플레이 광고 계정 번호를 찾지 못했습니다.');
        }

        if (!/^https?:\/\//i.test(compact(displayNative.material.landingUrl))) {
          throw new Error('디스플레이 랜딩 URL이 올바른 URL이 아닙니다.');
        }

        if (!compact(displayNative.adGroup.name)) {
          throw new Error('디스플레이 광고그룹명이 비어 있습니다.');
        }

        let adSetNo = browserPayload.adSetNo ?? '';
        if (!adSetNo) {
          await requestJson(
            'GET',
            `/apis/gfa/v1.1/adAccounts/${adAccountNo}/campaigns/${displayNative.campaignId}`,
            adSetCreateUrl()
          );
          const adSetResponse = (await requestForm(
            `/apis/gfa/v2.0/adAccounts/${adAccountNo}/adSets`,
            buildAdSetParams(),
            adSetCreateUrl()
          )) as { adSet?: { no?: number | string } };
          adSetNo = adSetResponse?.adSet?.no ? String(adSetResponse.adSet.no) : '';
          if (!adSetNo) {
            throw new Error('광고그룹 생성 응답에서 adSet no를 찾지 못했습니다.');
          }

          return {
            adSetNo,
            needsCreativeRoute: true,
            uploadedImageNos: {
              banner: '',
              wide: '',
              square: '',
              tall: ''
            }
          };
        }

        const creativeReferrer = creativeCreateUrl(adSetNo);
        await hydrateCreativeRoute(adSetNo, creativeReferrer);

        const [profileName, profileImage] = await Promise.all([getProfileName(creativeReferrer), resolveProfileImage(creativeReferrer)]);
        const uploadedPhotos = await searchAdPhotos(creativeReferrer);

        const adImages: Partial<Record<DisplayNativeAdImageSlot, GfaPhoto>> = {};
        for (const slot of adImageSlots) {
          const fallback = findUploadedPhotoFallback(uploadedPhotos, slot, browserPayload.images[slot]);
          if (fallback) {
            adImages[slot] = fallback;
          }
        }

        return {
          adSetNo,
          profileImageNo: profileImage?.no ? String(profileImage.no) : undefined,
          profileImageUrl: profileImage?.imageUrl,
          adImageUrls: {
            banner: String(adImages.banner?.imageUrl ?? ''),
            wide: String(adImages.wide?.imageUrl ?? ''),
            square: String(adImages.square?.imageUrl ?? ''),
            tall: String(adImages.tall?.imageUrl ?? '')
          },
          uploadedImageNos: {
            banner: String(adImages.banner?.no ?? ''),
            wide: String(adImages.wide?.no ?? ''),
            square: String(adImages.square?.no ?? ''),
            tall: String(adImages.tall?.no ?? '')
          },
          needsCreativeRoute: false,
          needsUiCreative: true
        };
      })();

      function displayNativeImageLabel(slot: DisplayNativeImageSlot | DisplayNativeAdImageSlot) {
        return (
          {
            profile: '프로필 이미지',
            square: '광고 이미지 1200x1200',
            wide: '광고 이미지 1200x628',
            tall: '광고 이미지 1200x1800',
            banner: '광고 이미지 342x228'
          }[slot] ?? '이미지'
        );
      }
    }, payload) as Promise<{
      adSetNo: string;
      creativeNo?: string;
      realCreativeNo?: string;
      profileImageNo?: string;
      uploadedImageNos: Record<DisplayNativeAdImageSlot, string>;
      needsCreativeRoute?: boolean;
      needsUiCreative?: boolean;
      profileImageUrl?: string;
      adImageUrls?: Record<DisplayNativeAdImageSlot, string>;
    }>;
  }

  private async submitCreativeViaUi(page: Page, selection: DisplayNativeResolvedAssetSelection, logger?: RunLogger) {
    const displayNative = this.config.displayNative;

    logger?.info('display native UI: ensure native image type');
    await this.ensureNativeImageTypeSelected(page);

    logger?.info('display native UI: fill creative fields');
    await page.locator('input[name="creativeName"]').fill(displayNative.adGroup.name);
    await page.locator('input[name="name"]').fill('샘플스토어');
    await page.locator('textarea[name="creativeMessage"]').fill(displayNative.material.adText);
    await page.locator('input[name="link"]').fill(displayNative.material.landingUrl);
    await page.locator('input[name="title"]').fill(displayNative.material.descriptions.short1);
    await page.locator('input[name="content"]').fill(displayNative.material.descriptions.short2);
    await page.locator('input[name="text3rd"]').fill(displayNative.material.descriptions.short3);
    await page.locator('input[name="text4th"]').fill(displayNative.material.descriptions.long1);
    await page.locator('input[name="text5th"]').fill(displayNative.material.descriptions.long2);

    if (selection.adImageUrls) {
      const imageUrls = [
        selection.adImageUrls.tall,
        selection.adImageUrls.square,
        selection.adImageUrls.wide,
        selection.adImageUrls.banner
      ].filter(Boolean);

      if (imageUrls.length === 4) {
        logger?.info('display native UI: select existing ad images from modal');
        await this.selectImagesFromCurrentModal(
          page,
          {
            openButtonIndex: 1,
            imageUrls
          },
          logger
        );
      } else {
        logger?.info(`display native UI: upload ad images from local files, existing matches=${imageUrls.length}`);
        await this.uploadImagesFromCurrentModal(
          page,
          {
            openButtonIndex: 1,
            filePaths: ['tall', 'square', 'wide', 'banner'].map((slot) =>
              this.localDisplayNativeImagePath(slot as DisplayNativeImageSlot)
            ),
            expectedCount: 4
          },
          logger
        );
      }
    }

    if (selection.profileImageUrl) {
      logger?.info('display native UI: select existing profile image from modal');
      await this.selectImagesFromCurrentModal(
        page,
        {
          openButtonIndex: 0,
          imageUrls: [selection.profileImageUrl]
        },
        logger
      );
    } else {
      logger?.info('display native UI: upload profile image from local file');
      await this.uploadImagesFromCurrentModal(
        page,
        {
          openButtonIndex: 0,
          filePaths: [this.localDisplayNativeImagePath('profile')],
          expectedCount: 1
        },
        logger
      );
    }

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/apis/gfa/v1.3/adAccounts/') &&
        response.url().includes('/creatives/draft/creativeType/SINGLE_IMAGE'),
      { timeout: 45000 }
    );

    logger?.info('display native UI: click creative save');
    await page.getByRole('button', { name: '저장' }).click();
    const response = await responsePromise;
    const responseText = await response.text();
    if (!response.ok()) {
      throw new Error(`UI 소재 저장 실패: ${response.status()} ${responseText}`);
    }

    const creative = responseText ? (JSON.parse(responseText) as { no?: number | string; realCreativeNo?: number | string }) : {};
    await waitForDomSettled(page).catch(() => undefined);

    return {
      creativeNo: creative?.no ? String(creative.no) : undefined,
      realCreativeNo: creative?.realCreativeNo ? String(creative.realCreativeNo) : undefined
    };
  }

  private async ensureNativeImageTypeSelected(page: Page) {
    const nativeInput = page.locator('label').filter({ hasText: '네이티브 이미지' }).locator('input');
    if (!(await nativeInput.isChecked().catch(() => false))) {
      await nativeInput.click({ force: true });
      const confirmButton = page.locator('.ad-cms-modal').filter({ hasText: '소재 타입을 변경' }).getByRole('button', {
        name: '확인'
      });
      if ((await confirmButton.count()) > 0) {
        await confirmButton.click();
      }
      await waitForDomSettled(page).catch(() => undefined);
    }
  }

  private async selectImagesFromCurrentModal(
    page: Page,
    { openButtonIndex, imageUrls }: { openButtonIndex: number; imageUrls: string[] },
    logger?: RunLogger
  ) {
    if (imageUrls.length === 0) {
      return;
    }

    const addButtons = page.getByRole('button', { name: '이미지 추가' });
    const buttonCount = await addButtons.count();
    if (buttonCount <= openButtonIndex) {
      throw new Error('네이버 소재 화면에서 이미지 추가 버튼을 찾지 못했습니다.');
    }

    logger?.info(`display native modal: open image picker index=${openButtonIndex}`);
    await addButtons.nth(openButtonIndex).click();
    const modal = page.locator('.ad-cms-modal').last();
    await modal.waitFor({ state: 'visible', timeout: 10000 });
    logger?.info(`display native modal: visible, selecting ${imageUrls.length} image(s)`);

    for (const [index, imageUrl] of imageUrls.entries()) {
      await this.clickImageInModal(page, imageUrl, index + 1);
    }

    if (!(await this.waitForModalSelectedCount(page, imageUrls.length, 5000))) {
      throw new Error('디스플레이 저장 이미지가 선택 상태로 바뀌지 않았습니다.');
    }

    logger?.info('display native modal: click confirm');
    await modal.getByRole('button', { name: '확인' }).click();
    await modal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    await waitForDomSettled(page).catch(() => undefined);
  }

  private async uploadImagesFromCurrentModal(
    page: Page,
    { openButtonIndex, filePaths, expectedCount }: { openButtonIndex: number; filePaths: string[]; expectedCount: number },
    logger?: RunLogger
  ) {
    const addButtons = page.getByRole('button', { name: '이미지 추가' });
    const buttonCount = await addButtons.count();
    if (buttonCount <= openButtonIndex) {
      throw new Error('네이버 소재 화면에서 이미지 추가 버튼을 찾지 못했습니다.');
    }

    logger?.info(`display native modal: open image picker index=${openButtonIndex}`);
    await addButtons.nth(openButtonIndex).click();
    const modal = page.locator('.ad-cms-modal').last();
    await modal.waitFor({ state: 'visible', timeout: 10000 });
    const beforeImageSrcs = await this.modalImageSrcs(page);

    logger?.info(`display native modal: start upload ${expectedCount} image(s)`);
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 10000 });
    await modal.getByRole('button', { name: '이미지 업로드' }).click();
    const fileChooser = await fileChooserPromise;
    const uploadResponsePromise = page
      .waitForResponse(
        (response) => response.request().method() === 'POST' && response.url().includes('/photos/upload'),
        { timeout: 45000 }
      )
      .catch(() => undefined);
    await fileChooser.setFiles(filePaths);
    const uploadResponse = await uploadResponsePromise;
    const uploadedImageUrls = await this.uploadedImageUrlsFromResponse(uploadResponse);
    const newModalImageSrcs = await this.waitForNewModalImageSrcs(page, beforeImageSrcs, expectedCount).catch(() => []);
    const recentLibraryImageUrls =
      uploadedImageUrls.length >= expectedCount || newModalImageSrcs.length >= expectedCount
        ? []
        : await this.searchRecentDisplayNativeImageUrls(page, expectedCount, openButtonIndex).catch(() => []);

    logger?.info(
      `display native modal: upload response received, response urls=${uploadedImageUrls.length}, new modal urls=${newModalImageSrcs.length}, library urls=${recentLibraryImageUrls.length}`
    );

    logger?.info('display native modal: selecting uploaded images');
    if (
      !(await this.selectUploadedImagesInModal(page, uploadedImageUrls, expectedCount)) &&
      !(await this.selectUploadedImagesInModal(page, newModalImageSrcs, expectedCount)) &&
      !(await this.selectUploadedImagesInModal(page, recentLibraryImageUrls, expectedCount))
    ) {
      logger?.info('display native modal: response urls unavailable, selecting newest images');
      await this.selectNewestImagesInModal(page, expectedCount, beforeImageSrcs);
    }

    if (!(await this.waitForModalSelectedCount(page, expectedCount, 5000))) {
      throw new Error('디스플레이 업로드 이미지가 선택 상태로 바뀌지 않았습니다.');
    }

    if (!(await this.confirmImageModal(page, modal, 10000))) {
      throw new Error('이미지 업로드 후 네이버 이미지 선택 모달을 닫지 못했습니다.');
    }

    await waitForDomSettled(page).catch(() => undefined);
  }

  private async uploadedImageUrlsFromResponse(response: Response | undefined) {
    if (!response) {
      return [];
    }

    const responseText = await response.text();
    if (!response.ok()) {
      throw new Error(`이미지 업로드 실패: ${response.status()} ${responseText}`);
    }

    try {
      const data = JSON.parse(responseText) as { images?: Array<{ imageUrl?: string }> };
      return Array.isArray(data.images)
        ? data.images.map((image) => image.imageUrl).filter((imageUrl): imageUrl is string => Boolean(imageUrl))
        : [];
    } catch {
      return [];
    }
  }

  private async modalImageSrcs(page: Page) {
    const modal = page.locator('.ad-cms-modal').last();
    return modal.locator('img').evaluateAll((images) =>
      images.map((image) => image.getAttribute('src') ?? '').filter((src): src is string => Boolean(src))
    );
  }

  private async waitForNewModalImageSrcs(page: Page, beforeImageSrcs: string[], expectedCount: number) {
    const handle = await page.waitForFunction(
      ({ before, count }) => {
        const modals = Array.from(document.querySelectorAll('.ad-cms-modal'));
        const modal = modals.at(-1);
        const beforeSet = new Set(before);
        const imageSrcs = Array.from(modal?.querySelectorAll('img') ?? [])
          .map((image) => image.getAttribute('src') ?? '')
          .filter(Boolean);
        const newImageSrcs = imageSrcs.filter((src) => !beforeSet.has(src));
        return newImageSrcs.length >= count ? newImageSrcs.slice(0, count) : false;
      },
      { before: beforeImageSrcs, count: expectedCount },
      { timeout: 45000 }
    );

    return (await handle.jsonValue()) as string[];
  }

  private async searchRecentDisplayNativeImageUrls(page: Page, expectedCount: number, openButtonIndex: number) {
    const adAccountNo = this.adAccountId();
    if (!adAccountNo) {
      return [];
    }

    const isProfileImage = openButtonIndex === 0;
    const sizeGroupNos = isProfileImage ? [1] : [2, 15, 20, 8, 8];
    const imageSizes = isProfileImage
      ? [Number((this.config.displayNative.imageAssets?.profile as PowerlinkImageAsset | undefined)?.size ?? 0)]
      : (['tall', 'square', 'wide', 'banner'] as const).map((slot) =>
          Number((this.config.displayNative.imageAssets?.[slot] as PowerlinkImageAsset | undefined)?.size ?? 0)
        );

    return page.evaluate(
      async ({ adAccountNo: browserAdAccountNo, count, sizeGroupNos: browserSizeGroupNos, imageSizes: browserImageSizes }) => {
        const getCookie = (name: string) => {
          const prefix = name + '=';
          const found = document.cookie
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith(prefix));
          return found ? decodeURIComponent(found.slice(prefix.length)) : '';
        };
        const xsrfToken = getCookie('XSRF-TOKEN') || getCookie('XSRF_TOKEN') || getCookie('csrfToken');
        const headers: Record<string, string> = {
          accept: 'application/json, text/plain, */*'
        };
        if (xsrfToken) {
          headers['x-xsrf-token'] = xsrfToken;
        }

        const query = browserSizeGroupNos.map((sizeGroupNo) => `sizeGroupNos=${encodeURIComponent(String(sizeGroupNo))}`).join('&');
        const response = await fetch(
          `/apis/gfa/v1.1/adAccounts/${browserAdAccountNo}/photos/search?${query}&page=0&size=40&sort=no%2Cdesc`,
          {
            credentials: 'include',
            headers
          }
        );
        if (!response.ok) {
          return [];
        }

        const data = (await response.json()) as { content?: Array<{ imageUrl?: string; fileSize?: number | string }> };
        const photos = Array.isArray(data.content) ? data.content : [];
        const targetSizes = browserImageSizes.map(Number).filter(Boolean);
        const exactSizePhotos = targetSizes.length
          ? photos.filter((photo) => targetSizes.includes(Number(photo.fileSize)))
          : photos;
        return exactSizePhotos
          .map((photo) => photo.imageUrl)
          .filter((imageUrl): imageUrl is string => Boolean(imageUrl))
          .slice(0, count);
      },
      { adAccountNo, count: expectedCount, sizeGroupNos, imageSizes }
    );
  }

  private async confirmImageModal(page: Page, modal: ReturnType<Page['locator']>, timeout: number) {
    const confirmButton = modal.getByRole('button', { name: '확인' });
    await page.waitForFunction(
      () => {
        const modals = Array.from(document.querySelectorAll('.ad-cms-modal'));
        const modalElement = modals.at(-1);
        const buttons = Array.from(modalElement?.querySelectorAll('button') ?? []);
        const confirmButtonElement = buttons.find((button) => button.textContent?.replace(/\s+/g, '').includes('확인'));
        return Boolean(confirmButtonElement && !confirmButtonElement.disabled && confirmButtonElement.getAttribute('aria-disabled') !== 'true');
      },
      undefined,
      { timeout }
    ).catch(() => undefined);

    if (!(await confirmButton.isEnabled().catch(() => false))) {
      return false;
    }

    await confirmButton.click();
    await modal.waitFor({ state: 'hidden', timeout }).catch(() => undefined);
    return !(await modal.isVisible().catch(() => false));
  }

  private async selectNewestImagesInModal(page: Page, expectedCount: number, beforeImageSrcs: string[] = []) {
    const modal = page.locator('.ad-cms-modal').last();
    const images = modal.locator('img');
    await page.waitForFunction(
      ({ before, count }) => {
        const modals = Array.from(document.querySelectorAll('.ad-cms-modal'));
        const modalElement = modals.at(-1);
        const beforeSet = new Set(before);
        const imageSrcs = Array.from(modalElement?.querySelectorAll('img') ?? [])
          .map((image) => image.getAttribute('src') ?? '')
          .filter(Boolean);
        return imageSrcs.filter((src) => !beforeSet.has(src)).length >= count || imageSrcs.length >= count;
      },
      { before: beforeImageSrcs, count: expectedCount },
      { timeout: 10000 }
    );

    const newImageSrcs = (await this.modalImageSrcs(page)).filter((src) => !beforeImageSrcs.includes(src));
    if (newImageSrcs.length >= expectedCount) {
      for (const [index, imageSrc] of newImageSrcs.slice(0, expectedCount).entries()) {
        await this.clickImageInModal(page, imageSrc, index + 1);
      }
      return;
    }

    const imageCount = await images.count();
    if (imageCount < expectedCount) {
      throw new Error(`업로드된 이미지 썸네일을 ${expectedCount}개 찾지 못했습니다. 현재 ${imageCount}개입니다.`);
    }

    for (let index = 0; index < expectedCount; index += 1) {
      await this.clickModalImageLocator(page, images.nth(index), index + 1);
    }
  }

  private async selectUploadedImagesInModal(page: Page, imageUrls: string[], expectedCount: number) {
    if (imageUrls.length < expectedCount) {
      return false;
    }

    try {
      for (const [index, imageUrl] of imageUrls.slice(0, expectedCount).entries()) {
        await this.clickImageInModal(page, imageUrl, index + 1);
      }
      return true;
    } catch {
      return false;
    }
  }

  private async clickImageInModal(page: Page, imageUrl: string, selectedCountAfterClick = 1) {
    const exactImage = page.locator(`xpath=//div[contains(@class, "ad-cms-modal")]//img[@src=${xpathLiteral(imageUrl)}]`);
    await exactImage.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
    if ((await exactImage.count()) > 0) {
      await this.clickModalImageLocator(page, exactImage.first(), selectedCountAfterClick);
      return;
    }

    const fileName = imageUrl.split('/').pop()?.split('?')[0] ?? '';
    const partialImage = page.locator(`xpath=//div[contains(@class, "ad-cms-modal")]//img[contains(@src, ${xpathLiteral(fileName)})]`);
    await partialImage.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
    if ((await partialImage.count()) > 0) {
      await this.clickModalImageLocator(page, partialImage.first(), selectedCountAfterClick);
      return;
    }

    throw new Error('네이버 이미지 선택 모달에서 저장된 이미지를 찾지 못했습니다: ' + fileName);
  }

  private async clickModalImageLocator(page: Page, image: ReturnType<Page['locator']>, selectedCountAfterClick: number) {
    await image.click({ force: true });
    if (await this.waitForModalSelectedCount(page, selectedCountAfterClick, 1000)) {
      return;
    }

    const candidates = [
      image.locator('xpath=ancestor::label[1]'),
      image.locator('xpath=ancestor::*[.//input[@type="checkbox" or @type="radio"]][1]'),
      image.locator('xpath=ancestor::*[contains(@class, "item") or contains(@class, "Item") or contains(@class, "card") or contains(@class, "Card")][1]'),
      image.locator('xpath=..')
    ];

    for (const candidate of candidates) {
      if ((await candidate.count()) === 0) {
        continue;
      }

      await candidate.first().click({ force: true }).catch(() => undefined);
      if (await this.waitForModalSelectedCount(page, selectedCountAfterClick, 1000)) {
        return;
      }
    }
  }

  private async waitForModalSelectedCount(page: Page, expectedCount: number, timeout: number) {
    return page
      .waitForFunction(
        ({ count }) => {
          const modals = Array.from(document.querySelectorAll('.ad-cms-modal'));
          const modal = modals.at(-1);
          const text = modal?.textContent?.replace(/\s+/g, '') ?? '';
          const checkedInputCount = modal?.querySelectorAll('input:checked').length ?? 0;
          const checkedRoleCount = modal?.querySelectorAll('[aria-checked="true"]').length ?? 0;
          return (
            text.includes(`선택된파일${count}/`) ||
            text.includes(`선택된이미지${count}/`) ||
            checkedInputCount >= count ||
            checkedRoleCount >= count
          );
        },
        { count: expectedCount },
        { timeout }
      )
      .then(() => true)
      .catch(() => false);
  }

  private localDisplayNativeImagePath(slot: DisplayNativeImageSlot) {
    const asset = this.config.displayNative.imageAssets?.[slot] as PowerlinkImageAsset | undefined;
    if (!asset) {
      throw new Error(displayNativeImageLabel(slot) + '가 저장되어 있지 않습니다.');
    }

    return path.isAbsolute(asset.path) ? asset.path : path.resolve(asset.path);
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

function displayNativeImageLabel(slot: DisplayNativeImageSlot) {
  return (
    {
      profile: '프로필 이미지',
      square: '광고 이미지 1200x1200',
      wide: '광고 이미지 1200x628',
      tall: '광고 이미지 1200x1800',
      banner: '광고 이미지 342x228'
    }[slot] ?? '이미지'
  );
}

function extractAdAccountId(url: string) {
  const match = url.match(/\/ad-accounts\/([0-9]+)/);
  return match?.[1] ? Number(match[1]) : undefined;
}

function slug(value: string) {
  return value.replace(/[^a-zA-Z0-9가-힣._-]+/g, '-').replace(/^-|-$/g, '');
}

function xpathLiteral(value: string) {
  if (!value.includes("'")) {
    return `'${value}'`;
  }

  if (!value.includes('"')) {
    return `"${value}"`;
  }

  return `concat(${value
    .split("'")
    .map((part) => `'${part}'`)
    .join(`, "'", `)})`;
}
