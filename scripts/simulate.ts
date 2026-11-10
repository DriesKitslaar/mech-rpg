/**
 * Plays an encounter many times and reports how it tends to go.
 * Usage: npm run simulate -- --encounter outpost --build demo --seeds 500
 */
import { chooseAutoPlayerAction, runBattle } from '../src/core/ai';
import { createBattle } from '../src/core/battle';
import { ENCOUNTERS, ENEMIES } from '../src/content/enemies';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../src/content/parts';

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const BUILDS = { demo: DEMO_BUILD, starter: STARTER_BUILD };

const encounter = arg('--encounter', 'intro');
const buildName = arg('--build', 'demo') as keyof typeof BUILDS;
const seeds = Number(arg('--seeds', '500'));
if (!ENCOUNTERS[encounter]) throw new Error(`unknown encounter: ${encounter} (have: ${Object.keys(ENCOUNTERS).join(', ')})`);
if (!BUILDS[buildName]) throw new Error(`unknown build: ${buildName} (have: ${Object.keys(BUILDS).join(', ')})`);
if (!Number.isInteger(seeds) || seeds < 1) throw new Error('--seeds must be a positive whole number');

let wins = 0;
let rounds = 0;
let coreLeft = 0;
for (let seed = 1; seed <= seeds; seed++) {
  const start = createBattle(BUILDS[buildName], ENCOUNTERS[encounter].map((id) => ENEMIES[id]), CATALOG, seed);
  const end = runBattle(start, CATALOG, chooseAutoPlayerAction);
  if (end.outcome === 'victory') wins++;
  rounds += end.round;
  coreLeft += end.units[0].parts.core!.ap;
}
console.log(`${encounter} with ${buildName} build over ${seeds} battles`);
console.log(`  win rate            ${(100 * wins / seeds).toFixed(1)}%`);
console.log(`  mean rounds         ${(rounds / seeds).toFixed(1)}`);
console.log(`  mean core AP left   ${(coreLeft / seeds).toFixed(0)} of ${start_core()}`);

function start_core(): number {
  return createBattle(BUILDS[buildName], [], CATALOG, 1).units[0].parts.core!.maxAp;
}
