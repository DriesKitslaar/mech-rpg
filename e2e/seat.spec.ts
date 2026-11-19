import { expect, test, type Page } from '@playwright/test';
import { ARCHETYPES } from '../src/core/archetype';
import { generateBoard } from '../src/core/board';
import { completeMission } from '../src/core/campaign';
import { BUILD_SLOTS, buy, equip, newGame, type GameState } from '../src/core/game';
import { xpForLevel } from '../src/core/pilot';
import { tunable } from '../src/core/tuning';
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
 * The eighth seat of the arena's masters, and the frame of the one who keeps it. The game is opened
 * with its clock stopped (?step=1) and stepped by hand.
 */

const SOVEREIGN = { head: 'head-sovereign', core: 'core-sovereign', arms: 'arms-sovereign', legs: 'legs-sovereign' };
const STORY = ['hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1', 'choice-lumen', 'lumen-3', 'lumen-4', 'lumen-5', 'finale-lumen', 'audit-1', 'audit-2', 'audit-3', 'verdict-enforce'];

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
/** A pilot who has ended the war and the audit, champion of the ladder; every page read. */
function pilot(build: Build, extra: Partial<GameState> = {}): GameState {
  let g = newGame(CATALOG, STARTER_BUILD, 'VANTA');
  for (const id of ['intro-1', 'intro-2', ...STORY]) g = completeMission(g, id, MISSIONS);
  g = wearing(g, build);
  return {
    ...g, credits: 64000, xp: 9000, battlesWon: 60, arenaRank: 15, scenes: SCENES.map((scene) => scene.id), codex: WORLD.map((entry) => entry.id),
    lessons: ['momentum', 'rout'], endingSeen: true, ...extra,
  };
}
const CROWNED = { masters: [...ARCHETYPES], crowns: [...ARCHETYPES] };

const adv = (page: Page, ms: number): Promise<void> => page.evaluate((n) => (window as any).__game.advance(n), ms);
async function tap(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await adv(page, 48);
}
type Seen = Snap & { list?: string; busy?: boolean };
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
    if (s.menu.items[s.menu.cursor]?.id === id) { await tap(page, 'Enter'); await adv(page, 160); return; }
    await tap(page, 'ArrowDown');
  }
  throw new Error(`no row ${id}`);
}
/** From the title to the hangar, and into one of its rooms. */
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

/** From the title into a contract's first battle, to the first moment the pilot may act. */
async function fly(page: Page, missionId: string): Promise<void> {
  for (let i = 0; i < 400; i++) {
    const s = await snap(page) as Seen;
    if (s.screen === 'battle' && s.battle?.phase === 'action') return;
    if (s.busy) await adv(page, 96);
    else if (s.screen === 'title') await pick(page, 'continue');
    else if (s.screen === 'hub' && (!s.list || s.list === 'main')) await pick(page, 'contracts');
    else if (s.screen === 'hub') await pick(page, missionId);
    else if (s.screen === 'briefing') await pick(page, 'accept');
    else if (s.screen === 'battle' && s.battle?.phase === 'talk') { await tap(page, 'Enter'); await adv(page, 160); }
    else if (s.screen === 'battle') await adv(page, 160);
    else { await tap(page, 'Enter'); await adv(page, 320); }
  }
  throw new Error(`never came to act in ${missionId}`);
}

test('the Sovereign in the garage: in the colours it was built in, and in a paint anyone may wear', async ({ page }) => {
  test.setTimeout(120_000);
  const build = { ...ARCHETYPE_BUILDS.allrounder.late, ...SOVEREIGN, generator: 'gen-singularity' };
  const errors = await open(page, pilot(build, { ...CROWNED, seat: true }));
  await into(page, 'garage');
  await page.screenshot({ path: shot('sovereign-garage') });
  // R1 steps through the paints: the first after the factory's own is crimson, and three on is bone.
  await tap(page, 'e');
  await adv(page, 300);
  await page.screenshot({ path: shot('sovereign-garage-crimson') });
  for (let i = 0; i < 3; i++) await tap(page, 'e');
  await adv(page, 300);
  await page.screenshot({ path: shot('sovereign-garage-bone') });
  expect(errors).toEqual([]);
});

test('the Sovereign on the field: seen from behind, as the pilot\'s own mech is', async ({ page }) => {
  test.setTimeout(120_000);
  const build = { ...ARCHETYPE_BUILDS.allrounder.late, ...SOVEREIGN, generator: 'gen-singularity' };
  const game = pilot(build, { ...CROWNED, seat: true });
  const [first] = generateBoard(game.battlesWon, game.cycle, BOARD_TEXT);
  const errors = await open(page, game);
  await fly(page, first.id);
  await adv(page, 400);
  await page.screenshot({ path: shot('sovereign-field') });
  expect(errors).toEqual([]);
});

// ---- The duel for the seat.

/** A pilot who can be counted on to win: every perk that helps in a fight, the bench's last step on what is worn, the game at its gentlest. */
function strong(build: Build, extra: Partial<GameState> = {}): GameState {
  const base = pilot(build, extra);
  const tuning = Object.fromEntries(Object.values(build).filter((id): id is string => id !== undefined && tunable(CATALOG[id])).map((id) => [id, 5]));
  return {
    // (The perks ask for the level, and the bench's last step for a third telling.)
    ...base, xp: xpForLevel(20), cycle: 3, perks: { marksman: 3, reflexes: 3, capacitor: 3, heatsinks: 3, fieldTech: 2, plating: 3 }, tuning,
    settings: { ...base.settings, difficulty: 'story' }, ...extra,
  };
}
/** In the arena, on its second page, on the row under the seven classes. */
async function toSeat(page: Page): Promise<void> {
  await into(page, 'arena');
  await tap(page, 'e');
  await adv(page, 200);
  for (let i = 0; i < 12; i++) {
    const s = await snap(page) as Seen;
    if (s.menu.items[s.menu.cursor]?.id === 'arena-seat') return;
    await tap(page, 'ArrowDown');
  }
  throw new Error('the seat is not on the page');
}
type Fought = { phase: string; outcome: string; message: string; spoken: string | null };
const fought = async (page: Page): Promise<Fought> => (await snap(page)).battle as unknown as Fought;

