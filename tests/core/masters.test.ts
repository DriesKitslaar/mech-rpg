import { ARCHETYPES, CLASS_AI, type Archetype } from '../../src/core/archetype';
import { CHAMPION_RANK } from '../../src/core/arena';
import { startNewCycle } from '../../src/core/campaign';
import type { Settlement } from '../../src/core/economy';
import { isValidState, newGame, type GameState } from '../../src/core/game';
import {
  MASTER_PURSE, crownHeld, crownSettlement, crownsHeld, isMaster, masterBeaten, masterEnemy, masterId, masterMission, masterPurse, mastersOpen, parseMaster,
  recordMasterWin, type Master,
} from '../../src/core/masters';
import { takesWingman } from '../../src/core/wingman';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { done } from '../helpers/app';

/**
 * The masters: seven pilots apart from the arena's ladder, each the master of one class. Any machine
 * may challenge one for a purse; beaten in a machine of their own class, a master gives up the crown.
 */

const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
/** A master to make rules with: none of the game's own. */
const QUILL: Master = {
  kind: 'duellist', name: 'Quill', build: { ...STARTER_BUILD }, paint: 'crimson', scale: 1.3, plating: 0.5,
  style: 'Two blades.', taunt: 'Come closer.', concede: 'Keep it sharp.',
};
const TEXT = { client: 'Varn Arena', win: 'The crowd roars.' };
const BILL: Settlement = { won: true, reward: 9000, ammoCost: 120, repairCost: 300, net: 8580, lines: [] };

describe('a master\'s duel is known by its id', () => {
  test('one for each class, there and back', () => {
    expect(ARCHETYPES.map(masterId)).toEqual([
      'arena-master-duellist', 'arena-master-marksman', 'arena-master-artillery', 'arena-master-lancer', 'arena-master-bastion', 'arena-master-skirmisher',
      'arena-master-allrounder',
    ]);
    for (const kind of ARCHETYPES) {
      expect(parseMaster(masterId(kind))).toBe(kind);
      expect(isMaster({ id: masterId(kind) })).toBe(true);
    }
  });

  test('nothing else is one: no class of that name, another fight of the arena, an id that only ends like one', () => {
    for (const id of ['arena-master-nobody', 'arena-master-', 'arena-master', 'arena-3', 'arena-mirror', 'cup-gold', 'master-duellist', 'xarena-master-duellist', 'arena-master-duellist-2', '']) {
      expect(parseMaster(id), id).toBeNull();
      expect(isMaster({ id }), id).toBe(false);
    }
    // A name every object has is no class.
    expect(parseMaster('arena-master-constructor')).toBeNull();
    expect(parseMaster('arena-master-toString')).toBeNull();
  });
});

describe('who may challenge', () => {
  test('the champion of the ladder, and nobody before', () => {
    expect(CHAMPION_RANK).toBe(10);
    expect([0, 1, 9].map((arenaRank) => mastersOpen({ arenaRank }))).toEqual([false, false, false]);
    expect([10, 11, 15].map((arenaRank) => mastersOpen({ arenaRank }))).toEqual([true, true, true]);
  });
});

describe('the purse', () => {
  test('is paid in full the first time a master is beaten, and a quarter of it after: master by master', () => {
    expect(MASTER_PURSE).toBe(9000);
    const game = fresh();
    expect(ARCHETYPES.map((kind) => masterPurse(game, kind))).toEqual(ARCHETYPES.map(() => 9000));
    const beaten = recordMasterWin(game, 'bastion', 'lancer');
    expect(masterPurse(beaten, 'bastion')).toBe(2250);
    expect(masterPurse(beaten, 'lancer')).toBe(9000);
    expect(ARCHETYPES.filter((kind) => masterPurse(beaten, kind) === 2250)).toEqual(['bastion']);
  });
});

