import { expect, test, type Page } from '@playwright/test';
import { generateBoard } from '../src/core/board';
import { completeMission } from '../src/core/campaign';
import { BUILD_SLOTS, buy, equip, newGame, saveLoadout, type GameState } from '../src/core/game';
import { xpForLevel } from '../src/core/pilot';
import { tunable } from '../src/core/tuning';
import type { Build } from '../src/core/types';
import { ARCHETYPE_BUILDS } from '../src/content/archetypeBuilds';
import { BOARD_TEXT } from '../src/content/board';
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
const BASTION = ARCHETYPE_BUILDS.bastion.late;
const LANCER = ARCHETYPE_BUILDS.lancer.late;
/**
 * A champion of the ladder who flies a lancer and has a bastion saved: every page read, every perk that helps
 * in a fight, the bench's last step on both builds, and the game at its gentlest, so that a duel is won.
 */
function champion(extra: Partial<GameState> = {}): GameState {
  let g = newGame(CATALOG, STARTER_BUILD, 'VANTA');
  for (const id of ['intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'hadron-2', 'lumen-2', 'undertow-2', 'rival-1', 'choice-lumen', 'lumen-3']) g = completeMission(g, id, MISSIONS);
  g = saveLoadout(wearing(g, BASTION), 0);
  g = wearing(g, LANCER);
  const tuning = Object.fromEntries([...Object.values(BASTION), ...Object.values(LANCER)].filter((id): id is string => id !== undefined && tunable(CATALOG[id])).map((id) => [id, 5]));
  return {
    ...g, credits: 4200, xp: xpForLevel(20), battlesWon: 60, arenaRank: 10, cycle: 3, scenes: SCENES.map((scene) => scene.id), codex: WORLD.map((entry) => entry.id),
    perks: { marksman: 3, reflexes: 3, capacitor: 3, heatsinks: 3, fieldTech: 2, plating: 3 }, tuning, lessons: ['momentum', 'rout'],
    settings: { ...g.settings, difficulty: 'story' }, ...extra,
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
type Master = { kind: string; state: string };
const master = async (page: Page): Promise<Master | null> => (await snap(page) as unknown as { master: Master | null }).master;
type Crown = { kind: string; met: boolean; held: boolean; fits: number | null };
const crown = async (page: Page): Promise<Crown | null> => (await snap(page) as unknown as { briefing: { crown: Crown | null } }).briefing.crown;
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
const typed = async (page: Page): Promise<void> => {
  for (let i = 0; i < 80 && (await snap(page) as unknown as { typing?: boolean }).typing; i++) await page.waitForTimeout(100);
};

test('the masters: the arena\'s second page lists the seven classes, each with its master in their own paint, and a duel is briefed with what the crown asks', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, champion(), '/?seed=7');
  await choose(page, 'arena');
  await waitForScreen(page, 'arena');
  expect((await snap(page)).page).toBe('ladder');
  await settle(page);
  await page.screenshot({ path: shot('arena-ladder-tabs') });
  // R1 turns to the masters: one of each class, each open to the champion for the same purse.
  await press(page, 'KeyE');
  expect((await snap(page)).page).toBe('masters');
  const rows = (await snap(page)).menu.items;
  // (Under the seven is the eighth seat, which is no class's: e2e/seat.spec.ts.)
  expect(rows.map((row) => row.label)).toEqual(['Duellist', 'Sharpshooter', 'Artillery', 'Lancer', 'Bastion', 'Skirmisher', 'All-rounder', 'The Eighth Seat']);
  expect(rows.slice(0, 7).every((row) => row.enabled && row.note === '9000')).toBe(true);
  expect(await master(page)).toEqual({ kind: 'duellist', state: 'open' });
  // Each of the seven, as they stand beside the list.
  for (const kind of ['duellist', 'marksman', 'artillery', 'lancer', 'bastion', 'skirmisher', 'allrounder']) {
    await toRow(page, `arena-master-${kind}`);
    await settle(page, 30);
    await page.screenshot({ path: shot(`arena-master-${kind}`) });
  }
  // The bastions' master, flown at in the lancer on the floor: the crown's line is a notice, and points to the bastion saved first.
  await toRow(page, 'arena-master-bastion');
  await press(page, 'Enter');
  await waitForScreen(page, 'briefing');
  await typed(page);
  await oddsCounted(page);
  await settle(page);
  expect((await snap(page)).menu.items.map((item) => item.id)).toEqual(['accept', 'build', 'back']);
  expect(await crown(page)).toEqual({ kind: 'bastion', met: false, held: false, fits: 0 });
  await page.screenshot({ path: shot('masters-briefing-notice') });
  // Turned to the saved bastion, the line is lit.
  await toRow(page, 'build');
  await press(page, 'ArrowRight');
  await oddsCounted(page);
  await settle(page);
  expect(await crown(page)).toMatchObject({ met: true });
  await page.screenshot({ path: shot('masters-briefing') });
  // B goes back to the masters, to the bastions' master.
  await press(page, 'Escape');
  await waitForScreen(page, 'arena');
  expect(await master(page)).toEqual({ kind: 'bastion', state: 'open' });
  expect(errors).toEqual([]);
});

test('a master beaten in a machine of their own class gives up the crown: the bill says so, and the arena shows it', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // The bastion is on the floor this time.
  const base = champion();
  await load(page, wearing(base, BASTION), '/?seed=7');
  await choose(page, 'arena');
  await waitForScreen(page, 'arena');
  await press(page, 'KeyE');
  await toRow(page, 'arena-master-bastion');
  await press(page, 'Enter');
  await waitForScreen(page, 'briefing');
  expect(await crown(page)).toMatchObject({ kind: 'bastion', met: true, held: false });
  await choose(page, 'accept');
  await waitForScreen(page, 'battle');
  expect((await snap(page)).battle).toMatchObject({ mission: 'arena-master-bastion', enemies: ['arena-master-bastion'] });
  let pictured = false;
  for (let i = 0; i < 6000; i++) {
    const s = await snap(page);
    if (s.screen !== 'battle') break;
    if (s.battle?.phase === 'action') {
      if (!pictured) {
        await settle(page, 20);
        await page.screenshot({ path: shot('masters-battle') });
        pictured = true;
      }
      await choose(page, 'auto');
    } else if (s.battle?.phase === 'result' || s.battle?.spoken) await press(page, 'Enter');
    else await nextFrame(page);
  }
  await waitForScreen(page, 'settlement');
  const bill = (await snap(page)).settlement as unknown as { won: boolean; reward: number; crowned: string | null };
  expect(bill).toMatchObject({ won: true, reward: 9000, crowned: 'bastion' });
  await settle(page, 90);
  await page.screenshot({ path: shot('masters-crown') });
  const game = await kept(page);
  expect(game.crowns).toEqual(['bastion']);
  expect(game.masters).toEqual(['bastion']);
  // On to the hub, and back to the arena: the row and the panel say whose the crown is.
  await press(page, 'Enter');
  await waitForScreen(page, 'hub');
  await choose(page, 'arena');
  await waitForScreen(page, 'arena');
  await press(page, 'KeyE');
  await toRow(page, 'arena-master-bastion');
  expect(await master(page)).toEqual({ kind: 'bastion', state: 'crown' });
  expect((await snap(page)).menu.items[4]).toMatchObject({ note: 'CROWN' });
  await settle(page);
  await page.screenshot({ path: shot('arena-masters-crown') });
  expect(errors).toEqual([]);
});

test('the masters are locked to a pilot who is not champion, and the page says whom they take challenges from', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, champion({ arenaRank: 6 }), '/?seed=7');
  await choose(page, 'arena');
  await waitForScreen(page, 'arena');
  await press(page, 'KeyE');
  const rows = (await snap(page)).menu.items;
  expect(rows.slice(0, 7).every((row) => !row.enabled && row.note === 'LOCKED')).toBe(true);
  expect(await master(page)).toEqual({ kind: 'duellist', state: 'locked' });
  await press(page, 'Enter');
  await settle(page, 20);
  expect((await snap(page)).screen).toBe('arena');
  await page.screenshot({ path: shot('arena-masters-locked') });
  expect(errors).toEqual([]);
});

