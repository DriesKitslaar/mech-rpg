import type { Support } from './battle';
import type { GameState } from './game';
import type { Build, Objective, Part } from './types';

export type Faction = 'hadron' | 'lumen' | 'undertow';
/**
 * Where a contract sits in the story. In order: the introductions; two contracts for each client;
 * the rival; the choice of a client; that client's path; its finale; the audit; the verdict.
 * The patrol stands outside the story.
 */
export type MissionPhase = 'patrol' | 'intro' | 'faction' | 'rival' | 'choice' | 'path' | 'finale' | 'audit' | 'verdict';
/** How the pilot ends the story: by enforcing the foreclosure, or by defaulting on it. */
export type Verdict = 'enforce' | 'default';
/** The story's phases in the order they are played. */
const STAGES: MissionPhase[] = ['intro', 'faction', 'rival', 'choice', 'path', 'finale', 'audit', 'verdict'];

/** Something said over a battle: when it opens, when a round begins, or when it is won. */
export interface TalkLine {
  at: 'start' | 'win' | number;
  who: string;
  /** Sprite id of the speaker's face, if they have one. */
  portrait?: string;
  text: string;
}

export interface Battle {
  enemies: string[];
  background: string;
  /** What the battle asks for: every enemy destroyed, when absent. */
  objective?: Objective;
  /** An ally who fires into the battle from off the field. */
  support?: Support;
  /** Rounds a good pilot needs; 3 plus 2 for each enemy when absent. Ranks are measured against it. */
  par?: number;
  talk?: TalkLine[];
}

export interface Mission {
  id: string;
  title: string;
  phase: MissionPhase;
  /** The client, for faction, choice, path and finale contracts. */
  faction?: Faction;
  /** A faction contract that is offered only once this other contract is done. */
  after?: string;
  /** Which ending a verdict contract leads to. */
  verdict?: Verdict;
  /** Set on a contract played again from the archive: it pays less and changes nothing in the story. */
  replay?: boolean;
  /** Who is speaking in the briefing. */
  client: string;
  /** Sprite id of the client's portrait, if they have one. */
  portrait?: string;
  /** Briefing paragraphs. */
  briefing: string[];
  /** Shown with the settlement after a win. */
  debrief: string;
  reward: number;
  /** Fought in order; damage, heat and ammunition carry from one to the next. */
  battles: Battle[];
  /** Multiplies enemy armour and damage; 1 when absent. */
  scale?: number;
  /** Set on an arena fight: the rank of the opponent. */
  arenaRank?: number;
  /** Set on a training drill: the mech that is lent for it. See training.ts. */
  loaner?: Build;
}

export interface Message {
  id: string;
  from: string;
  portrait?: string;
  subject: string;
  body: string[];
  /** Arrives when this has happened; see `Condition`. */
  after: Condition;
  /** Only for the pilot who chose this client. */
  faction?: Faction;
}

/**
 * Something a message, a part or a scene waits for: the start, any exclusive contract (`choice`),
 * any finale, any verdict, an arena rank (`arena:N`), or the id of a contract.
 */
export type Condition = 'start' | 'choice' | 'finale' | 'verdict' | string;

/** A page of story between contracts: the opening of an act, or an ending. */
export interface Scene {
  id: string;
  /** A small line over the title, such as the act. */
  heading?: string;
  title: string;
  /** Sprite id of the picture behind the text, if there is one. */
  picture?: string;
  lines: string[];
  /** Shown once this has happened... */
  after: Condition;
  /** ...unless this has too: a pilot who is already past a scene is not told it. */
  before?: Condition;
  /** Only for the pilot who chose this client. */
  faction?: Faction;
  /** An ending of the story: seeing it is what `endingSeen` records. */
  ending?: boolean;
}

const done = (state: GameState, missions: Mission[], phase: MissionPhase): Mission[] =>
  missions.filter((m) => m.phase === phase && state.completed.includes(m.id));
const all = (missions: Mission[], phase: MissionPhase): Mission[] => missions.filter((m) => m.phase === phase);

/** The client whose exclusive contract the pilot took, if any. */
export function chosenFaction(state: GameState, missions: Mission[]): Faction | null {
  return done(state, missions, 'choice')[0]?.faction ?? null;
}

