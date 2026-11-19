import { expect, test, type Page } from '@playwright/test';
import type { Archetype } from '../src/core/archetype';
import { generateBoard } from '../src/core/board';
import { completeMission } from '../src/core/campaign';
import { BUILD_SLOTS, buy, equip, newGame, type GameState } from '../src/core/game';
import { awardMedals } from '../src/core/medals';
import { xpForLevel } from '../src/core/pilot';
import { stripePoints, stripesHeld } from '../src/core/stripes';
import type { Build } from '../src/core/types';
import { ARCHETYPE_BUILDS } from '../src/content/archetypeBuilds';
import { BOARD_TEXT } from '../src/content/board';
import { WORLD } from '../src/content/codex';
import { MEDALS } from '../src/content/medals';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { SCENES } from '../src/content/scenes';
import { snap, type Snap } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

/**
 * Stripes: what was won as each class, on the pilot's pages and as one is earned. The game is opened
 * with its clock stopped (?step=1) and stepped by hand.
 */

const STORY = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1'];

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
/** A pilot through the first act, every page read, in this build, with this much won as each class. */
function pilot(build: Build, won: Partial<{ [kind in Archetype]: number }>, extra: Partial<GameState> = {}): GameState {
  let g = newGame(CATALOG, STARTER_BUILD, 'VANTA');
  for (const id of STORY) g = completeMission(g, id, MISSIONS);
  g = wearing(g, build);
  // With the medals its record has earned already, so that opening it announces nothing.
  return awardMedals({
    ...g, credits: 9000, battlesWon: 30, xp: xpForLevel(6), scenes: SCENES.map((scene) => scene.id), codex: WORLD.map((entry) => entry.id),
    lessons: ['momentum', 'rout'], wonAs: won as GameState['wonAs'], ...extra,
  }, MEDALS).game;
}

type Seen = Snap & { list?: string; busy?: boolean; page?: string; launch?: unknown; pilot?: { level: number; points: number }; toast?: string | null; toasts?: string[] };
const adv = (page: Page, ms: number): Promise<void> => page.evaluate((n) => (window as any).__game.advance(n), ms);
async function tap(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await adv(page, 48);
}
async function open(page: Page, save: GameState, settings: Record<string, unknown> = {}): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(({ kept, options }) => {
    if (!window.localStorage.getItem('ironwage-save')) {
      window.localStorage.setItem('ironwage-save', kept);
      window.localStorage.setItem('ironwage-settings', options);
    }
  }, { kept: JSON.stringify(save), options: JSON.stringify({ ...save.settings, sfx: false, music: false, fastBattles: true, ...settings }) });
  await page.goto('/?seed=7&step=1');
  await page.waitForFunction(() => (window as any).__game?.snapshot().screen === 'title');
  await adv(page, 600);
  return errors;
}
async function pick(page: Page, id: string): Promise<void> {
  for (let i = 0; i < 80; i++) {
    const s = await snap(page) as Seen;
    if (s.menu.items[s.menu.cursor]?.id === id) { await tap(page, 'Enter'); await adv(page, 160); return; }
    await tap(page, 'ArrowDown');
  }
  const s = await snap(page) as Seen;
  throw new Error(`no row ${id} on ${s.screen}/${s.list}: ${s.menu.items.map((item) => item.id).join(' ')}`);
}
async function into(page: Page, room: string): Promise<void> {
  for (let i = 0; i < 200; i++) {
    const s = await snap(page) as Seen;
    if (s.screen === room) { await adv(page, 400); return; }
    if (s.busy) await adv(page, 96);
    else if (s.screen === 'title') await pick(page, 'continue');
    else if (s.screen === 'hub' && (!s.list || s.list === 'main')) await pick(page, room);
    else { await tap(page, 'Enter'); await adv(page, 320); }
  }
  throw new Error(`never came into ${room}`);
}
async function toPage(page: Page, name: string): Promise<void> {
  for (let i = 0; i < 6 && (await snap(page) as Seen).page !== name; i++) { await tap(page, 'e'); await adv(page, 200); }
  expect((await snap(page) as Seen).page).toBe(name);
  await adv(page, 400);
}
const kept = (page: Page): Promise<GameState> => page.evaluate(() => JSON.parse(window.localStorage.getItem('ironwage-save')!) as GameState);

