import { expect, test, type Page } from '@playwright/test';
import { completeMission } from '../src/core/campaign';
import { buy, equip, newGame, type GameState } from '../src/core/game';
import type { Build, Weapon } from '../src/core/types';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { SCENES } from '../src/content/scenes';
import { choose, enterHub, nextFrame, oddsCounted, open, press, snap, waitForPhase, waitForScreen, type Snap } from './helpers';

/**
 * The two frames of the yard's works pilots, in a browser: each duel as it is flown, each frame on the shelf with
 * what its core does written under it, and each as its owner flies it, in both languages.
 */
const shot = (name: string) => `docs/screenshots/${name}.png`;

const STORY = [
  'intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1',
  'choice-lumen', 'lumen-3', 'lumen-4', 'lumen-5', 'finale-lumen', 'audit-1', 'audit-2', 'audit-3', 'verdict-enforce',
];
/** A pilot who has finished the story and won these duels, in the build given: every page read, every lesson told. */
function finished(build: Build, duels: string[], language: 'en' | 'nl' = 'en'): GameState {
  let g = newGame(CATALOG, STARTER_BUILD, 'VANTA');
  for (const id of [...STORY, ...duels]) g = completeMission(g, id, MISSIONS);
  g = { ...g, credits: 999999 };
  for (const [slot, id] of Object.entries(build) as [string, string][]) {
    if (!g.inventory[id]) g = buy(g, id, CATALOG);
    g = equip(g, slot as keyof GameState['build'], id, CATALOG);
  }
  return {
    ...g, credits: 60000, xp: 4000, perks: { marksman: 2, plating: 2, capacitor: 1, heatsinks: 1 }, arenaRank: 6, battlesWon: 40, endingSeen: true,
    scenes: SCENES.map((s) => s.id), lessons: ['momentum', 'rout'], ranks: { ...g.ranks, ...Object.fromEntries(duels.map((id) => [id, 'A'])) },
    // A machine that takes a few turns to bring down has been met, so it can be fought on the range.
    met: [...new Set([...g.met, 'juggernaut'])],
    settings: { ...g.settings, language },
  };
}
/** Opens the game on a kept one, with battles played faster and not hurried: these are battles in which somebody has something to say. */
async function load(page: Page, save: GameState): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(({ data, settings }) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', data);
    if (!window.localStorage.getItem('ironwage-settings')) window.localStorage.setItem('ironwage-settings', settings);
  }, { data: JSON.stringify(save), settings: JSON.stringify({ ...save.settings, fastBattles: true }) });
  await open(page, '/?seed=7');
  await choose(page, 'continue');
  await waitForScreen(page, 'hub');
  return errors;
}
const kept = (page: Page): Promise<GameState> => page.evaluate(() => JSON.parse(window.localStorage.getItem('ironwage-save')!) as GameState);

type Fought = {
  phase: string; outcome: string; round: number; message: string; enemies: string[]; spoken: string | null; ground: string | null;
  intent: string; words: string[]; enemyHeat: number; enemyKept: number; enemyMark: string | null;
};
type Seen = { battle: Fought; player: { energy: number; heat: number }; menu: Snap['menu']; screen: string };
const seen = async (page: Page): Promise<Seen> => (await snap(page)) as unknown as Seen;
const still = async (page: Page, frames = 12): Promise<void> => { for (let i = 0; i < frames; i++) await nextFrame(page); };

