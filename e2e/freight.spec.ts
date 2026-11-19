import { expect, test, type Page } from '@playwright/test';
import { completeMission } from '../src/core/campaign';
import { BUILD_SLOTS, buy, equip, newGame, type GameState } from '../src/core/game';
import { MECH_ENEMIES } from '../src/core/board';
import { jobContract, jobKind } from '../src/core/jobs';
import type { Build } from '../src/core/types';
import { ARCHETYPE_BUILDS } from '../src/content/archetypeBuilds';
import { BOARD_TEXT } from '../src/content/board';
import { WORLD } from '../src/content/codex';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { SCENES } from '../src/content/scenes';
import { snap, type Snap } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;

/**
 * What an escort keeps alive, on the field. The game is opened with its clock stopped (?step=1) and
 * stepped by hand, so that the moment the freight is struck can be looked at.
 */

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
/** A pilot late in the war with so many contracts won; every page read. */
function pilot(wins: number, build: Build, done: string[] = [], extra: Partial<GameState> = {}): GameState {
  let g = newGame(CATALOG, STARTER_BUILD, 'VANTA');
  for (const id of ['intro-1', 'intro-2', ...done]) g = completeMission(g, id, MISSIONS);
  g = wearing(g, build);
  return {
    ...g, credits: 4200, xp: 6000, battlesWon: wins, arenaRank: 6, scenes: SCENES.map((scene) => scene.id), codex: WORLD.map((entry) => entry.id),
    lessons: ['momentum', 'rout'], ...extra,
  };
}
/** The escorts the board offers late in a first telling, by the place they are in: the first of each. */
const ESCORTS = (() => {
  const found = new Map<string, { wins: number; sprite: string; name: string }>();
  for (let wins = 30; wins < 400; wins++) {
    if (jobKind(wins, 0) !== 'escort') continue;
    const [battle] = jobContract(wins, 0, BOARD_TEXT)!.battles;
    const freight = battle.objective as { name: string; sprite: string };
    if (!found.has(battle.background)) found.set(battle.background, { wins, sprite: freight.sprite, name: freight.name });
  }
  return [...found.values()];
})();
/** One the board fields a mech against, first in the line: the widest machine there can be beside the freight. */
const AGAINST_A_MECH = (() => {
  for (let wins = 30; wins < 400; wins++) {
    if (jobKind(wins, 0) !== 'escort') continue;
    const [battle] = jobContract(wins, 0, BOARD_TEXT)!.battles;
    if (battle.enemies.length === 3 && MECH_ENEMIES.includes(battle.enemies[0])) return wins;
  }
  throw new Error('no escort against a mech');
})();

const adv = (page: Page, ms: number): Promise<void> => page.evaluate((n) => (window as any).__game.advance(n), ms);
async function tap(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await adv(page, 48);
}
type Seen = Snap & { list?: string; busy?: boolean };
type Field = { phase: string; outcome: string; round: number; note: string | null; asset: { hp: number; max: number } | null; freight: { sprite: string; x: number; y: number; w: number; h: number } | null };
const field = async (page: Page): Promise<Field> => (await snap(page)).battle as unknown as Field;
async function open(page: Page, save: GameState, settings: Record<string, unknown> = {}): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(({ kept, options }) => {
    if (!window.localStorage.getItem('ironwage-save')) {
      window.localStorage.setItem('ironwage-save', kept);
      window.localStorage.setItem('ironwage-settings', options);
    }
  }, { kept: JSON.stringify(save), options: JSON.stringify({ ...save.settings, sfx: false, music: false, fastBattles: false, ...settings }) });
  await page.goto('/?seed=7&step=1');
  await page.waitForFunction(() => (window as any).__game?.snapshot().screen === 'title');
  await adv(page, 600);
  return errors;
}
/** Down a list to a row and into it. */
async function pick(page: Page, id: string): Promise<void> {
  for (let i = 0; i < 80; i++) {
    const s = await snap(page) as Seen;
    if (s.menu.items[s.menu.cursor]?.id === id) { await tap(page, 'Enter'); await adv(page, 160); return; }
    await tap(page, 'ArrowDown');
  }
  throw new Error(`no row ${id}`);
}
/** From the title into a contract's first battle (or, by way of the simulator, a drill's), to the first moment the pilot may act. */
async function fly(page: Page, missionId: string, by: 'contracts' | 'training' = 'contracts'): Promise<void> {
  for (let i = 0; i < 400; i++) {
    const s = await snap(page) as Seen;
    if (s.screen === 'battle' && s.battle?.phase === 'action') return;
    if (s.busy) await adv(page, 96);
    else if (s.screen === 'title') await pick(page, 'continue');
    else if (s.screen === 'hub' && (!s.list || s.list === 'main')) await pick(page, by);
    else if (s.screen === 'hub' || s.screen === 'training') await pick(page, missionId);
    else if (s.screen === 'briefing') await pick(page, 'accept');
    else if (s.screen === 'battle' && s.battle?.phase === 'talk') { await tap(page, 'Enter'); await adv(page, 160); }
    else if (s.screen === 'battle') await adv(page, 160);
    else { await tap(page, 'Enter'); await adv(page, 320); }
  }
  throw new Error(`never came to act in ${missionId}`);
}
/**
 * Ends the pilot's turn and steps the game on, a little at a time, until the freight has lost something and the
 * screen has come to say so (the rules are a message ahead of what is shown), or the battle is over.
 */
