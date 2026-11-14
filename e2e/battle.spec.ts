import { expect, test } from '@playwright/test';
import { finishBattle, press, snap, startBattle, waitForPhase, waitForScreen } from './helpers';

test('a battle can be played to its end with the keyboard alone', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startBattle(page);
  await page.screenshot({ path: testInfo.outputPath('battle-action.png') });

  await press(page, 'Enter');
  await waitForPhase(page, 'weapon');
  await page.screenshot({ path: testInfo.outputPath('battle-weapon.png') });
  await press(page, 'Enter');
  await waitForPhase(page, 'target');
  await page.screenshot({ path: testInfo.outputPath('battle-target.png') });
  await press(page, 'Escape');
  await press(page, 'Escape');
  await waitForPhase(page, 'action');

  const end = await finishBattle(page);
  expect(end.battle?.phase).toBe('result');
  expect(['victory', 'defeat']).toContain(end.battle?.outcome);
  expect(end.battle?.message).toBe(end.battle?.outcome === 'victory' ? 'VICTORY' : 'DEFEAT');
  await page.screenshot({ path: testInfo.outputPath('battle-result.png') });
  expect(errors).toEqual([]);
});

test('the game stays playable when sprite files are missing', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/sprites/**', (route) => route.abort());
  await startBattle(page, '/?seed=3&fast=1');
  await page.screenshot({ path: testInfo.outputPath('battle-placeholders.png') });
  expect((await snap(page)).battle?.phase).toBe('action');
  expect(errors).toEqual([]);
});

test('confirming the result leads to the settlement and back to the hub', async ({ page }) => {
  await startBattle(page);
  const end = await finishBattle(page);
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  const { net, won } = (await snap(page)).settlement!;
  expect(won).toBe(end.battle?.outcome === 'victory');
  await press(page, 'Enter');
  await waitForScreen(page, 'hub');
  expect(await snap(page)).toMatchObject({ credits: 1200 + net, battlesWon: won ? 1 : 0 });
});
