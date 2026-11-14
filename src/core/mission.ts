import { carryFrom, createBattle, type BattleOptions, type BattleState } from './battle';
import { weaponIn } from './build';
import type { Mission } from './campaign';
import { WEAPON_SLOTS, type Build, type Catalog, type EnemyDef } from './types';

/** Share of each surviving part's armour restored between two battles of one mission. */
export const FIELD_SERVICE = 0.4;
/** Share of each magazine refilled between two battles. The rounds are billed at the end like any others. */
export const FIELD_RESUPPLY = 0.5;

/**
 * Between battles the crew vents the heat and patches every part, destroyed ones included: a mech
 * that lost its head or arms in the first engagement would otherwise be helpless for the rest.
 * The patching is free: the settlement bills only the armour missing at the end of the contract.
 * They also refill half of every magazine, so a mech that lives on ammunition is not left without
 * any in the last engagement; those rounds go on the bill.
 */
function fieldService(state: BattleState, catalog: Catalog): void {
  const player = state.units[0];
  player.heat = 0;
  for (const part of Object.values(player.parts)) {
    if (part) part.ap = Math.min(part.maxAp, part.ap + Math.round(part.maxAp * FIELD_SERVICE));
  }
  for (const slot of WEAPON_SLOTS) {
    const magazine = weaponIn(player.build, slot, catalog)?.ammo;
    const left = player.ammo[slot];
    if (typeof magazine !== 'number' || typeof left !== 'number') continue;
    const added = Math.max(0, Math.min(magazine - left, Math.ceil(magazine * FIELD_RESUPPLY)));
    player.ammo[slot] = left + added;
    if (added > 0) player.restocked[slot] = (player.restocked[slot] ?? 0) + added;
  }
}

/**
 * Starts battle number `index` of a mission. After the first battle, pass the previous battle's
 * final state so the player's damage, heat and ammunition carry over.
 */
export function startMissionBattle(
  build: Build, mission: Mission, index: number, enemies: Record<string, EnemyDef>, catalog: Catalog,
  seed: number, previous?: BattleState, opts: Pick<BattleOptions, 'mods' | 'enemyScale'> = {},
): BattleState {
  const battle = mission.battles[index];
  if (!battle) throw new Error(`mission ${mission.id} has no battle ${index}`);
  const defs = battle.enemies.map((id) => {
    if (!Object.hasOwn(enemies, id)) throw new Error(`unknown enemy: ${id}`);
    return enemies[id];
  });
  const state = createBattle(build, defs, catalog, seed + index, {
    ...opts, carry: previous ? carryFrom(previous) : undefined,
    ...(battle.objective ? { objective: battle.objective } : {}),
    ...(battle.support ? { support: battle.support } : {}),
  });
  if (previous) fieldService(state, catalog);
  return state;
}

/** Plays a whole mission with the given way of playing one battle. Returns the last battle fought. */
export function playMission(
  build: Build, mission: Mission, enemies: Record<string, EnemyDef>, catalog: Catalog, seed: number,
  playBattle: (state: BattleState) => BattleState, opts: Pick<BattleOptions, 'mods' | 'enemyScale'> = {},
): BattleState {
  let state: BattleState | undefined;
  for (let i = 0; i < mission.battles.length; i++) {
    state = playBattle(startMissionBattle(build, mission, i, enemies, catalog, seed, state, opts));
    if (state.outcome !== 'victory') break;
  }
  return state!;
}