async function untilStruck(page: Page, name: string): Promise<Field> {
  const before = (await field(page)).asset!.hp;
  for (let i = 0; i < 6000; i++) {
    const s = await snap(page) as Seen;
    const f = s.battle as unknown as Field & { message: string };
    if (f.phase === 'result') return f;
    if (f.asset!.hp < before && f.message.toLowerCase().includes(name.toLowerCase())) return f;
    if (f.phase === 'action') await pick(page, 'endTurn');
    else if (f.phase === 'talk') await tap(page, 'Enter');
    else await adv(page, 16);
  }
  throw new Error('the freight was never struck');
}

for (const escort of ESCORTS) {
  test(`${escort.name}: it stands on the field between the pilot and the machines against it`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = await open(page, pilot(escort.wins, ARCHETYPE_BUILDS.duellist.late));
    await fly(page, `open-0-${escort.wins}-job`);
    const f = await field(page);
    expect(f.asset).toMatchObject({ hp: f.asset!.max });
    expect(f.freight).toMatchObject({ sprite: escort.sprite });
    // On the field, left of the enemies' part of it and on the floor.
    expect(f.freight!.x).toBeGreaterThanOrEqual(96);
    expect(f.freight!.x + f.freight!.w).toBeLessThanOrEqual(164);
    expect(f.freight!.y + f.freight!.h).toBeGreaterThanOrEqual(118);
    await adv(page, 400);
    await page.screenshot({ path: shot(`freight-${escort.sprite.replace('asset-', '')}`) });
    expect(errors).toEqual([]);
  });
}

test('freight struck as a round begins is thrown and lit, with what it lost written over it; worn down it smokes; lost, it goes up and is gone', async ({ page }) => {
  test.setTimeout(240_000);
  const [escort] = ESCORTS;
  const errors = await open(page, pilot(escort.wins, ARCHETYPE_BUILDS.bastion.late));
  await fly(page, `open-0-${escort.wins}-job`);
  const whole = await field(page);
  const struck = await untilStruck(page, escort.name);
  expect(struck.asset!.hp).toBeLessThan(whole.asset!.hp);
  // The moment it is struck: a few frames on, while it is still lit.
  await adv(page, 48);
  await page.screenshot({ path: shot('freight-struck') });
  expect((await field(page)).freight).toMatchObject({ sprite: escort.sprite });
  // Round after round, with nothing done about it, until a third is left: it smokes.
  let now = struck;
  for (let i = 0; i < 12 && now.phase !== 'result' && now.asset!.hp * 3 > now.asset!.max; i++) now = await untilStruck(page, escort.name);
  if (now.phase !== 'result') {
    await adv(page, 900);
    await page.screenshot({ path: shot('freight-smoking') });
    expect((await field(page)).freight).not.toBeNull();
  }
  // And on, until nothing is left: it goes up, and the battle is lost for it.
  for (let i = 0; i < 12 && now.asset!.hp > 0 && now.phase !== 'result'; i++) now = await untilStruck(page, escort.name);
  expect(now.asset!.hp).toBe(0);
  await adv(page, 330);
  await page.screenshot({ path: shot('freight-lost') });
  for (let i = 0; i < 200 && (await field(page)).phase !== 'result'; i++) await adv(page, 64);
  await adv(page, 1200);
  const end = await field(page);
  expect(end).toMatchObject({ outcome: 'defeat', note: `${escort.name}: lost.`, freight: null });
  await page.screenshot({ path: shot('freight-gone') });
  expect(errors).toEqual([]);
});

