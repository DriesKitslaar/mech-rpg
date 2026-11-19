import { expect, test, type Page } from '@playwright/test';
import { completeMission } from '../src/core/campaign';
import { BUILD_SLOTS, buy, equip, newGame, saveLoadout, type GameState } from '../src/core/game';
import type { Build } from '../src/core/types';
import { ARCHETYPE_BUILDS } from '../src/content/archetypeBuilds';
import { WORLD } from '../src/content/codex';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { SCENES } from '../src/content/scenes';
import { choose, nextFrame, oddsCounted, open, press, snap, waitForScreen } from './helpers';

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
const BASTION = ARCHETYPE_BUILDS.bastion.war;
const SHARP = ARCHETYPE_BUILDS.marksman.war;
/** A pilot at the war who flies a sharpshooter and has a bastion saved: every page read, every lesson told. */
function pilot(extra: Partial<GameState> = {}): GameState {
  let g = newGame(CATALOG, STARTER_BUILD, 'VANTA');
  for (const id of ['intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'hadron-2', 'lumen-2', 'undertow-2', 'rival-1', 'choice-lumen', 'lumen-3']) g = completeMission(g, id, MISSIONS);
  g = saveLoadout(wearing(g, BASTION), 0);
  g = wearing(g, SHARP);
  return {
    ...g, credits: 4200, xp: 1500, battlesWon: 20, arenaRank: 3, scenes: SCENES.map((scene) => scene.id), codex: WORLD.map((entry) => entry.id),
    lessons: ['momentum', 'rout'], ...extra,
  };
}
async function load(page: Page, save: GameState, url?: string): Promise<void> {
  await page.addInitScript(({ data, settings }) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', data);
    if (!window.localStorage.getItem('ironwage-settings')) window.localStorage.setItem('ironwage-settings', settings);
  }, { data: JSON.stringify(save), settings: JSON.stringify({ ...save.settings, fastBattles: true }) });
  await open(page, url);
  await choose(page, 'continue');
  await waitForScreen(page, 'hub');
}
const kept = (page: Page): Promise<GameState> => page.evaluate(() => JSON.parse(window.localStorage.getItem('ironwage-save')!) as GameState);
type Range = { kind: string; count: number; limit: number };
const range = async (page: Page): Promise<Range | null> => (await snap(page) as unknown as { range: Range | null }).range;
/** Down to a row of the list on screen, by its id. */
async function toRow(page: Page, id: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const s = await snap(page);
    if (s.menu.items[s.menu.cursor]?.id === id) return;
    await press(page, 'ArrowDown');
  }
  throw new Error(`no row ${id}`);
}
const settle = async (page: Page, frames = 40): Promise<void> => { for (let i = 0; i < frames; i++) await nextFrame(page); };

test('the range: the simulator\'s second page lists the machines met, and a fight on it is briefed like a contract, with the build row and the odds', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, pilot(), '/?seed=7');
  await choose(page, 'training');
  await waitForScreen(page, 'training');
  expect((await snap(page)).page).toBe('drills');
  await settle(page);
  await page.screenshot({ path: shot('training-drills') });
  // R1 turns to the range: every machine this pilot has met, one of each to begin with.
  await press(page, 'KeyE');
  expect((await snap(page)).page).toBe('range');
  const rows = (await snap(page)).menu.items;
  expect(rows.map((item) => item.id)).toEqual(expect.arrayContaining(['recon-drone', 'gun-turret', 'tank', 'heavy-mech', 'rival']));
  expect(rows.filter((item) => !item.id.startsWith('spar-')).every((item) => item.note === 'x1')).toBe(true);
  // The bastion saved first heads the list: a saved build is an opponent too.
  expect(rows[0]).toMatchObject({ id: 'spar-0', label: 'Saved Build 1', note: 'Bastion' });
  await settle(page);
  await page.screenshot({ path: shot('range') });
  // Three turrets: left and right say how many, and they stand beside the list.
  await toRow(page, 'gun-turret');
  await press(page, 'ArrowRight');
  await press(page, 'ArrowRight');
  expect(await range(page)).toEqual({ kind: 'gun-turret', count: 3, limit: 3 });
  await settle(page, 10);
  await page.screenshot({ path: shot('range-three') });
  // One of a mech, whatever is pressed.
  await toRow(page, 'heavy-mech');
  await press(page, 'ArrowRight');
  expect(await range(page)).toEqual({ kind: 'heavy-mech', count: 1, limit: 1 });
  // The briefing: the simulator's word, the build row, and the odds of this build against three turrets.
  await toRow(page, 'gun-turret');
  await press(page, 'Enter');
  await waitForScreen(page, 'briefing');
  for (let i = 0; i < 80 && (await snap(page) as unknown as { typing?: boolean }).typing; i++) await page.waitForTimeout(100);
  await oddsCounted(page);
  await settle(page);
  const briefing = (await snap(page) as unknown as { briefing: { mission: string; reward: number; odds: { played: number; done: boolean } | null; build: { kind: string } } }).briefing;
  expect(briefing).toMatchObject({ mission: 'range-3-gun-turret', reward: 0, odds: { played: 20, done: true }, build: { kind: 'marksman' } });
  expect((await snap(page)).menu.items.map((item) => item.id)).toEqual(['accept', 'build', 'back']);
  await page.screenshot({ path: shot('range-briefing') });
  // B goes back to the range, to the three turrets.
  await press(page, 'Escape');
  await waitForScreen(page, 'training');
  expect(await range(page)).toEqual({ kind: 'gun-turret', count: 3, limit: 3 });
  expect(errors).toEqual([]);
});