/** Reads past whatever is being said over a battle, until the pilot may act or the battle is over. */
async function toAction(page: Page): Promise<Seen> {
  for (let i = 0; i < 8000; i++) {
    const s = await seen(page);
    if (s.screen !== 'battle' || s.battle.phase === 'action' || s.battle.phase === 'result') return s;
    if (s.battle.spoken) await press(page, 'Enter');
    else await nextFrame(page);
  }
  throw new Error('the pilot never got to act');
}
/** One turn flown by the game's own Auto Turn, to the pilot's next choice. */
async function autoTurn(page: Page): Promise<Seen> {
  await choose(page, 'auto');
  await still(page, 2);
  return toAction(page);
}
/** Flies the rest of the battle with Auto Turn, to its result. */
async function autoBattle(page: Page): Promise<string> {
  for (let i = 0; i < 400; i++) {
    const s = await toAction(page);
    if (s.screen !== 'battle' || s.battle.phase === 'result') return s.battle?.outcome ?? '';
    await autoTurn(page);
  }
  throw new Error('the battle did not end');
}
/** What the machine being aimed at is about to do, read by taking aim with the first weapon and letting go again. */
async function intentOfFoe(page: Page, picture?: string): Promise<string> {
  await choose(page, 'fire');
  await waitForPhase(page, 'weapon');
  await press(page, 'Enter');
  await waitForPhase(page, 'target');
  await still(page, 6);
  const intent = (await seen(page)).battle.intent;
  if (picture) await page.screenshot({ path: shot(picture) });
  await press(page, 'Escape');
  await press(page, 'Escape');
  await waitForPhase(page, 'action');
  return intent;
}
/** Every part the shop has on any of its shelves. */
async function onTheShelves(page: Page): Promise<string[]> {
  const found = new Set<string>();
  for (let tab = 0; tab < 12; tab++) {
    for (const item of (await snap(page)).menu.items) found.add(item.id);
    await press(page, 'KeyE');
  }
  return [...found];
}
/** In the shop: to the shelf that has the part, and the cursor on it. */
async function toPart(page: Page, id: string): Promise<void> {
  for (let tab = 0; tab < 12 && !(await snap(page)).menu.items.some((item) => item.id === id); tab++) await press(page, 'KeyE');
  for (let i = 0; i < 30; i++) {
    const s = await snap(page);
    if (s.menu.items[s.menu.cursor]?.id === id) break;
    await press(page, 'ArrowDown');
  }
  expect((await snap(page)).menu.items[(await snap(page)).menu.cursor]?.id).toBe(id);
  await still(page, 6);
}
/** From the hub to a fight on the range against one Juggernaut, which no volley brings down at once, as far as the pilot's first turn. */
async function range(page: Page): Promise<Seen> {
  await choose(page, 'training');
  await waitForScreen(page, 'training');
  await press(page, 'KeyE');
  for (let i = 0; i < 60; i++) {
    const s = await snap(page);
    if (s.menu.items[s.menu.cursor]?.id === 'juggernaut') break;
    await press(page, 'ArrowDown');
  }
  await press(page, 'Enter');
  await waitForScreen(page, 'briefing');
  await choose(page, 'accept');
  await waitForScreen(page, 'battle');
  const s = await toAction(page);
  expect(s.battle).toMatchObject({ phase: 'action', enemies: ['juggernaut'] });
  return s;
}
const works = (ids: string[]): string[] => ids.filter((id) => /-(sirocco|solstice)$/.test(id)).sort();

/** What staggers both works pilots: a Colossus with a gavel and a howler. The game's own pilot wins both duels in it. */
const HAMMER: Build = {
  head: 'head-colossus', core: 'core-colossus', arms: 'arms-colossus', legs: 'legs-colossus', generator: 'gen-singularity', booster: 'bst-stock',
  fcs: 'fcs-omni', module: 'mod-aegis', rightHand: 'wpn-gavel', shoulder: 'wpn-howler',
};
const QUICK = { generator: 'gen-tidal', booster: 'bst-phase', fcs: 'fcs-surgeon', module: 'mod-oracle' };
const SIROCCO: Build = {
  head: 'head-sirocco', core: 'core-sirocco', arms: 'arms-sirocco', legs: 'legs-sirocco', ...QUICK,
  rightHand: 'wpn-plasma', leftHand: 'wpn-slagcaster', shoulder: 'wpn-crucible',
};
const SOLSTICE: Build = {
  head: 'head-solstice', core: 'core-solstice', arms: 'arms-solstice', legs: 'legs-solstice', ...QUICK,
  rightHand: 'wpn-void-rifle', leftHand: 'wpn-arc-blade',
};

