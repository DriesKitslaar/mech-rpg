import { computeBuildStats, framePart, generatorOf, mobilityFor, weaponIn } from './build';
import { nextRandom } from './rng';
import {
  FRAME_SLOTS, WEAPON_SLOTS,
  type AiProfile, type Build, type Catalog, type EnemyDef, type FrameSlot, type WeaponSlot,
} from './types';

export interface PartState { ap: number; maxAp: number }

/**
 * Adjustments to a unit: pilot perks for the player, difficulty scaling for enemies.
 * `aim` to `repairs` are added; `armour` is an added fraction; `damage` and `toughness` multiply.
 */
export interface UnitMods {
  aim: number;
  evasion: number;
  energy: number;
  cooling: number;
  repairs: number;
  armour: number;
  damage: number;
  toughness: number;
}
export const NO_MODS: UnitMods = { aim: 0, evasion: 0, energy: 0, cooling: 0, repairs: 0, armour: 0, damage: 1, toughness: 1 };

/** What `createBattle` may be told beyond who fights. */
export interface BattleOptions {
  /** Continues a mission: the player starts as the previous battle left them. */
  carry?: Carry;
  /** The player's modifiers, from pilot perks. */
  mods?: Partial<UnitMods>;
  /** Multiplies enemy armour and damage. */
  enemyScale?: number;
}

export interface UnitState {
  id: string;
  name: string;
  side: 'player' | 'enemy';
  build: Build;
  ai?: AiProfile;
  sprite?: string;
  /** Only the frame slots the build has. */
  parts: Partial<Record<FrameSlot, PartState>>;
  heat: number;
  energy: number;
  /** Remaining shots per fitted weapon; null means unlimited. */
  ammo: Partial<Record<WeaponSlot, number | null>>;
  boosted: boolean;
  /** Set when heat passes the limit; the unit's next turn is skipped. */
  overheated: boolean;
  usedBoost: boolean;
  usedCool: boolean;
  fired: WeaponSlot[];
  repairsLeft: number;
  destroyed: boolean;
  mods: UnitMods;
}

export type BattleEvent =
  | { type: 'turnStart'; unit: string }
  | { type: 'turnSkipped'; unit: string }
  /** `part` is where the shot was aimed; `appliedTo` and `damage` are what was actually hit and lost. */
  | { type: 'shot'; unit: string; weapon: WeaponSlot; target: string; part: FrameSlot; appliedTo: FrameSlot; hit: boolean; damage: number }
  | { type: 'partDestroyed'; unit: string; part: FrameSlot }
  | { type: 'unitDestroyed'; unit: string }
  | { type: 'boost'; unit: string }
  | { type: 'cool'; unit: string; amount: number }
  | { type: 'repair'; unit: string; part: FrameSlot; amount: number }
  | { type: 'overheat'; unit: string }
  | { type: 'outcome'; outcome: 'victory' | 'defeat' };

export interface BattleState {
  units: UnitState[];
  round: number;
  /** Unit ids in acting order for the current round. */
  order: string[];
  /** Index into `order` of the active unit. */
  turn: number;
  rng: number;
  events: BattleEvent[];
  outcome: 'ongoing' | 'victory' | 'defeat';
}

export type Action =
  | { type: 'fire'; weapon: WeaponSlot; target: string; part: FrameSlot }
  | { type: 'boost' }
  | { type: 'cool' }
  | { type: 'repair'; part: FrameSlot }
  | { type: 'endTurn' }
  /** The player gives the battle up: a defeat, without waiting to be destroyed. */
  | { type: 'retreat' };

export type Refusal =
  | 'noEnergy' | 'noAmmo' | 'alreadyFired' | 'weaponDisabled' | 'noWeapon' | 'invalidTarget'
  | 'alreadyUsed' | 'legsDisabled' | 'noRepairs' | 'partDestroyed' | 'partFull' | 'battleOver';

export const BOOST_EVASION = 30;
export const HEAT_LIMIT = 100;
export const HEAT_AFTER_OVERHEAT = 50;
export const REPAIRS_PER_MISSION = 2;
export const REPAIR_FRACTION = 0.4;
export const HEAD_LOSS_PENALTY = 30;
export const ROUND_LIMIT = 60;
export const PART_MODIFIER: Record<FrameSlot, number> = { core: 0, legs: -5, arms: -10, head: -20 };

const HAND_SLOTS: WeaponSlot[] = ['rightHand', 'leftHand'];

