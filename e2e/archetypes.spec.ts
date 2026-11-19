import { expect, test, type Page } from '@playwright/test';
import { completeMission } from '../src/core/campaign';
import { buy, equip, newGame, type GameState } from '../src/core/game';
import type { Build } from '../src/core/types';
import { ARCHETYPE_BUILDS } from '../src/content/archetypeBuilds';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { REFERENCE_BUILDS } from '../src/content/referenceBuilds';
import { SCENES } from '../src/content/scenes';
import { STARTERS } from '../src/content/starters';
import { acceptContract, choose, enterHub, finishMission, nextFrame, oddsCounted, open, press, snap, waitForPhase, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

type Lot = { id: string; callsign: string; slot: number; credits: number; figures: [string, string][] };
const lot = async (page: Page): Promise<Lot> => (await snap(page) as unknown as { starter: Lot }).starter;

/** From the title to the lot: a new game, the callsign on offer. */
async function toLot(page: Page): Promise<void> {
  await choose(page, 'new');
  await waitForScreen(page, 'callsign');
  await press(page, 'Enter');
  await waitForScreen(page, 'starter');
  // The screen has come in once a few frames have passed.
  for (let i = 0; i < 30; i++) await nextFrame(page);
}

test('a new pilot is shown the three frames there are to start in, each drawn as it is looked at', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await toLot(page);
  const pictures: Buffer[] = [];
  for (const starter of STARTERS) {
    expect(await lot(page)).toMatchObject({ id: starter.id, credits: starter.credits, callsign: 'PILOT', slot: 0 });
    pictures.push(await page.screenshot({ path: shot(`starter-${starter.id}`) }));
    await press(page, 'ArrowDown');
    for (let i = 0; i < 6; i++) await nextFrame(page);
  }
  // Round again to the first; each of the three is a picture of its own.
  expect((await lot(page)).id).toBe('hauler');
  expect(pictures[0].equals(pictures[1])).toBe(false);
  expect(pictures[1].equals(pictures[2])).toBe(false);
  expect(pictures[0].equals(pictures[2])).toBe(false);
  // Nothing is kept until a frame is taken, and B is the way back to the name.
  expect(await page.evaluate(() => window.localStorage.getItem('ironwage-save'))).toBeNull();
  await press(page, 'Escape');
  await waitForScreen(page, 'callsign');
  expect(await page.evaluate(() => window.localStorage.getItem('ironwage-save'))).toBeNull();
  expect(errors).toEqual([]);
});

test('a new game in the Courier: it is the pilot\'s frame in the hub and the garage, it wins the first contract, and the other two frames are in the shop', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const courier = STARTERS[1];
  await open(page);
  await toLot(page);
  await press(page, 'ArrowDown');
  expect((await lot(page)).id).toBe('courier');
  await press(page, 'Enter');
  await enterHub(page);
  let s = await snap(page);
  expect(s.build).toEqual(courier.build);
  expect(s.credits).toBe(courier.credits);
  expect(s.inventory).toEqual(Object.fromEntries(Object.values(courier.build).map((part) => [part, 1])));

  await choose(page, 'garage');
  await waitForScreen(page, 'garage');
  await page.screenshot({ path: shot('starter-courier-garage') });
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');

  // Every part of the two frames that were left on the lot can be bought from the first visit.
  await choose(page, 'shop');
  await waitForScreen(page, 'shop');
  const shelf = async (): Promise<string[]> => (await snap(page)).menu.items.map((item) => item.id);
  const seen = new Set<string>();
  for (let tab = 0; tab < 12; tab++) {
    for (const id of await shelf()) seen.add(id);
    await press(page, 'KeyE');
  }
  for (const other of [STARTERS[0], STARTERS[2]]) {
    for (const slot of ['head', 'core', 'arms', 'legs'] as const) expect([...seen], other.build[slot]).toContain(other.build[slot]);
  }
  expect([...seen]).toContain('shd-plate');
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');

  await acceptContract(page, 'intro-1');
  await page.screenshot({ path: shot('starter-courier-battle') });
  await finishMission(page);
  s = await snap(page);
  expect(s.settlement).toMatchObject({ won: true });
  expect(errors).toEqual([]);
});