test('once the first sword has fallen the yard sends a works pilot: a Sirocco in the foundry, hotter every round, and its frame for whoever beats it', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await load(page, finished(HAMMER, ['duel-1', 'duel-2']));
  // Nothing of the yard's is for sale yet.
  await choose(page, 'shop');
  await waitForScreen(page, 'shop');
  expect(works(await onTheShelves(page))).toEqual([]);
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');

  await choose(page, 'contracts');
  const offered = (await snap(page)).menu.items.map((item) => item.id);
  expect(offered).toContain('duel-3');
  expect(offered).not.toContain('duel-4');
  await choose(page, 'duel-3');
  await waitForScreen(page, 'briefing');
  for (let i = 0; i < 40 && (await snap(page) as unknown as { typing?: boolean }).typing; i++) await page.waitForTimeout(100);
  await oddsCounted(page);
  await still(page, 4);
  await page.screenshot({ path: shot('works-kiln-briefing') });
  await choose(page, 'accept');
  // Kiln has a word to say as it opens.
  await page.waitForFunction(() => (window as any).__game.snapshot().battle?.spoken);
  expect((await seen(page)).battle.spoken).toContain('Kiln');
  await still(page, 150);
  await page.screenshot({ path: shot('works-kiln-word') });
  let s = await toAction(page);
  expect(s.battle).toMatchObject({ enemies: ['kiln'], ground: 'furnace' });
  await page.screenshot({ path: shot('works-kiln') });
  // It starts cold. Left alone for two rounds it is hot, and hotter than any other machine could be without losing a turn.
  const heats = [s.battle.enemyHeat];
  for (let round = 0; round < 3 && s.battle.phase === 'action'; round++) {
    await choose(page, 'endTurn');
    await still(page, 2);
    s = await toAction(page);
    heats.push(s.battle.enemyHeat);
  }
  expect(heats[0]).toBeLessThan(45);
  expect(Math.max(...heats)).toBeGreaterThan(70);
  expect(s.battle.phase).toBe('action');
  await page.screenshot({ path: shot('works-kiln-hot') });
  expect(await autoBattle(page)).toBe('victory');
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  expect((await snap(page)).settlement).toMatchObject({ won: true });
  await still(page, 90);
  await page.screenshot({ path: shot('works-kiln-settlement') });
  await press(page, 'Enter');
  await enterHub(page);
  // The duel is won for good: it has its rank, the Sirocco is on the shelf, the Solstice is not, and the last duel is posted.
  expect(Object.keys((await kept(page)).ranks)).toContain('duel-3');
  await choose(page, 'shop');
  await waitForScreen(page, 'shop');
  expect(works(await onTheShelves(page))).toEqual(['arms-sirocco', 'core-sirocco', 'head-sirocco', 'legs-sirocco']);
  // The core, with what only it does written under its figures.
  await toPart(page, 'core-sirocco');
  await page.screenshot({ path: shot('shop-sirocco') });
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  await choose(page, 'contracts');
  expect((await snap(page)).menu.items.map((item) => item.id)).toContain('duel-4');
  expect(errors).toEqual([]);
});

