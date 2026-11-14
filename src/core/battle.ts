import {
  DEFAULT_BOOST, LEG_TYPES, boostProfile, computeBuildStats, fcsOf, framePart, generatorOf, impactOf, legTypeOf, mobilityFor,
  moduleOf, shieldOf, weaponIn,
} from './build';
import { nextRandom } from './rng';
import {
  FRAME_SLOTS, WEAPON_SLOTS,
  type Abilities, type AiProfile, type BossPhase, type Build, type Catalog, type EnemyDef, type FrameSlot, type Module,
  type ModuleEffect, type Objective, type Weapon, type WeaponSlot,
} from './types';

export type { Objective } from './types';

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
  /** What the battle asks for: every enemy destroyed, when absent. */
  objective?: Objective;
  /** An ally off the field, who fires into it. */
  support?: Support;
}

/** An ally who is not on the field: at every new round they hit the strongest enemy for `damage`. */
export interface Support { name: string; damage: number }

/** Something the player has to keep from being worn down; see the `protect` objective. */
export interface Asset { name: string; hp: number; maxHp: number }

/** The most enemies that stand on the field at once. A carrier launches no more than this allows. */
export const MAX_ENEMIES = 3;

export interface UnitState {
  id: string;
  name: string;
  side: 'player' | 'enemy';
  build: Build;
  ai?: AiProfile;
  sprite?: string;
  /** See `EnemyDef.composed`. */
  composed: boolean;
  /** See `EnemyDef.paint`. Only the screen reads it. */
  paint?: string;
  /** Only the frame slots the build has. */
  parts: Partial<Record<FrameSlot, PartState>>;
  heat: number;
  energy: number;
  /** Remaining shots per fitted weapon; null means unlimited. */
  ammo: Partial<Record<WeaponSlot, number | null>>;
  /** Rounds put back into each magazine between the battles of a contract. They are billed like any round fired. */
  restocked: Partial<Record<WeaponSlot, number>>;
  boosted: boolean;
  /** Set when heat passes the limit; the unit's next turn is skipped. */
  overheated: boolean;
  usedBoost: boolean;
  usedCool: boolean;
  fired: WeaponSlot[];
  repairsLeft: number;
  destroyed: boolean;
  mods: UnitMods;
  /** Energy drained by enemy weapons, taken off the next turn's supply. */
  energyDebt: number;
  /** Impact taken so far; at `staggerMax` the unit staggers. */
  stagger: number;
  staggerMax: number;
  /** Own turns left before a stagger ends: 2 when it happens, 1 during the weak turn, 0 when steady. */
  staggered: number;
  /** Braced until the unit's next turn: less damage, less impact. */
  guarding: boolean;
  usedGuard: boolean;
  /** Weapons charged and ready to fire. */
  charged: WeaponSlot[];
  /** Activations of the module left this battle. */
  moduleUses: number;
  usedModule: boolean;
  /** Damage the pulse barrier still absorbs; gone at the unit's next turn. */
  barrier: number;
  /** Own turns left during which attackers get `paintBonus` to hit this unit. */
  painted: number;
  paintBonus: number;
  /** Hit-chance penalty for attackers until the unit's next turn. */
  chaff: number;
  /** Multiplies the unit's damage for the rest of its turn. */
  damageBoost: number;
  /** The kind of enemy this is: its `EnemyDef.id`. */
  kind?: string;
  /** Where an enemy stands on the field, 0 to `MAX_ENEMIES - 1`. One that joins later takes a place left free. */
  slot?: number;
  abilities: Abilities;
  /** Own turns left before a bomb goes off. */
  fuse?: number;
  /** Own turns left before a carrier launches again. */
  launchIn?: number;
  phases: BossPhase[];
  /** How many of its phases have begun. */
  phase: number;
  /** See `EnemyDef.partNames` and `EnemyDef.portrait`. Only the screen reads them. */
  partNames?: Partial<Record<FrameSlot, string>>;
  portrait?: string;
}

export type BattleEvent =
  | { type: 'turnStart'; unit: string }
  | { type: 'turnSkipped'; unit: string }
  /**
   * `part` is where the shot was aimed; `appliedTo` and `damage` are what was actually hit and lost.
   * `absorbed` is what a barrier took off it first.
   */
  | { type: 'shot'; unit: string; weapon: WeaponSlot; target: string; part: FrameSlot; appliedTo: FrameSlot; hit: boolean; damage: number; absorbed?: number }
  | { type: 'partDestroyed'; unit: string; part: FrameSlot }
  | { type: 'unitDestroyed'; unit: string }
  | { type: 'boost'; unit: string }
  | { type: 'guard'; unit: string }
  | { type: 'cool'; unit: string; amount: number }
  | { type: 'repair'; unit: string; part: FrameSlot; amount: number }
  | { type: 'overheat'; unit: string }
  | { type: 'stagger'; unit: string }
  | { type: 'recover'; unit: string }
  | { type: 'charge'; unit: string; weapon: WeaponSlot }
  /** `amount` is what the effect did: heat vented, armour restored, and so on. */
  | { type: 'module'; unit: string; effect: ModuleEffect; amount: number; target?: string }
  /** An enemy patched up one of its own side. */
  | { type: 'mend'; unit: string; target: string; part: FrameSlot; amount: number }
  /** A bomb's fuse burned down to `left` turns. */
  | { type: 'fuse'; unit: string; left: number }
  /** A bomb went off; `damage` is the armour the target lost. */
  | { type: 'blast'; unit: string; target: string; damage: number }
  | { type: 'launch'; unit: string; spawned: string }
  /** A boss entered its `phase`th phase (1 for the first change). */
  | { type: 'phase'; unit: string; phase: number }
  /** The ally off the field fired; `damage` is the armour the target lost. */
  | { type: 'support'; name: string; target: string; damage: number }
  /** The protected asset lost `lost` and stands at `hp`. */
  | { type: 'asset'; hp: number; lost: number }
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
  objective: Objective;
  /** Present in a `protect` battle. */
  asset?: Asset;
  support?: Support;
  /** Multiplies the armour and damage of every enemy, those that join later included. */
  enemyScale: number;
}

