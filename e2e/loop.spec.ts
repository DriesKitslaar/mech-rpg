import { expect, test } from '@playwright/test';
import { choose, finishBattle, open, press, snap, waitForPhase, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

test('buy a weapon, fit it, fight, get paid, and find it all saved after a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await open(page);
  await page.screenshot({ path: shot('title') });
  await choose(page, 'new');
  await waitForScreen(page, 'hub');
  await page.screenshot({ path: shot('hub') });

  // Shop: the Arc Pistol is on the hand tab, five tabs to the right.
  await choose(page, 'shop');
  await waitForScreen(page, 'shop');
  for (let i = 0; i < 5; i++) await press(page, 'KeyE');
  await choose(page, 'wpn-arc-pistol');
  expect(await snap(page)).toMatchObject({ credits: 600, message: 'Bought Arc Pistol' });
  await page.screenshot({ path: shot('shop') });
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');

  // Garage: fit it to the left hand.
  await choose(page, 'garage');
  await waitForScreen(page, 'garage');
  await choose(page, 'leftHand');
  await page.screenshot({ path: shot('garage-parts') });
  await choose(page, 'wpn-arc-pistol');
  expect((await snap(page)).build?.leftHand).toBe('wpn-arc-pistol');
  await page.screenshot({ path: shot('garage') });
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');

  // Battle and settlement.
  await choose(page, 'sortie');
  await page.screenshot({ path: shot('contracts') });
  await choose(page, 'intro');
  await waitForPhase(page, 'action');
  await page.screenshot({ path: shot('battle-action') });
  const end = await finishBattle(page);
  expect(end.battle?.phase).toBe('result');
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  const { net, won } = (await snap(page)).settlement!;
  // Booked the moment it is shown.
  expect((await snap(page)).credits).toBe(600 + net);
  await page.screenshot({ path: shot('settlement') });
  await press(page, 'Enter');
  await waitForScreen(page, 'hub');
  const after = await snap(page);
  expect(after).toMatchObject({ credits: 600 + net, battlesWon: won ? 1 : 0 });

  // A reload must find the same game.
  await page.reload();
  await page.waitForFunction(() => (window as any).__game?.snapshot().screen === 'title');
  expect((await snap(page)).menu.items.map((i) => i.id)).toEqual(['continue', 'new']);
  await choose(page, 'continue');
  await waitForScreen(page, 'hub');
  const loaded = await snap(page);
  expect(loaded.credits).toBe(after.credits);
  expect(loaded.battlesWon).toBe(after.battlesWon);
  expect(loaded.build?.leftHand).toBe('wpn-arc-pistol');
  expect(loaded.inventory?.['wpn-arc-pistol']).toBe(1);
  expect(errors).toEqual([]);
});

test('a corrupt save does not stop the game from starting', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => window.localStorage.setItem('ironwage-save', '{"version":1,"credits":'));
  await open(page);
  expect((await snap(page)).menu.items.map((i) => i.id)).toEqual(['new']);
  await choose(page, 'new');
  await waitForScreen(page, 'hub');
  expect(errors).toEqual([]);
});
