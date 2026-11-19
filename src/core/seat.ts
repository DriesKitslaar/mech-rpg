import type { GameState } from './game';

/**
 * The eighth seat: the one place at the masters' table that is not a class's. It is kept by one
 * pilot, who takes a challenge from nobody but the holder of all seven crowns, and it passes to
 * whoever beats them. A seat once taken is held for good.
 */

/** Whether the pilot holds the eighth seat. Nothing but a plain yes in the kept game counts as one. */
export const seatHeld = (state: Pick<GameState, 'seat'>): boolean => state.seat === true;
