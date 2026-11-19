import { expect, test, type Page } from '@playwright/test';
import { ARCHETYPES } from '../src/core/archetype';
import { completeMission } from '../src/core/campaign';
import { BUILD_SLOTS, buy, equip, newGame, saveLoadout, type GameState } from '../src/core/game';
import type { Build } from '../src/core/types';
import { ARCHETYPE_BUILDS } from '../src/content/archetypeBuilds';
import { WORLD } from '../src/content/codex';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { SCENES } from '../src/content/scenes';
import { choose, nextFrame, open, press, snap, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

/** The game with a build bought and fitted, whatever it costs. */
function wearing(base: GameState, build: Build): GameState {
  let game: GameState = { ...base, credits: 9_999_999 };
  const parts = Object.values(build).filter((id): id is string => id !== undefined);
  for (const id of new Set(parts)) while ((game.inventory[id] ?? 0) < parts.filter((other) => other === id).length) game = buy(game, id, CATALOG);
  for (let pass = 0; pass < 2; pass++) {
    for (const slot of BUILD_SLOTS) {
      const id = build[slot];
      try {
        if (id === undefined && game.build[slot] !== undefined) game = equip(game, slot, null, CATALOG);
        else if (id !== undefined && game.build[slot] !== id) game = equip(game, slot, id, CATALOG);
      } catch { /* the next pass */ }
    }
  }
  return { ...game, credits: base.credits };
}
/** A pilot late in the war with a build of every class saved, in the order of the classes; every page read. */
function hangar(extra: Partial<GameState> = {}): GameState {
  let g = newGame(CATALOG, STARTER_BUILD, 'VANTA');
  for (const id of ['intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'hadron-2', 'lumen-2', 'undertow-2', 'rival-1', 'choice-lumen', 'lumen-3']) g = completeMission(g, id, MISSIONS);
  ARCHETYPES.forEach((kind, slot) => { g = saveLoadout(wearing(g, ARCHETYPE_BUILDS[kind].late), slot); });
  g = wearing(g, ARCHETYPE_BUILDS.lancer.late);
  return {
    ...g, credits: 4200, xp: 6000, battlesWon: 40, arenaRank: 6, scenes: SCENES.map((scene) => scene.id), codex: WORLD.map((entry) => entry.id),
    lessons: ['momentum', 'rout'], ...extra,
  };
}
async function load(page: Page, save: unknown, url?: string): Promise<void> {
  await page.addInitScript(({ data, settings }) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', data);
    if (!window.localStorage.getItem('ironwage-settings')) window.localStorage.setItem('ironwage-settings', settings);
  }, { data: JSON.stringify(save), settings: JSON.stringify({ ...(save as GameState).settings, fastBattles: true }) });
  await open(page, url);
  await choose(page, 'continue');
  await waitForScreen(page, 'hub');
}
const kept = (page: Page): Promise<GameState> => page.evaluate(() => JSON.parse(window.localStorage.getItem('ironwage-save')!) as GameState);
const settle = async (page: Page, frames = 40): Promise<void> => { for (let i = 0; i < frames; i++) await nextFrame(page); };

test('the garage keeps seven builds, each listed by its class and frame, and the menu of one stands under the list', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, hangar(), '/?seed=7');
  await choose(page, 'garage');
  await waitForScreen(page, 'garage');
  await press(page, 'ArrowRight');
  const rows = (await snap(page)).menu.items;
  expect(rows.map((row) => row.label)).toEqual(['1  Duellist', '2  Sharpshooter', '3  Artillery', '4  Lancer', '5  Bastion', '6  Skirmisher', '7  All-rounder']);
  expect(rows.map((row) => row.note)).toEqual(['Wraith', 'Ronin', 'Colossus', 'Ronin', 'Colossus', 'Wraith', 'Ronin']);
  // The seventh: an all-rounder, shown as the cursor comes to it.
  await press(page, 'ArrowUp');
  expect((await snap(page)).menu.cursor).toBe(6);
  await settle(page);
  await page.screenshot({ path: shot('garage-seven-builds') });
  // Its menu, under the seven rows.
  await press(page, 'Enter');
  expect((await snap(page)).menu.items.map((item) => item.id)).toEqual(['load', 'save', 'clear', 'back']);
  await settle(page, 20);
  await page.screenshot({ path: shot('garage-seven-builds-menu') });
  await choose(page, 'load');
  expect((await kept(page)).build).toEqual(ARCHETYPE_BUILDS.allrounder.late);
  expect(errors).toEqual([]);
});

test('a game kept when there were three places loads with seven, the saved build where it was, and the seventh can be saved to', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // As an older version wrote it: a list of three, the second place filled.
  const base = hangar();
  const old = { ...base, loadouts: [null, ARCHETYPE_BUILDS.bastion.late, null] };
  await load(page, old, '/?seed=7');
  await choose(page, 'garage');
  await waitForScreen(page, 'garage');
  await press(page, 'ArrowRight');
  expect((await snap(page)).menu.items.map((row) => row.label)).toEqual(['1  Empty', '2  Bastion', '3  Empty', '4  Empty', '5  Empty', '6  Empty', '7  Empty']);
  await settle(page);
  await page.screenshot({ path: shot('garage-kept-three') });
  await press(page, 'ArrowUp');
  await press(page, 'Enter');
  await choose(page, 'save');
  const after = await kept(page);
  expect(after.loadouts).toHaveLength(7);
  expect(after.loadouts[1]).toEqual(ARCHETYPE_BUILDS.bastion.late);
  expect(after.loadouts[6]).toEqual(ARCHETYPE_BUILDS.lancer.late);
  expect((await snap(page)).menu.items[6]).toMatchObject({ label: '7  Lancer', note: 'Ronin' });
  expect(errors).toEqual([]);
});

test('seven saved builds in Dutch, with a part of one sold', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = hangar();
  await load(page, { ...base, inventory: { ...base.inventory, 'wpn-longbow': 0 }, settings: { ...base.settings, language: 'nl' } }, '/?seed=7');
  await choose(page, 'garage');
  await waitForScreen(page, 'garage');
  await press(page, 'ArrowRight');
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  expect((await snap(page)).menu.items[0]).toMatchObject({ id: 'load', enabled: false });
  await settle(page);
  await page.screenshot({ path: shot('nl-garage-seven-builds') });
  expect(errors).toEqual([]);
});
