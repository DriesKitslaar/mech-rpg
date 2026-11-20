import { writeFileSync } from 'node:fs';
import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { arenaMission } from '../../src/core/arena';
import { swarmContract } from '../../src/core/board';
import { validatePlayerBuild } from '../../src/core/build';
import type { Mission } from '../../src/core/campaign';
import { newGame } from '../../src/core/game';
import { playMission } from '../../src/core/mission';
import type { Build, Catalog, Generator } from '../../src/core/types';
import { ALL_ENEMIES, ARENA } from '../../src/content/arena';
import { BOARD_TEXT } from '../../src/content/board';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';

/**
 * The ten weapons of the five kinds that ask something of their machine, flown by the automatic pilot
 * beside what a pilot would otherwise carry. Each was set by flying a hundred times a contract (the
 * figures are in the plan of the round); the sixteen flights a contract here are what a test has time
 * for, on contracts that tell weapons apart, and every line drawn below has a few flights of room.
 *
 * Two things are held. In an ordinary build of the stage it is sold at, none of the ten is better
 * than the best there was. And each kind is worth more in the fight or the machine it is for than
 * outside it.
 */
const SEEDS = 16;
const game = newGame(CATALOG, STARTER_BUILD);
const story = (id: string): Mission => MISSIONS.find((m) => m.id === id)!;
const ranked = (rank: number): Mission => arenaMission(game, ARENA.find((o) => o.rank === rank)!, { client: '', win: '' });
const swarm = (won: number): Mission => swarmContract(won, 0, BOARD_TEXT);

const flown = new Map<string, { win: number; rounds: number }>();
/** How often a build wins these contracts, and how many rounds a win takes, over the same flights every time it is asked. */
function fly(name: string, build: Build, contracts: [string, Mission][], catalog: Catalog = CATALOG): { win: number; rounds: number } {
  const key = `${name}|${contracts.map(([id]) => id).join(',')}`;
  const known = flown.get(key);
  if (known) return known;
  expect(validatePlayerBuild(build, catalog), name).toEqual([]);
  let wins = 0;
  let rounds = 0;
  for (const [, mission] of contracts) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      let total = 0;
      const end = playMission(build, mission, ALL_ENEMIES, catalog, seed * 7919, (s) => {
        const done = runBattle(s, catalog, chooseAutoPlayerAction);
        total += done.round;
        return done;
      }, { enemyScale: mission.scale ?? 1 });
      if (end.outcome === 'victory') { wins += 1; rounds += total; }
    }
  }
  const got = { win: Math.round((1000 * wins) / (contracts.length * SEEDS)) / 10, rounds: wins > 0 ? Math.round((10 * rounds) / wins) / 10 : 0 };
  flown.set(key, got);
  return got;
}
const named = (...ids: string[]): [string, Mission][] => ids.map((id) => [id, id.startsWith('arena:') ? ranked(Number(id.slice(6))) : id.startsWith('swarm:') ? swarm(Number(id.slice(6))) : story(id)]);
const without = (build: Build, ...slots: (keyof Build)[]): Build => {
  const next = { ...build };
  for (const slot of slots) delete next[slot];
  return next;
};

