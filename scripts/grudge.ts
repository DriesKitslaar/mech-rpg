// How the meetings of an account play: each of the three at each tier, flown on Auto Turn in the build the game
// suggests for every class at that stage, on both difficulties, against every mech the tier's budget pays for.
// Each is flown twice over: with none of the build's weapons known to the machine, and with the one that does
// most to it known (which is what it knows of a pilot who brings the same build again). For each: wins in a
// hundred, the rounds a flight takes, and what a round of it nets beside what a round of a hit nets for the same
// pilots. The numbers in src/core/grudge.ts were set from this.
//
// usage: npx tsx scripts/grudge.ts [flights per machine] [name=value ...]
//   a name is `tiers` (a list: tiers=2,6), `plating` or `pay` (three figures: plating=0,0.15,0.3), `par`, or `by=machine`
//   to have a row for each machine, the classes together, in place of a row for each meeting, the machines together;
//   `machines` (a list: machines=ripper,stalker) keeps it to those.
import { chooseAutoPlayerAction, runBattle } from '../src/core/ai';
import { ARCHETYPES, type Archetype } from '../src/core/archetype';
import type { BattleState } from '../src/core/battle';
import { ENEMY_COST, MECH_ENEMIES, POOL, budgetFor } from '../src/core/board';
import type { Mission } from '../src/core/campaign';
import { settle } from '../src/core/economy';
import { GRUDGE, GRUDGE_NUMBERS, dealtBy, grudgeContract, grudgeEnemy, type Grudge, type GrudgeNumbers } from '../src/core/grudge';
import { makeJob } from '../src/core/jobs';
import { playMission } from '../src/core/mission';
import { perkEffects } from '../src/core/pilot';
import { WEAPON_SLOTS, type Build } from '../src/core/types';
import { ALL_ENEMIES } from '../src/content/arena';
import { ARCHETYPE_BUILDS, type Stage } from '../src/content/archetypeBuilds';
import { BOARD_TEXT } from '../src/content/board';
import { CATALOG } from '../src/content/parts';
import { PERKS } from '../src/content/perks';

const flights = Number(process.argv[2] ?? 6);
const numbers: GrudgeNumbers = { ...GRUDGE_NUMBERS };
let tiers = [3, 4, 6, 8];
let byMachine = false;
let only: string[] | null = null;
for (const arg of process.argv.slice(3)) {
  const [name, value] = arg.split('=');
  if (name === 'tiers') tiers = value.split(',').map(Number);
  else if (name === 'plating' || name === 'pay') numbers[name] = value.split(',').map(Number);
  else if (name === 'par') numbers.par = Number(value);
  else if (name === 'by' && value === 'machine') byMachine = true;
  else if (name === 'machines') only = value.split(',');
  else throw new Error(`unknown: ${arg}`);
}

const perks = (ranks: Record<string, number>): object => {
  const { aim, evasion, energy, cooling, repairs, armour } = perkEffects(ranks, PERKS);
  return { aim, evasion, energy, cooling, repairs, armour };
};
/** The build and the pilot a tier is met with: the stages of the story, as the board grows through them. */
const stageOf = (tier: number): Stage => (tier <= 2 ? 'early' : tier <= 5 ? 'war' : 'late');
const pilotOf = (tier: number): object => (tier <= 2 ? {} : tier <= 5 ? perks({ marksman: 1, plating: 1 }) : perks({ marksman: 2, plating: 2, capacitor: 1, heatsinks: 1 }));
const seedOf = (flight: number): number => (flight % 2 ? flight * 7919 : flight * 104729 + 13);
const MECHS = POOL.filter((id) => MECH_ENEMIES.includes(id));
const CALLED = { machine: (kind: string) => ALL_ENEMIES[kind].name, weapon: (id: string) => CATALOG[id].name };

interface Cell { wins: number; flown: number; rounds: number; net: number }
const empty = (): Cell => ({ wins: 0, flown: 0, rounds: 0, net: 0 });
const show = (cell: Cell): string =>
  `${String(Math.round((cell.wins / cell.flown) * 100)).padStart(3)}% ${(cell.rounds / cell.flown).toFixed(1).padStart(4)}r ${String(Math.round(cell.net / cell.rounds)).padStart(4)}`;

/** The notice of an account at this tier, about this machine, at this meeting, knowing this weapon (or none). */
function notice(tier: number, i: number, kind: string, met: number, knows?: string): { mission: Mission; enemies: typeof ALL_ENEMIES } {
  const grudge: Grudge = { name: 'Brakk', kind, origin: 'wrecked', ...(knows ? { knows } : {}), met, waited: 9 };
  const game = { battlesWon: tier * 5 + (i % 5), cycle: 0, grudge };
  return { mission: grudgeContract(game, BOARD_TEXT, CALLED, numbers)!, enemies: { ...ALL_ENEMIES, [GRUDGE]: grudgeEnemy(game, ALL_ENEMIES, numbers)! } };
}
function fly(build: Build, mission: Mission, enemies: typeof ALL_ENEMIES, tier: number, difficulty: number, cell: Cell, seen?: (state: BattleState) => void): void {
  for (let flight = 1; flight <= flights; flight++) {
    const end = playMission(build, mission, enemies, CATALOG, seedOf(flight), (s) => runBattle(s, CATALOG, chooseAutoPlayerAction),
      { mods: pilotOf(tier), enemyScale: (mission.scale ?? 1) * difficulty });
    cell.flown += 1;
    cell.rounds += end.round;
    cell.net += settle(end, mission.reward, CATALOG).net;
    if (end.outcome === 'victory') cell.wins += 1;
    seen?.(end);
  }
}

