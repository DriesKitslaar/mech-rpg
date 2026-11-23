import { expect, test, type Page } from '@playwright/test';
import { MECH_ENEMIES, POOL, generateBoard } from '../src/core/board';
import { completeMission } from '../src/core/campaign';
import { buy, equip, newGame, type GameState } from '../src/core/game';
import { GRUDGE, type Grudge } from '../src/core/grudge';
import type { Build } from '../src/core/types';
import { BOARD_TEXT, GRUDGE_FACES, GRUDGE_NAMES } from '../src/content/board';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { REFERENCE_BUILDS } from '../src/content/referenceBuilds';
import { SCENES } from '../src/content/scenes';
import { choose, enterHub, nextFrame, open, press, snap, waitForScreen, type Snap } from './helpers';

/**
 * The pilots of an account in a browser: the announcement as one begins and their page at once, the band a meeting
 * opens on, their face beside what they say as it opens and as their machine falls, the page of an open account and
 * of a closed one, and the band and the page in Dutch.
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

type Fought = { phase: string; outcome: string; spoken: string | null; face: string | null; banner: boolean; typing: boolean };
type Shown = { title: string; portrait?: string; role?: string; lines: string[] };
type Seen = { battle: Fought; screen: string; toast: string | null; toasts: string[]; page?: string; detail?: Shown; count?: string; menu: Snap['menu'] };
const seen = async (page: Page): Promise<Seen> => (await snap(page)) as unknown as Seen;
const still = async (page: Page, frames = 12): Promise<void> => { for (let i = 0; i < frames; i++) await nextFrame(page); };
/** Waits until a line is being said with nothing over it, and is all written out. */
async function written(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const battle = (window as any).__game.snapshot().battle;
    return !!battle && !battle.banner && !!battle.spoken && !battle.typing && !battle.finish;
  }, undefined, { timeout: 60_000 });
  await still(page, 4);
}

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
/** Flies the battle with the game's own Auto Turn until it is won, and stops at what is said then, if anything is. */
async function autoToTheEnd(page: Page): Promise<Seen> {
  for (let i = 0; i < 20000; i++) {
    const s = await seen(page);
    if (s.screen !== 'battle' || s.battle.phase === 'result') return s;
    if (s.battle.outcome !== 'ongoing' && s.battle.spoken) return s;
    if (s.battle.phase === 'action') { await choose(page, 'auto'); await still(page, 2); }
    else if (s.battle.spoken) await press(page, 'Enter');
    else await nextFrame(page);
  }
  throw new Error('the battle did not end');
}
/** From the hub to the database's page of people. */
async function toPeople(page: Page): Promise<Seen> {
  await choose(page, 'database');
  await waitForScreen(page, 'database');
  await press(page, 'KeyE');
  await still(page, 6);
  const s = await seen(page);
  expect(s.page).toBe('people');
  return s;
}

test('an account begins: it is announced over the bill of the contract it began in, and their page is in the database at once', async ({ page }) => {
  test.setTimeout(240_000);
  const mechs = POOL.filter((id) => MECH_ENEMIES.includes(id));
  const contract = generateBoard(WINS, 0, BOARD_TEXT).find((mission) => mission.battles.some((battle) => battle.enemies.some((id) => mechs.includes(id))))!;
  const errors = await load(page, pilot());
  await choose(page, 'contracts');
  await choose(page, contract.id);
  await waitForScreen(page, 'briefing');
  await choose(page, 'accept');
  await waitForScreen(page, 'battle');
  for (let i = 0; i < contract.battles.length; i++) {
    const s = await autoToTheEnd(page);
    if (s.battle.spoken) await press(page, 'Enter');
    await toAction(page);
    await press(page, 'Enter');
    await still(page, 4);
  }
  await waitForScreen(page, 'settlement');
  const begun = (await kept(page)).grudge!;
  expect(GRUDGE_NAMES).toContain(begun.name);
  // The announcement comes up over the bill, among whatever else the contract earned.
  await page.waitForFunction((id) => (window as any).__game.snapshot().toast === id, `account:${begun.name}`, { timeout: 60_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: shot('ledger-opened') });
  for (let i = 0; i < 200 && ((await seen(page)).toast !== null || (await seen(page)).toasts.length > 0); i++) await page.waitForTimeout(200);
  await press(page, 'Enter');
  await enterHub(page);
  const s = await toPeople(page);
  expect(s.menu.items[0]).toMatchObject({ id: `account:${begun.name}`, label: begun.name, enabled: true });
  expect(s.detail).toMatchObject({ title: begun.name.toUpperCase(), portrait: GRUDGE_FACES[begun.name], role: 'Open account' });
  expect(s.detail!.lines.join(' ')).toContain('You have not met by name yet.');
  expect(s.detail!.lines.join(' ')).toContain('Their notice comes after 3 more contracts won.');
  await page.screenshot({ path: shot('ledger-page-new') });
  expect(errors).toEqual([]);
});

