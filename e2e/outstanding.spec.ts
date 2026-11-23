import { expect, test, type Page } from '@playwright/test';
import { MECH_ENEMIES, POOL, generateBoard } from '../src/core/board';
import { completeMission } from '../src/core/campaign';
import { buy, equip, newGame, type GameState } from '../src/core/game';
import { GRUDGE, type Grudge } from '../src/core/grudge';
import type { Build } from '../src/core/types';
import { BOARD_TEXT, GRUDGE_NAMES } from '../src/content/board';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { REFERENCE_BUILDS } from '../src/content/referenceBuilds';
import { SCENES } from '../src/content/scenes';
import { choose, enterHub, nextFrame, oddsCounted, open, press, snap, waitForPhase, waitForScreen, type Snap } from './helpers';

/**
 * An account in a browser: the notice of a pilot who has come back, its briefing the first time (when they know
 * nothing yet) and the second (when their machine knows a weapon), that machine on the field with the weapon it
 * knows in hand and with another, the hardening shot away, the bill of a meeting and of the one that closes the
 * account, how one begins, and all of it in Dutch.
 */
const shot = (name: string) => `docs/screenshots/${name}.png`;

const STORY = [
  'intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1',
  'choice-lumen', 'lumen-3', 'lumen-4', 'lumen-5', 'finale-lumen', 'audit-1', 'audit-2', 'audit-3', 'verdict-enforce',
];
const BUILD: Build = REFERENCE_BUILDS.tier6;
const WINS = 40;
/** A pilot who has finished the story, in the last of the reference builds: every page read, every lesson told. */
function pilot(extra: Partial<GameState> = {}, language: 'en' | 'nl' = 'en'): GameState {
  let g = newGame(CATALOG, STARTER_BUILD, 'VANTA');
  for (const id of STORY) g = completeMission(g, id, MISSIONS);
  g = { ...g, credits: 999999 };
  for (const [slot, id] of Object.entries(BUILD) as [string, string][]) {
    if (!g.inventory[id]) g = buy(g, id, CATALOG);
    g = equip(g, slot as keyof GameState['build'], id, CATALOG);
  }
  return {
    ...g, credits: 60000, xp: 4000, perks: { marksman: 2, plating: 2, capacitor: 1, heatsinks: 1 }, arenaRank: 6, battlesWon: WINS, endingSeen: true,
    scenes: SCENES.map((s) => s.id), lessons: ['momentum', 'rout'], settings: { ...g.settings, language }, ...extra,
  };
}
/** An account at its second meeting: their machine knows the weapon in the pilot's right hand. */
const account = (change: Partial<Grudge> = {}): Grudge => ({ name: 'Brakk', kind: 'heavy-mech', origin: 'ran', knows: BUILD.rightHand!, met: 1, waited: 2, ...change });
/** One whose notice is out for the first time: they know nothing of the pilot yet. */
const FIRST: Grudge = { name: 'Brakk', kind: 'heavy-mech', origin: 'ran', met: 0, waited: 3 };
const NOTICE = `open-0-${WINS}-${GRUDGE}`;

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
  phase: string; outcome: string; enemies: string[]; spoken: string | null; hardened: string[]; hardening: number | null; halved: boolean; enemyMark: string | null;
  objective: string | null; message: string; round: number;
};
type Billed = { won: boolean; account: { name: string; meeting: number; closed: boolean } | null };
type Seen = { battle: Fought; settlement: Billed; menu: Snap['menu']; screen: string; grudge: Grudge | null; accounts: string[]; medals: string[] };
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
/** Flies the rest of the battle with the game's own Auto Turn, to its result. */
async function autoBattle(page: Page): Promise<string> {
  for (let i = 0; i < 400; i++) {
    const s = await toAction(page);
    if (s.screen !== 'battle' || s.battle.phase === 'result') return s.battle?.outcome ?? '';
    await choose(page, 'auto');
    await still(page, 2);
  }
  throw new Error('the battle did not end');
}
/** Takes aim at the first machine with the weapon at this place in the menu, and says whether it does half. */
async function aimWith(page: Page, weapon: number, picture?: string): Promise<boolean> {
  await choose(page, 'fire');
  await waitForPhase(page, 'weapon');
  for (let i = 0; i < weapon; i++) await press(page, 'ArrowDown');
  await press(page, 'Enter');
  await waitForPhase(page, 'target');
  await still(page, 6);
  const { halved } = (await seen(page)).battle;
  if (picture) await page.screenshot({ path: shot(picture) });
  await press(page, 'Escape');
  await press(page, 'Escape');
  await waitForPhase(page, 'action');
  return halved;
}
/** From the hub to the briefing of the notice, read to its end, with its odds counted. */
async function toBriefing(page: Page, picture: string): Promise<void> {
  await choose(page, 'contracts');
  await still(page, 4);
  await choose(page, NOTICE);
  await waitForScreen(page, 'briefing');
  for (let i = 0; i < 40 && (await snap(page) as unknown as { typing?: boolean }).typing; i++) await page.waitForTimeout(100);
  await oddsCounted(page);
  await still(page, 4);
  await page.screenshot({ path: shot(picture) });
}

