import path from 'node:path';
import { chromium, type BrowserContext } from 'playwright-core';

export type BrowserMode = 'profile' | 'existingChrome';

export type BrowserSession = {
  context: BrowserContext;
  mode: BrowserMode;
  close: () => Promise<void>;
};

export async function openChromeSession(options: {
  mode: BrowserMode;
  profileDir: string;
  cdpUrl: string;
}): Promise<BrowserSession> {
  if (options.mode === 'existingChrome') {
    const browser = await connectToExistingChrome(options.cdpUrl);
    const context = browser.contexts()[0] ?? (await browser.newContext());

    return {
      context,
      mode: options.mode,
      close: async () => {
        // Do not close the user's Chrome. The server only releases its handle.
      }
    };
  }

  const context = await launchAutomationProfile(options.profileDir);

  return {
    context,
    mode: options.mode,
    close: () => context.close()
  };
}

async function launchAutomationProfile(profileDir: string) {
  try {
    return await chromium.launchPersistentContext(path.resolve(profileDir), {
      channel: 'chrome',
      headless: false,
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check'
      ]
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('Target page, context or browser has been closed')) {
      throw new Error(
        [
          '전용 자동화 프로필 Chrome 실행 실패.',
          '이미 열린 자동화 Chrome 창이 있으면 닫은 뒤 다시 시도하세요.',
          '계속 실패하면 실행 방식을 "현재 Chrome 연결"로 바꾸고 Chrome을 원격 디버깅 모드로 실행해야 합니다.'
        ].join(' ')
      );
    }

    throw error;
  }
}

async function connectToExistingChrome(cdpUrl: string) {
  try {
    return await chromium.connectOverCDP(cdpUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('ECONNREFUSED') || message.includes('connect ECONNREFUSED')) {
      throw new Error(
        [
          `현재 Chrome 연결 실패: ${cdpUrl}에 연결할 수 없습니다.`,
          'Chrome이 원격 디버깅 모드로 실행되어 있지 않습니다.',
          '해결 방법: 실행 방식을 "전용 자동화 프로필"로 바꾸거나, 모든 Chrome 창을 종료한 뒤 터미널에서 `npm run chrome:debug`로 Chrome을 다시 열고 "현재 Chrome 연결"을 사용하세요.'
        ].join(' ')
      );
    }

    throw error;
  }
}