function createUnit(
  id: string, name: string, side: UnitState['side'], build: Build, catalog: Catalog,
  extra: Pick<UnitState, 'ai' | 'sprite'> = {}, modifiers: Partial<UnitMods> = {},
): UnitState {
  const mods: UnitMods = { ...NO_MODS, ...modifiers };
  const parts: UnitState['parts'] = {};
  for (const slot of FRAME_SLOTS) {
    const part = framePart(build, slot, catalog);
    if (!part) continue;
    const ap = Math.round(part.ap * (1 + mods.armour) * mods.toughness);
    parts[slot] = { ap, maxAp: ap };
  }
  if (!parts.core) throw new Error(`unit ${id} has no core`);
  generatorOf(build, catalog);
  const ammo: UnitState['ammo'] = {};
  for (const slot of WEAPON_SLOTS) {
    const weapon = weaponIn(build, slot, catalog);
    if (weapon) ammo[slot] = weapon.ammo;
  }
  return {
    id, name, side, build, ...extra, parts, heat: 0, energy: 0, ammo, boosted: false, overheated: false,
    usedBoost: false, usedCool: false, fired: [], repairsLeft: REPAIRS_PER_MISSION + mods.repairs, destroyed: false, mods,
  };
}

const isAlive = (part: PartState | undefined): boolean => !!part && part.ap > 0;
const findUnit = (state: BattleState, id: string): UnitState | undefined => state.units.find((u) => u.id === id);

/** Mobility right now: zero once the legs are gone. */
export function currentMobility(unit: UnitState, catalog: Catalog): number {
  if (!isAlive(unit.parts.legs)) return 0;
  return mobilityFor(framePart(unit.build, 'legs', catalog), computeBuildStats(unit.build, catalog).load);
}

export function evasion(unit: UnitState, catalog: Catalog): number {
  if (!isAlive(unit.parts.legs)) return 0;
  return currentMobility(unit, catalog) + unit.mods.evasion + (unit.boosted ? BOOST_EVASION : 0);
}

export const turnEnergyOf = (unit: UnitState, catalog: Catalog): number =>
  computeBuildStats(unit.build, catalog).turnEnergy + unit.mods.energy;
/** Heat a unit sheds at the end of its turn, and with the cool action. */
export const coolingOf = (unit: UnitState, catalog: Catalog): number => generatorOf(unit.build, catalog).cooling + unit.mods.cooling;
export const boostCost = (unit: UnitState, catalog: Catalog): number => Math.ceil(0.3 * turnEnergyOf(unit, catalog));
export const coolCost = (unit: UnitState, catalog: Catalog): number => Math.ceil(0.2 * turnEnergyOf(unit, catalog));

export function activeUnit(state: BattleState): UnitState {
  return findUnit(state, state.order[state.turn])!;
}

function roundOrder(state: BattleState, catalog: Catalog): string[] {
  // `units` is already player first, then enemies by index; a stable sort keeps that for ties.
  return state.units
    .filter((u) => !u.destroyed)
    .map((u) => ({ id: u.id, mobility: currentMobility(u, catalog) }))
    .sort((a, b) => b.mobility - a.mobility)
    .map((u) => u.id);
}

function setOutcome(state: BattleState, outcome: 'victory' | 'defeat'): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = outcome;
  state.events.push({ type: 'outcome', outcome });
}

/** Starts turns until a unit can actually act (overheated units lose theirs), or the battle ends. */
function beginTurns(state: BattleState, catalog: Catalog): void {
  while (state.outcome === 'ongoing') {
    if (state.turn >= state.order.length) {
      if (state.round >= ROUND_LIMIT) { setOutcome(state, 'defeat'); return; }
      state.round += 1;
      state.order = roundOrder(state, catalog);
      state.turn = 0;
    }
    const unit = activeUnit(state);
    if (unit.destroyed) { state.turn += 1; continue; }
    unit.boosted = false;
    if (unit.overheated) {
      unit.overheated = false;
      unit.heat = Math.min(unit.heat, HEAT_AFTER_OVERHEAT);
      state.events.push({ type: 'turnSkipped', unit: unit.id });
      state.turn += 1;
      continue;
    }
    unit.energy = turnEnergyOf(unit, catalog);
    unit.usedBoost = false;
    unit.usedCool = false;
    unit.fired = [];
    state.events.push({ type: 'turnStart', unit: unit.id });
    return;
  }
}

function finishTurn(state: BattleState, catalog: Catalog): void {
  const unit = activeUnit(state);
  unit.heat = Math.max(0, unit.heat - coolingOf(unit, catalog));
  state.turn += 1;
  beginTurns(state, catalog);
}

/** Enemies of the same kind get a letter so messages can tell them apart. */
function enemyName(enemies: EnemyDef[], index: number): string {
  const same = enemies.map((e, i) => (e.id === enemies[index].id ? i : -1)).filter((i) => i >= 0);
  return same.length > 1 ? `${enemies[index].name} ${String.fromCharCode(65 + same.indexOf(index))}` : enemies[index].name;
}

