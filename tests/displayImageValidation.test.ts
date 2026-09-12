import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync('web/app.js', 'utf8');
const requirements = source.slice(source.indexOf('const DISPLAY_NATIVE_IMAGE_REQUIREMENTS ='), source.indexOf('const DISPLAY_NATIVE_AD_IMAGE_SLOTS'));
const validators = source.slice(source.indexOf('function formatImageBytes'), source.indexOf('async function validateDisplayNativeImagesBeforeRun'));
const context = vm.createContext({ readImageSize: async (file: any) => ({ width: file.width, height: file.height }) });
vm.runInContext(requirements + validators + '\nglobalThis.validate = validateDisplayNativeImage;', context);

test('display image validation checks actual dimensions, type and both size boundaries', async () => {
  for (const [slot, width, height, min, max] of [
    ['square', 1200, 1200, 80 * 1024, 800 * 1024],
    ['wide', 1200, 628, 50 * 1024, 500 * 1024],
    ['tall', 1200, 1800, 100 * 1024, 1200 * 1024],
    ['banner', 342, 228, 10 * 1024, 130 * 1024],
    ['profile', 300, 300, 1, 200 * 1024 - 1]
  ] as const) {
    const file = { name: 'sample.png', type: 'image/png', width, height, size: min };
    await context.validate(file, slot);
    await context.validate({ ...file, size: max }, slot);
    await assert.rejects(context.validate({ ...file, size: min - 1 }, slot), /필요/);
    await assert.rejects(context.validate({ ...file, size: max + 1 }, slot), /필요/);
    await assert.rejects(context.validate({ ...file, width: width + 1 }, slot), /px 필요/);
    await assert.rejects(context.validate({ ...file, type: 'image/gif' }, slot), /JPG 또는 PNG/);
  }
});