export type Action =
  | { type: 'fire'; weapon: WeaponSlot; target: string; part: FrameSlot }
  /** Readies a charge weapon; it can be fired from the next turn on. */
  | { type: 'charge'; weapon: WeaponSlot }
  | { type: 'boost' }
  | { type: 'guard' }
  | { type: 'cool' }
  /** Activates the module. Only the painter takes a target. */
  | { type: 'module'; target?: string }
  /** Patches up an ally's most damaged part, as the whole turn. Only units with the `mend` ability can. */
  | { type: 'mend'; target: string }
  | { type: 'repair'; part: FrameSlot }
  | { type: 'endTurn' }
  /** The player gives the battle up: a defeat, without waiting to be destroyed. */
  | { type: 'retreat' };

export type Refusal =
  | 'noEnergy' | 'noAmmo' | 'alreadyFired' | 'weaponDisabled' | 'noWeapon' | 'invalidTarget'
  | 'alreadyUsed' | 'legsDisabled' | 'noRepairs' | 'partDestroyed' | 'partFull' | 'battleOver'
  | 'staggered' | 'cannotBoost' | 'notCharged' | 'needsBoost' | 'noModule' | 'noUses' | 'noAbility';

/** What a boost gives a unit that fits no booster. Kept for callers that predate boosters. */
export const BOOST_EVASION = DEFAULT_BOOST.thrust;
export const HEAT_LIMIT = 100;
export const HEAT_AFTER_OVERHEAT = 50;
export const REPAIRS_PER_MISSION = 2;
export const REPAIR_FRACTION = 0.4;
export const HEAD_LOSS_PENALTY = 30;
export const ROUND_LIMIT = 60;
export const PART_MODIFIER: Record<FrameSlot, number> = { core: 0, legs: -5, arms: -10, head: -20 };

/** Damage a staggered unit takes, as a multiple. */
export const STAGGER_DAMAGE = 1.3;
/** Share of its energy a unit gets in the turn it starts staggered. */
export const STAGGER_ENERGY = 0.6;
/** Share of the stability bar a steady unit sheds at the start of each of its turns. */
export const STAGGER_DECAY = 0.35;
/** Share of a turn's energy a guard costs. */
export const GUARD_COST = 0.2;
/** Share of the damage that gets through a guard. */
export const GUARD_DAMAGE = 0.6;
/** Share of the impact that gets through a guard. */
export const GUARD_IMPACT = 0.5;
export const PAINT_TURNS = 3;
export const SHOCK_DAMAGE = 15;
export const OVERCLOCK_HEAT = 25;
export const LIMITER_HEAT = 30;

const HAND_SLOTS: WeaponSlot[] = ['rightHand', 'leftHand'];

function createUnit(
  id: string, name: string, side: UnitState['side'], build: Build, catalog: Catalog,
  extra: Partial<UnitState> = {}, modifiers: Partial<UnitMods> = {},
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
  const stats = computeBuildStats(build, catalog); // also checks the generator exists
  const ammo: UnitState['ammo'] = {};
  for (const slot of WEAPON_SLOTS) {
    const weapon = weaponIn(build, slot, catalog);
    // Enemies are not on a budget: they never run dry.
    if (weapon) ammo[slot] = side === 'enemy' ? null : weapon.ammo;
  }
  return {
    id, name, side, build, composed: false, abilities: {}, phases: [], phase: 0, ...extra, parts, heat: 0, energy: 0, ammo, restocked: {},
    boosted: false, overheated: false,
    usedBoost: false, usedCool: false, fired: [], repairsLeft: REPAIRS_PER_MISSION + mods.repairs, destroyed: false, mods, energyDebt: 0,
    stagger: 0, staggerMax: Math.max(1, Math.round(stats.stability * mods.toughness)), staggered: 0,
    guarding: false, usedGuard: false, charged: [], moduleUses: moduleOf(build, catalog)?.uses ?? 0, usedModule: false,
    barrier: 0, painted: 0, paintBonus: 0, chaff: 0, damageBoost: 1,
  };
}

