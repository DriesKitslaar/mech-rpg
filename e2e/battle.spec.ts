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
  await page.screenshot({ path: testInfo.outputPath('battle-weapon.png') });
  await page.keyboard.press('Enter');
  // Input is handled on the next frame, so wait for the phase instead of reading it at once.
  await page.waitForFunction(() => (window as any).__game.battle().phase === 'target');
  await page.screenshot({ path: testInfo.outputPath('battle-target.png') });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).__game.battle().phase === 'action');

  // Drive the battle one key at a time from what the game reports, waiting a frame after each key.
  const nextFrame = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  let state = await snapshot(page);
  for (let i = 0; i < 3000 && state.phase !== 'result'; i++) {
    const selected = state.menu.items[state.menu.cursor]?.id;
    if (state.phase === 'weapon' || state.phase === 'target') {
      await page.keyboard.press('Enter');
    } else if (state.phase === 'action') {
      const wanted = state.menu.items[0].enabled ? 'fire' : 'endTurn';
      await page.keyboard.press(selected === wanted ? 'Enter' : 'ArrowDown');
    }
    await nextFrame();
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
