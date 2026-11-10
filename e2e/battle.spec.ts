import { expect, test, type Page } from '@playwright/test';

type Snapshot = {
  outcome: string; round: number; phase: string; message: string;
  menu: { items: { id: string; enabled: boolean }[]; cursor: number };
};
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => (window as any).__game.battle());

async function ready(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => (window as any).__game?.battle().phase === 'action');
}

test('a battle can be played to its end with the keyboard alone', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page, '/?encounter=intro&seed=7&fast=1');
  await page.screenshot({ path: testInfo.outputPath('battle-action.png') });

  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  expect((await snapshot(page)).phase).toBe('target');
  await page.screenshot({ path: testInfo.outputPath('battle-target.png') });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  let state = await snapshot(page);
  for (let i = 0; i < 400 && state.phase !== 'result'; i++) {
    if (state.phase === 'action' && state.menu.items[0].enabled) {
      for (let k = 0; k < 3; k++) await page.keyboard.press('Enter');
    } else if (state.phase === 'action') {
      while ((await snapshot(page)).menu.items[(await snapshot(page)).menu.cursor]?.id !== 'endTurn') {
        await page.keyboard.press('ArrowDown');
      }
      await page.keyboard.press('Enter');
    } else {
      await page.waitForTimeout(50);
    }
    state = await snapshot(page);
  }
  expect(state.phase).toBe('result');
  expect(['victory', 'defeat']).toContain(state.outcome);
  expect(state.message).toBe(state.outcome === 'victory' ? 'VICTORY' : 'DEFEAT');
  await page.screenshot({ path: testInfo.outputPath('battle-result.png') });
  expect(errors).toEqual([]);
});

test('the battle stays playable when sprite files are missing', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/sprites/**', (route) => route.abort());
  await ready(page, '/?encounter=outpost&seed=3&fast=1');
  await page.screenshot({ path: testInfo.outputPath('battle-placeholders.png') });
  expect((await snapshot(page)).phase).toBe('action');
  expect(errors).toEqual([]);
});

test('an unknown encounter falls back to the intro', async ({ page }) => {
  await ready(page, '/?encounter=does-not-exist&fast=1');
  expect((await snapshot(page)).outcome).toBe('ongoing');
});
