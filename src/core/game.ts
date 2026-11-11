import type { Build, Catalog, Part } from './types';

export const SAVE_VERSION = 1;
export const STARTING_CREDITS = 1200;

/** Everything about a player's progress that is kept between battles and saved. */
export interface GameState {
  version: number;
  credits: number;
  /** How many copies of each part the player owns, fitted ones included. */
  inventory: Record<string, number>;
  build: Build;
  battlesWon: number;
}

export type BuildSlot = keyof Build;
export const BUILD_SLOTS: BuildSlot[] = ['head', 'core', 'arms', 'legs', 'generator', 'rightHand', 'leftHand', 'shoulder'];
const REQUIRED: BuildSlot[] = ['head', 'core', 'arms', 'legs', 'generator'];

export type TradeRefusal = 'notForSale' | 'cannotAfford' | 'notOwned' | 'equipped';
export type EquipRefusal = 'notOwned' | 'wrongSlot' | 'noSpare' | 'required';

/** Whether a part may go in a slot: frame parts and generators by kind, weapons by mount. */
export function fits(part: Part, slot: BuildSlot): boolean {
  if (part.kind === 'weapon') return slot === 'shoulder' ? part.mount === 'shoulder' : (slot === 'rightHand' || slot === 'leftHand') && part.mount === 'hand';
  return part.kind === slot;
}

/** A fresh game: the starter build's parts are owned, one copy each. */
export function newGame(catalog: Catalog, starter: Build): GameState {
  const inventory: Record<string, number> = {};
  for (const id of Object.values(starter)) {
    if (!catalog[id]) throw new Error(`starter part missing from catalogue: ${id}`);
    inventory[id] = (inventory[id] ?? 0) + 1;
  }
  return { version: SAVE_VERSION, credits: STARTING_CREDITS, inventory, build: { ...starter }, battlesWon: 0 };
}

export function equippedCount(state: GameState, partId: string): number {
  return Object.values(state.build).filter((id) => id === partId).length;
}

/** Copies owned but not fitted. */
export function spareCount(state: GameState, partId: string): number {
  return (state.inventory[partId] ?? 0) - equippedCount(state, partId);
}

export function checkBuy(state: GameState, partId: string, catalog: Catalog): TradeRefusal | null {
  const part = catalog[partId];
  if (!part || !part.vendor) return 'notForSale';
  return state.credits < part.price ? 'cannotAfford' : null;
}

export function buy(state: GameState, partId: string, catalog: Catalog): GameState {
  const refusal = checkBuy(state, partId, catalog);
  if (refusal) throw new Error(`illegal trade: ${refusal}`);
  return {
    ...state,
    credits: state.credits - catalog[partId].price,
    inventory: { ...state.inventory, [partId]: (state.inventory[partId] ?? 0) + 1 },
  };
}

export function checkSell(state: GameState, partId: string, catalog: Catalog): TradeRefusal | null {
  if (!catalog[partId] || (state.inventory[partId] ?? 0) <= 0) return 'notOwned';
  return spareCount(state, partId) <= 0 ? 'equipped' : null;
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
  const part = catalog[partId];
  if (!part || (state.inventory[partId] ?? 0) <= 0) return 'notOwned';
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

const isWholeNonNegative = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Checks data read from storage before the game trusts it. Limits such as weight are not checked:
 * an overweight build is a legitimate state that the garage reports.
 */
export function isValidState(value: unknown, catalog: Catalog): value is GameState {
  if (!isRecord(value) || value.version !== SAVE_VERSION) return false;
  if (typeof value.credits !== 'number' || !Number.isFinite(value.credits)) return false;
  if (!isWholeNonNegative(value.battlesWon)) return false;
  const { inventory, build } = value;
  if (!isRecord(inventory) || !isRecord(build)) return false;

  for (const [id, count] of Object.entries(inventory)) {
    if (!catalog[id]?.vendor || !isWholeNonNegative(count)) return false;
  }
  const fitted: Record<string, number> = {};
  for (const [slot, id] of Object.entries(build)) {
    if (!BUILD_SLOTS.includes(slot as BuildSlot) || typeof id !== 'string') return false;
    const part = catalog[id];
    if (!part || !fits(part, slot as BuildSlot)) return false;
    fitted[id] = (fitted[id] ?? 0) + 1;
    if (fitted[id] > ((inventory[id] as number | undefined) ?? 0)) return false;
  }
  return REQUIRED.every((slot) => typeof build[slot] === 'string');
}