function createEnemy(def: EnemyDef, id: string, name: string, slot: number, scale: number, catalog: Catalog): UnitState {
  const abilities = def.abilities ?? {};
  return createUnit(id, name, 'enemy', def.build, catalog, {
    ai: def.ai, sprite: def.sprite, composed: def.composed ?? false, kind: def.id, slot, abilities, phases: def.phases ?? [],
    ...(def.paint ? { paint: def.paint } : {}),
    ...(def.partNames ? { partNames: def.partNames } : {}),
    ...(def.portrait ? { portrait: def.portrait } : {}),
    ...(abilities.bomb ? { fuse: abilities.bomb.fuse } : {}),
    ...(abilities.carrier ? { launchIn: abilities.carrier.every } : {}),
  }, { damage: scale, toughness: scale });
}

const isAlive = (part: PartState | undefined): boolean => !!part && part.ap > 0;
const findUnit = (state: BattleState, id: string): UnitState | undefined => state.units.find((u) => u.id === id);
const standing = (state: BattleState, side: UnitState['side']): UnitState[] => state.units.filter((u) => u.side === side && !u.destroyed);

/** The enemy an objective names, if it names one. */
export function objectiveTarget(state: BattleState): UnitState | undefined {
  return 'target' in state.objective ? findUnit(state, `enemy-${state.objective.target}`) : undefined;
}

/** Share of the damage a unit takes that its side's shield units let through: the best of them counts, and none covers itself. */
export function aegisFactor(state: BattleState, unit: UnitState): number {
  const shields = standing(state, unit.side).filter((u) => u.id !== unit.id && u.abilities.aegis !== undefined);
  return Math.min(1, ...shields.map((u) => u.abilities.aegis!));
}

/** Hit chance a unit loses to the other side's jammers: the strongest of them counts. */
export function jamOn(state: BattleState, unit: UnitState): number {
  return Math.max(0, ...state.units.filter((u) => u.side !== unit.side && !u.destroyed).map((u) => u.abilities.jam ?? 0));
}

/** The part a mender would patch: the living part that has lost the largest share of its armour. */
export function mendablePart(unit: UnitState): FrameSlot | null {
  let best: FrameSlot | null = null;
  let bestRatio = 1;
  for (const slot of FRAME_SLOTS) { // core, legs, arms, head: earlier slots win ties
    const part = unit.parts[slot];
    if (!part || part.ap <= 0 || part.ap >= part.maxAp) continue;
    const ratio = part.ap / part.maxAp;
    if (ratio < bestRatio) { bestRatio = ratio; best = slot; }
  }
  return best;
}

/** Mobility right now: zero once the legs are gone. */
export function currentMobility(unit: UnitState, catalog: Catalog): number {
  if (!isAlive(unit.parts.legs)) return 0;
  return mobilityFor(framePart(unit.build, 'legs', catalog), computeBuildStats(unit.build, catalog).load);
}

/** How hard a unit is to hit right now. A unit without working legs, or one that is staggered, cannot evade at all. */
export function evasion(unit: UnitState, catalog: Catalog): number {
  if (!isAlive(unit.parts.legs) || unit.staggered > 0) return 0;
  return currentMobility(unit, catalog) + unit.mods.evasion + (unit.boosted ? boostProfile(unit.build, catalog).thrust : 0);
}

export const turnEnergyOf = (unit: UnitState, catalog: Catalog): number =>
  computeBuildStats(unit.build, catalog).turnEnergy + unit.mods.energy;
/** Heat a unit sheds at the end of its turn, and with the cool action. */
export const coolingOf = (unit: UnitState, catalog: Catalog): number => generatorOf(unit.build, catalog).cooling + unit.mods.cooling;
export const boostCost = (unit: UnitState, catalog: Catalog): number =>
  Math.ceil(boostProfile(unit.build, catalog).cost * turnEnergyOf(unit, catalog));
export const coolCost = (unit: UnitState, catalog: Catalog): number => Math.ceil(0.2 * turnEnergyOf(unit, catalog));
export const guardCost = (unit: UnitState, catalog: Catalog): number => Math.ceil(GUARD_COST * turnEnergyOf(unit, catalog));

/** Share of the damage that reaches a guarding unit: the best of its stance, its legs and its shield. */
export function guardFactor(unit: UnitState, catalog: Catalog): number {
  const legs = LEG_TYPES[legTypeOf(framePart(unit.build, 'legs', catalog))].guard ?? GUARD_DAMAGE;
  const shield = shieldOf(unit.build, catalog)?.guard ?? GUARD_DAMAGE;
  return Math.min(GUARD_DAMAGE, legs, shield);
}

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

/** Ends the battle if the player is gone or the objective is met (or, for a machine wanted in one piece, lost). */
function checkOutcome(state: BattleState): void {
  if (state.outcome !== 'ongoing') return;
  if (findUnit(state, 'player')!.destroyed) return setOutcome(state, 'defeat');
  const objective = state.objective;
  const target = objectiveTarget(state);
  if (target && objective.type === 'disable') {
    if (target.destroyed) return setOutcome(state, 'defeat');
    if ([target.parts.legs, target.parts.arms].every((part) => !isAlive(part))) return setOutcome(state, 'victory');
  }
  if (target && objective.type === 'leader' && target.destroyed) return setOutcome(state, 'victory');
  if (target && objective.type === 'driveOff') {
    const core = target.parts.core!;
    if (core.ap <= objective.share * core.maxAp) return setOutcome(state, 'victory');
  }
  if (standing(state, 'enemy').length === 0) setOutcome(state, 'victory');
}

