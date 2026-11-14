import { chooseAutoPlayerAction, chooseEnemyAction } from '../../src/core/ai';
import { activeUnit, applyAction, createBattle, type Action, type BattleState } from '../../src/core/battle';
import { intentOf, nextTurnRound, type Intent } from '../../src/core/intent';
import { startMissionBattle } from '../../src/core/mission';
import { ALL_ENEMIES } from '../../src/content/arena';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';
import { STRINGS } from '../../src/content/strings';
import { intentText } from '../../src/ui/tags';

/** Plays the enemy's whole turn from its start and says what it did. */
function enemyTurn(s: BattleState): { after: BattleState; actions: Action[] } {
  const id = activeUnit(s).id;
  const actions: Action[] = [];
  for (let i = 0; i < 16 && s.outcome === 'ongoing' && activeUnit(s).id === id; i++) {
    const action = chooseEnemyAction(s, CATALOG);
    actions.push(action);
    s = applyAction(s, action, CATALOG);
  }
  return { after: s, actions };
}

/** Whether what was read is what the turn turned out to be. */
function honest(intent: Intent | null, actions: Action[]): boolean {
  const first = actions.find((a) => a.type === 'fire') as Extract<Action, { type: 'fire' }> | undefined;
  switch (intent?.kind) {
    case 'aim': return first?.part === intent.part;
    case 'dart': return actions.some((a) => a.type === 'boost');
    case 'mend': return actions.some((a) => a.type === 'mend');
    case 'charge': return actions.some((a) => a.type === 'charge') && !first;
    case 'cool': return actions.some((a) => a.type === 'cool') && !first;
    case 'fuse': case 'reeling': return true;
    default: return !first && !actions.some((a) => a.type === 'mend' || a.type === 'boost');
  }
}