test('the eighth seat is on the masters\' page from the start, locked, counting the crowns it asks for', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await open(page, strong(ARCHETYPE_BUILDS.marksman.late, { masters: ['duellist', 'bastion', 'lancer'], crowns: ['duellist', 'bastion'] }));
  await toSeat(page);
  const s = await snap(page) as Seen & { seat: { state: string; crowns: number } };
  expect(s.seat).toEqual({ state: 'locked', crowns: 2 });
  expect(s.menu.items[s.menu.cursor]).toMatchObject({ label: 'The Eighth Seat', enabled: false, note: '2/7' });
  await adv(page, 400);
  await page.screenshot({ path: shot('seat-locked') });
  // A does nothing there.
  await tap(page, 'Enter');
  await adv(page, 300);
  expect((await snap(page)).screen).toBe('arena');
  expect(errors).toEqual([]);
});

test('with seven crowns the seat opens: the briefing, the duel in its three ways, the bill, the row held and the yard\'s shelf', async ({ page }) => {
  test.setTimeout(420_000);
  // (An all-rounder's guns take the keeper's core down a piece at a time: a rail that charges can take it through a change in one shot.)
  const errors = await open(page, strong(ARCHETYPE_BUILDS.allrounder.late, CROWNED));
  await toSeat(page);
  let s = await snap(page) as Seen & { seat: { state: string; crowns: number } };
  expect(s.seat).toEqual({ state: 'open', crowns: 7 });
  expect(s.menu.items[s.menu.cursor]).toMatchObject({ enabled: true, note: '15000' });
  await adv(page, 400);
  await page.screenshot({ path: shot('seat-open') });

  await tap(page, 'Enter');
  await adv(page, 400);
  expect((await snap(page)).screen).toBe('briefing');
  // (When the words have been written out.)
  await adv(page, 6000);
  await page.screenshot({ path: shot('seat-briefing') });
  await pick(page, 'accept');

  // The duel: flown on Auto Turn, and looked at as it begins and at each of the keeper's two changes.
  const seen: string[] = [];
  let entrance = false;
  for (let i = 0; i < 4000; i++) {
    s = await snap(page) as typeof s;
    if (s.screen !== 'battle') break;
    const b = await fought(page);
    if (b.phase === 'result') break;
    if (b.phase === 'talk') {
      const line = b.spoken ?? '';
      const which = line.startsWith('Range is answered') ? 'light' : line.startsWith('Guns down') ? 'blades' : null;
      if (which && !seen.includes(which)) {
        seen.push(which);
        await adv(page, 900);
        await page.screenshot({ path: shot(`seat-duel-${which}-line`) });
        await tap(page, 'Enter');
        await adv(page, 200);
        await tap(page, 'Enter');
        // The machine as it stands a moment after the change, with what it carries now.
        await adv(page, 700);
        await page.screenshot({ path: shot(`seat-duel-${which}`) });
        continue;
      }
      await tap(page, 'Enter');
      await adv(page, 160);
    } else if (b.phase === 'action') {
      if (!seen.includes('range')) {
        seen.push('range');
        await adv(page, 300);
        await page.screenshot({ path: shot('seat-duel-range') });
      }
      await pick(page, 'auto');
    } else {
      if (!entrance && i > 2) { entrance = true; await page.screenshot({ path: shot('seat-duel-entrance') }); }
      await adv(page, 160);
    }
  }
  expect(seen).toEqual(['range', 'light', 'blades']);
  const end = await fought(page);
  expect(end).toMatchObject({ phase: 'result', outcome: 'victory' });
  await adv(page, 1500);
  await page.screenshot({ path: shot('seat-won') });
  await tap(page, 'Enter');
  await adv(page, 900);
  s = await snap(page) as typeof s;
  expect(s.screen).toBe('settlement');
  expect(s.settlement).toMatchObject({ won: true, reward: 15000, seated: true });
  await adv(page, 1500);
  await page.screenshot({ path: shot('seat-settlement') });
  await tap(page, 'Enter');
  await adv(page, 900);

  // Back in the arena the row says the seat is held, and the duel is for a quarter now.
  await toSeat(page);
  s = await snap(page) as typeof s;
  expect(s.seat).toEqual({ state: 'held', crowns: 7 });
  expect(s.menu.items[s.menu.cursor]).toMatchObject({ enabled: true, note: 'SEAT' });
  await adv(page, 2600);
  await page.screenshot({ path: shot('seat-held') });
  await tap(page, 'Escape');
  await adv(page, 400);

  // And the yard's order book is open: the Sovereign is on the shop's shelf.
  await into(page, 'shop');
  s = await snap(page) as typeof s;
  expect(s.menu.items.map((item) => item.id)).toContain('head-sovereign');
  for (let i = 0; i < 40 && (await snap(page)).menu.items[(await snap(page)).menu.cursor]?.id !== 'head-sovereign'; i++) await tap(page, 'ArrowDown');
  await adv(page, 400);
  await page.screenshot({ path: shot('seat-shop') });
  expect(errors).toEqual([]);
});
