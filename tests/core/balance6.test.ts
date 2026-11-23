import { writeFileSync } from 'node:fs';
import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { arenaMission } from '../../src/core/arena';
import { validatePlayerBuild } from '../../src/core/build';
import { forCycle, type Mission } from '../../src/core/campaign';
import { newGame } from '../../src/core/game';
import { masterMission } from '../../src/core/masters';
import { playMission } from '../../src/core/mission';
import { seatMission } from '../../src/core/seat';
import type { Build } from '../../src/core/types';
import { ALL_ENEMIES, ARENA } from '../../src/content/arena';
import { MASTERS } from '../../src/content/masters';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { KEEPER } from '../../src/content/seat';

/**
 * The two frames of the yard's works pilots, flown by the automatic pilot beside the frames there were, in
 * the same weapons and with the same parts inside. Each was set by flying forty times a contract over the
 * hardest work there is (the figures are in the plan of the round); the sixteen flights a contract here are
 * what a test has time for, and every line drawn below has a few flights of room.
 *
 * Three things are held. Each frame is the best there is to be bought with what it is for: a Sirocco with a
 * volley of three hot weapons, a Solstice with weapons that ask more energy than a turn gives. Neither is
 * better than the frames there were with anything else. And neither opens the hardest fights more often than
 * the best build there was.
 */
const SEEDS = 16;
const game = newGame(CATALOG, STARTER_BUILD);
const TEXT = { client: '', win: '' };
const story = (id: string): Mission => MISSIONS.find((m) => m.id === id)!;
const contract = (id: string): Mission => {
  if (id.startsWith('arena:')) return arenaMission(game, ARENA.find((o) => o.rank === Number(id.slice(6)))!, TEXT);
  if (id.startsWith('master:')) return masterMission(game, MASTERS.find((m) => m.kind === id.slice(7))!, TEXT);
  if (id === 'seat') return seatMission(game, KEEPER, TEXT);
  // A verdict as a later telling gives it.
  if (id.endsWith('@1')) return forCycle(story(id.slice(0, -2)), 1);
  return story(id);
};
const LATE = ['verdict-enforce', 'verdict-default', 'duel-1', 'arena:8', 'arena:10'];
const BACK = ['arena:11', 'arena:12', 'arena:13', 'arena:14', 'arena:15'];
const AGAIN = ['verdict-enforce@1', 'verdict-default@1'];
const SEAT = ['seat'];
const EVERYTHING = [...LATE, ...BACK, ...AGAIN, ...SEAT];

type FrameName = 'ronin' | 'colossus' | 'auditor' | 'shrike' | 'sterling' | 'sovereign' | 'sirocco' | 'solstice';
const frame = (name: FrameName) => ({ head: `head-${name}`, core: `core-${name}`, arms: `arms-${name}`, legs: `legs-${name}` });
/** What goes inside: the best there is for a quick machine, and what a machine that runs hot is given. */
const QUICK = { generator: 'gen-tidal', booster: 'bst-phase', fcs: 'fcs-surgeon', module: 'mod-oracle' };
const COOLED = { generator: 'gen-tidal', booster: 'bst-stock', fcs: 'fcs-hawkeye', module: 'mod-coolant' };
const LOADS = {
  /** Three weapons that run a machine hot, two of them redlines. */
  hot: { rightHand: 'wpn-plasma', leftHand: 'wpn-slagcaster', shoulder: 'wpn-crucible' },
  /** Three redlines. */
  redlines: { rightHand: 'wpn-slagcaster', leftHand: 'wpn-slagcaster', shoulder: 'wpn-crucible' },
  /** Two blades: a boost and two strikes ask more than a turn gives. */
  blades: { rightHand: 'wpn-arc-blade', leftHand: 'wpn-gavel' },
  /** A rifle and a blade. */
  duel: { rightHand: 'wpn-void-rifle', leftHand: 'wpn-arc-blade' },
  /** Two rifles. */
  twin: { rightHand: 'wpn-void-rifle', leftHand: 'wpn-pulse-carbine' },
  /** A blade and a surge. */
  surge: { rightHand: 'wpn-arc-blade', leftHand: 'wpn-sluice' },
};

const flown = new Map<string, number>();
/** How often a build wins these contracts, in a hundred, over the same flights every time it is asked; with no perk to its name. */
function fly(name: FrameName, inside: object, load: keyof typeof LOADS, contracts: string[]): number {
  const key = `${name}|${JSON.stringify(inside)}|${load}|${contracts.join(',')}`;
  const known = flown.get(key);
  if (known !== undefined) return known;
  const build = { ...frame(name), ...inside, ...LOADS[load] } as Build;
  expect(validatePlayerBuild(build, CATALOG), `${name} ${load}`).toEqual([]);
  let wins = 0;
  for (const id of contracts) {
    const mission = contract(id);
    for (let seed = 1; seed <= SEEDS; seed++) {
      const end = playMission(build, mission, ALL_ENEMIES, CATALOG, seed * 7919, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction), { enemyScale: mission.scale ?? 1 });
      if (end.outcome === 'victory') wins += 1;
    }
  }
  const got = Math.round((1000 * wins) / (contracts.length * SEEDS)) / 10;
  flown.set(key, got);
  return got;
}

