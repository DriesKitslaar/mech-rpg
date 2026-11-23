import type { Ground } from './ground';
import {
  DEFAULT_BOOST, LEG_TYPES, boostProfile, computeBuildStats, fcsOf, framePart, generatorOf, impactOf, legTypeOf, mobilityFor,
  moduleOf, shieldOf, weaponIn,
} from './build';
import { nextRandom } from './rng';
import { stepOf, tuneFactor, tunedOutput, type Tuning } from './tuning';
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
 * `tune` is the bench's work on the unit's parts, by part id (see tuning.ts): it is read where a
 * frame part's armour is set, where a shot's damage is worked out and where a turn's energy is.
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
  tune?: Tuning;
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
  /** What the place does to the fighting; see ground.ts. */
  ground?: Ground;
  /** The pilot's Overdrive. Without one there is no meter. */
  overdrive?: OverdriveId;
  /** Elite enemies, by their place in the line: which mark each one carries. */
  marks?: Partial<Record<number, EnemyMark>>;
  /** What the meter starts at, when nothing is carried: a drill hands the pilot a full one. */
  drive?: number;
  /** Machines that are not on the field yet: they come on in this order, at the start of a round, as room has been made. */
  reserve?: EnemyDef[];
  /**
   * Never an open battle, whatever is in it: it is fought by the rules a fight against one machine is
   * fought by. A drill is one, so that what it teaches is what wins it.
   */
  closed?: true;
}

/** An ally who is not on the field: at every new round they hit the strongest enemy for `damage`. */
/** What a wingman can be told to do. */
export type Order = 'strongest' | 'target' | 'cover';
export const ORDERS: Order[] = ['strongest', 'target', 'cover'];
/**
 * An ally who is not on the field. By default they fire once a round at the strongest enemy. One
 * who takes orders (a hired wingman; an ally of the story does as the story says) can be told to
 * fire at whatever the pilot fired at last, or to hold their fire and draw the enemy's instead.
 */
export interface Support { name: string; damage: number; orders?: boolean; order?: Order }
/** The share of every shot at the pilot that a wingman on cover takes on themselves. */
export const coverShare = (support: Support): number => Math.min(0.3, support.damage / 150);

/**
 * The pilot's great moves. A meter fills as the pilot fights; full, it buys one of these, once.
 * Second Wind: the turn starts over (energy back, every weapon and action ready again; heat stays).
 * Iron Skin: until the pilot's next turn, half damage and no stagger.
 * Deadeye: for the rest of the turn every shot hits and does a quarter more.
 */
export type OverdriveId = 'second-wind' | 'iron-skin' | 'deadeye';
export const OVERDRIVES: OverdriveId[] = ['second-wind', 'iron-skin', 'deadeye'];
export const DRIVE_MAX = 100;
/** What fills the meter: a volley that lands, a volley taken, a bomb's blast taken, an enemy destroyed. */
export const DRIVE_GAIN = { landed: 8, taken: 10, blast: 10, kill: 15 } as const;
export const IRON_SKIN = 0.5;
export const DEADEYE_DAMAGE = 1.25;

/**
 * What sets an elite enemy apart from others of its kind.
 * Armoured: more armour on every part. Overclocked: more damage. Swift: harder to hit.
 * Shielded: a barrier of a share of its armour, raised anew at every turn of its own.
 */
export type EnemyMark = 'armoured' | 'overclocked' | 'swift' | 'shielded';
export const MARKS: EnemyMark[] = ['armoured', 'overclocked', 'swift', 'shielded'];
export const MARK = { armour: 0.4, damage: 1.25, evasion: 15, shield: 0.1 } as const;
/**
 * What a weapon does to a machine that is hardened against it, as a share of what it does to any other: the
 * armour it takes off, and nothing else about the shot. It is as likely to hit and pushes as hard.
 */
export const HARDENED = 0.5;
/** Whether a machine is hardened against a weapon: the weapon is one of those its unit lists. */
export const hardenedAgainst = (target: Pick<UnitState, 'hardened'>, weapon: Pick<Weapon, 'id'>): boolean => target.hardened?.includes(weapon.id) ?? false;

/** Something the player has to keep from being worn down; see the `protect` objective. `sprite` is its picture on the field, where it has one. */
export interface Asset { name: string; hp: number; maxHp: number; sprite?: string }

/** The most enemies that stand on the field at once. A carrier launches no more than this allows. */
export const MAX_ENEMIES = 3;
/**
 * Shatter: one blow that takes at least this share of an ordinary machine's core, as it stood at
 * full strength, finishes the machine. A heavy weapon goes through a light machine; a light one
 * has to wear it down.
 */
export const SHATTER = 0.5;
/**
 * Overkill: a machine destroyed by a blow that carried at least this many times its whole core, as
 * that stood at full strength. Like a shattering it is measured against the machine as it was made,
 * so how worn the machine already was makes no difference either way. It changes nothing: the battle
 * says so, of a machine of the other side, for the screen to make something of.
 *
 * One and a half is where it is seen and stays worth seeing. Played out by the automatic player
 * (which fires no Overdrive) with the frames the shop sells, nothing the first three carry is a
 * machine and a half; from the fourth it is seen, in up to one kill in twelve of the story and from
 * one in ten to two in three of the kills in a swarm. (Under Deadeye an early mortar is one, on a drone.)
 * At twice the core it was hardly ever seen; at once the core it was three kills in four, and
 * more, of a grown pilot's swarm, which is no longer a thing to remark on.
 */