/**
 * Starts the next round: the ally off the field fires, the protected asset is worn down, and the
 * order of turns is set. Returns false when the battle ended instead.
 */
function beginRound(state: BattleState, catalog: Catalog): boolean {
  if (state.objective.type === 'survive' && state.round >= state.objective.rounds) { setOutcome(state, 'victory'); return false; }
  if (state.round >= ROUND_LIMIT) { setOutcome(state, 'defeat'); return false; }
  state.round += 1;
  if (state.support) {
    // A machine the client wants in one piece is not for the ally to shoot at.
    const spared = state.objective.type === 'disable' ? objectiveTarget(state) : undefined;
    const foes = standing(state, 'enemy').filter((u) => u !== spared);
    if (foes.length > 0) {
      const target = foes.reduce((a, b) => (b.parts.core!.ap > a.parts.core!.ap ? b : a));
      const event: Extract<BattleEvent, { type: 'support' }> = { type: 'support', name: state.support.name, target: target.id, damage: 0 };
      state.events.push(event);
      event.damage = strike(state, target, state.support.damage, state.support.damage, catalog);
      checkOutcome(state);
      if (state.outcome !== 'ongoing') return false;
    }
  }
  if (state.asset) {
    const lost = Math.min(state.asset.hp, standing(state, 'enemy').length);
    state.asset.hp -= lost;
    state.events.push({ type: 'asset', hp: state.asset.hp, lost });
    if (state.asset.hp <= 0) { setOutcome(state, 'defeat'); return false; }
  }
  state.order = roundOrder(state, catalog);
  state.turn = 0;
  return true;
}

/** A bomb goes off: the player takes the blast and the bomb is gone. */
function detonate(state: BattleState, unit: UnitState, catalog: Catalog): void {
  const player = findUnit(state, 'player')!;
  const amount = unit.abilities.bomb!.damage * unit.mods.damage;
  const event: Extract<BattleEvent, { type: 'blast' }> = { type: 'blast', unit: unit.id, target: player.id, damage: 0 };
  state.events.push(event);
  event.damage = strike(state, player, amount, amount, catalog);
  damagePart(state, unit, 'core', unit.parts.core!.ap);
  checkOutcome(state);
}

/** A carrier counts down and, when its time has come and there is room on the field, launches a unit. */
function launch(state: BattleState, unit: UnitState, catalog: Catalog): void {
  const { unit: def, every } = unit.abilities.carrier!;
  unit.launchIn = Math.max(0, (unit.launchIn ?? every) - 1);
  const enemies = standing(state, 'enemy');
  if (unit.launchIn > 0 || enemies.length >= MAX_ENEMIES) return;
  const slot = Array.from({ length: MAX_ENEMIES }, (_, i) => i).find((i) => !enemies.some((u) => u.slot === i)) ?? 0;
  const sameKind = state.units.filter((u) => u.kind === def.id).length;
  const id = `enemy-${state.units.length - 1}`;
  state.units.push(createEnemy(def, id, `${def.name} ${String.fromCharCode(65 + sameKind)}`, slot, state.enemyScale, catalog));
  unit.launchIn = every;
  state.events.push({ type: 'launch', unit: unit.id, spawned: id });
}

/** Starts turns until a unit can actually act (overheated units lose theirs), or the battle ends. */
function beginTurns(state: BattleState, catalog: Catalog): void {
  while (state.outcome === 'ongoing') {
    if (state.turn >= state.order.length && !beginRound(state, catalog)) return;
    const unit = activeUnit(state);
    if (unit.destroyed) { state.turn += 1; continue; }
    // What lasted "until the unit's next turn" ends here, whether or not the turn is then lost.
    unit.boosted = false;
    unit.guarding = false;
    unit.barrier = 0;
    unit.chaff = 0;
    if (unit.painted > 0) unit.painted -= 1;
    if (unit.staggered > 0) {
      unit.staggered -= 1;
      if (unit.staggered === 0) {
        unit.stagger = 0;
        state.events.push({ type: 'recover', unit: unit.id });
      }
    } else {
      unit.stagger = Math.max(0, unit.stagger - Math.round(STAGGER_DECAY * unit.staggerMax));
    }
    if (unit.overheated) {
      unit.overheated = false;
      unit.heat = Math.min(unit.heat, HEAT_AFTER_OVERHEAT);
      state.events.push({ type: 'turnSkipped', unit: unit.id });
      state.turn += 1;
      continue;
    }
    const energy = Math.max(0, turnEnergyOf(unit, catalog) - unit.energyDebt);
    unit.energy = unit.staggered > 0 ? Math.floor(energy * STAGGER_ENERGY) : energy;
    unit.energyDebt = 0;
    unit.usedBoost = false;
    unit.usedGuard = false;
    unit.usedCool = false;
    unit.usedModule = false;
    unit.fired = [];
    state.events.push({ type: 'turnStart', unit: unit.id });
    // A turn lost to overheating is lost to a fuse and a launch bay too: neither gets this far.
    if (unit.fuse !== undefined) {
      unit.fuse -= 1;
      if (unit.fuse <= 0) {
        detonate(state, unit, catalog);
        state.turn += 1;
        continue;
      }
      state.events.push({ type: 'fuse', unit: unit.id, left: unit.fuse });
    }
    if (unit.abilities.carrier) launch(state, unit, catalog);
    return;
  }
}

