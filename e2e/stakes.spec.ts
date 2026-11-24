import { expect, test, type Page } from '@playwright/test';
import { generateBoard } from '../src/core/board';
import { completeMission } from '../src/core/campaign';
import { buy, equip, newGame, type GameState } from '../src/core/game';
import { MEDAL_PAY } from '../src/core/medals';
import { STAKES, bondFor } from '../src/core/stakes';
import type { Build } from '../src/core/types';
import { BOARD_TEXT } from '../src/content/board';
import { MEDALS } from '../src/content/medals';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { REFERENCE_BUILDS } from '../src/content/referenceBuilds';
import { SCENES } from '../src/content/scenes';
import { choose, enterHub, nextFrame, oddsCounted, open, press, snap, waitForPhase, waitForScreen, type Snap } from './helpers';

/**
 * Raised terms in a browser, in a game that is not hurried: the four terms on their page with the odds counted for
 * each, Accept waiting for the count and then taking it, a raised contract won and its bill, one walked away from
 * and its bill, the game closed with a bond in the air, the bench's licence, and the briefing and both bills in Dutch.
 */
const shot = (name: string) => `docs/screenshots/${name}.png`;

const STORY = [
  'intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1',
  'choice-lumen', 'lumen-3', 'lumen-4', 'lumen-5', 'finale-lumen', 'audit-1', 'audit-2', 'audit-3', 'verdict-enforce',
];
const BUILD: Build = REFERENCE_BUILDS.tier6;
const WINS = 40;
/** A pilot who has finished the story, in the last of the reference builds, with money for any bond of the board: every page read, every lesson told. */
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
/** The lightest contract of this pilot's board: a single fight. */
const ROW = generateBoard(WINS, 0, BOARD_TEXT)[0];

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
/** What the medals earned between two kept games paid: beside any bill. */
const medalPay = (before: GameState, after: GameState): number =>
  after.medals.filter((id) => !before.medals.includes(id)).reduce((sum, id) => sum + MEDAL_PAY[MEDALS.find((m) => m.id === id)!.tier], 0);

type Terms = { level: number; factor: number; fee: number; bond: number; held: boolean; waiting: boolean };
type Bill = { won: boolean; net: number; reward: number; hazard: { level: number; pay: number } | null; bond: { level: number; lost: number } | null };
type Seen = Omit<Snap, 'battle' | 'settlement'> & {
  briefing?: { reward: number; terms: Terms | null; odds: { played: number; won: number; done: boolean } | null; near: string | null };
  battle?: { phase: string; outcome: string; enemyScale: number; spoken: string | null };
  settlement?: Bill;
  toasts?: string[];
  raised?: number;
  garage?: { mode: string; bench?: { step: number; cap: number; refusal: string | null; licence: { step: number; price: number; refusal: string | null } | null } };
};
const seen = async (page: Page): Promise<Seen> => (await snap(page)) as unknown as Seen;
const still = async (page: Page, frames = 6): Promise<void> => { for (let i = 0; i < frames; i++) await nextFrame(page); };

/** From the hub to the briefing of the board's lightest contract, with the cursor on its terms. */
async function toTerms(page: Page): Promise<void> {
  await choose(page, 'contracts');
  await choose(page, ROW.id);
  await waitForScreen(page, 'briefing');
  await oddsCounted(page);
  expect((await seen(page)).menu.items.slice(0, 2).map((item) => item.id)).toEqual(['accept', 'terms']);
  await press(page, 'ArrowDown');
}
/** Turns the terms to a level, lets their odds be counted, and takes the contract. */
async function accept(page: Page, level: number): Promise<void> {
  for (let i = 0; i < level; i++) await press(page, 'ArrowRight');
  await page.waitForFunction((want) => {
    const briefing = (window as any).__game.snapshot().briefing;
    return briefing?.terms?.level === want && briefing.terms.waiting === false;
  }, level, { timeout: 90_000 });
  await press(page, 'ArrowUp');
  await press(page, 'Enter');
  await waitForScreen(page, 'battle');
}
/** Flies the contract's battles with the game's own Auto Turn, to the bill. */
async function flyOut(page: Page): Promise<Bill> {
  for (let i = 0; i < 40_000; i++) {
    const s = await seen(page);
    if (s.screen === 'settlement') return s.settlement!;
    if (s.screen !== 'battle') throw new Error(`a battle led to ${s.screen}`);
    if (s.battle!.phase === 'action') { await choose(page, 'auto'); await still(page, 2); }
    else if (s.battle!.phase === 'result' || s.battle!.spoken) await press(page, 'Enter');
    else await nextFrame(page);
  }
  throw new Error('the contract did not end');
}
async function walkAway(page: Page): Promise<Bill> {
  await waitForPhase(page, 'action');
  await choose(page, 'retreat');
  await choose(page, 'yes');
  await waitForPhase(page, 'result');
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  return (await seen(page)).settlement!;
}

