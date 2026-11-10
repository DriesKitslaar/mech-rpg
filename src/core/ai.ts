import { activeUnit, applyAction, checkAction, boostCost, HEAT_LIMIT, type Action, type BattleState, type UnitState } from './battle';
import { weaponIn } from './build';
import { FRAME_SLOTS, type Catalog, type FrameSlot, type Weapon, type WeaponSlot } from './types';

type Usable = { slot: WeaponSlot; weapon: Weapon };

/** Weapons the active unit may fire at `targetId`'s core right now, in the given preference order. */
function usableWeapons(state: BattleState, catalog: Catalog, targetId: string, order: WeaponSlot[]): Usable[] {
  const unit = activeUnit(state);
  return order.flatMap((slot) => {
    const weapon = weaponIn(unit.build, slot, catalog);
    const ok = weapon && checkAction(state, { type: 'fire', weapon: slot, target: targetId, part: 'core' }, catalog) === null;
    return ok ? [{ slot, weapon }] : [];
  });
}

/** Shared shape of both policies: cool if a shot would overheat, else fire a safe weapon, else stop. */
function coolOrFire(
  state: BattleState, catalog: Catalog, usable: Usable[], targetId: string, part: FrameSlot,
): Action {
  const unit = activeUnit(state);
  const overheats = (u: Usable) => unit.heat + u.weapon.heat > HEAT_LIMIT;
  if (usable.some(overheats) && checkAction(state, { type: 'cool' }, catalog) === null) return { type: 'cool' };
  const safe = usable.find((u) => !overheats(u));
  return safe ? { type: 'fire', weapon: safe.slot, target: targetId, part } : { type: 'endTurn' };
}

function bruiserTarget(player: UnitState): FrameSlot {
  let best: FrameSlot = 'core';
  let bestRatio = Infinity;
  for (const slot of FRAME_SLOTS) { // core, legs, arms, head: earlier slots win ties
    const part = player.parts[slot];
    if (!part || part.ap <= 0) continue;
    const ratio = part.ap / part.maxAp;
    if (ratio < bestRatio) { bestRatio = ratio; best = slot; }
  }
  return best;
}

/** Picks the next action for the active enemy from its behaviour profile. */
export function chooseEnemyAction(state: BattleState, catalog: Catalog): Action {
  const unit = activeUnit(state);
  const player = state.units.find((u) => u.side === 'player')!;
  const usable = usableWeapons(state, catalog, player.id, ['shoulder', 'rightHand', 'leftHand']);

  const first = coolOrFire(state, catalog, usable, player.id, 'core');
  if (first.type !== 'fire') {
    return first;
  }
  if (unit.ai === 'skirmisher' && checkAction(state, { type: 'boost' }, catalog) === null) {
    const cheapest = Math.min(...usable.map((u) => u.weapon.energy));
    if (unit.energy - boostCost(unit, catalog) >= cheapest) return { type: 'boost' };
  }
  let part: FrameSlot = 'core';
  if (unit.ai === 'skirmisher' && (player.parts.head?.ap ?? 0) > 0) part = 'head';
  if (unit.ai === 'bruiser') part = bruiserTarget(player);
  return { ...first, part };
}

/** A plain, competent player used by simulations and tests. */
export function chooseAutoPlayerAction(state: BattleState, catalog: Catalog): Action {
  const enemies = state.units.filter((u) => u.side === 'enemy' && !u.destroyed);
  if (enemies.length === 0) return { type: 'endTurn' };
  const target = enemies.reduce((a, b) => (b.parts.core!.ap < a.parts.core!.ap ? b : a));
  const usable = usableWeapons(state, catalog, target.id, ['rightHand', 'leftHand', 'shoulder']);
  return coolOrFire(state, catalog, usable, target.id, 'core');
}

/** Plays the battle to its outcome: the policy acts for the player, the profiles for enemies. */
export function runBattle(
  state: BattleState, catalog: Catalog, playerPolicy: (s: BattleState, c: Catalog) => Action,
): BattleState {
  while (state.outcome === 'ongoing') {
    const choose = activeUnit(state).side === 'player' ? playerPolicy : chooseEnemyAction;
    state = applyAction(state, choose(state, catalog), catalog);
  }
  return state;
}
