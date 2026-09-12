import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SelectorConfigSchema, ShoppingSearchConfigSchema } from './schema.js';

export async function loadShoppingSearchConfig(configPath: string) {
  const absolutePath = path.resolve(configPath);
  const raw = await readFile(absolutePath, 'utf8');
  return ShoppingSearchConfigSchema.parse(JSON.parse(raw));
}

export async function loadSelectorConfig(selectorPath = 'data/naver-shopping-search-selectors.json') {
  const absolutePath = path.resolve(selectorPath);
  const raw = await readFile(absolutePath, 'utf8');
  return SelectorConfigSchema.parse(JSON.parse(raw));
}
