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
const DUELLIST = ARCHETYPE_BUILDS.duellist.war;
const BASTION = ARCHETYPE_BUILDS.bastion.war;
const SHARP = ARCHETYPE_BUILDS.marksman.war;
/** A pilot at the war who flies a duellist, with a bastion and a sharpshooter saved: every page read, every lesson told. */
function threeBuilds(extra: Partial<GameState> = {}): GameState {
  let g = newGame(CATALOG, STARTER_BUILD, 'VANTA');
  for (const id of ['intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'hadron-2', 'lumen-2', 'undertow-2', 'rival-1', 'choice-lumen', 'lumen-3']) g = completeMission(g, id, MISSIONS);
  g = saveLoadout(wearing(g, BASTION), 0);
  g = saveLoadout(wearing(g, SHARP), 1);
  g = wearing(g, DUELLIST);
  return {
    ...g, credits: 4200, xp: 1500, battlesWon: 20, arenaRank: 3, scenes: SCENES.map((scene) => scene.id), codex: WORLD.map((entry) => entry.id),
    lessons: ['momentum', 'rout'], ...extra,
  };
}
async function load(page: Page, save: GameState): Promise<void> {
  await page.addInitScript(({ data, settings }) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', data);
    if (!window.localStorage.getItem('ironwage-settings')) window.localStorage.setItem('ironwage-settings', settings);
  }, { data: JSON.stringify(save), settings: JSON.stringify({ ...save.settings, fastBattles: true }) });
  await open(page, '/?seed=7');
  await choose(page, 'continue');
  await waitForScreen(page, 'hub');
}
const kept = (page: Page): Promise<GameState> => page.evaluate(() => JSON.parse(window.localStorage.getItem('ironwage-save')!) as GameState);
type Chosen = { slot: number | null; kind: string; choices: number };
const chosen = async (page: Page): Promise<Chosen> => (await snap(page) as unknown as { briefing: { build: Chosen } }).briefing.build;
type Odds = { played: number; won: number; done: boolean };
const odds = async (page: Page): Promise<Odds | null> => (await snap(page) as unknown as { briefing: { odds: Odds | null } }).briefing.odds;
/** Waits until the briefing has written itself out, the wipe that brought it has gone by, and the odds it gives are counted. */
async function written(page: Page): Promise<void> {
  for (let i = 0; i < 80 && (await snap(page) as unknown as { typing?: boolean }).typing; i++) await page.waitForTimeout(100);
  for (let i = 0; i < 60; i++) await nextFrame(page);
  await oddsCounted(page);
}
/** The odds showing, once they are counted: twenty flights, and so many of them won. */
async function counted(page: Page): Promise<number> {
  await oddsCounted(page);
  const o = await odds(page);
  expect(o).toMatchObject({ played: 20, done: true });
  expect(o!.won).toBeGreaterThanOrEqual(0);
  expect(o!.won).toBeLessThanOrEqual(20);
  for (let i = 0; i < 4; i++) await nextFrame(page);
  return o!.won;
}
/** Reads past whatever is being said over a battle, until the pilot may act. A line still being written takes a press to finish and another to go on. */
async function toAction(page: Page): Promise<void> {
  for (let i = 0; i < 6000; i++) {
    const s = await snap(page);
    if (s.battle?.phase === 'action') return;
    if (s.battle?.spoken) await press(page, 'Enter');
    else await nextFrame(page);
  }
  throw new Error('the pilot never got to act');
}
/** Down to a row of the briefing's menu, by its id. */
async function toRow(page: Page, id: string): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const s = await snap(page);
    if (s.menu.items[s.menu.cursor]?.id === id) return;
    await press(page, 'ArrowDown');
  }
  throw new Error(`no row ${id}`);
}

