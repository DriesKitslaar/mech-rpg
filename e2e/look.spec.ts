import { expect, test, type Page } from '@playwright/test';
import { completeMission } from '../src/core/campaign';
import { newGame, type GameState } from '../src/core/game';
import { MISSIONS } from '../src/content/missions';
import { SCENES } from '../src/content/scenes';
import { CATALOG, DEMO_BUILD } from '../src/content/parts';
import { snap, type Snap } from './helpers';

/**
 * The look of things that move. The game is opened with its clock stopped (?step=1) and stepped by
 * hand, so that any moment of an effect can be photographed. With LOOK_FRAMES set to a folder every
 * frame of every volley is written there, for looking through; without it only the few pictures
 * kept in docs/screenshots are taken.
 */
const FRAMES = process.env.LOOK_FRAMES;
const shot = (name: string) => `docs/screenshots/${name}.png`;
/** The field, without the panel under it. */
const FIELD = { x: 0, y: 0, width: 1240, height: 712 };

/** A pilot past the introductions, in a mech with a gun of each kind: bullets, a beam and shells. */
function gunner(): GameState {
  let g = newGame(CATALOG, DEMO_BUILD);
  for (const id of ['intro-1', 'intro-2']) g = completeMission(g, id, MISSIONS);
  return { ...g, scenes: SCENES.map((s) => s.id) };
}

const adv = (page: Page, ms: number): Promise<void> => page.evaluate((n) => (window as any).__game.advance(n), ms);
async function tap(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await adv(page, 48);
}
async function pick(page: Page, id: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const s = await snap(page);
    if (s.menu.items[s.menu.cursor]?.id === id) return tap(page, 'Enter');
    await tap(page, 'ArrowDown');
  }
  throw new Error(`menu item not found: ${id}`);
}
async function until(page: Page, done: (s: Snap) => boolean, step = 96, limit = 60000): Promise<Snap> {
  for (let t = 0; t <= limit; t += step) {
    const s = await snap(page);
    if (done(s)) return s;
    await adv(page, step);
  }
  throw new Error('the game never got there');
}

async function intoBattle(page: Page, mission: string): Promise<void> {
  await page.addInitScript((save) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', save);
  }, JSON.stringify(gunner()));
  await page.goto('/?seed=7&step=1');
  await page.waitForFunction(() => (window as any).__game?.snapshot().screen === 'title');
  await adv(page, 600);
  await pick(page, 'continue');
  await until(page, (s) => s.screen === 'hub');
  await adv(page, 400);
  await pick(page, 'contracts');
  await adv(page, 400);
  await pick(page, mission);
  await until(page, (s) => s.screen === 'briefing');
  await adv(page, 400);
  await pick(page, 'accept');
  await until(page, (s) => s.battle?.phase === 'action');
}

/** Photographs what follows, a frame every `step` milliseconds for `ms`. */
async function film(page: Page, tag: string, ms: number, step = 20, keep: Record<number, string> = {}): Promise<void> {
  for (let t = step; t <= ms; t += step) {
    await adv(page, step);
    if (FRAMES) await page.screenshot({ path: `${FRAMES}/${tag}-${String(t).padStart(4, '0')}.png`, clip: FIELD });
    if (keep[t]) await page.screenshot({ path: shot(keep[t]) });
  }
}

/**
 * Fires the weapon in this hand or mount at whatever is aimed at first, and photographs what follows.
 * Says whether it struck, or null when the weapon could not be fired.
 */
async function volley(page: Page, weapon: string, name: string, keep: Record<number, string> = {}): Promise<boolean | null> {
  await until(page, (s) => s.battle?.phase === 'action' || s.battle?.phase === 'result');
  const before = await snap(page);
  if (before.battle?.phase !== 'action' || !before.menu.items.find((item) => item.id === 'fire')?.enabled) return null;
  await pick(page, 'fire');
  const list = await snap(page);
  if (!list.menu.items.find((item) => item.id === weapon)?.enabled) { await tap(page, 'Escape'); return null; }
  await pick(page, weapon);
  await page.keyboard.press('Enter');
  await adv(page, 20);
  const struck = !/miss/i.test((await snap(page)).battle?.message ?? '');
  await film(page, `${name}-${struck ? 'hit' : 'miss'}`, FRAMES ? 1500 : 400, 20, keep);
  return struck;
}

/** Does one of the things on the pilot's menu that needs no aiming, and photographs what follows. */
async function act(page: Page, action: string, name: string, ms: number, step = 20): Promise<boolean> {
  const s = await until(page, (now) => now.battle?.phase === 'action' || now.battle?.phase === 'result');
  if (s.battle?.phase !== 'action' || !s.menu.items.find((item) => item.id === action)?.enabled) return false;
  await pick(page, action);
  await film(page, name, ms, step);
  return true;
}

test('the look of a battle: a gun, a beam and a shell, each photographed as it lands', async ({ page }) => {
  test.setTimeout(290000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await intoBattle(page, 'hadron-1');
  const log: string[] = [];
  const keepers: Record<string, Record<number, string>> = { rightHand: { 60: 'look-rifle' }, leftHand: { 100: 'look-beam' }, shoulder: { 320: 'look-shell' } };
  for (let turn = 0; turn < (FRAMES ? 3 : 1); turn++) {
    if (turn === 1) log.push(`boost: ${await act(page, 'boost', 't1-boost', 500)}`);
    if (turn === 2) log.push(`vent: ${await act(page, 'cool', 't2-vent', 700)}`);
    for (const weapon of turn === 0 ? ['rightHand', 'leftHand', 'shoulder'] : ['shoulder', 'leftHand']) {
      const struck = await volley(page, weapon, `t${turn}-${weapon}`, turn === 0 ? keepers[weapon] : {});
      log.push(`t${turn} ${weapon}: ${struck === null ? 'not fired' : struck ? 'hit' : 'miss'}`);
    }
    if (!FRAMES) break;
    if (turn === 0) log.push(`guard: ${await act(page, 'guard', 't0-guard', 600)}`);
    // The enemy's turn, photographed more coarsely: it is long.
    log.push(`end of turn: ${await act(page, 'endTurn', `t${turn}-enemy`, 3200, 40)}`);
  }
  console.log(log.join('\n'));
  expect(errors).toEqual([]);
});
