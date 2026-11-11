import type { Page } from '@playwright/test';

export type Snap = {
  screen: string; credits: number | null; battlesWon: number | null; message?: string;
  build: Record<string, string> | null; inventory: Record<string, number> | null;
  menu: { items: { id: string; label: string; enabled: boolean; note?: string }[]; cursor: number };
  battle?: { phase: string; outcome: string; round: number; message: string; encounter: string };
  settlement?: { net: number; won: boolean };
};

export const snap = (page: Page): Promise<Snap> => page.evaluate(() => (window as any).__game.snapshot());

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

/** From the title screen into the first battle, waiting until the player may act. */
export async function startBattle(page: Page, url?: string): Promise<void> {
  await open(page, url);
  await choose(page, 'new');
  await waitForScreen(page, 'hub');
  await choose(page, 'sortie');
  await waitForPhase(page, 'action');
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
