export type DamageType = 'kinetic' | 'energy' | 'explosive';
export type FrameSlot = 'head' | 'core' | 'arms' | 'legs';
/** How a pair of legs moves. Each type but the plain biped changes a rule; see `LEG_TYPES` in build.ts. */
export type LegType = 'biped' | 'reverse' | 'quad' | 'tank' | 'hover';
export type WeaponSlot = 'rightHand' | 'leftHand' | 'shoulder';
/** Fraction of damage ignored per damage type, 0..0.6. */
export type Resist = Record<DamageType, number>;

/** Who sells a part. Enemy-only parts have no vendor and cannot be bought. */
export type Vendor = 'undertow' | 'lumen' | 'hadron' | 'freelance';

export interface FramePart {
  id: string;
  name: string;
  kind: FrameSlot;
  /** Armour points. */
  ap: number;
  resist: Resist;
  weight: number;
  /** Energy taken from the generator's output every turn. */
  drain: number;
  price: number;
  /** Hit-chance bonus: head for all weapons, arms for hand weapons. */
  aim?: number;
  /** Legs only: the weight the build may total. */
  capacity?: number;
  /** Legs only. */
  mobility?: number;
  /** Legs only; a plain biped when absent. */
  legType?: LegType;
  vendor?: Vendor;
}

/** Thrusters: how well and how cheaply a mech dodges. */
export interface Booster {
  id: string;
  name: string;
  kind: 'booster';
  /** Evasion gained while boosted. */
  thrust: number;
  /** Share of a turn's energy a boost costs, 0..1. */
  cost: number;
  weight: number;
  drain: number;
  price: number;
  vendor?: Vendor;
}

/** Fire control: hit chance per kind of weapon, and help with aiming at limbs. */
export interface Fcs {
  id: string;
  name: string;
  kind: 'fcs';
  aim: Record<DamageType, number>;
  /** Share of the penalty for aiming at a part other than the core that is removed, 0..1. */
  focus: number;
  weight: number;
  drain: number;
  price: number;
  vendor?: Vendor;
}

export type ModuleEffect = 'coolant' | 'barrier' | 'overclock' | 'painter' | 'nanites' | 'shock' | 'chaff' | 'limiter';

/** One piece of equipment with a button: used a few times a battle, at no energy cost. */
export interface Module {
  id: string;
  name: string;
  kind: 'module';
  effect: ModuleEffect;
  power: number;
  /** Activations per battle. */
  uses: number;
  weight: number;
  drain: number;
  price: number;
  vendor?: Vendor;
}

/** Carried in the left hand instead of a weapon: makes guarding stronger. */
export interface Shield {
  id: string;
  name: string;
  kind: 'shield';
  /** Share of the damage that still gets through while guarding. */
  guard: number;
  weight: number;
  price: number;
  vendor?: Vendor;
}

export interface Generator {
  id: string;
  name: string;
  kind: 'generator';
  output: number;
  /** Heat removed at the end of every turn. */
  cooling: number;
  weight: number;
  price: number;
  vendor?: Vendor;
}

export interface Weapon {
  id: string;
  name: string;
  kind: 'weapon';
  mount: 'hand' | 'shoulder';
  damageType: DamageType;
  damage: number;
  accuracy: number;
  /** Energy per shot. */
  energy: number;
  /** Heat per shot. */
  heat: number;
  /** Shots per mission; null means unlimited. */
  ammo: number | null;
  costPerShot: number;
  weight: number;
  price: number;
  vendor?: Vendor;
  /**
   * A special effect: `pierce` halves the target's resistance; `thermal` adds `traitPower` heat on a hit;
   * `drain` takes `traitPower` from the target's next turn of energy on a hit; `twin` fires two shots and
   * `burst` fires `traitPower` shots; `salvo` fires one shot at every enemy.
   */
  trait?: 'pierce' | 'thermal' | 'drain' | 'twin' | 'burst' | 'salvo';
  traitPower?: number;
  /** How hard a hit pushes the target off balance; derived from damage and type when absent. */
  impact?: number;
  /** Must be charged in one turn before it can be fired in a later one. */
  charge?: boolean;
  /** A blade or a ram: usable only in a turn in which the mech has boosted. */
  melee?: boolean;
}

export type Part = FramePart | Generator | Weapon | Booster | Fcs | Module | Shield;
export type Catalog = Record<string, Part>;

/** Part ids per slot. Player builds need every frame slot; enemies may leave head, arms or legs out. */
export interface Build {
  core: string;
  generator: string;
  head?: string;
  arms?: string;
  legs?: string;
  /** Players must fit a booster and an FCS; enemies without them use the stock values. */
  booster?: string;
  fcs?: string;
  module?: string;
  rightHand?: string;
  /** A hand weapon or a shield. */
  leftHand?: string;
  shoulder?: string;
}

export interface BuildStats {
  weight: number;
  capacity: number;
  /** weight / capacity. */
  load: number;
  mobility: number;
  /** Energy available each turn. */
  turnEnergy: number;
  /** How much impact the mech takes before it staggers. */
  stability: number;
}

export type BuildError = 'missingSlot' | 'overweight' | 'insufficientEnergy' | 'wrongMount' | 'unknownPart' | 'noWeapon';
export type AiProfile = 'gunner' | 'skirmisher' | 'bruiser' | 'sprayer';

export interface EnemyDef {
  id: string;
  name: string;
  build: Build;
  ai: AiProfile;
  /** The single image used when the enemy is one of several. */
  sprite: string;
  /** A mech that, when it fights alone, is drawn full size from the sprites of its parts. */
  composed?: boolean;
}

export const FRAME_SLOTS: FrameSlot[] = ['core', 'legs', 'arms', 'head'];
export const WEAPON_SLOTS: WeaponSlot[] = ['rightHand', 'leftHand', 'shoulder'];