test('in Dutch the lot is in Dutch', async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem('ironwage-settings')) {
      window.localStorage.setItem('ironwage-settings', JSON.stringify({ sfx: true, music: true, fastBattles: false, difficulty: 'standard', language: 'nl' }));
    }
  });
  await open(page);
  await toLot(page);
  await press(page, 'ArrowDown');
  await press(page, 'ArrowDown');
  for (let i = 0; i < 6; i++) await nextFrame(page);
  const s = await snap(page);
  expect((await lot(page)).id).toBe('dozer');
  // What each frame is, is said in Dutch; its name is a name.
  expect(s.menu.items.map((item) => item.label)).toEqual(STARTERS.map((starter) => starter.name));
  expect(s.menu.items.map((item) => item.note)).toEqual(['Het werkpaard', 'De renner', 'De muur']);
  await page.screenshot({ path: 'docs/screenshots/nl-starter-dozer.png' });
});

// ---- The end of the game: two duels, and the frames they open.

const STORY = [
  'intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1',
  'choice-lumen', 'lumen-3', 'lumen-4', 'lumen-5', 'finale-lumen', 'audit-1', 'audit-2', 'audit-3', 'verdict-enforce',
];
/** A pilot who has finished the story and learnt from it, in the build given: every page read, every lesson told. */
function finished(build: Build, extra: Partial<GameState> = {}): GameState {
  let g = newGame(CATALOG, STARTER_BUILD, 'VANTA');
  for (const id of STORY) g = completeMission(g, id, MISSIONS);
  g = { ...g, credits: 999999 };
  for (const [slot, id] of Object.entries(build) as [string, string][]) {
    if (!g.inventory[id]) g = buy(g, id, CATALOG);
    g = equip(g, slot as keyof GameState['build'], id, CATALOG);
  }
  return {
    ...g, credits: 60000, xp: 4000, perks: { marksman: 2, plating: 2, capacitor: 1, heatsinks: 1 }, arenaRank: 6, battlesWon: 40, endingSeen: true,
    scenes: SCENES.map((s) => s.id), lessons: ['momentum', 'rout'], ...extra,
  };
}
/**
 * Opens the game on a kept one, with battles played faster and not hurried: a hurried battle says nothing, and
 * these are battles in which somebody has something to say.
 */
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
/** Flies the battle with the game's own Auto Turn, reading whatever is said on the way, to its result. */
async function autoBattle(page: Page): Promise<string> {
  for (let i = 0; i < 6000; i++) {
    const s = await snap(page);
    if (s.screen !== 'battle' || s.battle?.phase === 'result') return s.battle?.outcome ?? '';
    if (s.battle?.spoken) await press(page, 'Enter');
    else if (s.battle?.phase === 'action') await choose(page, 'auto');
    else await nextFrame(page);
  }
  throw new Error('the battle did not end');
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
/** Every part the shop has on any of its shelves. */
async function onTheShelves(page: Page): Promise<string[]> {
  const seen = new Set<string>();
  for (let tab = 0; tab < 12; tab++) {
    for (const item of (await snap(page)).menu.items) seen.add(item.id);
    await press(page, 'KeyE');
  }
  return [...seen];
}
const WRAITH = REFERENCE_BUILDS.tier5;
const INSIDE = { generator: 'gen-tidal', booster: 'bst-phase', fcs: 'fcs-surgeon', module: 'mod-oracle', rightHand: 'wpn-void-rifle', leftHand: 'wpn-arc-blade' };

test('once the audit is over a duel is posted: a Shrike on a roof at dusk, and whoever beats it may buy one', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, finished(WRAITH));
  // Nothing of the Circuit is for sale yet.
  await choose(page, 'shop');
  await waitForScreen(page, 'shop');
  expect((await onTheShelves(page)).filter((id) => /-(shrike|sterling)$/.test(id))).toEqual([]);
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');

  await choose(page, 'contracts');
  const offered = (await snap(page)).menu.items.map((item) => item.id);
  expect(offered).toContain('duel-1');
  expect(offered).not.toContain('duel-2');
  await choose(page, 'duel-1');
  await waitForScreen(page, 'briefing');
  for (let i = 0; i < 40 && (await snap(page) as unknown as { typing?: boolean }).typing; i++) await page.waitForTimeout(100);
  await oddsCounted(page);
  for (let i = 0; i < 4; i++) await nextFrame(page);
  await page.screenshot({ path: shot('duel-briefing') });
  await choose(page, 'accept');
  // Larder has a word to say as it opens.
  await page.waitForFunction(() => (window as any).__game.snapshot().battle?.spoken);
  expect((await snap(page)).battle?.spoken).toContain('Larder');
  // The shutter opens on the roof and the line is written out before the picture is taken.
  for (let i = 0; i < 150; i++) await nextFrame(page);
  await page.screenshot({ path: shot('duel-shrike-word') });
  await toAction(page);
  expect((await snap(page)).battle?.enemies).toEqual(['larder']);
  await page.screenshot({ path: shot('duel-shrike') });
  expect(await autoBattle(page)).toBe('victory');
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  expect((await snap(page)).settlement).toMatchObject({ won: true });
  // The settlement has come in once the wipe that brings it has gone by.
  for (let i = 0; i < 90; i++) await nextFrame(page);
  await page.screenshot({ path: shot('duel-settlement') });
  await press(page, 'Enter');
  await enterHub(page);
  // The duel is won for good: it has its rank, the Shrike is on the shelf, the Sterling is not, and the next duel is posted.
  const game = await kept(page);
  expect(Object.keys(game.ranks)).toContain('duel-1');
  await choose(page, 'shop');
  await waitForScreen(page, 'shop');
  const shelves = await onTheShelves(page);
  expect(shelves.filter((id) => /-shrike$/.test(id)).sort()).toEqual(['arms-shrike', 'core-shrike', 'head-shrike', 'legs-shrike']);
  expect(shelves.filter((id) => /-sterling$/.test(id))).toEqual([]);
  // The arms, with what only they do written under their figures.
  for (let tab = 0; tab < 12 && !(await snap(page)).menu.items.some((item) => item.id === 'arms-shrike'); tab++) await press(page, 'KeyE');
  for (let i = 0; i < 20 && (await snap(page)).menu.items[(await snap(page)).menu.cursor]?.id !== 'arms-shrike'; i++) await press(page, 'ArrowDown');
  await page.screenshot({ path: shot('shop-shrike') });
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  await choose(page, 'contracts');
  expect((await snap(page)).menu.items.map((item) => item.id)).toContain('duel-2');
  expect(errors).toEqual([]);
});