test('the first meeting: they do not know the pilot yet, so nothing on their machine is hardened; what hit it hardest they know afterwards', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await load(page, pilot({ grudge: FIRST }));
  await toBriefing(page, 'account-first-briefing');
  await choose(page, 'accept');
  await page.waitForFunction(() => (window as any).__game.snapshot().battle?.spoken);
  const s = await toAction(page);
  expect(s.battle.enemies[0]).toBe('heavy-mech');
  expect(s.battle.objective).toContain('BRAKK');
  expect(s.battle.hardened).toEqual([]);
  expect(s.battle.hardening).toBeNull();
  // Whatever is aimed at it does all it does.
  expect(await aimWith(page, 0)).toBe(false);
  expect(await aimWith(page, 1)).toBe(false);
  expect(await autoBattle(page)).toBe('victory');
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  await still(page, 20);
  await page.screenshot({ path: shot('account-bill') });
  expect((await seen(page)).settlement).toMatchObject({ won: true, account: { name: 'Brakk', meeting: 1, closed: false } });
  await press(page, 'Enter');
  await enterHub(page);
  const game = await kept(page);
  expect(game.grudge).toMatchObject({ name: 'Brakk', kind: 'heavy-mech', met: 1, waited: 0 });
  expect(Object.values(BUILD)).toContain(game.grudge!.knows);
  expect(game.medals).toContain('account-1');
  expect(errors).toEqual([]);
});

test('the second: their notice on the list, the briefing that names the weapon, their machine with that weapon in hand and with another, the hardening shot away, and the bill', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await load(page, pilot({ grudge: account() }));
  await choose(page, 'contracts');
  await still(page, 4);
  const item = (await snap(page)).menu.items.find((entry) => entry.id === NOTICE)!;
  expect(item.label).toBe('Overdue: Brakk');
  for (let i = 0; i < 40 && (await snap(page)).menu.items[(await snap(page)).menu.cursor]?.id !== NOTICE; i++) await press(page, 'ArrowDown');
  await still(page, 4);
  await page.screenshot({ path: shot('account-list') });
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');

  await toBriefing(page, 'account-briefing');
  expect(((await snap(page)) as unknown as { briefing: { objectives: string[] } }).briefing.objectives.join(' ')).toContain('Brakk');
  await choose(page, 'accept');
  // They have the first word: once the band they come in on has gone, it is on the screen, all of it.
  await page.waitForFunction(() => {
    const battle = (window as any).__game.snapshot().battle;
    return !!battle && !battle.banner && !!battle.spoken && !battle.typing;
  }, undefined, { timeout: 60_000 });
  let s = await seen(page);
  expect(s.battle.spoken).toBeTruthy();
  await still(page, 6);
  await page.screenshot({ path: shot('account-opens') });
  s = await toAction(page);
  expect(s.battle.enemies[0]).toBe('heavy-mech');
  expect(s.battle.hardened).toEqual([BUILD.rightHand]);
  const whole = s.battle.hardening!;
  expect(whole).toBeGreaterThan(50);
  expect(s.battle.objective).toContain('BRAKK');
  await still(page, 6);
  await page.screenshot({ path: shot('account-field') });
  // The weapon it knows does half, and says so; the one on the shoulder does not.
  expect(await aimWith(page, 0, 'account-half')).toBe(true);
  expect(await aimWith(page, 1, 'account-whole')).toBe(false);

  // Fired at it turn after turn, the weapon it knows wears the hardening away: the number beside its name goes down
  // by what each hit did, and at nothing the machine is hardened against nothing.
  let left = whole;
  let hits = 0;
  let pictured = false;
  for (let turn = 0; turn < 24 && (await seen(page)).battle.hardened.length > 0; turn++) {
    await choose(page, 'fire');
    await waitForPhase(page, 'weapon');
    await press(page, 'Enter');
    await waitForPhase(page, 'target');
    // After two hits, with the weapon on it again: the number beside its name is what is left.
    if (hits === 2 && !pictured) {
      pictured = true;
      await still(page, 6);
      expect((await seen(page)).battle.hardening).toBe(left);
      await page.screenshot({ path: shot('account-wearing') });
    }
    await press(page, 'Enter');
    s = await toAction(page);
    expect(s.screen).toBe('battle');
    expect(s.battle.outcome).toBe('ongoing');
    const now = s.battle.hardening;
    if (now !== null) {
      expect(now).toBeLessThanOrEqual(left);
      if (now < left) hits += 1;
      left = now;
    }
    if (s.battle.hardened.length === 0) break;
    await choose(page, 'endTurn');
    await still(page, 2);
    s = await toAction(page);
    expect(s.battle.outcome).toBe('ongoing');
  }
  s = await seen(page);
  expect(hits).toBeGreaterThanOrEqual(2);
  expect(pictured).toBe(true);
  expect(s.battle.hardened).toEqual([]);
  expect(s.battle.hardening).toBeNull();
  await still(page, 6);
  await page.screenshot({ path: shot('account-worn') });
  // From the pilot's next turn on that weapon does all it does.
  await choose(page, 'endTurn');
  await still(page, 2);
  s = await toAction(page);
  expect(s.battle.outcome).toBe('ongoing');
  expect(await aimWith(page, 0, 'account-worn-aim')).toBe(false);

  expect(await autoBattle(page)).toBe('victory');
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  await still(page, 20);
  await page.screenshot({ path: shot('account-second-bill') });
  expect((await seen(page)).settlement).toMatchObject({ won: true, account: { name: 'Brakk', meeting: 2, closed: false } });
  await press(page, 'Enter');
  await enterHub(page);
  const game = await kept(page);
  expect(game.grudge).toMatchObject({ name: 'Brakk', kind: 'heavy-mech', met: 2, waited: 0 });
  expect(Object.values(BUILD)).toContain(game.grudge!.knows);
  expect(errors).toEqual([]);
});