/** A record of every kind: nothing, a first stripe, a second, all three, and counts just short of the next. */
const RECORD = { duellist: 2, marksman: 3, artillery: 9, lancer: 15, bastion: 7, skirmisher: 0, allrounder: 22 };

test('the classes page shows each class\'s stripes, how many are held and what the next point asks; the perks page has the point', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await open(page, pilot(ARCHETYPE_BUILDS.bastion.late, RECORD));
  await into(page, 'pilot');
  // Ten stripes in all: two points, beside the five the levels have brought.
  expect((await snap(page) as Seen).pilot).toEqual({ level: 6, points: 7 });
  await page.screenshot({ path: shot('stripes-perks') });
  await toPage(page, 'classes');
  await page.screenshot({ path: shot('stripes-classes') });
  // Down to the lancer, who has given all three, and to the skirmisher, who has given none.
  for (let i = 0; i < 3; i++) await tap(page, 'ArrowDown');
  await adv(page, 300);
  await page.screenshot({ path: shot('stripes-classes-all-three') });
  expect(errors).toEqual([]);
});

test('and in Dutch: the same pages, with nothing run over anything', async ({ page }) => {
  test.setTimeout(120_000);
  const base = pilot(ARCHETYPE_BUILDS.marksman.late, { ...RECORD, marksman: 8, skirmisher: 15, duellist: 15, bastion: 15, artillery: 15 });
  const errors = await open(page, { ...base, settings: { ...base.settings, language: 'nl' } }, { language: 'nl' });
  await into(page, 'pilot');
  await page.screenshot({ path: shot('stripes-perks-nl') });
  await toPage(page, 'classes');
  await tap(page, 'ArrowDown');
  await adv(page, 300);
  await page.screenshot({ path: shot('stripes-classes-nl') });
  expect(errors).toEqual([]);
});

test('a contract won as a class earns its stripe: the notice says which, and that the fifth one held brought a point', async ({ page }) => {
  test.setTimeout(240_000);
  // Four stripes held; two contracts won as a bastion, and the next is flown as one.
  const game = pilot(ARCHETYPE_BUILDS.bastion.late, { marksman: 3, artillery: 3, lancer: 8, bastion: 2 });
  expect(stripesHeld(game)).toBe(4);
  const [first] = generateBoard(game.battlesWon, game.cycle, BOARD_TEXT);
  const errors = await open(page, game);
  // From the title into the contract, once the hangar has said what a loaded game has to say, and flown on
  // Auto Turn to the bill: the notice comes where there is room for it.
  let flown = false;
  let seen: string | null = null;
  for (let i = 0; i < 3000 && seen === null; i++) {
    const s = await snap(page) as Seen;
    if (flown && s.toast) { seen = s.toast; break; }
    if (s.busy) await adv(page, 96);
    else if (!flown && s.screen === 'hub' && (s.toast || s.toasts?.length)) await adv(page, 120);
    else if (flown && (s.screen === 'settlement' || s.screen === 'hub')) await adv(page, 120);
    else if (s.screen === 'title') await pick(page, 'continue');
    else if (s.screen === 'hub' && (!s.list || s.list === 'main')) await pick(page, 'contracts');
    else if (s.screen === 'hub') await pick(page, first.id);
    else if (s.screen === 'briefing') { await pick(page, 'accept'); flown = true; }
    else if (s.screen === 'battle' && s.battle?.phase === 'action') await pick(page, 'auto');
    else if (s.screen === 'battle' && (s.battle?.phase === 'talk' || s.battle?.phase === 'result')) { await tap(page, 'Enter'); await adv(page, 160); }
    else if (s.screen === 'battle') await adv(page, 160);
    else { await tap(page, 'Enter'); await adv(page, 320); }
  }
  // The first thing said after the win: the bastion's first stripe. The medal for it was had long ago.
  expect(seen).toBe('stripe:bastion:1');
  await adv(page, 600);
  await page.screenshot({ path: shot('stripes-earned') });
  const after = await kept(page);
  expect(after.wonAs).toMatchObject({ bastion: 3 });
  expect(stripesHeld(after)).toBe(5);
  expect(stripePoints(after)).toBe(1);
  expect(errors).toEqual([]);
});

