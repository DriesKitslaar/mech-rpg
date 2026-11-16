import { carryFrom, type BattleState, type Carry, type UnitMods } from './battle';
import { Dice, MAX_BUDGET, rollEnemies } from './board';
import { validatePlayerBuild } from './build';
import type { Mission } from './campaign';
import { BUILD_SLOTS, fits, type BuildSlot } from './game';
import { FRAME_SLOTS, type Build, type Catalog, type Part } from './types';

/**
 * The Gauntlet: a run of battles that goes on until the pilot falls. It is flown in a stock frame,
 * not the pilot's own, and after every floor one of three things on offer is taken: a part, fitted
 * at once; a full service; or a boon that lasts the run. Everything about a run follows from its
 * seed and what was taken, so the same run can be played twice.
 */
export interface Run {
  seed: number;
  /** The floor about to be fought, from 1. */
  floor: number;
  build: Build;
  /** What the mech arrives with: null on the first floor and after a full service. */
  carry: Carry | null;
  /** How many of each boon have been taken, by id. */
  boons: Record<string, number>;
  /** Set between a floor won and the draft taken: the pilot owes themselves a choice. */
  drafting: boolean;
}

export type BoonId = 'capacitor' | 'heatsinks' | 'plating' | 'optics' | 'patchkit';
/** What one of each boon adds for the rest of the run. */
export const BOONS: Record<BoonId, Partial<UnitMods>> = {
  capacitor: { energy: 15 },
  heatsinks: { cooling: 6 },
  plating: { armour: 0.08 },
  optics: { aim: 4 },
  patchkit: { repairs: 1 },
};
export const BOON_IDS = Object.keys(BOONS) as BoonId[];

export type Offer =
  | { kind: 'part'; slot: BuildSlot; part: string }
  | { kind: 'service' }
  | { kind: 'boon'; boon: BoonId };

/** Every fifth floor is somebody with a name, or something very large. They come round again, harder. */
export const WARDENS = ['rival', 'sable', 'rook', 'krell', 'strip-miner', 'overseer', 'leviathan', 'ashfall-unbound'];
export const WARDEN_EVERY = 5;
/** Share of the missing armour of every part that is patched between floors. */
export const GAUNTLET_PATCH = 0.3;

export const isGauntlet = (mission: Mission): boolean => mission.id.startsWith('gauntlet-');
export const isWardenFloor = (floor: number): boolean => floor % WARDEN_EVERY === 0;

export function startRun(seed: number, starter: Build): Run {
  return { seed: seed | 0, floor: 1, build: { ...starter }, carry: null, boons: {}, drafting: false };
}

const diceFor = (run: Run, salt: number): Dice => new Dice((Math.imul(run.seed, 31) + run.floor * 7919 + salt * 104729) | 0);

/** How much there is to fight on a floor, in the open contracts' own measure, and how hard it hits. */
export const floorBudget = (floor: number): number => Math.min(MAX_BUDGET + 2, 2 + Math.floor((floor - 1) * 0.6));
export const floorScale = (floor: number): number => Math.round((0.7 + 0.035 * (floor - 1)) * 100) / 100;

/** The words a floor is briefed with. */
export interface GauntletText {
  client: string;
  title: (floor: number) => string;
  floor: (floor: number) => string;
  warden: (name: string) => string;
  debrief: string;
  backgrounds: string[];
}

/** The floor the run is on, in the shape of a contract, so it is briefed and fought like one. It pays nothing by itself. */
export function floorMission(run: Run, text: GauntletText, names: Record<string, string>): Mission {
  const dice = diceFor(run, 1);
  const background = text.backgrounds[(run.floor - 1) % text.backgrounds.length];
  let enemies: string[];
  let briefing: string[];
  // Wardens are met a little weaker than the story fields them: the frame is whatever the run has made of it.
  let scale = floorScale(run.floor);
  if (isWardenFloor(run.floor)) {
    const round = run.floor / WARDEN_EVERY - 1;
    const warden = WARDENS[round % WARDENS.length];
    enemies = [warden];
    briefing = [text.floor(run.floor), text.warden(names[warden] ?? warden)];
    scale = Math.round((0.55 + 0.12 * round) * 100) / 100;
  } else {
    enemies = rollEnemies(dice, floorBudget(run.floor));
    briefing = [text.floor(run.floor)];
  }
  return {
    id: `gauntlet-${run.floor}`, phase: 'patrol', title: text.title(run.floor), client: text.client, briefing, debrief: text.debrief,
    reward: 0, battles: [{ enemies, background }], scale, loaner: run.build,
  };
}

