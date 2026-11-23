import { ARCHETYPES, kindsWon, mostWonAs } from '../core/archetype';
import { ARENA_RANKS, CHAMPION_RANK } from '../core/arena';
import { checksHeld, papersFound } from '../core/codex';
import { FACTORY_PAINT, type GameState } from '../core/game';
import { accountsClosed, meetingsWon } from '../core/grudge';
import { JOB_KINDS, jobsWon, kindsOfJob } from '../core/jobs';
import { crownsHeld } from '../core/masters';
import { isMix } from '../core/mix';
import { seatHeld } from '../core/seat';
import { ALL_STRIPES, stripesHeld } from '../core/stripes';
import type { Medal } from '../core/medals';
import { levelFor } from '../core/pilot';
import { TUNE_MAX, stepOf, tunable } from '../core/tuning';
import type { Weapon } from '../core/types';
import { DRILLS } from './drills';
import { ENEMIES } from './enemies';
import { CATALOG } from './parts';

type Progress = Medal['progress'];
/** `need` of something that is counted. */
const count = (need: number, have: (game: GameState) => number): Progress => (game) => ({ have: have(game), need });
/** Something that is either so or not. */
const once = (so: (game: GameState) => boolean): Progress => count(1, (game) => (so(game) ? 1 : 0));
/** A story contract done in this cycle. A medal, once earned, outlasts the cycle. */
const did = (missionId: string): Progress => once((game) => game.completed.includes(missionId));
/** How many of the given medals are held. */
const held = (ids: string[]): Progress => count(ids.length, (game) => ids.filter((id) => game.medals.includes(id)).length);
const sRanks = (game: GameState): number => Object.values(game.ranks).filter((rank) => rank === 'S').length;
/**
 * Every step the bench has taken, over all the pilot's parts; and the furthest it has taken any one
 * of them. Only parts there are, of a kind the bench takes: a name that is no part earns nothing.
 */
const steps = (game: GameState): number[] => Object.keys(game.tuning ?? {})
  .filter((id) => Object.hasOwn(CATALOG, id) && tunable(CATALOG[id])).map((id) => stepOf(game.tuning, id));
const benchSteps = (game: GameState): number => steps(game).reduce((sum, step) => sum + step, 0);
const furthestStep = (game: GameState): number => Math.max(0, ...steps(game));
/** The duels with the two works pilots. */
export const WORKS_DUELS = ['duel-3', 'duel-4'];
/** The kinds of weapon that ask something of their machine, and how many of them the pilot owns a weapon of. */
export const WEAPON_KINDS: NonNullable<Weapon['trait']>[] = ['redline', 'surge', 'punish', 'fork', 'spool'];
const kindsOwned = (game: GameState): number => WEAPON_KINDS.filter((kind) => Object.keys(game.inventory).some((id) => {
  const part = game.inventory[id] > 0 && Object.hasOwn(CATALOG, id) ? CATALOG[id] : undefined;
  return part?.kind === 'weapon' && part.trait === kind;
})).length;
const KINDS = Object.keys(ENEMIES);
const kindsMet = (game: GameState): number => KINDS.filter((id) => game.met.includes(id)).length;