/** What a mech takes from one battle of a mission into the next. */
export interface Carry {
  /** Remaining armour per frame part. */
  ap: Partial<Record<FrameSlot, number>>;
  heat: number;
  ammo: Partial<Record<WeaponSlot, number | null>>;
  repairsLeft: number;
  destroyed: boolean;
}

/** The player's condition at the end of a battle, to start the next one with. */
export function carryFrom(state: BattleState): Carry {
  const player = state.units[0];
  const ap: Carry['ap'] = {};
  for (const slot of FRAME_SLOTS) if (player.parts[slot]) ap[slot] = player.parts[slot]!.ap;
  return { ap, heat: player.heat, ammo: { ...player.ammo }, repairsLeft: player.repairsLeft, destroyed: player.destroyed };
}

function applyCarry(unit: UnitState, carry: Carry): void {
  if (carry.destroyed) throw new Error('a destroyed mech cannot enter a battle');
  for (const slot of FRAME_SLOTS) {
    const part = unit.parts[slot];
    const ap = carry.ap[slot];
    if (part && typeof ap === 'number') part.ap = Math.max(0, Math.min(part.maxAp, ap));
  }
  unit.heat = Math.max(0, carry.heat);
  for (const slot of WEAPON_SLOTS) if (slot in unit.ammo && slot in carry.ammo) unit.ammo[slot] = carry.ammo[slot];
  unit.repairsLeft = carry.repairsLeft;
}

/** Enemies always start fresh; the player may carry on from an earlier battle (see `BattleOptions`). */
export function createBattle(player: Build, enemies: EnemyDef[], catalog: Catalog, seed: number, opts: BattleOptions = {}): BattleState {
  const playerUnit = createUnit('player', 'You', 'player', player, catalog, {}, opts.mods);
  if (opts.carry) applyCarry(playerUnit, opts.carry);
  const scale = opts.enemyScale ?? 1;
  const enemyMods = { damage: scale, toughness: scale };
  const units = [
    playerUnit,
    ...enemies.map((e, i) => createUnit(`enemy-${i}`, enemyName(enemies, i), 'enemy', e.build, catalog, { ai: e.ai, sprite: e.sprite }, enemyMods)),
  ];
  const state: BattleState = { units, round: 1, order: [], turn: 0, rng: seed | 0, events: [], outcome: 'ongoing' };
  state.order = roundOrder(state, catalog);
  beginTurns(state, catalog);
  return state;
}

export function previewShot(
  state: BattleState, attackerId: string, slot: WeaponSlot, targetId: string, part: FrameSlot, catalog: Catalog,
): { hitChance: number; damage: number } {
  const attacker = findUnit(state, attackerId);
  const target = findUnit(state, targetId);
  const weapon = attacker && weaponIn(attacker.build, slot, catalog);
  const targetPart = target && framePart(target.build, part, catalog);
  if (!attacker || !target || !weapon || !targetPart) throw new Error('previewShot: no such attacker, weapon, target or part');

  let aim = attacker.mods.aim;
  let headPenalty = 0;
  const head = framePart(attacker.build, 'head', catalog);
  if (head) {
    if (isAlive(attacker.parts.head)) aim += head.aim ?? 0;
    else headPenalty = HEAD_LOSS_PENALTY;
  }
  const arms = framePart(attacker.build, 'arms', catalog);
  if (arms && HAND_SLOTS.includes(slot) && isAlive(attacker.parts.arms)) aim += arms.aim ?? 0;

  const raw = weapon.accuracy + aim - evasion(target, catalog) + PART_MODIFIER[part] - headPenalty;
  const full = Math.max(1, Math.round(weapon.damage * (1 - targetPart.resist[weapon.damageType]) * attacker.mods.damage));
  // A part that is already destroyed passes half the damage on to the core.
  const passesOn = target.parts[part]!.ap <= 0;
  return {
    hitChance: Math.min(95, Math.max(10, raw)),
    damage: passesOn ? Math.max(1, Math.floor(full / 2)) : full,
  };
}

