import { MIRROR_ID } from '../core/arena';
import type { Battle, Mission } from '../core/campaign';
import type { EnemyDef } from '../core/types';
import type { TrackName } from '../platform/music';
import type { ScreenName } from './app';

/** True when one of the battle's enemies changes as it is worn down: a named pilot, a great machine. */
export function isBossBattle(battle: Battle | undefined, enemies: Record<string, EnemyDef>): boolean {
  return !!battle && battle.enemies.some((id) => Object.hasOwn(enemies, id) && (enemies[id].phases?.length ?? 0) > 0);
}

/** The song a battle is fought to. */
export function battleTrack(mission: Mission, index: number, enemies: Record<string, EnemyDef>): TrackName {
  if (isBossBattle(mission.battles[index], enemies)) return 'boss';
  if (mission.arenaRank !== undefined || mission.id === MIRROR_ID) return 'arena';
  // The war, the audit and the verdicts have a harder song than the first act and the odd jobs.
  return ['path', 'finale', 'audit', 'verdict'].includes(mission.phase) ? 'battle2' : 'battle';
}

/** The song that goes with a screen. A battle picks its own with `battleTrack`. */
export function trackFor(screen: ScreenName, settlement?: { won: boolean }): TrackName {
  switch (screen) {
    case 'title':
    case 'callsign': return 'title';
    case 'briefing':
    case 'scene': return 'briefing';
    case 'ending':
    case 'credits': return 'ending';
    case 'battle': return 'battle';
    case 'settlement': return settlement?.won === false ? 'defeat' : 'victory';
    default: return 'hub';
  }
}
