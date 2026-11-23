import { chooseAutoPlayerAction, chooseEnemyAction, holding, looming, saving } from '../../src/core/ai';
import { mirrorEnemy } from '../../src/core/arena';
import {
  GUARD_DAMAGE, STAGGER_ENERGY, activeUnit, applyAction, bufferRoom, createBattle, guardCost, turnEnergyOf,
  type Action, type BattleEvent, type BattleState, type UnitState,
} from '../../src/core/battle';
import { validatePlayerBuild } from '../../src/core/build';
import { newGame } from '../../src/core/game';
import { intentOf, nextTurnRound } from '../../src/core/intent';
import type { Build, Catalog, EnemyDef, Weapon } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';

/**
 * A pilot who holds: fires only in the rounds its habit names, and in the others braces and keeps its energy.
 * What it is about to do is read as it is done, whoever moves first, and the game's own pilot braces for what
 * was kept.
 */
const hit = () => 0;
const END: Action = { type: 'endTurn' };
const unit = (s: BattleState, id: string): UnitState => s.units.find((u) => u.id === id)!;
const foe = (s: BattleState): UnitState => unit(s, 'enemy-0');
const events = (before: BattleState, after: BattleState): BattleEvent[] => after.events.slice(before.events.length);
const edit = (s: BattleState, change: (draft: BattleState) => void): BattleState => {
  const copy = structuredClone(s);
  change(copy);
  return copy;
};
/** The enemy's whole turn as it chooses to take it; what it did, and the field when the pilot is up again. */
function enemyTurn(s: BattleState): { actions: Action[]; after: BattleState } {
  expect(activeUnit(s).id).toBe('enemy-0');
  const actions: Action[] = [];
  for (let guard = 0; guard < 12 && s.outcome === 'ongoing' && activeUnit(s).id === 'enemy-0'; guard++) {
    const action = chooseEnemyAction(s, CATALOG);
    actions.push(action);
    s = applyAction(s, action, CATALOG, hit);
  }
  return { actions, after: s };
}
const pass = (s: BattleState): BattleState => {
  expect(activeUnit(s).id).toBe('player');
  return applyAction(s, END, CATALOG);
};

/** The Colossus is slower than the Solstice and the Wraith is quicker: the works pilot moves first against the one and second against the other. */
const SLOW = REFERENCE_BUILDS.tier6;
const QUICK = REFERENCE_BUILDS.tier5;
const against = (build: Build, enemy: EnemyDef = ENEMIES.vesper): BattleState => createBattle(build, [enemy], CATALOG, 1);
const TURN = 360;

