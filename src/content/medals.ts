import { ARENA_RANKS } from '../core/arena';
import { FACTORY_PAINT, type GameState } from '../core/game';
import type { Medal } from '../core/medals';
import { levelFor } from '../core/pilot';
import { ENEMIES } from './enemies';

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
  { id: 'first-s', name: 'Signature Work', text: 'Earn an S rank on a contract.', tier: 1, progress: count(1, sRanks) },
  { id: 's-10', name: 'Gold Standard', text: 'Hold an S rank on 10 contracts.', tier: 2, progress: count(10, sRanks) },
  { id: 's-25', name: 'Perfect Ledger', text: 'Hold an S rank on 25 contracts.', tier: 3, progress: count(25, sRanks) },
  // The story.
  { id: 'side', name: 'Under Contract', text: 'Take a side in the war.', tier: 1, progress: once((g) => g.completed.some((id) => id.startsWith('choice-'))) },
  { id: 'war-hadron', name: 'Company Man', text: 'Win the war for Hadron Mining.', tier: 2, progress: did('finale-hadron') },
  { id: 'war-lumen', name: 'Clean Hands', text: 'Win the war for Lumen Systems.', tier: 2, progress: did('finale-lumen') },
  { id: 'war-undertow', name: 'Flood Gate', text: 'Win the war for the Undertow.', tier: 2, progress: did('finale-undertow') },
  { id: 'free-agent', name: 'Free Agent', text: 'Win the war for each of the three clients.', tier: 3, progress: held(['war-hadron', 'war-lumen', 'war-undertow']) },
  { id: 'audit', name: 'Audited', text: 'See Meridian\'s audit through.', tier: 2, secret: true, progress: did('audit-3') },
  { id: 'verdict-enforce', name: 'Paid in Full', text: 'Enforce the policy.', tier: 3, secret: true, progress: did('verdict-enforce') },
  { id: 'verdict-default', name: 'Defaulted', text: 'Default on the policy.', tier: 3, secret: true, progress: did('verdict-default') },
  { id: 'both-verdicts', name: 'Both Columns', text: 'Give both verdicts.', tier: 3, secret: true, progress: held(['verdict-enforce', 'verdict-default']) },
  { id: 'cycle', name: 'Renewal', text: 'Start the war again.', tier: 2, progress: count(1, (g) => g.cycle) },
  // The arena.
  { id: 'first-arena', name: 'On the Ladder', text: 'Win an arena fight.', tier: 1, progress: count(1, (g) => g.arenaRank) },
  { id: 'champion', name: 'Champion of Varn', text: 'Take first place in the arena.', tier: 3, progress: count(ARENA_RANKS, (g) => g.arenaRank) },
  // The pilot.
  { id: 'level-5', name: 'Licensed', text: 'Reach pilot level 5.', tier: 1, progress: count(5, (g) => levelFor(g.xp)) },
  { id: 'level-10', name: 'Veteran', text: 'Reach pilot level 10.', tier: 2, progress: count(10, (g) => levelFor(g.xp)) },
  { id: 'level-20', name: 'Ace', text: 'Reach pilot level 20.', tier: 3, progress: count(20, (g) => levelFor(g.xp)) },
  // The hangar.
  { id: 'painted', name: 'Company Colours', text: 'Repaint your mech.', tier: 1, progress: once((g) => g.paint !== FACTORY_PAINT) },
  { id: 'loadout', name: 'Spare Suit', text: 'Save a build in the garage.', tier: 1, progress: once((g) => g.loadouts.some((build) => build !== null)) },
  { id: 'parts-40', name: 'Stockpile', text: 'Own 40 different parts.', tier: 2, progress: count(40, (g) => Object.keys(g.inventory).length) },
  { id: 'met-20', name: 'Field Guide', text: 'Meet 20 kinds of enemy.', tier: 2, progress: count(20, kindsMet) },
  { id: 'met-all', name: 'Know Your Enemy', text: 'Meet every kind of enemy there is.', tier: 3, progress: count(KINDS.length, kindsMet) },
];

/** Every medal there is, in the order the pilot screen lists them. The last asks for all the others. */
export const MEDALS: Medal[] = [
  ...EARNED,
  { id: 'all', name: 'Fully Vested', text: 'Earn every other medal.', tier: 3, progress: held(EARNED.map((medal) => medal.id)) },
];