function finishTurn(state: BattleState, catalog: Catalog): void {
  const unit = activeUnit(state);
  unit.heat = Math.max(0, unit.heat - coolingOf(unit, catalog));
  unit.damageBoost = 1;
  state.turn += 1;
  beginTurns(state, catalog);
}

/** Enemies of the same kind get a letter so messages can tell them apart. */
function enemyName(enemies: EnemyDef[], index: number): string {
  const same = enemies.map((e, i) => (e.id === enemies[index].id ? i : -1)).filter((i) => i >= 0);
  return same.length > 1 ? `${enemies[index].name} ${String.fromCharCode(65 + same.indexOf(index))}` : enemies[index].name;
}

/**
 * What a mech takes from one battle of a mission into the next: armour, heat, ammunition (with
 * what was refilled) and field repairs. Stagger, guard, charges, barriers, paint and module uses
 * all start afresh.
 */
export interface Carry {
  /** Remaining armour per frame part. */
  ap: Partial<Record<FrameSlot, number>>;
  heat: number;
  ammo: Partial<Record<WeaponSlot, number | null>>;
  restocked: Partial<Record<WeaponSlot, number>>;
  repairsLeft: number;
  destroyed: boolean;
}

/** The player's condition at the end of a battle, to start the next one with. */
export function carryFrom(state: BattleState): Carry {
  const player = state.units[0];
  const ap: Carry['ap'] = {};
  for (const slot of FRAME_SLOTS) if (player.parts[slot]) ap[slot] = player.parts[slot]!.ap;
  return {
    ap, heat: player.heat, ammo: { ...player.ammo }, restocked: { ...player.restocked }, repairsLeft: player.repairsLeft,
    destroyed: player.destroyed,
  };
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
  unit.restocked = { ...carry.restocked };
  unit.repairsLeft = carry.repairsLeft;
}

/** Refuses an objective the battle could not be won or lost by. */
function checkObjective(objective: Objective, enemies: EnemyDef[], catalog: Catalog): void {
  const bad = (what: string): never => { throw new Error(`objective ${objective.type}: ${what}`); };
  if ('target' in objective) {
    const def = enemies[objective.target];
    if (!Number.isInteger(objective.target) || !def) return bad(`objective names enemy ${objective.target}, which the battle does not have`);
    if (objective.type === 'disable' && !def.build.legs && !def.build.arms) bad(`${def.id} has no legs or arms to lose`);
    if (objective.type === 'disable' && !framePart(def.build, 'core', catalog)) bad(`${def.id} has no core`);
    if (objective.type === 'driveOff' && !(objective.share > 0 && objective.share < 1)) bad('the share must lie between 0 and 1');
  }
  if (objective.type === 'survive' && !(Number.isInteger(objective.rounds) && objective.rounds >= 1 && objective.rounds < ROUND_LIMIT)) {
    bad(`${objective.rounds} is not a number of rounds a battle can last`);
  }
  if (objective.type === 'protect' && !(Number.isInteger(objective.hp) && objective.hp >= 1)) bad('the asset must start with something to lose');
}

/** Enemies always start fresh; the player may carry on from an earlier battle (see `BattleOptions`). */
export function createBattle(player: Build, enemies: EnemyDef[], catalog: Catalog, seed: number, opts: BattleOptions = {}): BattleState {
  const objective: Objective = opts.objective ?? { type: 'destroy' };
  checkObjective(objective, enemies, catalog);
  const playerUnit = createUnit('player', 'You', 'player', player, catalog, {}, opts.mods);
  if (opts.carry) applyCarry(playerUnit, opts.carry);
  const enemyScale = opts.enemyScale ?? 1;
  const units = [playerUnit, ...enemies.map((e, i) => createEnemy(e, `enemy-${i}`, enemyName(enemies, i), i, enemyScale, catalog))];
  const state: BattleState = {
    units, round: 1, order: [], turn: 0, rng: seed | 0, events: [], outcome: 'ongoing', objective, enemyScale,
    ...(objective.type === 'protect' ? { asset: { name: objective.name, hp: objective.hp, maxHp: objective.hp } } : {}),
    ...(opts.support ? { support: { ...opts.support } } : {}),
  };
  state.order = roundOrder(state, catalog);
  beginTurns(state, catalog);
  return state;
}

/** How many times one pull of the trigger fires at a target. */
export function shotsOf(weapon: Weapon): number {
  if (weapon.trait === 'twin') return 2;
  if (weapon.trait === 'burst') return Math.max(1, weapon.traitPower ?? 1);
  return 1;
}