export const OVERKILL = 1.5;

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
  /**
   * The weapons fired at all this turn, whatever a kill or a Second Wind readied again: and, for each weapon, how many
   * of the unit's own turns in a row before this one it was fired in. A spool winds up by these (see `shotsNow`); a
   * turn that passes without a weapon, a turn lost to heat among them, sets it back to none.
   */
  spun: WeaponSlot[];
  spool: Partial<Record<WeaponSlot, number>>;
  /** The heat past which the unit overheats: its core's own limit, or the usual one. */
  heatLimit: number;
  /**
   * The share of a turn's energy, in a hundred, that the unit's core can keep from one turn for the next (none,
   * of most cores), and what it is keeping now: what was left when its last turn ended, as far as the core holds.
   */
  buffer: number;
  kept: number;
  /**
   * Units this unit's volleys have destroyed in its current turn, in an open battle: 0 when the
   * turn begins. A volley that destroys one readies its weapon again, so a unit that outguns the
   * field goes on through it.
   */
  chain: number;
  /**
   * Saw two machines of its side destroyed in one turn: it breaks off when its own turn comes,
   * instead of taking it. Until then it stands, and can be shot at, like any other. Once it has left
   * it is `destroyed` for everything that asks who stands, and nobody's kill: what was said of it
   * is `rout`, not `unitDestroyed`.
   */
  shaken?: true;
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
  /** The field of the unit's core was broken and is not back yet: it stays down for the round after the one it broke in. */
  fieldDown?: true;
  /** Own turns left during which attackers get `paintBonus` to hit this unit. */
  painted: number;
  paintBonus: number;
  /** Hit-chance penalty for attackers until the unit's next turn. */
  chaff: number;
  /** Multiplies the unit's damage for the rest of its turn. */
  damageBoost: number;
  /** What sets this enemy apart, if it is an elite one. */
  mark?: EnemyMark;
  /** Weapons this unit is hardened against, by their ids: each does `HARDENED` of its damage to it. Absent of a unit that is hardened against none. */
  hardened?: string[];
  /** The energy the unit's turn began with: what Second Wind gives back. */
  turnEnergy: number;
  /** The Overdrive this unit has, if any: only the pilot's own mech has one. */
  overdrive?: OverdriveId;
  /** How far the Overdrive's meter has filled, 0 to `DRIVE_MAX`. Stays 0 without an Overdrive. */
  drive: number;
  /** Iron Skin is up: half damage and no stagger until the unit's next turn. */
  ironSkin: boolean;
  /** Deadeye is on: until the turn ends every shot hits and does more. */
  deadeye: boolean;
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
  /** `kept` is what the turn opened with beyond its own energy, of a unit whose core keeps what it does not spend. */
  | { type: 'turnStart'; unit: string; kept?: number }
  | { type: 'turnSkipped'; unit: string }
  /**
   * `part` is where the shot was aimed; `appliedTo` and `damage` are what was actually hit and lost.
   * `absorbed` is what a barrier took off it first. `shatter` marks a hit that went through an
   * ordinary machine in one blow (see `SHATTER`).
   */
  | {
    type: 'shot'; unit: string; weapon: WeaponSlot; target: string; part: FrameSlot; appliedTo: FrameSlot; hit: boolean; damage: number;
    absorbed?: number; shatter?: true;
    /** The machine a fork's bolt leapt on from: a shot that has one was not rolled for, and is a hit. */
    via?: string;
    /**
     * What the weapon's kind made of this hit, in a hundred of what the weapon is listed at, where that is not a
     * hundred: a redline fired warm, a surge by what it took, a punish landing on a staggered machine.
     */
    lift?: number;
  }
  | { type: 'partDestroyed'; unit: string; part: FrameSlot }
  /** `overkill` marks a machine of the other side destroyed by a hit of `OVERKILL` times its core at full strength. */
  | { type: 'unitDestroyed'; unit: string; overkill?: true }
  /**
   * A volley of `unit`'s destroyed something and the battle goes on: `weapon` is ready again, and
   * `chain` is how many that makes this turn. Once for a volley, after all of it has landed.
   */
  | { type: 'momentum'; unit: string; weapon: WeaponSlot; chain: number }
  /** `unit` has seen two machines of its side destroyed in one turn, and will break off when its own turn comes. */
  | { type: 'shaken'; unit: string }
  /**
   * `unit`, shaken, is out of the fight in place of taking its turn. It was not destroyed. One that can
   * move has left the field; `fixed` marks one that cannot, which shuts down where it stands.
   */
  | { type: 'rout'; unit: string; fixed?: true }
  /** `unit` has come on from the reserve as a round began; `left` are still to come after it. */
  | { type: 'arrive'; unit: string; left: number }
  | { type: 'boost'; unit: string }
  | { type: 'guard'; unit: string }
  | { type: 'cool'; unit: string; amount: number }
  | { type: 'repair'; unit: string; part: FrameSlot; amount: number }
  | { type: 'overheat'; unit: string }
  | { type: 'stagger'; unit: string }
  /** The field of a unit's core took all it could and is gone; and, a round later, is whole again. */
  | { type: 'fieldDown'; unit: string }
  | { type: 'fieldUp'; unit: string }
  | { type: 'recover'; unit: string }
  | { type: 'charge'; unit: string; weapon: WeaponSlot }
  /**
   * `amount` is what the effect did: heat vented, armour restored, and so on. A shock pulse also
   * says in `damage` how much armour it took off those it struck, all told.
   */
  | { type: 'module'; unit: string; effect: ModuleEffect; amount: number; target?: string; damage?: number }
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
  | { type: 'order'; name: string; order: Order }
  | { type: 'overdrive'; unit: string; kind: OverdriveId }
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
  /** What the place does to the fighting; see ground.ts. */
  ground?: Ground;
  /** The enemy the pilot fired at last, for a wingman told to follow the pilot's fire. */
  focus?: string;
  /** Multiplies the armour and damage of every enemy, those that join later included. */
  enemyScale: number;
  /**
   * True of a battle against ordinary machines: one that began against more than one, none of
   * which leads (see `leads`). Momentum and Shatter are rules of an open battle and of no other:
   * a fight against a boss, a named pilot, an elite or an objective's target, or against one
   * machine, is fought as it always was, by every machine in it, to its end.
   */
  open: boolean;
  /**
   * Machines still to come, in the order they come in: at the start of each round as many as there
   * is room for on the field. The battle is not won while any are left. Empty where there never were any.
   */
  reserve: EnemyDef[];
  /** Set when the battle ended because the pilot walked away from it. */
  retreated?: boolean;
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
  | { type: 'retreat' }
  /** Tells the wingman what to do from now on. Costs nothing and does not end the turn. */
  | { type: 'order'; order: Order }
  /** Spends a full meter on the pilot's Overdrive. Costs nothing else and does not end the turn. */
  | { type: 'overdrive' };

