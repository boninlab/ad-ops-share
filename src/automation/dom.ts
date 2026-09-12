import type { Locator, Page } from 'playwright-core';

const defaultTimeoutMs = 2500;

export async function clickByText(page: Page, candidates: string[], timeoutMs = defaultTimeoutMs) {
  for (const text of candidates) {
    const locators = [
      page.getByRole('button', { name: text, exact: false }),
      page.getByRole('link', { name: text, exact: false }),
      page.getByText(text, { exact: false })
    ];

    for (const locator of locators) {
      if (await clickFirstVisible(locator, timeoutMs)) {
        return text;
      }
    }
  }

  throw new Error(`Could not click any text candidate: ${candidates.join(', ')}`);
}

export async function fillByLabelOrPlaceholder(
  page: Page,
  candidates: string[],
  value: string | number,
  timeoutMs = defaultTimeoutMs
) {
  const textValue = String(value);

  for (const label of candidates) {
    const locators = [
      page.getByLabel(label, { exact: false }),
      page.getByPlaceholder(label, { exact: false }),
      inputNearText(page, label),
      inputAfterText(page, label)
    ];

    for (const locator of locators) {
      if (await fillFirstVisible(locator, textValue, timeoutMs)) {
        return label;
      }
    }
  }

  throw new Error(`Could not fill any field candidate: ${candidates.join(', ')}`);
}

export async function chooseByText(page: Page, candidates: string[], timeoutMs = defaultTimeoutMs) {
  return clickByText(page, candidates, timeoutMs);
}

export async function uploadFileByLabel(
  page: Page,
  candidates: string[],
  filePath: string,
  timeoutMs = defaultTimeoutMs
) {
  for (const label of candidates) {
    const locators = [
      page.getByLabel(label, { exact: false }),
      page.locator('input[type="file"]')
    ];

    for (const locator of locators) {
      const count = await locator.count();
      for (let index = 0; index < count; index += 1) {
        const current = locator.nth(index);
        try {
          await current.setInputFiles(filePath, { timeout: timeoutMs });
          return label;
        } catch {
          // Try next candidate.
        }
      }
    }
  }

  throw new Error(`Could not upload file using candidates: ${candidates.join(', ')}`);
}

export async function waitForDomSettled(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
}

export async function waitForText(page: Page, candidates: string[], timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const text of candidates) {
      const count = await page.getByText(text, { exact: false }).count().catch(() => 0);
      if (count > 0) {
        return text;
      }
    }

    await page.waitForTimeout(500);
  }

  throw new Error(`Could not find any text candidate: ${candidates.join(', ')}`);
}

async function clickFirstVisible(locator: Locator, timeoutMs: number) {
  const count = await locator.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const current = locator.nth(index);
    try {
      await current.waitFor({ state: 'visible', timeout: timeoutMs });
      await current.click({ timeout: timeoutMs });
      return true;
    } catch {
      // Try next matching element.
    }
  }

  return false;
}

async function fillFirstVisible(locator: Locator, value: string, timeoutMs: number) {
  const count = await locator.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const current = locator.nth(index);
    try {
      await current.waitFor({ state: 'visible', timeout: timeoutMs });
      await current.fill(value, { timeout: timeoutMs });
      return true;
    } catch {
      try {
        await setNativeInputValue(current, value);
        return true;
      } catch {
        // Try next matching element.
      }
    }
  }

  return false;
}

function inputNearText(page: Page, text: string) {
  return page
    .locator(`text=${text}`)
    .locator(`xpath=ancestor::*[self::label or self::div or self::li or self::tr][1]//*[self::textarea or (self::input and ${editableInputPredicate()})]`)
    .first();
}

function inputAfterText(page: Page, text: string) {
  return page
    .locator(
      `xpath=//*[self::label or self::span or self::div or self::dt or self::th or self::p][contains(normalize-space(.), ${xpathLiteral(text)})]/following::*[self::textarea or (self::input and ${editableInputPredicate()})][1]`
    )
    .first();
}

async function setNativeInputValue(locator: Locator, value: string) {
  await locator.evaluate((element, nextValue) => {
    const input = element as HTMLInputElement | HTMLTextAreaElement;

    if (input instanceof HTMLInputElement) {
      const editableTypes = new Set(['', 'email', 'number', 'password', 'search', 'string', 'tel', 'text', 'url']);
      if (!editableTypes.has(input.type)) {
        throw new Error(`Element is not a text input: ${input.type}`);
      }
    }

    if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) {
      throw new Error('Element is not an input or textarea');
    }

    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    input.focus();
    valueSetter?.call(input, nextValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

function editableInputPredicate() {
  return [
    'not(@type)',
    '@type=""',
    '@type="email"',
    '@type="number"',
    '@type="password"',
    '@type="search"',
    '@type="string"',
    '@type="tel"',
    '@type="text"',
    '@type="url"'
  ].join(' or ');
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
    .join(', "\"\'\"", ')})`;
}
