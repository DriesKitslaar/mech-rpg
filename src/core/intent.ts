import type { BattleState, UnitState } from './battle';
import { FRAME_SLOTS, type FrameSlot } from './types';

/**
 * What an enemy is about to do, as far as a pilot could read it from how the machine moves: which
 * part it is lining up on, or that it is about to dart aside, mend or go off. It follows the same
 * rules the enemy itself follows, so what is read here is what happens, unless the field changes
 * first.
 */
export type Intent =
  | { kind: 'aim'; part: FrameSlot }
  | { kind: 'dart' }
  | { kind: 'mend' }
  | { kind: 'charge' }
  | { kind: 'fuse'; turns: number }
  | { kind: 'reeling' };

/** The round in which the unit takes its next turn: this one if its turn is still to come. */
export function nextTurnRound(state: BattleState, unit: UnitState): number {
  const at = state.order.indexOf(unit.id);
  return at >= 0 && at >= state.turn ? state.round : state.round + 1;
}

const weakest = (player: UnitState): FrameSlot => {
  let best: FrameSlot = 'core';
  let ratio = Infinity;
  for (const slot of FRAME_SLOTS) {
    const part = player.parts[slot];
    if (!part || part.ap <= 0) continue;
    if (part.ap / part.maxAp < ratio) { ratio = part.ap / part.maxAp; best = slot; }
  }
  return best;
};

/** What the enemy will most likely do with its next turn; nothing for the pilot's own machine or a wreck. */
export function intentOf(state: BattleState, unit: UnitState): Intent | null {
  if (unit.side !== 'enemy' || unit.destroyed) return null;
  const player = state.units.find((u) => u.side === 'player');
  if (!player) return null;
  if (unit.fuse !== undefined) return { kind: 'fuse', turns: unit.fuse };
  if (unit.staggered > 0) return { kind: 'reeling' };
  if (unit.charged.length > 0) return { kind: 'charge' };
  if (unit.abilities.mend !== undefined) {
    const hurt = state.units.some((u) => u.side === 'enemy' && !u.destroyed && u.id !== unit.id
      && Object.values(u.parts).some((p) => p && p.ap > 0 && p.ap < p.maxAp));
    if (hurt) return { kind: 'mend' };
  }
  const round = nextTurnRound(state, unit);
  switch (unit.ai) {
    case 'skirmisher':
      if (round % 3 === 0) return { kind: 'dart' };
      return { kind: 'aim', part: (player.parts.head?.ap ?? 0) > 0 ? 'head' : 'core' };
    case 'bruiser': return { kind: 'aim', part: weakest(player) };
    case 'sprayer': {
      const alive = FRAME_SLOTS.filter((slot) => (player.parts[slot]?.ap ?? 0) > 0);
      return { kind: 'aim', part: alive.length > 0 ? alive[(round + state.units.indexOf(unit)) % alive.length] : 'core' };
    }
    default: return { kind: 'aim', part: 'core' };
  }
}