const { tier2, tier4, tier6 } = REFERENCE_BUILDS;
const EARLY = named('hadron-2', 'undertow-2', 'rival-1', 'choice-hadron', 'choice-lumen', 'choice-undertow');
const MID = named('hadron-3', 'hadron-5', 'lumen-4', 'undertow-4', 'finale-hadron', 'finale-undertow');
const LONG = named('lumen-3', 'finale-lumen', 'finale-undertow', 'guild-4', 'audit-3');
const LATE = named('verdict-enforce', 'verdict-default', 'duel-1', 'arena:8', 'arena:10');
const DUELS = named('verdict-default', 'verdict-enforce', 'audit-3', 'arena:9', 'arena:10');
const SWARMS = named('swarm:50', 'swarm:70', 'swarm:90', 'swarm:110');
/** The stage a pilot first buys a hand weapon at: the stock frame with a better head and generator, a rifle and one hand free. */
const early = (leftHand: string) => fly(`early ${leftHand}`, { ...without(tier2, 'shoulder'), leftHand }, EARLY);
/** After the exclusive contract: a Ronin with a carbine and an array, and this in the right hand. */
const mid = (rightHand: string, contracts = MID) => fly(`mid ${rightHand}`, { ...tier4, rightHand }, contracts);
/** The top of the ladder: a Colossus on a singularity cell with a lance emitter, and this on the shoulder. */
const late = (shoulder: string, contracts = LATE, catalog: Catalog = CATALOG, tag = '') => fly(`late ${shoulder}${tag}`, { ...tier6, shoulder }, contracts, catalog);

const report: string[] = [];
const said = (label: string, got: { win: number; rounds: number }): { win: number; rounds: number } => {
  report.push(`${label.padEnd(44)} ${String(got.win).padStart(5)}%  ${String(got.rounds).padStart(5)}r`);
  return got;
};
afterAll(() => { if (process.env.BALANCE_REPORT) writeFileSync(process.env.BALANCE_REPORT, `${report.join('\n')}\n`); });

describe('in an ordinary build, none of the ten is better than the best there was', () => {
  test('the three a new game meets, in the left hand of an early machine: between the scatter gun and the pulse carbine', () => {
    const carbine = said('early: pulse carbine', early('wpn-pulse-carbine'));
    const scatter = said('early: scatter gun', early('wpn-scatter-gun'));
    for (const id of ['wpn-slagcaster', 'wpn-forkbolt', 'wpn-flywheel']) {
      const got = said(`early: ${id}`, early(id));
      expect(got.win, id).toBeLessThanOrEqual(carbine.win + 3);
      expect(got.win, id).toBeGreaterThanOrEqual(scatter.win - 6);
    }
  });

  test('the hand weapons, in the right hand of a machine of the middle of the story: none above the marksman rifle, none below the scatter gun', () => {
    const marksman = said('mid: marksman rifle', mid('wpn-marksman'));
    const scatter = said('mid: scatter gun', mid('wpn-scatter-gun'));
    for (const id of ['wpn-slagcaster', 'wpn-flywheel', 'wpn-spike-driver']) {
      const got = said(`mid: ${id}`, mid(id));
      expect(got.win, id).toBeLessThanOrEqual(marksman.win + 3);
      expect(got.win, id).toBeGreaterThanOrEqual(scatter.win);
    }
  });

  test('the three of the arena, on the shoulder of a machine of the top of the ladder: none as good against one large machine as a weapon that charges', () => {
    const sunlance = said('late: sunlance', late('wpn-sunlance'));
    const storm = said('late: storm array', late('wpn-storm-array'));
    for (const id of ['wpn-thunderhead', 'wpn-crucible', 'wpn-spillway']) {
      const got = said(`late: ${id}`, late(id));
      expect(got.win, id).toBeLessThan(sunlance.win);
      expect(got.win, id).toBeGreaterThanOrEqual(storm.win - 5);
    }
  });
});

