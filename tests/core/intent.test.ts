import { chooseAutoPlayerAction, chooseEnemyAction } from '../../src/core/ai';
import { activeUnit, applyAction, createBattle } from '../../src/core/battle';
import { intentOf, nextTurnRound } from '../../src/core/intent';
import { startMissionBattle } from '../../src/core/mission';
import { ALL_ENEMIES } from '../../src/content/arena';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';

describe('reading what an enemy is about to do', () => {
  test('what is read is what happens: over every first battle of the story, every shot lands where the enemy was aiming', () => {
    let shots = 0;
    let darts = 0;
    let read = 0;
    for (const mission of MISSIONS) {
      let s = startMissionBattle(DEMO_BUILD, mission, 0, ALL_ENEMIES, CATALOG, 7);
      for (let i = 0; i < 400 && s.outcome === 'ongoing'; i++) {
        const unit = activeUnit(s);
        if (unit.side === 'player') { s = applyAction(s, chooseAutoPlayerAction(s, CATALOG), CATALOG); continue; }
        const intent = intentOf(s, unit);
        const action = chooseEnemyAction(s, CATALOG);
        expect(intent).not.toBeNull();
        if (action.type === 'fire' && intent!.kind === 'aim') { shots += 1; expect(action.part, `${mission.id} ${unit.kind}`).toBe(intent!.part); }
        if (intent!.kind === 'dart' && action.type === 'boost') darts += 1;
        if (action.type === 'mend') expect(intent!.kind).toBe('mend');
        read += 1;
        s = applyAction(s, action, CATALOG);
      }
    }
    expect(shots).toBeGreaterThan(200);
    expect(darts).toBeGreaterThan(3);
    expect(read).toBeGreaterThan(shots);
  });

  test('a turn still to come is read for this round, one already taken for the next', () => {
    const s = createBattle(DEMO_BUILD, [ALL_ENEMIES['recon-drone'], ALL_ENEMIES['recon-drone']], CATALOG, 2);
    const [first, ...rest] = s.order.map((id) => s.units.find((u) => u.id === id)!);
    expect(nextTurnRound(s, first)).toBe(1);
    const after = applyAction(s, { type: 'endTurn' }, CATALOG);
    if (after.round === 1) expect(nextTurnRound(after, after.units.find((u) => u.id === first.id)!)).toBe(2);
    expect(rest.length).toBe(2);
  });

  test('nothing is read for the pilot or for a wreck, and a bomb reads as its fuse', () => {
    const s = createBattle(DEMO_BUILD, [ALL_ENEMIES['recon-drone']], CATALOG, 2);
    expect(intentOf(s, s.units[0])).toBeNull();
    expect(intentOf(s, { ...s.units[1], destroyed: true })).toBeNull();
    expect(intentOf(s, { ...s.units[1], fuse: 2 })).toEqual({ kind: 'fuse', turns: 2 });
    expect(intentOf(s, { ...s.units[1], staggered: 1 })).toEqual({ kind: 'reeling' });
  });

  test('every reading has a short word for the target panel', () => {
    const T = STRINGS.intent;
    expect([T.aim('head'), T.aim('core'), T.aim('legs'), T.aim('arms'), T.dart, T.mend, T.charge]).toEqual(
      ['AIMS HEAD', 'AIMS CORE', 'AIMS LEGS', 'AIMS ARMS', 'DARTING', 'MENDING', 'CHARGING']);
  });
});
