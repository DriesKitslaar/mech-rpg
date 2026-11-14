import { chooseEnemyAction } from '../../src/core/ai';
import { activeUnit, applyAction, createBattle, type BattleState } from '../../src/core/battle';
import { WEAPON_SLOTS, type WeaponSlot } from '../../src/core/types';
import { weaponIn } from '../../src/core/build';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';

/**
 * Lets one enemy play against a mech that only ever ends its turn, and counts what it fires.
 * The mech is made far too tough to fall, so the enemy gets all the turns asked for.
 */
function fired(enemyId: string, turns: number, seed: number): Partial<Record<WeaponSlot, number>> {
  let s: BattleState = createBattle(REFERENCE_BUILDS.tier6, [ENEMIES[enemyId]], CATALOG, seed, { mods: { armour: 40 } });
  const counts: Partial<Record<WeaponSlot, number>> = {};
  let taken = 0;
  let seen = 0;
  for (let step = 0; step < 4000 && taken < turns && s.outcome === 'ongoing'; step++) {
    const unit = activeUnit(s);
    if (unit.side === 'player') { s = applyAction(s, { type: 'endTurn' }, CATALOG); continue; }
    const action = chooseEnemyAction(s, CATALOG);
    if (action.type === 'endTurn' && unit.id === 'enemy-0') taken += 1;
    s = applyAction(s, action, CATALOG);
    for (const event of s.events.slice(seen)) if (event.type === 'shot' && event.unit === 'enemy-0') counts[event.weapon] = (counts[event.weapon] ?? 0) + 1;
    seen = s.events.length;
  }
  return counts;
}

describe('what an enemy carries, it uses', () => {
  test.each(Object.keys(ENEMIES))('%s fires every weapon it starts with, more than once in two dozen turns', (id) => {
    const carried = WEAPON_SLOTS.filter((slot) => weaponIn(ENEMIES[id].build, slot, CATALOG));
    const counts = fired(id, 24, 11);
    for (const slot of carried) expect(counts[slot] ?? 0, `${id} ${slot}`).toBeGreaterThanOrEqual(2);
  });

  test('Ashfall, unbound, draws the edge in the last phase and still fires a gun in the turns it strikes', () => {
    // Bring the core down to the last third without destroying anything, then watch what it does.
    let s: BattleState = createBattle(REFERENCE_BUILDS.tier6, [ENEMIES['ashfall-unbound']], CATALOG, 11, { mods: { armour: 40 } });
    const before = structuredClone(s);
    const boss = before.units[1];
    boss.parts.core!.ap = Math.floor(boss.parts.core!.maxAp * 0.3);
    s = before;
    const turns: string[][] = [[]];
    for (let step = 0; step < 4000 && turns.length <= 12 && s.outcome === 'ongoing'; step++) {
      const unit = activeUnit(s);
      if (unit.side === 'player') {
        // A shot that lands lets the phases catch up with the armour; after that the pilot only watches.
        if (s.units[1].phase < 2) s = applyAction(s, { type: 'fire', weapon: 'shoulder', target: 'enemy-0', part: 'legs' }, CATALOG, () => 0);
        s = applyAction(s, { type: 'endTurn' }, CATALOG);
        continue;
      }
      const action = chooseEnemyAction(s, CATALOG);
      turns[turns.length - 1].push(action.type === 'fire' ? `fire:${action.weapon}` : action.type);
      if (action.type === 'endTurn') turns.push([]);
      s = applyAction(s, action, CATALOG);
    }
    expect(s.units[1].phase).toBe(2);
    expect(s.units[1].parts.legs!.ap).toBeGreaterThan(0);
    const striking = turns.filter((turn) => turn.includes('fire:leftHand'));
    expect(striking.length).toBeGreaterThanOrEqual(6);
    // Most of those turns a gun follows the edge; the others go to venting heat.
    const withGun = striking.filter((turn) => turn.filter((a) => a.startsWith('fire:')).length >= 2);
    expect(withGun.length, turns.map((turn) => turn.join(' ')).join(' | ')).toBeGreaterThanOrEqual(striking.length / 2);
  });
});