test('the last duel: a Solstice on the plaza that holds a round and fires the next with what it kept; its next move is read, and the medal is for both', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await load(page, finished(HAMMER, ['duel-1', 'duel-2', 'duel-3']));
  await choose(page, 'contracts');
  await choose(page, 'duel-4');
  await waitForScreen(page, 'briefing');
  for (let i = 0; i < 40 && (await snap(page) as unknown as { typing?: boolean }).typing; i++) await page.waitForTimeout(100);
  await oddsCounted(page);
  await still(page, 4);
  await page.screenshot({ path: shot('works-vesper-briefing') });
  await choose(page, 'accept');
  await page.waitForFunction(() => (window as any).__game.snapshot().battle?.spoken);
  expect((await seen(page)).battle.spoken).toContain('Vesper');
  let s = await toAction(page);
  expect(s.battle).toMatchObject({ enemies: ['vesper'], ground: 'clear', round: 1 });
  // The Solstice is the quicker: it has held already, and its core has kept half a turn for the shot it lines up next.
  expect(s.battle.enemyKept).toBeGreaterThan(100);
  // And it is written over the machine, before anything is aimed at it: that much is coming with its next shot.
  expect(s.battle.enemyMark).toBe(`+${s.battle.enemyKept} EN`);
  await still(page, 6);
  await page.screenshot({ path: shot('works-vesper-kept') });
  const first = await intentOfFoe(page, 'works-vesper-aims');
  expect(first).toMatch(/^AIMS/);
  // Auto Turn braces before anything else: the brace is the first thing the bar says of the turn.
  await choose(page, 'auto');
  await page.waitForFunction(() => /brace/i.test((window as any).__game.snapshot().battle?.message ?? ''), undefined, { timeout: 15_000 });
  s = await toAction(page);
  // It has fired: nothing is kept, and what it does next is hold.
  expect(s.battle.round).toBe(2);
  expect(s.battle.enemyKept).toBe(0);
  expect(s.battle.enemyMark ?? '').not.toMatch(/ EN$/);
  expect(await intentOfFoe(page, 'works-vesper-holds')).toBe('HOLDS');
  expect(await autoBattle(page)).toBe('victory');
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  await press(page, 'Enter');
  await enterHub(page);
  const game = await kept(page);
  expect(Object.keys(game.ranks)).toEqual(expect.arrayContaining(['duel-3', 'duel-4']));
  expect(game.medals).toContain('works');
  await choose(page, 'shop');
  await waitForScreen(page, 'shop');
  expect(works(await onTheShelves(page))).toHaveLength(8);
  await toPart(page, 'core-solstice');
  await page.screenshot({ path: shot('shop-solstice') });
  expect(errors).toEqual([]);
});

test('a Sirocco as its owner flies it: past a hundred on the heat bar and still firing', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await load(page, finished(SIROCCO, ['duel-1', 'duel-2', 'duel-3']));
  await choose(page, 'garage');
  await waitForScreen(page, 'garage');
  await still(page, 90);
  await page.screenshot({ path: shot('garage-sirocco') });
  await choose(page, 'core');
  await still(page, 6);
  await page.screenshot({ path: shot('garage-sirocco-core') });
  await press(page, 'Escape');
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  let s = await range(page);
  const heatOf = (slot: keyof Build): number => (CATALOG[SIROCCO[slot]!] as Weapon).heat;
  // Every weapon that does not take it past its own limit is fired, turn after turn, until it is past a hundred.
  let fired = 0;
  for (let turn = 0; turn < 6 && s.player.heat <= 100 && s.battle.phase === 'action'; turn++) {
    for (const slot of ['rightHand', 'leftHand', 'shoulder'] as const) {
      s = await seen(page);
      if (s.battle.phase !== 'action' || s.player.heat + heatOf(slot) > 130) continue;
      // With nothing left that the turn's energy can fire, the menu does not offer to.
      if (!s.menu.items.find((item) => item.id === 'fire')?.enabled) break;
      await choose(page, 'fire');
      await waitForPhase(page, 'weapon');
      const row = (await snap(page)).menu.items.find((item) => item.id === slot);
      if (!row?.enabled) { await press(page, 'Escape'); await waitForPhase(page, 'action'); continue; }
      await choose(page, slot);
      await waitForPhase(page, 'target');
      await press(page, 'Enter');
      fired += 1;
      s = await toAction(page);
      if (s.player.heat > 100) break;
    }
    if (s.player.heat > 100 || s.battle.phase !== 'action') break;
    await choose(page, 'endTurn');
    await still(page, 2);
    s = await toAction(page);
  }
  expect(fired).toBeGreaterThan(2);
  expect(s.player.heat).toBeGreaterThan(100);
  expect(s.player.heat).toBeLessThanOrEqual(130);
  // Past a hundred is not past its limit: the turn is still the pilot's, and nothing was said of overheating.
  expect(s.battle.phase).toBe('action');
  expect(s.battle.message).not.toMatch(/overheat/i);
  await still(page, 30);
  await page.screenshot({ path: shot('battle-sirocco-hot') });
  expect(errors).toEqual([]);
});