test('the terms of an open contract: the four on their page, with what Accept would pay and the odds of each', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await load(page, pilot());
  await toTerms(page);
  const names = ['standard', 'hazard', 'severe', 'ruinous'];
  for (let level = 0; level <= 3; level++) {
    if (level > 0) await press(page, 'ArrowRight');
    await page.waitForFunction((want) => {
      const briefing = (window as any).__game.snapshot().briefing;
      return briefing?.terms?.level === want && briefing.odds?.done === true && briefing.terms.waiting === false;
    }, level, { timeout: 90_000 });
    const s = await seen(page);
    expect(s.briefing!.terms).toEqual({ level, factor: STAKES[level], fee: ROW.reward, bond: bondFor(ROW.reward, level), held: true, waiting: false });
    // What Accept would pay: the fee, and on raised terms what they add to it, which is the bond.
    expect(s.briefing!.reward).toBe(ROW.reward + bondFor(ROW.reward, level));
    expect(s.briefing!.odds).toMatchObject({ played: 20, done: true });
    expect(s.menu.items[0]).toMatchObject({ id: 'accept', label: 'Accept', enabled: true });
    await still(page);
    await page.screenshot({ path: shot(`stakes-terms-${names[level]}`) });
  }
  // Round and round: one more step is Standard again, and a step back the top terms.
  await press(page, 'ArrowRight');
  expect((await seen(page)).briefing!.terms!.level).toBe(0);
  await press(page, 'ArrowLeft');
  expect((await seen(page)).briefing!.terms!.level).toBe(3);
  expect(errors).toEqual([]);
});

test('on raised terms Accept waits for the odds, says so, and then takes the contract against as much more', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await load(page, pilot());
  // What this contract is flown against at Standard.
  await toTerms(page);
  await press(page, 'ArrowUp');
  await press(page, 'Enter');
  await waitForScreen(page, 'battle');
  const standard = (await seen(page)).battle!.enemyScale;
  await walkAway(page);
  await press(page, 'Enter');
  await enterHub(page);
  const before = await kept(page);

  await toTerms(page);
  // Straight to the top terms: nothing of them has been counted, and Accept waits.
  await press(page, 'ArrowRight');
  await press(page, 'ArrowRight');
  await press(page, 'ArrowRight');
  let s = await seen(page);
  expect(s.briefing!.terms).toMatchObject({ level: 3, waiting: true });
  expect(s.briefing!.odds!.done).toBe(false);
  expect(s.menu.items[0]).toMatchObject({ id: 'accept', label: 'Counting', enabled: false });
  await page.screenshot({ path: shot('stakes-terms-counting') });
  // A on it starts nothing.
  await press(page, 'ArrowUp');
  await press(page, 'Enter');
  s = await seen(page);
  expect(s.screen).toBe('briefing');
  expect((await kept(page)).atStake).toBeUndefined();
  // Counted, it is Accept again, and takes the contract.
  await page.waitForFunction(() => (window as any).__game.snapshot().briefing?.terms?.waiting === false, undefined, { timeout: 90_000 });
  s = await seen(page);
  expect(s.briefing!.odds).toMatchObject({ played: 20, done: true });
  expect(s.menu.items[0]).toMatchObject({ id: 'accept', label: 'Accept', enabled: true });
  await press(page, 'Enter');
  await waitForScreen(page, 'battle');
  expect((await seen(page)).battle!.enemyScale).toBeCloseTo(standard * STAKES[3], 5);
  // The bond is staked, not spent.
  const flying = await kept(page);
  expect(flying.atStake).toBe(bondFor(ROW.reward, 3));
  expect(flying.credits).toBe(before.credits);
  expect(errors).toEqual([]);
});

