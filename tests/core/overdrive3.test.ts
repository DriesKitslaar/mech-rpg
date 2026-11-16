import { chooseAutoPlayerAction } from '../../src/core/ai';
import { activeUnit, applyAction, checkAction, createBattle, turnSpent, type BattleState, type OverdriveId } from '../../src/core/battle';
import type { Build, EnemyDef } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';

/** What the last review of the Overdrive found: a Second Wind thrown away on a module, and what Auto Turn does about modules. */

const hit = () => 0;
const od = { type: 'overdrive' } as const;
const me = (s: BattleState) => s.units[0];
const tank = ENEMIES.tank;
function start(build: Build, enemies: EnemyDef[], overdrive: OverdriveId, drive: number): BattleState {
  let s = createBattle(build, enemies, CATALOG, 4, { overdrive, drive });
  for (let i = 0; i < 8 && activeUnit(s).side !== 'player'; i++) s = applyAction(s, { type: 'endTurn' }, CATALOG);
  return s;
}
const uses = (id: string): number => (CATALOG[id] as { uses: number }).uses;
const ONE_USE = ['mod-overclock', 'mod-barrier', 'mod-nanites', 'mod-shock', 'mod-limiter', 'mod-aegis'];
const MORE_USES = ['mod-coolant', 'mod-chaff', 'mod-cryo'];

describe('Second Wind and the module', () => {
  test('a module with no use left is nothing Second Wind can give back: the meter is not thrown away on it', () => {
    for (const module of ONE_USE) {
      expect(uses(module), module).toBe(1);
      let s = start({ ...DEMO_BUILD, module }, [tank], 'second-wind', 100);
      s = applyAction(s, { type: 'module' }, CATALOG);
      expect(me(s), module).toMatchObject({ usedModule: true, moduleUses: 0 });
      expect(turnSpent(me(s)), module).toBe(false);
      expect(checkAction(s, od, CATALOG), module).toBe('nothingSpent');
      expect(() => applyAction(s, od, CATALOG), module).toThrow('nothingSpent');
      expect(me(s).drive, module).toBe(100);
    }
  });

  test('a module with a use left can be used again after it, so it counts as spent', () => {
    for (const module of MORE_USES) {
      expect(uses(module), module).toBeGreaterThan(1);
      let s = start({ ...DEMO_BUILD, module }, [tank], 'second-wind', 100);
      me(s).heat = 40;
      s = applyAction(s, { type: 'module' }, CATALOG);
      expect(turnSpent(me(s)), module).toBe(true);
      expect(checkAction(s, od, CATALOG), module).toBeNull();
      s = applyAction(s, od, CATALOG);
      expect(checkAction(s, { type: 'module' }, CATALOG), module).toBeNull();
    }
  });

  test('once its last use is gone, the module alone no longer counts, but anything else spent with it does', () => {
    let s = start({ ...DEMO_BUILD, module: 'mod-coolant' }, [tank], 'second-wind', 100);
    me(s).moduleUses = 1;
    me(s).heat = 40;
    s = applyAction(s, { type: 'module' }, CATALOG);
    expect(me(s).moduleUses).toBe(0);
    expect(checkAction(s, od, CATALOG)).toBe('nothingSpent');
    // A shot fired as well is a turn spent: the weapon and its energy come back, the module's use does not.
    s = applyAction(s, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' }, CATALOG, hit);
    expect(checkAction(s, od, CATALOG)).toBeNull();
    s = applyAction(s, od, CATALOG);
    expect(me(s)).toMatchObject({ fired: [], usedModule: false, moduleUses: 0 });
    expect(checkAction(s, { type: 'module' }, CATALOG)).toBe('noUses');
  });
});

describe('Auto Turn, a full meter and a module it still wants to use', () => {
  test('uses the module first: Second Wind is not taken while there is still something to do with the turn', () => {
    // A mech that has fired and is hot enough to want its coolant flush.
    let found = 0;
    for (const heat of [60, 80, 100, 120, 140, 160]) {
      let s = start({ ...DEMO_BUILD, module: 'mod-coolant' }, [tank, tank], 'second-wind', 0);
      s = applyAction(s, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' }, CATALOG, hit);
      me(s).heat = heat;
      if (chooseAutoPlayerAction(s, CATALOG).type !== 'module') continue;
      found += 1;
      // The same moment with the meter full: the module still comes first.
      me(s).drive = 100;
      expect(checkAction(s, od, CATALOG)).toBeNull();
      expect(chooseAutoPlayerAction(s, CATALOG).type, `heat ${heat}`).toBe('module');
    }
    expect(found).toBeGreaterThan(0);
  });
});
