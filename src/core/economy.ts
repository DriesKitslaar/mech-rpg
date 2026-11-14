import type { BattleState } from './battle';
import { framePart, weaponIn } from './build';
import type { GameState } from './game';
import { FRAME_SLOTS, WEAPON_SLOTS, type Catalog } from './types';

/** Rebuilding a destroyed part costs this share of its price; damage is charged in proportion. */
export const REPAIR_RATE = 0.5;

export interface Settlement {
  won: boolean;
  /** Zero after a defeat. */
  reward: number;
  ammoCost: number;
  repairCost: number;
  net: number;
  /** One entry per damaged part, in slot order. */
  lines: { partId: string; lost: number; cost: number }[];
}

/** What a finished battle earns and costs the player. */
export function settle(battle: BattleState, reward: number, catalog: Catalog): Settlement {
  if (battle.outcome === 'ongoing') throw new Error('battle is not over');
  const player = battle.units[0];
  const won = battle.outcome === 'victory';

  let ammoCost = 0;
  for (const slot of WEAPON_SLOTS) {
    const weapon = weaponIn(player.build, slot, catalog);
    const left = player.ammo[slot];
    if (weapon && weapon.ammo !== null && typeof left === 'number') ammoCost += (weapon.ammo - left) * weapon.costPerShot;
  }

  const lines: Settlement['lines'] = [];
  for (const slot of FRAME_SLOTS) {
    const state = player.parts[slot];
    const part = framePart(player.build, slot, catalog);
    if (!state || !part || state.ap >= state.maxAp) continue;
    const lost = state.maxAp - state.ap;
    lines.push({ partId: part.id, lost, cost: Math.round((lost / state.maxAp) * part.price * REPAIR_RATE) });
  }
  const repairCost = lines.reduce((sum, line) => sum + line.cost, 0);
  const paid = won ? reward : 0;
  return { won, reward: paid, ammoCost, repairCost, net: paid - ammoCost - repairCost, lines };
}

/** Credits may end below zero: debt blocks buying, never playing. */
export function applySettlement(state: GameState, settlement: Settlement): GameState {
  return {
    ...state,
    credits: state.credits + settlement.net,
    battlesWon: state.battlesWon + (settlement.won ? 1 : 0),
  };
}