test('a raised contract won: the terms on its bill, and on the pilot\'s record', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await load(page, pilot());
  const before = await kept(page);
  await toTerms(page);
  await accept(page, 1);
  const bill = await flyOut(page);
  expect(bill).toMatchObject({ won: true, hazard: { level: 1, pay: bondFor(ROW.reward, 1) }, bond: null });
  await page.waitForTimeout(900);
  await page.screenshot({ path: shot('stakes-bill-won') });
  const after = await kept(page);
  expect(after.raised).toEqual([1, 0, 0]);
  expect(after.atStake).toBeUndefined();
  expect(after.medals).toContain('stake-1');
  // The balance is the balance before and the bill's net, and what the medals earned with it paid.
  expect(after.credits).toBe(before.credits + bill.net + medalPay(before, after));
  await press(page, 'Enter');
  await enterHub(page);
  await choose(page, 'pilot');
  await waitForScreen(page, 'pilot');
  await press(page, 'e');
  await press(page, 'e');
  const s = await seen(page);
  expect(s.page).toBe('record');
  expect(s.raised).toBe(1);
  await still(page);
  await page.screenshot({ path: shot('stakes-record') });
  expect(errors).toEqual([]);
});

test('one walked away from: the bond on its bill and off the balance', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await load(page, pilot());
  const before = await kept(page);
  await toTerms(page);
  await accept(page, 3);
  const bill = await walkAway(page);
  const bond = bondFor(ROW.reward, 3);
  expect(bill).toMatchObject({ won: false, reward: 0, hazard: null, bond: { level: 3, lost: bond } });
  expect(bill.net).toBeLessThanOrEqual(-bond);
  await page.waitForTimeout(900);
  await page.screenshot({ path: shot('stakes-bill-lost') });
  const after = await kept(page);
  expect(after.credits).toBe(before.credits + bill.net + medalPay(before, after));
  expect(after.atStake).toBeUndefined();
  expect(after.raised).toBeUndefined();
  expect(after.battlesWon).toBe(WINS);
  expect(errors).toEqual([]);
});

test('the game closed with a bond in the air: opened again the bond is gone, and it is said once', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await load(page, pilot());
  const before = await kept(page);
  await toTerms(page);
  await accept(page, 2);
  const bond = bondFor(ROW.reward, 2);
  expect((await kept(page)).atStake).toBe(bond);
  // The game is closed there.
  await page.reload();
  await page.waitForFunction(() => (window as any).__game?.snapshot().screen === 'title');
  await choose(page, 'continue');
  await waitForScreen(page, 'hub');
  await page.waitForFunction(() => (window as any).__game.snapshot().toast === 'forfeit', undefined, { timeout: 30_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: shot('stakes-forfeit') });
  const after = await kept(page);
  expect(after.atStake).toBeUndefined();
  expect(after.credits).toBe(before.credits - bond + medalPay(before, after));
  expect(after.battlesWon).toBe(WINS);
  // Opened once more: nothing is staked, nothing is taken, and nothing is said of it.
  await page.reload();
  await page.waitForFunction(() => (window as any).__game?.snapshot().screen === 'title');
  await choose(page, 'continue');
  await waitForScreen(page, 'hub');
  await page.waitForTimeout(700);
  const again = await seen(page);
  expect([again.toast, ...(again.toasts ?? [])]).not.toContain('forfeit');
  expect((await kept(page)).credits).toBe(after.credits);
  expect(errors).toEqual([]);
});

