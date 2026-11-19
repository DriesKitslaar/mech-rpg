import { expect, test, type Page } from '@playwright/test';
import { swarmContract } from '../src/core/board';
import { LESSONS, completeMission } from '../src/core/campaign';
import { buy, equip, newGame, type GameState } from '../src/core/game';
import { BOARD_TEXT } from '../src/content/board';
import { LESSON_LINES } from '../src/content/drills';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { REFERENCE_BUILDS } from '../src/content/referenceBuilds';
import { choose, enterHub, nextFrame, open, press, snap, waitForPhase, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

/**
 * Opens the game on a saved one, with battles played faster and not hurried: what the message bar
 * says stays for a few frames, to be read by a test as by a pilot. Everything it says is kept.
 */
async function load(page: Page, save: GameState, seed = 7): Promise<void> {
  await page.addInitScript(({ data, settings }) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', data);
    if (!window.localStorage.getItem('ironwage-settings')) window.localStorage.setItem('ironwage-settings', settings);
  }, { data: JSON.stringify(save), settings: JSON.stringify({ ...save.settings, fastBattles: true }) });
  await open(page, `/?seed=${seed}`);
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
/**
 * Waits until nothing is announced over the screen and the screen has finished coming in: a picture of it is then a
 * picture of it. Announcements come one after another, so it is still once none has been up for forty-five frames running.
 */
async function still(page: Page): Promise<void> {
  for (let quiet = 0; quiet < 45;) {
    const up = await page.evaluate(() => !!(window as unknown as { __game: { snapshot(): { toast?: string | null } } }).__game.snapshot().toast);
    quiet = up ? 0 : quiet + 1;
    await nextFrame(page);
  }
}
const saved = (page: Page): Promise<GameState> => page.evaluate(() => JSON.parse(window.localStorage.getItem('ironwage-save')!) as GameState);

/**
 * A pilot past the introductions in a full Ronin: somebody who outguns a swarm. One who has been `told`
 * has had everything explained that is explained once, and nothing is said over their battles.
 */
function ronin(told = true): GameState {
  let game: GameState = { ...newGame(CATALOG, STARTER_BUILD, 'VANTA'), credits: 999999, scenes: ['act-1'] };
  for (const id of ['intro-1', 'intro-2']) game = completeMission(game, id, MISSIONS);
  for (const [slot, id] of Object.entries(REFERENCE_BUILDS.tier4)) {
    if (!game.inventory[id]) game = buy(game, id, CATALOG);
    game = equip(game, slot as keyof typeof game.build, id, CATALOG);
  }
  return { ...game, credits: 2000, ...(told ? { lessons: [...LESSONS] } : {}) };
}

type Fought = { phase: string; outcome: string; spoken: string | null; message: string; enemies: string[]; targetId: string | null };
const fought = async (page: Page): Promise<Fought> => (await snap(page)).battle as unknown as Fought;
/** Reads past whatever is being said over the battle, to the menu or the result. Returns what was said. */
async function listen(page: Page): Promise<string[]> {
  const said: string[] = [];
  for (let i = 0; i < 6000; i++) {
    const b = await fought(page);
    if (b.phase === 'action' || b.phase === 'result') return said;
    if (b.phase === 'talk') {
      // A line takes two presses where it is still being written: one to finish it, one to go on.
      if (said.at(-1) !== b.spoken) said.push(b.spoken!);
      await press(page, 'Enter');
    } else await nextFrame(page);
  }
  throw new Error('the battle never handed the turn over');
}
/** Waits for the battle to have something for the pilot: a line being said, the menu, or the result. */
async function awaited(page: Page): Promise<Fought> {
  for (let i = 0; i < 6000; i++) {
    const b = await fought(page);
    if (['talk', 'action', 'result'].includes(b.phase)) return b;
    await nextFrame(page);
  }
  throw new Error('the battle never came to rest');
}

test('a swarm: the briefing counts it, the field says how many are still to come, kills ready the weapon, machines come on, and every one of them is destroyed or leaves', async ({ page }) => {
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
  // Every machine that was not on the field at the start was said to come on: one by its name, several in one line by their number.
  const came = lines.map((line) => /^(\d) machines come on - (\d more behind them|the last of them)$/.exec(line)?.[1] ?? (/ comes on - (\d more behind it|the last of them)$/.test(line) ? '1' : '0'));
  expect(came.reduce((sum, n) => sum + Number(n), 0)).toBe(total - 3);
  // A weapon is never called ready in the same breath as the field is called clear.
  expect(lines.some((line) => /ready again/.test(line) && /clear/.test(line))).toBe(false);
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  expect((await snap(page)).settlement).toMatchObject({ won: true });
  const after = await saved(page);
  // Every machine of it was destroyed or left: the record counts the ones destroyed, and each that left was said to.
  const left = lines.filter((line) => / (breaks off|shuts down)$/.test(line)).length;
  expect(after.stats.kills - game.stats.kills + left).toBe(total);
  expect(after.stats.kills - game.stats.kills).toBeGreaterThanOrEqual(total - 3);
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

test('what an open battle gives: practised in the simulator, where nothing of Dispatch\'s is said, and said once in the field', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // A pilot who has been told nothing yet.
  const game = ronin(false);
  expect(game.lessons).toBeUndefined();
  await load(page, game);
  await enterHub(page);

  // The simulator: thirteen drills, the two about open battles at the foot of the list.
  await choose(page, 'training');
  await waitForScreen(page, 'training');
  let s = await snap(page);
  expect(s.menu.items.map((item) => item.id).slice(-2)).toEqual(['drill-momentum', 'drill-swarm']);
  expect(s.menu.items).toHaveLength(13);
  for (let i = 0; i < 20 && s.menu.items[s.menu.cursor].id !== 'drill-momentum'; i++) { await press(page, 'ArrowDown'); s = await snap(page); }
  expect(s.menu.items[s.menu.cursor]).toMatchObject({ id: 'drill-momentum', label: 'Follow Through', enabled: true });
  await still(page);
  await page.screenshot({ path: shot('training-follow-through') });
  await press(page, 'Enter');
  await waitForScreen(page, 'briefing');
  await choose(page, 'accept');
  await waitForScreen(page, 'battle');
  // The simulator says what to do; the banner of this drill reads MOMENTUM, which no other drill's does.
  const opening = await listen(page);
  expect(opening).toHaveLength(1);
  expect(opening[0]).toMatch(/DESTROYS/);

  // The lance at a drone: the enforcer stands first, a drone is one step along.
  const aimAtDrone = async (): Promise<void> => {
    await choose(page, 'fire');
    await press(page, 'Enter');
    await waitForPhase(page, 'target');
    for (let i = 0; i < 3 && (await fought(page)).targetId === 'enemy-0' && (await fought(page)).enemies.includes('recon-drone'); i++) await press(page, 'e');
  };
  await aimAtDrone();
  expect((await fought(page)).targetId).not.toBe('enemy-0');
  await still(page);
  await page.screenshot({ path: shot('drill-follow-through-aim') });
  // Played out as it is taught: the lance at a drone for as long as it is ready, then the turn is ended.
  let pictured = false;
  for (let i = 0; i < 40 && (await fought(page)).phase !== 'result'; i++) {
    const b = await fought(page);
    if (b.phase === 'target') { await press(page, 'Enter'); await listen(page); continue; }
    s = await snap(page);
    // Two drones down in one turn: the enforcer has lost its nerve and still stands.
    if (!pictured && /^CHAIN x2/.test(b.message) && b.enemies.length === 1) { await still(page); await page.screenshot({ path: shot('drill-follow-through-chain') }); pictured = true; }
    if (s.menu.items.find((item) => item.id === 'fire')?.enabled) await aimAtDrone();
    else { await choose(page, 'endTurn'); await listen(page); }
  }
  const lines = await heard(page);
  expect((await fought(page)).outcome).toBe('victory');
  expect(pictured).toBe(true);
  expect(lines.some((line) => /^Rail Lance ready again$/.test(line))).toBe(true);
  expect(lines.some((line) => /^CHAIN x2 - /.test(line))).toBe(true);
  expect(lines.some((line) => /Enforcer loses its nerve$/.test(line))).toBe(true);
  expect(lines.some((line) => /Enforcer breaks off$/.test(line))).toBe(true);
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  let kept = await saved(page);
  expect(kept.drills).toContain('drill-momentum');
  // The simulator has its own voice: nothing of what Dispatch explains once was said, or counted as said.
  expect(kept.lessons).toBeUndefined();
  await press(page, 'Enter');
  await waitForScreen(page, 'training');
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');

  // In the field: the first drone that falls to a weapon that is ready again, and Dispatch says why. Once.
  await choose(page, 'contracts');
  await choose(page, 'patrol');
  await waitForScreen(page, 'briefing');
  await choose(page, 'accept');
  await waitForScreen(page, 'battle');
  expect(await listen(page)).toEqual([]);
  let told: string | null = null;
  for (let i = 0; i < 12 && told === null && (await fought(page)).phase === 'action'; i++) {
    s = await snap(page);
    if (!s.menu.items.find((item) => item.id === 'fire')?.enabled) { await choose(page, 'endTurn'); await listen(page); continue; }
    const before = (await fought(page)).enemies.length;
    await choose(page, 'fire');
    await press(page, 'Enter');
    await waitForPhase(page, 'target');
    await press(page, 'Enter');
    const b = await awaited(page);
    if (b.phase === 'talk') told = b.spoken;
    else expect(b.enemies.length, 'a kill that left the weapon ready was not explained').toBe(before);
  }
  expect(told).toBe(LESSON_LINES.momentum.text);
  await still(page);
  // The line is written out a letter at a time: photographed once it is all there.
  for (let frame = 0; frame < 240; frame++) await nextFrame(page);
  await page.screenshot({ path: shot('lesson-momentum') });
  // It is in the kept game while the battle is still being fought.
  kept = await saved(page);
  expect(kept.lessons).toEqual(['momentum']);
  expect(await listen(page)).toEqual([LESSON_LINES.momentum.text]);
  expect((await fought(page)).message).toMatch(/ ready again$/);
  expect(errors).toEqual([]);
});

