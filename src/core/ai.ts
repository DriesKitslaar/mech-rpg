import {
  activeUnit, applyAction, boostCost, checkAction, guardFactor, mendablePart, objectiveTarget, previewShot, HEAT_LIMIT, LIMITER_HEAT,
  OVERCLOCK_HEAT,
  type Action, type BattleState, type UnitState,
} from './battle';
import { boostProfile, impactOf, moduleOf, weaponIn } from './build';
import { FRAME_SLOTS, WEAPON_SLOTS, type Catalog, type FrameSlot, type Weapon, type WeaponSlot } from './types';

type Usable = { slot: WeaponSlot; weapon: Weapon };

const can = (state: BattleState, action: Action, catalog: Catalog): boolean => checkAction(state, action, catalog) === null;

/** Weapons the active unit may fire at `targetId`'s core right now, in the given preference order. */
function usableWeapons(state: BattleState, catalog: Catalog, targetId: string, order: WeaponSlot[]): Usable[] {
  const unit = activeUnit(state);
  return order.flatMap((slot) => {
    const weapon = weaponIn(unit.build, slot, catalog);
    return weapon && can(state, { type: 'fire', weapon: slot, target: targetId, part: 'core' }, catalog) ? [{ slot, weapon }] : [];
  });
}

/** Puts blades first. A unit that boosted to close in kept energy back for the strike; a gun must not take it. */
function bladesFirst(usable: Usable[]): Usable[] {
  return [...usable.filter((u) => u.weapon.melee), ...usable.filter((u) => !u.weapon.melee)];
}

/** Shared shape of both policies: cool if a shot would overheat, else fire a safe weapon, else stop. */
function coolOrFire(
  state: BattleState, catalog: Catalog, usable: Usable[], targetId: string, part: FrameSlot,
): Action {
  const unit = activeUnit(state);
  const overheats = (u: Usable) => unit.heat + u.weapon.heat > HEAT_LIMIT;
  if (usable.some(overheats) && can(state, { type: 'cool' }, catalog)) return { type: 'cool' };
  const safe = usable.find((u) => !overheats(u));
  return safe ? { type: 'fire', weapon: safe.slot, target: targetId, part } : { type: 'endTurn' };
}

/** A charge weapon that could be charged now, if there is one. */
function chargeable(state: BattleState, catalog: Catalog): Action | null {
  for (const slot of WEAPON_SLOTS) {
    const action: Action = { type: 'charge', weapon: slot };
    if (can(state, action, catalog)) return action;
  }
  return null;
}

/** True when the unit holds a blade it has not swung this turn, and has the energy to boost in and swing it. */
function shouldCloseIn(state: BattleState, catalog: Catalog): boolean {
  const unit = activeUnit(state);
  if (unit.usedBoost || !can(state, { type: 'boost' }, catalog)) return false;
  const afterBoost = unit.energy - boostCost(unit, catalog);
  return WEAPON_SLOTS.some((slot) => {
    const weapon = weaponIn(unit.build, slot, catalog);
    return !!weapon?.melee && !unit.fired.includes(slot) && unit.ammo[slot] !== 0 && afterBoost >= weapon.energy
      && !(slot !== 'shoulder' && unit.parts.arms && unit.parts.arms.ap <= 0);
  });
}

const armourShare = (unit: UnitState): number => {
  const parts = Object.values(unit.parts);
  return parts.reduce((sum, p) => sum + p!.ap, 0) / parts.reduce((sum, p) => sum + p!.maxAp, 0);
};

/**
 * Whether now is the moment for the active unit's module, by simple thresholds shared by enemies
 * and the automatic player. `foe` is who a painter would mark.
 */
