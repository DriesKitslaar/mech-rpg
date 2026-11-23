import { ROUND_LIMIT, objectiveTarget, type BattleState } from './battle';

/**
 * What there is to say to a pilot who has just lost a battle, by what went wrong in it. The words
 * are in the strings; this only picks.
 */
export const ADVICE = ['disable', 'protect', 'heat', 'stance', 'outmatched', 'repairs', 'time', 'patrol', 'drills', 'auto'] as const;
export type Advice = (typeof ADVICE)[number];

/** The three things that are always worth saying, for a defeat with nothing more particular about it. */
const GENERAL: Advice[] = ['patrol', 'drills', 'auto'];

/** The share of its armour the other side has to have left for a defeat to be put down to the machine and not to how it was flown. */
export const OUTMATCHED_SHARE = 2 / 3;

/**
 * What is left of the armour the other side came onto the field with, as a share of it: 1 with none of
 * them touched, 0 with nothing standing. A machine that is down has none left, whatever its limbs still
 * carry: it went through the core, or it lost its nerve and left. Machines still to come are not counted.
 */
export function armourLeft(state: BattleState): number {
  const enemies = state.units.filter((unit) => unit.side === 'enemy');
  const whole = enemies.flatMap((unit) => Object.values(unit.parts)).reduce((sum, part) => sum + part.maxAp, 0);
  const left = enemies.filter((unit) => !unit.destroyed).flatMap((unit) => Object.values(unit.parts)).reduce((sum, part) => sum + Math.max(0, part.ap), 0);
  return whole > 0 ? left / whole : 0;
}

/**
 * The one thing to tell the pilot after this battle, or null when there is nothing to tell: it was
 * not lost, or they walked away from it themselves. What the contract itself asked for comes first,
 * then what the pilot did not do, most costly first. A pilot who flew it soundly (no turn lost to
 * heat, a Boost or a Guard used) and went down with the other side barely marked is told that the
 * machine was not up to it: nothing about the flying would have changed that.
 */
export function adviceAfter(state: BattleState): Advice | null {
  if (state.outcome !== 'defeat' || state.retreated) return null;
  const player = state.units.find((unit) => unit.side === 'player');
  const mine = state.events.filter((event) => 'unit' in event && event.unit === player?.id);

  if (state.objective.type === 'disable' && objectiveTarget(state)?.destroyed) return 'disable';
  if (state.objective.type === 'protect' && state.asset && state.asset.hp <= 0) return 'protect';
  if (mine.some((event) => event.type === 'overheat')) return 'heat';
  if (!mine.some((event) => event.type === 'boost' || event.type === 'guard')) return 'stance';
  if (armourLeft(state) >= OUTMATCHED_SHARE) return 'outmatched';
  if (player && player.repairsLeft > 0) return 'repairs';
  if (state.round >= ROUND_LIMIT) return 'time';
  return GENERAL[state.round % GENERAL.length];
}
