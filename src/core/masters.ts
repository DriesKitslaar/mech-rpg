import { ARCHETYPES, CLASS_AI, type Archetype } from './archetype';
import { CHAMPION_RANK, asRematch, rematchPurse } from './arena';
import { ASK_BONUS } from './board';
import type { Mission } from './campaign';
import type { Settlement } from './economy';
import type { GameState } from './game';
import type { Build, EnemyDef } from './types';

/**
 * The masters: seven pilots who stand apart from the arena's ladder, each the master of one class of
 * machine. They take challenges from the champion. Any machine may challenge one, for a purse; a
 * pilot who beats a master in a machine of the master's own class takes that class's crown.
 */

/** What a master's duel pays the first time that master is beaten; a rematch's share of it after. */
export const MASTER_PURSE = 9000;

export interface Master {
  /** The class they are the master of: their machine is of it, and is flown as the game flies that class. */
  kind: Archetype;
  name: string;
  build: Build;
  /** The paint their machine wears. */
  paint: string;
  /** Multiplies their armour and their damage. */
  scale: number;
  /** Armour beyond what the parts give, as a share of them: a machine plated to last a duel hits no harder for it (see `EnemyDef.plating`). */
  plating?: number;
  /** A line about how they fight. */
  style: string;
  /** What they say before the duel. */
  taunt: string;
  /** What they say when the crown is taken from them. */
  concede: string;
}

const PREFIX = 'arena-master-';
/** The id of the duel with the master of a class, and of that master on the field. It begins as an arena fight's does: what holds for those by their id holds for it. */
export const masterId = (kind: Archetype): string => `${PREFIX}${kind}`;
/** The class whose master a duel's id names. Null for anything that is not such an id. */
export function parseMaster(id: string): Archetype | null {
  const kind = id.startsWith(PREFIX) ? id.slice(PREFIX.length) : '';
  return ARCHETYPES.find((known) => known === kind) ?? null;
}
export const isMaster = (mission: Pick<Mission, 'id'>): boolean => parseMaster(mission.id) !== null;

/** The masters take challenges from the champion of the ladder, and from nobody before. */
export const mastersOpen = (state: Pick<GameState, 'arenaRank'>): boolean => state.arenaRank >= CHAMPION_RANK;

type Kept = Pick<GameState, 'masters' | 'crowns' | 'rematches'>;
/** Whether the master of a class has been beaten, in whatever machine. */
export const masterBeaten = (state: Kept, kind: Archetype): boolean => (state.masters ?? []).includes(kind);
/** Whether the pilot holds the crown of a class: its master beaten in a machine of that class. */
export const crownHeld = (state: Kept, kind: Archetype): boolean => (state.crowns ?? []).includes(kind);
/** How many crowns the pilot holds: one a class at most, whatever the kept list says. */
export const crownsHeld = (state: Kept): number => ARCHETYPES.filter((kind) => crownHeld(state, kind)).length;

/** What a contract that asks for a class pays on top to the holder of that class's crown, as a share of the fee: twice what it pays anyone else. */
export const CROWN_BONUS = 0.5;
/** The share of the fee a contract that asks for a class adds for this pilot, won as that class: the crown's for its holder, the board's for anyone else. */
export const askBonus = (state: Kept, kind: Archetype): number => (crownHeld(state, kind) ? CROWN_BONUS : ASK_BONUS);

/** The purse of a duel with the master of a class: in full until that master has been beaten, a rematch's after. */
export const masterPurse = (state: Kept, kind: Archetype): number => (masterBeaten(state, kind) ? rematchPurse(state, masterId(kind), MASTER_PURSE) : MASTER_PURSE);

/** A master as the battle fields them: their machine part for part, in their paint, flown as their class is. */
export function masterEnemy(master: Master): EnemyDef {
  return {
    id: masterId(master.kind), name: master.name, ai: CLASS_AI[master.kind], sprite: 'enemy-rival', composed: true, build: master.build, paint: master.paint,
    ...(master.plating ? { plating: master.plating } : {}),
  };
}

/** A duel with a master in the shape of a contract, so that it is briefed, fought and settled like one. It names the crown it is fought for. */
export function masterMission(state: Kept, master: Master, text: { client: string; win: string }): Mission {
  return {
    id: masterId(master.kind), phase: 'patrol', title: master.name, client: text.client,
    briefing: [master.style, `"${master.taunt}"`], debrief: text.win, reward: masterPurse(state, master.kind),
    battles: [{ enemies: [masterId(master.kind)], background: 'bg-arena' }], scale: master.scale, crown: master.kind,
    // A master beaten before is a rematch whatever is flown: the crown, where it is still to be had, is all it is fought for besides the purse.
    ...asRematch(masterBeaten(state, master.kind)),
  };
}

/**
 * Writes a duel won down: the master of that class is beaten, and the crown is the pilot's when the
 * duel was flown in a machine of that class. Nothing is written twice, and a crown once held stays.
 */
export function recordMasterWin<T extends Kept>(state: T, kind: Archetype, flownAs: Archetype | null): T {
  const beaten = masterBeaten(state, kind);
  const crowned = flownAs !== kind || crownHeld(state, kind);
  if (beaten && crowned) return state;
  return {
    ...state,
    ...(beaten ? {} : { masters: [...(state.masters ?? []), kind] }),
    ...(crowned ? {} : { crowns: [...(state.crowns ?? []), kind] }),
  };
}

/**
 * The bill of a duel as it is shown: one that was won in a machine of the class whose crown the
 * contract names, by a pilot who did not hold that crown, says that the crown changed hands.
 */
export function crownSettlement(settlement: Settlement, mission: Pick<Mission, 'crown'>, flownAs: Archetype | null, state: Kept): Settlement {
  const kind = mission.crown;
  return settlement.won && kind !== undefined && flownAs === kind && !crownHeld(state, kind) ? { ...settlement, crowned: kind } : settlement;
}