test('a Solstice as its owner flies it: what a turn did not spend is there on top of the next', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await load(page, finished(SOLSTICE, ['duel-1', 'duel-2', 'duel-3', 'duel-4']));
  await choose(page, 'garage');
  await waitForScreen(page, 'garage');
  await still(page, 90);
  await page.screenshot({ path: shot('garage-solstice') });
  await choose(page, 'core');
  await still(page, 6);
  await page.screenshot({ path: shot('garage-solstice-core') });
  await press(page, 'Escape');
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  let s = await range(page);
  const turn = s.player.energy;
  // The rifle is fired once and the turn is ended with the rest unspent.
  await choose(page, 'fire');
  await waitForPhase(page, 'weapon');
  await choose(page, 'rightHand');
  await waitForPhase(page, 'target');
  await press(page, 'Enter');
  s = await toAction(page);
  expect(s.battle.phase).toBe('action');
  const left = s.player.energy;
  expect(left).toBeLessThan(turn);
  expect(left).toBeGreaterThan(0);
  await choose(page, 'endTurn');
  // What was kept is said over the machine as the next turn opens: the picture is taken while it is there.
  let word = '';
  for (let i = 0; i < 6000; i++) {
    const now = await seen(page);
    const said = now.battle.words.find((text) => /^\+\d+ EN$/.test(text));
    if (said && !word) {
      word = said;
      await nextFrame(page);
      await page.screenshot({ path: shot('battle-solstice-kept') });
    }
    if (now.battle.spoken) await press(page, 'Enter');
    else if (now.battle.phase === 'result' || (now.battle.phase === 'action' && now.battle.round >= 2)) break;
    else await nextFrame(page);
  }
  s = await seen(page);
  expect(s.battle).toMatchObject({ phase: 'action', round: 2 });
  // Half a turn is the most the core holds.
  const keptNow = Math.min(left, Math.floor(turn / 2));
  expect(word).toBe(`+${keptNow} EN`);
  expect(s.player.energy).toBe(turn + keptNow);
  await page.screenshot({ path: shot('battle-solstice-turn') });
  expect(errors).toEqual([]);
});

test('in Dutch: the briefing of the last duel, what its machine is about to do, and the line of each core in the shop', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await load(page, finished(HAMMER, ['duel-1', 'duel-2', 'duel-3'], 'nl'));
  await choose(page, 'contracts');
  await choose(page, 'duel-4');
  await waitForScreen(page, 'briefing');
  for (let i = 0; i < 40 && (await snap(page) as unknown as { typing?: boolean }).typing; i++) await page.waitForTimeout(100);
  await oddsCounted(page);
  await still(page, 4);
  await page.screenshot({ path: shot('nl-works-vesper-briefing') });
  await choose(page, 'accept');
  await page.waitForFunction(() => (window as any).__game.snapshot().battle?.spoken);
  let s = await toAction(page);
  expect(s.battle.enemies).toEqual(['vesper']);
  expect(s.battle.enemyMark).toBe(`+${s.battle.enemyKept} EN`);
  await autoTurn(page);
  s = await seen(page);
  expect(s.battle.round).toBe(2);
  expect(await intentOfFoe(page, 'nl-works-vesper-holds')).toBe('WACHT');
  expect(await autoBattle(page)).toBe('victory');
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  await press(page, 'Enter');
  await enterHub(page);
  await choose(page, 'shop');
  await waitForScreen(page, 'shop');
  await toPart(page, 'core-sirocco');
  await page.screenshot({ path: shot('nl-shop-sirocco') });
  await toPart(page, 'core-solstice');
  await page.screenshot({ path: shot('nl-shop-solstice') });
  expect(errors).toEqual([]);
});
