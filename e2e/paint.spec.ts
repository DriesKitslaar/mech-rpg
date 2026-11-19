import { expect, test, type Page } from '@playwright/test';
import { generateBoard } from '../src/core/board';
import { completeMission } from '../src/core/campaign';
import { BUILD_SLOTS, buy, equip, newGame, type GameState } from '../src/core/game';
import { awardMedals } from '../src/core/medals';
import { DEFAULT_MIXES, mixId, setMix, type Mix } from '../src/core/mix';
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
 * A paint of the pilot's own mixing: the three as they come, worn in the garage, in the hangar, in
 * a battle and in the launch. The game is opened with its clock stopped (?step=1) and stepped by hand.
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
/** A pilot through the first act, every page read, in this build and this mix, with nothing left to announce. */
function pilot(build: Build, mix: Mix, extra: Partial<GameState> = {}): GameState {
  let g = newGame(CATALOG, STARTER_BUILD, 'VANTA');
  for (const id of STORY) g = completeMission(g, id, MISSIONS);
  g = setMix(wearing(g, build), mix);
  return awardMedals({
    ...g, credits: 9000, battlesWon: 20, scenes: SCENES.map((scene) => scene.id), codex: WORLD.map((entry) => entry.id), lessons: ['momentum', 'rout'], ...extra,
  }, MEDALS).game;
}

type Seen = Snap & { list?: string; busy?: boolean; launch?: { ms: number } | null; toasts?: string[] };
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
async function pick(page: Page, id: string): Promise<void> {
  for (let i = 0; i < 80; i++) {
    const s = await snap(page) as Seen;
    if (s.menu.items[s.menu.cursor]?.id === id) { await tap(page, 'Enter'); await adv(page, 160); return; }
    await tap(page, 'ArrowDown');
  }
  throw new Error(`no row ${id}`);
}
/** From the title to the hangar, with whatever a loaded game has to announce said and gone. */
async function hangar(page: Page): Promise<void> {
  for (let i = 0; i < 300; i++) {
    const s = await snap(page) as Seen;
    if (s.screen === 'hub' && !s.toast && !(s.toasts?.length)) { await adv(page, 400); return; }
    if (s.busy || s.screen === 'hub') await adv(page, 120);
    else if (s.screen === 'title') await pick(page, 'continue');
    else { await tap(page, 'Enter'); await adv(page, 320); }
  }
  throw new Error('never came into the hangar');
}
const kept = (page: Page): Promise<GameState> => page.evaluate(() => JSON.parse(window.localStorage.getItem('ironwage-save')!) as GameState);

test('the three mixes as they come: a white machine with cyan lights, a black one with red, navy with gold', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await open(page, pilot(ARCHETYPE_BUILDS.marksman.late, DEFAULT_MIXES[0]));
  await hangar(page);
  await page.screenshot({ path: shot('paint-hangar-white') });
  await pick(page, 'garage');
  await adv(page, 600);
  expect((await kept(page)).paint).toBe(mixId(DEFAULT_MIXES[0]));
  await page.screenshot({ path: shot('paint-mix-1') });
  // R1 goes on to the second and the third, and then round to the factory's colours.
  await tap(page, 'e');
  await adv(page, 400);
  expect((await kept(page)).paint).toBe(mixId(DEFAULT_MIXES[1]));
  await page.screenshot({ path: shot('paint-mix-2') });
  await tap(page, 'e');
  await adv(page, 400);
  expect((await kept(page)).paint).toBe(mixId(DEFAULT_MIXES[2]));
  await page.screenshot({ path: shot('paint-mix-3') });
  await tap(page, 'e');
  await adv(page, 400);
  expect((await kept(page)).paint).toBe('factory');
  // Going through them kept none of them changed.
  expect((await kept(page)).mixes).toEqual(DEFAULT_MIXES.map(mixId));
  expect(errors).toEqual([]);
});

