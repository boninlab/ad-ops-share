import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadShoppingSearchConfig } from './config.js';
import {
  ShoppingSearchConfigSchema,
  type DisplayNativeImageAssets,
  type PowerlinkImageAsset,
  type ShoppingSearchConfig
} from './schema.js';
import { openChromeSession, type BrowserSession } from './automation/browser.js';
import { NaverDisplayNativeApiAutomation } from './automation/naverDisplayNativeApi.js';
import { NaverPowerlinkApiAutomation } from './automation/naverPowerlinkApi.js';
import { NaverShoppingPromotionApiAutomation } from './automation/naverShoppingPromotionApi.js';
import { NaverShoppingSearchApiAutomation } from './automation/naverShoppingSearchApi.js';
import { NetworkRecorder } from './automation/networkRecorder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const webDir = path.join(rootDir, 'web');
const configPath = path.join(rootDir, 'data/shopping-search-campaign.json');
const powerlinkAssetDir = path.join(rootDir, 'data/powerlink-assets');
const displayNativeAssetDir = path.join(rootDir, 'data/display-native-assets');
const shoppingPromotionAssetDir = path.join(rootDir, 'data/shopping-promotion-assets');
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 5178);

type StatusState = 'idle' | 'login-open' | 'running' | 'waiting-review' | 'done' | 'error';
type AdProduct = 'shopping' | 'powerlink' | 'displayNative' | 'shoppingPromotion';
type DisplayNativeImageSlot = keyof DisplayNativeImageAssets;

type AutomationStatus = {
  state: StatusState;
  message: string;
  updatedAt: string;
  runDir?: string;
};

let status: AutomationStatus = {
  state: 'idle',
  message: '대기 중',
  updatedAt: new Date().toISOString()
};

let activeRun: Promise<void> | undefined;
let loginSession: BrowserSession | undefined;
let reviewSession: BrowserSession | undefined;
const networkRecorder = new NetworkRecorder();
const displayNativeImageSlots = new Set<DisplayNativeImageSlot>(['profile', 'square', 'wide', 'tall', 'banner']);

