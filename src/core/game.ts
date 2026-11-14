import type { Build, Catalog, Part } from './types';

export const SAVE_VERSION = 6;
export const STARTING_CREDITS = 1200;

/** Everything about a player's progress that is kept between battles and saved. */
export interface GameState {
  version: number;
  credits: number;
  /** How many copies of each part the player owns, fitted ones included. */
  inventory: Record<string, number>;
  build: Build;
  battlesWon: number;
  /** Ids of the story contracts completed, in order. */
  completed: string[];
  /** Ids of the messages read. */
  read: string[];
  /** Whether the ending has been shown; it is shown once, on the first visit to the hub after the finale. */
  endingSeen: boolean;
  /** Pilot experience; the level follows from it. */
  xp: number;
  /** Ranks bought per perk id. */
  perks: Record<string, number>;
  /** Arena opponents beaten, in order. */
  arenaRank: number;
  /** How many times the campaign has been finished and started again. */
  cycle: number;
  settings: Settings;
  /** The paint scheme of the mech: `factory`, or the id of a scheme. */
  paint: string;
  /** Saved builds, one per slot; an empty slot is null. */
  loadouts: (Build | null)[];
}

export const FACTORY_PAINT = 'factory';
export const LOADOUT_SLOTS = 3;

/** How tough enemies are: `story` for the tale, `veteran` for a fight. */
export type Difficulty = 'story' | 'standard' | 'veteran';
export const DIFFICULTIES: Difficulty[] = ['story', 'standard', 'veteran'];
/** What each difficulty multiplies enemy armour and damage by. */
export const DIFFICULTY_SCALE: Record<Difficulty, number> = { story: 0.8, standard: 1, veteran: 1.2 };

export interface Settings { sfx: boolean; music: boolean; fastBattles: boolean; difficulty: Difficulty }
/** No perk has more ranks than this; a save claiming more is not a real save. */
export const MAX_PERK_RANK = 3;
export const DEFAULT_SETTINGS: Settings = { sfx: true, music: true, fastBattles: false, difficulty: 'standard' };

export type BuildSlot = keyof Build;
export const BUILD_SLOTS: BuildSlot[] = [
  'head', 'core', 'arms', 'legs', 'generator', 'booster', 'fcs', 'module', 'rightHand', 'leftHand', 'shoulder',
];
const REQUIRED: BuildSlot[] = ['head', 'core', 'arms', 'legs', 'generator', 'booster', 'fcs'];
/** Slots that may be left empty. */
export const OPTIONAL_SLOTS: BuildSlot[] = BUILD_SLOTS.filter((slot) => !REQUIRED.includes(slot));

/** Looks a part up by id. Names every object has, such as `constructor`, are not parts. */
export function partOf(catalog: Catalog, id: string): Part | undefined {
  return Object.hasOwn(catalog, id) ? catalog[id] : undefined;
}

/** Copies of a part the player owns. */
export function ownedCount(state: GameState, partId: string): number {
  return Object.hasOwn(state.inventory, partId) ? state.inventory[partId] : 0;
}

export type TradeRefusal = 'notForSale' | 'cannotAfford' | 'notOwned' | 'equipped' | 'lastWeapon';
export type EquipRefusal = 'notOwned' | 'wrongSlot' | 'noSpare' | 'required';

/** Whether a part may go in a slot: weapons by mount, shields in the left hand, everything else by kind. */
export function fits(part: Part, slot: BuildSlot): boolean {
  if (part.kind === 'weapon') return slot === 'shoulder' ? part.mount === 'shoulder' : (slot === 'rightHand' || slot === 'leftHand') && part.mount === 'hand';
  if (part.kind === 'shield') return slot === 'leftHand';
  return part.kind === slot;
}

/** A fresh game: the starter build's parts are owned, one copy each. */
export function newGame(catalog: Catalog, starter: Build): GameState {
  const inventory: Record<string, number> = {};
  for (const id of Object.values(starter)) {
    if (!partOf(catalog, id)) throw new Error(`starter part missing from catalogue: ${id}`);
    inventory[id] = (inventory[id] ?? 0) + 1;
  }
  return {
    version: SAVE_VERSION, credits: STARTING_CREDITS, inventory, build: { ...starter }, battlesWon: 0, completed: [], read: [], endingSeen: false,
    xp: 0, perks: {}, arenaRank: 0, cycle: 0, settings: { ...DEFAULT_SETTINGS },
    paint: FACTORY_PAINT, loadouts: Array.from({ length: LOADOUT_SLOTS }, () => null),
  };
}