test('the second duel: the first sword in a Sterling, in the empty clearing house, and its frame for whoever beats it', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const won = finished(WRAITH, { ranks: { 'duel-1': 'A' } } as Partial<GameState>);
  await load(page, { ...won, completed: [...won.completed, 'duel-1'] });
  await choose(page, 'contracts');
  await choose(page, 'duel-2');
  await waitForScreen(page, 'briefing');
  await choose(page, 'accept');
  await page.waitForFunction(() => (window as any).__game.snapshot().battle?.spoken);
  expect((await snap(page)).battle?.spoken).toContain('Shrike');
  await toAction(page);
  expect((await snap(page)).battle?.enemies).toEqual(['argent']);
  // Taking aim at it shows its field on the target's row.
  await choose(page, 'fire');
  await choose(page, 'rightHand');
  await waitForPhase(page, 'target');
  await page.screenshot({ path: shot('duel-sterling') });
  await press(page, 'Escape');
  await press(page, 'Escape');
  await waitForPhase(page, 'action');
  expect(await autoBattle(page)).toBe('victory');
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  await press(page, 'Enter');
  await enterHub(page);
  expect(Object.keys((await kept(page)).ranks)).toEqual(expect.arrayContaining(['duel-1', 'duel-2']));
  await choose(page, 'shop');
  await waitForScreen(page, 'shop');
  const shelves = await onTheShelves(page);
  expect(shelves.filter((id) => /-(shrike|sterling)$/.test(id))).toHaveLength(8);
  for (let tab = 0; tab < 12 && !(await snap(page)).menu.items.some((item) => item.id === 'core-sterling'); tab++) await press(page, 'KeyE');
  for (let i = 0; i < 20 && (await snap(page)).menu.items[(await snap(page)).menu.cursor]?.id !== 'core-sterling'; i++) await press(page, 'ArrowDown');
  await page.screenshot({ path: shot('shop-sterling') });
  expect(errors).toEqual([]);
});

