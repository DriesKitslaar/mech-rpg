import type { BattleState } from './battle';

/** What a pilot has done, counted. Everything is a whole number that only goes up. */
export interface Stats {
  /** Contracts won, lost, and walked away from. */
  contracts: number;
  lost: number;
  retreats: number;
  /** Contracts won without a scratch. */
  flawless: number;
  shots: number;
  hits: number;
  /** Armour shot off enemies, and armour lost. */
  damage: number;
  taken: number;
  /** Enemies destroyed, and parts of theirs other than the core. */
  kills: number;
  parts: number;
  /** Enemies knocked off balance. */
  staggers: number;
  /** Turns lost to heat. */
  overheats: number;
  /** Walking bombs destroyed before they went off. */
  bombs: number;
  /** Battles won against a boss. */
  bosses: number;
  rounds: number;
  /** Credits paid out by contracts. */
  earned: number;
  /** Mirror matches won in the arena. */
  mirrors: number;
  /** Time played, in seconds. */
  seconds: number;
}

export const NO_STATS: Stats = {
  contracts: 0, lost: 0, retreats: 0, flawless: 0, shots: 0, hits: 0, damage: 0, taken: 0, kills: 0, parts: 0, staggers: 0,
  overheats: 0, bombs: 0, bosses: 0, rounds: 0, earned: 0, mirrors: 0, seconds: 0,
};
export const STAT_KEYS = Object.keys(NO_STATS) as (keyof Stats)[];

export function addStats(a: Stats, b: Partial<Stats>): Stats {
  const sum = { ...a };
  for (const key of STAT_KEYS) sum[key] += b[key] ?? 0;
  return sum;
}

/** What one finished (or abandoned) battle adds to the record, read off its events. */
export function tallyBattle(state: BattleState): Stats {
  const tally = { ...NO_STATS, rounds: state.round };
  const isEnemy = (id: string): boolean => id !== 'player';
  // A bomb that went off destroyed itself: that is neither a kill nor a bomb defused.
  const wentOff = new Set(state.events.flatMap((e) => (e.type === 'blast' ? [e.unit] : [])));
  for (const event of state.events) {
    switch (event.type) {
      case 'shot':
        if (!isEnemy(event.unit)) {
          tally.shots += 1;
          if (event.hit) { tally.hits += 1; tally.damage += event.damage; }
        } else if (event.hit && !isEnemy(event.target)) tally.taken += event.damage;
        break;
      case 'blast':
        if (!isEnemy(event.target)) tally.taken += event.damage;
        break;
      case 'module':
        // A shock pulse is not a shot, but the armour it takes off counts all the same: against the pilot when
        // it is the enemy's, for the pilot when it is their own.
        if (event.effect === 'shock' && event.damage) {
          if (isEnemy(event.unit)) tally.taken += event.damage;
          else tally.damage += event.damage;
        }
        break;
      case 'partDestroyed':
        if (isEnemy(event.unit) && event.part !== 'core') tally.parts += 1;
        break;
      case 'unitDestroyed':
        if (!isEnemy(event.unit) || wentOff.has(event.unit)) break;
        tally.kills += 1;
        if (state.units.find((u) => u.id === event.unit)?.abilities.bomb) tally.bombs += 1;
        break;
      case 'stagger':
        if (isEnemy(event.unit)) tally.staggers += 1;
        break;
      case 'overheat':
        if (!isEnemy(event.unit)) tally.overheats += 1;
        break;
      default:
        break;
    }
  }
  if (state.outcome === 'victory' && state.units.some((u) => u.side === 'enemy' && u.phases.length > 0)) tally.bosses = 1;
  return tally;
}

/** True when the pilot walked away from this battle. */
export const retreated = (state: BattleState): boolean => state.retreated === true;

/**
 * What a finished contract adds to the record: everything its battles added up to, and how it
 * ended. Flawless means won without being hit once, whatever was repaired along the way.
 */
export function contractStats(battles: Stats, end: { won: boolean; retreated: boolean; pay: number }): Stats {
  return addStats(battles, {
    contracts: end.won ? 1 : 0,
    lost: !end.won && !end.retreated ? 1 : 0,
    retreats: !end.won && end.retreated ? 1 : 0,
    flawless: end.won && battles.taken === 0 ? 1 : 0,
    earned: end.won ? end.pay : 0,
  });
}
