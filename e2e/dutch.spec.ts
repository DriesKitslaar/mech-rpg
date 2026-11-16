import { expect, test } from '@playwright/test';
import { completeMission } from '../src/core/campaign';
import { newGame, type GameState } from '../src/core/game';
import { MISSIONS } from '../src/content/missions';
import { SCENES } from '../src/content/scenes';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { choose, enterHub, open, press, snap, waitForPhase, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/nl-${name}.png`;

function pilot(): GameState {
  let g = newGame(CATALOG, STARTER_BUILD);
  for (const id of ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1']) g = completeMission(g, id, MISSIONS);
  return { ...g, credits: 6000, scenes: SCENES.map((s) => s.id), settings: { ...g.settings, language: 'nl' } };
}

test('in Dutch: the game is played from the title to a battle and through its screens, and every screen is in Dutch', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((save) => {
    if (!window.localStorage.getItem('ironwage-save')) {
      window.localStorage.setItem('ironwage-save', save);
      window.localStorage.setItem('ironwage-settings', JSON.stringify({ sfx: true, music: true, fastBattles: false, difficulty: 'standard', language: 'nl' }));
    }
  }, JSON.stringify(pilot()));
  await open(page);
  const labels = async () => (await snap(page)).menu.items.map((i) => i.label);
  // The title is in Dutch before any game is opened: the language is kept with the settings.
  expect(await labels()).not.toContain('Continue');
  await page.screenshot({ path: shot('title') });
  await choose(page, 'continue');
  await enterHub(page);
  expect(await labels()).not.toContain('Contracts');
  await page.screenshot({ path: shot('hub') });
  await choose(page, 'contracts');
  await page.screenshot({ path: shot('contracts') });
  await choose(page, 'choice-lumen');
  await waitForScreen(page, 'briefing');
  for (let i = 0; i < 20 && (await snap(page) as unknown as { typing?: boolean }).typing; i++) await page.waitForTimeout(100);
  await page.screenshot({ path: shot('briefing') });
  await press(page, 'Escape');
  await choose(page, 'patrol');
  await choose(page, 'accept');
  await waitForPhase(page, 'action');
  await page.screenshot({ path: shot('battle-action') });
  await press(page, 'Enter');
  await page.screenshot({ path: shot('battle-weapon') });
  await press(page, 'Enter');
  await waitForPhase(page, 'target');
  await page.screenshot({ path: shot('battle-target') });
  await press(page, 'Enter');
  await waitForPhase(page, 'action');
  await page.screenshot({ path: shot('battle-after-shot') });
  await choose(page, 'retreat');
  await choose(page, 'yes');
  await waitForPhase(page, 'result');
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  await page.screenshot({ path: shot('settlement') });
  await press(page, 'Enter');
  await enterHub(page);
  for (const screen of ['garage', 'shop', 'pilot', 'database', 'arena', 'training', 'gauntlet', 'messages', 'options']) {
    await choose(page, screen);
    await waitForScreen(page, screen);
    await page.screenshot({ path: shot(screen) });
    if (screen === 'options') {
      // Back to English and to Dutch again, on the spot.
      await choose(page, 'language');
      expect(await labels()).toContain('Language');
      await press(page, 'Enter');
      expect(await labels()).not.toContain('Language');
    }
    await press(page, 'Escape');
    await waitForScreen(page, 'hub');
  }
  expect(errors).toEqual([]);
});