describe('the habit of holding', () => {
  test('is the works pilot\'s and nobody else\'s: every other round, counted from the first', () => {
    expect(ENEMIES.vesper.abilities).toEqual({ hold: 2 });
    expect(Object.values(ENEMIES).filter((e) => e.abilities?.hold !== undefined).map((e) => e.id)).toEqual(['vesper']);
    const s = against(SLOW);
    const inRound = (round: number, hold?: number): boolean => {
      const d = edit(s, (draft) => { draft.round = round; foe(draft).abilities = hold === undefined ? {} : { hold }; });
      return holding(d, foe(d));
    };
    expect([1, 2, 3, 4, 5, 6].map((round) => inRound(round, 2))).toEqual([true, false, true, false, true, false]);
    // A habit of three fires every third round.
    expect([1, 2, 3, 4, 5, 6].map((round) => inRound(round, 3))).toEqual([true, true, false, true, true, false]);
    // And a machine without the habit never holds.
    expect([1, 2, 3].map((round) => inRound(round))).toEqual([false, false, false]);
  });

  test('in a round it holds it guards and fires nothing, and its core keeps half a turn; in the next the one weapon has a turn and a half behind it', () => {
    const s = against(SLOW);
    expect(s.order).toEqual(['enemy-0', 'player']);
    expect(turnEnergyOf(foe(s), CATALOG)).toBe(TURN);
    expect(bufferRoom(foe(s), CATALOG)).toBe(TURN / 2);
    const first = enemyTurn(s);
    expect(first.actions).toEqual([{ type: 'guard' }, END]);
    expect(events(s, first.after).filter((e) => e.type === 'shot')).toEqual([]);
    expect(foe(first.after)).toMatchObject({ guarding: true, kept: TURN / 2 });
    // What the guard cost is gone, and so is what the core had no room for.
    expect(guardCost(foe(s), CATALOG)).toBe(72);
    const second = pass(first.after);
    expect(second.round).toBe(2);
    expect(events(first.after, second)).toContainEqual({ type: 'turnStart', unit: 'enemy-0', kept: TURN / 2 });
    expect(foe(second)).toMatchObject({ energy: TURN + TURN / 2, kept: 0, guarding: false });
    const fired = enemyTurn(second);
    expect(fired.actions[0]).toEqual({ type: 'fire', weapon: 'rightHand', target: 'player', part: 'core' });
    const shot = events(second, fired.after).find((e) => e.type === 'shot')!;
    // A surge hits for every hundred of what it took: five and four tenths times what the weapon is listed at.
    expect(shot).toMatchObject({ unit: 'enemy-0', hit: true, lift: TURN + TURN / 2 });
    // It took everything: nothing is left to brace with, and nothing to keep.
    expect(fired.actions).toEqual([fired.actions[0], END]);
    expect(foe(fired.after)).toMatchObject({ energy: 0, kept: 0, guarding: false });
    // And the round after it holds again.
    const third = pass(fired.after);
    expect(third.round).toBe(3);
    expect(enemyTurn(third).actions).toEqual([{ type: 'guard' }, END]);
  });

  test('what it is about to do is what it does, whoever moves first', () => {
    for (const build of [SLOW, QUICK]) {
      let s = against(build);
      const said: string[] = [];
      const did: string[] = [];
      for (let turns = 0; turns < 6; turns++) {
        if (activeUnit(s).id === 'player') {
          // The pilot reads it before moving; what is read is the works pilot's next turn, in this round or the next.
          const intent = intentOf(s, foe(s), CATALOG)!;
          said.push(`${nextTurnRound(s, foe(s))}:${intent.kind}`);
          s = pass(s);
        } else {
          const round = s.round;
          const { actions, after } = enemyTurn(s);
          did.push(`${round}:${actions.some((a) => a.type === 'fire') ? 'aim' : 'hold'}`);
          s = after;
        }
      }
      expect(did).toEqual(['1:hold', '2:aim', '3:hold']);
      // Moving second, the pilot reads the turns from the second on; moving first, from the first.
      expect(said).toEqual(build === SLOW ? ['2:aim', '3:hold', '4:aim'] : ['1:hold', '2:aim', '3:hold']);
    }
  });

  test('a turn it loses to heat is lost whole, and what its core kept is still there for the turn after', () => {
    // It has held, and something has cooked it since: its next turn is passed over, as any overheated machine's is.
    const s = edit(enemyTurn(against(SLOW)).after, (d) => { foe(d).overheated = true; });
    const next = pass(s);
    expect(events(s, next)).toContainEqual({ type: 'turnSkipped', unit: 'enemy-0' });
    expect(activeUnit(next).id).toBe('player');
    expect(foe(next).kept).toBe(TURN / 2);
    // The round after is one it holds: the turn opens with what was kept on top, and it braces and keeps again.
    const after = pass(next);
    expect(after.round).toBe(3);
    expect(foe(after).energy).toBe(TURN + TURN / 2);
    const again = enemyTurn(after);
    expect(again.actions).toEqual([{ type: 'guard' }, END]);
    expect(foe(again.after).kept).toBe(TURN / 2);
  });

  test('knocked off balance in a round it holds, it has less to brace with and keeps what is left', () => {
    const s = edit(against(QUICK), (d) => { foe(d).staggered = 2; foe(d).stagger = foe(d).staggerMax; });
    // A reeling machine reads as reeling, as any does.
    expect(intentOf(s, foe(s), CATALOG)).toEqual({ kind: 'reeling' });
    const mine = pass(s);
    const share = Math.floor(TURN * STAGGER_ENERGY);
    expect(foe(mine).energy).toBe(share);
    const turn = enemyTurn(mine);
    expect(turn.actions).toEqual([{ type: 'guard' }, END]);
    expect(foe(turn.after).kept).toBe(share - 72);
    expect(share - 72).toBeLessThan(TURN / 2);
  });

  test('with nothing to brace with it only waits', () => {
    const s = edit(against(SLOW), (d) => { foe(d).energy = 10; });
    expect(chooseEnemyAction(s, CATALOG)).toEqual(END);
    // And it reads as holding all the same.
    expect(intentOf(edit(against(QUICK), (d) => { foe(d).energyDebt = 9999; }), foe(s), CATALOG)).toEqual({ kind: 'hold' });
  });

  test('the habit is the works pilot\'s, not the frame\'s: the mirror of a pilot who flies a Solstice fires in the first round', () => {
    const build: Build = { ...ENEMIES.vesper.build, rightHand: 'wpn-sluice' };
    expect(validatePlayerBuild(build, CATALOG)).toEqual([]);
    const mirror = mirrorEnemy({ ...newGame(CATALOG, STARTER_BUILD), build }, 'Mirror');
    expect(mirror.abilities).toBeUndefined();
    const s = against(SLOW, mirror);
    expect(activeUnit(s).id).toBe('enemy-0');
    expect(holding(s, foe(s))).toBe(false);
    expect(enemyTurn(s).actions.some((a) => a.type === 'fire')).toBe(true);
    // Its core keeps what it does not spend, as the pilot's own does.
    expect(foe(s).buffer).toBe(50);
  });
});

