import type { BattleState } from './battle';
import { framePart, weaponIn } from './build';
import type { GameState, Rank } from './game';
import { FRAME_SLOTS, WEAPON_SLOTS, type Catalog } from './types';

/**
 * Credits per point of armour repaired, whatever the part cost: heavy armour takes more hits
 * for the same bill, so buying a sturdier frame is never a step back.
 */
export const REPAIR_COST_PER_AP = 0.8;

export interface Settlement {
  won: boolean;
  /** Zero after a defeat. */
  reward: number;
  ammoCost: number;
  repairCost: number;
  net: number;
  /** One entry per damaged part, in slot order. */
  lines: { partId: string; lost: number; cost: number }[];
  /** What Dispatch wrote off of the bill because of the debt limit; set when the settlement is booked. */
  relief?: number;
  /** How well a won contract was done, the score behind it and what it adds to the fee; see rank.ts. */
  rank?: Rank;
  score?: number;
  bonus?: number;
}

/** Pilot perks that change the bill: a fraction more pay, a fraction off ammunition and repairs. */
export interface Terms { payBonus: number; costDiscount: number }

/** What a finished battle earns and costs the player. */
export function settle(battle: BattleState, reward: number, catalog: Catalog, terms: Terms = { payBonus: 0, costDiscount: 0 }): Settlement {
  if (battle.outcome === 'ongoing') throw new Error('battle is not over');
  const player = battle.units[0];
  const won = battle.outcome === 'victory';

  let ammoCost = 0;
  for (const slot of WEAPON_SLOTS) {
    const weapon = weaponIn(player.build, slot, catalog);
    const left = player.ammo[slot];
    // Rounds fired: what is missing from the magazine, plus what the crew put back in between battles.
    if (weapon && weapon.ammo !== null && typeof left === 'number') {
      ammoCost += (weapon.ammo - left + (player.restocked[slot] ?? 0)) * weapon.costPerShot;
    }
  }
  const discounted = (cost: number): number => Math.round(cost * (1 - terms.costDiscount));
  ammoCost = discounted(ammoCost);

  const lines: Settlement['lines'] = [];
  for (const slot of FRAME_SLOTS) {
    const state = player.parts[slot];
    const part = framePart(player.build, slot, catalog);
    if (!state || !part || state.ap >= state.maxAp) continue;
    const lost = state.maxAp - state.ap;
    lines.push({ partId: part.id, lost, cost: discounted(lost * REPAIR_COST_PER_AP) });
  }
  const repairCost = lines.reduce((sum, line) => sum + line.cost, 0);
  const paid = won ? Math.round(reward * (1 + terms.payBonus)) : 0;
  return { won, reward: paid, ammoCost, repairCost, net: paid - ammoCost - repairCost, lines };
}

/**
 * How far into debt a pilot can go. Without a limit a run of lost contracts feeds itself: every
 * loss is a repair bill, a pilot in debt cannot buy better parts, and worse parts lose again.
 */
export const DEBT_LIMIT = -2000;

/**
 * The part of a bill that is written off because paying it would take the pilot past the debt
 * limit. A pilot who is past it already (from before there was a limit) is charged nothing more.
 * Pay is never touched.
 */
export function debtRelief(state: GameState, settlement: Settlement): number {
  if (settlement.net >= 0) return 0;
  const floor = Math.min(state.credits, DEBT_LIMIT);
  return Math.max(0, floor - (state.credits + settlement.net));
}

/** Credits may end below zero, down to the debt limit: debt blocks buying, never playing. */
export function applySettlement(state: GameState, settlement: Settlement): GameState {
  return {
    ...state,
    credits: state.credits + settlement.net + debtRelief(state, settlement),
    battlesWon: state.battlesWon + (settlement.won ? 1 : 0),
  };
}