export function checkAction(state: BattleState, action: Action, catalog: Catalog): Refusal | null {
  if (state.outcome !== 'ongoing') return 'battleOver';
  const unit = activeUnit(state);
  switch (action.type) {
    case 'endTurn':
      return null;
    case 'retreat':
      return unit.side === 'player' ? null : 'invalidTarget';
    case 'fire': {
      const weapon = weaponIn(unit.build, action.weapon, catalog);
      if (!weapon) return 'noWeapon';
      if (HAND_SLOTS.includes(action.weapon) && unit.parts.arms && !isAlive(unit.parts.arms)) return 'weaponDisabled';
      if (unit.fired.includes(action.weapon)) return 'alreadyFired';
      if (unit.ammo[action.weapon] === 0) return 'noAmmo';
      if (unit.energy < weapon.energy) return 'noEnergy';
      const target = findUnit(state, action.target);
      if (!target || target.destroyed || target.side === unit.side || !target.parts[action.part]) return 'invalidTarget';
      return null;
    }
    case 'boost':
      if (unit.usedBoost) return 'alreadyUsed';
      if (!isAlive(unit.parts.legs)) return 'legsDisabled';
      return unit.energy < boostCost(unit, catalog) ? 'noEnergy' : null;
    case 'cool':
      if (unit.usedCool) return 'alreadyUsed';
      return unit.energy < coolCost(unit, catalog) ? 'noEnergy' : null;
    case 'repair': {
      const part = unit.parts[action.part];
      if (!part) return 'invalidTarget';
      if (unit.repairsLeft <= 0) return 'noRepairs';
      if (part.ap <= 0) return 'partDestroyed';
      return part.ap >= part.maxAp ? 'partFull' : null;
    }
  }
}

function damagePart(state: BattleState, target: UnitState, slot: FrameSlot, amount: number): void {
  const part = target.parts[slot]!;
  const before = part.ap;
  part.ap = Math.max(0, part.ap - amount);
  if (before > 0 && part.ap === 0) state.events.push({ type: 'partDestroyed', unit: target.id, part: slot });
  if (slot === 'core' && part.ap === 0 && !target.destroyed) {
    target.destroyed = true;
    state.events.push({ type: 'unitDestroyed', unit: target.id });
  }
}

function resolveFire(state: BattleState, action: Extract<Action, { type: 'fire' }>, catalog: Catalog, roll?: () => number): void {
  const unit = activeUnit(state);
  const target = findUnit(state, action.target)!;
  const weapon = weaponIn(unit.build, action.weapon, catalog)!;
  const { hitChance, damage } = previewShot(state, unit.id, action.weapon, target.id, action.part, catalog);

  unit.energy -= weapon.energy;
  unit.fired.push(action.weapon);
  const ammo = unit.ammo[action.weapon];
  if (typeof ammo === 'number') unit.ammo[action.weapon] = ammo - 1;

  let value: number;
  if (roll) value = roll();
  else ({ value, state: state.rng } = nextRandom(state.rng));
  const hit = value * 100 < hitChance;
  const appliedTo: FrameSlot = target.parts[action.part]!.ap > 0 ? action.part : 'core';
  state.events.push({
    type: 'shot', unit: unit.id, weapon: action.weapon, target: target.id, part: action.part, appliedTo, hit,
    damage: hit ? damage : 0,
  });
  if (hit) damagePart(state, target, appliedTo, damage);

  unit.heat += weapon.heat;
  if (unit.heat > HEAT_LIMIT && !unit.overheated) {
    unit.overheated = true;
    state.events.push({ type: 'overheat', unit: unit.id });
  }

  if (state.units.every((u) => u.side !== 'enemy' || u.destroyed)) setOutcome(state, 'victory');
  else if (findUnit(state, 'player')!.destroyed) setOutcome(state, 'defeat');
}

/**
 * Applies one action of the active unit and returns the new state. The input is not changed.
 * `roll` replaces the seeded random number for a shot (tests use it to force hits and misses).
 */
export function applyAction(input: BattleState, action: Action, catalog: Catalog, roll?: () => number): BattleState {
  const refusal = checkAction(input, action, catalog);
  if (refusal) throw new Error(`illegal action: ${refusal}`);
  const state = structuredClone(input);
  const unit = activeUnit(state);
  switch (action.type) {
    case 'fire':
      resolveFire(state, action, catalog, roll);
      break;
    case 'boost':
      unit.energy -= boostCost(unit, catalog);
      unit.usedBoost = true;
      unit.boosted = true;
      state.events.push({ type: 'boost', unit: unit.id });
      break;
    case 'cool': {
      const amount = Math.min(unit.heat, coolingOf(unit, catalog));
      unit.energy -= coolCost(unit, catalog);
      unit.usedCool = true;
      unit.heat -= amount;
      state.events.push({ type: 'cool', unit: unit.id, amount });
      break;
    }
    case 'repair': {
      const part = unit.parts[action.part]!;
      const amount = Math.min(part.maxAp - part.ap, Math.round(REPAIR_FRACTION * part.maxAp));
      part.ap += amount;
      unit.repairsLeft -= 1;
      state.events.push({ type: 'repair', unit: unit.id, part: action.part, amount });
      finishTurn(state, catalog);
      break;
    }
    case 'endTurn':
      finishTurn(state, catalog);
      break;
    case 'retreat':
      setOutcome(state, 'defeat');
      break;
  }
  return state;
}
