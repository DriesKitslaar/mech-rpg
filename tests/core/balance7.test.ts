import { writeFileSync } from 'node:fs';
import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { ARCHETYPES, type Archetype } from '../../src/core/archetype';
import { ENEMY_COST, MECH_ENEMIES, POOL, budgetFor } from '../../src/core/board';
import type { Mission } from '../../src/core/campaign';
import { settle } from '../../src/core/economy';
import { GRUDGE, GRUDGE_NUMBERS, dealtBy, grudgeContract, grudgeEnemy, type Grudge } from '../../src/core/grudge';
import { playMission } from '../../src/core/mission';
import { perkEffects } from '../../src/core/pilot';
import { WEAPON_SLOTS, type Build, type EnemyDef } from '../../src/core/types';
import { ALL_ENEMIES } from '../../src/content/arena';
import { ARCHETYPE_BUILDS, type Stage } from '../../src/content/archetypeBuilds';
import { BOARD_TEXT } from '../../src/content/board';
import { CATALOG } from '../../src/content/parts';
import { PERKS } from '../../src/content/perks';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';

/**
 * The meetings of an account, flown by the game's own pilot in the build the game suggests for each
 * class at the stage, as `scripts/grudge.ts` flies them: at the fourth tier of the board, which is
 * where the builds of the war are thinnest against it, and at the eighth. Against the two quick
 * machines an account can be about, which are the ones that showed what would not do (hardened
 * against every weapon they had met, they were beaten one time in ten), and a heavy one.
 *
 * What is held: no machine is a wall, whether or not it knows the build's best weapon; knowing it
 * costs the pilot something against a quick machine, and costs every pilot money; a build it
 * knows nothing of is paid about what a hit pays; and a pilot with one weapon and no other, of
 * whom the machine knows all there is to know, still wins, which with a hardening that did not
 * wear they did one time in five. The script's figures are over two hundred flights a cell and
 * are in the plan of the round; the forty-two a cell here are what a test has time for, and every
 * line drawn below has room for that.
 */
const perks = (ranks: Record<string, number>): object => {
  const { aim, evasion, energy, cooling, repairs, armour } = perkEffects(ranks, PERKS);
  return { aim, evasion, energy, cooling, repairs, armour };
};
const stageOf = (tier: number): Stage => (tier <= 2 ? 'early' : tier <= 5 ? 'war' : 'late');
const pilotOf = (tier: number): object => (tier <= 2 ? {} : tier <= 5 ? perks({ marksman: 1, plating: 1 }) : perks({ marksman: 2, plating: 2, capacitor: 1, heatsinks: 1 }));
const seedOf = (flight: number): number => (flight % 2 ? flight * 7919 : flight * 104729 + 13);
const CALLED = { machine: (kind: string) => ALL_ENEMIES[kind].name, weapon: (id: string) => CATALOG[id].name };
const TIERS = [4, 8];
const MACHINES = ['ripper', 'stalker', 'heavy-mech'];
const QUICK = ['ripper', 'stalker'];
/** Boards of the tier a notice is made at, and flights at each. */
const BOARDS = 3;
const FLIGHTS = 2;

interface Cell { wins: number; flown: number; rounds: number; net: number }
const empty = (): Cell => ({ wins: 0, flown: 0, rounds: 0, net: 0 });
const rate = (cell: Cell): number => Math.round((1000 * cell.wins) / cell.flown) / 10;
const sum = (cells: Cell[]): Cell => cells.reduce((all, c) => ({ wins: all.wins + c.wins, flown: all.flown + c.flown, rounds: all.rounds + c.rounds, net: all.net + c.net }), empty());

/** The notice as the game makes it; with `wears` false, their machine with a hardening that does not wear. */
function notice(tier: number, board: number, kind: string, met: number, knows?: string, wears = true): { mission: Mission; enemies: Record<string, EnemyDef> } {
  const grudge: Grudge = { name: 'Brakk', kind, origin: 'wrecked', ...(knows ? { knows } : {}), met, waited: 9 };
  const game = { battlesWon: tier * 5 + board, cycle: 0, grudge };
  const theirs = grudgeEnemy(game, ALL_ENEMIES)!;
  const { hardening: _, ...unworn } = theirs;
  return { mission: grudgeContract(game, BOARD_TEXT, CALLED)!, enemies: { ...ALL_ENEMIES, [GRUDGE]: wears ? theirs : unworn } };
}
function fly(build: Build, tier: number, kind: string, met: number, knows: string | undefined, cell: Cell, dealt?: Record<string, number>, boards = BOARDS, wears = true): void {
  for (let board = 0; board < boards; board++) {
    const { mission, enemies } = notice(tier, board, kind, met, knows, wears);
    for (let flight = 1; flight <= FLIGHTS; flight++) {
      const end = playMission(build, mission, enemies, CATALOG, seedOf(flight), (s) => runBattle(s, CATALOG, chooseAutoPlayerAction), { mods: pilotOf(tier), enemyScale: mission.scale ?? 1 });
      cell.flown += 1;
      cell.rounds += end.round;
      cell.net += settle(end, mission.reward, CATALOG).net;
      if (end.outcome === 'victory') cell.wins += 1;
      if (dealt) for (const [id, amount] of Object.entries(dealtBy(end, 'enemy-0'))) dealt[id] = (dealt[id] ?? 0) + amount;
    }
  }
}

