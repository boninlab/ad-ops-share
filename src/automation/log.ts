import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from 'playwright-core';

export class RunLogger {
  private readonly entries: string[] = [];

  constructor(public readonly runDir: string) {}

  async init() {
    await mkdir(this.runDir, { recursive: true });
  }

  info(message: string) {
    const line = `${new Date().toISOString()} INFO ${message}`;
    this.entries.push(line);
    console.log(line);
  }

  warn(message: string) {
    const line = `${new Date().toISOString()} WARN ${message}`;
    this.entries.push(line);
    console.warn(line);
  }

  async screenshot(page: Page, name: string) {
    const fileName = `${safeFileName(name)}.png`;
    const filePath = path.join(this.runDir, fileName);
    await page.screenshot({ path: filePath, fullPage: true });
    this.info(`screenshot saved: ${filePath}`);
  }

  async domSummary(page: Page, name: string) {
    const fileName = `${safeFileName(name)}.dom.json`;
    const filePath = path.join(this.runDir, fileName);
    const summary = await page.evaluate(`(() => {
      const visibleText = (value) => value?.replace(/\s+/g, ' ').trim() ?? '';
      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const fieldSelector = 'input, textarea, select, button, [role="button"], [role="radio"], [role="checkbox"], a';
      const controls = Array.from(document.querySelectorAll(fieldSelector))
        .filter(isVisible)
        .slice(0, 300)
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          type: element.getAttribute('type') ?? '',
          role: element.getAttribute('role') ?? '',
          text: visibleText(element.innerText || element.textContent),
          aria: element.getAttribute('aria-label') ?? '',
          placeholder: element.getAttribute('placeholder') ?? '',
          value:
            element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
              ? element.value
              : '',
          disabled:
            element instanceof HTMLButtonElement || element instanceof HTMLInputElement || element instanceof HTMLSelectElement
              ? element.disabled
              : element.getAttribute('aria-disabled') === 'true'
        }));

      return {
        url: location.href,
        title: document.title,
        bodyText: visibleText(document.body.innerText).slice(0, 20000),
        controls
      };
    })()`);

    await writeFile(filePath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    this.info(`dom summary saved: ${filePath}`);
  }

  async flush() {
    await writeFile(path.join(this.runDir, 'run.log'), `${this.entries.join('\n')}\n`, 'utf8');
  }
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '');
}
