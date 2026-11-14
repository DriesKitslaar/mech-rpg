import { carryFrom, createBattle, type BattleState } from './battle';
import type { Mission } from './campaign';
import type { Build, Catalog, EnemyDef } from './types';

/** Share of each surviving part's armour restored between two battles of one mission. */
export const FIELD_SERVICE = 0.4;

/**
 * Between battles the crew vents the heat and patches every part, destroyed ones included: a mech
 * that lost its head or arms in the first engagement would otherwise be helpless for the rest.
 * The service is free: the settlement bills only the armour missing at the end of the contract.
 */
function fieldService(state: BattleState): void {
  const player = state.units[0];
  player.heat = 0;
  for (const part of Object.values(player.parts)) {
    if (part) part.ap = Math.min(part.maxAp, part.ap + Math.round(part.maxAp * FIELD_SERVICE));
  }
}

/**
 * Starts battle number `index` of a mission. After the first battle, pass the previous battle's
 * final state so the player's damage, heat and ammunition carry over.
 */
export function startMissionBattle(
  build: Build, mission: Mission, index: number, enemies: Record<string, EnemyDef>, catalog: Catalog,
  seed: number, previous?: BattleState,
): BattleState {
  const battle = mission.battles[index];
  if (!battle) throw new Error(`mission ${mission.id} has no battle ${index}`);
  const defs = battle.enemies.map((id) => {
    if (!Object.hasOwn(enemies, id)) throw new Error(`unknown enemy: ${id}`);
    return enemies[id];
  });
  const state = createBattle(build, defs, catalog, seed + index, previous ? carryFrom(previous) : undefined);
  if (previous) fieldService(state);
  return state;
}

/** Plays a whole mission with the given way of playing one battle. Returns the last battle fought. */
export function playMission(
  build: Build, mission: Mission, enemies: Record<string, EnemyDef>, catalog: Catalog, seed: number,
  playBattle: (state: BattleState) => BattleState,
): BattleState {
  let state: BattleState | undefined;
  for (let i = 0; i < mission.battles.length; i++) {
    state = playBattle(startMissionBattle(build, mission, i, enemies, catalog, seed, state));
    if (state.outcome !== 'victory') break;
  }
  return state!;
}
