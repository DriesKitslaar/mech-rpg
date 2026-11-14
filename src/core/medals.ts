import type { GameState } from './game';

/** How much a medal is worth: bronze, silver, gold. */
export type Tier = 1 | 2 | 3;

export interface Medal {
  id: string;
  name: string;
  /** What it takes, in one line. */
  text: string;
  tier: Tier;
  /** Keeps its name and text to itself until it is earned: it would give the story away. */
  secret?: boolean;
  /** How far along a pilot is: what they have of what it takes. Earned once `have` reaches `need`. */
  progress(game: GameState): { have: number; need: number };
}

/** Credits paid when a medal is earned, by tier. */
export const MEDAL_PAY: Record<Tier, number> = { 1: 100, 2: 400, 3: 1200 };

/** Where a pilot stands on a medal. One already held reads as complete, whatever has changed since. */
export function medalProgress(medal: Medal, game: GameState): { have: number; need: number; earned: boolean } {
  const earned = game.medals.includes(medal.id);
  const { have, need } = medal.progress(game);
  return { have: earned ? need : Math.max(0, Math.min(have, need)), need, earned };
}

/**
 * Awards every medal the pilot now has what it takes for. Each is added to the list and paid for
 * once. Some medals ask for other medals, and what one pays can earn the next, so the list is
 * gone round until a pass awards nothing. The state is returned unchanged when nothing is earned.
 */
export function awardMedals(game: GameState, medals: Medal[]): { game: GameState; earned: Medal[] } {
  const earned: Medal[] = [];
  let next = game;
  for (let changed = true; changed;) {
    changed = false;
    for (const medal of medals) {
      if (next.medals.includes(medal.id)) continue;
      const { have, need } = medal.progress(next);
      if (have < need) continue;
      next = { ...next, medals: [...next.medals, medal.id], credits: next.credits + MEDAL_PAY[medal.tier] };
      earned.push(medal);
      changed = true;
    }
  }
  return { game: next, earned };
}