test('the third meeting closes the account: the bill says so, the medals are given, and the pilot\'s page counts it', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await load(page, pilot({ grudge: account({ met: 2, waited: 2, origin: 'wrecked' }), accounts: ['Tally'] }));
  await toBriefing(page, 'account-third-briefing');
  await choose(page, 'accept');
  await page.waitForFunction(() => (window as any).__game.snapshot().battle?.spoken);
  await toAction(page);
  expect(await autoBattle(page)).toBe('victory');
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  await still(page, 20);
  await page.screenshot({ path: shot('account-closed') });
  expect((await seen(page)).settlement).toMatchObject({ won: true, account: { name: 'Brakk', meeting: 3, closed: true } });
  await press(page, 'Enter');
  await enterHub(page);
  const game = await kept(page);
  expect(game.grudge).toBeUndefined();
  expect(game.accounts).toEqual(['Tally', 'Brakk']);
  expect(game.medals).toEqual(expect.arrayContaining(['account-1', 'account-closed']));
  expect(game.medals).not.toContain('account-3');
  // On the pilot's page of the record, beside the name the record has earned.
  await choose(page, 'pilot');
  await waitForScreen(page, 'pilot');
  await press(page, 'KeyE');
  await press(page, 'KeyE');
  await still(page, 6);
  expect(((await snap(page)) as unknown as { page: string; accounts: number })).toMatchObject({ page: 'record', accounts: 2 });
  await page.screenshot({ path: shot('pilot-accounts') });
  expect(errors).toEqual([]);
});

test('an account begins in a contract of the board: whoever flew the mech in it is heard from three contracts later', async ({ page }) => {
  test.setTimeout(240_000);
  const mechs = POOL.filter((id) => MECH_ENEMIES.includes(id));
  const contract = generateBoard(WINS, 0, BOARD_TEXT).find((mission) => mission.battles.some((battle) => battle.enemies.some((id) => mechs.includes(id))))!;
  expect(contract).toBeTruthy();
  const errors = await load(page, pilot());
  expect((await seen(page)).grudge).toBeNull();
  await choose(page, 'contracts');
  await choose(page, contract.id);
  await waitForScreen(page, 'briefing');
  await choose(page, 'accept');
  await waitForScreen(page, 'battle');
  for (let i = 0; i < contract.battles.length; i++) {
    expect(await autoBattle(page)).toBe('victory');
    await press(page, 'Enter');
    await still(page, 4);
  }
  await waitForScreen(page, 'settlement');
  await press(page, 'Enter');
  await enterHub(page);
  const begun = (await kept(page)).grudge!;
  expect(begun).toMatchObject({ met: 0, waited: 0 });
  expect(GRUDGE_NAMES).toContain(begun.name);
  expect(contract.battles.flatMap((battle) => battle.enemies).filter((id) => mechs.includes(id))).toContain(begun.kind);
  // They know nothing of the pilot yet: that is for the first meeting.
  expect(begun.knows).toBeUndefined();
  // No notice yet.
  await choose(page, 'contracts');
  expect((await snap(page)).menu.items.map((entry) => entry.id).filter((id) => id.endsWith(`-${GRUDGE}`))).toEqual([]);
  expect(errors).toEqual([]);
});

test('in Dutch: the notice, its briefing, the weapon that does half, and the bill', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await load(page, pilot({ grudge: account({ met: 1, waited: 2 }) }, 'nl'));
  await choose(page, 'contracts');
  await still(page, 4);
  expect((await snap(page)).menu.items.find((entry) => entry.id === NOTICE)!.label).toBe('Vervallen: Brakk');
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  await toBriefing(page, 'nl-account-briefing');
  await choose(page, 'accept');
  await page.waitForFunction(() => (window as any).__game.snapshot().battle?.spoken);
  await toAction(page);
  expect(await aimWith(page, 0, 'nl-account-half')).toBe(true);
  expect(await autoBattle(page)).toBe('victory');
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  await still(page, 20);
  await page.screenshot({ path: shot('nl-account-bill') });
  expect((await seen(page)).settlement).toMatchObject({ won: true, account: { name: 'Brakk', meeting: 2, closed: false } });
  expect(errors).toEqual([]);
});
