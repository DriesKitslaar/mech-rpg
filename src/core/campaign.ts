import type { GameState } from './game';
import type { Part } from './types';

export type Faction = 'hadron' | 'lumen' | 'undertow';
export type MissionPhase = 'patrol' | 'intro' | 'faction' | 'choice' | 'finale';

export interface Mission {
  id: string;
  title: string;
  phase: MissionPhase;
  /** The client, for faction, choice and finale contracts. */
  faction?: Faction;
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
  battles: { enemies: string[]; background: string }[];
}

export interface Message {
  id: string;
  from: string;
  portrait?: string;
  subject: string;
  body: string[];
  /** Arrives at the start, after a named contract, or after any exclusive contract. */
  after: 'start' | 'choice' | string;
}

const done = (state: GameState, missions: Mission[], phase: MissionPhase): Mission[] =>
  missions.filter((m) => m.phase === phase && state.completed.includes(m.id));
const all = (missions: Mission[], phase: MissionPhase): Mission[] => missions.filter((m) => m.phase === phase);

/** The client whose exclusive contract the pilot took, if any. */
export function chosenFaction(state: GameState, missions: Mission[]): Faction | null {
  return done(state, missions, 'choice')[0]?.faction ?? null;
}

/**
 * The contracts on offer, in list order. The patrol is always among them, so there is always work:
 * introductions come one at a time, then the three clients in any order, then one exclusive contract,
 * then that client's finale.
 */
export function availableMissions(state: GameState, missions: Mission[]): Mission[] {
  const open = (m: Mission) => !state.completed.includes(m.id);
  const introsLeft = all(missions, 'intro').filter(open);
  const factionLeft = all(missions, 'faction').filter(open);
  const chosen = chosenFaction(state, missions);

  let story: Mission[];
  if (introsLeft.length > 0) story = [introsLeft[0]];
  else if (factionLeft.length > 0) story = factionLeft;
  else if (!chosen) story = all(missions, 'choice');
  else story = all(missions, 'finale').filter((m) => m.faction === chosen && open(m));
  return [...all(missions, 'patrol'), ...story];
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

export function campaignComplete(state: GameState, missions: Mission[]): boolean {
  return done(state, missions, 'finale').length > 0;
}

/** True once the event a part or message waits for has happened. */
function reached(state: GameState, condition: string, missions: Mission[]): boolean {
  if (condition === 'start') return true;
  if (condition === 'choice') return chosenFaction(state, missions) !== null;
  // "arena:N": the arena rank is at least N.
  if (condition.startsWith('arena:')) return state.arenaRank >= Number(condition.slice(6));
  return state.completed.includes(condition);
}

/** What the shop sells now. `unlocks` maps a part id to the contract (or `'choice'`) that puts it in stock. */
export function stockFor(state: GameState, parts: Part[], unlocks: Record<string, string>, missions: Mission[]): Part[] {
  return parts.filter((part) => !Object.hasOwn(unlocks, part.id) || reached(state, unlocks[part.id], missions));
}

/** Messages that have arrived, oldest first. */
export function arrivedMessages(state: GameState, messages: Message[], missions: Mission[]): Message[] {
  return messages.filter((m) => reached(state, m.after, missions));
}

export function unreadMessages(state: GameState, messages: Message[], missions: Mission[]): Message[] {
  return arrivedMessages(state, messages, missions).filter((m) => !state.read.includes(m.id));
}

export function markRead(state: GameState, messageId: string): GameState {
  return state.read.includes(messageId) ? state : { ...state, read: [...state.read, messageId] };
}