/** Everything the boons taken add up to. */
export function runMods(run: Run): Partial<UnitMods> {
  const mods: Record<string, number> = {};
  for (const id of BOON_IDS) {
    const count = run.boons[id] ?? 0;
    if (count === 0) continue;
    for (const [key, value] of Object.entries(BOONS[id])) mods[key] = (mods[key] ?? 0) + (value as number) * count;
  }
  return mods as Partial<UnitMods>;
}

/** How worn the mech is: the share of its armour that is gone, from 0 to 1. Fresh when nothing is carried. */
export function wear(run: Run, catalog: Catalog): number {
  if (!run.carry) return 0;
  let max = 0;
  let left = 0;
  for (const slot of FRAME_SLOTS) {
    const part = catalog[run.build[slot] ?? ''];
    if (!part || !('ap' in part)) continue;
    max += part.ap;
    left += Math.min(part.ap, run.carry.ap[slot] ?? part.ap);
  }
  return max > 0 ? 1 - left / max : 0;
}

/** Parts the run may be offered on this floor: for sale somewhere, not too dear for how deep it is, and not what is already fitted. */
function partOffers(run: Run, catalog: Catalog): { slot: BuildSlot; part: string }[] {
  const ceiling = 900 + run.floor * 550;
  const floor = Math.max(0, ceiling - 4500);
  const offers: { slot: BuildSlot; part: string }[] = [];
  for (const part of Object.values(catalog) as Part[]) {
    if (!part.vendor || part.price > ceiling || part.price < floor) continue;
    for (const slot of BUILD_SLOTS) {
      if (!fits(part, slot) || run.build[slot] === part.id) continue;
      // A second copy of a hand weapon is not offered for the other hand, and nothing that would leave a mech that cannot deploy.
      if (Object.values(run.build).includes(part.id)) continue;
      if (validatePlayerBuild({ ...run.build, [slot]: part.id }, catalog).length > 0) continue;
      offers.push({ slot, part: part.id });
      break;
    }
  }
  return offers.sort((a, b) => (a.part < b.part ? -1 : 1));
}

/**
 * What is on offer after the floor just won: always three, always different. Two parts when there
 * are parts to offer, and a full service once the mech is worn; boons fill the rest.
 */
export function draft(run: Run, catalog: Catalog): Offer[] {
  const dice = diceFor(run, 2);
  const offers: Offer[] = [];
  const parts = partOffers(run, catalog);
  for (let i = 0; i < 2 && parts.length > 0; i++) {
    const [picked] = parts.splice(dice.roll(parts.length), 1);
    // Not two things for the same slot: the choice should be between kinds of help.
    for (let j = parts.length - 1; j >= 0; j--) if (parts[j].slot === picked.slot) parts.splice(j, 1);
    offers.push({ kind: 'part', ...picked });
  }
  if (wear(run, catalog) >= 0.25) offers.push({ kind: 'service' });
  const boons = [...BOON_IDS];
  while (offers.length < 3) {
    const [boon] = boons.splice(dice.roll(boons.length), 1);
    offers.push({ kind: 'boon', boon });
  }
  return offers.slice(0, 3);
}