function moduleAction(state: BattleState, catalog: Catalog, foe: UnitState): Action | null {
  const unit = activeUnit(state);
  const module = moduleOf(unit.build, catalog);
  if (!module) return null;
  const core = unit.parts.core!;
  let wanted: boolean;
  switch (module.effect) {
    case 'coolant': wanted = unit.heat >= 50; break;
    case 'barrier': wanted = core.ap < core.maxAp * 0.5; break;
    case 'chaff': wanted = core.ap < core.maxAp * 0.7; break;
    case 'nanites': wanted = armourShare(unit) < 0.6; break;
    case 'painter': wanted = foe.painted === 0; break;
    case 'limiter': wanted = unit.heat + LIMITER_HEAT <= 60 && unit.fired.length === 0; break;
    // Both heat the unit: neither is worth a lost turn.
    case 'overclock': wanted = unit.heat + OVERCLOCK_HEAT <= 70 && unit.fired.length === 0; break;
    // A pulse hits every core on the field, the one the client wants in one piece included.
    case 'shock': wanted = unit.side !== 'player' || state.objective.type !== 'disable'; break;
  }
  const action: Action = module.effect === 'painter' ? { type: 'module', target: foe.id } : { type: 'module' };
  return wanted && can(state, action, catalog) ? action : null;
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

/** Works around the surviving parts, a different one each round, so damage spreads over the whole mech. */
function sprayerTarget(player: UnitState, round: number, offset: number): FrameSlot {
  const alive = FRAME_SLOTS.filter((slot) => (player.parts[slot]?.ap ?? 0) > 0);
  return alive.length > 0 ? alive[(round + offset) % alive.length] : 'core';
}

/** The ally a mender should see to: the one whose worst living part has lost the most. */
function mendAction(state: BattleState, catalog: Catalog): Action | null {
  const unit = activeUnit(state);
  let best: UnitState | null = null;
  let bestRatio = 1;
  for (const ally of state.units) {
    if (ally.side !== unit.side || ally.destroyed || ally.id === unit.id) continue;
    const slot = mendablePart(ally);
    if (!slot) continue;
    const ratio = ally.parts[slot]!.ap / ally.parts[slot]!.maxAp;
    if (ratio < bestRatio) { bestRatio = ratio; best = ally; }
  }
  const action: Action | null = best ? { type: 'mend', target: best.id } : null;
  return action && can(state, action, catalog) ? action : null;
}

/** Picks the next action for the active enemy from its behaviour profile. */
export function chooseEnemyAction(state: BattleState, catalog: Catalog): Action {
  const unit = activeUnit(state);
  const player = state.units.find((u) => u.side === 'player')!;

  // A mender patches before anything else: mending is its whole turn.
  if (unit.abilities.mend !== undefined) {
    const mend = mendAction(state, catalog);
    if (mend) return mend;
  }
  const module = moduleAction(state, catalog, player);
  if (module) return module;
  // A charge weapon is charged before anything else is fired, so its energy is never spent elsewhere.
  const charge = chargeable(state, catalog);
  if (charge) return charge;
  if (shouldCloseIn(state, catalog)) return { type: 'boost' };

  const usable = bladesFirst(usableWeapons(state, catalog, player.id, ['shoulder', 'rightHand', 'leftHand']));
  const first = coolOrFire(state, catalog, usable, player.id, 'core');
  if (first.type === 'cool') return first;
  if (first.type === 'fire') {
    // A skirmisher darts in and out: it boosts every third round, which leaves openings to shoot its legs.
    if (unit.ai === 'skirmisher' && state.round % 3 === 0 && can(state, { type: 'boost' }, catalog)) {
      const cheapest = Math.min(...usable.map((u) => u.weapon.energy));
      if (unit.energy - boostCost(unit, catalog) >= cheapest) return { type: 'boost' };
    }
    let part: FrameSlot = 'core';
    if (unit.ai === 'skirmisher' && (player.parts.head?.ap ?? 0) > 0) part = 'head';
    if (unit.ai === 'bruiser') part = bruiserTarget(player);
    if (unit.ai === 'sprayer') part = sprayerTarget(player, state.round, state.units.indexOf(unit));
    return { ...first, part };
  }
  // Nothing left to fire: brace if the balance is going.
  if ((unit.stagger >= unit.staggerMax / 2 || unit.staggered > 0) && can(state, { type: 'guard' }, catalog)) return { type: 'guard' };
  return { type: 'endTurn' };
}

/** The chance the enemies have, on average, of hitting the unit's core with their first weapon. */
function averageThreat(state: BattleState, me: UnitState, enemies: UnitState[], catalog: Catalog): number {
  const chances = enemies.flatMap((enemy) => {
    const slot = WEAPON_SLOTS.find((s) => weaponIn(enemy.build, s, catalog));
    return slot ? [previewShot(state, enemy.id, slot, me.id, 'core', catalog).hitChance] : [];
  });
  return chances.length > 0 ? chances.reduce((a, b) => a + b, 0) / chances.length : 0;
}

/**
 * What to do with energy left over once the shooting is done: brace when the balance is going or
 * when a guard takes more off the expected damage than dodging would, otherwise boost.
 */
function stance(state: BattleState, me: UnitState, enemies: UnitState[], catalog: Catalog): Action | null {
  const boost = can(state, { type: 'boost' }, catalog);
  const guard = can(state, { type: 'guard' }, catalog);
  if (!boost) return guard ? { type: 'guard' } : null;
  if (guard) {
    if (me.stagger >= me.staggerMax / 2) return { type: 'guard' };
    const threat = averageThreat(state, me, enemies, catalog);
    const dodged = threat > 0 ? Math.max(10, threat - boostProfile(me.build, catalog).thrust) / threat : 1;
    if (guardFactor(me, catalog) < dodged) return { type: 'guard' };
  }
  return { type: 'boost' };
}

/** Enemies that make the others harder to beat, or that will not wait: these are shot before the rest. */
const isHelper = (unit: UnitState): boolean =>
  unit.fuse !== undefined || unit.abilities.aegis !== undefined || unit.abilities.mend !== undefined || unit.abilities.jam !== undefined;

/**
 * Who the automatic player shoots at, and at which part when the objective says so: the enemy the
 * objective names; failing that a helper, then a staggered enemy, then the weakest.
 */
function autoTarget(state: BattleState, enemies: UnitState[]): { target: UnitState; limb?: FrameSlot } {
  const weakest = (units: UnitState[]) => units.reduce((a, b) => (b.parts.core!.ap < a.parts.core!.ap ? b : a));
  const marked = objectiveTarget(state);
  if (marked && !marked.destroyed) {
    // A machine wanted in one piece loses its legs, then its arms, and is never shot in the core.
    if (state.objective.type === 'disable') {
      return { target: marked, limb: (['legs', 'arms'] as const).find((slot) => (marked.parts[slot]?.ap ?? 0) > 0) ?? 'legs' };
    }
    return { target: marked };
  }
  const helpers = enemies.filter(isHelper);
  const reeling = enemies.filter((e) => e.staggered > 0);
  return { target: weakest(helpers.length > 0 ? helpers : reeling.length > 0 ? reeling : enemies) };
}

/**
 * A plain, competent player used by simulations, tests and the Auto Turn action: repairs a failing
 * core, braces for a bomb, plays to the objective, uses its module when it helps, charges and closes
 * in when its weapons need that, cools before overheating, shoots helpers and staggered enemies
 * first and the weakest one otherwise (its legs when it is too nimble to hit), pushing with its
 * heaviest weapons first, and spends leftover energy on a boost or a guard.
 */
export function chooseAutoPlayerAction(state: BattleState, catalog: Catalog): Action {
  const me = activeUnit(state);
  const enemies = state.units.filter((u) => u.side === 'enemy' && !u.destroyed);
  if (enemies.length === 0) return { type: 'endTurn' };

  const core = me.parts.core!;
  const repair: Action = { type: 'repair', part: 'core' };
  if (core.ap < core.maxAp * 0.35 && me.fired.length === 0 && can(state, repair, catalog)) return repair;

  if (!me.usedBoost && !me.usedGuard) {
    // A bomb that goes off before the next turn is braced for now, while there is energy for it.
    if (enemies.some((e) => e.fuse === 1) && can(state, { type: 'guard' }, catalog)) return { type: 'guard' };
    // A battle that only has to be outlasted is fought from cover: stance first, shooting with what is left.
    if (state.objective.type === 'survive') {
      const braced = stance(state, me, enemies, catalog);
      if (braced) return braced;
    }
  }

  const { target, limb } = autoTarget(state, enemies);
  const part: FrameSlot = limb ?? 'core';

  const module = moduleAction(state, catalog, target);
  if (module) return module;
  const charge = chargeable(state, catalog);
  if (charge) return charge;
  if (shouldCloseIn(state, catalog)) return { type: 'boost' };

  let usable = usableWeapons(state, catalog, target.id, ['rightHand', 'leftHand', 'shoulder']);
  if (limb) {
    // Once a limb is gone, the rest of a burst goes on into the core at half strength: no weapon is
    // fired whose leftover shots could finish a machine that has to survive.
    usable = usable.filter((u) => {
      const shot = previewShot(state, me.id, u.slot, target.id, limb, catalog);
      return (shot.shots - 1) * Math.ceil(shot.damage / 2) < target.parts.core!.ap;
    });
  }
  // A target that will outlast this turn's volley, and that the volley can knock off balance, gets the
  // hardest-pushing weapons first, so the rest land on a staggered mech. Small fry is shot as it comes.
  const volley = usable.map((u) => previewShot(state, me.id, u.slot, target.id, part, catalog));
  const damage = volley.reduce((sum, shot) => sum + shot.damage * shot.shots, 0);
  const push = usable.reduce((sum, u, i) => sum + impactOf(u.weapon) * volley[i].shots, 0);
  if (target.staggered === 0 && damage < target.parts[part]!.ap && push >= target.staggerMax - target.stagger) {
    usable.sort((a, b) => impactOf(b.weapon) - impactOf(a.weapon));
  }
  const choice = coolOrFire(state, catalog, bladesFirst(usable), target.id, part);
  if (choice.type === 'fire' && !limb) {
    const legs = target.parts.legs;
    const odds = previewShot(state, me.id, choice.weapon, target.id, 'core', catalog).hitChance;
    return odds < 50 && legs && legs.ap > 0 ? { ...choice, part: 'legs' } : choice;
  }
  if (choice.type === 'endTurn') return stance(state, me, enemies, catalog) ?? choice;
  return choice;
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
