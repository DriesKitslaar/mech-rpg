/**
 * Plays a contract many times and reports how it tends to go.
 * Usage: npm run simulate -- --mission hadron-1 --build tier1 --seeds 300
 *        npm run simulate -- --all            every contract with every reference build
 *        npm run simulate -- --arena          every arena opponent with every reference build
 *        npm run simulate -- --board          open contracts at every tier
 * Add --cycle N for story contracts in a later cycle, and --perks to give the pilot six typical perk ranks.
 */
import { chooseAutoPlayerAction, runBattle } from '../src/core/ai';
import { settle } from '../src/core/economy';
import { playMission } from '../src/core/mission';
import { validatePlayerBuild } from '../src/core/build';
import { arenaMission } from '../src/core/arena';
import { WINS_PER_TIER, generateBoard } from '../src/core/board';
import { forCycle, type Mission } from '../src/core/campaign';
import { newGame } from '../src/core/game';
import { perkEffects } from '../src/core/pilot';
import { ALL_ENEMIES, ARENA } from '../src/content/arena';
import { BOARD_TEXT } from '../src/content/board';
import { PERKS } from '../src/content/perks';
import { STARTER_BUILD } from '../src/content/parts';
import { MISSIONS } from '../src/content/missions';
import { CATALOG } from '../src/content/parts';
import { REFERENCE_BUILDS } from '../src/content/referenceBuilds';

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

const PERK_RANKS: Record<string, number> = process.argv.includes('--perks') ? { marksman: 2, plating: 2, capacitor: 1, heatsinks: 1 } : {};
const { aim, evasion, energy, cooling, repairs, armour, payBonus, costDiscount } = perkEffects(PERK_RANKS, PERKS);
const mods = { aim, evasion, energy, cooling, repairs, armour };

/** Win rate and mean net pay of one contract with one reference build. */
function play(mission: Mission, buildName: string, seeds: number): { win: number; net: number } {
  const build = REFERENCE_BUILDS[buildName];
  let wins = 0;
  let net = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const end = playMission(build, mission, ALL_ENEMIES, CATALOG, seed * 7919, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction),
      { mods, enemyScale: mission.scale ?? 1 });
    if (end.outcome === 'victory') wins++;
    net += settle(end, mission.reward, CATALOG, { payBonus, costDiscount }).net;
  }
  return { win: Math.round(100 * wins / seeds), net: Math.round(net / seeds) };
}

const cell = (r: { win: number; net: number }): string => `${String(r.win).padStart(3)}% ${String(r.net).padStart(6)}`;
const BUILD_NAMES = Object.keys(REFERENCE_BUILDS);
const header = (first: string): string => `${first.padEnd(22)}${BUILD_NAMES.map((b) => b.padStart(12)).join('')}`;

function arenaReport(seeds: number): void {
  console.log(header('arena (win%, net)'));
  const game = newGame(CATALOG, STARTER_BUILD);
  for (const opponent of ARENA) {
    const mission = arenaMission(game, opponent, { client: '', win: '' });
    console.log(`${`${opponent.rank}. ${opponent.name}`.padEnd(22)}${BUILD_NAMES.map((b) => cell(play(mission, b, seeds)).padStart(12)).join('')}`);
  }
}

function boardReport(seeds: number): void {
  console.log(header('open contracts'));
  for (let tier = 0; tier <= 8; tier++) {
    // The heaviest contract of several boards of the tier.
    const boards = [0, 1, 2, 3, 4].map((i) => generateBoard(tier * WINS_PER_TIER + i, 0, BOARD_TEXT)[2]);
    const cells = BUILD_NAMES.map((b) => {
      const results = boards.map((m) => play(m, b, Math.max(20, Math.round(seeds / boards.length))));
      const mean = (key: 'win' | 'net') => Math.round(results.reduce((sum, r) => sum + r[key], 0) / results.length);
      return cell({ win: mean('win'), net: mean('net') }).padStart(12);
    });
    console.log(`${`tier ${tier}`.padEnd(22)}${cells.join('')}`);
  }
}

const cycle = Number(arg('--cycle', '0'));

function report(missionId: string, buildName: string, seeds: number): string {
  const base = MISSIONS.find((m) => m.id === missionId);
  const mission = base && forCycle(base, cycle);
  const build = REFERENCE_BUILDS[buildName];
  if (!mission) throw new Error(`unknown mission: ${missionId} (have: ${MISSIONS.map((m) => m.id).join(', ')})`);
  if (!build) throw new Error(`unknown build: ${buildName} (have: ${Object.keys(REFERENCE_BUILDS).join(', ')})`);
  const errors = validatePlayerBuild(build, CATALOG);
  if (errors.length) throw new Error(`build ${buildName} is not valid: ${errors.join(', ')}`);

  const { win, net } = play(mission, buildName, seeds);
  return `${missionId.padEnd(16)} ${buildName.padEnd(8)} win ${String(win).padStart(3)}%   mean net ${String(net).padStart(6)}`;
}

const seeds = Number(arg('--seeds', '300'));
if (!Number.isInteger(seeds) || seeds < 1) throw new Error('--seeds must be a positive whole number');
if (process.argv.includes('--arena')) arenaReport(seeds);
else if (process.argv.includes('--board')) boardReport(seeds);
else if (process.argv.includes('--all')) {
  for (const mission of MISSIONS) {
    for (const build of Object.keys(REFERENCE_BUILDS)) console.log(report(mission.id, build, seeds));
    console.log('');
  }
} else {
  console.log(report(arg('--mission', 'patrol'), arg('--build', 'starter'), seeds));
}