export type Refusal =
  | 'noEnergy' | 'noAmmo' | 'alreadyFired' | 'weaponDisabled' | 'noWeapon' | 'invalidTarget'
  | 'alreadyUsed' | 'legsDisabled' | 'noRepairs' | 'partDestroyed' | 'partFull' | 'battleOver'
  | 'staggered' | 'cannotBoost' | 'notCharged' | 'needsBoost' | 'noModule' | 'noUses' | 'noAbility' | 'noWingman' | 'noOverdrive' | 'nothingSpent';

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
/** The energy a surge weapon's damage is listed for: it does that much, and pushes that hard, for every so much it takes. */
export const SURGE_UNIT = 100;
/** The shots a spool fires before it has wound up at all. */
export const SPOOL_BASE = 2;

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
    const ap = Math.round(part.ap * tuneFactor(mods.tune, part.id) * (1 + mods.armour) * mods.toughness);
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
  const unit: UnitState = {
    id, name, side, build, composed: false, abilities: {}, phases: [], phase: 0, ...extra, parts, heat: 0, energy: 0, ammo, restocked: {},
    boosted: false, overheated: false,
    usedBoost: false, usedCool: false, fired: [], spun: [], spool: {}, heatLimit: heatLimitOf(build, catalog), buffer: bufferOf(build, catalog), kept: 0, chain: 0, repairsLeft: REPAIRS_PER_MISSION + mods.repairs, destroyed: false, mods, energyDebt: 0,
    stagger: 0, staggerMax: Math.max(1, Math.round(stats.stability * mods.toughness)), staggered: 0,
    guarding: false, usedGuard: false, charged: [], moduleUses: moduleOf(build, catalog)?.uses ?? 0, usedModule: false,
    barrier: 0, painted: 0, paintBonus: 0, chaff: 0, damageBoost: 1, drive: 0, ironSkin: false, deadeye: false, turnEnergy: 0,
  };
  // A core with a field has it up before anybody has had a turn.
  unit.barrier = fieldOf(unit, catalog);
  return unit;
}

/** The barrier a shielded elite stands behind: a share of all the armour it came with. */
function markShield(unit: UnitState): number {
  return Math.round(MARK.shield * Object.values(unit.parts).reduce((sum, part) => sum + (part?.maxAp ?? 0), 0));
}

/**
 * The field a unit's core raises, if it is a core that raises one: a barrier of that much, standing when a
 * battle opens. An enemy's is as much stronger as the enemy is, and an enemy may fly one tuned to raise more
 * than its core is sold with.
 */
export function fieldOf(unit: UnitState, catalog: Catalog): number {
  return Math.round((unit.abilities.field ?? framePart(unit.build, 'core', catalog)?.field ?? 0) * unit.mods.toughness);
}

/** Said when a blow has just taken the last of a barrier that is a core's field: the field is down. */
function fieldBroken(state: BattleState, target: UnitState, absorbed: number, catalog: Catalog): void {
  if (absorbed > 0 && target.barrier === 0 && fieldOf(target, catalog) > 0) state.events.push({ type: 'fieldDown', unit: target.id });
}

/** How many of the blades a unit carries it has struck with this turn and not had readied again. */
const bladesSpent = (unit: UnitState, catalog: Catalog): number =>
  unit.fired.filter((slot) => weaponIn(unit.build, slot, catalog)?.melee).length;

/** The barrier a unit stands behind as a battle opens: its core's field, or an elite's shield if that is more. */
const standingBarrier = (unit: UnitState, catalog: Catalog): number =>
  Math.max(fieldOf(unit, catalog), unit.mark === 'shielded' ? markShield(unit) : 0);

/**
 * What a unit stands behind as a turn of its own begins. A barrier lasts until then; a shielded elite raises a
 * new one there. A core's field is whole again while any barrier stands; one that finds nothing standing was
 * broken, stays down for this round, and is whole at the turn after.
 */
function raiseBarrier(state: BattleState, unit: UnitState, catalog: Catalog): void {
  const field = fieldOf(unit, catalog);
  const broken = field > 0 && unit.barrier <= 0 && !unit.fieldDown;
  if (unit.fieldDown) state.events.push({ type: 'fieldUp', unit: unit.id });
  if (broken) unit.fieldDown = true;
  else delete unit.fieldDown;
  unit.barrier = Math.max(broken ? 0 : field, unit.mark === 'shielded' ? markShield(unit) : 0);
}

function createEnemy(def: EnemyDef, id: string, name: string, slot: number, scale: number, catalog: Catalog, mark?: EnemyMark): UnitState {
  const abilities = def.abilities ?? {};
  const unit = createUnit(id, name, 'enemy', def.build, catalog, {
    ai: def.ai, sprite: def.sprite, composed: def.composed ?? false, kind: def.id, slot, abilities, phases: def.phases ?? [],
    ...(def.paint ? { paint: def.paint } : {}),
    ...(def.partNames ? { partNames: def.partNames } : {}),
    ...(def.portrait ? { portrait: def.portrait } : {}),
    ...(abilities.bomb ? { fuse: abilities.bomb.fuse } : {}),
    ...(abilities.carrier ? { launchIn: abilities.carrier.every } : {}),
    ...(mark ? { mark } : {}),
    // (A list of its own: what is done to the unit is not done to the definition it was made from.)
    ...(def.hardened?.length ? { hardened: [...def.hardened] } : {}),
  }, {
    damage: scale * (mark === 'overclocked' ? MARK.damage : 1), toughness: scale,
    armour: (def.plating ?? 0) + (mark === 'armoured' ? MARK.armour : 0), ...(mark === 'swift' ? { evasion: MARK.evasion } : {}),
    ...(def.tune ? { tune: def.tune } : {}),
  });
  unit.barrier = standingBarrier(unit, catalog);
  return unit;
}

const isAlive = (part: PartState | undefined): boolean => !!part && part.ap > 0;
const findUnit = (state: BattleState, id: string): UnitState | undefined => state.units.find((u) => u.id === id);
const standing = (state: BattleState, side: UnitState['side']): UnitState[] => state.units.filter((u) => u.side === side && !u.destroyed);

/**
 * True of a machine a fight is about: one with phases to go through (a boss), with a name and a
 * face, one that commands the others, one given the mark of an elite, or the one the objective
 * names. Asked of what a battle is made from, once, as it is made: a machine still to come carries
 * no mark and no objective names it.
 */
export function leads(def: EnemyDef, mark?: EnemyMark, named = false): boolean {
  return (def.phases?.length ?? 0) > 0 || !!def.portrait || !!def.leader || !!mark || named;
}

/**
 * True of a machine that is one of many: an enemy in an open battle, whether it stood there from
 * the start or joined later. What a pilot outguns happens to these and to nobody else.
 */
