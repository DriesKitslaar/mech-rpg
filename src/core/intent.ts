import { chooseEnemyAction } from './ai';
import { activeUnit, applyAction, turnEnergyOf, type Action, type BattleState, type UnitState } from './battle';
import type { Catalog, FrameSlot } from './types';

/**
 * What an enemy is about to do, as far as a pilot could read it from how the machine moves: which
 * part it is lining up on, or that it is about to dart aside, mend, wind up a charge or stand
 * cooling. It is read by letting the enemy take its next turn on a copy of the field as it stands,
 * so what is read is what happens unless the field changes first.
 */
export type Intent =
  | { kind: 'aim'; part: FrameSlot }
  | { kind: 'dart' }
  | { kind: 'mend' }
  | { kind: 'charge' }
  | { kind: 'cool' }
  | { kind: 'fuse'; turns: number }
  | { kind: 'reeling' };

/** The round in which the unit takes its next turn: this one if its turn is still to come. */
export function nextTurnRound(state: BattleState, unit: UnitState): number {
  const at = state.order.indexOf(unit.id);
  return at >= 0 && at >= state.turn ? state.round : state.round + 1;
}

/** The field as it will stand when the unit's next turn starts, if nothing else happens first. */
function atItsTurn(state: BattleState, unit: UnitState, catalog: Catalog): BattleState {
  const copy = structuredClone(state);
  const me = copy.units.find((u) => u.id === unit.id)!;
  const mine = copy.order.indexOf(unit.id);
  // A turn already under way is left as it is; one still to come starts the way every turn does.
  if (activeUnit(state).id !== unit.id) {
    copy.round = nextTurnRound(state, unit);
    if (mine >= 0) copy.turn = mine;
    else { copy.order = [unit.id]; copy.turn = 0; }
    me.boosted = false;
    me.guarding = false;
    me.energy = Math.max(0, turnEnergyOf(me, catalog) - me.energyDebt);
    me.energyDebt = 0;
    me.usedBoost = false;
    me.usedGuard = false;
    me.usedCool = false;
    me.usedModule = false;
    me.fired = [];
  }
  return copy;
}

/** Everything the unit does with the turn, in order. */
function turnOf(state: BattleState, unit: UnitState, catalog: Catalog): Action[] {
  let s = atItsTurn(state, unit, catalog);
  const actions: Action[] = [];
  for (let i = 0; i < 16 && s.outcome === 'ongoing' && activeUnit(s).id === unit.id; i++) {
    const action = chooseEnemyAction(s, catalog);
    actions.push(action);
    if (action.type === 'endTurn') break;
    s = applyAction(s, action, catalog);
  }
  return actions;
}

const read = new WeakMap<BattleState, Map<string, Intent | null>>();

/** What the enemy will do with its next turn; nothing for the pilot's own machine, a wreck, or a machine that will do nothing. */
export function intentOf(state: BattleState, unit: UnitState, catalog: Catalog): Intent | null {
  if (unit.side !== 'enemy' || unit.destroyed || state.outcome !== 'ongoing') return null;
  let known = read.get(state);
  if (!known) { known = new Map(); read.set(state, known); }
  if (!known.has(unit.id)) known.set(unit.id, work(state, unit, catalog));
  return known.get(unit.id)!;
}

function work(state: BattleState, unit: UnitState, catalog: Catalog): Intent | null {
  if (unit.fuse !== undefined) return { kind: 'fuse', turns: unit.fuse };
  if (unit.staggered > 0) return { kind: 'reeling' };
  // Heat that has tripped costs the next turn whole.
  if (unit.overheated && activeUnit(state).id !== unit.id) return { kind: 'cool' };
  const actions = turnOf(state, unit, catalog);
  if (actions.some((a) => a.type === 'mend')) return { kind: 'mend' };
  const shot = actions.find((a): a is Extract<Action, { type: 'fire' }> => a.type === 'fire');
  // A skirmisher that boosts is out of reach for the round, whatever it fires on the way.
  if (unit.ai === 'skirmisher' && actions.some((a) => a.type === 'boost')) return { kind: 'dart' };
  if (shot) return { kind: 'aim', part: shot.part };
  if (actions.some((a) => a.type === 'charge')) return { kind: 'charge' };
  if (actions.some((a) => a.type === 'cool')) return { kind: 'cool' };
  return null;
}