const server = createServer(async (request, response) => {
  try {
    await route(request, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, host, () => {
  console.log(`Naver Ads web tool: http://${host}:${port}`);
});

async function route(request: IncomingMessage, response: ServerResponse) {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', `http://localhost:${port}`);

  if ((method === 'GET' || method === 'HEAD') && url.pathname === '/') {
    return sendFile(response, path.join(webDir, 'index.html'), 'text/html; charset=utf-8');
  }

  if ((method === 'GET' || method === 'HEAD') && url.pathname === '/styles.css') {
    return sendFile(response, path.join(webDir, 'styles.css'), 'text/css; charset=utf-8');
  }

  if ((method === 'GET' || method === 'HEAD') && url.pathname === '/app.js') {
    return sendFile(response, path.join(webDir, 'app.js'), 'application/javascript; charset=utf-8');
  }

  if ((method === 'GET' || method === 'HEAD') && url.pathname.startsWith('/data/display-native-assets/')) {
    return sendDisplayNativeAsset(response, url.pathname);
  }

  if ((method === 'GET' || method === 'HEAD') && url.pathname.startsWith('/data/shopping-promotion-assets/')) {
    return sendShoppingPromotionAsset(response, url.pathname);
  }

  if (method === 'GET' && url.pathname === '/api/config') {
    const raw = await readFile(configPath, 'utf8');
    return sendJson(response, 200, JSON.parse(raw));
  }

  if (method === 'POST' && url.pathname === '/api/config') {
    const body = await readJson(request);
    const config = ShoppingSearchConfigSchema.parse(body);
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    return sendJson(response, 200, config);
  }

  if (method === 'POST' && url.pathname === '/api/powerlink-images') {
    const body = await readJson(request);
    const assets = await savePowerlinkImages(body);
    return sendJson(response, 200, { assets });
  }

  if (method === 'POST' && url.pathname === '/api/display-native-images') {
    const body = await readJson(request);
    const assets = await saveDisplayNativeImages(body);
    return sendJson(response, 200, { assets });
  }

  if (method === 'POST' && url.pathname === '/api/shopping-promotion-images') {
    const body = await readJson(request);
    const asset = await saveShoppingPromotionImage(body);
    return sendJson(response, 200, { asset });
  }

  if (method === 'GET' && url.pathname === '/api/status') {
    return sendJson(response, 200, {
      ...status,
      networkRecording: networkRecorder.snapshot
    });
  }

  if (method === 'GET' && url.pathname === '/api/network-recording') {
    return sendJson(response, 200, networkRecorder.snapshot);
  }

  if (method === 'POST' && url.pathname === '/api/login/open') {
    const body = await readJson(request);
    const adProduct = parseAdProduct(body.adProduct);

    await closeSession(reviewSession);
    reviewSession = undefined;

    if (!loginSession) {
      const config = await loadShoppingSearchConfig(configPath);
      loginSession = await openChromeSession({
        mode: config.browserMode,
        profileDir: config.chromeProfileDir,
        cdpUrl: config.browserCdpUrl
      });
      const page =
        loginSession.context
          .pages()
          .find((currentPage) => currentPage.url().includes('manage.searchad.naver.com')) ??
        (await loginSession.context.newPage());
      await page.goto(naverTargetUrl(config, adProduct), { waitUntil: 'domcontentloaded' });
    }

    setStatus('login-open', 'Chrome 로그인 창 열림');
    return sendJson(response, 200, status);
  }

  if (method === 'POST' && url.pathname === '/api/browser/close') {
    await networkRecorder.stop();
    await closeSession(loginSession);
    await closeSession(reviewSession);
    loginSession = undefined;
    reviewSession = undefined;
    setStatus('idle', '브라우저 세션 정리됨');
    return sendJson(response, 200, status);
  }

  if (method === 'POST' && url.pathname === '/api/http-run') {
    const body = await readJson(request);
    const adProduct = parseAdProduct(body.adProduct);

    if (activeRun) {
      return sendJson(response, 409, { error: '이미 실행 중입니다.' });
    }

    setStatus('running', 'HTTP 등록 실행 중');
    activeRun = runHttpAutomation(adProduct).finally(() => {
      activeRun = undefined;
    });

    return sendJson(response, 202, status);
  }

  if (method === 'POST' && url.pathname === '/api/network-recording/start') {
    const body = await readJson(request);
    const adProduct = parseAdProduct(body.adProduct);
    const snapshot = await startNetworkRecording(adProduct);
    setStatus('waiting-review', `호출 기록 중: ${snapshot.count}건`, snapshot.runDir);
    return sendJson(response, 200, {
      ...status,
      networkRecording: snapshot
    });
  }

  if (method === 'POST' && url.pathname === '/api/network-recording/stop') {
    const snapshot = await networkRecorder.stop();
    setStatus('waiting-review', `호출 기록 종료: ${snapshot.count}건`, snapshot.lastFile);
    return sendJson(response, 200, {
      ...status,
      networkRecording: snapshot
    });
  }

  sendJson(response, 404, { error: 'Not found' });
}

async function runHttpAutomation(adProduct: AdProduct) {
  try {
    const config = await loadShoppingSearchConfig(configPath);

    if (!reviewSession) {
      if (loginSession) {
        reviewSession = loginSession;
        loginSession = undefined;
      } else {
        reviewSession = await openChromeSession({
          mode: config.browserMode,
          profileDir: config.chromeProfileDir,
          cdpUrl: config.browserCdpUrl
        });
      }
    }

    if (adProduct === 'powerlink') {
      const automation = new NaverPowerlinkApiAutomation(config);
      const result = await automation.runInContext(reviewSession.context);
      setStatus(
        'done',
        `HTTP 등록 완료: 광고그룹 ${result.adGroupId}, 키워드 ${result.keywordCount}개/${result.keywordBatchCount}묶음, 소재 ${result.adId}, 이미지 확장소재 ${result.imageExtensionIds.length}개, 추가 확장소재 ${[
          result.subLinksExtensionId,
          result.promotionExtensionId,
          result.extraDescriptionExtensionId,
          ...result.headlineExtensionIds
        ].filter(Boolean).length}개${result.finalUrl ? ` · ${result.finalUrl}` : ''}`,
        result.runDir
      );
      return;
    }

    if (adProduct === 'displayNative') {
      const automation = new NaverDisplayNativeApiAutomation(config);
      const result = await automation.runInContext(reviewSession.context);
      setStatus(
        'done',
        `HTTP 등록 완료: 디스플레이 광고그룹 ${result.adSetNo}, 소재 ${result.realCreativeNo ?? result.creativeNo ?? '-'}${result.finalUrl ? ` · ${result.finalUrl}` : ''}`,
        result.runDir
      );
      return;
    }

    if (adProduct === 'shoppingPromotion') {
      const automation = new NaverShoppingPromotionApiAutomation(config);
      const result = await automation.runInContext(reviewSession.context);
      setStatus(
        'done',
        `HTTP 등록 완료: 쇼핑 프로모션 광고그룹 ${result.adSetNo}, 소재 ${result.realCreativeNo ?? result.creativeNo ?? '-'}${result.finalUrl ? ` · ${result.finalUrl}` : ''}`,
        result.runDir
      );
      return;
    }

    const automation = new NaverShoppingSearchApiAutomation(config);
    const result = await automation.runInContext(reviewSession.context);
    setStatus(
      'done',
      `HTTP 등록 완료: 캠페인 ${result.campaignId}, 광고그룹 ${result.adGroupId}, 광고 ${result.adId}, 확장 소재 ${result.extensionIds.length}개${result.finalUrl ? ` · ${result.finalUrl}` : ''}`,
      result.runDir
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus('error', `HTTP 등록 실패: ${message}`);
  }
}

async function startNetworkRecording(adProduct: AdProduct) {
  const config = await loadShoppingSearchConfig(configPath);

  if (!reviewSession) {
    if (loginSession) {
      reviewSession = loginSession;
      loginSession = undefined;
    } else {
      reviewSession = await openChromeSession({
        mode: config.browserMode,
        profileDir: config.chromeProfileDir,
        cdpUrl: config.browserCdpUrl
      });
    }
  }

  const page =
    reviewSession.context
      .pages()
      .find((currentPage) => currentPage.url().includes('manage.searchad.naver.com') || currentPage.url().includes('ads.naver.com')) ??
    (await reviewSession.context.newPage());

  if (!page.url().includes('manage.searchad.naver.com') && !page.url().includes('ads.naver.com')) {
    await page.goto(naverTargetUrl(config, adProduct), { waitUntil: 'domcontentloaded' });
  }

  if (adProduct === 'powerlink' && !page.url().includes(config.powerlink.campaignId)) {
    await page.goto(naverTargetUrl(config, adProduct), { waitUntil: 'domcontentloaded' });
  }

  if (adProduct === 'displayNative' && !page.url().includes(config.displayNative.campaignId)) {
    await page.goto(naverTargetUrl(config, adProduct), { waitUntil: 'domcontentloaded' });
  }

  if (adProduct === 'shoppingPromotion' && !page.url().includes(config.shoppingPromotion.campaignId)) {
    await page.goto(naverTargetUrl(config, adProduct), { waitUntil: 'domcontentloaded' });
  }

  return networkRecorder.start(reviewSession.context, config.runOutputDir, recordingLabel(config, adProduct));
}

function naverTargetUrl(config: ShoppingSearchConfig, adProduct: AdProduct) {
  if (adProduct === 'powerlink') {
    return config.powerlink.campaignUrl;
  }

  if (adProduct === 'displayNative') {
    return config.displayNative.campaignUrl;
  }

  if (adProduct === 'shoppingPromotion') {
    return config.shoppingPromotion.campaignUrl;
  }

  if (!config.naverAdAccountId) {
    return config.naverAdsUrl;
  }

  return `https://ads.naver.com/manage/ad-accounts/${config.naverAdAccountId}/sa/create?advisedCampaignType=SHOPPING`;
}

function recordingLabel(config: ShoppingSearchConfig, adProduct: AdProduct) {
  if (adProduct === 'powerlink') {
    return config.powerlink.adGroup.name || config.powerlink.campaignId;
  }

  if (adProduct === 'displayNative') {
    return config.displayNative.adGroup.name || `display-native-${config.displayNative.campaignId}`;
  }

  if (adProduct === 'shoppingPromotion') {
    return config.shoppingPromotion.adGroup.name || `shopping-promotion-${config.shoppingPromotion.campaignId}`;
  }

  return config.campaign.name;
}

function parseAdProduct(value: unknown): AdProduct {
  if (value === 'powerlink' || value === 'displayNative' || value === 'shoppingPromotion') {
    return value;
  }

  return 'shopping';
}

async function savePowerlinkImages(body: unknown): Promise<PowerlinkImageAsset[]> {
  const files = readUploadFiles(body);

  if (files.length > 2) {
    throw new Error('파워링크 확장 소재 이미지는 최대 2개까지 저장할 수 있습니다.');
  }

  await mkdir(powerlinkAssetDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const assets: PowerlinkImageAsset[] = [];

  for (const [index, file] of files.entries()) {
    if (!file.mimeType.startsWith('image/')) {
      throw new Error(`이미지 파일만 업로드할 수 있습니다: ${file.fileName}`);
    }

    const buffer = Buffer.from(file.base64, 'base64');
    if (buffer.byteLength === 0) {
      throw new Error(`빈 이미지 파일입니다: ${file.fileName}`);
    }

    if (buffer.byteLength > 10 * 1024 * 1024) {
      throw new Error(`이미지 파일은 10MB 이하로 업로드하세요: ${file.fileName}`);
    }

    const safeName = safeFileName(file.fileName);
    const relativePath = path.join('data', 'powerlink-assets', `${timestamp}-${index + 1}-${safeName}`);
    await writeFile(path.join(rootDir, relativePath), buffer);
    assets.push({
      fileName: file.fileName,
      path: relativePath,
      mimeType: file.mimeType,
      size: buffer.byteLength,
      uploadedAt: new Date().toISOString()
    });
  }

  return assets;
}

async function saveDisplayNativeImages(body: unknown): Promise<Partial<Record<DisplayNativeImageSlot, PowerlinkImageAsset>>> {
  const files = readUploadFiles(body);

  if (files.length > displayNativeImageSlots.size) {
    throw new Error('디스플레이 네이티브 이미지 소재는 최대 5개까지 저장할 수 있습니다.');
  }

  await mkdir(displayNativeAssetDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const assets: Partial<Record<DisplayNativeImageSlot, PowerlinkImageAsset>> = {};

  for (const [index, file] of files.entries()) {
    const slot = file.slot as DisplayNativeImageSlot | undefined;

    if (!slot || !displayNativeImageSlots.has(slot)) {
      throw new Error(`알 수 없는 디스플레이 이미지 슬롯입니다: ${file.slot ?? ''}`);
    }

    if (!file.mimeType.startsWith('image/')) {
      throw new Error(`이미지 파일만 업로드할 수 있습니다: ${file.fileName}`);
    }

    const buffer = Buffer.from(file.base64, 'base64');
    if (buffer.byteLength === 0) {
      throw new Error(`빈 이미지 파일입니다: ${file.fileName}`);
    }

    if (buffer.byteLength > 10 * 1024 * 1024) {
      throw new Error(`이미지 파일은 10MB 이하로 업로드하세요: ${file.fileName}`);
    }

    const safeName = safeFileName(file.fileName);
    const relativePath = path.join('data', 'display-native-assets', `${timestamp}-${index + 1}-${slot}-${safeName}`);
    await writeFile(path.join(rootDir, relativePath), buffer);
    assets[slot] = {
      fileName: file.fileName,
      path: relativePath,
      mimeType: file.mimeType,
      size: buffer.byteLength,
      uploadedAt: new Date().toISOString()
    };
  }

  return assets;
}

async function saveShoppingPromotionImage(body: unknown): Promise<PowerlinkImageAsset> {
  const files = readUploadFiles(body);

  if (files.length !== 1) {
    throw new Error('쇼핑 프로모션 이미지는 1개만 저장할 수 있습니다.');
  }

  await mkdir(shoppingPromotionAssetDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const [file] = files;
  if (!file) {
    throw new Error('쇼핑 프로모션 이미지를 찾지 못했습니다.');
  }

  if (!file.mimeType.startsWith('image/')) {
    throw new Error(`이미지 파일만 업로드할 수 있습니다: ${file.fileName}`);
  }

  const buffer = Buffer.from(file.base64, 'base64');
  if (buffer.byteLength === 0) {
    throw new Error(`빈 이미지 파일입니다: ${file.fileName}`);
  }

  if (buffer.byteLength > 10 * 1024 * 1024) {
    throw new Error(`이미지 파일은 10MB 이하로 업로드하세요: ${file.fileName}`);
  }

  const safeName = safeFileName(file.fileName);
  const relativePath = path.join('data', 'shopping-promotion-assets', `${timestamp}-1-${safeName}`);
  await writeFile(path.join(rootDir, relativePath), buffer);

  return {
    fileName: file.fileName,
    path: relativePath,
    mimeType: file.mimeType,
    size: buffer.byteLength,
    uploadedAt: new Date().toISOString()
  };
}

function readUploadFiles(body: unknown) {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { files?: unknown }).files)) {
    throw new Error('업로드할 이미지 파일이 없습니다.');
  }

  return (body as { files: unknown[] }).files.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('이미지 업로드 요청 형식이 올바르지 않습니다.');
    }

    const value = item as Record<string, unknown>;
    const fileName = String(value.fileName ?? '').trim();
    const mimeType = String(value.mimeType ?? '').trim();
    const dataUrl = String(value.dataUrl ?? '').trim();
    const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);

    if (!fileName || !mimeType || !match?.[2]) {
      throw new Error('이미지 업로드 요청 형식이 올바르지 않습니다.');
    }

    return {
      fileName,
      mimeType,
      slot: typeof value.slot === 'string' ? value.slot.trim() : undefined,
      base64: match[2]
    };
  });
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9가-힣._-]+/g, '-').replace(/^-|-$/g, '') || 'image';
}

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function sendFile(response: ServerResponse, filePath: string, contentType: string) {
  const body = await readFile(filePath);
  response.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

async function sendDisplayNativeAsset(response: ServerResponse, pathname: string) {
  const fileName = decodeURIComponent(pathname.replace('/data/display-native-assets/', ''));
  const filePath = path.resolve(displayNativeAssetDir, fileName);

  if (!filePath.startsWith(`${displayNativeAssetDir}${path.sep}`)) {
    return sendJson(response, 404, { error: 'Not found' });
  }

  await sendFile(response, filePath, contentTypeForImage(filePath));
}

async function sendShoppingPromotionAsset(response: ServerResponse, pathname: string) {
  const fileName = decodeURIComponent(pathname.replace('/data/shopping-promotion-assets/', ''));
  const filePath = path.resolve(shoppingPromotionAssetDir, fileName);

  if (!filePath.startsWith(`${shoppingPromotionAssetDir}${path.sep}`)) {
    return sendJson(response, 404, { error: 'Not found' });
  }

  await sendFile(response, filePath, contentTypeForImage(filePath));
}

function contentTypeForImage(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }

  if (extension === '.gif') {
    return 'image/gif';
  }

  if (extension === '.webp') {
    return 'image/webp';
  }

  return 'image/png';
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function setStatus(state: StatusState, message: string, runDir?: string) {
  status = {
    state,
    message,
    runDir,
    updatedAt: new Date().toISOString()
  };
}

async function closeSession(session: BrowserSession | undefined) {
  if (!session) {
    return;
  }

  await session.close().catch(() => undefined);
}
