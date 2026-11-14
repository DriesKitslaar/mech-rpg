import type { Page } from '@playwright/test';
import { MEDAL_PAY } from '../src/core/medals';
import { MEDALS } from '../src/content/medals';

export type Snap = {
  screen: string; credits: number | null; battlesWon: number | null; message?: string;
  build: Record<string, string> | null; inventory: Record<string, number> | null;
  menu: { items: { id: string; label: string; enabled: boolean; note?: string }[]; cursor: number };
  battle?: {
    phase: string; outcome: string; round: number; message: string; mission: string; index: number; of: number;
    objective: string | null; spoken: string | null; enemies: string[];
  };
  scene?: string;
  ending?: string;
  /** On the title: which of its lists is showing. */
  mode?: string;
  /** On the pilot screen and in the database: the page showing. */
  page?: string;
  toast?: string | null;
  medals?: string[];
  slot?: number;
  callsign?: string | null;
  completed: string[] | null;
  settlement?: { net: number; won: boolean };
};

export const snap = (page: Page): Promise<Snap> => page.evaluate(() => (window as any).__game.snapshot());

/** What the medals a snapshot shows have paid: credits that no contract accounts for. */
export const medalPay = (s: Snap): number => (s.medals ?? []).reduce((sum, id) => sum + MEDAL_PAY[MEDALS.find((m) => m.id === id)!.tier], 0);

/** Waits two frames: input is handled on the frame after the key event. */
export const nextFrame = (page: Page): Promise<unknown> =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

export async function press(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await nextFrame(page);
}

export async function open(page: Page, url = '/?seed=7&fast=1'): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => (window as any).__game?.snapshot().screen === 'title');
}

/** Moves the cursor to the menu item with this id and confirms it. */
export async function choose(page: Page, id: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const s = await snap(page);
    if (s.menu.items[s.menu.cursor]?.id === id) { await press(page, 'Enter'); return; }
    await press(page, 'ArrowDown');
  }
  throw new Error(`menu item not found: ${id}`);
}

export async function waitForScreen(page: Page, screen: string): Promise<void> {
  await page.waitForFunction((name) => (window as any).__game.snapshot().screen === name, screen);
}

export async function waitForPhase(page: Page, phase: string): Promise<void> {
  await page.waitForFunction((name) => (window as any).__game.snapshot().battle?.phase === name, phase);
}

/**
 * From wherever a new or continued game has got to, on to the hub: takes the slot under the cursor,
 * accepts the callsign on offer, and reads past whatever pages of story are due.
 */
export async function enterHub(page: Page): Promise<void> {
  for (let i = 0; i < 12; i++) {
    const s = await snap(page);
    if (s.screen === 'hub') return;
    const waiting = ['callsign', 'scene', 'ending'].includes(s.screen) || (s.screen === 'title' && s.mode !== undefined && s.mode !== 'main');
    if (waiting) await press(page, 'Enter');
    else await nextFrame(page);
  }
  await waitForScreen(page, 'hub');
}

/** From the title screen into the first battle, waiting until the player may act. */
export async function startBattle(page: Page, url?: string): Promise<void> {
  await open(page, url);
  await choose(page, 'new');
  await enterHub(page);
  await acceptContract(page, 'intro-1');
}

/** From the hub: open the contract list, the briefing, and accept. Waits until the player may act. */
export async function acceptContract(page: Page, missionId: string): Promise<void> {
  await choose(page, 'contracts');
  await choose(page, missionId);
  await waitForScreen(page, 'briefing');
  await choose(page, 'accept');
  await waitForPhase(page, 'action');
}

/** Plays every battle of the current contract until the settlement appears. */
export async function finishMission(page: Page): Promise<void> {
  for (let i = 0; i < 4; i++) {
    if ((await snap(page)).screen !== 'battle') break;
    await finishBattle(page);
    await press(page, 'Enter');
  }
  await waitForScreen(page, 'settlement');
}

/** Plays the current battle to its result by always firing the first weapon at the first target. */
export async function finishBattle(page: Page): Promise<Snap> {
  let s = await snap(page);
  for (let i = 0; i < 4000 && s.battle?.phase !== 'result'; i++) {
    const phase = s.battle?.phase;
    if (phase === 'weapon' || phase === 'target') await press(page, 'Enter');
    else if (phase === 'action') {
      const wanted = s.menu.items[0].enabled ? 'fire' : 'endTurn';
      await press(page, s.menu.items[s.menu.cursor]?.id === wanted ? 'Enter' : 'ArrowDown');
    } else await nextFrame(page);
    s = await snap(page);
  }
  return s;
}

/** Plays the current battle to its result with Auto Turn: the game's own automatic player takes every turn. */
export async function autoBattle(page: Page): Promise<Snap> {
  let s = await snap(page);
  for (let i = 0; i < 6000 && s.battle?.phase !== 'result'; i++) {
    if (s.battle?.phase === 'action') await press(page, s.menu.items[s.menu.cursor]?.id === 'auto' ? 'Enter' : 'ArrowDown');
    else if (s.battle?.phase === 'talk') await press(page, 'Enter');
    else await nextFrame(page);
    s = await snap(page);
  }
  return s;
}
