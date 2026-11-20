import { DRIVE_MAX, carryFrom, type BattleState, type Carry, type EnemyMark, type OverdriveId, type UnitMods } from './battle';
import { Dice, ENEMY_COST, MAX_BUDGET, marksFor, rollEnemies } from './board';
import { validatePlayerBuild } from './build';
import type { Mission } from './campaign';
import { BUILD_SLOTS, fits, type BuildSlot } from './game';
import { FRAME_SLOTS, type Build, type Catalog, type Part } from './types';

/**
 * The Gauntlet: a run of battles that goes on until the pilot falls. It is flown in a stock frame,
 * not the pilot's own, and after every floor one of the things on offer is taken: a part, fitted
 * at once; a full service; or a boon that lasts the run. An open floor has two doors, and behind
 * one of them there is sometimes an elite: harder, and one more on offer after it. Every fifth
 * floor is a warden's, and a warden beaten leaves a relic, which bends a rule for the rest of the
 * run. Everything about a run follows from its seed and what was taken, so the same run can be
 * played twice.
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
  /** Set while a floor is being fought. A game closed then finds the run fallen: closing is not a way out. */
  fighting?: boolean;
  /** The best there was when the run began, to say at its end whether it set a new one. */
  bestBefore?: number;
  /** The door taken into the floor being fought. Absent between floors, and on a run from before there were doors. */
  door?: number;
  /** The relics held, in the order they were taken. */
  relics?: RelicId[];
  /** Set between a warden beaten and a relic taken: the relic comes before the draft. */
  relicOwed?: boolean;
  /** Set when the floor entered has an elite on it, and kept once it is won until the draft is taken: that draft has one more on offer. */
  elite?: boolean;
  /** Set when the Spare Core has just brought the run back, until the floor is entered again. */
  revived?: boolean;
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
/** How often one boon can be taken in a run: past this it is no longer offered, so what the enemy gains with depth is not outrun for ever. */
export const BOON_CAP = 5;

/**
 * What a warden leaves behind. Each bends one rule for the rest of the run:
 * redline: the frame has an Overdrive (Second Wind), and its meter goes from floor to floor.
 * rig: twice as much armour is patched between floors.
 * key: one more thing on offer after every floor.
 * spare: once, a floor lost is fought again in a whole mech; then it is spent.
 * cannon: more damage dealt, thinner armour.
 * ledger: the run pays half as much again.
 */
export type RelicId = 'redline' | 'rig' | 'key' | 'spare' | 'cannon' | 'ledger';
export const RELIC_IDS: RelicId[] = ['redline', 'rig', 'key', 'spare', 'cannon', 'ledger'];
export const RELIC_OVERDRIVE: OverdriveId = 'second-wind';
export const RIG_PATCH = 0.6;
export const CANNON = { damage: 1.3, armour: -0.15 } as const;
export const LEDGER_PAY = 1.5;

export const hasRelic = (run: Run, relic: RelicId): boolean => (run.relics ?? []).includes(relic);

export type Offer =
  | { kind: 'part'; slot: BuildSlot; part: string }
  | { kind: 'service' }
  | { kind: 'boon'; boon: BoonId };

/**
 * Every fifth floor is somebody with a name, or something very large. They come round again, harder.
 * The first two are the Gauntlet's own machines: nobody from the story is met down here before floor 15.
 */
export const WARDENS = ['scrap-king', 'night-train', 'rival', 'sable', 'rook', 'krell', 'strip-miner', 'overseer', 'leviathan', 'ashfall-unbound'];
export const WARDEN_EVERY = 5;
/** Share of the missing armour of every part that is patched between floors. */
export const GAUNTLET_PATCH = 0.3;

/** Elites are met from this floor on, behind one of the two doors of this share of the open floors. */
export const ELITE_FROM = 3;
export const ELITE_CHANCE = 0.4;

export const isGauntlet = (mission: Mission): boolean => mission.id.startsWith('gauntlet-');
export const isWardenFloor = (floor: number): boolean => floor % WARDEN_EVERY === 0;

