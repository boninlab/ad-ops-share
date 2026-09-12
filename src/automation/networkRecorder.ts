import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserContext, Page, Request, Response } from 'playwright-core';

export type CapturedNetworkCall = {
  id: number;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  method: string;
  url: string;
  resourceType: string;
  requestHeaders: Record<string, string>;
  postData?: string;
  postDataJson?: unknown;
  status?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  responseJson?: unknown;
  failed?: boolean;
  error?: string;
  tags: string[];
};

export type NetworkRecordingSnapshot = {
  active: boolean;
  startedAt?: string;
  count: number;
  runDir?: string;
  lastFile?: string;
};

type PendingCall = {
  call: CapturedNetworkCall;
  startMs: number;
};

export class NetworkRecorder {
  private nextId = 1;
  private startedAt = '';
  private runDir = '';
  private lastFile = '';
  private readonly calls: CapturedNetworkCall[] = [];
  private readonly pending = new Map<Request, PendingCall>();
  private readonly attachedPages = new WeakSet<Page>();
  private context?: BrowserContext;
  private contextPageHandler?: (page: Page) => void;

  get active() {
    return Boolean(this.context);
  }

  get snapshot(): NetworkRecordingSnapshot {
    return {
      active: this.active,
      startedAt: this.startedAt || undefined,
      count: this.calls.length,
      runDir: this.runDir || undefined,
      lastFile: this.lastFile || undefined
    };
  }

  async start(context: BrowserContext, outputRootDir: string, label: string) {
    if (this.active) {
      return this.snapshot;
    }

    this.startedAt = new Date().toISOString();
    this.runDir = path.resolve(
      outputRootDir,
      `${this.startedAt.replace(/[:.]/g, '-')}-${safeFileName(label)}-network`
    );
    this.lastFile = '';
    this.calls.length = 0;
    this.pending.clear();
    this.context = context;
    await mkdir(this.runDir, { recursive: true });

    for (const page of context.pages()) {
      this.attachPage(page);
    }

    this.contextPageHandler = (page) => this.attachPage(page);
    context.on('page', this.contextPageHandler);
    return this.snapshot;
  }

  async stop() {
    if (this.context && this.contextPageHandler) {
      this.context.off('page', this.contextPageHandler);
    }

    this.context = undefined;
    this.contextPageHandler = undefined;
    this.pending.clear();

    if (!this.runDir) {
      return this.snapshot;
    }

    const filePath = path.join(this.runDir, 'network-calls.json');
    await writeFile(
      filePath,
      `${JSON.stringify(
        {
          startedAt: this.startedAt,
          stoppedAt: new Date().toISOString(),
          calls: this.calls
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    this.lastFile = filePath;
    return this.snapshot;
  }

  private attachPage(page: Page) {
    if (this.attachedPages.has(page)) {
      return;
    }

    this.attachedPages.add(page);
    page.on('request', (request) => this.captureRequest(request));
    page.on('response', (response) => void this.captureResponse(response));
    page.on('requestfailed', (request) => this.captureFailure(request));
  }

  private captureRequest(request: Request) {
    if (!this.active) {
      return;
    }

    if (!shouldCapture(request)) {
      return;
    }

    const postData = request.postData() ?? undefined;
    const call: CapturedNetworkCall = {
      id: this.nextId,
      startedAt: new Date().toISOString(),
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      requestHeaders: sanitizeHeaders(request.headers()),
      postData,
      postDataJson: parseJson(postData),
      tags: classifyCall(request.method(), request.url(), postData)
    };

    this.nextId += 1;
    this.calls.push(call);
    this.pending.set(request, {
      call,
      startMs: Date.now()
    });
  }

  private async captureResponse(response: Response) {
    if (!this.active) {
      return;
    }

    const pending = this.pending.get(response.request());
    if (!pending) {
      return;
    }

    const contentType = response.headers()['content-type'] ?? '';
    let responseBody: string | undefined;
    let responseJson: unknown;

    if (isTextLike(contentType)) {
      responseBody = await response.text().catch(() => undefined);
      responseJson = parseJson(responseBody);
    }

    pending.call.finishedAt = new Date().toISOString();
    pending.call.durationMs = Date.now() - pending.startMs;
    pending.call.status = response.status();
    pending.call.responseHeaders = sanitizeHeaders(response.headers());
    pending.call.responseBody = responseBody;
    pending.call.responseJson = responseJson;
    this.pending.delete(response.request());
  }

  private captureFailure(request: Request) {
    if (!this.active) {
      return;
    }

    const pending = this.pending.get(request);
    if (!pending) {
      return;
    }

    pending.call.finishedAt = new Date().toISOString();
    pending.call.durationMs = Date.now() - pending.startMs;
    pending.call.failed = true;
    pending.call.error = request.failure()?.errorText ?? 'request failed';
    this.pending.delete(request);
  }
}

function shouldCapture(request: Request) {
  const resourceType = request.resourceType();
  if (resourceType !== 'xhr' && resourceType !== 'fetch') {
    return false;
  }

  const url = request.url();
  if (!/naver\.com/i.test(url)) {
    return false;
  }

  return true;
}

function sanitizeHeaders(headers: Record<string, string>) {
  const result: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    const key = name.toLowerCase();

    if (
      key === 'cookie' ||
      key === 'authorization' ||
      key.includes('token') ||
      key.includes('secret') ||
      key.includes('credential')
    ) {
      result[name] = '<redacted>';
      continue;
    }

    result[name] = value;
  }

  return result;
}

function parseJson(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isTextLike(contentType: string) {
  return (
    contentType.includes('json') ||
    contentType.includes('text') ||
    contentType.includes('javascript') ||
    contentType.includes('x-www-form-urlencoded')
  );
}

function classifyCall(method: string, url: string, body: string | undefined) {
  const haystack = `${method} ${url} ${body ?? ''}`.toLowerCase();
  const tags: string[] = [];

  for (const [tag, patterns] of Object.entries({
    campaign: ['campaign', 'cmp'],
    adGroup: ['adgroup', 'ad-group', 'ad_group', 'grp'],
    keyword: ['keyword', '키워드'],
    product: ['product', 'shopping', 'mall'],
    material: ['material', 'creative', 'adcreative', 'ad-creative'],
    adExtension: ['adextension', 'ad-extension', 'ad_extension', 'extension'],
    image: ['image', 'img', 'upload'],
    powerlink: ['web_site', 'powerlink', 'power-link', '파워링크'],
    media: ['media', 'placement', 'exclude', 'blacklist', 'restrict'],
    create: ['create', 'register', 'save', 'post'],
    update: ['update', 'modify', 'put', 'patch']
  })) {
    if (patterns.some((pattern) => haystack.includes(pattern))) {
      tags.push(tag);
    }
  }

  return tags;
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9가-힣._-]+/g, '-').replace(/^-|-$/g, '');
}
