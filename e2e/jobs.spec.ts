import { expect, test, type Page } from '@playwright/test';
import type { Archetype } from '../src/core/archetype';
import { completeMission } from '../src/core/campaign';
import { BUILD_SLOTS, buy, equip, newGame, saveLoadout, type GameState } from '../src/core/game';
import { jobContract, type JobKind } from '../src/core/jobs';
import type { Build } from '../src/core/types';
import { ALL_ENEMIES } from '../src/content/arena';
import { ARCHETYPE_BUILDS } from '../src/content/archetypeBuilds';
import { BOARD_TEXT } from '../src/content/board';
import { WORLD } from '../src/content/codex';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { SCENES } from '../src/content/scenes';
import { autoBattle, choose, nextFrame, oddsCounted, open, press, snap, waitForPhase, waitForScreen } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

/** The game with a build bought and fitted, whatever it costs. */
function wearing(base: GameState, build: Build): GameState {
  let game: GameState = { ...base, credits: 9_999_999 };
  const parts = Object.values(build).filter((id): id is string => id !== undefined);
  for (const id of new Set(parts)) while ((game.inventory[id] ?? 0) < parts.filter((other) => other === id).length) game = buy(game, id, CATALOG);
  for (let pass = 0; pass < 2; pass++) {
    for (const slot of BUILD_SLOTS) {
      const id = build[slot];
      try {
        if (id === undefined && game.build[slot] !== undefined) game = equip(game, slot, null, CATALOG);
        else if (id !== undefined && game.build[slot] !== id) game = equip(game, slot, id, CATALOG);
      } catch { /* the next pass */ }
    }
  }
  return { ...game, credits: base.credits };
}
/** Battles won at which each kind is on offer, late in the war: the board at its sixth tier. */
const AT: Record<JobKind, number> = { hit: 32, repo: 33, escort: 30, hold: 31 };
/** A pilot late in the war in the late build of a class, a bastion and a duellist saved; every page read. */
function pilot(kind: JobKind, flown: Archetype, extra: Partial<GameState> = {}): GameState {
  let g = newGame(CATALOG, STARTER_BUILD, 'VANTA');
  for (const id of ['intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'hadron-2', 'lumen-2', 'undertow-2', 'rival-1', 'choice-lumen', 'lumen-3']) g = completeMission(g, id, MISSIONS);
  g = saveLoadout(wearing(g, ARCHETYPE_BUILDS.bastion.late), 0);
  g = saveLoadout(wearing(g, ARCHETYPE_BUILDS.duellist.late), 1);
  g = wearing(g, ARCHETYPE_BUILDS[flown].late);
  return {
    ...g, credits: 4200, xp: 6000, battlesWon: AT[kind], arenaRank: 6, scenes: SCENES.map((scene) => scene.id), codex: WORLD.map((entry) => entry.id),
    lessons: ['momentum', 'rout'], ...extra,
  };
}
const jobOf = (kind: JobKind) => jobContract(AT[kind], 0, BOARD_TEXT)!;
async function load(page: Page, save: unknown, url = '/?seed=7'): Promise<void> {
  await page.addInitScript(({ data, settings }) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', data);
    if (!window.localStorage.getItem('ironwage-settings')) window.localStorage.setItem('ironwage-settings', settings);
  }, { data: JSON.stringify(save), settings: JSON.stringify({ ...(save as GameState).settings, fastBattles: true }) });
  await open(page, url);
  await choose(page, 'continue');
  await waitForScreen(page, 'hub');
}
const kept = (page: Page): Promise<GameState> => page.evaluate(() => JSON.parse(window.localStorage.getItem('ironwage-save')!) as GameState);
const settle = async (page: Page, frames = 40): Promise<void> => { for (let i = 0; i < frames; i++) await nextFrame(page); };
const typed = async (page: Page): Promise<void> => {
  for (let i = 0; i < 80 && (await snap(page) as unknown as { typing?: boolean }).typing; i++) await page.waitForTimeout(100);
};
async function toRow(page: Page, id: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const s = await snap(page);
    if (s.menu.items[s.menu.cursor]?.id === id) return;
    await press(page, 'ArrowDown');
  }
  throw new Error(`no row ${id}`);
}
const briefing = async (page: Page): Promise<unknown> => (await snap(page) as unknown as { briefing: unknown }).briefing;
type Field = { mission: string; objective: string | null; outcome: string; note: string | null; round: number; elites: { id: string; mark: string }[]; enemies: string[] };
const field = async (page: Page): Promise<Field> => (await snap(page)).battle as unknown as Field;
/** To the briefing of the job on offer, with its words written out and its odds counted; pictured there. */
async function brief(page: Page, kind: JobKind, picture: string): Promise<void> {
  await choose(page, 'contracts');
  await toRow(page, `open-0-${AT[kind]}-job`);
  await press(page, 'Enter');
  await waitForScreen(page, 'briefing');
  await typed(page);
  await oddsCounted(page);
  await settle(page);
  await page.screenshot({ path: shot(picture) });
}
/** Plays the battle on screen to its result without doing anything in it. */
async function idle(page: Page): Promise<void> {
  for (let i = 0; i < 6000; i++) {
    const s = await snap(page);
    if (s.battle?.phase === 'result') return;
    if (s.battle?.phase === 'action') await choose(page, 'endTurn');
    else if (s.battle?.phase === 'talk') await press(page, 'Enter');
    else await nextFrame(page);
  }
  throw new Error('the battle did not end');
}

