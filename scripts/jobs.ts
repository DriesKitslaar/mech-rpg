// How the board's jobs play: each kind at each tier, flown on Auto Turn in the build the game suggests for
// every class at that stage, on both difficulties. For each: wins in a hundred, the rounds a flight takes, and
// what a round of it nets (the fee less ammunition and repairs, a lost flight included) beside what a round of
// the board's own contracts nets for the same pilots. The numbers in src/core/jobs.ts were set from this.
//
// usage: npx tsx scripts/jobs.ts [jobs per cell] [flights per job] [name=value ...]
//   a name is a kind (hit, repo, escort, hold: only those are flown), `tiers` (a list: tiers=2,6) or one of
//   the numbers of JOB_NUMBERS, to try another value.
import { chooseAutoPlayerAction, runBattle } from '../src/core/ai';
import { ARCHETYPES } from '../src/core/archetype';
import { generateBoard, scaleFor } from '../src/core/board';
import type { Mission } from '../src/core/campaign';
import { settle } from '../src/core/economy';
import { JOB_KINDS, JOB_NUMBERS, makeJob, type JobKind, type JobNumbers } from '../src/core/jobs';
import { playMission } from '../src/core/mission';
import { perkEffects } from '../src/core/pilot';
import { ALL_ENEMIES } from '../src/content/arena';
import { ARCHETYPE_BUILDS, type Stage } from '../src/content/archetypeBuilds';
import { BOARD_TEXT } from '../src/content/board';
import { CATALOG } from '../src/content/parts';
import { PERKS } from '../src/content/perks';

const jobs = Number(process.argv[2] ?? 10);
const flights = Number(process.argv[3] ?? 6);
const numbers: JobNumbers = { ...JOB_NUMBERS };
let kinds: JobKind[] = [];
let tiers = [1, 2, 4, 6, 8];
for (const arg of process.argv.slice(4)) {
  const [name, value] = arg.split('=');
  if ((JOB_KINDS as string[]).includes(name)) kinds.push(name as JobKind);
  else if (name === 'tiers') tiers = value.split(',').map(Number);
  else if (name in numbers) (numbers as unknown as Record<string, number>)[name] = Number(value);
  else throw new Error(`unknown: ${arg}`);
}
if (kinds.length === 0) kinds = [...JOB_KINDS];

const perks = (ranks: Record<string, number>): object => {
  const { aim, evasion, energy, cooling, repairs, armour } = perkEffects(ranks, PERKS);
  return { aim, evasion, energy, cooling, repairs, armour };
};
/** The build and the pilot a tier is met with: the stages of the story, as the board grows through them. */
export const stageOf = (tier: number): Stage => (tier <= 2 ? 'early' : tier <= 5 ? 'war' : 'late');
const pilotOf = (tier: number): object => (tier <= 2 ? {} : tier <= 5 ? perks({ marksman: 1, plating: 1 }) : perks({ marksman: 2, plating: 2, capacitor: 1, heatsinks: 1 }));
const seedOf = (flight: number): number => (flight % 2 ? flight * 7919 : flight * 104729 + 13);

interface Cell { wins: number; flown: number; rounds: number; net: number }
function fly(mission: Mission, tier: number, difficulty: number, kind: (typeof ARCHETYPES)[number], cell: Cell): void {
  for (let flight = 1; flight <= flights; flight++) {
    const end = playMission(ARCHETYPE_BUILDS[kind][stageOf(tier)], mission, ALL_ENEMIES, CATALOG, seedOf(flight), (s) => runBattle(s, CATALOG, chooseAutoPlayerAction),
      { mods: pilotOf(tier), enemyScale: (mission.scale ?? 1) * difficulty });
    cell.flown += 1;
    cell.rounds += end.round;
    cell.net += settle(end, mission.reward, CATALOG).net;
    if (end.outcome === 'victory') cell.wins += 1;
  }
}
const show = (cell: Cell): string => `${String(Math.round((cell.wins / cell.flown) * 100)).padStart(3)}% ${(cell.rounds / cell.flown).toFixed(1).padStart(4)}r ${String(Math.round(cell.net / cell.rounds)).padStart(4)}`;

console.log(`${jobs} jobs a cell, ${flights} flights a job; numbers ${JSON.stringify(numbers)}`);
console.log('each cell: wins, rounds a flight, net a round');
for (const difficulty of [1, 1.2]) {
  for (const tier of tiers) {
    // The board's own, for the same pilots: its three contracts at a progress of that tier (the first battle of each, as a job is one battle).
    const own = ARCHETYPES.map((kind) => {
      const cell: Cell = { wins: 0, flown: 0, rounds: 0, net: 0 };
      for (let i = 0; i < Math.max(1, Math.round(jobs / 3)); i++) {
        for (const contract of generateBoard(tier * 5 + (i % 5), 0, BOARD_TEXT)) fly({ ...contract, scale: scaleFor(tier) }, tier, difficulty, kind, cell);
      }
      return cell;
    });
    console.log(`x${difficulty} t${tier} ${'board'.padEnd(6)} ${ARCHETYPES.map((kind, i) => `${kind.slice(0, 4)} ${show(own[i])}`).join('  ')}`);
    for (const kind of kinds) {
      const cells = ARCHETYPES.map((flown) => {
        const cell: Cell = { wins: 0, flown: 0, rounds: 0, net: 0 };
        for (let i = 0; i < jobs; i++) fly({ id: 'open-0-0-job', ...makeJob(kind, tier, (i + 1) * 86028121 + tier * 7919, BOARD_TEXT, numbers) }, tier, difficulty, flown, cell);
        return cell;
      });
      const rates = cells.map((cell) => cell.wins / cell.flown);
      console.log(`x${difficulty} t${tier} ${kind.padEnd(6)} ${ARCHETYPES.map((flown, i) => `${flown.slice(0, 4)} ${show(cells[i])}`).join('  ')}   worst ${Math.round(Math.min(...rates) * 100)} best ${Math.round(Math.max(...rates) * 100)}`);
    }
  }
}
// A few of them, to read.
for (const tier of tiers) {
  for (const kind of kinds) {
    const job = makeJob(kind, tier, 86028121 + tier * 7919, BOARD_TEXT, numbers);
    const battle = job.battles[0];
    console.log(`t${tier} ${job.title}: ${battle.enemies.join(', ')}${battle.reserve ? ` + ${battle.reserve.join(', ')}` : ''}  ${JSON.stringify(battle.objective)}${battle.marks ? ` ${JSON.stringify(battle.marks)}` : ''}  pays ${job.reward} x${job.scale?.toFixed(2)}`);
  }
}
