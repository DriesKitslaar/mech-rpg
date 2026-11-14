import { expect, test } from '@playwright/test';
import { acceptContract, choose, finishBattle, open, press, snap, startBattle, waitForPhase, waitForScreen } from './helpers';

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

test('a contract with two battles moves on to the second after a win', async ({ page }, testInfo) => {
  // A saved game past the introductions, with the three-weapon build fitted.
  await page.addInitScript(() => window.localStorage.setItem('ironwage-save', JSON.stringify({
    version: 2, credits: 5000, battlesWon: 2, completed: ['intro-1', 'intro-2'], read: [],
    inventory: {
      'head-scout-mk1': 1, 'core-hauler': 1, 'arms-rigger': 1, 'legs-strider': 1, 'gen-kd1': 1,
      'wpn-rivet-rifle': 1, 'wpn-arc-pistol': 1, 'wpn-mortar-pod': 1,
    },
    build: {
      head: 'head-scout-mk1', core: 'core-hauler', arms: 'arms-rigger', legs: 'legs-strider', generator: 'gen-kd1',
      rightHand: 'wpn-rivet-rifle', leftHand: 'wpn-arc-pistol', shoulder: 'wpn-mortar-pod',
    },
  })));
  await open(page);
  await choose(page, 'continue');
  await waitForScreen(page, 'hub');
  await acceptContract(page, 'undertow-1');
  await page.screenshot({ path: testInfo.outputPath('mission-battle-1.png') });
  expect((await snap(page)).battle).toMatchObject({ mission: 'undertow-1', index: 0, of: 2 });
  const first = await finishBattle(page);
  await press(page, 'Enter');
  if (first.battle?.outcome === 'victory') {
    await waitForPhase(page, 'action');
    expect((await snap(page)).battle).toMatchObject({ index: 1, of: 2 });
    await page.screenshot({ path: 'docs/screenshots/battle-mech.png' });
  } else {
    await waitForScreen(page, 'settlement');
  }
});