test('a hit: on the list by its title, briefed by its kind, the marked machine on the field, and over when it falls', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const job = jobOf('hit');
  await load(page, pilot('hit', 'duellist'));
  // The list: the board's three, the job, the swarm.
  await choose(page, 'contracts');
  const rows = (await snap(page)).menu.items;
  const at = rows.findIndex((row) => row.id === job.id);
  expect(rows[at]).toMatchObject({ label: job.title, note: String(job.reward) });
  expect(job.title).toMatch(/^Hit: /);
  expect(rows.slice(at - 3, at + 2).map((row) => row.id)).toEqual(['open-0-32-0', 'open-0-32-1', 'open-0-32-2', 'open-0-32-job', 'open-0-32-swarm']);
  await toRow(page, job.id);
  await settle(page);
  await page.screenshot({ path: shot('contracts-job') });
  await press(page, 'Escape');
  await waitForScreen(page, 'hub');
  await brief(page, 'hit', 'job-hit-briefing');
  const target = (job.battles[0].objective as { target: number }).target;
  const name = ALL_ENEMIES[job.battles[0].enemies[target]].name;
  expect(await briefing(page)).toMatchObject({ mission: job.id, reward: job.reward, objectives: [`Destroy: ${name}`] });
  await choose(page, 'accept');
  await waitForPhase(page, 'action');
  expect(await field(page)).toMatchObject({ objective: `TARGET: ${name.toUpperCase()}`, elites: [{ id: `enemy-${target}`, mark: 'overclocked' }] });
  await settle(page, 30);
  await page.screenshot({ path: shot('job-hit-field') });
  await autoBattle(page);
  expect(await field(page)).toMatchObject({ outcome: 'victory', note: 'Their leader is down.' });
  await settle(page, 60);
  await page.screenshot({ path: shot('job-hit-won') });
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  expect((await snap(page)).settlement).toMatchObject({ won: true, reward: job.reward });
  await settle(page, 90);
  await page.screenshot({ path: shot('job-hit-settlement') });
  expect((await kept(page)).jobs).toEqual({ hit: 1 });
  // In the hub the board has turned: the job on offer is a repossession.
  await press(page, 'Enter');
  await waitForScreen(page, 'hub');
  await choose(page, 'contracts');
  expect((await snap(page)).menu.items.find((row) => row.id.endsWith('-job'))!.label).toMatch(/^Repo: /);
  expect(errors).toEqual([]);
});

test('a repossession: the aim starts on what has to come off, and the machine is taken with its core whole', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const job = jobOf('repo');
  const name = ALL_ENEMIES[job.battles[0].enemies[0]].name;
  await load(page, pilot('repo', 'marksman'));
  await brief(page, 'repo', 'job-repo-briefing');
  expect(await briefing(page)).toMatchObject({ mission: job.id, reward: job.reward, objectives: [`Disable, do not destroy: ${name}`] });
  await choose(page, 'accept');
  await waitForPhase(page, 'action');
  expect(await field(page)).toMatchObject({ objective: `DISABLE: ${name.toUpperCase()}`, elites: [] });
  // Fire, the first weapon that will, at the wanted machine: the part offered first is a limb, not the core.
  await choose(page, 'fire');
  await waitForPhase(page, 'weapon');
  const weapons = (await snap(page)).menu.items;
  await choose(page, weapons.find((item) => item.enabled)!.id);
  for (let i = 0; i < 20 && (await snap(page)).battle?.phase !== 'target'; i++) await press(page, 'Enter');
  const aim = await snap(page);
  expect((aim.battle as unknown as { targetId: string }).targetId).toBe('enemy-0');
  expect(['legs', 'arms']).toContain(aim.menu.items[aim.menu.cursor].id);
  await settle(page, 30);
  await page.screenshot({ path: shot('job-repo-aim') });
  await press(page, 'Escape');
  await press(page, 'Escape');
  await press(page, 'Escape');
  await waitForPhase(page, 'action');
  await autoBattle(page);
  expect(await field(page)).toMatchObject({ outcome: 'victory', note: 'Disabled, in one piece.' });
  expect((await field(page)).enemies).toContain(job.battles[0].enemies[0]);
  await settle(page, 60);
  await page.screenshot({ path: shot('job-repo-won') });
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  expect((await snap(page)).settlement).toMatchObject({ won: true, reward: job.reward });
  expect((await kept(page)).jobs).toEqual({ repo: 1 });
  expect(errors).toEqual([]);
});