export interface ShotPreview {
  hitChance: number;
  /** Damage of one hit, before any barrier. */
  damage: number;
  /** Shots fired at the target. */
  shots: number;
  /** True when every other living enemy is fired at as well. */
  salvo: boolean;
}

export function previewShot(
  state: BattleState, attackerId: string, slot: WeaponSlot, targetId: string, part: FrameSlot, catalog: Catalog,
): ShotPreview {
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
  const fcs = fcsOf(attacker.build, catalog);
  if (fcs) aim += fcs.aim[weapon.damageType];
  // Four legs are a steady platform for whatever sits on the shoulder, as long as they stand.
  if (slot === 'shoulder' && isAlive(attacker.parts.legs)) {
    aim += LEG_TYPES[legTypeOf(framePart(attacker.build, 'legs', catalog))].shoulderAim;
  }
  if (target.painted > 0) aim += target.paintBonus;
  aim -= jamOn(state, attacker);

  const limb = Math.round(PART_MODIFIER[part] * (1 - (fcs?.focus ?? 0)));
  const raw = weapon.accuracy + aim - evasion(target, catalog) - target.chaff + limb - headPenalty;

  const resist = targetPart.resist[weapon.damageType] * (weapon.trait === 'pierce' ? 0.5 : 1);
  let amount = weapon.damage * (1 - resist) * attacker.mods.damage * attacker.damageBoost * aegisFactor(state, target);
  if (target.staggered > 0) amount *= STAGGER_DAMAGE;
  if (target.guarding) amount *= guardFactor(target, catalog);
  const full = Math.max(1, Math.round(amount));
  // A part that is already destroyed passes half the damage on to the core.
  const passesOn = target.parts[part]!.ap <= 0;
  return {
    hitChance: Math.min(95, Math.max(10, raw)),
    damage: passesOn ? Math.max(1, Math.floor(full / 2)) : full,
    shots: shotsOf(weapon),
    salvo: weapon.trait === 'salvo',
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
      if (weapon.melee && !unit.usedBoost) return 'needsBoost';
      // A charge weapon was paid for when it was charged.
      if (weapon.charge) {
        if (!unit.charged.includes(action.weapon)) return 'notCharged';
      } else if (unit.energy < weapon.energy) return 'noEnergy';
      const target = findUnit(state, action.target);
      if (!target || target.destroyed || target.side === unit.side || !target.parts[action.part]) return 'invalidTarget';
      return null;
    }
    case 'charge': {
      const weapon = weaponIn(unit.build, action.weapon, catalog);
      if (!weapon || !weapon.charge) return 'noWeapon';
      if (HAND_SLOTS.includes(action.weapon) && unit.parts.arms && !isAlive(unit.parts.arms)) return 'weaponDisabled';
      if (unit.charged.includes(action.weapon)) return 'alreadyUsed';
      if (unit.fired.includes(action.weapon)) return 'alreadyFired';
      if (unit.ammo[action.weapon] === 0) return 'noAmmo';
      return unit.energy < weapon.energy ? 'noEnergy' : null;
    }
    case 'boost':
      if (unit.usedBoost || unit.usedGuard) return 'alreadyUsed';
      if (!isAlive(unit.parts.legs)) return 'legsDisabled';
      if (!boostProfile(unit.build, catalog).able) return 'cannotBoost';
      if (unit.staggered > 0) return 'staggered';
      return unit.energy < boostCost(unit, catalog) ? 'noEnergy' : null;
    case 'guard':
      if (unit.usedGuard || unit.usedBoost) return 'alreadyUsed';
      return unit.energy < guardCost(unit, catalog) ? 'noEnergy' : null;
    case 'cool':
      if (unit.usedCool) return 'alreadyUsed';
      return unit.energy < coolCost(unit, catalog) ? 'noEnergy' : null;
    case 'module': {
      const module = moduleOf(unit.build, catalog);
      if (!module) return 'noModule';
      if (unit.usedModule) return 'alreadyUsed';
      if (unit.moduleUses <= 0) return 'noUses';
      if (module.effect === 'painter') {
        const target = action.target === undefined ? undefined : findUnit(state, action.target);
        if (!target || target.destroyed || target.side === unit.side) return 'invalidTarget';
      }
      return null;
    }
    case 'mend': {
      if (unit.abilities.mend === undefined) return 'noAbility';
      const target = findUnit(state, action.target);
      if (!target || target.destroyed || target.side !== unit.side || target.id === unit.id) return 'invalidTarget';
      return mendablePart(target) ? null : 'partFull';
    }
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
  // A pilot who is being driven off breaks away before the blow that would finish them: the core keeps a point.
  const spared = slot === 'core' && state.objective.type === 'driveOff' && objectiveTarget(state)?.id === target.id;
  part.ap = Math.max(spared ? Math.min(1, before) : 0, part.ap - amount);
  if (before > 0 && part.ap === 0) {
    state.events.push({ type: 'partDestroyed', unit: target.id, part: slot });
    // Without arms the hand weapons are finished, and whatever charge they held goes with them.
    if (slot === 'arms') target.charged = target.charged.filter((charged) => !HAND_SLOTS.includes(charged));
  }
  if (slot === 'core' && part.ap === 0 && !target.destroyed) {
    target.destroyed = true;
    state.events.push({ type: 'unitDestroyed', unit: target.id });
  }
}