test('the build is chosen at the briefing: the corner says what will be flown, the row turns through the saved builds, and accepting fits the one chosen', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, threeBuilds());
  await choose(page, 'contracts');
  await choose(page, 'lumen-4');
  await waitForScreen(page, 'briefing');
  await written(page);
  expect((await snap(page)).menu.items.map((item) => item.id)).toEqual(['accept', 'build', 'wingman', 'back']);
  expect(await chosen(page)).toEqual({ slot: null, kind: 'duellist', choices: 3 });
  // Under the kind of machine, the odds of this contract in it: the game's own pilot has flown it twenty times.
  const onFloor = await counted(page);
  await page.screenshot({ path: shot('briefing-build') });
  // On the row, the client makes way for the build on the floor, and the odds are there with what they are.
  await toRow(page, 'build');
  for (let i = 0; i < 6; i++) await nextFrame(page);
  await page.screenshot({ path: shot('briefing-build-page') });
  // Right turns to the first saved build, a bastion; right again to the second, a sharpshooter. Each has odds of its own.
  await press(page, 'ArrowRight');
  expect(await chosen(page)).toMatchObject({ slot: 0, kind: 'bastion' });
  const asBastion = await counted(page);
  await page.screenshot({ path: shot('briefing-odds-bastion') });
  await press(page, 'ArrowRight');
  expect(await chosen(page)).toMatchObject({ slot: 1, kind: 'marksman' });
  const asSharp = await counted(page);
  await page.screenshot({ path: shot('briefing-build-saved') });
  // Round to the build on the floor: what was counted for it is shown at once, and it is the same count.
  await press(page, 'ArrowRight');
  expect(await odds(page)).toEqual({ played: 20, won: onFloor, done: true });
  await press(page, 'ArrowLeft');
  expect(await odds(page)).toEqual({ played: 20, won: asSharp, done: true });
  // The three do not fare alike in this one.
  expect(new Set([onFloor, asBastion, asSharp]).size).toBeGreaterThan(1);
  // Nothing is fitted until the contract is accepted.
  expect((await kept(page)).build).toEqual(DUELLIST);
  await toRow(page, 'accept');
  for (let i = 0; i < 6; i++) await nextFrame(page);
  await page.screenshot({ path: shot('briefing-build-chosen') });
  await press(page, 'Enter');
  await waitForScreen(page, 'battle');
  // It is flown in the sharpshooter, and that is the build the game is kept with; the saved builds are as they were.
  const after = await kept(page);
  expect(after.build).toEqual(SHARP);
  expect(after.loadouts).toEqual([BASTION, SHARP, null]);
  await toAction(page);
  await page.screenshot({ path: shot('battle-saved-build') });
  expect(errors).toEqual([]);
});

test('the build row in Dutch, and with nothing saved', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = threeBuilds();
  await load(page, { ...base, loadouts: [null, null, null], settings: { ...base.settings, language: 'nl' } });
  await choose(page, 'contracts');
  await choose(page, 'patrol');
  await waitForScreen(page, 'briefing');
  await written(page);
  expect(await chosen(page)).toEqual({ slot: null, kind: 'duellist', choices: 1 });
  // The patrol is no trouble to a machine of the war.
  expect(await counted(page)).toBeGreaterThanOrEqual(15);
  await toRow(page, 'build');
  await press(page, 'ArrowRight');
  expect(await chosen(page)).toEqual({ slot: null, kind: 'duellist', choices: 1 });
  for (let i = 0; i < 6; i++) await nextFrame(page);
  await page.screenshot({ path: shot('nl-briefing-build') });
  expect(errors).toEqual([]);
});

type Asks = { kind: string; met: boolean; fits: number | null };
const asks = async (page: Page): Promise<Asks | null> => (await snap(page) as unknown as { briefing: { asks: Asks | null } }).briefing.asks;