const report: string[] = [];
const said = (label: string, got: number): number => {
  report.push(`${label.padEnd(52)} ${String(got).padStart(5)}%`);
  return got;
};
afterAll(() => { if (process.env.BALANCE_REPORT) writeFileSync(process.env.BALANCE_REPORT, `${report.join('\n')}\n`); });
const LONG = 120_000;

describe('a Sirocco is the frame for a volley of three hot weapons', () => {
  test('with two redlines and a plasma rifle it wins the hardest work more often than an Auditor or a Colossus carrying the same', () => {
    const sirocco = said('hot volley, quick inside: sirocco', fly('sirocco', QUICK, 'hot', EVERYTHING));
    const auditor = said('hot volley, quick inside: auditor', fly('auditor', QUICK, 'hot', EVERYTHING));
    const colossus = said('hot volley, quick inside: colossus', fly('colossus', QUICK, 'hot', EVERYTHING));
    expect(sirocco).toBeGreaterThanOrEqual(auditor + 3);
    expect(sirocco).toBeGreaterThanOrEqual(colossus + 3);
  }, LONG);

  test('and with three redlines and a coolant flush, more often than either of them', () => {
    const sirocco = said('three redlines, cooled: sirocco', fly('sirocco', COOLED, 'redlines', EVERYTHING));
    const auditor = said('three redlines, cooled: auditor', fly('auditor', COOLED, 'redlines', EVERYTHING));
    const colossus = said('three redlines, cooled: colossus', fly('colossus', COOLED, 'redlines', EVERYTHING));
    expect(sirocco).toBeGreaterThanOrEqual(auditor + 3);
    expect(sirocco).toBeGreaterThanOrEqual(colossus + 3);
  }, LONG);

  test('with a rifle and a blade, or two rifles, it is no better than the frames there were', () => {
    const duel = said('rifle and blade: sirocco', fly('sirocco', QUICK, 'duel', EVERYTHING));
    expect(duel).toBeLessThanOrEqual(said('rifle and blade: auditor', fly('auditor', QUICK, 'duel', EVERYTHING)));
    const twin = said('two rifles: sirocco', fly('sirocco', QUICK, 'twin', EVERYTHING));
    expect(twin).toBeLessThanOrEqual(said('two rifles: colossus', fly('colossus', QUICK, 'twin', EVERYTHING)) + 3);
  }, LONG);
});

describe('a Solstice is the frame for weapons that ask more than a turn gives', () => {
  test('with two blades it wins the hardest work more often than a Sterling, a Shrike or an Auditor carrying the same', () => {
    const solstice = said('two blades: solstice', fly('solstice', QUICK, 'blades', EVERYTHING));
    // A Sterling is the nearest: it is as quick, and its field takes the first of what lands.
    expect(solstice).toBeGreaterThanOrEqual(said('two blades: sterling', fly('sterling', QUICK, 'blades', EVERYTHING)) + 3);
    for (const other of ['shrike', 'auditor'] as const) {
      expect(solstice, other).toBeGreaterThanOrEqual(said(`two blades: ${other}`, fly(other, QUICK, 'blades', EVERYTHING)) + 10);
    }
  }, LONG);

  test('with two rifles, or a rifle and a blade, it is no better than the frames there were', () => {
    const twin = said('two rifles: solstice', fly('solstice', QUICK, 'twin', EVERYTHING));
    expect(twin).toBeLessThanOrEqual(said('two rifles: colossus', fly('colossus', QUICK, 'twin', EVERYTHING)) + 3);
    const duel = said('rifle and blade: solstice', fly('solstice', QUICK, 'duel', EVERYTHING));
    expect(duel).toBeLessThanOrEqual(said('rifle and blade: auditor', fly('auditor', QUICK, 'duel', EVERYTHING)) + 3);
  }, LONG);
});

describe('neither opens the hardest fights more often than the best build there was', () => {
  test('the keeper of the eighth seat: no more often than an Auditor with a blade and a surge, or a Sovereign with three hot weapons', () => {
    const best = Math.max(
      said('seat: auditor, blade and surge', fly('auditor', QUICK, 'surge', SEAT)),
      said('seat: sovereign, hot volley', fly('sovereign', QUICK, 'hot', SEAT)),
      said('seat: sovereign, three redlines', fly('sovereign', QUICK, 'redlines', SEAT)),
    );
    for (const [name, load] of [['sirocco', 'hot'], ['sirocco', 'redlines'], ['solstice', 'blades']] as const) {
      expect(said(`seat: ${name}, ${load}`, fly(name, QUICK, load, SEAT)), `${name} ${load}`).toBeLessThanOrEqual(best + 7);
    }
  }, LONG);

  test('a later telling\'s verdict and the back room: a Sovereign carrying the same does at least as well', () => {
    const hard = [...BACK, ...AGAIN];
    const sovereign = said('back room and verdicts: sovereign, hot volley', fly('sovereign', QUICK, 'hot', hard));
    expect(said('back room and verdicts: sirocco, hot volley', fly('sirocco', QUICK, 'hot', hard))).toBeLessThanOrEqual(sovereign + 3);
    const blades = said('back room and verdicts: sovereign, two blades', fly('sovereign', QUICK, 'blades', hard));
    expect(said('back room and verdicts: solstice, two blades', fly('solstice', QUICK, 'blades', hard))).toBeLessThanOrEqual(blades + 3);
  }, LONG);
});
