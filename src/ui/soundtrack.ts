import { MIRROR_ID } from '../core/arena';
import type { Battle, Mission } from '../core/campaign';
import { isGauntlet } from '../core/gauntlet';
import type { EnemyDef } from '../core/types';
import type { TrackName } from '../platform/music';
import type { ScreenName } from './app';

/** True when one of the battle's enemies changes as it is worn down: a named pilot, a great machine. */
export function isBossBattle(battle: Battle | undefined, enemies: Record<string, EnemyDef>): boolean {
  return !!battle && battle.enemies.some((id) => Object.hasOwn(enemies, id) && (enemies[id].phases?.length ?? 0) > 0);
}

/** The licensed pilot who keeps turning up, in whatever machine: a battle against them is a duel, and has their song. */
const RIVALS = ['rival', 'rival-2', 'ashfall-unbound'];

/**
 * The song a briefing is read to: the client's own where the contract has a client, the plain one
 * otherwise. The other side's offer for a contract is read to the other side's song.
 */
export function briefingTrack(mission: Mission): TrackName {
  return mission.turned?.side ?? mission.faction ?? 'briefing';
}

/** The song a battle is fought to. */
export function battleTrack(mission: Mission, index: number, enemies: Record<string, EnemyDef>): TrackName {
  // The last word goes to the boss song: the rival at full strength is a boss like any other.
  if (isBossBattle(mission.battles[index], enemies)) return 'boss';
  if (mission.battles[index]?.enemies.some((id) => RIVALS.includes(id))) return 'rival';
  if (mission.arenaRank !== undefined || mission.id === MIRROR_ID || mission.id.startsWith('cup-')) return 'arena';
  // The Gauntlet's open floors have a song of their own; its wardens have the boss's, above.
  if (isGauntlet(mission)) return 'descent';
  // The war, the audit and the verdicts have a harder song than the first act and the odd jobs.
  return ['path', 'finale', 'audit', 'verdict'].includes(mission.phase) ? 'battle2' : 'battle';
}

/** The song that goes with a screen. A battle picks its own with `battleTrack`. */
export function trackFor(screen: ScreenName, settlement?: { won: boolean }): TrackName {
  switch (screen) {
    case 'title':
    case 'callsign':
    case 'starter': return 'title';
    case 'briefing':
    case 'scene': return 'briefing';
    case 'ending':
    case 'credits': return 'ending';
    case 'gauntlet': return 'gauntlet';
    case 'battle': return 'battle';
    case 'settlement': return settlement?.won === false ? 'defeat' : 'victory';
    default: return 'hub';
  }
}