export function ordinary(state: BattleState, unit: UnitState): boolean {
  return state.open && unit.side === 'enemy';
}

/**
 * They break, in an open battle: every machine still standing against `by` loses its nerve. It
 * stands until its own turn comes and leaves then; a machine already shaken is not shaken again.
 */
function shake(state: BattleState, by: UnitState): void {
  for (const other of state.units) {
    if (other.side === by.side || other.destroyed || other.shaken) continue;
    other.shaken = true;
    state.events.push({ type: 'shaken', unit: other.id });
  }
}

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

/** How hard a unit is to hit on this ground: where the footing is bad, a boost carries it less far. */
function evasionOn(state: BattleState, unit: UnitState, catalog: Catalog): number {
  const plain = evasion(unit, catalog);
  if (!unit.boosted || plain === 0 || !state.ground?.thrust) return plain;
  const thrust = boostProfile(unit.build, catalog).thrust;
  return plain - thrust + Math.max(0, thrust + state.ground.thrust);
}

/** Heat a unit sheds on this ground at the end of its turn, and with the cool action. */
export const coolingOn = (state: BattleState, unit: UnitState, catalog: Catalog): number =>
  Math.max(0, coolingOf(unit, catalog) + (state.ground?.cooling ?? 0));

/** The heat a machine of this build may carry before it overheats: its core's own limit, or the usual one. */
export const heatLimitOf = (build: Build, catalog: Catalog): number => framePart(build, 'core', catalog)?.heatLimit ?? HEAT_LIMIT;
/** The share of a turn's energy, in a hundred, that a machine of this build keeps from one turn for the next. */
export const bufferOf = (build: Build, catalog: Catalog): number => framePart(build, 'core', catalog)?.buffer ?? 0;
/** The round in which a unit takes its next turn: this one if its turn is still to come. */
export function nextTurnRound(state: BattleState, unit: UnitState): number {
  const at = state.order.indexOf(unit.id);
  return at >= 0 && at >= state.turn ? state.round : state.round + 1;
}
/** The most energy a unit's buffer can keep from one turn to the next: its share of what a turn gives the unit. */
export const bufferRoom = (unit: UnitState, catalog: Catalog): number => Math.floor((turnEnergyOf(unit, catalog) * unit.buffer) / 100);

export const turnEnergyOf = (unit: UnitState, catalog: Catalog): number =>
  computeBuildStats(unit.build, catalog).turnEnergy + unit.mods.energy
  + tunedOutput(generatorOf(unit.build, catalog), stepOf(unit.mods.tune, unit.build.generator));
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
  // A field that is empty is not a battle that is won while there are machines still to come.
  if (standing(state, 'enemy').length === 0 && state.reserve.length === 0) setOutcome(state, 'victory');
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
    // On cover they hold their fire: what they do for the pilot then is in every shot the enemy takes.
    const foes = state.support.order === 'cover' ? [] : standing(state, 'enemy').filter((u) => u !== spared);
    if (foes.length > 0) {
      const strongest = foes.reduce((a, b) => (b.parts.core!.ap > a.parts.core!.ap ? b : a));
      // Told to follow the pilot, they fire at whatever the pilot fired at last, while it stands.
      const target = (state.support.order === 'target' && foes.find((u) => u.id === state.focus)) || strongest;
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
  arrive(state, catalog);
  state.order = roundOrder(state, catalog);
  state.turn = 0;
  return true;
}

/** A bomb goes off: the player takes the blast and the bomb is gone. */
function detonate(state: BattleState, unit: UnitState, catalog: Catalog): void {
  const player = findUnit(state, 'player')!;
  // A bomb is a blast like any other: where the ground dampens blasts, it dampens this one.
  const amount = unit.abilities.bomb!.damage * unit.mods.damage * (state.ground?.damage?.explosive ?? 1);
  const event: Extract<BattleEvent, { type: 'blast' }> = { type: 'blast', unit: unit.id, target: player.id, damage: 0 };
  state.events.push(event);
  event.damage = strike(state, player, amount, amount, catalog);
  addDrive(player, DRIVE_GAIN.blast);
  damagePart(state, unit, 'core', unit.parts.core!.ap);
  checkOutcome(state);
}

/** A carrier counts down and, when its time has come and there is room on the field, launches a unit. */
function launch(state: BattleState, unit: UnitState, catalog: Catalog): void {
  const { unit: def, every } = unit.abilities.carrier!;
  unit.launchIn = Math.max(0, (unit.launchIn ?? every) - 1);
  if (unit.launchIn > 0 || standing(state, 'enemy').length >= MAX_ENEMIES) return;
  const id = join(state, def, catalog);
  unit.launchIn = every;
  state.events.push({ type: 'launch', unit: unit.id, spawned: id });
}

/**
 * Puts a machine on the field in the first place that is free, with the next number and, where it is
 * `lettered`, the next letter of its kind. There has to be room. Returns its id.
 */
function join(state: BattleState, def: EnemyDef, catalog: Catalog, lettered = true): string {
  const enemies = standing(state, 'enemy');
  const slot = Array.from({ length: MAX_ENEMIES }, (_, i) => i).find((i) => !enemies.some((u) => u.slot === i)) ?? 0;
  const sameKind = state.units.filter((u) => u.kind === def.id).length;
  const id = `enemy-${state.units.length - 1}`;
  state.units.push(createEnemy(def, id, lettered ? `${def.name} ${String.fromCharCode(65 + sameKind)}` : def.name, slot, state.enemyScale, catalog));
  return id;
}

/** The reserve comes on: as many as there is room for, in order. Called as a round begins, after what stood has been counted. */
function arrive(state: BattleState, catalog: Catalog): void {
  while (state.reserve.length > 0 && standing(state, 'enemy').length < MAX_ENEMIES) {
    const def = state.reserve.shift()!;
    // It has a letter where the battle has, had or will have another of its kind: as those on the field were named.
    const several = state.units.some((u) => u.kind === def.id) || state.reserve.some((other) => other.id === def.id);
    const id = join(state, def, catalog, several);
    state.events.push({ type: 'arrive', unit: id, left: state.reserve.length });
  }
}