describe('what is kept of a duel won', () => {
  test('in a machine of another class: the master is beaten, and the crown stays where it was', () => {
    const game = fresh();
    expect(masterBeaten(game, 'bastion')).toBe(false);
    expect(crownHeld(game, 'bastion')).toBe(false);
    expect(crownsHeld(game)).toBe(0);
    const won = recordMasterWin(game, 'bastion', 'lancer');
    expect(masterBeaten(won, 'bastion')).toBe(true);
    expect(crownHeld(won, 'bastion')).toBe(false);
    // Not the crown of the class that was flown either.
    expect(crownHeld(won, 'lancer')).toBe(false);
    expect(masterBeaten(won, 'lancer')).toBe(false);
    expect(crownsHeld(won)).toBe(0);
    expect(won.masters).toEqual(['bastion']);
    expect(won.crowns).toBeUndefined();
    // Nothing else of the game is touched, and the game given is not changed.
    expect({ ...won, masters: undefined }).toEqual({ ...game, masters: undefined });
    expect(game.masters).toBeUndefined();
  });

  test('in a machine of the master\'s own class: the crown', () => {
    const won = recordMasterWin(fresh(), 'bastion', 'bastion');
    expect(masterBeaten(won, 'bastion')).toBe(true);
    expect(crownHeld(won, 'bastion')).toBe(true);
    expect(crownsHeld(won)).toBe(1);
    expect(won.masters).toEqual(['bastion']);
    expect(won.crowns).toEqual(['bastion']);
  });

  test('a master beaten before in another machine still has a crown to give', () => {
    const first = recordMasterWin(fresh(), 'bastion', 'lancer');
    const second = recordMasterWin(first, 'bastion', 'bastion');
    expect(second.masters).toEqual(['bastion']);
    expect(second.crowns).toEqual(['bastion']);
    expect(first.crowns).toBeUndefined();
  });

  test('nothing is kept twice: a rematch changes nothing, crown or no crown', () => {
    const crowned = recordMasterWin(fresh(), 'bastion', 'bastion');
    expect(recordMasterWin(crowned, 'bastion', 'bastion')).toBe(crowned);
    expect(recordMasterWin(crowned, 'bastion', 'lancer')).toBe(crowned);
    const beaten = recordMasterWin(fresh(), 'bastion', 'lancer');
    expect(recordMasterWin(beaten, 'bastion', 'duellist')).toBe(beaten);
  });

  test('a duel in no machine of the pilot\'s own gives no crown', () => {
    const won = recordMasterWin(fresh(), 'bastion', null);
    expect(masterBeaten(won, 'bastion')).toBe(true);
    expect(crownsHeld(won)).toBe(0);
  });

  test('each master and each crown is its own, in the order they were taken', () => {
    let game = fresh();
    for (const kind of ['skirmisher', 'duellist', 'allrounder'] as const) game = recordMasterWin(game, kind, kind);
    game = recordMasterWin(game, 'lancer', 'bastion');
    expect(game.masters).toEqual(['skirmisher', 'duellist', 'allrounder', 'lancer']);
    expect(game.crowns).toEqual(['skirmisher', 'duellist', 'allrounder']);
    expect(crownsHeld(game)).toBe(3);
    expect(ARCHETYPES.filter((kind) => crownHeld(game, kind))).toEqual(['duellist', 'skirmisher', 'allrounder']);
    let all = fresh();
    for (const kind of ARCHETYPES) all = recordMasterWin(all, kind, kind);
    expect(crownsHeld(all)).toBe(7);
  });

  test('a name in the kept lists that is no class counts for nothing, and a class named twice counts once', () => {
    const kept = { masters: ['bastion', 'nobody'], crowns: ['duellist', 'nobody', 'duellist', 'constructor'] };
    expect(crownsHeld(kept)).toBe(1);
    expect(crownHeld(kept, 'duellist')).toBe(true);
    expect(masterBeaten(kept, 'bastion')).toBe(true);
    expect(masterBeaten(kept, 'duellist')).toBe(false);
  });

  test('stays when the story starts over', () => {
    // The story with Lumen, told to its verdict.
    const story = MISSIONS.filter((m) => m.phase !== 'side' && m.phase !== 'patrol' && (!m.faction || m.faction === 'lumen') && m.phase !== 'verdict').map((m) => m.id);
    let game = recordMasterWin(done(...story, 'verdict-enforce'), 'bastion', 'bastion');
    game = recordMasterWin(game, 'lancer', 'duellist');
    const again = startNewCycle({ ...game, endingSeen: true }, MISSIONS);
    expect(again.cycle).toBe(1);
    expect(again.masters).toEqual(['bastion', 'lancer']);
    expect(again.crowns).toEqual(['bastion']);
  });
});

describe('a kept game', () => {
  const kept = (extra: object): unknown => JSON.parse(JSON.stringify({ ...fresh(), ...extra }));

  test('from before there were masters loads, with nothing beaten and nothing held', () => {
    const old = kept({});
    expect((old as GameState).masters).toBeUndefined();
    expect(isValidState(old, CATALOG)).toBe(true);
    expect(crownsHeld(old as GameState)).toBe(0);
  });

  test('with masters beaten and crowns held loads as it was kept', () => {
    const game = kept({ masters: ['bastion', 'lancer'], crowns: ['bastion'] });
    expect(isValidState(game, CATALOG)).toBe(true);
    // A name a later version may know is kept, and counts for nothing here.
    expect(isValidState(kept({ masters: ['siegebreaker'], crowns: ['siegebreaker'] }), CATALOG)).toBe(true);
  });

  test('with rubbish where they are kept is refused', () => {
    const rubbish: unknown[] = ['bastion', 7, null, {}, [7], [null], [['bastion']], ['Bastion'], ['bastion!'], [''], ['a'.repeat(25)], Array.from({ length: 17 }, () => 'bastion')];
    for (const value of rubbish) {
      expect(isValidState(kept({ masters: value }), CATALOG), `masters ${JSON.stringify(value)}`).toBe(false);
      expect(isValidState(kept({ crowns: value }), CATALOG), `crowns ${JSON.stringify(value)}`).toBe(false);
    }
  });
});

