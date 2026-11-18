import { expect, test, type Page } from '@playwright/test';
import { completeMission } from '../src/core/campaign';
import { newGame, type GameState } from '../src/core/game';
import { awardMedals } from '../src/core/medals';
import { xpForLevel } from '../src/core/pilot';
import type { FramePart } from '../src/core/types';
import { MEDALS } from '../src/content/medals';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { REFERENCE_BUILDS } from '../src/content/referenceBuilds';
import { SCENES } from '../src/content/scenes';
import { autoBattle, choose, enterHub, open, press, snap, waitForPhase, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

async function load(page: Page, save: GameState): Promise<void> {
  await page.addInitScript((data) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', data);
  }, JSON.stringify(save));
  await open(page);
  await choose(page, 'continue');
}

const saved = (page: Page): Promise<GameState> => page.evaluate(() => JSON.parse(window.localStorage.getItem('ironwage-save')!) as GameState);

/** From a settlement on to the hub, reading past whatever page of story the contract opened. */
async function enterHubFromSettlement(page: Page): Promise<void> {
  await press(page, 'Enter');
  await enterHub(page);
}

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

/**
 * A pilot who has finished the story once and is telling it again: the best frame the shop sells, the
 * first two contracts flown, and every medal that is due already handed over, so that none is
 * announced over the screens looked at here.
 */
function again(extra: Partial<GameState> = {}): GameState {
  let g = newGame(CATALOG, REFERENCE_BUILDS.tier6, 'VANTA');
  for (const id of ['intro-1', 'intro-2']) g = completeMission(g, id, MISSIONS);
  g = { ...g, cycle: 1, credits: 20000, xp: xpForLevel(12), medals: ['cycle'], scenes: SCENES.filter((s) => !s.ending).map((s) => s.id), ...extra };
  return awardMedals(g, MEDALS).game;
}
type Briefing = { briefing: { mission: string; reward: number; offers: number; client: string; turned: boolean } };
const briefing = async (page: Page) => (await snap(page) as unknown as Briefing).briefing;
/** Waits until no toast is up: the medal a loaded game is handed would lie over the foot of the briefing. */
const quiet = (page: Page) => page.waitForFunction(() => !(window as unknown as { __game: { snapshot(): { toast?: string | null } } }).__game.snapshot().toast);

test('the other offer: a later telling has two offers for a contract; the other side\'s is another fight, and taking it is remembered', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, again());
  await enterHub(page);
  await choose(page, 'contracts');
  await choose(page, 'hadron-1');
  await waitForScreen(page, 'briefing');
  expect(await briefing(page)).toMatchObject({ mission: 'hadron-1', offers: 2, turned: false, client: 'Director Brenn, Hadron Mining', reward: 2400 });
  expect((await snap(page)).menu.items.map((item) => item.label)).toEqual(['Accept', 'Wingman', 'Other offer', 'Back']);
  await quiet(page);
  await page.screenshot({ path: shot('briefing-two-offers') });
  await choose(page, 'other');
  expect(await briefing(page)).toMatchObject({ mission: 'hadron-1', offers: 2, turned: true, client: 'Tamsin, The Undertow', reward: 1350 });
  expect((await snap(page)).menu.items.map((item) => item.label)).toEqual(['Accept', 'First offer', 'Back']);
  await page.screenshot({ path: shot('briefing-other-offer') });

  // Their fight: not the drones of the first offer but the crew sent to clear the seam, with the tank firing for the pilot.
  await choose(page, 'accept');
  await waitForPhase(page, 'action');
  expect((await snap(page)).battle).toMatchObject({ mission: 'hadron-1', index: 0, of: 2, enemies: ['gun-turret', 'recon-drone', 'recon-drone'] });
  await page.screenshot({ path: shot('battle-other-offer') });
  for (let i = 0; i < 2 && (await snap(page)).screen === 'battle'; i++) {
    expect((await autoBattle(page)).battle).toMatchObject({ phase: 'result', outcome: 'victory' });
    await press(page, 'Enter');
  }
  await waitForScreen(page, 'settlement');
  expect((await snap(page)).settlement).toMatchObject({ won: true });
  await enterHubFromSettlement(page);

  // Remembered, and what comes of it has come: what was under the seat, and another letter from Brenn than his thanks.
  const after = await saved(page);
  expect(after.completed).toContain('hadron-1');
  expect(after.choices).toMatchObject({ seam: 'stand' });
  expect(after.codex).toContain('paper-order');
  await choose(page, 'messages');
  await waitForScreen(page, 'messages');
  const letters = (await snap(page)).menu.items.map((item) => item.id);
  expect(letters).toContain('brenn-seam');
  expect(letters).not.toContain('hadron-thanks');
  await choose(page, 'brenn-seam');
  await page.screenshot({ path: shot('letter-brenn-seam') });
  expect(errors).toEqual([]);
});

test('the other offer in Dutch: the header and the rows fit, and the fight for the weighbridge is one to hold out in', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = completeMission(again(), 'hadron-1', MISSIONS);
  await load(page, { ...base, settings: { ...base.settings, language: 'nl' } });
  await enterHub(page);
  await choose(page, 'contracts');
  await choose(page, 'hadron-2');
  await waitForScreen(page, 'briefing');
  expect((await snap(page)).menu.items.map((item) => item.label)).toEqual(['Aannemen', 'Wingman', 'Ander bod', 'Terug']);
  await choose(page, 'other');
  expect(await briefing(page)).toMatchObject({ mission: 'hadron-2', turned: true, client: 'Tamsin, de Undertow', reward: 1650 });
  expect((await snap(page)).menu.items.map((item) => item.label)).toEqual(['Aannemen', 'Wingman', 'Eerste bod', 'Terug']);
  await quiet(page);
  await page.screenshot({ path: shot('briefing-other-offer-nl') });
  await choose(page, 'accept');
  await waitForPhase(page, 'action');
  expect((await snap(page)).battle).toMatchObject({ mission: 'hadron-2', index: 0, of: 1, enemies: ['heavy-mech', 'tank', 'gun-turret'], round: 1 });
  await page.screenshot({ path: shot('battle-weighbridge-nl') });
  const end = await autoBattle(page);
  expect(end.battle).toMatchObject({ phase: 'result', outcome: 'victory', round: 5 });
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  expect((await saved(page)).choices).toMatchObject({ train: 'weigh' });
  expect(errors).toEqual([]);
});