/** Takes one of the things on offer. A part goes on at once and is whole; a service makes everything whole. */
export function take(run: Run, offer: Offer, catalog: Catalog): Run {
  if (!run.drafting) throw new Error('nothing is on offer');
  if (!draft(run, catalog).some((o) => JSON.stringify(o) === JSON.stringify(offer))) throw new Error('that is not on offer');
  const next: Run = { ...run, drafting: false };
  if (offer.kind === 'service') return { ...next, carry: null };
  if (offer.kind === 'boon') return { ...next, boons: { ...run.boons, [offer.boon]: (run.boons[offer.boon] ?? 0) + 1 } };
  const build = { ...run.build, [offer.slot]: offer.part };
  if (!run.carry) return { ...next, build };
  const carry: Carry = { ...run.carry, ap: { ...run.carry.ap }, ammo: { ...run.carry.ammo }, restocked: { ...run.carry.restocked } };
  // What is new is whole and loaded.
  if ((FRAME_SLOTS as string[]).includes(offer.slot)) delete carry.ap[offer.slot as keyof Carry['ap']];
  if (offer.slot === 'rightHand' || offer.slot === 'leftHand' || offer.slot === 'shoulder') { delete carry.ammo[offer.slot]; delete carry.restocked[offer.slot]; }
  return { ...next, build, carry };
}

/** The run after a floor is won: one floor deeper, cooled, a little patched, and owed a draft. */
export function descend(run: Run, end: BattleState): Run {
  if (end.outcome !== 'victory') throw new Error('the floor was not won');
  const carry = carryFrom(end);
  const player = end.units[0];
  for (const slot of FRAME_SLOTS) {
    const part = player.parts[slot];
    if (!part) continue;
    carry.ap[slot] = Math.min(part.maxAp, part.ap + Math.round((part.maxAp - part.ap) * GAUNTLET_PATCH));
  }
  carry.heat = 0;
  // Magazines are refilled and the field repairs restocked: the next floor is hard enough.
  carry.ammo = {};
  carry.restocked = {};
  carry.repairsLeft = player.repairsLeft;
  // Beating a warden earns a full service on the house: the mech goes on whole.
  return { ...run, floor: run.floor + 1, carry: isWardenFloor(run.floor) ? null : carry, drafting: true };
}

/** Floors cleared by a run that ended on, or was left at, this floor. */
export const floorsCleared = (run: Run): number => run.floor - 1;
/** What a run pays when it ends: more for every floor, and more the deeper the floor. */
export function payout(cleared: number): number {
  let total = 0;
  for (let floor = 1; floor <= cleared; floor++) total += 100 + 40 * floor;
  return total;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const whole = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;

/** Whether what a save holds is a run that can be flown on: anything else is dropped, never trusted. */
export function isValidRun(value: unknown, catalog: Catalog): value is Run {
  if (!isRecord(value) || typeof value.seed !== 'number' || !Number.isSafeInteger(value.seed)) return false;
  if (!whole(value.floor, 9999) || value.floor < 1 || typeof value.drafting !== 'boolean') return false;
  const { build, boons, carry } = value;
  if (!isRecord(build) || !Object.entries(build).every(([slot, id]) => BUILD_SLOTS.includes(slot as BuildSlot) && typeof id === 'string')) return false;
  if (validatePlayerBuild(build as unknown as Build, catalog).length > 0) return false;
  if (!Object.values(build).every((id) => !!(catalog[id as string] as Part | undefined)?.vendor)) return false;
  if (!isRecord(boons) || !Object.entries(boons).every(([id, n]) => (BOON_IDS as string[]).includes(id) && whole(n, 999))) return false;
  if (carry === null) return true;
  if (!isRecord(carry) || !isRecord(carry.ap) || !isRecord(carry.ammo) || !isRecord(carry.restocked)) return false;
  if (carry.destroyed !== false || !whole(carry.repairsLeft, 99) || typeof carry.heat !== 'number' || !(carry.heat >= 0 && carry.heat <= 1000)) return false;
  if (!Object.entries(carry.ap).every(([slot, ap]) => (FRAME_SLOTS as string[]).includes(slot) && whole(ap, 100000))) return false;
  const slots = ['rightHand', 'leftHand', 'shoulder'];
  if (!Object.entries(carry.ammo).every(([slot, n]) => slots.includes(slot) && (n === null || whole(n, 100000)))) return false;
  return Object.entries(carry.restocked).every(([slot, n]) => slots.includes(slot) && whole(n, 100000));
}
