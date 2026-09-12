import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserContext, Page, Response } from 'playwright-core';
import type { PowerlinkImageAsset, ShoppingSearchConfig } from '../schema.js';
import { openChromeSession, type BrowserSession } from './browser.js';
import { waitForDomSettled } from './dom.js';
import { RunLogger } from './log.js';

export type ShoppingPromotionApiRunResult = {
  runDir: string;
  adSetNo: string;
  creativeNo?: string;
  realCreativeNo?: string;
  uploadedImageNo?: string;
  finalUrl?: string;
};

type ShoppingPromotionApiRunPayload = Pick<ShoppingSearchConfig, 'naverAdAccountId' | 'shoppingPromotion'>;

type BrowserImageAsset = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  size: number;
};

type ShoppingPromotionBrowserPayload = {
  config: ShoppingPromotionApiRunPayload;
  image: BrowserImageAsset;
  adSetNo?: string;
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

export class NaverShoppingPromotionApiAutomation {
  constructor(private readonly config: ShoppingSearchConfig) {}

  async runInContext(context: BrowserContext): Promise<ShoppingPromotionApiRunResult> {
    const runDir = path.resolve(
      this.config.runOutputDir,
      `${new Date().toISOString().replace(/[:.]/g, '-')}-${slug(this.config.shoppingPromotion.adGroup.name)}-shopping-promotion-http`
    );
    const logger = new RunLogger(runDir);
    await logger.init();

    try {
      const page = await this.openAdsPage(context);
      await logger.screenshot(page, '00-before-shopping-promotion-http-run').catch(() => undefined);

      const image = await this.readImageAsset();
      logger.info('starting HTTP shopping promotion registration');
      logger.info(`ad group name: ${this.config.shoppingPromotion.adGroup.name}`);
      logger.info(`image: ${image.fileName}, ${image.size} bytes`);

      const result = await this.executeRegistration(page, image, logger);
      logger.info(`ad set created: ${result.adSetNo}`);
      logger.info(`image uploaded: ${result.uploadedImageNo ?? '-'}`);
      logger.info(`creative draft created: ${result.realCreativeNo ?? result.creativeNo ?? '-'}`);

      const finalUrl = this.adSetUrl(result.adSetNo);
      if (finalUrl) {
        logger.info(`opening final ad set page: ${finalUrl}`);
        await page.goto(finalUrl, { waitUntil: 'domcontentloaded' });
        await waitForDomSettled(page);
        await logger.screenshot(page, '99-final-shopping-promotion-adset-page').catch(() => undefined);
      }

      const finalResult = { runDir, ...result, finalUrl };
      await writeFile(path.join(runDir, 'http-result.json'), `${JSON.stringify(finalResult, null, 2)}\n`, 'utf8');
      return finalResult;
    } finally {
      await logger.flush();
    }
  }

  async run(): Promise<ShoppingPromotionApiRunResult> {
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

    return `https://ads.naver.com/manage/ad-accounts/${adAccountId}/da/dashboard/campaign/${this.config.shoppingPromotion.campaignId}/adSet/${adSetNo}`;
  }

  private creativeCreateUrl(adSetNo: string) {
    const adAccountId = this.adAccountId();
    if (!adAccountId) {
      return undefined;
    }

    return `https://ads.naver.com/manage/ad-accounts/${adAccountId}/da/ad/create/creative?campaignNo=${this.config.shoppingPromotion.campaignId}&adSetNo=${adSetNo}`;
  }

  private adAccountId() {
    return extractAdAccountId(this.config.shoppingPromotion.campaignUrl) ?? this.config.naverAdAccountId;
  }

  private async openAdsPage(context: BrowserContext) {
    const page =
      context.pages().find((currentPage) => currentPage.url().includes('ads.naver.com')) ??
      context.pages().find((currentPage) => currentPage.url().includes('manage.searchad.naver.com')) ??
      (await context.newPage());

    const adAccountId = this.adAccountId();
    if (!adAccountId) throw new Error('쇼핑 프로모션 광고 계정 번호를 찾지 못했습니다.');
    const createUrl = `https://ads.naver.com/manage/ad-accounts/${adAccountId}/da/ad/create/adSet?campaignNo=${encodeURIComponent(this.config.shoppingPromotion.campaignId)}`;
    // Load the real route so Naver initializes the account context and request client.
    await page.goto(createUrl, { waitUntil: 'domcontentloaded' });
    await waitForDomSettled(page);
    if (new URL(page.url()).origin !== 'https://ads.naver.com' || !new URL(page.url()).pathname.endsWith('/da/ad/create/adSet')) {
      throw new Error('네이버 광고그룹 생성 화면을 열지 못했습니다. 로그인 상태와 광고 계정 접근 권한을 확인하세요.');
    }

    return page;
  }

  private async readImageAsset() {
    const asset = this.config.shoppingPromotion.imageAsset as PowerlinkImageAsset | undefined;
    if (!asset) {
      throw new Error('쇼핑 프로모션 750x500 이미지가 저장되어 있지 않습니다.');
    }

    return {
      fileName: asset.fileName,
      mimeType: asset.mimeType || guessMimeType(asset.fileName),
      dataUrl: await imageAssetToDataUrl(asset),
      size: asset.size ?? 0
    };
  }

  private async executeRegistration(page: Page, image: BrowserImageAsset, logger: RunLogger) {
    await page.evaluate('globalThis.__name = (target) => target;');

    const payloadBase: ShoppingPromotionBrowserPayload = {
      config: {
        naverAdAccountId: this.config.naverAdAccountId,
        shoppingPromotion: this.config.shoppingPromotion
      },
      image
    };

    logger.info('shopping promotion step: create ad set request start');
    const firstResult = await this.executeRegistrationStep(page, payloadBase);
    logger.info(
      `shopping promotion step: create ad set request done: ${firstResult.adSetNo}, needsCreativeRoute=${Boolean(
        firstResult.needsCreativeRoute
      )}`
    );
    if (!firstResult.needsCreativeRoute) {
      return firstResult;
    }

    const creativeUrl = this.creativeCreateUrl(firstResult.adSetNo);
    if (!creativeUrl) {
      throw new Error('쇼핑 프로모션 소재 생성 화면 URL을 만들지 못했습니다.');
    }

    logger.info(`shopping promotion step: open creative route: ${creativeUrl}`);
    await page.goto(creativeUrl, { waitUntil: 'domcontentloaded' });
    await waitForDomSettled(page);
    await page.evaluate('globalThis.__name = (target) => target;');

    logger.info('shopping promotion step: create creative request start');
    const finalResult = await this.executeRegistrationStep(page, {
      ...payloadBase,
      adSetNo: firstResult.adSetNo
    });
    logger.info(
      `shopping promotion step: create creative request done: needsUiCreative=${Boolean(finalResult.needsUiCreative)}`
    );
    if (finalResult.needsCreativeRoute) {
      throw new Error('쇼핑 프로모션 소재 생성 화면 로드 후에도 등록이 재개되지 않았습니다.');
    }

    if (finalResult.needsUiCreative) {
      if (finalResult.directError) {
        logger.info(`shopping promotion step: direct creative request failed, using UI fallback: ${finalResult.directError}`);
      }
      logger.info('shopping promotion step: UI creative submit start');
      const uiResult = await this.submitCreativeViaUi(page, logger);
      logger.info('shopping promotion step: UI creative submit done');
      return {
        ...finalResult,
        ...uiResult,
        needsUiCreative: false
      };
    }

    return finalResult;
  }

  private async executeRegistrationStep(page: Page, payload: ShoppingPromotionBrowserPayload) {
    return page.evaluate((browserPayload: ShoppingPromotionBrowserPayload) => {
      const config = browserPayload.config;
      const shoppingPromotion = config.shoppingPromotion;
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
        extractAdAccountId(location.pathname) || extractAdAccountId(shoppingPromotion.campaignUrl) || config.naverAdAccountId
      );

      const adSetCreateUrl = () =>
        `${location.origin}/manage/ad-accounts/${adAccountNo}/da/ad/create/adSet?campaignNo=${encodeURIComponent(
          shoppingPromotion.campaignId
        )}`;

      const creativeCreateUrl = (adSetNo: string) =>
        `${location.origin}/manage/ad-accounts/${adAccountNo}/da/ad/create/creative?campaignNo=${encodeURIComponent(
          shoppingPromotion.campaignId
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
        const configured = compact(shoppingPromotion.adGroup.startAt).slice(0, 16);
        const parsed = new Date(configured);
        if (configured && !Number.isNaN(parsed.getTime()) && parsed.getTime() >= Date.now() + 30 * 60 * 1000) {
          return configured;
        }

        return localDateTimeValue(new Date(Date.now() + 40 * 60 * 1000));
      };

      const dataUrlToFile = (selectedImage: BrowserImageAsset) => {
        const match = selectedImage.dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
        if (!match?.[2]) {
          throw new Error('이미지 데이터 형식이 올바르지 않습니다: ' + selectedImage.fileName);
        }

        const mimeType = match[1] || selectedImage.mimeType || 'image/png';
        const binary = atob(match[2]);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }

        return new File([bytes], selectedImage.fileName, { type: mimeType });
      };

      const uploadPhoto = async (imageToUpload: BrowserImageAsset, referrer?: string) => {
        applyReferrerRoute(referrer);
        let lastError: unknown;

        try {
          const api = loadNaverGfaApi();
          if (typeof api.Owq === 'function') {
            const response = await api.Owq(
              adAccountNo,
              {
                files: [dataUrlToFile(imageToUpload)]
              },
              {
                sizeGroupNos: [18]
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
              return images[0];
            }
            lastError = new Error('네이버 내부 이미지 업로드 응답이 비어 있습니다: ' + JSON.stringify(response?.data ?? response));
          }
        } catch (error) {
          lastError = error;
        }

        const requestPath = `/apis/gfa/v1/adAccounts/${adAccountNo}/photos/upload/multiple?sizeGroupNos=18`;
        const formData = new FormData();
        formData.append('files', dataUrlToFile(imageToUpload), imageToUpload.fileName);

        try {
          const uploaded = (await requestMultipart(requestPath, formData, referrer)) as { images?: GfaPhoto[] };
          if (Array.isArray(uploaded.images) && uploaded.images.length > 0) {
            return uploaded.images[0];
          }
          lastError = new Error('이미지 업로드 응답이 비어 있습니다: ' + JSON.stringify(uploaded));
        } catch (error) {
          lastError = error;
        }

        throw lastError instanceof Error ? lastError : new Error(String(lastError));
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
          requestJson('GET', `/apis/gfa/v1.1/adAccounts/${adAccountNo}/campaigns/${shoppingPromotion.campaignId}`, referrer),
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

      const buildAdSetParams = () => {
        const params = new URLSearchParams();
        append(params, 'adSet.name', shoppingPromotion.adGroup.name);
        append(params, 'adSet.bidGoal', 'MAX_CONV');
        append(params, 'adSet.bidType', 'CPC');
        append(params, 'adSet.bidStrategy', 'BID_CAP');
        append(params, 'adSet.bidStrategyValue', shoppingPromotion.adGroup.bidStrategyValue);
        append(params, 'adSet.budgetType', 'DAILY');
        append(params, 'adSet.budgetAmount', shoppingPromotion.adGroup.dailyBudget);
        append(params, 'adSet.targetingType', 'AUDIENCE');
        append(params, 'adSet.allDevice', true);
        append(params, 'adSet.allPlacementGroup', false);
        ['M_MAIN', 'M_BANNER', 'N_SHOPPING'].forEach((code, index) => {
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
        append(params, 'adSet.useAutoFrequency', true);
        append(params, 'adSet.campaignNo', shoppingPromotion.campaignId);
        ['DESKTOP', 'MOBILE'].forEach((deviceType, index) => {
          append(params, `device.deviceTypes[${index}]`, deviceType);
        });
        ['ANDROID', 'IOS'].forEach((platform, index) => {
          append(params, `device.platforms[${index}]`, platform);
        });

        const genderCodes = [
          ...shoppingPromotion.demographics.genders.map((gender) => (gender === 'female' ? 'F' : 'M')),
          ...(shoppingPromotion.demographics.includeUnknownGender ? ['U'] : [])
        ];
        genderCodes.forEach((gender, index) => {
          append(params, `demographic.genders[${index}]`, gender);
        });

        const selectedAgeKeys =
          shoppingPromotion.demographics.ageMode === 'all' ? Object.keys(ageRanges) : shoppingPromotion.demographics.ages;
        const selectedAgeRanges = selectedAgeKeys
          .map((age) => ageRanges[age])
          .filter((ageRange): ageRange is { from: number; to: number } => Boolean(ageRange));
        if (shoppingPromotion.demographics.includeUnknownAge) {
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

      const buildCreativeParams = ({
        adSetNo,
        profileName,
        uploadedImage
      }: {
        adSetNo: string;
        profileName: string;
        uploadedImage: GfaPhoto;
      }) => {
        const params = new URLSearchParams();
        append(params, 'adSetNo', adSetNo);
        append(params, 'creativeName', shoppingPromotion.adGroup.name);
        append(params, 'name', shoppingPromotion.adGroup.name);
        append(params, 'creativeType', 'SINGLE_IMAGE');
        append(params, 'profile.name', profileName);
        append(params, 'creativeMessage', shoppingPromotion.material.adText);
        append(params, 'singleImageMedias[0].callToAction', '더 알아보기');
        append(params, 'singleImageMedias[0].link', shoppingPromotion.material.landingUrl);
        append(params, 'singleImageMedias[0].imageNo', uploadedImage.no);
        append(params, 'singleImageMedias[0].imageUrl', uploadedImage.imageUrl);
        append(params, 'singleImageMedias[0].creativeTemplateCodes[0]', 'SHOPPING_SINGLE_IMAGE');
        append(params, 'singleImageMedias[0].creativeTemplateCodes[1]', 'SHOPPING_SINGLE_IMAGE_PC');
        return params;
      };

      const buildCreativeBody = ({
        adSetNo,
        profileName,
        uploadedImage
      }: {
        adSetNo: string;
        profileName: string;
        uploadedImage: GfaPhoto;
      }) => ({
        adSetNo,
        creativeName: shoppingPromotion.adGroup.name,
        name: shoppingPromotion.adGroup.name,
        creativeType: 'SINGLE_IMAGE',
        profile: {
          name: profileName
        },
        creativeMessage: shoppingPromotion.material.adText,
        singleImageMedias: [
          {
            callToAction: '더 알아보기',
            link: shoppingPromotion.material.landingUrl,
            imageNo: uploadedImage.no,
            imageUrl: uploadedImage.imageUrl,
            creativeTemplateCodes: ['SHOPPING_SINGLE_IMAGE', 'SHOPPING_SINGLE_IMAGE_PC']
          }
        ]
      });

      const createDraftCreative = async ({
        adSetNo,
        profileName,
        uploadedImage,
        referrer
      }: {
        adSetNo: string;
        profileName: string;
        uploadedImage: GfaPhoto;
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
                body: buildCreativeBody({ adSetNo, profileName, uploadedImage }),
                showErrorPopup: false
              },
              '1.3'
            );
            if (response?.data) {
              return response.data;
            }
          }
        } catch {
          // 내부 API 래퍼 호출이 불가능한 경우에만 캡처된 form 요청으로 재시도합니다.
        }

        return (await requestForm(
          `/apis/gfa/v1.3/adAccounts/${adAccountNo}/creatives/draft/creativeType/SINGLE_IMAGE`,
          buildCreativeParams({
            adSetNo,
            profileName,
            uploadedImage
          }),
          referrer
        )) as { no?: number | string; realCreativeNo?: number | string };
      };

      return (async () => {
        if (!location.hostname.endsWith('ads.naver.com')) {
          throw new Error('네이버 광고 도메인에서만 HTTP 등록을 실행할 수 있습니다. 로그인 열기로 열린 Chrome 창에서 다시 실행하세요.');
        }

        if (!adAccountNo) {
          throw new Error('쇼핑 프로모션 광고 계정 번호를 찾지 못했습니다.');
        }

        if (!/^https?:\/\//i.test(compact(shoppingPromotion.material.landingUrl))) {
          throw new Error('쇼핑 프로모션 랜딩 URL이 올바른 URL이 아닙니다.');
        }

        if (!compact(shoppingPromotion.adGroup.name)) {
          throw new Error('쇼핑 프로모션 광고그룹명이 비어 있습니다.');
        }

        let adSetNo = browserPayload.adSetNo ?? '';
        if (!adSetNo) {
          await requestJson(
            'GET',
            `/apis/gfa/v1.1/adAccounts/${adAccountNo}/campaigns/${shoppingPromotion.campaignId}`,
            adSetCreateUrl()
          );
          const adSetResponse = (await requestForm(
            `/apis/gfa/v2.0/adAccounts/${adAccountNo}/adSets`,
            buildAdSetParams(),
            adSetCreateUrl()
          )) as { adSet?: { no?: number | string } };
          adSetNo = adSetResponse?.adSet?.no ? String(adSetResponse.adSet.no) : '';
          if (!adSetNo) {
            throw new Error('쇼핑 프로모션 광고그룹 생성 응답에서 adSet no를 찾지 못했습니다.');
          }

          return {
            adSetNo,
            needsCreativeRoute: true,
            uploadedImageNo: ''
          };
        }

        const creativeReferrer = creativeCreateUrl(adSetNo);
        await hydrateCreativeRoute(adSetNo, creativeReferrer);
        let profileName = '샘플스토어';
        try {
          profileName = await getProfileName(creativeReferrer);
        } catch {
          // UI fallback can still use the default profile name.
        }

        try {
          const uploadedImage = await uploadPhoto(browserPayload.image, creativeReferrer);

          if (!uploadedImage?.no || !uploadedImage.imageUrl) {
            throw new Error('쇼핑 프로모션 이미지 업로드 응답에서 imageNo 또는 imageUrl을 찾지 못했습니다.');
          }

          const creative = await createDraftCreative({
            adSetNo,
            profileName,
            uploadedImage,
            referrer: creativeReferrer
          });

          return {
            adSetNo,
            creativeNo: creative?.no ? String(creative.no) : undefined,
            realCreativeNo: creative?.realCreativeNo ? String(creative.realCreativeNo) : undefined,
            uploadedImageNo: String(uploadedImage.no),
            needsCreativeRoute: false
          };
        } catch (error) {
          return {
            adSetNo,
            uploadedImageNo: '',
            needsCreativeRoute: false,
            needsUiCreative: true,
            directError: error instanceof Error ? error.message : String(error)
          };
        }
      })();
    }, payload) as Promise<{
      adSetNo: string;
      creativeNo?: string;
      realCreativeNo?: string;
      uploadedImageNo?: string;
      needsCreativeRoute?: boolean;
      needsUiCreative?: boolean;
      directError?: string;
    }>;
  }

  private async submitCreativeViaUi(page: Page, logger?: RunLogger) {
    const shoppingPromotion = this.config.shoppingPromotion;

    logger?.info('shopping promotion UI: fill creative fields');
    await this.fillIfPresent(page, 'input[name="creativeName"]', shoppingPromotion.adGroup.name);
    await this.fillIfPresent(page, 'input[name="name"]', '샘플스토어');
    await this.fillIfPresent(page, 'textarea[name="creativeMessage"]', shoppingPromotion.material.adText);
    await this.fillIfPresent(page, 'input[name="link"]', shoppingPromotion.material.landingUrl);

    logger?.info('shopping promotion UI: upload image from local file');
    const [selectedImage] = await this.uploadImagesFromCurrentModal(
      page,
      {
        openButtonIndex: 0,
        filePaths: [this.localShoppingPromotionImagePath()],
        expectedCount: 1
      },
      logger
    );

    if (selectedImage?.no) {
      logger?.info(`shopping promotion UI: leftmost uploaded image selected: ${selectedImage.no}`);
    }

    logger?.info('shopping promotion UI: confirm benefit notice');
    await this.confirmShoppingPromotionBenefitNotice(page);

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/apis/gfa/v1.3/adAccounts/') &&
        response.url().includes('/creatives/draft/creativeType/SINGLE_IMAGE'),
      { timeout: 45000 }
    );

    logger?.info('shopping promotion UI: click creative save');
    await page.getByRole('button', { name: '저장' }).click();
    const response = await responsePromise;
    const responseText = await response.text();
    if (!response.ok()) {
      throw new Error(`UI 쇼핑 프로모션 소재 저장 실패: ${response.status()} ${responseText}`);
    }

    const creative = responseText ? (JSON.parse(responseText) as { no?: number | string; realCreativeNo?: number | string }) : {};
    await waitForDomSettled(page).catch(() => undefined);

    return {
      creativeNo: creative?.no ? String(creative.no) : undefined,
      realCreativeNo: creative?.realCreativeNo ? String(creative.realCreativeNo) : undefined,
      uploadedImageNo: selectedImage?.no ? String(selectedImage.no) : undefined
    };
  }

  private async fillIfPresent(page: Page, selector: string, value: string) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) {
      return;
    }

    await locator.fill(value);
  }

  private async confirmShoppingPromotionBenefitNotice(page: Page) {
    const noticeText = '반드시 스토어에서 실제 진행 중인 혜택';
    const checkboxInput = page
      .locator('label')
      .filter({ hasText: noticeText })
      .locator('input[type="checkbox"]')
      .first();

    if ((await checkboxInput.count()) > 0) {
      if (!(await checkboxInput.isChecked().catch(() => false))) {
        await checkboxInput.click({ force: true });
      }
      return;
    }

    const nearbyCheckbox = page.locator(`xpath=//*[contains(normalize-space(.), ${xpathLiteral(noticeText)})]//input[@type="checkbox"]`).first();
    if ((await nearbyCheckbox.count()) > 0) {
      if (!(await nearbyCheckbox.isChecked().catch(() => false))) {
        await nearbyCheckbox.click({ force: true });
      }
      return;
    }

    const checkboxRole = page.getByRole('checkbox').filter({ hasText: noticeText }).first();
    if ((await checkboxRole.count()) > 0) {
      if (!(await checkboxRole.isChecked().catch(() => false))) {
        await checkboxRole.click({ force: true });
      }
      return;
    }

    const textNode = page.getByText(noticeText).first();
    if ((await textNode.count()) > 0) {
      await textNode.click({ force: true });
    }
  }

  private async uploadImagesFromCurrentModal(
    page: Page,
    { openButtonIndex, filePaths, expectedCount }: { openButtonIndex: number; filePaths: string[]; expectedCount: number },
    logger?: RunLogger
  ) {
    const addButtons = page.getByRole('button', { name: '이미지 추가' });
    const buttonCount = await addButtons.count();
    if (buttonCount <= openButtonIndex) {
      throw new Error('네이버 쇼핑 프로모션 소재 화면에서 이미지 추가 버튼을 찾지 못했습니다.');
    }

    logger?.info(`shopping promotion modal: open image picker index=${openButtonIndex}`);
    await addButtons.nth(openButtonIndex).click();
    const modal = page.locator('.ad-cms-modal').last();
    await modal.waitFor({ state: 'visible', timeout: 10000 });
    const beforeImageSrcs = await this.modalImageSrcs(page);
    const beforeLibraryPhotos = await this.searchRecentShoppingPromotionPhotos(page, 40).catch(() => []);

    logger?.info(`shopping promotion modal: start upload ${expectedCount} image(s)`);
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
    const responsePhotos = await this.uploadedPhotosFromResponse(uploadResponse);
    const newModalImageSrcs = await this.waitForNewModalImageSrcs(page, beforeImageSrcs, expectedCount).catch(() => []);
    const afterLibraryPhotos = await this.searchRecentShoppingPromotionPhotos(page, 60).catch(() => []);
    const newLibraryPhotos = this.newShoppingPromotionPhotos(beforeLibraryPhotos, afterLibraryPhotos, expectedCount);

    logger?.info(
      `shopping promotion modal: upload response received, response photos=${responsePhotos.length}, new modal urls=${newModalImageSrcs.length}, library photos=${newLibraryPhotos.length}`
    );

    logger?.info('shopping promotion modal: selecting leftmost new uploaded image');
    const selectedImageSrcs = await this.selectLeftmostUploadedImagesInModal(page, expectedCount, beforeImageSrcs);

    if (!(await this.waitForModalSelectedCount(page, expectedCount, 5000))) {
      throw new Error('쇼핑 프로모션 업로드 이미지가 선택 상태로 바뀌지 않았습니다.');
    }

    if (!(await this.confirmImageModal(page, modal, 10000))) {
      throw new Error('쇼핑 프로모션 이미지 업로드 후 네이버 이미지 선택 모달을 닫지 못했습니다.');
    }

    await waitForDomSettled(page).catch(() => undefined);
    return this.photosMatchingImageSrcs(selectedImageSrcs, [...responsePhotos, ...newLibraryPhotos, ...afterLibraryPhotos]).slice(
      0,
      expectedCount
    );
  }

  private async uploadedPhotosFromResponse(response: Response | undefined) {
    if (!response) {
      return [];
    }

    const responseText = await response.text();
    if (!response.ok()) {
      throw new Error(`쇼핑 프로모션 이미지 업로드 실패: ${response.status()} ${responseText}`);
    }

    try {
      return extractGfaPhotos(JSON.parse(responseText)).slice(0, 10);
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

  private async searchRecentShoppingPromotionPhotos(page: Page, count: number) {
    const adAccountNo = this.adAccountId();
    if (!adAccountNo) {
      return [];
    }

    return page.evaluate(
      async ({ adAccountNo: browserAdAccountNo, count: browserCount }) => {
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

        const response = await fetch(
          `/apis/gfa/v1.1/adAccounts/${browserAdAccountNo}/photos/search?sizeGroupNos=18&page=0&size=${browserCount}&sort=no%2Cdesc`,
          {
            credentials: 'include',
            headers
          }
        );
        if (!response.ok) {
          return [];
        }

        const data = (await response.json()) as {
          content?: GfaPhoto[];
        };
        return Array.isArray(data.content) ? data.content : [];
      },
      { adAccountNo, count }
    );
  }

  private newShoppingPromotionPhotos(beforePhotos: GfaPhoto[], afterPhotos: GfaPhoto[], expectedCount: number) {
    const beforeNos = new Set(beforePhotos.map((photo) => String(photo.no ?? '')).filter(Boolean));
    return afterPhotos
      .filter((photo) => {
        const photoNo = String(photo.no ?? '');
        return Boolean(photoNo && photo.imageUrl && !beforeNos.has(photoNo));
      })
      .slice(0, expectedCount);
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

  private async selectLeftmostUploadedImagesInModal(page: Page, expectedCount: number, beforeImageSrcs: string[] = []) {
    const modal = page.locator('.ad-cms-modal').last();
    const images = modal.locator('img');
    await page.waitForFunction(
      ({ before, count }) => {
        const modals = Array.from(document.querySelectorAll('.ad-cms-modal'));
        const modalElement = modals.at(-1);
        const beforeSet = new Set(before);
        const newVisibleImages = Array.from(modalElement?.querySelectorAll('img') ?? []).filter((image) => {
          const src = image.getAttribute('src') ?? '';
          const rect = image.getBoundingClientRect();
          const style = window.getComputedStyle(image);
          return (
            Boolean(src) &&
            !beforeSet.has(src) &&
            rect.width > 20 &&
            rect.height > 20 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden'
          );
        });
        return newVisibleImages.length >= count;
      },
      { before: beforeImageSrcs, count: expectedCount },
      { timeout: 45000 }
    );
    await page.waitForTimeout(700);

    const selectedImages = await images.evaluateAll(
      (imageElements, { before, count }) => {
        const beforeSet = new Set(before);
        return imageElements
          .map((image, index) => {
            const rect = image.getBoundingClientRect();
            const style = window.getComputedStyle(image);
            return {
              index,
              src: image.getAttribute('src') ?? '',
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              visible: style.display !== 'none' && style.visibility !== 'hidden'
            };
          })
          .filter((image) => Boolean(image.src) && !beforeSet.has(image.src) && image.width > 20 && image.height > 20 && image.visible)
          .sort((left, right) => (Math.abs(left.top - right.top) > 8 ? left.top - right.top : left.left - right.left))
          .slice(0, count)
          .map((image) => ({ index: image.index, src: image.src }));
      },
      { before: beforeImageSrcs, count: expectedCount }
    );
    if (selectedImages.length < expectedCount) {
      throw new Error(`업로드된 쇼핑 프로모션 새 이미지 썸네일을 ${expectedCount}개 찾지 못했습니다. 현재 ${selectedImages.length}개입니다.`);
    }

    for (const [selectionIndex, image] of selectedImages.entries()) {
      await this.clickModalImageLocator(page, images.nth(image.index), selectionIndex + 1);
    }

    return selectedImages.map((image) => image.src);
  }

  private photosMatchingImageSrcs(imageSrcs: string[], photos: GfaPhoto[]) {
    return imageSrcs
      .map((imageSrc) => photos.find((photo) => imageUrlsMatch(imageSrc, photo.imageUrl ?? '')))
      .filter((photo): photo is GfaPhoto => Boolean(photo?.no && photo.imageUrl));
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

  private localShoppingPromotionImagePath() {
    const asset = this.config.shoppingPromotion.imageAsset as PowerlinkImageAsset | undefined;
    if (!asset) {
      throw new Error('쇼핑 프로모션 750x500 이미지가 저장되어 있지 않습니다.');
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

function extractGfaPhotos(value: unknown) {
  const photos: GfaPhoto[] = [];
  const seen = new Set<string>();

  const visit = (nextValue: unknown) => {
    if (!nextValue) {
      return;
    }

    if (Array.isArray(nextValue)) {
      nextValue.forEach(visit);
      return;
    }

    if (typeof nextValue === 'object') {
      const record = nextValue as Record<string, unknown>;
      const no = record.no ?? record.imageNo ?? record.photoNo;
      const imageUrl = record.imageUrl ?? record.url ?? record.photoUrl;
      if ((no || imageUrl) && typeof imageUrl === 'string') {
        const key = String(no ?? imageUrl);
        if (!seen.has(key)) {
          seen.add(key);
          photos.push({
            no: no === undefined || no === null ? undefined : String(no),
            imageUrl,
            fileSize: Number.isFinite(Number(record.fileSize)) ? Number(record.fileSize) : undefined,
            filename: typeof record.filename === 'string' ? record.filename : undefined
          });
        }
      }
      Object.values(record).forEach(visit);
    }
  };

  visit(value);
  return photos;
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

function imageUrlsMatch(left: string, right: string) {
  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  const normalizedLeft = normalizeImageUrlForMatch(left);
  const normalizedRight = normalizeImageUrlForMatch(right);
  return Boolean(
    normalizedLeft &&
      normalizedRight &&
      (normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft))
  );
}

function normalizeImageUrlForMatch(value: string) {
  try {
    const url = new URL(value, 'https://ads.naver.com');
    return decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '').toLowerCase();
  } catch {
    return decodeURIComponent(value.split('?')[0]?.split('/').filter(Boolean).pop() ?? '').toLowerCase();
  }
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
