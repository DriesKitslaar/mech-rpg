import { expect, test, type Page } from '@playwright/test';
import { generateBoard } from '../src/core/board';
import { completeMission } from '../src/core/campaign';
import { BUILD_SLOTS, buy, equip, newGame, type GameState } from '../src/core/game';
import type { Build } from '../src/core/types';
import { ARCHETYPE_BUILDS } from '../src/content/archetypeBuilds';
import { BOARD_TEXT } from '../src/content/board';
import { WORLD } from '../src/content/codex';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { SCENES } from '../src/content/scenes';
import { snap, type Snap } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

/**
 * The launch a contract flown from the hangar opens with. The game is opened with its clock stopped
 * (?step=1) and stepped by hand, so that each moment of it can be looked at.
 */

const STORY = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1'];

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
/** A pilot through the first act, every page read, in this build and paint. */
function pilot(build: Build, extra: Partial<GameState> = {}): GameState {
  let g = newGame(CATALOG, STARTER_BUILD, 'VANTA');
  for (const id of STORY) g = completeMission(g, id, MISSIONS);
  g = wearing(g, build);
  return { ...g, credits: 9000, battlesWon: 20, scenes: SCENES.map((scene) => scene.id), codex: WORLD.map((entry) => entry.id), lessons: ['momentum', 'rout'], ...extra };
}

type Launch = { ms: number; stage: string; lamps: number } | null;
type Seen = Snap & { list?: string; busy?: boolean; launch?: Launch };
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
  }, { kept: JSON.stringify(save), options: JSON.stringify({ ...save.settings, sfx: false, music: false, fastBattles: false, ...settings }) });
  await page.goto('/?seed=7&step=1');
  await page.waitForFunction(() => (window as any).__game?.snapshot().screen === 'title');
  await adv(page, 600);
  return errors;
}
/** Down a list to a row and into it. */
async function pick(page: Page, id: string): Promise<void> {
  for (let i = 0; i < 80; i++) {
    const s = await snap(page) as Seen;
    if (s.menu.items[s.menu.cursor]?.id === id) { await tap(page, 'Enter'); return; }
    await tap(page, 'ArrowDown');
  }
  throw new Error(`no row ${id}`);
}
/** From the title to a contract's briefing, with its words written out. */
async function brief(page: Page, missionId: string): Promise<void> {
  for (let i = 0; i < 300; i++) {
    const s = await snap(page) as Seen;
    if (s.screen === 'briefing') { await adv(page, 6000); return; }
    if (s.busy) await adv(page, 96);
    else if (s.screen === 'title') { await pick(page, 'continue'); await adv(page, 160); }
    else if (s.screen === 'hub' && (!s.list || s.list === 'main')) { await pick(page, 'contracts'); await adv(page, 160); }
    else if (s.screen === 'hub') { await pick(page, missionId); await adv(page, 160); }
    else { await tap(page, 'Enter'); await adv(page, 320); }
  }
  throw new Error(`never came to the briefing of ${missionId}`);
}
const launch = async (page: Page): Promise<Launch> => (await snap(page) as Seen).launch ?? null;
/** Steps the clock until the launch is so far in, in steps no longer than a frame. */
async function until(page: Page, ms: number): Promise<void> {
  for (let i = 0; i < 400; i++) {
    const now = await launch(page);
    if (!now || now.ms >= ms) return;
    await adv(page, Math.min(16, ms - now.ms));
  }
}

