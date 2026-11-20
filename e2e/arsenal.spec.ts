import { expect, test, type Page } from '@playwright/test';
import { LESSONS, completeMission } from '../src/core/campaign';
import { BUILD_SLOTS, buy, equip, newGame, type GameState } from '../src/core/game';
import type { Build, Weapon } from '../src/core/types';
import { WORLD } from '../src/content/codex';
import { MISSIONS } from '../src/content/missions';
import { STRINGS_NL } from '../src/content/nl/strings';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { REFERENCE_BUILDS } from '../src/content/referenceBuilds';
import { SCENES } from '../src/content/scenes';
import { STRINGS } from '../src/content/strings';
import { choose, nextFrame, open, press, snap, waitForScreen, type Snap } from './helpers';

const shot = (name: string) => `docs/screenshots/${name}.png`;
const weapon = (id: string): Weapon => CATALOG[id] as Weapon;
const { tier6 } = REFERENCE_BUILDS;
/** A Colossus on a singularity cell with a surge in one hand, a spool in the other and a redline on its shoulder. */
const HOT: Build = { ...tier6, rightHand: 'wpn-sluice', leftHand: 'wpn-flywheel', shoulder: 'wpn-crucible' };
/** The same machine for a crowd: a fork, a punish, and a howler to knock a machine off balance for it. */
const CROWD: Build = { ...tier6, rightHand: 'wpn-forkbolt', leftHand: 'wpn-spike-driver', shoulder: 'wpn-howler' };
/** And one of three kinds for the Dutch: a surge, a spool, and a fork on the shoulder. */
const MIXED: Build = { ...tier6, rightHand: 'wpn-sluice', leftHand: 'wpn-flywheel', shoulder: 'wpn-thunderhead' };

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
/** A pilot past the exclusive contract, in a build of the top of the ladder: every page read, every lesson told. */
function pilot(build: Build, language: 'en' | 'nl' = 'en'): GameState {
  let g = newGame(CATALOG, STARTER_BUILD, 'VANTA');
  for (const id of ['intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'hadron-2', 'lumen-2', 'undertow-2', 'rival-1', 'choice-lumen', 'lumen-3']) g = completeMission(g, id, MISSIONS);
  g = wearing(g, build);
  return {
    ...g, credits: 4200, xp: 1500, battlesWon: 20, arenaRank: 3, scenes: SCENES.map((scene) => scene.id), codex: WORLD.map((entry) => entry.id),
    lessons: [...LESSONS], settings: { ...g.settings, language },
  };
}

type Kept = { said: string[]; words: string[] };
/**
 * Opens the game on a saved one, with battles played faster and not hurried: what the bar says and the words that
 * rise over the field are there for a few frames, and every one of them is kept for the test to read.
 */
async function load(page: Page, save: GameState): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(({ data, settings }) => {
    if (!window.localStorage.getItem('ironwage-save')) window.localStorage.setItem('ironwage-save', data);
    if (!window.localStorage.getItem('ironwage-settings')) window.localStorage.setItem('ironwage-settings', settings);
  }, { data: JSON.stringify(save), settings: JSON.stringify({ ...save.settings, fastBattles: true }) });
  await open(page, '/?seed=7');
  await page.evaluate(() => {
    const kept: { said: string[]; words: string[] } = { said: [], words: [] };
    (window as unknown as { __kept: typeof kept }).__kept = kept;
    const tick = (): void => {
      const battle = (window as unknown as { __game: { snapshot(): { battle?: { message: string; words: string[] } } } }).__game.snapshot().battle;
      if (battle?.message && kept.said.at(-1) !== battle.message) kept.said.push(battle.message);
      for (const word of battle?.words ?? []) if (!kept.words.includes(word)) kept.words.push(word);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await choose(page, 'continue');
  await waitForScreen(page, 'hub');
  return errors;
}
const kept = (page: Page): Promise<Kept> => page.evaluate(() => (window as unknown as { __kept: Kept }).__kept);

type Fought = {
  phase: string; outcome: string; round: number; message: string; enemies: string[]; targetId: string | null;
  fork: string | null; weapons: { slot: string; note: string }[] | null; words: string[];
};
type Seen = { battle: Fought; player: { energy: number; heat: number }; menu: Snap['menu'] };
const seen = async (page: Page): Promise<Seen> => (await snap(page)) as unknown as Seen;
const still = async (page: Page, frames = 12): Promise<void> => { for (let i = 0; i < frames; i++) await nextFrame(page); };
const inPhase = (page: Page, phase: string): Promise<unknown> =>
  page.waitForFunction((name) => (window as unknown as { __game: { snapshot(): { battle?: { phase: string } } } }).__game.snapshot().battle?.phase === name, phase);

/**
 * Lets the battle run on to the pilot's next choice, or to its end. The first time a word that is asked for is over
 * the field, a picture is taken of it (a frame later, when it has risen clear of the figure it belongs to).
 */
async function settle(page: Page, pictures: [RegExp, string][] = []): Promise<Seen> {
  const wanted = new Map(pictures.map(([word, name]) => [name, word]));
  // What a hit is called can still be rising when the menu is back: it is looked for a little longer.
  let linger = 30;
  for (let i = 0; i < 6000; i++) {
    const s = await seen(page);
    for (const [name, word] of wanted) {
      if (!s.battle.words.some((text) => word.test(text))) continue;
      await nextFrame(page);
      await page.screenshot({ path: shot(name) });
      wanted.delete(name);
    }
    if (s.battle.phase === 'result') return s;
    if (s.battle.phase === 'action') {
      if (wanted.size === 0 || linger-- <= 0) return seen(page);
      await nextFrame(page);
    } else if (s.battle.phase === 'talk') await press(page, 'Enter');
    else await nextFrame(page);
  }
  throw new Error('the battle never handed the turn over');
}
/** From the hub to a fight on the range against so many of a machine, as far as the pilot's first turn. */
async function field(page: Page, kind: string, count: number): Promise<void> {
  await choose(page, 'training');
  await waitForScreen(page, 'training');
  await press(page, 'KeyE');
  for (let i = 0; i < 60; i++) {
    const s = await snap(page);
    if (s.menu.items[s.menu.cursor]?.id === kind) break;
    await press(page, 'ArrowDown');
  }
  for (let i = 1; i < count; i++) await press(page, 'ArrowRight');
  await press(page, 'Enter');
  await waitForScreen(page, 'briefing');
  await choose(page, 'accept');
  await waitForScreen(page, 'battle');
  await settle(page);
  expect((await seen(page)).battle).toMatchObject({ phase: 'action', enemies: Array.from({ length: count }, () => kind) });
}
/** Opens the list of weapons from the pilot's menu: what is said under each, and which can be fired. */
async function rows(page: Page): Promise<{ notes: Record<string, string>; ready: string[] }> {
  await choose(page, 'fire');
  await inPhase(page, 'weapon');
  const s = await seen(page);
  return {
    notes: Object.fromEntries(s.battle.weapons!.map((row) => [row.slot, row.note])),
    ready: s.menu.items.filter((item) => item.enabled).map((item) => item.id),
  };
}
/** From the list of weapons: takes one, and aims it at whatever the game aims at first. */
async function aim(page: Page, slot: string): Promise<Seen> {
  await choose(page, slot);
  await inPhase(page, 'target');
  return seen(page);
}
/** Pulls the trigger of the weapon being aimed and waits for what comes of it. */
async function fire(page: Page, pictures: [RegExp, string][] = []): Promise<Seen> {
  await press(page, 'Enter');
  return settle(page, pictures);
}
/** Ends the pilot's turn and waits for the next one. */
async function pass(page: Page): Promise<Seen> {
  await choose(page, 'endTurn');
  return settle(page);
}

test('the rows say what each kind would do now, and the field says what it did: a spool, a redline and a surge, fired in that order', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await load(page, pilot(HOT));
  await field(page, 'heavy-mech', 1);
  const [sluice, flywheel, crucible] = ['wpn-sluice', 'wpn-flywheel', 'wpn-crucible'].map(weapon);
  const cell = (await seen(page)).player.energy;
  expect(cell).toBeGreaterThanOrEqual(flywheel.energy + crucible.energy + sluice.energy);

  // Cold and full: the surge would take the whole cell, the spool fires its two, and the redline's heat adds nothing yet.
  const cold = await rows(page);
  expect(cold.notes).toEqual({
    rightHand: `EN ALL ${cell}  HEAT ${sluice.heat}`,
    leftHand: `EN ${flywheel.energy}  HEAT ${flywheel.heat}  2 SHOTS`,
    shoulder: `EN ${crucible.energy}  HEAT ${crucible.heat}`,
  });
  expect(cold.ready).toEqual(['rightHand', 'leftHand', 'shoulder']);
  await still(page);
  await page.screenshot({ path: shot('arsenal-rows') });
  await press(page, 'Escape');
  await inPhase(page, 'action');

  const spool: string[] = [];
  const expected = { redline: [] as string[], surge: [] as string[] };
  let s = await seen(page);
  for (let turn = 1; turn <= 8 && s.battle.phase !== 'result'; turn++) {
    // The spool first: it keeps winding only while it is fired every turn.
    let list = await rows(page);
    spool.push(list.notes.leftHand);
    await aim(page, 'leftHand');
    s = await fire(page);
    if (s.battle.phase === 'result') break;

    // The redline once the spool has warmed the machine, where the turn has room for it and for the surge after it.
    list = await rows(page);
    const warm = s.player;
    const lift = Math.round((1 + (Math.min(warm.heat, 100) * crucible.traitPower!) / 1000) * 100) - 100;
    expect(list.notes.rightHand).toBe(`EN ALL ${warm.energy}  HEAT ${sluice.heat}`);
    if (list.ready.includes('shoulder') && warm.heat + crucible.heat + sluice.heat <= 100 && warm.energy >= crucible.energy + sluice.energy) {
      expect(list.notes.shoulder).toBe(`EN ${crucible.energy}  HEAT ${crucible.heat}  +${lift}%`);
      if (turn === 1) { await still(page); await page.screenshot({ path: shot('arsenal-rows-warm') }); }
      expected.redline.push(`REDLINE +${lift}%`);
      await aim(page, 'shoulder');
      s = await fire(page, [[/^REDLINE \+\d+%$/, 'arsenal-redline']]);
      if (s.battle.phase === 'result') break;
      list = await rows(page);
    }

    // The surge last: it takes all that is left, and the row said how much that is.
    if (list.ready.includes('rightHand') && s.player.heat + sluice.heat <= 100) {
      const taken = s.player.energy;
      expect(list.notes.rightHand).toBe(`EN ALL ${taken}  HEAT ${sluice.heat}`);
      expected.surge.push(`SURGE x${(taken / 100).toFixed(1)}`);
      await aim(page, 'rightHand');
      s = await fire(page, [[/^SURGE x\d+\.\d$/, 'arsenal-surge']]);
      if (s.battle.phase === 'result') break;
      expect(s.player.energy).toBe(0);
    } else {
      await press(page, 'Escape');
      await inPhase(page, 'action');
    }
    const { words } = await kept(page);
    if (turn >= 2 && words.some((word) => word.startsWith('REDLINE')) && words.some((word) => word.startsWith('SURGE'))) break;
    s = await pass(page);
  }
  const { words, said } = await kept(page);
  // Each word the field wrote of a kind was the figure the row had given before the trigger was pulled.
  const redlines = words.filter((word) => word.startsWith('REDLINE'));
  const surges = words.filter((word) => word.startsWith('SURGE'));
  expect(redlines.length).toBeGreaterThan(0);
  expect(surges.length).toBeGreaterThan(0);
  for (const word of redlines) expect(expected.redline).toContain(word);
  for (const word of surges) expect(expected.surge).toContain(word);
  // Fired two turns running, the spool had wound up by one.
  expect(spool.slice(0, 2)).toEqual([`EN ${flywheel.energy}  HEAT ${flywheel.heat}  2 SHOTS`, `EN ${flywheel.energy}  HEAT ${flywheel.heat}  3 SHOTS`]);
  expect(said.some((line) => line.startsWith(`${flywheel.name} `))).toBe(true);
  expect(errors).toEqual([]);
});

test('a fork: while it is aimed the next machine along the line is marked, and a hit leaps on to it', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await load(page, pilot(CROWD));
  await field(page, 'gun-turret', 3);
  const [forkbolt, spike, howler] = ['wpn-forkbolt', 'wpn-spike-driver', 'wpn-howler'].map(weapon);
  // Nothing about these rows changes with the turn: a fork and a punish are said by what they cost.
  expect((await rows(page)).notes).toEqual({
    rightHand: `EN ${forkbolt.energy}  HEAT ${forkbolt.heat}`, leftHand: `EN ${spike.energy}  HEAT ${spike.heat}`, shoulder: `EN ${howler.energy}  HEAT ${howler.heat}`,
  });
  // Aimed at the first turret, the bolt would go on to the second; at the last, round to the first.
  let s = await aim(page, 'rightHand');
  expect(s.battle).toMatchObject({ targetId: 'enemy-0', fork: 'enemy-1' });
  await still(page);
  await page.screenshot({ path: shot('arsenal-fork') });
  await press(page, 'KeyE');
  expect((await seen(page)).battle).toMatchObject({ targetId: 'enemy-1', fork: 'enemy-2' });
  await press(page, 'KeyE');
  expect((await seen(page)).battle).toMatchObject({ targetId: 'enemy-2', fork: 'enemy-0' });
  await press(page, 'KeyE');
  expect((await seen(page)).battle).toMatchObject({ targetId: 'enemy-0', fork: 'enemy-1' });

  // Fired until a hit lands: what leaps on is said on a line of its own, straight after the hit.
  const leapt = /^It leaps on to Gun Turret [A-C] - Core -\d+$/;
  for (let turn = 1; turn <= 6; turn++) {
    s = await fire(page);
    // Once the trigger is pulled nothing is marked any more.
    expect(s.battle.fork).toBeNull();
    if ((await kept(page)).said.some((line) => leapt.test(line)) || s.battle.phase === 'result' || s.battle.enemies.length < 2) break;
    await pass(page);
    await rows(page);
    await aim(page, 'rightHand');
  }
  const { said } = await kept(page);
  const at = said.findIndex((line) => leapt.test(line));
  expect(at).toBeGreaterThan(0);
  expect(said[at - 1]).toMatch(new RegExp(`^${forkbolt.name} hits Gun Turret [A-C] - Core -\\d+$`));
  // What leapt on took the share of the hit that the weapon is sold to send on.
  const taken = (line: string): number => Number(/-(\d+)$/.exec(line)![1]);
  expect(taken(said[at])).toBe(Math.round((taken(said[at - 1]) * forkbolt.traitPower!) / 100));
  // A bolt that leaps on is one shot: the turret it leapt from and the one it landed on are two machines.
  expect(said[at - 1].match(/Gun Turret ([A-C])/)![1]).not.toBe(said[at].match(/Gun Turret ([A-C])/)![1]);
  expect(errors).toEqual([]);
});

test('a punish: flown by Auto Turn, the howler knocks the machine off balance and the spike driver lands on it while it reels', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await load(page, pilot(CROWD));
  await field(page, 'heavy-mech', 1);
  let s = await seen(page);
  for (let turn = 1; turn <= 12 && s.battle.phase !== 'result'; turn++) {
    await choose(page, 'auto');
    s = await settle(page, [[/^PUNISH$/, 'arsenal-punish']]);
    if ((await kept(page)).words.includes('PUNISH')) break;
  }
  const { words, said } = await kept(page);
  expect(words).toContain(STRINGS.fx.kinds.punish);
  // The howler was fired before the spike driver in the turn the word was written.
  const spiked = said.map((line) => line.startsWith('Spike Driver hits')).lastIndexOf(true);
  expect(spiked).toBeGreaterThan(0);
  expect(said.slice(0, spiked).some((line) => line.startsWith('Howler hits'))).toBe(true);
  expect(errors).toEqual([]);
});

test('in Dutch: the rows, the mark over the next machine, the line of what leapt on and the word of a surge', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await load(page, pilot(MIXED, 'nl'));
  await field(page, 'gun-turret', 3);
  const [sluice, flywheel, thunderhead] = ['wpn-sluice', 'wpn-flywheel', 'wpn-thunderhead'].map(weapon);
  const { energy, heat } = STRINGS_NL.meters;
  const cell = (await seen(page)).player.energy;
  expect((await rows(page)).notes).toEqual({
    rightHand: `${energy} ${STRINGS_NL.weaponMenu.all} ${cell}  ${heat} ${sluice.heat}`,
    leftHand: `${energy} ${flywheel.energy}  ${heat} ${flywheel.heat}  ${STRINGS_NL.weaponMenu.shots(2)}`,
    shoulder: `${energy} ${thunderhead.energy}  ${heat} ${thunderhead.heat}`,
  });
  expect(STRINGS_NL.weaponMenu.all).toBe('ALLES');
  await still(page);
  await page.screenshot({ path: shot('arsenal-rows-nl') });

  let s = await aim(page, 'shoulder');
  expect(s.battle).toMatchObject({ targetId: 'enemy-0', fork: 'enemy-1' });
  await still(page);
  await page.screenshot({ path: shot('arsenal-fork-nl') });
  const leapt = /^Slaat over op .+ - \S+ -\d+$/;
  for (let turn = 1; turn <= 6; turn++) {
    s = await fire(page);
    if (s.battle.phase === 'result') break;
    // What is left of the cell goes into the surge.
    const list = await rows(page);
    if (list.ready.includes('rightHand')) {
      await aim(page, 'rightHand');
      s = await fire(page, [[/^PIEK x\d+\.\d$/, 'arsenal-surge-nl']]);
    } else {
      await press(page, 'Escape');
      await inPhase(page, 'action');
    }
    const got = await kept(page);
    if (s.battle.phase === 'result' || s.battle.enemies.length < 2 || (got.said.some((line) => leapt.test(line)) && got.words.some((word) => word.startsWith('PIEK')))) break;
    await pass(page);
    await rows(page);
    await aim(page, 'shoulder');
  }
  const { said, words } = await kept(page);
  expect(said.some((line) => leapt.test(line))).toBe(true);
  expect(words.some((word) => /^PIEK x\d+\.\d$/.test(word))).toBe(true);
  // Nothing English is written of a kind.
  expect(words.filter((word) => /^(SURGE|REDLINE|PUNISH)/.test(word))).toEqual([]);
  expect(said.filter((line) => line.startsWith('It leaps'))).toEqual([]);
  expect(errors).toEqual([]);
});