/** The verdict the pilot gave, if any. */
export function chosenVerdict(state: GameState, missions: Mission[]): Verdict | null {
  return done(state, missions, 'verdict')[0]?.verdict ?? null;
}

/** What one phase of the story has on offer right now. */
function offeredIn(phase: MissionPhase, state: GameState, missions: Mission[]): Mission[] {
  const left = all(missions, phase).filter((m) => !state.completed.includes(m.id));
  const chosen = chosenFaction(state, missions);
  switch (phase) {
    // One at a time, in list order.
    case 'intro':
    case 'rival':
    case 'audit': return left.slice(0, 1);
    // Every client at once; a client's later contract waits for the one it names.
    case 'faction': return left.filter((m) => !m.after || state.completed.includes(m.after));
    case 'choice': return chosen ? [] : all(missions, 'choice');
    case 'path': return left.filter((m) => m.faction === chosen).slice(0, 1);
    case 'finale': return done(state, missions, 'finale').length > 0 ? [] : left.filter((m) => m.faction === chosen);
    case 'verdict': return done(state, missions, 'verdict').length > 0 ? [] : left;
    case 'patrol': return [];
  }
}

/**
 * The contracts on offer, in list order. The patrol is always among them, so there is always work.
 * The story is offered a phase at a time, from the furthest phase the pilot has done anything in:
 * what an earlier phase still has open is behind them. (That only matters for a pilot whose game
 * is older than part of the story: one who had already taken a side is not sent back to the others.)
 */
export function availableMissions(state: GameState, missions: Mission[]): Mission[] {
  let furthest = 0;
  STAGES.forEach((phase, i) => { if (done(state, missions, phase).length > 0) furthest = i; });
  let story: Mission[] = [];
  for (const phase of STAGES.slice(furthest)) {
    story = offeredIn(phase, state, missions);
    if (story.length > 0) break;
  }
  return [...all(missions, 'patrol'), ...story];
}

/** Share of a contract's pay that playing it again from the archive earns. */
export const ARCHIVE_PAY = 0.3;

/**
 * The story contracts the pilot has done, in the order they were done, as they can be played again:
 * for a share of the pay, and marked so that winning them changes nothing in the story.
 */
export function archiveMissions(state: GameState, missions: Mission[]): Mission[] {
  return state.completed.flatMap((id) => {
    const mission = missions.find((m) => m.id === id && m.phase !== 'patrol');
    return mission ? [{ ...mission, reward: Math.round(mission.reward * ARCHIVE_PAY), replay: true }] : [];
  });
}

/** Records a won contract. The patrol repeats and is not recorded. */
export function completeMission(state: GameState, missionId: string, missions: Mission[]): GameState {
  const mission = missions.find((m) => m.id === missionId);
  if (!mission) throw new Error(`unknown mission: ${missionId}`);
  if (mission.phase === 'patrol' || state.completed.includes(missionId)) return state;
  return { ...state, completed: [...state.completed, missionId] };
}

/** One point for a client's first contract, two for their exclusive one. */
export function loyalty(state: GameState, missions: Mission[]): Record<Faction, number> {
  const points: Record<Faction, number> = { hadron: 0, lumen: 0, undertow: 0 };
  for (const m of done(state, missions, 'faction')) if (m.faction) points[m.faction] += 1;
  for (const m of done(state, missions, 'choice')) if (m.faction) points[m.faction] += 2;
  return points;
}

/** True once the introductions are behind the pilot, in this cycle or an earlier one. */
export function introductionsDone(state: GameState, missions: Mission[]): boolean {
  return state.cycle > 0 || all(missions, 'intro').every((m) => state.completed.includes(m.id));
}

export const CYCLE_SCALE = 0.25;
export const CYCLE_PAY = 0.5;

/**
 * A story contract as it is offered in the given cycle: tougher enemies, better pay. What has to be
 * protected grows sturdier by as much as the enemies grow tougher: it loses armour by the head of
 * enemy standing, and tougher enemies stand longer. The patrol never changes.
 */
export function forCycle(mission: Mission, cycle: number): Mission {
  if (cycle <= 0 || mission.phase === 'patrol') return mission;
  const tougher = 1 + CYCLE_SCALE * cycle;
  return {
    ...mission,
    reward: Math.round(mission.reward * (1 + CYCLE_PAY * cycle)),
    scale: Math.round((mission.scale ?? 1) * tougher * 100) / 100,
    battles: mission.battles.map((battle) =>
      (battle.objective?.type === 'protect' ? { ...battle, objective: { ...battle.objective, hp: Math.ceil(battle.objective.hp * tougher) } } : battle)),
  };
}