export function startRun(seed: number, starter: Build, bestBefore = 0): Run {
  return { seed: seed | 0, floor: 1, build: { ...starter }, carry: null, boons: {}, drafting: false, fighting: false, bestBefore };
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

/** One way into a floor: who is behind it, where, how hard they hit, and which of them is an elite. */
export interface Door {
  enemies: string[];
  background: string;
  scale: number;
  /** The elite behind this door: its place among the enemies and the mark it carries. */
  elite?: { at: number; mark: EnemyMark };
}

const sameCrowd = (a: string[], b: string[]): boolean => [...a].sort().join() === [...b].sort().join();

/**
 * The ways into the floor the run is on: one for a warden's floor, two for any other. The two lead
 * to different machines on different ground, and now and then one of them to an elite.
 */
export function doors(run: Run, backgrounds: string[]): Door[] {
  // Open floors go round the places in order; wardens go round them on their own count, so that
  // every fifth floor is not always the same ground.
  const turn = isWardenFloor(run.floor) ? run.floor / WARDEN_EVERY : run.floor - 1;
  const background = backgrounds[turn % backgrounds.length];
  if (isWardenFloor(run.floor)) {
    const round = run.floor / WARDEN_EVERY - 1;
    // Wardens are met a little weaker than the story fields them: the frame is whatever the run has made of it.
    return [{ enemies: [WARDENS[round % WARDENS.length]], background, scale: Math.round((0.42 + 0.12 * round) * 100) / 100 }];
  }
  const scale = floorScale(run.floor);
  const budget = floorBudget(run.floor);
  const first = rollEnemies(diceFor(run, 1), budget);
  // The other door: rolled again until it is not the same crowd, as far as a few tries go.
  let second = first;
  for (let salt = 5; salt < 9 && sameCrowd(second, first); salt++) second = rollEnemies(diceFor(run, salt), budget);
  const found: Door[] = [
    { enemies: first, background, scale },
    { enemies: second, background: backgrounds[(turn + 2) % backgrounds.length], scale },
  ];
  const dice = diceFor(run, 4);
  if (run.floor >= ELITE_FROM && dice.roll(100) < ELITE_CHANCE * 100) {
    const door = found[dice.roll(2)];
    // The mark goes to the dearest machine behind the door, the first of them when two cost the same.
    let at = 0;
    door.enemies.forEach((id, i) => { if ((ENEMY_COST[id] ?? 0) > (ENEMY_COST[door.enemies[at]] ?? 0)) at = i; });
    // One that changes something about it: a turret is never swift.
    door.elite = { at, mark: dice.pick(marksFor(door.enemies[at])) };
  }
  return found;
}

/** The door the run has taken, or the first while none has been. */
export function doorOf(run: Run, backgrounds: string[]): Door {
  const found = doors(run, backgrounds);
  return found[run.door ?? 0] ?? found[0];
}

/** The floor the run is on, in the shape of a contract, so it is briefed and fought like one. It pays nothing by itself. */
export function floorMission(run: Run, text: GauntletText, names: Record<string, string>): Mission {
  const door = doorOf(run, text.backgrounds);
  const warden = isWardenFloor(run.floor) ? door.enemies[0] : null;
  const briefing = warden ? [text.floor(run.floor), text.warden(names[warden] ?? warden)] : [text.floor(run.floor)];
  return {
    id: `gauntlet-${run.floor}`, phase: 'patrol', title: text.title(run.floor), client: text.client, briefing, debrief: text.debrief,
    reward: 0, battles: [{ enemies: door.enemies, background: door.background, ...(door.elite ? { marks: { [door.elite.at]: door.elite.mark } } : {}) }],
    scale: door.scale, loaner: run.build,
  };
}

/** Everything the boons taken add up to, and what the Glass Cannon does on top. */
export function runMods(run: Run): Partial<UnitMods> {
  const mods: Record<string, number> = {};
  for (const id of BOON_IDS) {
    const count = run.boons[id] ?? 0;
    if (count === 0) continue;
    for (const [key, value] of Object.entries(BOONS[id])) mods[key] = (mods[key] ?? 0) + (value as number) * count;
  }
  if (hasRelic(run, 'cannon')) {
    mods.damage = CANNON.damage;
    // Thinner by a share of the plain armour, whatever plating has been taken.
    mods.armour = Math.round(((mods.armour ?? 0) + CANNON.armour) * 100) / 100;
  }
  return mods as Partial<UnitMods>;
}

/** The Overdrive the run's frame has: none without the relic `redline` (the Drive Core, as the screen calls it). */
export const runOverdrive = (run: Run): OverdriveId | undefined => (hasRelic(run, 'redline') ? RELIC_OVERDRIVE : undefined);

/** How worn the mech is: the share of its armour that is gone, from 0 to 1. Fresh when nothing is carried. */
export function wear(run: Run, catalog: Catalog): number {
  if (!run.carry) return 0;
  let max = 0;
  let left = 0;
  // Plating raises what whole means: wear is measured against the plated armour, as the battle does.
  const plated = 1 + (runMods(run).armour ?? 0);
  for (const slot of FRAME_SLOTS) {
    const part = catalog[run.build[slot] ?? ''];
    if (!part || !('ap' in part)) continue;
    const whole = Math.round(part.ap * plated);
    max += whole;
    left += Math.min(whole, run.carry.ap[slot] ?? whole);
  }
  return max > 0 ? 1 - left / max : 0;
}

/** Parts the run may be offered on this floor: for sale somewhere and not built to order, not too dear for how deep it is, and not what is already fitted. */
function partOffers(run: Run, catalog: Catalog): { slot: BuildSlot; part: string }[] {
  const ceiling = 900 + run.floor * 550;
  // The cheap end drops out as the run goes deeper, but never so far that nothing is left to offer.
  const floor = Math.min(2000, Math.max(0, ceiling - 4500));
  const price = (id: string | undefined): number => (id ? (catalog[id] as Part | undefined)?.price ?? 0 : -1);
  const offers: { slot: BuildSlot; part: string }[] = [];
  for (const part of Object.values(catalog) as Part[]) {
    if (!part.vendor || ('bespoke' in part && part.bespoke) || part.price > ceiling || part.price < floor) continue;
    // Nothing the frame already carries, in whichever hand.
    if (Object.values(run.build).includes(part.id)) continue;
    // Where it would go: an empty mount first, else the mount holding the cheaper thing. So a weapon for the hand fills the empty hand.
    const slots = BUILD_SLOTS.filter((slot) => fits(part, slot)).sort((a, b) => price(run.build[a]) - price(run.build[b]));
    const slot = slots.find((s) => validatePlayerBuild({ ...run.build, [s]: part.id }, catalog).length === 0);
    if (slot) offers.push({ slot, part: part.id });
  }
  return offers.sort((a, b) => (a.part < b.part ? -1 : 1));
}

/** How many things are on offer after the floor just won: three, one more after an elite, one more with the Quartermaster's Key. */
export const draftSize = (run: Run): number => 3 + (run.elite ? 1 : 0) + (hasRelic(run, 'key') ? 1 : 0);

/**
 * What is on offer after the floor just won, always different things. Two parts when there are
 * parts to offer, and a full service once the mech is worn; boons that can still be taken fill the
 * rest, and more parts after them when the boons run out. A frame near its limits has few mounts
 * that anything still fits: then a second thing for a mount is offered rather than nothing, and
 * after that a service the mech hardly needs. So there is always something to take.
 */
export function draft(run: Run, catalog: Catalog): Offer[] {
  const dice = diceFor(run, 2);
  const size = draftSize(run);
  const offers: Offer[] = [];
  const parts = partOffers(run, catalog);
  // What is set aside because its mount already has something on offer.
  const second: typeof parts = [];
  const part = (from: typeof parts): void => {
    const [picked] = from.splice(dice.roll(from.length), 1);
    // Not two things for the same slot: the choice should be between kinds of help.
    if (from === parts) for (let j = parts.length - 1; j >= 0; j--) if (parts[j].slot === picked.slot) second.unshift(...parts.splice(j, 1));
    offers.push({ kind: 'part', ...picked });
  };
  for (let i = 0; i < 2 && parts.length > 0; i++) part(parts);
  if (wear(run, catalog) >= 0.25) offers.push({ kind: 'service' });
  const boons = BOON_IDS.filter((id) => (run.boons[id] ?? 0) < BOON_CAP);
  while (offers.length < size && boons.length > 0) {
    const [boon] = boons.splice(dice.roll(boons.length), 1);
    offers.push({ kind: 'boon', boon });
  }
  while (offers.length < size && parts.length > 0) part(parts);
  while (offers.length < size && second.length > 0) part(second);
  if (offers.length < size && !offers.some((offer) => offer.kind === 'service')) offers.push({ kind: 'service' });
  return offers.slice(0, size);
}

/** The relics on offer after a warden: two of those the run does not hold, or what is left of them. */
export function relicOffers(run: Run): RelicId[] {
  const dice = diceFor(run, 3);
  const left = RELIC_IDS.filter((id) => !hasRelic(run, id));
  const offers: RelicId[] = [];
  while (offers.length < 2 && left.length > 0) offers.push(...left.splice(dice.roll(left.length), 1));
  return offers;
}

/** Takes one of the two relics a warden left. The draft that is owed comes after it. */
export function takeRelic(run: Run, relic: RelicId): Run {
  if (!run.relicOwed) throw new Error('no relic is owed');
  if (!relicOffers(run).includes(relic)) throw new Error('that relic is not on offer');
  return { ...run, relicOwed: false, relics: [...(run.relics ?? []), relic] };
}

/**
 * The mech after a full service: whole, cool and loaded, so there is nothing to carry. Only the
 * meter of an Overdrive is kept: it is the pilot's, not the mech's.
 */
const serviced = (carry: Carry | null): Carry | null =>
  (carry?.drive ? { ap: {}, heat: 0, ammo: {}, restocked: {}, destroyed: false, drive: carry.drive } : null);

/** Takes one of the things on offer. A part goes on at once and is whole; a service makes everything whole. */
export function take(run: Run, offer: Offer, catalog: Catalog): Run {
  if (!run.drafting) throw new Error('nothing is on offer');
  if (run.relicOwed) throw new Error('a relic is owed first');
  if (!draft(run, catalog).some((o) => JSON.stringify(o) === JSON.stringify(offer))) throw new Error('that is not on offer');
  const next: Run = { ...run, drafting: false, elite: false };
  if (offer.kind === 'service') return { ...next, carry: serviced(run.carry) };
  if (offer.kind === 'boon') return { ...next, boons: { ...run.boons, [offer.boon]: (run.boons[offer.boon] ?? 0) + 1 } };
  const build = { ...run.build, [offer.slot]: offer.part };
  if (!run.carry) return { ...next, build };
  const carry: Carry = { ...run.carry, ap: { ...run.carry.ap }, ammo: { ...run.carry.ammo }, restocked: { ...run.carry.restocked } };
  // What is new is whole and loaded.
  if ((FRAME_SLOTS as string[]).includes(offer.slot)) delete carry.ap[offer.slot as keyof Carry['ap']];
  if (offer.slot === 'rightHand' || offer.slot === 'leftHand' || offer.slot === 'shoulder') { delete carry.ammo[offer.slot]; delete carry.restocked[offer.slot]; }
  return { ...next, build, carry };
}

/** Into the floor the run is on, by one of its doors. Written down before the first shot: a game closed on a floor finds the run fallen there. */
export function enter(run: Run, door: number, backgrounds: string[]): Run {
  if (run.drafting) throw new Error('a draft is owed first');
  const found = doors(run, backgrounds);
  if (!Number.isInteger(door) || door < 0 || door >= found.length) throw new Error('there is no such door');
  return { ...run, door, fighting: true, revived: false, elite: !!found[door].elite };
}

/** The run after a floor is won: one floor deeper, cooled, a little patched, and owed a draft (and, after a warden, a relic first). */
export function descend(run: Run, end: BattleState): Run {
  if (end.outcome !== 'victory') throw new Error('the floor was not won');
  const carry = carryFrom(end);
  const player = end.units[0];
  const patch = hasRelic(run, 'rig') ? RIG_PATCH : GAUNTLET_PATCH;
  for (const slot of FRAME_SLOTS) {
    const part = player.parts[slot];
    if (!part) continue;
    carry.ap[slot] = Math.min(part.maxAp, part.ap + Math.round((part.maxAp - part.ap) * patch));
  }
  carry.heat = 0;
  // Magazines are refilled and the field repairs restocked: the next floor is hard enough.
  carry.ammo = {};
  carry.restocked = {};
  delete carry.repairsLeft;
  const warden = isWardenFloor(run.floor);
  const next: Run = { ...run, floor: run.floor + 1, drafting: true, fighting: false, elite: !!run.elite, revived: false };
  delete next.door;
  // Beating a warden earns a full service on the house: the mech goes on whole, and with what the warden left.
  next.carry = warden ? serviced(carry) : carry;
  next.relicOwed = warden && relicOffers(next).length > 0;
  return next;
}

/**
 * What becomes of a run whose floor was lost or left: with a Spare Core it stands before the same
 * floor again in a whole mech, with the meter it came to the floor with, and the core is spent;
 * without one there is nothing, and the run is over.
 */
export function fall(run: Run): Run | null {
  if (!hasRelic(run, 'spare')) return null;
  const next: Run = { ...run, relics: (run.relics ?? []).filter((id) => id !== 'spare'), carry: serviced(run.carry), fighting: false, elite: false, revived: true };
  delete next.door;
  return next;
}

/** Floors cleared by a run that ended on, or was left at, this floor. */
export const floorsCleared = (run: Run): number => run.floor - 1;
/** What a run pays when it ends: more for every floor, and more the deeper the floor. */
export function payout(cleared: number): number {
  let total = 0;
  for (let floor = 1; floor <= cleared; floor++) total += 100 + 40 * floor;
  return total;
}
/** What this run would pay if it ended where it stands: half as much again with Hazard Pay. */
export const runPayout = (run: Run): number => Math.round(payout(floorsCleared(run)) * (hasRelic(run, 'ledger') ? LEDGER_PAY : 1));

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const whole = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;

/** Whether what a save holds is a run that can be flown on: anything else is dropped, never trusted. */
export function isValidRun(value: unknown, catalog: Catalog): value is Run {
  if (!isRecord(value) || typeof value.seed !== 'number' || !Number.isSafeInteger(value.seed)) return false;
  if (!whole(value.floor, 999) || value.floor < 1 || typeof value.drafting !== 'boolean') return false;
  if (value.fighting !== undefined && typeof value.fighting !== 'boolean') return false;
  if (value.bestBefore !== undefined && !whole(value.bestBefore, 999)) return false;
  if (value.door !== undefined && !whole(value.door, 1)) return false;
  for (const flag of ['relicOwed', 'elite', 'revived']) if (value[flag] !== undefined && typeof value[flag] !== 'boolean') return false;
  if (value.relics !== undefined) {
    const { relics } = value;
    if (!Array.isArray(relics) || !relics.every((id) => (RELIC_IDS as unknown[]).includes(id)) || new Set(relics).size !== relics.length) return false;
  }
  // A relic is owed only with a draft, on the floor after a warden's, and while there is one left to take:
  // anything else would be a relic for nothing, or a room with nothing in it to choose.
  if (value.relicOwed) {
    if (!value.drafting || value.floor < 2 || !isWardenFloor(value.floor - 1)) return false;
    if (Array.isArray(value.relics) && value.relics.length >= RELIC_IDS.length) return false;
  }
  // A door is held only while its floor is fought.
  if (value.door !== undefined && value.fighting !== true) return false;
  const { build, boons, carry } = value;
  if (!isRecord(build) || !Object.entries(build).every(([slot, id]) => BUILD_SLOTS.includes(slot as BuildSlot) && typeof id === 'string')) return false;
  if (validatePlayerBuild(build as unknown as Build, catalog).length > 0) return false;
  if (!Object.values(build).every((id) => !!(catalog[id as string] as Part | undefined)?.vendor)) return false;
  if (!isRecord(boons) || !Object.entries(boons).every(([id, n]) => (BOON_IDS as string[]).includes(id) && whole(n, 99))) return false;
  if (carry === null) return true;
  if (!isRecord(carry) || !isRecord(carry.ap) || !isRecord(carry.ammo) || !isRecord(carry.restocked)) return false;
  if (carry.destroyed !== false || (carry.repairsLeft !== undefined && !whole(carry.repairsLeft, 99)) || typeof carry.heat !== 'number' || !(carry.heat >= 0 && carry.heat <= 1000)) return false;
  if (carry.drive !== undefined && !whole(carry.drive, DRIVE_MAX)) return false;
  if (!Object.entries(carry.ap).every(([slot, ap]) => (FRAME_SLOTS as string[]).includes(slot) && whole(ap, 100000))) return false;
  // A mech with no core left is a wreck, whatever else the save says.
  if (carry.ap.core !== undefined && (carry.ap.core as number) < 1) return false;
  const slots = ['rightHand', 'leftHand', 'shoulder'];
  if (!Object.entries(carry.ammo).every(([slot, n]) => slots.includes(slot) && (n === null || whole(n, 100000)))) return false;
  return Object.entries(carry.restocked).every(([slot, n]) => slots.includes(slot) && whole(n, 100000));
}