test('a fight on the range is fought in the pilot\'s own build and booked nowhere: the bill is shown, and the kept game is as it was', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, pilot());
  const before = await kept(page);
  await choose(page, 'training');
  await waitForScreen(page, 'training');
  await press(page, 'KeyE');
  await toRow(page, 'tank');
  await press(page, 'ArrowRight');
  await press(page, 'Enter');
  await waitForScreen(page, 'briefing');
  await choose(page, 'accept');
  await waitForScreen(page, 'battle');
  expect((await snap(page)).battle).toMatchObject({ mission: 'range-2-tank', enemies: ['tank', 'tank'] });
  for (let i = 0; i < 4000; i++) {
    const s = await snap(page);
    if (s.screen !== 'battle') break;
    if (s.battle?.phase === 'action') await choose(page, 'auto');
    else if (s.battle?.phase === 'result' || s.battle?.spoken) await press(page, 'Enter');
    else await nextFrame(page);
  }
  await waitForScreen(page, 'settlement');
  const bill = (await snap(page)).settlement as unknown as { won: boolean; reward: number; net: number; ammoCost: number; repairCost: number; simulated: boolean };
  expect(bill).toMatchObject({ won: true, reward: 0, simulated: true });
  expect(bill.net).toBe(-(bill.ammoCost + bill.repairCost));
  // The sharpshooter's rail lance has rounds to pay for: the bill is not an empty one.
  expect(bill.ammoCost + bill.repairCost).toBeGreaterThan(0);
  await settle(page, 90);
  await page.screenshot({ path: shot('range-settlement') });
  // Nothing of it was booked.
  expect(await kept(page)).toEqual(before);
  // A on the bill goes back to the range, to what was fought.
  await press(page, 'Enter');
  await waitForScreen(page, 'training');
  expect(await range(page)).toEqual({ kind: 'tank', count: 2, limit: 3 });
  expect(await kept(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test('the range in Dutch', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = pilot();
  await load(page, { ...base, settings: { ...base.settings, language: 'nl' } }, '/?seed=7');
  await choose(page, 'training');
  await waitForScreen(page, 'training');
  await press(page, 'KeyE');
  await toRow(page, 'tank');
  await press(page, 'ArrowRight');
  await settle(page);
  await page.screenshot({ path: shot('nl-range') });
  await press(page, 'Enter');
  await waitForScreen(page, 'briefing');
  for (let i = 0; i < 80 && (await snap(page) as unknown as { typing?: boolean }).typing; i++) await page.waitForTimeout(100);
  await oddsCounted(page);
  await settle(page);
  await page.screenshot({ path: shot('nl-range-briefing') });
  expect(errors).toEqual([]);
});

test('sparring: a saved build heads the range, and the simulator flies it against the pilot', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, pilot(), '/?seed=7');
  await choose(page, 'training');
  await waitForScreen(page, 'training');
  await press(page, 'KeyE');
  // The bastion saved first is the first row: the build itself stands beside the list.
  expect(await range(page)).toEqual({ kind: 'spar-0', count: 1, limit: 1 });
  await press(page, 'ArrowRight');
  expect(await range(page)).toEqual({ kind: 'spar-0', count: 1, limit: 1 });
  await settle(page);
  await page.screenshot({ path: shot('range-spar') });
  await press(page, 'Enter');
  await waitForScreen(page, 'briefing');
  for (let i = 0; i < 80 && (await snap(page) as unknown as { typing?: boolean }).typing; i++) await page.waitForTimeout(100);
  await oddsCounted(page);
  await settle(page);
  const briefing = (await snap(page) as unknown as { briefing: { mission: string; reward: number; odds: { played: number; done: boolean } | null } }).briefing;
  expect(briefing).toMatchObject({ mission: 'range-spar-0', reward: 0, odds: { played: 20, done: true } });
  await page.screenshot({ path: shot('range-spar-briefing') });
  // The fight: the sharpshooter on the floor against the bastion, in colours that are not the pilot's.
  await choose(page, 'accept');
  await waitForScreen(page, 'battle');
  expect((await snap(page)).battle).toMatchObject({ mission: 'range-spar-0', enemies: ['spar-0'] });
  for (let i = 0; i < 6000; i++) {
    const s = await snap(page);
    if (s.battle?.phase === 'action') break;
    if (s.battle?.spoken) await press(page, 'Enter');
    else await nextFrame(page);
  }
  await settle(page, 20);
  await page.screenshot({ path: shot('range-spar-battle') });
  expect(errors).toEqual([]);
});