describe('what is read of a machine with a buffer', () => {
  /** A weapon that asks more than a turn gives: it can only be fired with what was kept on top. */
  const HEAVY: Weapon = { ...(CATALOG['wpn-enemy-wave'] as Weapon), id: 'wpn-t-heavy', name: 'wpn-t-heavy', trait: undefined, energy: TURN + 60 };
  const WITH: Catalog = { ...CATALOG, [HEAVY.id]: HEAVY };
  /** The Solstice with that weapon and no habit of holding: it fires when it can. */
  const SAVER: EnemyDef = { ...ENEMIES.vesper, id: 'saver', abilities: {}, build: { ...ENEMIES.vesper.build, rightHand: HEAVY.id } };
  const turnOf = (s: BattleState): { actions: Action[]; after: BattleState } => {
    const actions: Action[] = [];
    for (let guard = 0; guard < 12 && s.outcome === 'ongoing' && activeUnit(s).id === 'enemy-0'; guard++) {
      const action = chooseEnemyAction(s, WITH);
      actions.push(action);
      s = applyAction(s, action, WITH, hit);
    }
    return { actions, after: s };
  };

  test('what it kept is counted in: a weapon it can only fire with a turn and what was kept on top reads as aimed, and is fired', () => {
    const s = createBattle(SLOW, [SAVER], WITH, 1);
    expect(activeUnit(s).id).toBe('enemy-0');
    expect(foe(s).energy).toBe(TURN);
    // The first turn has not the energy for it: nothing is fired, and what is left is kept.
    const first = turnOf(s);
    expect(first.actions.some((a) => a.type === 'fire')).toBe(false);
    expect(foe(first.after).kept).toBeGreaterThanOrEqual(60);
    // The pilot reads its next turn: with what it kept, the weapon can be fired.
    expect(intentOf(first.after, foe(first.after), WITH)).toEqual({ kind: 'aim', part: 'core' });
    const second = turnOf(applyAction(first.after, END, WITH));
    expect(second.actions[0]).toMatchObject({ type: 'fire', weapon: 'rightHand' });
    // The same machine with nothing kept could not, and reads as nothing.
    const empty = edit(first.after, (d) => { foe(d).kept = 0; });
    expect(intentOf(empty, foe(empty), WITH)).toBeNull();
  });

  test('a holder that winds a weapon up in the round it fires reads as winding up, not as holding', () => {
    const bow: EnemyDef = { ...ENEMIES.vesper, id: 'bow', build: { ...ENEMIES.vesper.build, rightHand: 'wpn-enemy-longbow' } };
    const s = against(QUICK, bow);
    expect(activeUnit(s).id).toBe('player');
    // The first round is one it holds.
    expect(intentOf(s, foe(s), CATALOG)).toEqual({ kind: 'hold' });
    const second = pass(enemyTurn(pass(s)).after);
    expect(second.round).toBe(2);
    expect(activeUnit(second).id).toBe('enemy-0');
    expect(chooseEnemyAction(second, CATALOG)).toEqual({ type: 'charge', weapon: 'rightHand' });
    // Read from the pilot's side in the round before: its next turn is the one it winds up in.
    const mine = enemyTurn(pass(s)).after;
    expect(mine.round).toBe(2);
    expect(activeUnit(mine).id).toBe('player');
    expect(nextTurnRound(mine, foe(mine))).toBe(2);
    expect(intentOf(mine, foe(mine), CATALOG)).toEqual({ kind: 'charge' });
  });
});