const EARNED: Medal[] = [
  // The work.
  { id: 'first-contract', name: 'First Invoice', text: 'Complete a contract.', tier: 1, progress: count(1, (g) => g.stats.contracts) },
  { id: 'contracts-25', name: 'Steady Work', text: 'Complete 25 contracts.', tier: 2, progress: count(25, (g) => g.stats.contracts) },
  { id: 'contracts-100', name: 'Institution', text: 'Complete 100 contracts.', tier: 3, progress: count(100, (g) => g.stats.contracts) },
  { id: 'first-loss', name: 'Write-Off', text: 'Lose a contract. It happens to everyone once.', tier: 1, progress: count(1, (g) => g.stats.lost) },
  { id: 'first-retreat', name: 'Live to Bill', text: 'Walk away from a contract.', tier: 1, progress: count(1, (g) => g.stats.retreats) },
  { id: 'earned', name: 'Six Figures', text: 'Be paid 100000 credits for contracts, all told.', tier: 2, progress: count(100000, (g) => g.stats.earned) },
  { id: 'rich', name: 'Liquid', text: 'Hold 30000 credits at once.', tier: 2, progress: count(30000, (g) => g.credits) },
  // The fighting.
  { id: 'kills-50', name: 'Scrap Dealer', text: 'Destroy 50 enemies.', tier: 2, progress: count(50, (g) => g.stats.kills) },
  { id: 'kills-250', name: 'Breaker\'s Yard', text: 'Destroy 250 enemies.', tier: 3, progress: count(250, (g) => g.stats.kills) },
  { id: 'parts-60', name: 'Surgeon', text: 'Shoot 60 parts off enemies.', tier: 2, progress: count(60, (g) => g.stats.parts) },
  { id: 'staggers-40', name: 'Off Balance', text: 'Stagger enemies 40 times.', tier: 2, progress: count(40, (g) => g.stats.staggers) },
  { id: 'hits-1000', name: 'Dead Centre', text: 'Land 1000 shots.', tier: 2, progress: count(1000, (g) => g.stats.hits) },
  { id: 'bombs-5', name: 'Bomb Disposal', text: 'Destroy 5 bomb crawlers before they go off.', tier: 1, progress: count(5, (g) => g.stats.bombs) },
  { id: 'first-boss', name: 'Giant Killer', text: 'Win a battle against a boss.', tier: 1, progress: count(1, (g) => g.stats.bosses) },
  { id: 'bosses-8', name: 'Machine Breaker', text: 'Win 8 battles against bosses.', tier: 2, progress: count(8, (g) => g.stats.bosses) },
  { id: 'overheats-10', name: 'Hothead', text: 'Lose 10 turns to heat.', tier: 1, progress: count(10, (g) => g.stats.overheats) },
  // Doing it well.
  { id: 'first-flawless', name: 'Not a Scratch', text: 'Win a contract without being hit.', tier: 1, progress: count(1, (g) => g.stats.flawless) },
  { id: 'flawless-10', name: 'Untouchable', text: 'Win 10 contracts without being hit.', tier: 3, progress: count(10, (g) => g.stats.flawless) },
  { id: 'first-s', name: 'Signature Work', text: 'Earn an S rank on a story contract.', tier: 1, progress: count(1, sRanks) },
  { id: 's-10', name: 'Gold Standard', text: 'Hold an S rank on 10 story contracts.', tier: 2, progress: count(10, sRanks) },
  { id: 's-25', name: 'Perfect Ledger', text: 'Hold an S rank on 25 story contracts.', tier: 3, progress: count(25, sRanks) },
  // The story.
  { id: 'side', name: 'Under Contract', text: 'Take a side in the war.', tier: 1, progress: once((g) => g.completed.some((id) => id.startsWith('choice-'))) },
  { id: 'war-hadron', name: 'Company Man', text: 'Win the war for Hadron Mining.', tier: 2, progress: did('finale-hadron') },
  { id: 'war-lumen', name: 'Clean Hands', text: 'Win the war for Lumen Systems.', tier: 2, progress: did('finale-lumen') },
  { id: 'war-undertow', name: 'Flood Gate', text: 'Win the war for the Undertow.', tier: 2, progress: did('finale-undertow') },
  { id: 'free-agent', name: 'Free Agent', text: 'Win the war for each of the three clients.', tier: 3, progress: held(['war-hadron', 'war-lumen', 'war-undertow']) },
  { id: 'audit', name: 'Audited', text: 'See Meridian\'s audit through.', tier: 2, secret: true, progress: did('audit-3') },
  { id: 'verdict-enforce', name: 'Paid in Full', text: 'Enforce the policy.', tier: 3, secret: true, progress: did('verdict-enforce') },
  { id: 'verdict-default', name: 'Defaulted', text: 'Default on the policy.', tier: 3, secret: true, progress: did('verdict-default') },
  { id: 'both-verdicts', name: 'Both Columns', text: 'Enforce the policy, and default on it.', tier: 3, secret: true, progress: held(['verdict-enforce', 'verdict-default']) },
  { id: 'verdict-quorum', name: 'Any Other Business', text: 'Hold the meeting.', tier: 3, secret: true, progress: did('verdict-quorum') },
  { id: 'cycle', name: 'Renewal', text: 'Start the war again.', tier: 2, progress: count(1, (g) => g.cycle) },
  // The arena.
  { id: 'first-arena', name: 'On the Ladder', text: 'Win an arena fight.', tier: 1, progress: count(1, (g) => g.arenaRank) },
  { id: 'champion', name: 'Champion of Varn', text: 'Take first place in the arena.', tier: 3, progress: count(CHAMPION_RANK, (g) => g.arenaRank) },
  { id: 'mirror', name: 'Know Thyself', text: 'Win a mirror match against your own build.', tier: 2, progress: count(1, (g) => g.stats.mirrors) },
  { id: 'apex', name: 'Last One Standing', text: 'Beat everyone in the back room of the arena.', tier: 3, secret: true, progress: count(ARENA_RANKS, (g) => g.arenaRank) },
  { id: 'cup', name: 'Silverware', text: 'Win an arena cup.', tier: 2, progress: count(1, (g) => (g.cups ?? []).length) },
  { id: 'cups', name: 'Full Cabinet', text: 'Win all three arena cups.', tier: 3, progress: count(3, (g) => (g.cups ?? []).length) },
  // The masters: a crown is a master beaten in a machine of their own class.
  { id: 'crown-1', name: 'Uneasy Head', text: "Take a master's crown in the arena.", tier: 2, progress: count(1, crownsHeld) },
  { id: 'crown-all', name: 'Seven Crowns', text: 'Hold the crown of every class.', tier: 3, progress: count(ARCHETYPES.length, crownsHeld) },
  // The eighth seat: its keeper beaten, by the holder of every crown.
  { id: 'seat', name: 'True Metal', text: "Take the eighth seat at the masters' table.", tier: 3, progress: count(1, (g) => (seatHeld(g) ? 1 : 0)) },
  // The two works pilots of the coast yard: a duel won is one that has left a rank.
  { id: 'works', name: 'Works Order', text: "Beat both of the coast yard's works pilots.", tier: 3, progress: count(WORKS_DUELS.length, (g) => WORKS_DUELS.filter((id) => g.ranks[id] !== undefined).length) },
  { id: 'overdrive', name: 'Redline', text: 'Set off an Overdrive.', tier: 1, progress: count(1, (g) => g.overdrives ?? 0) },
  { id: 'overdrive-50', name: 'Past the Stop', text: 'Set off 50 Overdrives.', tier: 2, progress: count(50, (g) => g.overdrives ?? 0) },
  // The Gauntlet.
  { id: 'gauntlet-5', name: 'Past the Warden', text: 'Clear 5 floors of the Gauntlet in one run.', tier: 1, progress: count(5, (g) => g.gauntletBest ?? 0) },
  { id: 'gauntlet-10', name: 'Deep Water', text: 'Clear 10 floors of the Gauntlet in one run.', tier: 2, progress: count(10, (g) => g.gauntletBest ?? 0) },
  { id: 'gauntlet-20', name: 'No Floor', text: 'Clear 20 floors of the Gauntlet in one run.', tier: 3, progress: count(20, (g) => g.gauntletBest ?? 0) },
  { id: 'elite', name: 'Marked Down', text: 'Beat an elite in the Gauntlet.', tier: 1, progress: count(1, (g) => g.elites ?? 0) },
  { id: 'elite-10', name: 'Ten Marks', text: 'Beat 10 elites in the Gauntlet.', tier: 2, progress: count(10, (g) => g.elites ?? 0) },
  { id: 'relics-3', name: 'Reliquary', text: 'Hold three relics in one run of the Gauntlet.', tier: 2, progress: count(3, (g) => Math.max(g.relicsHeld ?? 0, g.gauntlet?.relics?.length ?? 0)) },
  // The pilot.
  { id: 'level-5', name: 'Licensed', text: 'Reach pilot level 5.', tier: 1, progress: count(5, (g) => levelFor(g.xp)) },
  { id: 'level-10', name: 'Veteran', text: 'Reach pilot level 10.', tier: 2, progress: count(10, (g) => levelFor(g.xp)) },
  { id: 'level-20', name: 'Ace', text: 'Reach pilot level 20.', tier: 3, progress: count(20, (g) => levelFor(g.xp)) },
  { id: 'drills', name: 'Qualified', text: 'Pass every training drill.', tier: 2, progress: count(DRILLS.length, (g) => DRILLS.filter((d) => g.drills.includes(d.id)).length) },
  // The hangar.
  { id: 'painted', name: 'Company Colours', text: 'Repaint your mech.', tier: 1, progress: once((g) => g.paint !== FACTORY_PAINT) },
  { id: 'mixed', name: 'Own Colours', text: 'Wear a paint of your own mixing.', tier: 1, progress: once((g) => isMix(g.paint)) },
  { id: 'loadout', name: 'Spare Suit', text: 'Save a build in the garage.', tier: 1, progress: once((g) => g.loadouts.some((build) => build !== null)) },
  { id: 'bench-1', name: 'Off the Jig', text: 'Have the bench work on a part.', tier: 1, progress: count(1, benchSteps) },
  { id: 'bench-5', name: 'Blueprinted', text: 'Take a part to the fifth step at the bench.', tier: 3, progress: count(TUNE_MAX, furthestStep) },
  { id: 'parts-40', name: 'Stockpile', text: 'Own 40 different parts.', tier: 2, progress: count(40, (g) => Object.keys(g.inventory).length) },
  { id: 'arsenal', name: 'Full Rack', text: 'Own a weapon of each of the five kinds the manual names.', tier: 2, progress: count(WEAPON_KINDS.length, kindsOwned) },
  // The kinds of machine: for trying another, for staying with one, and for knowing them all.
  { id: 'class-3', name: 'Second Opinion', text: 'Win contracts as 3 classes of machine.', tier: 1, progress: count(3, (g) => kindsWon(g)) },
  { id: 'class-25', name: 'Specialist', text: 'Win 25 contracts as one class of machine.', tier: 2, progress: count(25, mostWonAs) },
  { id: 'class-all', name: 'Full Hangar', text: `Win 5 contracts as each of the ${ARCHETYPES.length} classes.`, tier: 3, progress: count(ARCHETYPES.length, (g) => kindsWon(g, 5)) },
  // Stripes: what a class gives at three, eight and fifteen contracts won as it.
  { id: 'stripe-1', name: 'Earned It', text: 'Earn a stripe as any class.', tier: 1, progress: count(1, stripesHeld) },
  { id: 'stripe-all', name: 'Full Dress', text: 'Earn all three stripes of every class.', tier: 3, progress: count(ALL_STRIPES, stripesHeld) },
  // The jobs on the board that ask for something else: for trying each kind, and for living off them.
  { id: 'job-each', name: 'Odd Jobs', text: `Win a job of each of the ${JOB_KINDS.length} kinds on the board.`, tier: 1, progress: count(JOB_KINDS.length, kindsOfJob) },
  { id: 'job-25', name: 'On Retainer', text: 'Win 25 jobs.', tier: 2, progress: count(25, (g) => jobsWon(g)) },
  // Accounts: the pilots who come back for this one by name (see grudge.ts). For meeting one, for closing one, and for closing three.
  { id: 'account-1', name: 'Second Notice', text: 'Win a meeting with a pilot who came back for you.', tier: 1, progress: count(1, meetingsWon) },
  { id: 'account-closed', name: 'Closed Book', text: 'Close an account: beat the same pilot three times.', tier: 2, progress: count(1, accountsClosed) },
  { id: 'account-3', name: 'Repeat Customers', text: 'Close three accounts.', tier: 3, progress: count(3, accountsClosed) },
  { id: 'met-20', name: 'Field Guide', text: 'Meet 20 kinds of enemy.', tier: 2, progress: count(20, kindsMet) },
  { id: 'met-all', name: 'Know Your Enemy', text: 'Meet every kind of enemy there is.', tier: 3, progress: count(KINDS.length, kindsMet) },
  // What is found.
  { id: 'papers-12', name: 'Paper Trail', text: 'Find 12 papers.', tier: 2, progress: count(12, papersFound) },
  { id: 'papers-all', name: 'The Small Print', text: 'Find all 24 papers.', tier: 3, progress: count(24, papersFound) },
  { id: 'checks-9', name: 'Nine on the Board', text: 'Hold nine lamp checks.', tier: 3, progress: count(9, checksHeld) },
];

/** Every medal there is, in the order the pilot screen lists them. The last asks for all the others. */
export const MEDALS: Medal[] = [
  ...EARNED,
  { id: 'all', name: 'Fully Vested', text: 'Earn every other medal.', tier: 3, progress: held(EARNED.map((medal) => medal.id)) },
];