/** Starts turns until a unit can actually act (overheated units lose theirs), or the battle ends. */
function beginTurns(state: BattleState, catalog: Catalog): void {
  while (state.outcome === 'ongoing') {
    if (state.turn >= state.order.length && !beginRound(state, catalog)) return;
    const unit = activeUnit(state);
    if (unit.destroyed) { state.turn += 1; continue; }
    // A shaken machine does not take its turn: it breaks off, with whatever it carried, and is gone.
    // The turn passes over it from here on as it does over a wreck.
    if (unit.shaken) {
      unit.destroyed = true;
      state.events.push({ type: 'rout', unit: unit.id, ...(currentMobility(unit, catalog) > 0 ? {} : { fixed: true as const }) });
      checkOutcome(state);
      continue;
    }
    // What lasted "until the unit's next turn" ends here, whether or not the turn is then lost.
    unit.boosted = false;
    unit.guarding = false;
    unit.ironSkin = false;
    unit.deadeye = false;
    raiseBarrier(state, unit, catalog);
    unit.chaff = 0;
    if (unit.painted > 0) unit.painted -= 1;
    // What was fired in the turn before has been fired one more turn in a row; what was not begins again.
    unit.spool = Object.fromEntries(unit.spun.map((slot) => [slot, (unit.spool[slot] ?? 0) + 1]));
    unit.spun = [];
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
    // What a buffer kept is on top of the turn's own energy: a drain and a stagger take from the turn, not from it.
    const kept = unit.kept;
    unit.kept = 0;
    unit.energy = (unit.staggered > 0 ? Math.floor(energy * STAGGER_ENERGY) : energy) + kept;
    unit.turnEnergy = unit.energy;
    unit.energyDebt = 0;
    unit.usedBoost = false;
    unit.usedGuard = false;
    unit.usedCool = false;
    unit.usedModule = false;
    unit.fired = [];
    unit.chain = 0;
    state.events.push({ type: 'turnStart', unit: unit.id, ...(kept > 0 ? { kept } : {}) });
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
  unit.heat = Math.max(0, unit.heat - coolingOn(state, unit, catalog));
  // A core with a buffer keeps what the turn did not spend, as far as it holds.
  unit.kept = Math.min(unit.energy, bufferRoom(unit, catalog));
  unit.damageBoost = 1;
  unit.deadeye = false;
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
  /** Field repairs left; absent when the mech arrives with its full count. */
  repairsLeft?: number;
  /** How far the Overdrive's meter had filled; absent when it starts empty. */
  drive?: number;
  destroyed: boolean;
}

/** The player's condition at the end of a battle, to start the next one with. */
export function carryFrom(state: BattleState): Carry {
  const player = state.units[0];
  const ap: Carry['ap'] = {};
  for (const slot of FRAME_SLOTS) if (player.parts[slot]) ap[slot] = player.parts[slot]!.ap;
  return {
    ap, heat: player.heat, ammo: { ...player.ammo }, restocked: { ...player.restocked }, repairsLeft: player.repairsLeft,
    ...(player.drive > 0 ? { drive: player.drive } : {}),
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
  if (typeof carry.repairsLeft === 'number') unit.repairsLeft = carry.repairsLeft;
  // The meter is only carried by a mech that has an Overdrive to spend it on.
  if (unit.overdrive && typeof carry.drive === 'number') unit.drive = Math.max(0, Math.min(DRIVE_MAX, carry.drive));
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
  const playerUnit = createUnit('player', 'You', 'player', player, catalog, opts.overdrive ? { overdrive: opts.overdrive } : {}, opts.mods);
  if (playerUnit.overdrive && opts.drive !== undefined) playerUnit.drive = Math.max(0, Math.min(DRIVE_MAX, opts.drive));
  if (opts.carry) applyCarry(playerUnit, opts.carry);
  const enemyScale = opts.enemyScale ?? 1;
  // (An action is applied to a copy of the battle, so what comes on leaves the copy's list and never the one given here.)
  const reserve = opts.reserve ?? [];
  // A machine has a letter where there is another of its kind, on the field or still to come: the one that comes
  // on later takes the next letter, and is not "B" beside one that has none.
  const all = [...enemies, ...reserve];
  const units = [playerUnit, ...enemies.map((e, i) => createEnemy(e, `enemy-${i}`, enemyName(all, i), i, enemyScale, catalog, opts.marks?.[i]))];
  const named = (i: number): boolean => 'target' in objective && objective.target === i;
  const state: BattleState = {
    units, round: 1, order: [], turn: 0, rng: seed | 0, events: [], outcome: 'ongoing', objective, enemyScale,
    open: !opts.closed && all.length > 1 && !enemies.some((def, i) => leads(def, opts.marks?.[i], named(i))) && !reserve.some((def) => leads(def)),
    reserve,
    ...(objective.type === 'protect' ? { asset: { name: objective.name, hp: objective.hp, maxHp: objective.hp, ...(objective.sprite ? { sprite: objective.sprite } : {}) } } : {}),
    ...(opts.support ? { support: { ...opts.support } } : {}),
    ...(opts.ground ? { ground: opts.ground } : {}),
  };
  state.order = roundOrder(state, catalog);
  beginTurns(state, catalog);
  return state;
}

/** How many times one pull of the trigger fires at a target, of a weapon as it is sold: a spool that has not wound up at all. */
export function shotsOf(weapon: Weapon): number {
  if (weapon.trait === 'twin') return 2;
  if (weapon.trait === 'burst') return Math.max(1, weapon.traitPower ?? 1);
  if (weapon.trait === 'spool') return SPOOL_BASE;
  return 1;
}

/** How many times one pull fires as the unit stands: of a spool, one more for every turn in a row it has been fired, as far as it winds. */
export function shotsNow(unit: UnitState, slot: WeaponSlot, weapon: Weapon): number {
  if (weapon.trait !== 'spool') return shotsOf(weapon);
  return SPOOL_BASE + Math.min(weapon.traitPower ?? 0, unit.spool[slot] ?? 0);
}

/**
 * What a weapon's kind makes of its damage, as a factor, by how its own machine stands and who it is fired at: a
 * redline by its machine's heat, a surge by the energy it takes (`taken` once it has taken it; all there is, before),
 * a punish by whether the target is off balance. One for any other weapon.
 */
function kindLift(attacker: UnitState, weapon: Weapon, target?: UnitState, taken?: number): number {
  switch (weapon.trait) {
    case 'redline': return 1 + (Math.min(attacker.heat, attacker.heatLimit) * (weapon.traitPower ?? 0)) / 1000;
    case 'surge': return (taken ?? attacker.energy) / SURGE_UNIT;
    case 'punish': return target && target.staggered > 0 ? 1 + (weapon.traitPower ?? 0) / 100 : 1;
    default: return 1;
  }
}

/**
 * Where a fork's bolt goes on to from the machine it hit: the next one along the line of the other side that still
 * stands, round to the first again. Nobody when no other does. The line is the order the targets are gone through in.
 */
export function forkTarget(state: BattleState, attackerId: string, targetId: string): UnitState | undefined {
  const attacker = findUnit(state, attackerId);
  if (!attacker) return undefined;
  const line = state.units.filter((u) => u.side !== attacker.side);
  const from = line.findIndex((u) => u.id === targetId);
  if (from < 0) return undefined;
  for (let step = 1; step < line.length; step++) {
    const next = line[(from + step) % line.length];
    if (!next.destroyed) return next;
  }
  return undefined;
}

/**
 * What firing a weapon would take and fire as its unit stands now, for whoever has to say so before the trigger is
 * pulled. `energy` is what it would take: of a surge, all there is, and the least it asks when there is not that.
 * `shots` is what one pull would fire. `lift` is what the weapon's kind makes of its damage by how its own machine
 * stands, in a hundred: a redline's heat, a surge's energy; a hundred where it makes nothing of it. (What a punish
 * does depends on who it is fired at, and is in the preview of that shot.)
 */
export function weaponNow(state: BattleState, unitId: string, slot: WeaponSlot, catalog: Catalog): { energy: number; shots: number; lift: number } {
  const unit = findUnit(state, unitId);
  const weapon = unit && weaponIn(unit.build, slot, catalog);
  if (!unit || !weapon) throw new Error('weaponNow: no such unit or weapon');
  const energy = weapon.trait === 'surge' ? Math.max(weapon.energy, unit.energy) : weapon.energy;
  return { energy, shots: shotsNow(unit, slot, weapon), lift: Math.round(kindLift(unit, weapon, undefined, energy) * 100) };
}

export interface ShotPreview {
  hitChance: number;
  /** Damage of one hit, before any barrier. Of a hit that shatters: the barrier and all that is left of the core, if that is more. */
  damage: number;
  /** True when one hit would shatter the machine: see `SHATTER`. */
  shatter: boolean;
  /** True when one hit would destroy the machine, by shattering it or by being enough: what the aiming line promises. */
  kills: boolean;
  /** Shots fired at the target. */
  shots: number;
  /** True when every other living enemy is fired at as well. */
  salvo: boolean;
  /** The unit a hit would leap on to, of a fork with another machine to leap on to: see `forkTarget`. */
  fork?: string;
}

export function previewShot(
  state: BattleState, attackerId: string, slot: WeaponSlot, targetId: string, part: FrameSlot, catalog: Catalog,
): ShotPreview {
  const attacker = findUnit(state, attackerId);
  const target = findUnit(state, targetId);
  const weapon = attacker && weaponIn(attacker.build, slot, catalog);
  if (!attacker || !target || !weapon || !framePart(target.build, part, catalog)) throw new Error('previewShot: no such attacker, weapon, target or part');
  const { hitChance, damage, shatter, kills, shots, salvo } = shotOn(state, attacker, slot, weapon, target, part, catalog);
  const next = weapon.trait === 'fork' ? forkTarget(state, attackerId, targetId) : undefined;
  return { hitChance, damage, shatter, kills, shots, salvo, ...(next ? { fork: next.id } : {}) };
}

/**
 * What one shot is worth as things stand: what the aiming line is told, and what firing then does. `taken` is the
 * energy a surge took to fire it, once it has been taken. `share` is what a fork's bolt keeps of the weapon's
 * damage and push when it has leapt on: all of it, of any other shot. Beyond the preview it says what the
 * weapon's kind made of the damage, in a hundred (`lift`), and how hard a hit pushes (`push`).
 */
function shotOn(
  state: BattleState, attacker: UnitState, slot: WeaponSlot, weapon: Weapon, target: UnitState, part: FrameSlot, catalog: Catalog,
  taken?: number, share = 1,
): ShotPreview & { lift: number; push: number } {
  const targetPart = framePart(target.build, part, catalog)!;

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
  aim += (state.ground?.aim?.all ?? 0) + (state.ground?.aim?.[weapon.damageType] ?? 0);

  const limb = Math.round(PART_MODIFIER[part] * (1 - (fcs?.focus ?? 0)));
  const raw = weapon.accuracy + aim - evasionOn(state, target, catalog) - target.chaff + limb - headPenalty;

  const resist = targetPart.resist[weapon.damageType] * (weapon.trait === 'pierce' ? 0.5 : 1);
  const lift = kindLift(attacker, weapon, target, taken);
  let amount = weapon.damage * lift * share * tuneFactor(attacker.mods.tune, weapon.id) * (1 - resist) * attacker.mods.damage * attacker.damageBoost
    * aegisFactor(state, target) * (state.ground?.damage?.[weapon.damageType] ?? 1) * (hardenedAgainst(target, weapon) ? HARDENED : 1);
  if (target.side === 'player' && state.support?.order === 'cover') amount *= 1 - coverShare(state.support);
  if (attacker.deadeye) amount *= DEADEYE_DAMAGE;
  if (target.ironSkin) amount *= IRON_SKIN;
  if (target.staggered > 0) amount *= STAGGER_DAMAGE;
  if (target.guarding) amount *= guardFactor(target, catalog);
  const full = Math.max(1, Math.round(amount));
  // A part that is already destroyed passes half the damage on to the core.
  const passesOn = target.parts[part]!.ap <= 0;
  const dealt = passesOn ? Math.max(1, Math.floor(full / 2)) : full;
  const core = target.parts.core!;
  const atCore = (part === 'core' || passesOn) && core.ap > 0;
  // A barrier takes a hit before the armour does. What gets past it to the core of an ordinary machine,
  // as one blow of half that core's full strength or more, goes through the machine.
  const arrives = dealt - target.barrier;
  const shatter = atCore && arrives >= SHATTER * core.maxAp && ordinary(state, target);
  return {
    // A shot under Deadeye does not miss; any other is never surer than 95 in 100 nor wilder than 10.
    hitChance: attacker.deadeye ? 100 : Math.min(95, Math.max(10, raw)),
    damage: shatter ? Math.max(dealt, core.ap + target.barrier) : dealt,
    shatter,
    // (Not of the one a contract wants driven off: no hit destroys that machine.)
    kills: atCore && !spared(state, target) && (shatter || arrives >= core.ap),
    shots: shotsNow(attacker, slot, weapon),
    salvo: weapon.trait === 'salvo',
    lift: Math.round(lift * 100),
    // A surge pushes as much harder as it hits.
    push: impactOf(weapon) * (weapon.trait === 'surge' ? lift : 1) * share,
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
    case 'overdrive':
      if (!unit.overdrive) return 'noOverdrive';
      if (unit.drive < DRIVE_MAX) return 'notCharged';
      // Second Wind gives a turn back: with nothing of this one spent yet there is nothing to give, and the meter is not thrown away.
      return unit.overdrive === 'second-wind' && !turnSpent(unit) ? 'nothingSpent' : null;
    case 'order':
      if (unit.side !== 'player' || !state.support?.orders) return 'noWingman';
      return (state.support.order ?? 'strongest') === action.order ? 'alreadyUsed' : null;
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

/** True of the pilot a contract wants driven off: they break away before the blow that would finish them, and their core keeps a point. */
function spared(state: BattleState, target: UnitState): boolean {
  return state.objective.type === 'driveOff' && objectiveTarget(state)?.id === target.id;
}

function damagePart(state: BattleState, target: UnitState, slot: FrameSlot, amount: number, overkill = false): void {
  const part = target.parts[slot]!;
  const before = part.ap;
  part.ap = Math.max(slot === 'core' && spared(state, target) ? Math.min(1, before) : 0, part.ap - amount);
  if (before > 0 && part.ap === 0) {
    state.events.push({ type: 'partDestroyed', unit: target.id, part: slot });
    // Without arms the hand weapons are finished, and whatever charge they held goes with them.
    if (slot === 'arms') target.charged = target.charged.filter((charged) => !HAND_SLOTS.includes(charged));
  }
  if (slot === 'core' && part.ap === 0 && !target.destroyed) {
    target.destroyed = true;
    state.events.push({ type: 'unitDestroyed', unit: target.id, ...(overkill ? { overkill: true as const } : {}) });
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
  if (target.destroyed || target.staggered > 0 || amount <= 0 || target.ironSkin) return;
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

  // A surge takes all the energy there is, and its shots are worth what it took; any other weapon takes what it asks.
  const taken = weapon.trait === 'surge' ? unit.energy : weapon.energy;
  // What one pull fires is settled before it is pulled: a spool winds up by turns, not by shots.
  const pulls = shotsNow(unit, action.weapon, weapon);
  if (weapon.charge) unit.charged = unit.charged.filter((slot) => slot !== action.weapon);
  else unit.energy -= taken;
  unit.fired.push(action.weapon);
  unit.spun.push(action.weapon);
  const ammo = unit.ammo[action.weapon];
  if (typeof ammo === 'number') unit.ammo[action.weapon] = ammo - 1;

  // A salvo fires at every living enemy: the chosen one first, at the chosen part, the rest at the core.
  const others = weapon.trait === 'salvo'
    ? state.units.filter((u) => u.side !== unit.side && !u.destroyed && u.id !== primary.id)
    : [];
  // What the volley does for the meters: once for landing at all, once for each unit it landed on, and for each kill.
  const struck = new Set<UnitState>();
  // Momentum, in an open battle: a volley that destroys something pays for itself. The weapon is ready again and
  // the energy it took comes back, once, however many it destroys; each one is a link in the turn's chain.
  // The heat and the round stay spent, so a run ends in an overheat or an empty magazine if nothing
  // else stops it; and a weapon that was charged has to be charged again. (Of a surge, what comes back is the
  // least it asks, not all it took: the great shot of a turn is its first.)
  let repaid = false;
  const chainBefore = unit.chain;
  // Who is fired at, in order, and at what. `via` marks what has leapt on from a fork's hit: a bolt for a share
  // of the weapon's damage, which is not rolled for.
  const aims: { target: UnitState; part: FrameSlot; share: number; via?: string }[] =
    [{ target: primary, part: action.part, share: 1 }, ...others.map((target) => ({ target, part: 'core' as const, share: 1 }))];
  for (let at = 0; at < aims.length; at++) {
    const { target, part: aimed, share, via } = aims[at];
    // Each shot is rolled and previewed on its own, because an earlier one may have destroyed
    // the part (or the target) the next was aimed at.
    for (let i = 0; i < pulls && !target.destroyed; i++) {
      const { hitChance, damage, shatter, lift, push } = shotOn(state, unit, action.weapon, weapon, target, aimed, catalog, taken, share);
      let hit = true;
      if (!via) {
        let value: number;
        if (roll) value = roll();
        else ({ value, state: state.rng } = nextRandom(state.rng));
        hit = value * 100 < hitChance;
      }
      const appliedTo: FrameSlot = target.parts[aimed]!.ap > 0 ? aimed : 'core';
      const absorbed = hit ? Math.min(target.barrier, damage) : 0;
      state.events.push({
        type: 'shot', unit: unit.id, weapon: action.weapon, target: target.id, part: aimed, appliedTo, hit,
        damage: hit ? damage - absorbed : 0, ...(absorbed > 0 ? { absorbed } : {}), ...(hit && shatter ? { shatter: true as const } : {}),
        ...(via ? { via } : {}), ...(hit && lift !== 100 ? { lift } : {}),
      });
      if (!hit) continue;
      struck.add(target);
      // What the blow did past any barrier, against the core at full strength: an overkill, if it is the end of the machine.
      // (A shattering takes all that is left of a core and no more, so it is never one for that alone.) It is a
      // thing the pilot does: of the pilot's own end it is not said.
      const overkill = target.side === 'enemy' && damage - absorbed >= OVERKILL * target.parts.core!.maxAp;
      target.barrier -= absorbed;
      fieldBroken(state, target, absorbed, catalog);
      if (damage > absorbed) damagePart(state, target, appliedTo, damage - absorbed, overkill);
      if (weapon.trait === 'thermal') heatUp(state, target, weapon.traitPower ?? 0);
      if (weapon.trait === 'drain') target.energyDebt += weapon.traitPower ?? 0;
      addImpact(state, target, Math.round(push * (target.guarding ? GUARD_IMPACT : 1)));
      checkPhases(state, target, catalog);
      if (target.destroyed && state.open) {
        unit.chain += 1;
        if (!repaid) {
          repaid = true;
          unit.fired = unit.fired.filter((slot) => slot !== action.weapon);
          if (!weapon.charge) unit.energy += weapon.energy;
        }
      }
      // A fork's hit goes on to the next machine along the line, from where the one it hit stands (or stood).
      if (weapon.trait === 'fork' && !via) {
        const next = forkTarget(state, unit.id, target.id);
        if (next) aims.push({ target: next, part: 'core', share: (weapon.traitPower ?? 0) / 100, via: target.id });
      }
      // The objective may be met (or lost) by this very shot: the rest of the volley stays in the barrel.
      checkOutcome(state);
      if (state.outcome !== 'ongoing') break;
    }
    if (state.outcome !== 'ongoing') break;
  }
  // Said once, when the whole of the volley has landed, however many it destroyed, and only while the battle
  // goes on: the volley that ends a battle readies the weapon for nothing.
  if (unit.chain > chainBefore && state.outcome === 'ongoing') {
    // The second of a turn is seen by whatever still stands against the one who did it: what the same volley
    // went on to destroy saw nothing.
    if (chainBefore < 2 && unit.chain >= 2) shake(state, unit);
    state.events.push({ type: 'momentum', unit: unit.id, weapon: action.weapon, chain: unit.chain });
  }

  if (struck.size > 0) addDrive(unit, DRIVE_GAIN.landed);
  for (const target of struck) {
    addDrive(target, DRIVE_GAIN.taken);
    if (target.destroyed) addDrive(unit, DRIVE_GAIN.kill);
  }
  // Closing in to strike is what the boost was spent on: the mech ends up in the enemy's face, not dodging.
  // Arms with the poise for it strike once and are gone again: the boost is theirs still, until a second blade
  // follows the first in the same turn. (A blade that a kill readied again is not one that is spent.)
  if (weapon.melee && !(framePart(unit.build, 'arms', catalog)?.poise && bladesSpent(unit, catalog) <= 1)) unit.boosted = false;
  heatUp(state, unit, weapon.heat);
  checkOutcome(state);
}

/**
 * True once the unit has done something this turn that a turn started over would give back: fired
 * or charged a weapon, taken a stance, vented, or used a module that has a use left to take again.
 * A module costs no energy, so one whose last use is gone is nothing to give back.
 */
export const turnSpent = (unit: UnitState): boolean =>
  unit.fired.length > 0 || unit.usedBoost || unit.usedGuard || unit.usedCool || (unit.usedModule && unit.moduleUses > 0);

/** Fills a unit's Overdrive meter, if it has an Overdrive at all. */
function addDrive(unit: UnitState, amount: number): void {
  if (unit.overdrive && !unit.destroyed) unit.drive = Math.min(DRIVE_MAX, unit.drive + amount);
}

/** Adds heat; passing the unit's limit marks it overheated, which costs it its next turn. */
function heatUp(state: BattleState, unit: UnitState, amount: number): void {
  unit.heat += amount;
  if (unit.heat > unit.heatLimit && !unit.overheated && !unit.destroyed) {
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
  if (target.ironSkin) amount *= IRON_SKIN;
  const dealt = Math.max(1, Math.round(amount));
  const absorbed = Math.min(target.barrier, dealt);
  target.barrier -= absorbed;
  fieldBroken(state, target, absorbed, catalog);
  if (dealt > absorbed) damagePart(state, target, 'core', dealt - absorbed);
  addImpact(state, target, Math.round(impact * (target.guarding ? GUARD_IMPACT : 1)));
  checkPhases(state, target, catalog);
  return dealt - absorbed;
}

/** Runs a module's effect and returns what it amounted to, for the event; a pulse's damage is written on the event itself. */
function useModule(
  state: BattleState, unit: UnitState, module: Module, targetId: string | undefined, catalog: Catalog,
  event: Extract<BattleEvent, { type: 'module' }>,
): number {
  const { power } = module;
  switch (module.effect) {
    case 'coolant': {
      const amount = Math.min(unit.heat, power);
      unit.heat -= amount;
      return amount;
    }
    case 'barrier':
      // In place of whatever stands, unless that is more: a pulse does not take a stronger field down.
      unit.barrier = Math.max(unit.barrier, power);
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
    case 'shock': {
      event.damage = 0;
      const struck = state.units.filter((u) => u.side !== unit.side && !u.destroyed);
      for (const enemy of struck) event.damage += strike(state, enemy, SHOCK_DAMAGE, power, catalog);
      // A pulse that lands is a volley that lands, and what it destroys counts like anything else destroyed.
      if (struck.length > 0) addDrive(unit, DRIVE_GAIN.landed);
      for (const enemy of struck) if (enemy.destroyed) addDrive(unit, DRIVE_GAIN.kill);
      return power;
    }
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
      // The wingman who follows the pilot's fire is told where it went.
      if (unit.side === 'player') state.focus = action.target;
      resolveFire(state, action, catalog, roll);
      break;
    case 'overdrive': {
      const kind = unit.overdrive!;
      unit.drive = 0;
      state.events.push({ type: 'overdrive', unit: unit.id, kind });
      if (kind === 'iron-skin') unit.ironSkin = true;
      else if (kind === 'deadeye') unit.deadeye = true;
      else {
        // The turn starts over: the energy this turn began with comes back (never less than there is
        // now, and never what was drained before the turn began), and what can be done once a turn can
        // be done again. The heat is still there. A stance that is still up stays up and stays the one
        // stance of the turn: it is not paid for twice, and a boost is not joined by a guard.
        unit.energy = Math.max(unit.energy, unit.turnEnergy);
        unit.fired = [];
        unit.usedBoost = unit.boosted;
        unit.usedGuard = unit.guarding;
        unit.usedCool = false;
        unit.usedModule = false;
      }
      break;
    }
    case 'order':
      state.support!.order = action.order;
      state.events.push({ type: 'order', name: state.support!.name, order: action.order });
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
      const amount = Math.min(unit.heat, coolingOn(state, unit, catalog));
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
      event.amount = useModule(state, unit, module, action.target, catalog, event);
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
      state.retreated = true;
      setOutcome(state, 'defeat');
      break;
  }
  return state;
}
