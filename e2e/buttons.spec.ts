import { expect, test, type Page } from '@playwright/test';
import { choose, enterHub, nextFrame, open, press, snap, waitForScreen } from './helpers';

/** A press of one of the pad's buttons, the way the Android shell hands it to the page. */
async function pad(page: Page, code: 'ButtonA' | 'ButtonB'): Promise<void> {
  await page.evaluate((c) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: c }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: c }));
  }, code);
  await nextFrame(page);
}
const list = async (page: Page) => (await snap(page) as unknown as { list: string }).list;

test('with A and B swapped in the options the pad\'s two buttons change places, and Back and Enter do not', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await choose(page, 'new');
  await enterHub(page);

  // As the handheld comes: A confirms, B goes back.
  await pad(page, 'ButtonA');
  expect(await list(page)).toBe('contracts');
  await pad(page, 'ButtonB');
  expect(await list(page)).toBe('main');

  await choose(page, 'options');
  await waitForScreen(page, 'options');
  await choose(page, 'swapAB');
  expect((await snap(page)).menu.items.find((i) => i.id === 'swapAB')?.note).toBe('Swapped');

  // Now A goes back...
  await pad(page, 'ButtonA');
  await waitForScreen(page, 'hub');
  // ...and B confirms.
  await pad(page, 'ButtonB');
  expect(await list(page)).toBe('contracts');
  // The system's Back key still goes back, and Enter still confirms.
  await press(page, 'Escape');
  expect(await list(page)).toBe('main');
  await press(page, 'Enter');
  expect(await list(page)).toBe('contracts');
  await pad(page, 'ButtonA');
  expect(await list(page)).toBe('main');

  // The swap is kept: after a reload the title already answers to B.
  await page.reload();
  await page.waitForFunction(() => (window as any).__game?.snapshot().screen === 'title');
  await pad(page, 'ButtonB');
  await waitForScreen(page, 'hub');
  expect(errors).toEqual([]);
});
