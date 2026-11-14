export type DamageType = 'kinetic' | 'energy' | 'explosive';
export type FrameSlot = 'head' | 'core' | 'arms' | 'legs';
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
   * `drain` takes `traitPower` from the target's next turn of energy on a hit; `twin` fires two shots.
   */
  trait?: 'pierce' | 'thermal' | 'drain' | 'twin';
  traitPower?: number;
}

export type Part = FramePart | Generator | Weapon;
export type Catalog = Record<string, Part>;

/** Part ids per slot. Player builds need every frame slot; enemies may leave head, arms or legs out. */
export interface Build {
  core: string;
  generator: string;
  head?: string;
  arms?: string;
  legs?: string;
  rightHand?: string;
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