/**
 * Every cell there is, flown once: by tier and machine, the first meeting (where the machine knows nothing: that is
 * how it is met) and the third, with nothing known and with the build's best weapon against that machine known.
 */
const cells = new Map<string, Cell>();
const key = (tier: number, kind: string, met: number, knows: boolean): string => `${tier}|${kind}|${met}|${knows}`;
const at = (tier: number, kind: string, met: number, knows: boolean): Cell => cells.get(key(tier, kind, met, knows))!;
beforeAll(() => {
  for (const tier of TIERS) {
    for (const kind of MACHINES) {
      expect(ENEMY_COST[kind]).toBeLessThanOrEqual(budgetFor(tier));
      for (const klass of ARCHETYPES) {
        const build = ARCHETYPE_BUILDS[klass as Archetype][stageOf(tier)];
        // The weapon the machine would know of a pilot who brings this build: the one that takes most armour off it.
        const dealt: Record<string, number> = {};
        const first = cells.get(key(tier, kind, 0, false)) ?? empty();
        cells.set(key(tier, kind, 0, false), first);
        fly(build, tier, kind, 0, undefined, first, dealt);
        const carried = [...new Set(WEAPON_SLOTS.flatMap((slot) => (build[slot] ? [build[slot]!] : [])))];
        const best = carried.sort((a, b) => (dealt[b] ?? 0) - (dealt[a] ?? 0))[0];
        for (const [met, knows] of [[2, false], [2, true]] as const) {
          const cell = cells.get(key(tier, kind, met, knows)) ?? empty();
          cells.set(key(tier, kind, met, knows), cell);
          fly(build, tier, kind, met, knows ? best : undefined, cell);
        }
      }
    }
  }
}, 180_000);

const report: string[] = [];
afterAll(() => {
  if (!process.env.BALANCE_REPORT) return;
  for (const [name, cell] of cells) report.push(`${name.padEnd(28)} ${String(rate(cell)).padStart(5)}%  ${(cell.rounds / cell.flown).toFixed(1).padStart(5)}r  ${String(Math.round(cell.net / cell.rounds)).padStart(5)} a round`);
  writeFileSync(process.env.BALANCE_REPORT, `${report.join('\n')}\n`);
});

describe('the machines an account can be about', () => {
  test('are the mechs of the board\'s pool, and these three are of them: two quick and one heavy', () => {
    const mechs = POOL.filter((id) => MECH_ENEMIES.includes(id));
    for (const kind of MACHINES) expect(mechs).toContain(kind);
    expect(cells.size).toBe(TIERS.length * MACHINES.length * 3);
    for (const cell of cells.values()) expect(cell.flown).toBe(ARCHETYPES.length * BOARDS * FLIGHTS);
  });
});

describe('no machine is a wall', () => {
  test('a build it knows nothing of wins against each of them, at the first meeting and at the third, far more often than not', () => {
    for (const tier of TIERS) for (const kind of MACHINES) for (const met of [0, 2]) {
      // Measured: 75 in a hundred at the least (a Ripper's third meeting at the fourth tier).
      expect(rate(at(tier, kind, met, false)), `tier ${tier}, ${kind}, meeting ${met + 1}`).toBeGreaterThanOrEqual(60);
    }
  });

  test('a build whose best weapon it knows still wins: nowhere near the one time in ten of a machine that knew everything', () => {
    for (const tier of TIERS) for (const kind of MACHINES) {
      // Measured: 57 in a hundred at the least (the same Ripper), 62 and better everywhere else.
      expect(rate(at(tier, kind, 2, true)), `tier ${tier}, ${kind}`).toBeGreaterThanOrEqual(40);
    }
    // And over the three machines together, at each tier, well more often than not.
    for (const tier of TIERS) expect(rate(sum(MACHINES.map((kind) => at(tier, kind, 2, true)))), `tier ${tier}`).toBeGreaterThanOrEqual(65);
  });
});

