import { expect, test, type Page } from '@playwright/test';
import { swarmContract } from '../src/core/board';
import { completeMission } from '../src/core/campaign';
import { buy, equip, newGame, type GameState } from '../src/core/game';
import { BOARD_TEXT } from '../src/content/board';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { REFERENCE_BUILDS } from '../src/content/referenceBuilds';
import { choose, enterHub, nextFrame, open, press, snap, waitForPhase, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

/**
 * Opens the game on a saved one, with battles played faster and not hurried: what the message bar
 * says stays for a few frames, to be read by a test as by a pilot. Everything it says is kept.
 */
async function load(page: Page, save: GameState): Promise<void> {
  await page.addInitScript(({ data, settings }) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', data);
    if (!window.localStorage.getItem('ironwage-settings')) window.localStorage.setItem('ironwage-settings', settings);
  }, { data: JSON.stringify(save), settings: JSON.stringify({ ...save.settings, fastBattles: true }) });
  await open(page, '/?seed=7');
  await page.evaluate(() => {
    const said: string[] = [];
    (window as unknown as { __said: string[] }).__said = said;
    const tick = (): void => {
      const message = (window as unknown as { __game: { snapshot(): { battle?: { message: string } } } }).__game.snapshot().battle?.message;
      if (message && said.at(-1) !== message) said.push(message);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await choose(page, 'continue');
}
const heard = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __said: string[] }).__said);
/** Waits until nothing is announced over the screen and the screen has finished coming in: a picture of it is then a picture of it. */
async function still(page: Page): Promise<void> {
  await page.waitForFunction(() => !(window as unknown as { __game: { snapshot(): { toast?: string | null } } }).__game.snapshot().toast);
  for (let frame = 0; frame < 45; frame++) await nextFrame(page);
}
const saved = (page: Page): Promise<GameState> => page.evaluate(() => JSON.parse(window.localStorage.getItem('ironwage-save')!) as GameState);

/** A pilot past the introductions in a full Ronin: somebody who outguns a swarm. */
function ronin(): GameState {
  let game: GameState = { ...newGame(CATALOG, STARTER_BUILD, 'VANTA'), credits: 999999, scenes: ['act-1'] };
  for (const id of ['intro-1', 'intro-2']) game = completeMission(game, id, MISSIONS);
  for (const [slot, id] of Object.entries(REFERENCE_BUILDS.tier4)) {
    if (!game.inventory[id]) game = buy(game, id, CATALOG);
    game = equip(game, slot as keyof typeof game.build, id, CATALOG);
  }
  return { ...game, credits: 2000 };
}

test('a swarm: the briefing counts it, the field says how many are still to come, kills ready the weapon, and machines come on and leave', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const game = ronin();
  const swarm = swarmContract(game.battlesWon, game.cycle, BOARD_TEXT);
  const total = swarm.battles[0].enemies.length + swarm.battles[0].reserve!.length;
  await load(page, game);
  await enterHub(page);
  await choose(page, 'contracts');
  await choose(page, swarm.id);
  await waitForScreen(page, 'briefing');
  await still(page);
  await page.screenshot({ path: shot('swarm-briefing') });
  await choose(page, 'accept');
  await waitForPhase(page, 'action');
  expect((await snap(page)).battle).toMatchObject({ mission: swarm.id, objective: `${total - 3} MORE TO COME` });

  // Aiming at the first of them: one hit of a rail lance goes through a recon drone, and the line says so.
  await choose(page, 'fire');
  await press(page, 'Enter');
  await waitForPhase(page, 'target');
  await still(page);
  await page.screenshot({ path: shot('swarm-aim') });
  await press(page, 'Escape');
  await press(page, 'Escape');
  await waitForPhase(page, 'action');

  // Played out by firing whatever is ready.
  let shots = 0;
  let s = await snap(page);
  for (let i = 0; i < 20000 && s.battle?.phase !== 'result'; i++) {
    const phase = s.battle?.phase;
    // A machine has come on while others still stand: the field as a swarm looks in the middle of it.
    if (shots === 0 && phase === 'action' && s.battle!.round > 1 && s.battle!.objective !== null) { await page.screenshot({ path: shot('swarm-field') }); shots++; }
    if (phase === 'weapon' || phase === 'target') await press(page, 'Enter');
    else if (phase === 'action') {
      const wanted = s.menu.items[0].enabled ? 'fire' : 'endTurn';
      await press(page, s.menu.items[s.menu.cursor]?.id === wanted ? 'Enter' : 'ArrowDown');
    } else await nextFrame(page);
    s = await snap(page);
  }
  expect(s.battle).toMatchObject({ phase: 'result', outcome: 'victory', objective: null });
  const lines = await heard(page);
  expect(lines.some((line) => /SHATTERS Recon Drone/.test(line))).toBe(true);
  expect(lines.some((line) => /ready again$/.test(line))).toBe(true);
  expect(lines.some((line) => /^CHAIN x\d - /.test(line))).toBe(true);
  expect(lines.some((line) => /comes on - (\d more behind it|the last of them)$/.test(line))).toBe(true);
  // Every machine that was not on the field at the start was said to come on.
  expect(lines.filter((line) => / comes on - /.test(line))).toHaveLength(total - 3);
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  expect((await snap(page)).settlement).toMatchObject({ won: true });
  const after = await saved(page);
  // Every machine of it was destroyed or left, and the record counts the ones destroyed.
  expect(after.stats.kills).toBeGreaterThanOrEqual(total - 3);
  expect(after.stats.kills).toBeLessThanOrEqual(total);
  expect(after.battlesWon).toBe(game.battlesWon + 1);
  expect(errors).toEqual([]);
});

test('a name: the record shows the one the pilot has earned, and a battle against ordinary machines opens under it', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = ronin();
  // Eighty-five machines, five bosses and the top of the arena: what a first telling of the story leaves on the record.
  await load(page, { ...base, arenaRank: 15, stats: { ...base.stats, kills: 85, bosses: 5, contracts: 33 } });
  await enterHub(page);
  await choose(page, 'pilot');
  await waitForScreen(page, 'pilot');
  for (let i = 0; i < 4 && (await snap(page)).page !== 'record'; i++) await press(page, 'e');
  expect((await snap(page)).page).toBe('record');
  expect((await snap(page) as unknown as { known: object }).known).toEqual({ rank: 3, renown: 185, next: 320 });
  await still(page);
  await page.screenshot({ path: shot('pilot-name') });
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');

  await choose(page, 'contracts');
  await choose(page, 'patrol');
  await waitForScreen(page, 'briefing');
  await choose(page, 'accept');
  await waitForScreen(page, 'battle');
  // The banner is up for a second: half-way through it the band under it is there to be seen.
  for (let frame = 0; frame < 24; frame++) await nextFrame(page);
  expect((await snap(page)).message).toBe('TOTAL LOSS. Nobody quotes for a site you are near.');
  await page.screenshot({ path: shot('battle-name') });
  expect(errors).toEqual([]);
});
