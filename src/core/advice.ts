import { ROUND_LIMIT, objectiveTarget, type BattleState } from './battle';

/**
 * What there is to say to a pilot who has just lost a battle, by what went wrong in it. The words
 * are in the strings; this only picks.
 */
export const ADVICE = ['disable', 'protect', 'heat', 'stance', 'repairs', 'time', 'patrol', 'drills', 'auto'] as const;
export type Advice = (typeof ADVICE)[number];

/** The three things that are always worth saying, for a defeat with nothing more particular about it. */
const GENERAL: Advice[] = ['patrol', 'drills', 'auto'];

/**
 * The one thing to tell the pilot after this battle, or null when there is nothing to tell: it was
 * not lost, or they walked away from it themselves. What the contract itself asked for comes first,
 * then what the pilot did not do, most costly first.
 */
export function adviceAfter(state: BattleState): Advice | null {
  if (state.outcome !== 'defeat' || state.retreated) return null;
  const player = state.units.find((unit) => unit.side === 'player');
  const mine = state.events.filter((event) => 'unit' in event && event.unit === player?.id);

  if (state.objective.type === 'disable' && objectiveTarget(state)?.destroyed) return 'disable';
  if (state.objective.type === 'protect' && state.asset && state.asset.hp <= 0) return 'protect';
  if (mine.some((event) => event.type === 'overheat')) return 'heat';
  if (!mine.some((event) => event.type === 'boost' || event.type === 'guard')) return 'stance';
  if (player && player.repairsLeft > 0) return 'repairs';
  if (state.round >= ROUND_LIMIT) return 'time';
  return GENERAL[state.round % GENERAL.length];
}
