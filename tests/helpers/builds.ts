import { BUILD_SLOTS, buy, equip, type GameState } from '../../src/core/game';
import type { Build } from '../../src/core/types';
import { CATALOG } from '../../src/content/parts';

/** The game with a build bought and fitted, whatever it costs: the pilot's money is as it was. */
export function wearing(base: GameState, build: Build): GameState {
  let game: GameState = { ...base, credits: 9_999_999 };
  const parts = Object.values(build).filter((id): id is string => id !== undefined);
  for (const id of new Set(parts)) while ((game.inventory[id] ?? 0) < parts.filter((other) => other === id).length) game = buy(game, id, CATALOG);
  // Twice over: a part may only fit once another has been changed.
  for (let pass = 0; pass < 2; pass++) {
    for (const slot of BUILD_SLOTS) {
      const id = build[slot];
      try {
        if (id === undefined && game.build[slot] !== undefined) game = equip(game, slot, null, CATALOG);
        else if (id !== undefined && game.build[slot] !== id) game = equip(game, slot, id, CATALOG);
      } catch { /* the next pass */ }
    }
  }
  expect(game.build).toEqual(build);
  return { ...game, credits: base.credits };
}