describe('what it costs to bring the weapon the machine knows', () => {
  test('it never helps', () => {
    for (const tier of TIERS) for (const kind of MACHINES) {
      expect(rate(at(tier, kind, 2, true)), `tier ${tier}, ${kind}`).toBeLessThanOrEqual(rate(at(tier, kind, 2, false)) + 5);
    }
  });

  test('against a quick machine it costs wins: the two of them together, over both tiers', () => {
    const quick = (knows: boolean): Cell => sum(TIERS.flatMap((tier) => QUICK.map((kind) => at(tier, kind, 2, knows))));
    // Measured, over two hundred flights a cell: 79 in a hundred with nothing known for 63 with the best weapon known.
    expect(rate(quick(false)) - rate(quick(true))).toBeGreaterThanOrEqual(6);
  });

  test('against any machine it costs money: a round of the fight nets a good deal less, and there are more of them', () => {
    for (const tier of TIERS) {
      const all = (knows: boolean): Cell => sum(MACHINES.map((kind) => at(tier, kind, 2, knows)));
      const [fresh, known] = [all(false), all(true)];
      // Measured over every machine: between half and two thirds of what a round nets with nothing known.
      expect(known.net / known.rounds, `tier ${tier}`).toBeLessThan(0.85 * (fresh.net / fresh.rounds));
      expect(known.rounds / known.flown, `tier ${tier}`).toBeGreaterThan(fresh.rounds / fresh.flown);
    }
  });
});

describe('a pilot with one weapon and no other', () => {
  // The reference build of the war with a carbine in one hand and a shield in the other, and nothing on its
  // shoulder: the carbine is all a machine can learn of it. At the fourth tier, against the three lightest
  // machines an account can be about, at the third meeting.
  const ONE: Build = (() => { const { shoulder: _, ...rest } = REFERENCE_BUILDS.tier3; return { ...rest, rightHand: 'wpn-pulse-carbine', leftHand: 'shd-riot' }; })();
  const GUN = 'wpn-pulse-carbine';
  const AGAINST = ['ripper', 'stalker', 'light-mech'];
  const flown = (knows: string | undefined, wears: boolean): Cell => {
    const cell = empty();
    for (const kind of AGAINST) fly(ONE, 4, kind, 2, knows, cell, undefined, 5, wears);
    return cell;
  };
  let fresh: Cell;
  let known: Cell;
  let unworn: Cell;
  beforeAll(() => {
    fresh = flown(undefined, true);
    known = flown(GUN, true);
    unworn = flown(GUN, false);
    report.push(`one weapon: nothing known ${rate(fresh)}%, known ${rate(known)}%, known with a hardening that does not wear ${rate(unworn)}%`);
  }, 120_000);

  test('is a build that may deploy, with that one weapon', () => {
    expect([...new Set(WEAPON_SLOTS.flatMap((slot) => (ONE[slot] && CATALOG[ONE[slot]!].kind === 'weapon' ? [ONE[slot]!] : [])))]).toEqual([GUN]);
    for (const kind of AGAINST) expect(ENEMY_COST[kind]).toBeLessThanOrEqual(budgetFor(4));
    expect(fresh.flown).toBe(AGAINST.length * 5 * FLIGHTS);
  });

  test('wins nearly always while the machine knows nothing', () => {
    // Measured, over thirty flights a machine: 93 in a hundred.
    expect(rate(fresh)).toBeGreaterThanOrEqual(75);
  });

  test('is at a disadvantage when it knows the weapon, and is not shut out: the hardening is shot away before the fight is done', () => {
    // Measured: 67 in a hundred, the three machines together.
    expect(rate(known)).toBeLessThan(rate(fresh));
    expect(rate(known)).toBeGreaterThanOrEqual(45);
  });

  test('which with a hardening that does not wear it was: one win in five', () => {
    // Measured: 19 in a hundred. The wearing is what makes the difference, and it is a large one.
    expect(GRUDGE_NUMBERS.hardening).toBeLessThan(1);
    expect(rate(unworn)).toBeLessThanOrEqual(40);
    expect(rate(known) - rate(unworn)).toBeGreaterThanOrEqual(20);
  });
});

describe('the third meeting against the first', () => {
  test('is the same machine a little thicker: it takes longer, and it pays half as much again', () => {
    for (const tier of TIERS) {
      const first = notice(tier, 0, 'heavy-mech', 0).mission;
      const third = notice(tier, 0, 'heavy-mech', 2).mission;
      expect(third.reward).toBe(Math.round((first.reward * 1.5) / 50) * 50);
      expect(third.scale).toBe(first.scale);
      const rounds = (met: number): number => { const c = sum(MACHINES.map((kind) => at(tier, kind, met, false))); return c.rounds / c.flown; };
      expect(rounds(2), `tier ${tier}`).toBeGreaterThan(rounds(0));
    }
  });
});