test('an escort: the freight\'s meter on the field, and the job lost when it is gone', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const job = jobOf('escort');
  const asset = job.battles[0].objective as { name: string; hp: number };
  await load(page, pilot('escort', 'bastion'));
  await brief(page, 'escort', 'job-escort-briefing');
  expect(await briefing(page)).toMatchObject({ mission: job.id, reward: job.reward, objectives: [`Protect: ${asset.name}`] });
  // An escort is a race: the duellist saved second has odds no worse than the bastion on the floor. Turned to, and flown from.
  type Chosen = { odds: { won: number; played: number }; build: { slot: number | null; kind: string } };
  const chosen = async (): Promise<Chosen> => (await snap(page) as unknown as { briefing: Chosen }).briefing;
  const first = await chosen();
  expect(first.build).toMatchObject({ slot: null, kind: 'bastion' });
  await toRow(page, 'build');
  await press(page, 'ArrowRight');
  await oddsCounted(page);
  const second = await chosen();
  expect(second.build).toMatchObject({ slot: 1, kind: 'duellist' });
  expect(second.odds.won).toBeGreaterThanOrEqual(first.odds.won);
  expect(second.odds.won).toBeGreaterThanOrEqual(17);
  await settle(page);
  await page.screenshot({ path: shot('job-escort-briefing-duellist') });
  await choose(page, 'accept');
  await waitForPhase(page, 'action');
  expect(await field(page)).toMatchObject({ objective: `${asset.name.toUpperCase()} ${asset.hp}/${asset.hp}` });
  await settle(page, 30);
  await page.screenshot({ path: shot('job-escort-field') });
  await idle(page);
  expect(await field(page)).toMatchObject({ outcome: 'defeat', note: `${asset.name}: lost.` });
  await settle(page, 60);
  await page.screenshot({ path: shot('job-escort-lost') });
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  expect((await snap(page)).settlement).toMatchObject({ won: false });
  expect((await kept(page)).jobs).toBeUndefined();
  expect(errors).toEqual([]);
});

test('a holding action: the rounds counted on the field with those still to come, and won when the sixth is over', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const job = jobOf('hold');
  await load(page, pilot('hold', 'bastion'));
  await brief(page, 'hold', 'job-hold-briefing');
  expect(await briefing(page)).toMatchObject({ mission: job.id, reward: job.reward, objectives: ['Hold out for 6 rounds', '4 more come on as they fall'] });
  await choose(page, 'accept');
  await waitForPhase(page, 'action');
  expect(await field(page)).toMatchObject({ objective: 'HOLD OUT 1/6  +4', round: 1 });
  await settle(page, 30);
  await page.screenshot({ path: shot('job-hold-field') });
  await autoBattle(page);
  expect(await field(page)).toMatchObject({ outcome: 'victory', note: 'You held the line.' });
  await settle(page, 60);
  await page.screenshot({ path: shot('job-hold-won') });
  await press(page, 'Enter');
  await waitForScreen(page, 'settlement');
  expect((await snap(page)).settlement).toMatchObject({ won: true, reward: job.reward });
  expect((await kept(page)).jobs).toEqual({ hold: 1 });
  expect(errors).toEqual([]);
});

test('the jobs in Dutch: on the list, at the briefing and on the field', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = pilot('hold', 'bastion');
  await load(page, { ...base, settings: { ...base.settings, language: 'nl' } });
  await choose(page, 'contracts');
  const row = (await snap(page)).menu.items.find((item) => item.id === 'open-0-31-job')!;
  expect(row.label).toMatch(/^Stand: /);
  await toRow(page, 'open-0-31-job');
  await settle(page);
  await page.screenshot({ path: shot('nl-contracts-job') });
  await press(page, 'Enter');
  await waitForScreen(page, 'briefing');
  await typed(page);
  await oddsCounted(page);
  await settle(page);
  expect(await briefing(page)).toMatchObject({ objectives: ['Houd 6 rondes vol', 'Nog 4 volgen als er een valt'] });
  await page.screenshot({ path: shot('nl-job-hold-briefing') });
  await choose(page, 'accept');
  await waitForPhase(page, 'action');
  expect(await field(page)).toMatchObject({ objective: 'HOUD VOL 1/6  +4' });
  await settle(page, 30);
  await page.screenshot({ path: shot('nl-job-hold-field') });
  expect(errors).toEqual([]);
});
