import { expect, test } from '@playwright/test';
import { completeMission } from '../src/core/campaign';
import { newGame, type GameState } from '../src/core/game';
import { MISSIONS } from '../src/content/missions';
import { SCENES } from '../src/content/scenes';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { choose, enterHub, finishBattle, open, press, snap, waitForPhase, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

function pilot(): GameState {
  let g = newGame(CATALOG, STARTER_BUILD);
  for (const id of ['intro-1', 'intro-2']) g = completeMission(g, id, MISSIONS);
  return { ...g, scenes: SCENES.map((s) => s.id) };
}

test('the Gauntlet: a run is started, a floor is won, one of three things is taken, and the run waits in the save', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((save) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', save);
  }, JSON.stringify(pilot()));
  await open(page);
  await choose(page, 'continue');
  await enterHub(page);
  await choose(page, 'gauntlet');
  await waitForScreen(page, 'gauntlet');
  await page.screenshot({ path: shot('gauntlet-start') });
  await choose(page, 'start');
  const g = async () => (await snap(page) as unknown as { gauntlet: { floor: number | null; drafting: boolean; offers: unknown[] } }).gauntlet;
  expect(await g()).toMatchObject({ floor: 1, drafting: false });
  await page.screenshot({ path: shot('gauntlet-floor') });
  await choose(page, 'door-0');
  await waitForPhase(page, 'action');
  const end = await finishBattle(page);
  expect(end.battle?.outcome).toBe('victory');
  await press(page, 'Enter');
  await waitForScreen(page, 'gauntlet');
  expect(await g()).toMatchObject({ floor: 2, drafting: true });
  expect((await g()).offers).toHaveLength(3);
  await page.screenshot({ path: shot('gauntlet-draft') });
  await press(page, 'Enter');
  expect(await g()).toMatchObject({ floor: 2, drafting: false });
  // Closed and opened again, the run is where it was left.
  await page.reload();
  await page.waitForFunction(() => (window as any).__game?.snapshot().screen === 'title');
  await choose(page, 'continue');
  await enterHub(page);
  await choose(page, 'gauntlet');
  expect(await g()).toMatchObject({ floor: 2, drafting: false });
  expect(errors).toEqual([]);
});

test('the new great machines stand on the field: the Scrap King and the Night Train', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let g = pilot();
  for (const id of ['hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1', 'choice-lumen', 'lumen-3', 'lumen-4', 'lumen-5', 'finale-lumen', 'guild-1', 'guild-2']) {
    g = completeMission(g, id, MISSIONS);
  }
  await page.addInitScript((save) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', save);
  }, JSON.stringify({ ...g, choices: {} }));
  await open(page);
  await choose(page, 'continue');
  await enterHub(page);
  await choose(page, 'contracts');
  await choose(page, 'guild-3');
  await waitForScreen(page, 'briefing');
  await page.screenshot({ path: shot('briefing-guild') });
  await choose(page, 'accept');
  await waitForPhase(page, 'action');
  expect((await snap(page)).battle?.enemies).toEqual(['scrap-king']);
  await choose(page, 'fire');
  await press(page, 'Enter');
  expect((await snap(page)).menu.items.map((i) => i.label)).toEqual(['Shell', 'Legs', 'Claws', 'Lamps']);
  await page.screenshot({ path: shot('boss-scrap-king') });
  expect(errors).toEqual([]);
});
