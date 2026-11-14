import { expect, test } from '@playwright/test';
import { completeMission } from '../src/core/campaign';
import { buy, equip, newGame, type GameState } from '../src/core/game';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { REFERENCE_BUILDS } from '../src/content/referenceBuilds';
import { choose, finishMission, open, press, snap, waitForPhase, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

/** A pilot who finished the story with late-game gear, some experience and a few arena wins. */
function veteran(): GameState {
  let g = newGame(CATALOG, STARTER_BUILD);
  for (const id of ['intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'choice-lumen', 'finale-lumen']) g = completeMission(g, id, MISSIONS);
  g = { ...g, credits: 999999 };
  for (const [slot, id] of Object.entries(REFERENCE_BUILDS.tier6)) {
    g = buy(g, id, CATALOG);
    g = equip(g, slot as keyof GameState['build'], id, CATALOG);
  }
  return { ...g, credits: 8400, xp: 1500, perks: { marksman: 2 }, arenaRank: 3, battlesWon: 31, endingSeen: true };
}

test('arena, pilot, options, open contracts and a new cycle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((save) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', save);
  }, JSON.stringify(veteran()));

  await open(page);
  await choose(page, 'continue');
  await waitForScreen(page, 'hub');
  expect((await snap(page)).menu.items.map((i) => i.id)).toEqual(['contracts', 'arena', 'garage', 'shop', 'pilot', 'messages', 'options', 'cycle']);
  await page.screenshot({ path: shot('hub-late') });

  // Pilot: level 5 with four points, two already spent.
  await choose(page, 'pilot');
  await waitForScreen(page, 'pilot');
  await choose(page, 'plating');
  expect((await snap(page) as any).pilot).toEqual({ level: 5, points: 1 });
  await page.screenshot({ path: shot('pilot') });
  await press(page, 'Escape');

  // Options.
  await choose(page, 'options');
  await waitForScreen(page, 'options');
  await choose(page, 'fastBattles');
  expect((await snap(page) as any).settings.fastBattles).toBe(true);
  await page.screenshot({ path: shot('options') });
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');

  // Open contracts sit on the list under the story ones.
  await choose(page, 'contracts');
  const list = (await snap(page)).menu.items.map((i) => i.id);
  expect(list.filter((id) => id.startsWith('open-'))).toHaveLength(3);
  await page.screenshot({ path: shot('contracts-open') });
  await choose(page, list.find((id) => id.startsWith('open-'))!);
  await waitForScreen(page, 'briefing');
  await page.screenshot({ path: shot('briefing-open') });
  await press(page, 'Escape');
  await press(page, 'Escape');

  // Arena: the fourth opponent is next.
  await choose(page, 'arena');
  await waitForScreen(page, 'arena');
  expect((await snap(page)).menu.cursor).toBe(3);
  await page.screenshot({ path: shot('arena') });
  await press(page, 'Enter');
  await waitForScreen(page, 'briefing');
  await page.screenshot({ path: shot('arena-briefing') });
  await choose(page, 'accept');
  await waitForPhase(page, 'action');
  await page.screenshot({ path: shot('arena-duel') });
  await finishMission(page);
  const after = await snap(page) as any;
  expect(after.settlement.won).toBe(true);
  expect(after.arenaRank).toBe(4);
  await press(page, 'Enter');
  await waitForScreen(page, 'hub');

  // A new cycle keeps everything and restarts the story.
  await choose(page, 'cycle');
  await page.screenshot({ path: shot('cycle-question') });
  await choose(page, 'yes');
  const cycled = await snap(page) as any;
  expect(cycled).toMatchObject({ screen: 'hub', cycle: 1, completed: [], arenaRank: 4 });
  await page.reload();
  await page.waitForFunction(() => (window as any).__game?.snapshot().screen === 'title');
  await choose(page, 'continue');
  await waitForScreen(page, 'hub');
  expect(await snap(page) as any).toMatchObject({ cycle: 1, arenaRank: 4, xp: cycled.xp, settings: { fastBattles: true } });
  expect(errors).toEqual([]);
});