export function setPaint(state: GameState, paint: string): GameState {
  return { ...state, paint };
}

export type LoadoutRefusal = 'unknown' | 'empty' | 'missingPart';
const isSlot = (index: number): boolean => Number.isInteger(index) && index >= 0 && index < LOADOUT_SLOTS;
const withLoadout = (state: GameState, index: number, build: Build | null): GameState =>
  ({ ...state, loadouts: state.loadouts.map((saved, i) => (i === index ? build : saved)) });

/** Keeps a copy of the current build in a slot, replacing what was there. */
export function saveLoadout(state: GameState, index: number): GameState {
  if (!isSlot(index)) throw new Error('illegal loadout: unknown');
  return withLoadout(state, index, { ...state.build });
}

export function clearLoadout(state: GameState, index: number): GameState {
  if (!isSlot(index)) throw new Error('illegal loadout: unknown');
  return withLoadout(state, index, null);
}

/**
 * Whether a saved build can be fitted now. Fitting it frees every part of the current build, so
 * all that matters is that enough copies of each of its parts are still owned.
 */
export function checkLoadout(state: GameState, index: number, catalog: Catalog): { refusal: LoadoutRefusal; part?: string } | null {
  if (!isSlot(index)) return { refusal: 'unknown' };
  const build = state.loadouts[index];
  if (!build) return { refusal: 'empty' };
  const needed: Record<string, number> = {};
  for (const slot of BUILD_SLOTS) {
    const id = build[slot];
    if (id === undefined) continue;
    needed[id] = (needed[id] ?? 0) + 1;
    const part = partOf(catalog, id);
    if (!part || !fits(part, slot) || needed[id] > ownedCount(state, id)) return { refusal: 'missingPart', part: id };
  }
  return null;
}

export function loadLoadout(state: GameState, index: number, catalog: Catalog): GameState {
  const refused = checkLoadout(state, index, catalog);
  if (refused) throw new Error(`illegal loadout: ${refused.refusal}`);
  return { ...state, build: { ...state.loadouts[index]! } };
}

export function equippedCount(state: GameState, partId: string): number {
  return Object.values(state.build).filter((id) => id === partId).length;
}

/** Copies owned but not fitted. */
export function spareCount(state: GameState, partId: string): number {
  return ownedCount(state, partId) - equippedCount(state, partId);
}

export function checkBuy(state: GameState, partId: string, catalog: Catalog): TradeRefusal | null {
  const part = partOf(catalog, partId);
  if (!part || !part.vendor) return 'notForSale';
  return state.credits < part.price ? 'cannotAfford' : null;
}

export function buy(state: GameState, partId: string, catalog: Catalog): GameState {
  const refusal = checkBuy(state, partId, catalog);
  if (refusal) throw new Error(`illegal trade: ${refusal}`);
  return {
    ...state,
    credits: state.credits - catalog[partId].price,
    inventory: { ...state.inventory, [partId]: ownedCount(state, partId) + 1 },
  };
}

export function checkSell(state: GameState, partId: string, catalog: Catalog): TradeRefusal | null {
  if (!partOf(catalog, partId) || ownedCount(state, partId) <= 0) return 'notOwned';
  if (spareCount(state, partId) <= 0) return 'equipped';
  // A pilot without any weapon and without the money for one could never work again.
  return partOf(catalog, partId)!.kind === 'weapon' && weaponsOwned(state, catalog) <= 1 ? 'lastWeapon' : null;
}

/** How many weapons the pilot owns in total, fitted or not. */
export function weaponsOwned(state: GameState, catalog: Catalog): number {
  return Object.entries(state.inventory).reduce((sum, [id, count]) => sum + (partOf(catalog, id)?.kind === 'weapon' ? count : 0), 0);
}

/** Issues a pilot who owns no weapon at all the given one, free. The state is returned unchanged otherwise. */
export function ensureArmed(state: GameState, catalog: Catalog, weaponId: string): GameState {
  if (weaponsOwned(state, catalog) > 0 || partOf(catalog, weaponId)?.kind !== 'weapon') return state;
  return { ...state, inventory: { ...state.inventory, [weaponId]: 1 } };
}

