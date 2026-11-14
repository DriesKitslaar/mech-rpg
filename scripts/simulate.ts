/**
 * Plays a contract many times and reports how it tends to go.
 * Usage: npm run simulate -- --mission hadron-1 --build tier1 --seeds 300
 *        npm run simulate -- --all            every contract with every reference build
 */
import { chooseAutoPlayerAction, runBattle } from '../src/core/ai';
import { settle } from '../src/core/economy';
import { playMission } from '../src/core/mission';
import { validatePlayerBuild } from '../src/core/build';
import { ENEMIES } from '../src/content/enemies';
import { MISSIONS } from '../src/content/missions';
import { CATALOG } from '../src/content/parts';
import { REFERENCE_BUILDS } from '../src/content/referenceBuilds';

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

function report(missionId: string, buildName: string, seeds: number): string {
  const mission = MISSIONS.find((m) => m.id === missionId);
  const build = REFERENCE_BUILDS[buildName];
  if (!mission) throw new Error(`unknown mission: ${missionId} (have: ${MISSIONS.map((m) => m.id).join(', ')})`);
  if (!build) throw new Error(`unknown build: ${buildName} (have: ${Object.keys(REFERENCE_BUILDS).join(', ')})`);
  const errors = validatePlayerBuild(build, CATALOG);
  if (errors.length) throw new Error(`build ${buildName} is not valid: ${errors.join(', ')}`);

  let wins = 0;
  let net = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const end = playMission(build, mission, ENEMIES, CATALOG, seed * 7919, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction));
    if (end.outcome === 'victory') wins++;
    net += settle(end, mission.reward, CATALOG).net;
  }
  return `${missionId.padEnd(16)} ${buildName.padEnd(8)} win ${(100 * wins / seeds).toFixed(0).padStart(3)}%   mean net ${(net / seeds).toFixed(0).padStart(6)}`;
}

const seeds = Number(arg('--seeds', '300'));
if (!Number.isInteger(seeds) || seeds < 1) throw new Error('--seeds must be a positive whole number');
if (process.argv.includes('--all')) {
  for (const mission of MISSIONS) {
    for (const build of Object.keys(REFERENCE_BUILDS)) console.log(report(mission.id, build, seeds));
    console.log('');
  }
} else {
  console.log(report(arg('--mission', 'patrol'), arg('--build', 'starter'), seeds));
}