test('work that asks for a class: a plus on the list, a line in the briefing that lights up for a build of the class', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // After twenty contracts won the board's second contract wants a bastion; this pilot has one saved.
  await load(page, threeBuilds());
  await choose(page, 'contracts');
  const notes = Object.fromEntries((await snap(page)).menu.items.map((item) => [item.id, item.note]));
  expect(notes).toMatchObject({ 'open-0-20-0': '1200', 'open-0-20-1': '2900+', 'open-0-20-2': '2100' });
  await toRow(page, 'open-0-20-1');
  for (let i = 0; i < 6; i++) await nextFrame(page);
  await page.screenshot({ path: shot('contracts-asks') });
  await press(page, 'Enter');
  await waitForScreen(page, 'briefing');
  await written(page);
  // In the duellist on the floor it is a notice: the contract can be flown, and pays what it says. The notice
  // points to the build that would be paid for: the bastion saved first.
  expect(await asks(page)).toEqual({ kind: 'bastion', met: false, fits: 0 });
  await page.screenshot({ path: shot('briefing-asks') });
  // Turned to the bastion saved first, the line is lit; the odds beside it say whether the bastion can do it.
  await toRow(page, 'build');
  await press(page, 'ArrowRight');
  expect(await chosen(page)).toMatchObject({ slot: 0, kind: 'bastion' });
  expect(await asks(page)).toEqual({ kind: 'bastion', met: true, fits: 0 });
  await counted(page);
  await page.screenshot({ path: shot('briefing-asks-met') });
  // The sharpshooter is not what was asked for either.
  await press(page, 'ArrowRight');
  expect(await asks(page)).toEqual({ kind: 'bastion', met: false, fits: 0 });
  expect(errors).toEqual([]);
});

test('won as the class asked for, the contract pays a quarter more, on a row of its own', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const save = threeBuilds();
  // Hurried: this is about the bill, not the fight.
  await page.addInitScript(({ data, settings }) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', data);
    if (!window.localStorage.getItem('ironwage-settings')) window.localStorage.setItem('ironwage-settings', settings);
  }, { data: JSON.stringify(save), settings: JSON.stringify({ ...save.settings, fastBattles: true }) });
  await open(page);
  await choose(page, 'continue');
  await waitForScreen(page, 'hub');
  await choose(page, 'contracts');
  await choose(page, 'open-0-20-1');
  await waitForScreen(page, 'briefing');
  await toRow(page, 'build');
  await press(page, 'ArrowRight');
  expect(await asks(page)).toEqual({ kind: 'bastion', met: true, fits: 0 });
  await toRow(page, 'accept');
  await press(page, 'Enter');
  await waitForScreen(page, 'battle');
  // Auto Turn flies it: every turn, through both engagements.
  for (let i = 0; i < 4000; i++) {
    const s = await snap(page);
    if (s.screen !== 'battle') break;
    if (s.battle?.phase === 'action') await choose(page, 'auto');
    else if (s.battle?.phase === 'result' || s.battle?.spoken) await press(page, 'Enter');
    else await nextFrame(page);
  }
  await waitForScreen(page, 'settlement');
  const bill = (await snap(page)).settlement as unknown as { won: boolean; reward: number; asked: { kind: string; bonus: number } | null };
  expect(bill).toMatchObject({ won: true, reward: 2900, asked: { kind: 'bastion', bonus: 725 } });
  for (let i = 0; i < 90; i++) await nextFrame(page);
  await page.screenshot({ path: shot('settlement-asks') });
  expect((await kept(page)).build).toEqual(BASTION);
  expect(errors).toEqual([]);
});

test('the class wanted, in Dutch', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = threeBuilds();
  await load(page, { ...base, settings: { ...base.settings, language: 'nl' } });
  await choose(page, 'contracts');
  await choose(page, 'open-0-20-1');
  await waitForScreen(page, 'briefing');
  await written(page);
  expect(await asks(page)).toEqual({ kind: 'bastion', met: false, fits: 0 });
  await toRow(page, 'build');
  await press(page, 'ArrowRight');
  expect(await asks(page)).toEqual({ kind: 'bastion', met: true, fits: 0 });
  await counted(page);
  await page.screenshot({ path: shot('nl-briefing-asks') });
  expect(errors).toEqual([]);
});
