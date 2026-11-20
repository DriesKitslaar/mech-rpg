/**
 * Sets weapons side by side: flies contracts many times in one build with one slot changed, and prints
 * how often each choice wins and how long the wins take.
 *
 * Usage: npm run bench -- --build tier4 --slot rightHand --with wpn-rail-lance,wpn-slagcaster
 *        add --set generator=gen-prism,module=mod-limiter   to change other slots of the build first
 *        add --only path,audit-1   story contracts of these phases, or whose id starts with one of these (all of them, when absent)
 *        add --arena               the arena's ladder in place of the story
 *        add --board               the heaviest open contract of several boards at every tier, in place of the story
 *        add --seeds 100           how many times each contract is flown (100)
 *        add --perks               six typical perk ranks, as the simulation script gives
 * `--with` may name `=` for the build as it is, and `--with` and `--set` may name `none` for an empty slot.
 */
import { chooseAutoPlayerAction, runBattle } from '../src/core/ai';
import { arenaMission } from '../src/core/arena';
import { WINS_PER_TIER, generateBoard } from '../src/core/board';
import { validatePlayerBuild } from '../src/core/build';
import type { Mission } from '../src/core/campaign';
import { newGame } from '../src/core/game';
import { playMission } from '../src/core/mission';
import { perkEffects } from '../src/core/pilot';
import type { Build } from '../src/core/types';
import { ALL_ENEMIES, ARENA } from '../src/content/arena';
import { BOARD_TEXT } from '../src/content/board';
import { MISSIONS } from '../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../src/content/parts';
import { PERKS } from '../src/content/perks';
import { REFERENCE_BUILDS } from '../src/content/referenceBuilds';

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const list = (name: string): string[] => arg(name, '').split(',').filter(Boolean);

const PERK_RANKS: Record<string, number> = process.argv.includes('--perks') ? { marksman: 2, plating: 2, capacitor: 1, heatsinks: 1 } : {};
const { aim, evasion, energy, cooling, repairs, armour } = perkEffects(PERK_RANKS, PERKS);
const mods = { aim, evasion, energy, cooling, repairs, armour };

const base = REFERENCE_BUILDS[arg('--build', 'tier4')];
if (!base) throw new Error(`unknown build (have: ${Object.keys(REFERENCE_BUILDS).join(', ')})`);
/** The build with one slot holding another part, or (`none`) nothing. */
function withPart(build: Build, slot: string, part: string): Build {
  const next: { [slot: string]: string | undefined } = { ...build, [slot]: part };
  if (part === 'none') delete next[slot];
  return next as unknown as Build;
}
const changed = list('--set').reduce((build, pair) => withPart(build, ...(pair.split('=') as [string, string])), base);
const slot = arg('--slot', 'rightHand');
const choices = list('--with');
if (choices.length === 0) throw new Error('--with names no weapon');
const builds = choices.map((choice): Build => {
  const build = choice === '=' ? changed : withPart(changed, slot, choice);
  const errors = validatePlayerBuild(build, CATALOG);
  if (errors.length > 0) throw new Error(`with ${choice} the build is not valid: ${errors.join(', ')}`);
  return build;
});

function contracts(): Mission[] {
  if (process.argv.includes('--arena')) {
    const game = newGame(CATALOG, STARTER_BUILD);
    return ARENA.map((opponent) => ({ ...arenaMission(game, opponent, { client: '', win: '' }), id: `arena ${opponent.rank} ${opponent.name}` }));
  }
  if (process.argv.includes('--board')) {
    return [0, 1, 2, 3, 4, 5, 6, 7, 8].flatMap((tier) => [0, 1, 2].map((i) => ({ ...generateBoard(tier * WINS_PER_TIER + i, 0, BOARD_TEXT)[2], id: `board ${tier}.${i}` })));
  }
  const only = list('--only');
  return MISSIONS.filter((m) => only.length === 0 || only.some((word) => m.id.startsWith(word) || m.phase === word));
}

const seeds = Number(arg('--seeds', '100'));
/** How often a build wins a contract, in a hundred, and how many rounds its wins take. */
function fly(build: Build, mission: Mission): { win: number; rounds: number } {
  let wins = 0;
  let rounds = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    let total = 0;
    const end = playMission(build, mission, ALL_ENEMIES, CATALOG, seed * 7919, (s) => {
      const done = runBattle(s, CATALOG, chooseAutoPlayerAction);
      total += done.round;
      return done;
    }, { mods, enemyScale: mission.scale ?? 1 });
    if (end.outcome === 'victory') { wins += 1; rounds += total; }
  }
  return { win: Math.round((100 * wins) / seeds), rounds: wins > 0 ? rounds / wins : 0 };
}

const names = choices.map((choice) => (choice.startsWith('wpn-') ? choice.slice(4) : choice).slice(0, 13));
console.log(`${`${arg('--build', 'tier4')} ${slot}`.padEnd(24)}${names.map((n) => n.padStart(15)).join('')}`);
const sums = choices.map(() => ({ win: 0, rounds: 0, won: 0 }));
const all = contracts();
for (const mission of all) {
  const cells = builds.map((build, i) => {
    const got = fly(build, mission);
    sums[i].win += got.win;
    if (got.win > 0) { sums[i].rounds += got.rounds; sums[i].won += 1; }
    return `${String(got.win).padStart(4)}% ${got.rounds.toFixed(1).padStart(5)}r`.padStart(15);
  });
  console.log(`${mission.id.slice(0, 23).padEnd(24)}${cells.join('')}`);
}
console.log(`${'mean'.padEnd(24)}${sums.map((s) => `${(s.win / all.length).toFixed(1).padStart(5)}% ${(s.won > 0 ? s.rounds / s.won : 0).toFixed(1).padStart(4)}r`.padStart(15)).join('')}`);