/** Starts the story again. Credits, parts, pilot level, perks, arena rank and the best ranks all stay. */
export function startNewCycle(state: GameState, missions: Mission[]): GameState {
  if (!campaignComplete(state, missions)) throw new Error('the campaign is not complete');
  return { ...state, completed: [], read: [], scenes: [], endingSeen: false, cycle: state.cycle + 1 };
}

/** The story ends with a verdict. A story that has none (a short one) ends with its finale. */
export function campaignComplete(state: GameState, missions: Mission[]): boolean {
  const last: MissionPhase = all(missions, 'verdict').length > 0 ? 'verdict' : 'finale';
  return done(state, missions, last).length > 0;
}

/** True once the event a part, a message, a scene or a database entry waits for has happened. */
export function reached(state: GameState, condition: Condition, missions: Mission[]): boolean {
  if (condition === 'start') return true;
  if (condition === 'choice') return chosenFaction(state, missions) !== null;
  if (condition === 'finale' || condition === 'verdict') return done(state, missions, condition).length > 0;
  // "arena:N": the arena rank is at least N.
  if (condition.startsWith('arena:')) return state.arenaRank >= Number(condition.slice(6));
  return state.completed.includes(condition);
}

/**
 * What the shop sells now. `unlocks` maps a part id to the contract (or `'choice'`, or `'arena:N'`)
 * that puts it in stock. Vendors do not forget a pilot: from the second cycle on, everything a
 * contract unlocks stays in stock. Arena prizes always need the rank. What the third act unlocks
 * stays only for a pilot who has given a verdict before: a game that reached a later cycle when the
 * story still ended with the war has never met Meridian, and is not sold its parts.
 */
export function stockFor(state: GameState, parts: Part[], unlocks: Record<string, string>, missions: Mission[]): Part[] {
  const actThree = (condition: string): boolean =>
    condition === 'verdict' || missions.some((m) => m.id === condition && (m.phase === 'audit' || m.phase === 'verdict'));
  // Every won story contract leaves a rank, and ranks are kept through the cycles.
  const judged = all(missions, 'verdict').some((m) => Object.hasOwn(state.ranks, m.id));
  const kept = (condition: string): boolean => state.cycle > 0 && !condition.startsWith('arena:') && (!actThree(condition) || judged);
  return parts.filter((part) => !Object.hasOwn(unlocks, part.id) || kept(unlocks[part.id]) || reached(state, unlocks[part.id], missions));
}

/** Messages that have arrived, oldest first. */
export function arrivedMessages(state: GameState, messages: Message[], missions: Mission[]): Message[] {
  const chosen = chosenFaction(state, missions);
  return messages.filter((m) => reached(state, m.after, missions) && (!m.faction || m.faction === chosen));
}

/** The scenes the pilot should be shown now, in list order: reached, not passed, not seen. */
export function dueScenes(state: GameState, scenes: Scene[], missions: Mission[]): Scene[] {
  const chosen = chosenFaction(state, missions);
  return scenes.filter((scene) =>
    !state.scenes.includes(scene.id)
    // A game that says the ending was seen is believed, whatever its list of scenes holds.
    && !(scene.ending && state.endingSeen)
    && reached(state, scene.after, missions)
    && !(scene.before !== undefined && reached(state, scene.before, missions))
    && (!scene.faction || scene.faction === chosen));
}

/** Records that a scene has been shown; an ending also closes the story. */
export function markSceneSeen(state: GameState, scene: Scene): GameState {
  if (state.scenes.includes(scene.id)) return state;
  return { ...state, scenes: [...state.scenes, scene.id], ...(scene.ending ? { endingSeen: true } : {}) };
}

export function unreadMessages(state: GameState, messages: Message[], missions: Mission[]): Message[] {
  return arrivedMessages(state, messages, missions).filter((m) => !state.read.includes(m.id));
}

export function markRead(state: GameState, messageId: string): GameState {
  return state.read.includes(messageId) ? state : { ...state, read: [...state.read, messageId] };
}