test('the two frames as their owner has them: in the garage, and in a battle behind a field of their own', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const owner = finished({ head: 'head-sterling', core: 'core-sterling', arms: 'arms-shrike', legs: 'legs-sterling', ...INSIDE }, { ranks: { 'duel-1': 'A', 'duel-2': 'A' } } as Partial<GameState>);
  await load(page, { ...owner, completed: [...owner.completed, 'duel-1', 'duel-2'] });
  await choose(page, 'garage');
  await waitForScreen(page, 'garage');
  // The garage has come in once the wipe that brings it has gone by.
  for (let i = 0; i < 90; i++) await nextFrame(page);
  await page.screenshot({ path: shot('garage-sterling') });
  await choose(page, 'core');
  await page.screenshot({ path: shot('garage-sterling-core') });
  await press(page, 'Escape');
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  await acceptContract(page, 'patrol');
  await page.screenshot({ path: shot('battle-sterling') });
  // A Sterling's core with a Shrike's arms: it boosts in, strikes with its blade, and is still boosting behind its field.
  await choose(page, 'boost');
  await choose(page, 'fire');
  await choose(page, 'leftHand');
  await press(page, 'Enter');
  await waitForPhase(page, 'action');
  await page.screenshot({ path: shot('battle-sterling-struck') });
  expect(errors).toEqual([]);
});

/** A pilot after the first act, in the Hauler, with a blade in the locker: every page read, every lesson told. */
function afterFirstAct(extra: Partial<GameState> = {}): GameState {
  let g = newGame(CATALOG, STARTER_BUILD, 'VANTA');
  for (const id of ['intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1']) g = completeMission(g, id, MISSIONS);
  return {
    ...g, credits: 7200, inventory: { ...g.inventory, 'wpn-arc-blade': 1 }, scenes: SCENES.map((scene) => scene.id), lessons: ['momentum', 'rout'],
    // Six contracts won so far, as two kinds; the medals a first win and a clean one earn are already held.
    wonAs: { duellist: 4, bastion: 2 }, stats: { ...g.stats, contracts: 6, flawless: 1 }, medals: ['first-contract', 'first-flawless'], ...extra,
  };
}
type Classes = { flown: string; kind: string; advice: { build: Build; toBuy: string[]; cost: number; unsold: string[] } };
const classes = async (page: Page): Promise<Classes> => (await snap(page) as unknown as { classes: Classes }).classes;
const garageKind = async (page: Page): Promise<string> => (await snap(page) as unknown as { garage: { kind: string; candidate: string | null } }).garage.kind;