test('in the shop: the weapons of the five kinds that this pilot may buy, each with its line', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await load(page, pilot(CROWD));
  await choose(page, 'shop');
  await waitForScreen(page, 'shop');
  const shelves = new Set<string>();
  for (let tab = 0; tab < 12; tab++) {
    for (const item of (await snap(page)).menu.items) shelves.add(item.id);
    await press(page, 'KeyE');
  }
  const kinds = ['redline', 'surge', 'punish', 'fork', 'spool'];
  const ofKind = [...shelves].filter((id) => kinds.includes(weapon(id).trait ?? '')).sort();
  // A first contract for each client and the exclusive one: six of the ten. The rest come with the arena and the audit.
  expect(ofKind).toEqual(['wpn-flywheel', 'wpn-forkbolt', 'wpn-slagcaster', 'wpn-sluice', 'wpn-spike-driver', 'wpn-thresher']);
  const to = async (id: string): Promise<void> => {
    for (let tab = 0; tab < 12 && !(await snap(page)).menu.items.some((item) => item.id === id); tab++) await press(page, 'KeyE');
    for (let i = 0; i < 40; i++) {
      const s = await snap(page);
      if (s.menu.items[s.menu.cursor]?.id === id) return;
      await press(page, 'ArrowDown');
    }
    throw new Error(`not on a shelf: ${id}`);
  };
  // A surge: its energy is the least it asks, with the mark that it takes more.
  await to('wpn-sluice');
  await still(page);
  await page.screenshot({ path: shot('arsenal-shop-surge') });
  // A spool on the shoulder: the most it fires is on its line.
  await to('wpn-thresher');
  await still(page);
  await page.screenshot({ path: shot('arsenal-shop-spool') });
  expect(errors).toEqual([]);
});
