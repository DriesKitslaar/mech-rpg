import { reached, type Battle, type Condition, type Mission } from './campaign';
import type { Settlement } from './economy';
import type { GameState } from './game';
import type { Build } from './types';

/** One exercise in the simulator: a single battle in a mech lent for it, made to teach one thing. */
export interface Drill {
  /** Begins with `drill-`. */
  id: string;
  title: string;
  /** What it teaches, in a few words, for the list. */
  lesson: string;
  briefing: string[];
  /** Said when it is passed. */
  debrief: string;
  /** The mech that is lent. */
  build: Build;
  battle: Battle;
  /** Multiplies enemy armour and damage; 1 when absent. The difficulty the player chose does not apply. */
  scale?: number;
  /** What opens it: a contract done, `choice`, `start`, and so on. */
  after: Condition;
}

/** What a drill pays, once: the first time it is passed. */
export const DRILL_PAY = 150;

export const isDrill = (mission: Mission): boolean => mission.loaner !== undefined;
export const drillPassed = (game: GameState, drillId: string): boolean => game.drills.includes(drillId);
/**
 * Whether a drill can be run. Once open it stays open: a drill that was passed is never locked
 * again, and a pilot whose story has started over keeps every drill the first time round opened.
 */
export const drillOpen = (game: GameState, drill: Drill, missions: Mission[]): boolean =>
  game.cycle > 0 || drillPassed(game, drill.id) || reached(game, drill.after, missions);

/** A drill in the shape of a contract, so it is briefed, fought and settled like one. It pays only until it has been passed. */
export function drillMission(game: GameState, drill: Drill, client: string): Mission {
  return {
    id: drill.id, phase: 'patrol', title: drill.title, client, briefing: drill.briefing, debrief: drill.debrief,
    reward: drillPassed(game, drill.id) ? 0 : DRILL_PAY, battles: [drill.battle], scale: drill.scale ?? 1, loaner: drill.build,
  };
}

/** How a drill is settled: the simulator bills nothing, and pays what the drill still pays when it is passed. */
export function drillSettlement(won: boolean, mission: Mission): Settlement {
  const reward = won ? mission.reward : 0;
  return { won, reward, ammoCost: 0, repairCost: 0, net: reward, lines: [] };
}

/** Books a drill: passing it for the first time pays and is remembered. Nothing else about the game changes. */
export function recordDrill(game: GameState, settlement: Settlement, mission: Mission): GameState {
  if (!settlement.won || drillPassed(game, mission.id)) return game;
  return { ...game, credits: game.credits + settlement.reward, drills: [...game.drills, mission.id] };
}