/** Selling returns the full price, so trying parts out costs nothing. */
export function sell(state: GameState, partId: string, catalog: Catalog): GameState {
  const refusal = checkSell(state, partId, catalog);
  if (refusal) throw new Error(`illegal trade: ${refusal}`);
  const inventory = { ...state.inventory };
  if (inventory[partId] > 1) inventory[partId] -= 1;
  else delete inventory[partId];
  return { ...state, credits: state.credits + catalog[partId].price, inventory };
}

export function checkEquip(state: GameState, slot: BuildSlot, partId: string | null, catalog: Catalog): EquipRefusal | null {
  if (partId === null) return REQUIRED.includes(slot) ? 'required' : null;
  const part = partOf(catalog, partId);
  if (!part || ownedCount(state, partId) <= 0) return 'notOwned';
  if (!fits(part, slot)) return 'wrongSlot';
  if (state.build[slot] === partId) return null; // already there
  return spareCount(state, partId) <= 0 ? 'noSpare' : null;
}

export function equip(state: GameState, slot: BuildSlot, partId: string | null, catalog: Catalog): GameState {
  const refusal = checkEquip(state, slot, partId, catalog);
  if (refusal) throw new Error(`illegal equip: ${refusal}`);
  const build = { ...state.build };
  if (partId === null) delete build[slot];
  else build[slot] = partId;
  return { ...state, build };
}

const isWholeNonNegative = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
const isTextList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
/** More copies than this of one part is not something play can produce. */
const MAX_COPIES = 999;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Checks data read from storage before the game trusts it. Limits such as weight are not checked:
 * an overweight build is a legitimate state that the garage reports.
 */
export function isValidState(value: unknown, catalog: Catalog): value is GameState {
  if (!isRecord(value) || value.version !== SAVE_VERSION) return false;
  if (typeof value.credits !== 'number' || !Number.isSafeInteger(value.credits)) return false;
  if (!isTextList(value.completed) || !isTextList(value.read) || typeof value.endingSeen !== 'boolean') return false;
  if (!isWholeNonNegative(value.battlesWon)) return false;
  if (!isWholeNonNegative(value.xp) || !isWholeNonNegative(value.arenaRank) || !isWholeNonNegative(value.cycle)) return false;
  if (value.arenaRank > 99 || value.cycle > 99) return false;
  const { perks, settings } = value;
  if (!isRecord(perks) || !Object.values(perks).every((rank) => isWholeNonNegative(rank) && rank <= MAX_PERK_RANK)) return false;
  if (!isRecord(settings) || !['sfx', 'music', 'fastBattles'].every((key) => typeof settings[key] === 'boolean')) return false;
  if (!DIFFICULTIES.includes(settings.difficulty as Difficulty)) return false;
  const { inventory, build, paint, loadouts } = value;
  if (!isRecord(inventory) || !isRecord(build)) return false;
  // The scheme itself is the screen's business; here it only has to be a plain short word.
  if (typeof paint !== 'string' || !/^[a-z]{1,24}$/.test(paint)) return false;
  if (!Array.isArray(loadouts) || loadouts.length !== LOADOUT_SLOTS) return false;
  for (const saved of loadouts) {
    if (saved === null) continue;
    if (!isRecord(saved)) return false;
    // A saved build may name parts that have since been sold (loading it is then refused),
    // but every part must be one a player can own, in a slot it fits.
    for (const [slot, id] of Object.entries(saved)) {
      if (!BUILD_SLOTS.includes(slot as BuildSlot) || typeof id !== 'string') return false;
      const part = partOf(catalog, id);
      if (!part?.vendor || !fits(part, slot as BuildSlot)) return false;
    }
  }

  for (const [id, count] of Object.entries(inventory)) {
    if (!partOf(catalog, id)?.vendor || !isWholeNonNegative(count) || count > MAX_COPIES) return false;
  }
  const fitted: Record<string, number> = {};
  for (const [slot, id] of Object.entries(build)) {
    if (!BUILD_SLOTS.includes(slot as BuildSlot) || typeof id !== 'string') return false;
    const part = partOf(catalog, id);
    if (!part || !fits(part, slot as BuildSlot)) return false;
    fitted[id] = (fitted[id] ?? 0) + 1;
    if (fitted[id] > (Object.hasOwn(inventory, id) ? (inventory[id] as number) : 0)) return false;
  }
  return REQUIRED.every((slot) => Object.hasOwn(build, slot) && typeof build[slot] === 'string');
}