describe('reading what an enemy is about to do', () => {
  test('what is read at the start of an enemy\'s turn is what that turn is, in every battle of the story, whatever the pilot does', () => {
    const kinds = new Map<string, number>();
    let turns = 0;
    for (const policy of ['auto', 'idle'] as const) {
      for (const mission of MISSIONS) {
        mission.battles.forEach((_, index) => {
          let s = startMissionBattle(policy === 'auto' ? REFERENCE_BUILDS.tier6 : DEMO_BUILD, mission, index, ALL_ENEMIES, CATALOG, 7);
          for (let i = 0; i < 300 && s.outcome === 'ongoing'; i++) {
            const unit = activeUnit(s);
            if (unit.side === 'player') { s = applyAction(s, policy === 'auto' ? chooseAutoPlayerAction(s, CATALOG) : { type: 'endTurn' }, CATALOG); continue; }
            const intent = intentOf(s, unit, CATALOG);
            const { after, actions } = enemyTurn(s);
            expect(honest(intent, actions), `${mission.id}/${index} ${unit.kind} read ${JSON.stringify(intent)} did ${actions.map((a) => a.type).join(',')}`).toBe(true);
            kinds.set(intent?.kind ?? 'none', (kinds.get(intent?.kind ?? 'none') ?? 0) + 1);
            turns += 1;
            s = after;
          }
        });
      }
    }
    expect(turns).toBeGreaterThan(1500);
    for (const kind of ['aim', 'dart', 'charge', 'cool', 'none']) expect(kinds.get(kind) ?? 0, kind).toBeGreaterThan(0);
  });

  test('read a turn ahead, while the pilot is still choosing, it holds if the pilot then does nothing', () => {
    let held = 0;
    let read = 0;
    for (const mission of MISSIONS) {
      let s = startMissionBattle(DEMO_BUILD, mission, 0, ALL_ENEMIES, CATALOG, 11);
      for (let round = 0; round < 6 && s.outcome === 'ongoing'; round++) {
        while (s.outcome === 'ongoing' && activeUnit(s).side !== 'player') s = enemyTurn(s).after;
        if (s.outcome !== 'ongoing') break;
        // The pilot looks at the first enemy still to move this round, then ends the turn.
        const next = s.order.slice(s.turn + 1).map((id) => s.units.find((u) => u.id === id)!).find((u) => u.side === 'enemy' && !u.destroyed);
        const intent = next ? intentOf(s, next, CATALOG) : null;
        s = applyAction(s, { type: 'endTurn' }, CATALOG);
        if (!next || s.outcome !== 'ongoing' || activeUnit(s).id !== next.id) continue;
        read += 1;
        if (honest(intent, enemyTurn(s).actions)) held += 1;
      }
    }
    expect(read).toBeGreaterThan(60);
    // A fuse that runs out or a launch in between changes the field; nearly all readings hold.
    expect(held / read).toBeGreaterThan(0.95);
  });

  test('a skirmisher without legs is not read as darting, and a machine with no weapon is read as nothing', () => {
    const tower = createBattle(DEMO_BUILD, [ALL_ENEMIES['lance-tower']], CATALOG, 2);
    for (let round = 1; round <= 6; round++) expect(intentOf({ ...tower, round }, tower.units[1], CATALOG)?.kind).toBe('aim');
    const guard = createBattle(DEMO_BUILD, [ALL_ENEMIES['light-mech']], CATALOG, 2);
    const legless = structuredClone(guard);
    legless.units[1].parts.legs!.ap = 0;
    expect(intentOf({ ...guard, round: 3, turn: 0, order: ['player', 'enemy-0'] }, guard.units[1], CATALOG)?.kind).toBe('dart');
    expect(intentOf({ ...legless, round: 3, turn: 0, order: ['player', 'enemy-0'] }, legless.units[1], CATALOG)?.kind).toBe('aim');
    const mast = createBattle(DEMO_BUILD, [ALL_ENEMIES.jammer, ALL_ENEMIES['recon-drone']], CATALOG, 2);
    expect(intentOf(mast, mast.units[1], CATALOG)).toBeNull();
  });

  test('a repair drone is read as mending only while one of its own is hurt', () => {
    const s = createBattle(DEMO_BUILD, [ALL_ENEMIES['repair-drone'], ALL_ENEMIES.tank], CATALOG, 2);
    expect(intentOf(s, s.units[1], CATALOG)?.kind).not.toBe('mend');
    const hurt = structuredClone(s);
    hurt.units[2].parts.core!.ap -= 30;
    expect(intentOf(hurt, hurt.units[1], CATALOG)).toEqual({ kind: 'mend' });
  });

  test('a turn still to come is read for this round, one already taken for the next', () => {
    const s = createBattle(DEMO_BUILD, [ALL_ENEMIES['recon-drone'], ALL_ENEMIES['recon-drone']], CATALOG, 2);
    const order = s.order.map((id) => s.units.find((u) => u.id === id)!);
    expect(order.map((u) => nextTurnRound(s, u))).toEqual([1, 1, 1]);
    expect(order.map((u) => nextTurnRound({ ...s, turn: 2 }, u))).toEqual([2, 2, 1]);
  });

  test('nothing is read for the pilot or for a wreck, a bomb reads as its fuse, and tripped heat as cooling', () => {
    const s = createBattle(DEMO_BUILD, [ALL_ENEMIES['recon-drone']], CATALOG, 2);
    const as = (over: object) => { const c = structuredClone(s); Object.assign(c.units[1], over); return intentOf(c, c.units[1], CATALOG); };
    expect(intentOf(s, s.units[0], CATALOG)).toBeNull();
    expect(as({ destroyed: true })).toBeNull();
    expect(as({ fuse: 2 })).toEqual({ kind: 'fuse', turns: 2 });
    expect(as({ staggered: 1 })).toEqual({ kind: 'reeling' });
    const hot = structuredClone(s);
    hot.units[1].overheated = true;
    hot.order = ['player', 'enemy-0'];
    hot.turn = 0;
    expect(intentOf(hot, hot.units[1], CATALOG)).toEqual({ kind: 'cool' });
  });

  test('every reading has a short word for the target panel; a fuse and a stagger have tags of their own', () => {
    const T = STRINGS.intent;
    expect([T.aim('head'), T.aim('core'), T.aim('legs'), T.aim('arms'), T.dart, T.mend, T.cool, T.windUp]).toEqual(
      ['AIMS HEAD', 'AIMS CORE', 'AIMS LEGS', 'AIMS ARMS', 'DARTING', 'MENDING', 'COOLING', 'WINDS UP']);
    expect(intentText({ kind: 'charge' })).toBe('WINDS UP');
    expect(intentText({ kind: 'fuse', turns: 2 })).toBeNull();
    expect(intentText({ kind: 'reeling' })).toBeNull();
    expect(intentText(null)).toBeNull();
  });
});
