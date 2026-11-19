// How hard the arena's masters are: each master against the late build the game suggests for every class,
// flown on Auto Turn by three pilots (no perks, a veteran's six ranks, every perk there is). For each pairing:
// wins in a hundred, and how many rounds a win and a loss take. The master's own class is starred: that is the
// pairing a master is set by (see src/content/masters.ts).
//
// usage: npx tsx scripts/masters.ts [flights] [class]
import { chooseAutoPlayerAction, runBattle } from '../src/core/ai';
import { ARCHETYPES, archetypeOf } from '../src/core/archetype';
import { computeBuildStats, validatePlayerBuild } from '../src/core/build';
import { newGame } from '../src/core/game';
import { masterMission } from '../src/core/masters';
import { playMission } from '../src/core/mission';
import { perkEffects } from '../src/core/pilot';
import { ALL_ENEMIES } from '../src/content/arena';
import { ARCHETYPE_BUILDS } from '../src/content/archetypeBuilds';
import { MASTERS } from '../src/content/masters';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { PERKS } from '../src/content/perks';

const flights = Number(process.argv[2] ?? 100);
const only = process.argv[3];
const perks = (ranks: Record<string, number>): object => {
  const { aim, evasion, energy, cooling, repairs, armour } = perkEffects(ranks, PERKS);
  return { aim, evasion, energy, cooling, repairs, armour };
};
const PILOTS: Record<string, object> = {
  none: {},
  veteran: perks({ marksman: 2, plating: 2, capacitor: 1, heatsinks: 1 }),
  full: perks({ marksman: 3, reflexes: 3, capacitor: 3, heatsinks: 3, fieldTech: 2, plating: 3 }),
};
const game = newGame(CATALOG, STARTER_BUILD);

for (const master of MASTERS) {
  if (only && only !== master.kind) continue;
  const mission = masterMission(game, master, { client: '', win: '' });
  const stats = computeBuildStats(master.build, CATALOG);
  console.log(`${master.name} (${archetypeOf(master.build, CATALOG)}) x${master.scale} plating +${master.plating ?? 0}  load ${stats.weight}/${stats.capacity} energy ${stats.turnEnergy} mobility ${stats.mobility} ${validatePlayerBuild(master.build, CATALOG).join(',')}`);
  for (const [pilot, mods] of Object.entries(PILOTS)) {
    const cells = ARCHETYPES.map((challenger) => {
      let wins = 0;
      let wonRounds = 0;
      let lostRounds = 0;
      for (let flight = 1; flight <= flights; flight++) {
        const seed = flight % 2 ? flight * 7919 : flight * 104729 + 13;
        const end = playMission(ARCHETYPE_BUILDS[challenger].late, mission, ALL_ENEMIES, CATALOG, seed, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction), { mods, enemyScale: mission.scale ?? 1 });
        if (end.outcome === 'victory') { wins += 1; wonRounds += end.round; } else lostRounds += end.round;
      }
      const won = wins ? (wonRounds / wins).toFixed(1) : '-';
      const lost = flights - wins ? (lostRounds / (flights - wins)).toFixed(1) : '-';
      return `${challenger === master.kind ? '*' : ' '}${challenger.slice(0, 4)} ${String(Math.round((wins / flights) * 100)).padStart(3)}% (${won}/${lost})`;
    });
    console.log(`  ${pilot.padEnd(8)}${cells.join(' ')}`);
  }
}