test('a meeting: the band they come in on, under the notice\'s word; and their face beside what they say as it opens and as their machine falls', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await load(page, pilot({ grudge: account() }));
  await choose(page, 'contracts');
  await choose(page, NOTICE);
  await waitForScreen(page, 'briefing');
  await choose(page, 'accept');
  await waitForScreen(page, 'battle');
  // The band: it has come in, and holds.
  await page.waitForFunction(() => (window as any).__game.snapshot().battle?.banner === true);
  await page.waitForTimeout(600);
  expect((await seen(page)).battle.banner).toBe(true);
  await page.screenshot({ path: shot('ledger-entrance') });
  // Then they have the first word, beside their face: once the band has gone and the line is written out.
  await written(page);
  const opens = await seen(page);
  expect(opens.battle.spoken).toBe(BOARD_TEXT.grudge.opens.again[0]);
  expect(opens.battle.face).toBe(GRUDGE_FACES.Brakk);
  await page.screenshot({ path: shot('ledger-face') });
  await toAction(page);
  const end = await autoToTheEnd(page);
  expect(end.battle.outcome).toBe('victory');
  await written(page);
  const falls = await seen(page);
  expect(falls.battle.spoken).toBe(BOARD_TEXT.grudge.falls[1]);
  expect(falls.battle.face).toBe(GRUDGE_FACES.Brakk);
  await page.screenshot({ path: shot('ledger-falls') });
  expect(errors).toEqual([]);
});

test('their page: the account that is open first, with what there is to know of it, and a closed one under it', async ({ page }) => {
  const errors = await load(page, pilot({ grudge: account({ waited: 1 }), accounts: ['Tally', 'Harrow'] }));
  let s = await toPeople(page);
  expect(s.menu.items.slice(0, 3).map((item) => item.id)).toEqual(['account:Brakk', 'account:Tally', 'account:Harrow']);
  expect(s.detail).toMatchObject({ title: 'BRAKK', portrait: GRUDGE_FACES.Brakk, role: 'Open account' });
  const said = s.detail!.lines.join(' ');
  expect(said).toContain('that broke off from you');
  expect(said).toContain('You have met once, and won.');
  expect(said).toContain(`hardened against your ${CATALOG[BUILD.rightHand!].name}`);
  expect(said).toContain('Their notice comes after one more contract won.');
  expect(s.count).toContain('ACCOUNTS 3');
  await page.screenshot({ path: shot('ledger-page-open') });
  await press(page, 'ArrowDown');
  await still(page, 6);
  s = await seen(page);
  expect(s.detail).toMatchObject({ title: 'TALLY', portrait: GRUDGE_FACES.Tally, role: 'Account closed' });
  await page.screenshot({ path: shot('ledger-page-closed') });
  expect(errors).toEqual([]);
});

test('in Dutch: the band under the notice\'s Dutch word, and the page', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await load(page, pilot({ grudge: account({ waited: 2 }), accounts: ['Tally'] }, 'nl'));
  const s = await toPeople(page);
  expect(s.detail).toMatchObject({ title: 'BRAKK', role: 'Open rekening' });
  expect(s.detail!.lines.join(' ')).toContain('Het bericht is er: het staat bij de open contracten.');
  expect(s.count).toContain('REKENINGEN 2');
  await page.screenshot({ path: shot('nl-ledger-page') });
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  await choose(page, 'contracts');
  await choose(page, NOTICE);
  await waitForScreen(page, 'briefing');
  await choose(page, 'accept');
  await waitForScreen(page, 'battle');
  await page.waitForFunction(() => (window as any).__game.snapshot().battle?.banner === true);
  await page.waitForTimeout(600);
  expect((await seen(page)).battle.banner).toBe(true);
  await page.screenshot({ path: shot('nl-ledger-entrance') });
  expect(errors).toEqual([]);
});