describe('the opponent', () => {
  test('is the master\'s machine part for part, in their paint, plated as they are, flown as their class is flown', () => {
    const enemy = masterEnemy(QUILL);
    expect(enemy).toEqual({
      id: 'arena-master-duellist', name: 'Quill', ai: 'bruiser', sprite: 'enemy-rival', composed: true, build: QUILL.build, paint: 'crimson', plating: 0.5,
    });
    for (const kind of ARCHETYPES) expect(masterEnemy({ ...QUILL, kind }).ai, kind).toBe(CLASS_AI[kind]);
    expect(masterEnemy({ ...QUILL, kind: 'skirmisher' })).toMatchObject({ id: 'arena-master-skirmisher', ai: 'skirmisher' });
  });

  test('carries no plating when the master has none', () => {
    const { plating: _plating, ...bare } = QUILL;
    expect('plating' in masterEnemy(bare)).toBe(false);
    expect('plating' in masterEnemy({ ...QUILL, plating: 0 })).toBe(false);
  });
});

describe('the duel as a contract', () => {
  test('is one battle in the arena against the master, scaled as they are, for the purse, and names the crown', () => {
    const game = fresh();
    const mission = masterMission(game, QUILL, TEXT);
    expect(mission).toEqual({
      id: 'arena-master-duellist', phase: 'patrol', title: 'Quill', client: 'Varn Arena', briefing: ['Two blades.', '"Come closer."'], debrief: 'The crowd roars.',
      reward: 9000, battles: [{ enemies: ['arena-master-duellist'], background: 'bg-arena' }], scale: 1.3, crown: 'duellist',
    });
    expect(mission.battles[0].enemies).toEqual([masterEnemy(QUILL).id]);
    // It is no rung of the ladder.
    expect(mission.arenaRank).toBeUndefined();
    expect(masterMission(game, { ...QUILL, kind: 'bastion', scale: 1.1 }, TEXT)).toMatchObject({ id: 'arena-master-bastion', crown: 'bastion', scale: 1.1 });
  });

  test('pays a quarter to a pilot who has beaten that master before', () => {
    const beaten = recordMasterWin(fresh(), 'duellist', 'lancer');
    expect(masterMission(beaten, QUILL, TEXT).reward).toBe(2250);
    expect(masterMission(beaten, { ...QUILL, kind: 'bastion' }, TEXT).reward).toBe(9000);
  });

  test('is one against one: no second pilot comes', () => {
    expect(takesWingman(masterMission(fresh(), QUILL, TEXT))).toBe(false);
  });
});

describe('the settlement of a duel', () => {
  const mission = masterMission(fresh(), QUILL, TEXT);

  test('won in a machine of the master\'s class by a pilot who does not hold the crown: it says so', () => {
    const marked = crownSettlement(BILL, mission, 'duellist', fresh());
    expect(marked).toEqual({ ...BILL, crowned: 'duellist' });
    expect(BILL.crowned).toBeUndefined();
  });

  test('says nothing of a crown otherwise: lost, another class, no class, a crown already held, or a contract that names none', () => {
    const game = fresh();
    expect(crownSettlement({ ...BILL, won: false }, mission, 'duellist', game)).toEqual({ ...BILL, won: false });
    expect(crownSettlement(BILL, mission, 'bastion', game)).toBe(BILL);
    expect(crownSettlement(BILL, mission, null, game)).toBe(BILL);
    expect(crownSettlement(BILL, mission, 'duellist', recordMasterWin(game, 'duellist', 'duellist'))).toBe(BILL);
    expect(crownSettlement(BILL, {}, 'duellist', game)).toBe(BILL);
    // Beaten before without the crown: the crown is still there to be said.
    expect(crownSettlement(BILL, mission, 'duellist', recordMasterWin(game, 'duellist', 'lancer')).crowned).toBe('duellist');
  });

  test.each(ARCHETYPES.map((kind) => [kind]))('the crown is the %s\'s for a duel with their master, and nobody else\'s', (kind) => {
    const theirs = masterMission(fresh(), { ...QUILL, kind: kind as Archetype }, TEXT);
    for (const flown of ARCHETYPES) {
      expect(crownSettlement(BILL, theirs, flown, fresh()).crowned, flown).toBe(flown === kind ? kind : undefined);
    }
  });
});
