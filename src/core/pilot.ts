import { OVERDRIVES, type OverdriveId } from './battle';
import type { GameState } from './game';
import { stripePoints } from './stripes';

export const MAX_LEVEL = 20;

/** The level at which each Overdrive opens to a pilot. */
export const OVERDRIVE_LEVEL: Record<OverdriveId, number> = { 'second-wind': 3, 'iron-skin': 6, deadeye: 9 };
export const overdriveOpen = (game: GameState, id: OverdriveId): boolean => levelFor(game.xp) >= OVERDRIVE_LEVEL[id];
/**
 * The Overdrive the pilot flies with: the one they chose, while it is open to them; failing that the
 * first that is open, so that a pilot who never looks at the list still has one from the third level.
 */
export function fittedOverdrive(game: GameState): OverdriveId | undefined {
  if (game.overdrive && OVERDRIVES.includes(game.overdrive) && overdriveOpen(game, game.overdrive)) return game.overdrive;
  return OVERDRIVES.find((id) => overdriveOpen(game, id));
}

/** Total experience needed to be level `n`. */
export const xpForLevel = (n: number): number => 50 * (n - 1) * (n + 2);

export function levelFor(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level += 1;
  return level;
}

/** A won contract teaches a tenth of what it pays; a lost one teaches nothing that counts. */
export const xpForContract = (reward: number, won: boolean): number => (won ? Math.round(reward / 10) : 0);

export function addXp(state: GameState, amount: number): GameState {
  return { ...state, xp: Math.min(xpForLevel(MAX_LEVEL), state.xp + Math.max(0, amount)) };
}

/** What perks can change. All start at zero; `armour`, `payBonus` and `costDiscount` are fractions. */
export interface PerkEffects {
  aim: number;
  evasion: number;
  energy: number;
  cooling: number;
  repairs: number;
  armour: number;
  payBonus: number;
  costDiscount: number;
}
const NO_EFFECTS: PerkEffects = { aim: 0, evasion: 0, energy: 0, cooling: 0, repairs: 0, armour: 0, payBonus: 0, costDiscount: 0 };

export interface Perk {
  id: string;
  name: string;
  description: string;
  maxRank: number;
  /** What one rank adds. */
  perRank: Partial<PerkEffects>;
}

export type PerkRefusal = 'unknown' | 'maxed' | 'noPoints';

const rankOf = (state: GameState, perkId: string): number => (Object.hasOwn(state.perks, perkId) ? state.perks[perkId] : 0);

/** Points not yet spent: one per level above the first and one for every five stripes held (see stripes.ts), less the ranks bought. */
export function perkPoints(state: GameState, perks: Perk[]): number {
  const spent = perks.reduce((sum, perk) => sum + rankOf(state, perk.id), 0);
  return levelFor(state.xp) - 1 + stripePoints(state) - spent;
}

export function checkBuyPerk(state: GameState, perkId: string, perks: Perk[]): PerkRefusal | null {
  const perk = perks.find((p) => p.id === perkId);
  if (!perk) return 'unknown';
  if (rankOf(state, perkId) >= perk.maxRank) return 'maxed';
  return perkPoints(state, perks) <= 0 ? 'noPoints' : null;
}

export function buyPerk(state: GameState, perkId: string, perks: Perk[]): GameState {
  const refusal = checkBuyPerk(state, perkId, perks);
  if (refusal) throw new Error(`illegal perk: ${refusal}`);
  return { ...state, perks: { ...state.perks, [perkId]: rankOf(state, perkId) + 1 } };
}

/** The combined effect of the ranks held. Ranks of perks that no longer exist count for nothing. */
export function perkEffects(ranks: Record<string, number>, perks: Perk[]): PerkEffects {
  const total = { ...NO_EFFECTS };
  for (const perk of perks) {
    const rank = Math.min(perk.maxRank, Object.hasOwn(ranks, perk.id) ? ranks[perk.id] : 0);
    for (const [key, value] of Object.entries(perk.perRank)) total[key as keyof PerkEffects] += rank * value;
  }
  return total;
}