/**
 * Begins every phase a boss's core has fallen far enough for, in order. A phase changes how it
 * fights, steadies it and refills its module; one that has begun never begins again.
 */
function checkPhases(state: BattleState, unit: UnitState, catalog: Catalog): void {
  const core = unit.parts.core!;
  while (!unit.destroyed && unit.phase < unit.phases.length && core.ap <= unit.phases[unit.phase].at * core.maxAp) {
    const phase = unit.phases[unit.phase];
    unit.phase += 1;
    if (phase.ai) unit.ai = phase.ai;
    unit.mods.damage *= phase.damage ?? 1;
    unit.mods.evasion += phase.evasion ?? 0;
    unit.mods.aim += phase.aim ?? 0;
    unit.mods.energy += phase.energy ?? 0;
    if (phase.refit) {
      const fitted = Object.fromEntries(Object.entries(phase.refit).filter(([, id]) => id !== undefined));
      unit.build = { ...unit.build, ...fitted };
      for (const slot of WEAPON_SLOTS) {
        if (!(slot in fitted)) continue;
        // Enemies never run dry; a player unit would get the new weapon's magazine.
        unit.ammo[slot] = unit.side === 'enemy' ? null : weaponIn(unit.build, slot, catalog)?.ammo ?? null;
        unit.charged = unit.charged.filter((charged) => charged !== slot);
        unit.fired = unit.fired.filter((fired) => fired !== slot);
      }
    }
    unit.stagger = 0;
    unit.staggered = 0;
    unit.moduleUses = moduleOf(unit.build, catalog)?.uses ?? 0;
    state.events.push({ type: 'phase', unit: unit.id, phase: unit.phase });
  }
}

/** Pushes a unit off balance. A full bar staggers it, which also costs it every charge it holds. */
function addImpact(state: BattleState, target: UnitState, amount: number): void {
  if (target.destroyed || target.staggered > 0 || amount <= 0) return;
  target.stagger = Math.min(target.staggerMax, target.stagger + amount);
  if (target.stagger < target.staggerMax) return;
  target.staggered = 2;
  target.charged = [];
  state.events.push({ type: 'stagger', unit: target.id });
}

function resolveFire(state: BattleState, action: Extract<Action, { type: 'fire' }>, catalog: Catalog, roll?: () => number): void {
  const unit = activeUnit(state);
  const primary = findUnit(state, action.target)!;
  const weapon = weaponIn(unit.build, action.weapon, catalog)!;

  if (weapon.charge) unit.charged = unit.charged.filter((slot) => slot !== action.weapon);
  else unit.energy -= weapon.energy;
  unit.fired.push(action.weapon);
  const ammo = unit.ammo[action.weapon];
  if (typeof ammo === 'number') unit.ammo[action.weapon] = ammo - 1;

  // A salvo fires at every living enemy: the chosen one first, at the chosen part, the rest at the core.
  const others = weapon.trait === 'salvo'
    ? state.units.filter((u) => u.side !== unit.side && !u.destroyed && u.id !== primary.id)
    : [];
  for (const target of [primary, ...others]) {
    const aimed: FrameSlot = target === primary ? action.part : 'core';
    // Each shot is rolled and previewed on its own, because an earlier one may have destroyed
    // the part (or the target) the next was aimed at.
    for (let i = 0; i < shotsOf(weapon) && !target.destroyed; i++) {
      const { hitChance, damage } = previewShot(state, unit.id, action.weapon, target.id, aimed, catalog);
      let value: number;
      if (roll) value = roll();
      else ({ value, state: state.rng } = nextRandom(state.rng));
      const hit = value * 100 < hitChance;
      const appliedTo: FrameSlot = target.parts[aimed]!.ap > 0 ? aimed : 'core';
      const absorbed = hit ? Math.min(target.barrier, damage) : 0;
      state.events.push({
        type: 'shot', unit: unit.id, weapon: action.weapon, target: target.id, part: aimed, appliedTo, hit,
        damage: hit ? damage - absorbed : 0, ...(absorbed > 0 ? { absorbed } : {}),
      });
      if (!hit) continue;
      target.barrier -= absorbed;
      if (damage > absorbed) damagePart(state, target, appliedTo, damage - absorbed);
      if (weapon.trait === 'thermal') heatUp(state, target, weapon.traitPower ?? 0);
      if (weapon.trait === 'drain') target.energyDebt += weapon.traitPower ?? 0;
      addImpact(state, target, Math.round(impactOf(weapon) * (target.guarding ? GUARD_IMPACT : 1)));
      checkPhases(state, target, catalog);
      // The objective may be met (or lost) by this very shot: the rest of the volley stays in the barrel.
      checkOutcome(state);
      if (state.outcome !== 'ongoing') break;
    }
    if (state.outcome !== 'ongoing') break;
  }

  // Closing in to strike is what the boost was spent on: the mech ends up in the enemy's face, not dodging.
  if (weapon.melee) unit.boosted = false;
  heatUp(state, unit, weapon.heat);
  checkOutcome(state);
}