test('a white machine leaves the catapult and is seen from behind in the fight', async ({ page }) => {
  test.setTimeout(180_000);
  const game = pilot(ARCHETYPE_BUILDS.skirmisher.late, DEFAULT_MIXES[0]);
  const [first] = generateBoard(game.battlesWon, game.cycle, BOARD_TEXT);
  const errors = await open(page, game);
  await hangar(page);
  await pick(page, 'contracts');
  await pick(page, first.id);
  await adv(page, 6000);
  await pick(page, 'accept');
  // The launch, with its lamps on; and then the fight from behind.
  for (let i = 0; i < 200 && ((await snap(page) as Seen).launch?.ms ?? 9999) < 600; i++) await adv(page, 16);
  await page.screenshot({ path: shot('paint-launch-white') });
  for (let i = 0; i < 400 && (await snap(page) as Seen).launch; i++) await adv(page, 16);
  for (let i = 0; i < 400 && (await snap(page) as Seen).battle?.phase !== 'action'; i++) {
    const s = await snap(page) as Seen;
    if (s.battle?.phase === 'talk') { await tap(page, 'Enter'); await adv(page, 160); } else await adv(page, 96);
  }
  await adv(page, 400);
  await page.screenshot({ path: shot('paint-battle-white') });
  expect(errors).toEqual([]);
});

type Garage = { mode: string; paint: string; mix: Mix | null };
const garage = async (page: Page): Promise<Garage> => ((await snap(page)) as unknown as { garage: Garage }).garage;

test('the page of paint: a mix is set a step at a time and the machine changes with every press', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await open(page, pilot(ARCHETYPE_BUILDS.lancer.late, DEFAULT_MIXES[0]));
  await hangar(page);
  await pick(page, 'garage');
  await adv(page, 400);
  // Left of the parts is the page of paint.
  await tap(page, 'ArrowLeft');
  await adv(page, 300);
  expect(await garage(page)).toMatchObject({ mode: 'paint', mix: DEFAULT_MIXES[0] });
  await page.screenshot({ path: shot('paint-page') });
  // Down to the armour's colour, and round the wheel to a red; then a vivid finish and gold trim.
  await tap(page, 'ArrowDown');
  for (let i = 0; i < 10; i++) await tap(page, 'e');
  await tap(page, 'ArrowDown');
  for (let i = 0; i < 3; i++) await tap(page, 'e');
  await tap(page, 'ArrowDown');
  for (let i = 0; i < 2; i++) await tap(page, 'e');
  await tap(page, 'ArrowDown');
  for (let i = 0; i < 14; i++) await tap(page, 'e');
  await adv(page, 400);
  const made = (await garage(page)).mix!;
  expect(made).toEqual({ slot: 1, hue: 0, finish: 3, shade: 2, trim: 3, glow: 2 });
  await page.screenshot({ path: shot('paint-page-mixed') });
  // It is kept as it was left, in its place, and worn.
  const game = await kept(page);
  expect(game.paint).toBe(mixId(made));
  expect(game.mixes).toEqual([mixId(made), mixId(DEFAULT_MIXES[1]), mixId(DEFAULT_MIXES[2])]);
  // A ready paint: the five rows are dim, and the page says how to come by a mix.
  for (let i = 0; i < 4; i++) await tap(page, 'ArrowUp');
  await tap(page, 'q');
  await adv(page, 400);
  expect(await garage(page)).toMatchObject({ mode: 'paint', mix: null });
  await page.screenshot({ path: shot('paint-page-ready') });
  // Out of the garage and in again: the hangar shows the machine in what it wears.
  await tap(page, 'e');
  await adv(page, 300);
  await tap(page, 'Escape');
  await tap(page, 'Escape');
  await adv(page, 600);
  expect((await snap(page)).screen).toBe('hub');
  await page.screenshot({ path: shot('paint-hangar-mixed') });
  expect(errors).toEqual([]);
});

test('the page of paint in Dutch', async ({ page }) => {
  test.setTimeout(120_000);
  const base = pilot(ARCHETYPE_BUILDS.bastion.late, { slot: 2, hue: 20, finish: 2, shade: 3, trim: 12, glow: 1 });
  const errors = await open(page, { ...base, settings: { ...base.settings, language: 'nl' } }, { language: 'nl' });
  await hangar(page);
  await pick(page, 'garage');
  await adv(page, 400);
  await tap(page, 'ArrowLeft');
  for (let i = 0; i < 3; i++) await tap(page, 'ArrowDown');
  await adv(page, 400);
  expect(await garage(page)).toMatchObject({ mode: 'paint' });
  await page.screenshot({ path: shot('paint-page-nl') });
  expect(errors).toEqual([]);
});