test('the kinds of machine: the garage names the one on the floor, the pilot\'s screen lists the seven with one to build now, and a third kind won as earns a medal', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, afterFirstAct());
  // The garage: a Hauler with a rifle is an all-rounder, and says so along the top.
  await choose(page, 'garage');
  await waitForScreen(page, 'garage');
  for (let i = 0; i < 90; i++) await nextFrame(page);
  expect(await garageKind(page)).toBe('allrounder');
  await page.screenshot({ path: shot('garage-class') });
  // With the cursor on the blade in the locker it is a duellist already, before the blade is fitted.
  await choose(page, 'leftHand');
  for (let i = 0; i < 6; i++) {
    const { garage } = await snap(page) as unknown as { garage: { candidate: string | null } };
    if (garage.candidate === 'wpn-arc-blade') break;
    await press(page, 'ArrowDown');
  }
  expect(await garageKind(page)).toBe('duellist');
  await page.screenshot({ path: shot('garage-class-change') });
  await press(page, 'Escape');
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  // The pilot's screen: the fourth page is the seven kinds.
  await choose(page, 'pilot');
  await waitForScreen(page, 'pilot');
  for (let i = 0; i < 3; i++) await press(page, 'KeyE');
  expect((await snap(page) as unknown as { page: string }).page).toBe('classes');
  for (let i = 0; i < 60; i++) await nextFrame(page);
  expect((await snap(page)).menu.items.map((item) => [item.id, item.note])).toEqual([
    ['duellist', '4'], ['marksman', '0'], ['artillery', '0'], ['lancer', '0'], ['bastion', '2'], ['skirmisher', '0'], ['allrounder', '0'],
  ]);
  expect(await classes(page)).toMatchObject({ flown: 'allrounder', kind: 'duellist', advice: { build: ARCHETYPE_BUILDS.duellist.early, unsold: [] } });
  await page.screenshot({ path: shot('pilot-classes') });
  for (let i = 0; i < 3; i++) await press(page, 'ArrowDown');
  // The lancer of the first act: nothing of it is beyond what this pilot has to spend.
  const lancer = await classes(page);
  expect(lancer).toMatchObject({ kind: 'lancer', advice: { build: ARCHETYPE_BUILDS.lancer.early, unsold: [] } });
  expect(lancer.advice.cost).toBeLessThanOrEqual(7200);
  await page.screenshot({ path: shot('pilot-classes-lancer') });
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  // A patrol won in the Hauler is one for the all-rounders: the third kind this pilot has won as, and a medal for it.
  await acceptContract(page, 'patrol');
  expect(await autoBattle(page)).toBe('victory');
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  const after = await kept(page);
  expect(after.wonAs).toEqual({ duellist: 4, bastion: 2, allrounder: 1 });
  expect(after.medals).toContain('class-3');
  // It is announced over the settlement, once that has come in.
  await page.waitForFunction(() => (window as any).__game.snapshot().toast === 'class-3');
  await page.waitForTimeout(500);
  await page.screenshot({ path: shot('settlement-class-medal') });
  expect(errors).toEqual([]);
});

test('the kinds of machine in Dutch', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = afterFirstAct();
  await load(page, { ...base, settings: { ...base.settings, language: 'nl' } });
  await choose(page, 'garage');
  await waitForScreen(page, 'garage');
  for (let i = 0; i < 90; i++) await nextFrame(page);
  await page.screenshot({ path: shot('nl-garage-class') });
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  await choose(page, 'pilot');
  await waitForScreen(page, 'pilot');
  for (let i = 0; i < 3; i++) await press(page, 'KeyE');
  for (let i = 0; i < 60; i++) await nextFrame(page);
  expect((await snap(page)).menu.items.map((item) => item.label)).toEqual(['Duellist', 'Scherpschutter', 'Artillerie', 'Lansier', 'Bastion', 'Jager', 'Allrounder']);
  await press(page, 'ArrowDown');
  await page.screenshot({ path: shot('nl-pilot-classes') });
  expect(errors).toEqual([]);
});
