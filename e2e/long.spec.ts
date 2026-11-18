import { expect, test, type Page } from '@playwright/test';
import { newGame, type GameState } from '../src/core/game';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import type { FramePart } from '../src/core/types';
import { choose, enterHub, open, press, snap, waitForPhase, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

async function load(page: Page, save: GameState): Promise<void> {
  await page.addInitScript((data) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', data);
  }, JSON.stringify(save));
  await open(page);
  await choose(page, 'continue');
}

const saved = (page: Page): Promise<GameState> => page.evaluate(() => JSON.parse(window.localStorage.getItem('ironwage-save')!) as GameState);

test('the bench: a part is put on it from the garage, a step is paid for and saved, and the mech flies with it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const core = CATALOG['core-hauler'] as FramePart;
  await load(page, { ...newGame(CATALOG, STARTER_BUILD, 'VANTA'), credits: 9000, scenes: ['act-1'] });
  await enterHub(page);
  await choose(page, 'garage');
  await waitForScreen(page, 'garage');
  await choose(page, 'core');
  // R1 (the E key) puts the part under the cursor on the bench.
  await press(page, 'e');
  const before = await snap(page);
  expect((before as unknown as { garage: { mode: string; bench: { step: number; cap: number; cost: number } } }).garage)
    .toMatchObject({ mode: 'bench', bench: { step: 0, cap: 2, cost: core.price } });
  expect(before.menu.items[0]).toMatchObject({ id: 'tune', label: 'Tune to +1', enabled: true });
  await page.screenshot({ path: shot('garage-bench') });
  const had = before.credits!;
  await press(page, 'Enter');
  await press(page, 'Enter');
  // Two steps: the price, and twice the price; the first step a pilot ever takes also earns a medal that pays.
  const after = await saved(page);
  expect(after.tuning).toEqual({ 'core-hauler': 2 });
  expect(after.medals).toContain('bench-1');
  expect((await snap(page)).credits).toBe(had - 3 * core.price + 100);
  expect((await snap(page)).menu.items[0]).toMatchObject({ label: 'No further this cycle', enabled: false });
  await page.screenshot({ path: shot('garage-bench-limit') });
  // Back through the list of parts to the slots: the step follows the part's name.
  await press(page, 'Escape');
  await press(page, 'Escape');
  expect((await snap(page)).menu.items.find((item) => item.id === 'core')!.note).toBe(`${core.name} +2`);
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');

  // Into a battle: the core has a tenth more armour than the factory gave it.
  await choose(page, 'contracts');
  await choose(page, 'intro-1');
  await waitForScreen(page, 'briefing');
  await choose(page, 'accept');
  await waitForPhase(page, 'action');
  const frame = ['head-scout-mk1', 'core-hauler', 'arms-rigger', 'legs-strider'].map((id) => (CATALOG[id] as FramePart).ap);
  const expected = frame.reduce((sum, ap) => sum + ap, 0) - core.ap + Math.round(core.ap * 1.1);
  expect((await snap(page) as unknown as { player: { maxAp: number } }).player.maxAp).toBe(expected);
  expect(errors).toEqual([]);
});