test('the bench\'s licence: offered at the bench\'s end, asked about with No under the cursor, bought, and the step it opened on offer', async ({ page }) => {
  test.setTimeout(120_000);
  const core = BUILD.core;
  const errors = await load(page, pilot({ tuning: { [core]: 2 } }));
  const before = await kept(page);
  await choose(page, 'garage');
  await waitForScreen(page, 'garage');
  await choose(page, 'core');
  await press(page, 'e');
  let s = await seen(page);
  expect(s.garage).toMatchObject({ mode: 'bench', bench: { step: 2, cap: 2, refusal: 'limit', licence: { step: 3, price: 50_000, refusal: null } } });
  expect(s.menu).toMatchObject({ items: [{ id: 'licence', label: 'Licence +3', note: '50000 c', enabled: true }, { id: 'back' }], cursor: 0 });
  await still(page);
  await page.screenshot({ path: shot('garage-licence') });
  await press(page, 'Enter');
  s = await seen(page);
  expect(s.garage!.mode).toBe('licence');
  expect(s.menu).toMatchObject({ items: [{ id: 'no' }, { id: 'yes' }], cursor: 0 });
  await still(page);
  await page.screenshot({ path: shot('garage-licence-ask') });
  // No changes nothing.
  await press(page, 'Enter');
  expect((await seen(page)).garage!.mode).toBe('bench');
  expect((await kept(page)).bench).toBeUndefined();
  // Asked again, and answered Yes.
  await press(page, 'Enter');
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  s = await seen(page);
  expect(s.garage).toMatchObject({ mode: 'bench', bench: { step: 2, cap: 3, refusal: null, licence: null } });
  expect(s.menu.items[0]).toMatchObject({ id: 'tune', label: 'Tune to +3', note: `${3 * CATALOG[core].price} c`, enabled: true });
  const after = await kept(page);
  expect(after.bench).toBe(1);
  expect(after.credits).toBe(before.credits - 50_000);
  await still(page);
  await page.screenshot({ path: shot('garage-licence-bought') });
  // And the step is taken as any step is.
  await press(page, 'Enter');
  expect((await kept(page)).tuning).toMatchObject({ [core]: 3 });
  expect(errors).toEqual([]);
});

test('in Dutch: the terms on their page, the bill of a raised contract won and of one walked away from', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await load(page, pilot({}, 'nl'));
  await toTerms(page);
  await press(page, 'ArrowRight');
  await press(page, 'ArrowRight');
  await page.waitForFunction(() => {
    const briefing = (window as any).__game.snapshot().briefing;
    return briefing?.terms?.level === 2 && briefing.odds?.done === true && briefing.terms.waiting === false;
  }, undefined, { timeout: 90_000 });
  expect((await seen(page)).menu.items.slice(0, 2).map((item) => item.label)).toEqual(['Aannemen', 'Inzet']);
  await still(page);
  await page.screenshot({ path: shot('nl-stakes-terms') });
  // Back to Hazard, and flown.
  await press(page, 'ArrowLeft');
  await page.waitForFunction(() => (window as any).__game.snapshot().briefing?.terms?.waiting === false, undefined, { timeout: 90_000 });
  await press(page, 'ArrowUp');
  await press(page, 'Enter');
  await waitForScreen(page, 'battle');
  const won = await flyOut(page);
  expect(won).toMatchObject({ won: true, hazard: { level: 1 } });
  await page.waitForTimeout(900);
  await page.screenshot({ path: shot('nl-stakes-bill-won') });
  await press(page, 'Enter');
  await enterHub(page);
  // The board has turned: the lightest of the new one, on the top terms, and walked away from.
  await choose(page, 'contracts');
  const next = (await seen(page)).menu.items.find((item) => /^open-0-\d+-0$/.test(item.id))!;
  await choose(page, next.id);
  await waitForScreen(page, 'briefing');
  await oddsCounted(page);
  await press(page, 'ArrowDown');
  await accept(page, 3);
  const lost = await walkAway(page);
  expect(lost).toMatchObject({ won: false, bond: { level: 3 } });
  await page.waitForTimeout(900);
  await page.screenshot({ path: shot('nl-stakes-bill-lost') });
  expect(errors).toEqual([]);
});