test('what a crown gives: a mark on the pilot\'s page of classes, the master\'s paint in the garage, and more pay on the board for that class', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // So many battles won that the board has a contract that asks for a lancer.
  let won = 60;
  while (!generateBoard(won, 3, BOARD_TEXT).some((mission) => mission.asks === 'lancer')) won += 1;
  const asking = generateBoard(won, 3, BOARD_TEXT).find((mission) => mission.asks === 'lancer')!;
  await load(page, champion({ battlesWon: won, masters: ['duellist', 'lancer', 'bastion'], crowns: ['lancer', 'bastion'] }), '/?seed=7');
  // The pilot's page of classes: a crown on the two rows, the count above them, and the holder's title under the cursor.
  await choose(page, 'pilot');
  await waitForScreen(page, 'pilot');
  for (let i = 0; i < 6 && (await snap(page)).page !== 'classes'; i++) await press(page, 'KeyE');
  expect((await snap(page)).page).toBe('classes');
  for (let i = 0; i < 3; i++) await press(page, 'ArrowDown');
  await settle(page);
  await page.screenshot({ path: shot('pilot-classes-crowns') });
  // The garage: one step back from factory colours is the paint of the last crown held, the bastions'.
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  await choose(page, 'garage');
  await waitForScreen(page, 'garage');
  await press(page, 'KeyQ');
  expect((await kept(page)).paint).toBe('basalt');
  await press(page, 'KeyQ');
  expect((await kept(page)).paint).toBe('ultraviolet');
  await settle(page);
  await page.screenshot({ path: shot('garage-crown-paint') });
  // The board: the contract that asks for a lancer pays this pilot half as much again.
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  await choose(page, 'contracts');
  await choose(page, asking.id);
  await waitForScreen(page, 'briefing');
  await typed(page);
  await oddsCounted(page);
  await settle(page);
  await page.screenshot({ path: shot('asks-crown-briefing') });
  expect(errors).toEqual([]);
});

test('the masters in Dutch', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = champion({ masters: ['lancer'], crowns: ['lancer'] });
  await load(page, { ...base, settings: { ...base.settings, language: 'nl' } }, '/?seed=7');
  await choose(page, 'arena');
  await waitForScreen(page, 'arena');
  await press(page, 'KeyE');
  await toRow(page, 'arena-master-marksman');
  await settle(page);
  await page.screenshot({ path: shot('nl-arena-masters') });
  await press(page, 'Enter');
  await waitForScreen(page, 'briefing');
  await typed(page);
  await oddsCounted(page);
  await settle(page);
  await page.screenshot({ path: shot('nl-masters-briefing') });
  expect(errors).toEqual([]);
});