test('a contract from the board opens with the launch: the lamps in turn, the catapult, the machine away into the light, and the battle out of it', async ({ page }) => {
  test.setTimeout(180_000);
  const game = pilot(ARCHETYPE_BUILDS.marksman.late, { paint: 'crimson' });
  const [first] = generateBoard(game.battlesWon, game.cycle, BOARD_TEXT);
  const errors = await open(page, game);
  await brief(page, first.id);
  await pick(page, 'accept');
  // The battle is the screen, and it has not begun: the launch is on it, from its first moment.
  let s = await snap(page) as Seen;
  expect(s.screen).toBe('battle');
  expect(s.battle).toMatchObject({ phase: 'launch', round: 1 });
  expect(s.launch).toMatchObject({ stage: 'ready', lamps: 0 });
  // Behind the doors still, a moment in.
  await until(page, 120);
  await page.screenshot({ path: shot('launch-doors') });
  await until(page, 360);
  expect(await launch(page)).toMatchObject({ stage: 'ready', lamps: 2 });
  await page.screenshot({ path: shot('launch-ready') });
  await until(page, 640);
  expect(await launch(page)).toMatchObject({ stage: 'ready', lamps: 3 });
  await page.screenshot({ path: shot('launch-lamps') });
  await until(page, 800);
  expect(await launch(page)).toMatchObject({ stage: 'go', lamps: 3 });
  await page.screenshot({ path: shot('launch-go') });
  await until(page, 1000);
  await page.screenshot({ path: shot('launch-going') });
  await until(page, 1200);
  await page.screenshot({ path: shot('launch-far') });
  await until(page, 1400);
  await page.screenshot({ path: shot('launch-bloom') });
  // Nothing of the battle has moved in all that time.
  s = await snap(page) as Seen;
  expect(s.battle).toMatchObject({ phase: 'launch', round: 1 });
  // Then it is over, and the battle opens out of the light with its banner.
  await until(page, 5000);
  await adv(page, 48);
  s = await snap(page) as Seen;
  expect(s.launch).toBeNull();
  expect(s.battle!.phase).not.toBe('launch');
  expect((s.battle as unknown as { banner: boolean }).banner).toBe(true);
  await page.screenshot({ path: shot('launch-out') });
  await adv(page, 400);
  await page.screenshot({ path: shot('launch-banner') });
  expect(errors).toEqual([]);
});

test('a press cuts it short, and does nothing else: the banner is still to come', async ({ page }) => {
  test.setTimeout(180_000);
  const game = pilot(ARCHETYPE_BUILDS.bastion.late);
  const [first] = generateBoard(game.battlesWon, game.cycle, BOARD_TEXT);
  const errors = await open(page, game);
  await brief(page, first.id);
  await pick(page, 'accept');
  await until(page, 400);
  expect(await launch(page)).toMatchObject({ stage: 'ready' });
  await page.screenshot({ path: shot('launch-bastion') });
  await page.keyboard.press('Enter');
  await adv(page, 32);
  const s = await snap(page) as Seen;
  expect(s.launch).toBeNull();
  expect((s.battle as unknown as { banner: boolean }).banner).toBe(true);
  await page.screenshot({ path: shot('launch-cut') });
  expect(errors).toEqual([]);
});

test('in Dutch and in a calm picture: the words fit, nothing shakes, and it goes to the battle through dark', async ({ page }) => {
  test.setTimeout(180_000);
  const base = pilot(ARCHETYPE_BUILDS.duellist.late, { paint: 'bone' });
  const game = { ...base, settings: { ...base.settings, language: 'nl' as const } };
  const [first] = generateBoard(game.battlesWon, game.cycle, BOARD_TEXT);
  const errors = await open(page, game, { language: 'nl', calm: true });
  await brief(page, first.id);
  await pick(page, 'accept');
  await until(page, 640);
  await page.screenshot({ path: shot('launch-nl-lamps') });
  await until(page, 820);
  await page.screenshot({ path: shot('launch-nl-go') });
  await until(page, 1420);
  await page.screenshot({ path: shot('launch-nl-dark') });
  expect(errors).toEqual([]);
});

test('with faster battles on there is no launch, and the arena has none either', async ({ page }) => {
  test.setTimeout(180_000);
  const game = pilot(ARCHETYPE_BUILDS.allrounder.late, { arenaRank: 2 });
  const [first] = generateBoard(game.battlesWon, game.cycle, BOARD_TEXT);
  const errors = await open(page, game, { fastBattles: true });
  await brief(page, first.id);
  await pick(page, 'accept');
  const s = await snap(page) as Seen;
  expect(s.screen).toBe('battle');
  expect(s.launch).toBeNull();
  expect(s.battle!.phase).not.toBe('launch');
  expect(errors).toEqual([]);
});