describe('each kind is worth more where it belongs', () => {
  test('a spool against one large machine: better than a burst of its price, as it is not in a short fight', () => {
    const chain = said('long fights: chain gun', mid('wpn-chain-gun', LONG));
    const flywheel = said('long fights: flywheel carbine', mid('wpn-flywheel', LONG));
    expect(flywheel.win).toBeGreaterThanOrEqual(chain.win + 3);
    // And on the shoulder of a heavier machine with one hand free.
    const heavy = (shoulder: string) => fly(`heavy ${shoulder}`, { ...without(tier4, 'leftHand'), legs: 'legs-bulwark', shoulder }, LONG);
    const buzzsaw = said('long fights: buzzsaw battery', heavy('wpn-buzzsaw'));
    const thresher = said('long fights: thresher', heavy('wpn-thresher'));
    expect(thresher.win).toBeGreaterThanOrEqual(buzzsaw.win + 5);
  });

  test('a punish beside a weapon that staggers: a blade after a gavel is far better than the same blade after a rifle', () => {
    const duellist: Build = {
      head: 'head-auditor', core: 'core-auditor', arms: 'arms-auditor', legs: 'legs-auditor', generator: 'gen-tidal', booster: 'bst-phase',
      fcs: 'fcs-surgeon', module: 'mod-oracle', rightHand: 'wpn-gavel',
    };
    const after = (rightHand: string, leftHand: string) => fly(`duellist ${rightHand} ${leftHand}`, { ...duellist, rightHand, leftHand }, DUELS);
    const paired = said('gavel + headsman', after('wpn-gavel', 'wpn-headsman'));
    const plain = said('gavel + arc blade', after('wpn-gavel', 'wpn-arc-blade'));
    const alone = said('void rifle + headsman', after('wpn-void-rifle', 'wpn-headsman'));
    const other = said('void rifle + arc blade', after('wpn-void-rifle', 'wpn-arc-blade'));
    expect(paired.win).toBeGreaterThanOrEqual(plain.win + 5);
    expect(alone.win).toBeLessThanOrEqual(other.win - 5);
    expect(paired.win).toBeGreaterThanOrEqual(alone.win + 10);
  });

  test('a redline in a machine that runs hot: ahead of a beam of its price there, and not in one that keeps cool', () => {
    const cooling = (shed: number): Catalog => ({ ...CATALOG, 'gen-singularity': { ...(CATALOG['gen-singularity'] as Generator), cooling: shed } });
    const edge = (shed: number): number => {
      const crucible = said(`cooling ${shed}: crucible`, late('wpn-crucible', LATE, cooling(shed), ` cooling ${shed}`));
      const beam = said(`cooling ${shed}: null beam`, late('wpn-null-beam', LATE, cooling(shed), ` cooling ${shed}`));
      return crucible.win - beam.win;
    };
    const hot = edge(8);
    const cool = edge(60);
    expect(hot).toBeGreaterThanOrEqual(8);
    expect(cool).toBeLessThanOrEqual(4);
    expect(hot).toBeGreaterThan(cool + 6);
  });

  test('a surge on a large generator: alone on the shoulder it does better than the two weapons that machine came with', () => {
    const standard = said('singularity: emitter + breaker', fly('late standard', tier6, LATE));
    const alone = said('singularity: spillway alone', fly('late spillway alone', { ...without(tier6, 'rightHand'), shoulder: 'wpn-spillway' }, LATE));
    expect(alone.win).toBeGreaterThanOrEqual(standard.win + 4);
    // And it is the one weapon that can be a machine's only one: a beam alone, on the same cell, is not worth flying.
    const beam = said('singularity: null beam alone', fly('late null beam alone', { ...without(tier6, 'rightHand'), shoulder: 'wpn-null-beam' }, LATE));
    expect(alone.win).toBeGreaterThanOrEqual(beam.win + 12);
  });

  test('a fork against a swarm: every swarm is won, sooner than with a cannon that fires at one machine and about as soon as with a salvo', () => {
    // (Over a hundred flights of eight swarms it was the quickest of all that is not charged, by a third of a round;
    // over these few a salvo is ahead by about as much. It is not held to be quicker than a salvo.)
    const thunderhead = said('swarms: thunderhead', late('wpn-thunderhead', SWARMS));
    const storm = said('swarms: storm array', late('wpn-storm-array', SWARMS));
    const breaker = said('swarms: breaker cannon', late('wpn-breaker-cannon', SWARMS));
    expect(thunderhead.win).toBe(100);
    expect(Math.abs(thunderhead.rounds - storm.rounds)).toBeLessThanOrEqual(1);
    expect(thunderhead.rounds).toBeLessThan(breaker.rounds - 1);
  });
});