describe('the game\'s own pilot against a machine that has kept energy', () => {
  test('`saving` is a machine that has kept at least half of what its core holds', () => {
    const s = against(SLOW);
    const kept = (amount: number): boolean => saving({ ...foe(s), kept: amount }, CATALOG);
    expect(bufferRoom(foe(s), CATALOG)).toBe(180);
    expect([0, 1, 89, 90, 180].map(kept)).toEqual([false, false, false, true, true]);
    // A machine with no buffer keeps nothing and is never saving.
    const plain = against(SLOW, ENEMIES.argent);
    expect(saving(foe(plain), CATALOG)).toBe(false);
    expect(saving({ ...foe(plain), kept: 500 }, CATALOG)).toBe(true);
    expect(foe(plain).buffer).toBe(0);
  });

  test('it braces first in the turn before the kept energy is spent, and not in the turn after, whoever moves first', () => {
    // Moving second: the works pilot has held, and fires next.
    const second = enemyTurn(against(SLOW)).after;
    expect(saving(foe(second), CATALOG)).toBe(true);
    expect(chooseAutoPlayerAction(second, CATALOG)).toEqual({ type: 'guard' });
    const open = enemyTurn(pass(second)).after;
    expect(saving(foe(open), CATALOG)).toBe(false);
    expect(chooseAutoPlayerAction(open, CATALOG).type).not.toBe('guard');
    // Moving first: nothing is kept yet in the first round; in the second it is.
    const first = against(QUICK);
    expect(activeUnit(first).id).toBe('player');
    expect(chooseAutoPlayerAction(first, CATALOG).type).not.toBe('guard');
    const braced = enemyTurn(pass(first)).after;
    expect(braced.round).toBe(2);
    expect(chooseAutoPlayerAction(braced, CATALOG)).toEqual({ type: 'guard' });
  });

  test('`looming` is kept energy that is about to come down as one hit: a surge the machine can fire, in a turn it takes and fires in', () => {
    const held = enemyTurn(against(SLOW)).after;
    expect(looming(held, foe(held), CATALOG)).toBe(true);
    // Not while it has kept too little to matter.
    expect(looming(held, { ...foe(held), kept: 89 }, CATALOG)).toBe(false);
    // Not when its next turn is lost to heat: what it kept waits a round longer.
    const cooked = edit(held, (d) => { foe(d).overheated = true; });
    expect(looming(cooked, foe(cooked), CATALOG)).toBe(false);
    // Not when its next turn is one it holds in: after that lost turn it is the third round, and it braces again.
    const third = pass(cooked);
    expect([third.round, nextTurnRound(third, foe(third)), foe(third).kept]).toEqual([2, 3, 180]);
    expect(looming(third, foe(third), CATALOG)).toBe(false);
    expect(chooseAutoPlayerAction(third, CATALOG).type).not.toBe('guard');
    // Not with its arms gone: the surge is in its hand, and a hand weapon needs arms.
    const armless = edit(held, (d) => { foe(d).parts.arms!.ap = 0; });
    expect(looming(armless, foe(armless), CATALOG)).toBe(false);
    expect(chooseAutoPlayerAction(armless, CATALOG).type).not.toBe('guard');
    // Nor with the surge shot dry.
    const dry = edit(held, (d) => { foe(d).ammo.rightHand = 0; });
    expect(looming(dry, foe(dry), CATALOG)).toBe(false);
    // A surge on the shoulder needs no arms.
    const back = edit(armless, (d) => { foe(d).build = { ...foe(d).build, rightHand: undefined, shoulder: 'wpn-spillway' }; });
    expect(looming(back, foe(back), CATALOG)).toBe(true);
    // And not of a machine that carries no surge, however much it has kept: any other weapon costs what it costs.
    const other = edit(held, (d) => { foe(d).build = { ...foe(d).build, rightHand: 'wpn-enemy-pinpoint' }; });
    expect(saving(foe(other), CATALOG)).toBe(true);
    expect(looming(other, foe(other), CATALOG)).toBe(false);
  });

  test('a copy of the pilot\'s own Solstice that keeps a little of every turn is nothing to brace for: two blades go on striking', () => {
    const build: Build = {
      head: 'head-solstice', core: 'core-solstice', arms: 'arms-solstice', legs: 'legs-solstice', generator: 'gen-tidal', booster: 'bst-phase',
      fcs: 'fcs-surgeon', module: 'mod-oracle', rightHand: 'wpn-arc-blade', leftHand: 'wpn-gavel',
    };
    expect(validatePlayerBuild(build, CATALOG)).toEqual([]);
    const mirror = mirrorEnemy({ ...newGame(CATALOG, STARTER_BUILD), build }, 'Mirror');
    let s = createBattle(build, [mirror], CATALOG, 1);
    // The copy has kept all its core holds: what a few turns' leftovers come to.
    s = edit(s, (d) => { foe(d).kept = bufferRoom(foe(d), CATALOG); });
    if (activeUnit(s).id !== 'player') s = enemyTurn(s).after;
    expect(saving(foe(s), CATALOG)).toBe(true);
    expect(looming(s, foe(s), CATALOG)).toBe(false);
    // A guard would rule out the boost every blade needs: the pilot boosts in, as it always did.
    const turn: string[] = [];
    for (let guard = 0; guard < 8 && activeUnit(s).id === 'player' && s.outcome === 'ongoing'; guard++) {
      const action = chooseAutoPlayerAction(s, CATALOG);
      turn.push(action.type);
      if (action.type === 'endTurn') break;
      s = applyAction(s, action, CATALOG, hit);
    }
    expect(turn).not.toContain('guard');
    expect(turn).toContain('boost');
    expect(turn.filter((type) => type === 'fire').length).toBeGreaterThanOrEqual(1);
  });

  test('a guard takes the surge at six tenths: that is what the brace is for', () => {
    const second = enemyTurn(against(SLOW)).after;
    const taken = (s: BattleState): number => {
      const fired = enemyTurn(pass(s)).after;
      const shot = events(s, fired).find((e) => e.type === 'shot' && e.unit === 'enemy-0')!;
      return shot.type === 'shot' ? shot.damage ?? 0 : 0;
    };
    const bare = taken(second);
    const guarded = taken(applyAction(second, { type: 'guard' }, CATALOG));
    expect(GUARD_DAMAGE).toBe(0.6);
    expect(bare).toBeGreaterThan(60);
    expect(guarded).toBeLessThan(bare);
    expect(guarded / bare).toBeGreaterThan(0.5);
    expect(guarded / bare).toBeLessThanOrEqual(0.62);
  });
});