/** Adds heat; passing the limit marks the unit overheated, which costs it its next turn. */
function heatUp(state: BattleState, unit: UnitState, amount: number): void {
  unit.heat += amount;
  if (unit.heat > HEAT_LIMIT && !unit.overheated && !unit.destroyed) {
    unit.overheated = true;
    state.events.push({ type: 'overheat', unit: unit.id });
  }
}

/**
 * Damage that is not a shot (a shock pulse, a bomb, an ally's fire from off the field) arriving at a
 * unit's core: a staggered unit takes more of it, a guarding or shielded one less, a barrier takes it
 * before the armour does, and a guard halves the push. Returns the armour lost.
 */
function strike(state: BattleState, target: UnitState, damage: number, impact: number, catalog: Catalog): number {
  let amount = damage * aegisFactor(state, target);
  if (target.staggered > 0) amount *= STAGGER_DAMAGE;
  if (target.guarding) amount *= guardFactor(target, catalog);
  const dealt = Math.max(1, Math.round(amount));
  const absorbed = Math.min(target.barrier, dealt);
  target.barrier -= absorbed;
  if (dealt > absorbed) damagePart(state, target, 'core', dealt - absorbed);
  addImpact(state, target, Math.round(impact * (target.guarding ? GUARD_IMPACT : 1)));
  checkPhases(state, target, catalog);
  return dealt - absorbed;
}

/** Runs a module's effect and returns what it amounted to, for the event. */
function useModule(state: BattleState, unit: UnitState, module: Module, targetId: string | undefined, catalog: Catalog): number {
  const { power } = module;
  switch (module.effect) {
    case 'coolant': {
      const amount = Math.min(unit.heat, power);
      unit.heat -= amount;
      return amount;
    }
    case 'barrier':
      unit.barrier = power;
      return power;
    case 'overclock':
      unit.energy += power;
      heatUp(state, unit, OVERCLOCK_HEAT);
      return power;
    case 'painter': {
      const target = findUnit(state, targetId!)!;
      target.painted = PAINT_TURNS;
      target.paintBonus = power;
      return power;
    }
    case 'nanites': {
      let restored = 0;
      for (const part of Object.values(unit.parts)) {
        if (!part || part.ap <= 0) continue;
        const amount = Math.min(part.maxAp - part.ap, Math.round((power / 100) * part.maxAp));
        part.ap += amount;
        restored += amount;
      }
      return restored;
    }
    case 'shock':
      for (const enemy of state.units.filter((u) => u.side !== unit.side && !u.destroyed)) {
        strike(state, enemy, SHOCK_DAMAGE, power, catalog);
      }
      return power;
    case 'chaff':
      unit.chaff = power;
      return power;
    case 'limiter':
      unit.damageBoost = 1 + power / 100;
      heatUp(state, unit, LIMITER_HEAT);
      return power;
  }
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
    case 'charge':
      unit.energy -= weaponIn(unit.build, action.weapon, catalog)!.energy;
      unit.charged.push(action.weapon);
      unit.fired.push(action.weapon);
      state.events.push({ type: 'charge', unit: unit.id, weapon: action.weapon });
      break;
    case 'boost':
      unit.energy -= boostCost(unit, catalog);
      unit.usedBoost = true;
      unit.boosted = true;
      state.events.push({ type: 'boost', unit: unit.id });
      break;
    case 'guard':
      unit.energy -= guardCost(unit, catalog);
      unit.usedGuard = true;
      unit.guarding = true;
      state.events.push({ type: 'guard', unit: unit.id });
      break;
    case 'cool': {
      const amount = Math.min(unit.heat, coolingOf(unit, catalog));
      unit.energy -= coolCost(unit, catalog);
      unit.usedCool = true;
      unit.heat -= amount;
      state.events.push({ type: 'cool', unit: unit.id, amount });
      break;
    }
    case 'module': {
      const module = moduleOf(unit.build, catalog)!;
      unit.moduleUses -= 1;
      unit.usedModule = true;
      // The event goes in first so that what the effect causes (a stagger, a destroyed drone) follows it in the log.
      const event: Extract<BattleEvent, { type: 'module' }> = {
        type: 'module', unit: unit.id, effect: module.effect, amount: 0, ...(action.target ? { target: action.target } : {}),
      };
      state.events.push(event);
      event.amount = useModule(state, unit, module, action.target, catalog);
      checkOutcome(state);
      break;
    }
    case 'mend': {
      const target = findUnit(state, action.target)!;
      const slot = mendablePart(target)!;
      const part = target.parts[slot]!;
      const amount = Math.min(part.maxAp - part.ap, Math.round(unit.abilities.mend! * part.maxAp));
      part.ap += amount;
      state.events.push({ type: 'mend', unit: unit.id, target: target.id, part: slot, amount });
      finishTurn(state, catalog);
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
