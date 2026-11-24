import { ARCHETYPES, CLASS_AI } from './archetype';
import { asRematch, rematchPurse } from './arena';
import type { Mission } from './campaign';
import type { Settlement } from './economy';
import type { GameState } from './game';
import { crownsHeld } from './masters';
import type { BossPhase, Build, EnemyDef } from './types';

/**
 * The eighth seat: the one place at the masters' table that is not a class's. It is kept by one
 * pilot, who takes a challenge from nobody but the holder of all seven crowns, and it passes to
 * whoever beats them, in whatever machine. A seat once taken is held for good.
 */

/** The id of the duel for the seat, and of its keeper on the field. It begins as an arena fight's does: what holds for those by their id holds for it. */
export const SEAT_ID = 'arena-seat';
/** What the duel pays the first time it is won; a rematch's share of it after. */
export const SEAT_PURSE = 15000;

/** Whether the pilot holds the eighth seat. Nothing but a plain yes in the kept game counts as one. */
export const seatHeld = (state: Pick<GameState, 'seat'>): boolean => state.seat === true;
/** The seat's keeper takes a challenge from the pilot who holds the crown of every class, and from nobody else. */
export const seatOpen = (state: Pick<GameState, 'crowns'>): boolean => crownsHeld(state) >= ARCHETYPES.length;
/** The purse of the duel: in full until the seat is the pilot's, a rematch's after. */
export const seatPurse = (state: Pick<GameState, 'seat' | 'rematches'>): number => (seatHeld(state) ? rematchPurse(state, SEAT_ID, SEAT_PURSE) : SEAT_PURSE);
export const isSeat = (mission: Pick<Mission, 'id'>): boolean => mission.id === SEAT_ID;

/** The one who keeps the seat, and the machine they keep it in. */
export interface Keeper {
  name: string;
  /** The machine as the duel begins. */
  build: Build;
  /** The paint it wears. */
  paint: string;
  /** Multiplies its armour and its damage. */
  scale: number;
  /** Armour beyond what the parts give, as a share of them (see `EnemyDef.plating`). */
  plating?: number;
  /** How it changes as it is hurt: each change is a boss's, with what it carries, how it is flown and what its pilot says. */
  phases: BossPhase[];
  /** A line about how they fight. */
  style: string;
  /** What they say before the duel. */
  taunt: string;
  /** What they say when the seat is taken from them. */
  concede: string;
}

/** The keeper as the battle fields them: their machine part for part, in their paint, flown as a marksman's until it changes. */
export function keeperEnemy(keeper: Keeper): EnemyDef {
  return {
    id: SEAT_ID, name: keeper.name, ai: CLASS_AI.marksman, sprite: 'enemy-rival', composed: true, build: keeper.build, paint: keeper.paint,
    phases: keeper.phases, ...(keeper.plating ? { plating: keeper.plating } : {}),
  };
}

/** The duel for the seat in the shape of a contract, so that it is briefed, fought and settled like one. */
export function seatMission(state: Pick<GameState, 'seat' | 'rematches'>, keeper: Keeper, text: { client: string; win: string }): Mission {
  return {
    id: SEAT_ID, phase: 'patrol', title: keeper.name, client: text.client,
    briefing: [keeper.style, `"${keeper.taunt}"`], debrief: text.win, reward: seatPurse(state),
    battles: [{ enemies: [SEAT_ID], background: 'bg-arena' }], scale: keeper.scale, ...asRematch(seatHeld(state)),
  };
}

/** Writes the duel won down: the seat is the pilot's. Nothing is written twice. */
export function recordSeatWin<T extends Pick<GameState, 'seat'>>(state: T): T {
  return seatHeld(state) ? state : { ...state, seat: true };
}

/** The bill of the duel as it is shown: one that was won by a pilot who did not hold the seat says that the seat changed hands. */
export function seatSettlement(settlement: Settlement, mission: Pick<Mission, 'id'>, state: Pick<GameState, 'seat'>): Settlement {
  return settlement.won && isSeat(mission) && !seatHeld(state) ? { ...settlement, seated: true } : settlement;
}
