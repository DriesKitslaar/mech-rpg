import { groundFor } from './ground';
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
  seed: number, previous?: BattleState, opts: Pick<BattleOptions, 'mods' | 'enemyScale' | 'carry' | 'overdrive' | 'drive'> = {},
): BattleState {
  const battle = mission.battles[index];
  if (!battle) throw new Error(`mission ${mission.id} has no battle ${index}`);
  const known = (id: string): EnemyDef => {
    if (!Object.hasOwn(enemies, id)) throw new Error(`unknown enemy: ${id}`);
    return enemies[id];
  };
  const defs = battle.enemies.map(known);
  const state = createBattle(build, defs, catalog, seed + index, {
    // What an earlier battle of this contract left is carried; failing that, what the caller says the mech arrives with.
    ...opts, carry: previous ? carryFrom(previous) : opts.carry,
    ...(battle.objective ? { objective: battle.objective } : {}),
    ...(battle.marks ? { marks: battle.marks } : {}),
    ...(battle.reserve ? { reserve: battle.reserve.map(known) } : {}),
    ...(battle.closed ? { closed: true as const } : {}),
    // A wingman keeps the order they were given through the battles of one contract.
    ...(battle.support ? { support: battle.support.orders && previous?.support?.order ? { ...battle.support, order: previous.support.order } : battle.support } : {}),
    // The place has its say, the same for both sides.
    ...(groundFor(battle.background) ? { ground: groundFor(battle.background) } : {}),
  });
  if (previous) fieldService(state, catalog);
  return state;
}

/**
 * What a contract's battles are fought with: the mech, every enemy there can be, and what the pilot
 * brings to each battle. The game starts its battles from one of these, and counts a contract's odds
 * from the same one, so that the two are the same fight.
 */
export interface Fight {
  build: Build;
  enemies: Record<string, EnemyDef>;
  opts: Pick<BattleOptions, 'mods' | 'enemyScale' | 'carry' | 'overdrive'>;
  /** What the Overdrive's meter stands at as the first battle opens, for a contract that hands it over filled. */
  drive?: number;
}

/** Starts battle number `index` of a contract from what it is fought with; after the first, from the battle before it as it ended. */
export function startFight(fight: Fight, mission: Mission, index: number, catalog: Catalog, seed: number, previous?: BattleState): BattleState {
  return startMissionBattle(fight.build, mission, index, fight.enemies, catalog, seed, previous,
    { ...fight.opts, ...(index === 0 && fight.drive ? { drive: fight.drive } : {}) });
}

/** Plays a whole mission with the given way of playing one battle. Returns the last battle fought. */
export function playMission(
  build: Build, mission: Mission, enemies: Record<string, EnemyDef>, catalog: Catalog, seed: number,
  playBattle: (state: BattleState) => BattleState, opts: Pick<BattleOptions, 'mods' | 'enemyScale' | 'overdrive'> = {},
): BattleState {
  let state: BattleState | undefined;
  for (let i = 0; i < mission.battles.length; i++) {
    state = playBattle(startMissionBattle(build, mission, i, enemies, catalog, seed, state, opts));
    if (state.outcome !== 'victory') break;
  }
  return state!;
}