/** From the title to a contract's briefing, written out and its odds counted, with the cursor on the row of the build. */
async function onBuild(page: Page, missionId: string): Promise<void> {
  for (let i = 0; i < 300; i++) {
    const s = await snap(page) as Seen;
    if (s.screen === 'briefing') break;
    if (s.busy) await adv(page, 96);
    else if (s.screen === 'title') await pick(page, 'continue');
    else if (s.screen === 'hub' && (!s.list || s.list === 'main')) await pick(page, 'contracts');
    else if (s.screen === 'hub') await pick(page, missionId);
    else { await tap(page, 'Enter'); await adv(page, 320); }
  }
  expect((await snap(page) as Seen).screen).toBe('briefing');
  await adv(page, 6000);
  for (let i = 0; i < 6 && (await snap(page) as Seen).menu.items[(await snap(page) as Seen).menu.cursor]?.id !== 'build'; i++) await tap(page, 'ArrowDown');
  const s = await snap(page) as Seen;
  expect(s.menu.items[s.menu.cursor]?.id).toBe('build');
  await adv(page, 3000);
}
const nearOf = async (page: Page): Promise<unknown> => ((await snap(page)) as unknown as { briefing: { stripe: unknown } }).briefing.stripe;

test('the briefing says of the build a contract will be flown in how near its class is to its next stripe, and follows the build that is turned to', async ({ page }) => {
  test.setTimeout(120_000);
  // Flown as a bastion, with two won of the three a first stripe asks; a skirmisher's build is saved, with nine won of fifteen.
  const light = ARCHETYPE_BUILDS.skirmisher.late;
  const owner = wearing(pilot(light, { bastion: 2, skirmisher: 9, lancer: 15 }), ARCHETYPE_BUILDS.bastion.late);
  const game = { ...owner, loadouts: owner.loadouts.map((_, i) => (i === 0 ? light : null)) };
  const [first] = generateBoard(game.battlesWon, game.cycle, BOARD_TEXT);
  const errors = await open(page, game);
  await onBuild(page, first.id);
  expect(await nearOf(page)).toEqual({ kind: 'bastion', held: 0, won: 2, next: 3 });
  await page.screenshot({ path: shot('stripes-briefing') });
  await tap(page, 'ArrowRight');
  await adv(page, 3000);
  expect(await nearOf(page)).toEqual({ kind: 'skirmisher', held: 2, won: 9, next: 15 });
  await page.screenshot({ path: shot('stripes-briefing-saved') });
  expect(errors).toEqual([]);
});

test('and in Dutch', async ({ page }) => {
  test.setTimeout(120_000);
  const base = pilot(ARCHETYPE_BUILDS.marksman.late, { marksman: 14, duellist: 8 });
  const game = { ...base, settings: { ...base.settings, language: 'nl' as const } };
  const [first] = generateBoard(game.battlesWon, game.cycle, BOARD_TEXT);
  const errors = await open(page, game, { language: 'nl' });
  await onBuild(page, first.id);
  expect(await nearOf(page)).toEqual({ kind: 'marksman', held: 2, won: 14, next: 15 });
  await page.screenshot({ path: shot('stripes-briefing-nl') });
  expect(errors).toEqual([]);
});