test('freight beside the widest machine there is: a mech at the head of a line of three', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await open(page, pilot(AGAINST_A_MECH, ARCHETYPE_BUILDS.marksman.late));
  await fly(page, `open-0-${AGAINST_A_MECH}-job`);
  expect((await field(page)).freight).not.toBeNull();
  await adv(page, 400);
  await page.screenshot({ path: shot('freight-beside-a-mech') });
  expect(errors).toEqual([]);
});

test('the story\'s ore train stands on the field of the pits, and in Dutch what it loses is written at it as well', async ({ page }) => {
  test.setTimeout(180_000);
  const base = pilot(4, ARCHETYPE_BUILDS.allrounder.early, ['hadron-1']);
  const errors = await open(page, { ...base, settings: { ...base.settings, language: 'nl' } }, { language: 'nl' });
  await fly(page, 'hadron-2');
  expect((await field(page)).freight).toMatchObject({ sprite: 'asset-ore-train' });
  await adv(page, 400);
  await page.screenshot({ path: shot('freight-ore-train') });
  const struck = await untilStruck(page, 'Ertstrein');
  expect(struck.asset!.hp).toBeLessThan(struck.asset!.max);
  await adv(page, 48);
  await page.screenshot({ path: shot('nl-freight-struck') });
  expect(errors).toEqual([]);
});

// The freight the story has that the tests above do not come to: each in the place it is fought over in.
const ACT_ONE = ['hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1'];

test('the story\'s core stack stands on the floor of the vault', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await open(page, pilot(14, ARCHETYPE_BUILDS.allrounder.late, [...ACT_ONE, 'choice-lumen', 'lumen-3', 'lumen-4']));
  await fly(page, 'lumen-5');
  const f = await field(page);
  expect(f.freight).toMatchObject({ sprite: 'asset-core-stack' });
  expect(f.asset).toMatchObject({ hp: f.asset!.max });
  await adv(page, 400);
  await page.screenshot({ path: shot('freight-core-stack') });
  expect(errors).toEqual([]);
});

test('the convoy of a favour stands on the low floor of the sluice', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await open(page, pilot(14, ARCHETYPE_BUILDS.allrounder.late, [...ACT_ONE, 'choice-lumen'], { choices: { sixty: 'keep' } }));
  await fly(page, 'favour-sixty');
  const f = await field(page);
  expect(f.freight).toMatchObject({ sprite: 'asset-convoy' });
  // Lower on the screen than freight on any other floor: the sluice's floor begins lower.
  expect(f.freight!.y + f.freight!.h).toBeGreaterThan(124);
  await adv(page, 400);
  await page.screenshot({ path: shot('freight-convoy-sluice') });
  expect(errors).toEqual([]);
});

test('the convoy of the simulator\'s drill stands in the hall, clear of what the simulator says', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await open(page, pilot(2, ARCHETYPE_BUILDS.allrounder.early));
  await fly(page, 'drill-protect', 'training');
  const f = await field(page);
  expect(f.freight).toMatchObject({ sprite: 'asset-convoy' });
  await adv(page, 400);
  await page.screenshot({ path: shot('freight-convoy-drill') });
  const struck = await untilStruck(page, 'Convoy');
  expect(struck.asset!.hp).toBeLessThan(struck.asset!.max);
  await adv(page, 48);
  await page.screenshot({ path: shot('freight-convoy-drill-struck') });
  expect(errors).toEqual([]);
});
