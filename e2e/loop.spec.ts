import { expect, test } from '@playwright/test';
import { choose, enterHub, finishMission, medalPay, open, press, snap, waitForPhase, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

test('buy a weapon, fit it, fight, get paid, and find it all saved after a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await open(page);
  await page.screenshot({ path: shot('title') });
  await choose(page, 'new');
  // A new game asks what the pilot is called, then opens on the first page of the story.
  await waitForScreen(page, 'callsign');
  await page.screenshot({ path: shot('callsign') });
  await press(page, 'Enter');
  await waitForScreen(page, 'scene');
  expect((await snap(page)).scene).toBe('act-1');
  await page.screenshot({ path: shot('scene-act-1') });
  await enterHub(page);
  await page.screenshot({ path: shot('hub') });

  // Shop: the Arc Pistol is on the hand tab, eight tabs to the right.
  await choose(page, 'shop');
  await waitForScreen(page, 'shop');
  for (let i = 0; i < 8; i++) await press(page, 'KeyE');
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

  // Messages: the welcome is waiting.
  await choose(page, 'messages');
  await waitForScreen(page, 'messages');
  await choose(page, 'welcome');
  await page.screenshot({ path: shot('message') });
  await press(page, 'Escape');
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');

  // Contract: list, briefing, battle, settlement.
  await choose(page, 'contracts');
  await page.screenshot({ path: shot('contracts') });
  await choose(page, 'intro-1');
  await waitForScreen(page, 'briefing');
  await page.screenshot({ path: shot('briefing') });
  // Backing out of a briefing returns to the contract list it was opened from.
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  expect((await snap(page)).menu.items.map((i) => i.id)).toEqual(['patrol', 'intro-1']);
  await choose(page, 'intro-1');
  await waitForScreen(page, 'briefing');
  await choose(page, 'accept');
  await waitForPhase(page, 'action');
  await page.screenshot({ path: shot('battle-action') });
  await finishMission(page);
  const { net, won } = (await snap(page)).settlement!;
  // Booked the moment it is shown.
  const booked = await snap(page);
  expect(booked.credits).toBe(600 + net + medalPay(booked));
  await page.screenshot({ path: shot('settlement') });
  await press(page, 'Enter');
  await waitForScreen(page, 'hub');
  const after = await snap(page);
  expect(after).toMatchObject({ credits: 600 + net + medalPay(after), battlesWon: won ? 1 : 0 });
  expect(after.completed).toEqual(won ? ['intro-1'] : []);

  // A reload must find the same game.
  await page.reload();
  await page.waitForFunction(() => (window as any).__game?.snapshot().screen === 'title');
  expect((await snap(page)).menu.items.map((i) => i.id)).toEqual(['continue', 'new', 'options']);
  await choose(page, 'continue');
  await waitForScreen(page, 'hub');
  const loaded = await snap(page);
  expect(loaded.credits).toBe(after.credits);
  expect(loaded.battlesWon).toBe(after.battlesWon);
  expect(loaded.build?.leftHand).toBe('wpn-arc-pistol');
  expect(loaded.completed).toEqual(after.completed);
  expect(loaded.inventory?.['wpn-arc-pistol']).toBe(1);
  expect(errors).toEqual([]);
});

test('a corrupt save does not stop the game from starting', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => window.localStorage.setItem('ironwage-save', '{"version":1,"credits":'));
  await open(page);
  expect((await snap(page)).menu.items.map((i) => i.id)).toEqual(['new', 'options']);
  await choose(page, 'new');
  await enterHub(page);
  expect(errors).toEqual([]);
});