console.log(`${flights} flights a machine; numbers ${JSON.stringify(numbers)}`);
console.log('each cell: wins, rounds a flight, net a round. Rows: a hit, then each meeting with nothing known and with the build\'s best weapon known');
for (const difficulty of [1, 1.2]) {
  for (const tier of tiers) {
    const kinds = MECHS.filter((id) => ENEMY_COST[id] <= budgetFor(tier) && (!only || only.includes(id)));
    const stage = stageOf(tier);
    // What each class's weapons do to the named machine, with nothing known: the order they would be learned in.
    const order = {} as Record<Archetype, string[]>;
    for (const klass of ARCHETYPES) {
      const build = ARCHETYPE_BUILDS[klass][stage];
      const dealt: Record<string, number> = {};
      kinds.forEach((kind, i) => {
        const { mission, enemies } = notice(tier, i, kind, 0);
        fly(build, mission, enemies, tier, difficulty, empty(), (end) => { for (const [id, n] of Object.entries(dealtBy(end, 'enemy-0'))) dealt[id] = (dealt[id] ?? 0) + n; });
      });
      const carried = [...new Set(WEAPON_SLOTS.flatMap((slot) => (build[slot] ? [build[slot]!] : [])))];
      order[klass] = carried.sort((a, b) => (dealt[b] ?? 0) - (dealt[a] ?? 0));
    }
    const hits = ARCHETYPES.map((klass) => {
      const cell = empty();
      for (let i = 0; i < kinds.length; i++) fly(ARCHETYPE_BUILDS[klass][stage], { id: 'open-0-0-job', ...makeJob('hit', tier, (i + 1) * 86028121 + tier * 7919, BOARD_TEXT) }, ALL_ENEMIES, tier, difficulty, cell);
      return cell;
    });
    const line = (label: string, cells: Cell[]): void => {
      const all = cells.reduce((sum, c) => ({ wins: sum.wins + c.wins, flown: sum.flown + c.flown, rounds: sum.rounds + c.rounds, net: sum.net + c.net }), empty());
      const rates = cells.map((c) => c.wins / c.flown);
      console.log(`x${difficulty} t${tier} ${label.padEnd(9)} ${ARCHETYPES.map((k, i) => `${k.slice(0, 4)} ${show(cells[i])}`).join('  ')}   all ${show(all)}  worst ${Math.round(Math.min(...rates) * 100)}`);
    };
    line('hit', hits);
    if (byMachine) {
      // Each machine on its own, the classes together: each meeting with nothing known, then with the best weapon known.
      for (const kind of kinds) {
        const cells = [0, 1, 2].flatMap((met) => (['none', 'known'] as const).map((knows) => {
          const cell = empty();
          // At each of the tier's five progresses: the company differs from one to the next.
          for (const klass of ARCHETYPES) {
            for (let i = 0; i < 5; i++) {
              const { mission, enemies } = notice(tier, i, kind, met, knows === 'none' ? undefined : order[klass][0]);
              fly(ARCHETYPE_BUILDS[klass][stage], mission, enemies, tier, difficulty, cell);
            }
          }
          return cell;
        }));
        console.log(`x${difficulty} t${tier} ${kind.padEnd(11)} ${cells.map((c, i) => `${i % 2 ? 'known' : `${i / 2 + 1} none`} ${show(c)}`).join('  ')}`);
      }
      continue;
    }
    for (const met of [0, 1, 2]) {
      for (const knows of ['none', 'known'] as const) {
        const cells = ARCHETYPES.map((klass) => {
          const cell = empty();
          const known = knows === 'none' ? undefined : order[klass][0];
          kinds.forEach((kind, i) => { const { mission, enemies } = notice(tier, i, kind, met, known); fly(ARCHETYPE_BUILDS[klass][stage], mission, enemies, tier, difficulty, cell); });
          return cell;
        });
        line(`${met + 1} ${knows}`, cells);
      }
    }
  }
}
// A few of them, to read.
for (const tier of tiers) {
  const { mission } = notice(tier, 0, MECHS.filter((id) => ENEMY_COST[id] <= budgetFor(tier))[0], 0);
  console.log(`t${tier} ${mission.title}: ${mission.battles[0].enemies.join(', ')}  pays ${mission.reward}  scale ${mission.scale}`);
}
