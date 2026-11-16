import { MARK, MARKS, activeUnit, applyAction, createBattle, previewShot, type BattleState, type EnemyMark } from '../../src/core/battle';
import { startMissionBattle } from '../../src/core/mission';
import type { Mission } from '../../src/core/campaign';
import { ALL_ENEMIES } from '../../src/content/arena';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';

const mech = ENEMIES['heavy-mech'];
const drone = ENEMIES['recon-drone'];
const battle = (mark?: EnemyMark, scale = 1): BattleState =>
  createBattle(DEMO_BUILD, [mech, drone], CATALOG, 4, { enemyScale: scale, ...(mark ? { marks: { 0: mark } } : {}) });
const total = (s: BattleState, id = 'enemy-0') => Object.values(s.units.find((u) => u.id === id)!.parts).reduce((sum, p) => sum + (p?.maxAp ?? 0), 0);
/** Ends turns until the given unit has had its turn `times` over. */
function until(s: BattleState, done: (s: BattleState) => boolean): BattleState {
  for (let i = 0; i < 40 && !done(s) && s.outcome === 'ongoing'; i++) s = applyAction(s, { type: 'endTurn' }, CATALOG);
  return s;
}

describe('an elite enemy', () => {
  test('there are four marks, and an enemy without one is as it always was', () => {
    expect(MARKS).toEqual(['armoured', 'overclocked', 'swift', 'shielded']);
    const plain = battle();
    expect(plain.units[1].mark).toBeUndefined();
    expect(plain).toEqual(createBattle(DEMO_BUILD, [mech, drone], CATALOG, 4, { enemyScale: 1, marks: {} }));
  });

  test('only the one that is marked is changed: the machine beside it is as it was', () => {
    for (const mark of MARKS) {
      const s = battle(mark);
      expect(s.units[1].mark).toBe(mark);
      expect(s.units[2]).toEqual(battle().units[2]);
      expect(s.units[0]).toEqual(battle().units[0]);
    }
  });

  test('armoured: two fifths more armour on every part, on top of what the floor\'s scale gives, and no more stability', () => {
    const plain = battle(undefined, 1.2);
    const marked = battle('armoured', 1.2);
    for (const [slot, part] of Object.entries(marked.units[1].parts)) {
      const base = CATALOG[mech.build[slot as 'core']!] as { ap: number };
      expect(part!.maxAp, slot).toBe(Math.round(base.ap * (1 + MARK.armour) * 1.2));
      expect(part!.ap).toBe(part!.maxAp);
    }
    expect(total(marked)).toBeGreaterThan(total(plain) * 1.38);
    expect(marked.units[1].staggerMax).toBe(plain.units[1].staggerMax);
    expect(previewShot(marked, 'enemy-0', 'rightHand', 'player', 'core', CATALOG)).toEqual(previewShot(plain, 'enemy-0', 'rightHand', 'player', 'core', CATALOG));
  });

  test('overclocked: a quarter more damage from every weapon, and nothing else', () => {
    const plain = battle();
    const marked = battle('overclocked');
    const shot = (s: BattleState) => previewShot(s, 'enemy-0', 'rightHand', 'player', 'core', CATALOG);
    expect(shot(marked).damage).toBe(Math.max(1, Math.round(shot(plain).damage * MARK.damage)));
    expect(shot(marked).hitChance).toBe(shot(plain).hitChance);
    expect(total(marked)).toBe(total(plain));
  });

  test('swift: fifteen in a hundred harder to hit, and nothing else', () => {
    const plain = battle();
    const marked = battle('swift');
    const at = (s: BattleState) => previewShot(s, 'player', 'rightHand', 'enemy-0', 'core', CATALOG);
    expect(at(marked).hitChance).toBe(at(plain).hitChance - MARK.evasion);
    expect(at(marked).damage).toBe(at(plain).damage);
    expect(total(marked)).toBe(total(plain));
  });

  test('shielded: a barrier of a tenth of its armour from the first moment, that takes the damage before the armour does', () => {
    const marked = battle('shielded');
    const shield = Math.round(total(marked) * MARK.shield);
    expect(marked.units[1].barrier).toBe(shield);
    let s = until(marked, (b) => activeUnit(b).side === 'player');
    // Still up when the pilot's first turn comes, whoever moved first.
    expect(s.units[1].barrier).toBe(shield);
    const core = s.units[1].parts.core!.ap;
    s = applyAction(s, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' }, CATALOG, () => 0);
    expect(s.units[1].barrier).toBeLessThan(shield);
    expect(s.units[1].parts.core!.ap).toBeGreaterThan(core - previewShot(battle(), 'player', 'rightHand', 'enemy-0', 'core', CATALOG).damage);
  });

  test('shielded: the barrier is raised whole again at every turn of its own, and never by anyone else\'s', () => {
    let s = until(battle('shielded'), (b) => activeUnit(b).side === 'player');
    const shield = s.units[1].barrier;
    s = applyAction(s, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' }, CATALOG, () => 0);
    const worn = s.units[1].barrier;
    expect(worn).toBeLessThan(shield);
    // The drone's turn does not mend the mech's barrier; the mech's own does.
    s = applyAction(s, { type: 'endTurn' }, CATALOG);
    const seen: number[] = [];
    for (let i = 0; i < 12 && s.outcome === 'ongoing' && seen.length < 3; i++) {
      const who = activeUnit(s).id;
      if (who !== 'enemy-0' && who !== 'player') expect(s.units[1].barrier === worn || s.units[1].barrier === shield).toBe(true);
      if (who === 'enemy-0') { expect(s.units[1].barrier).toBe(shield); seen.push(s.units[1].barrier); }
      s = applyAction(s, { type: 'endTurn' }, CATALOG);
    }
    expect(seen.length).toBeGreaterThan(0);
    // An enemy with no mark has no barrier to raise.
    expect(until(battle(), (b) => activeUnit(b).id === 'enemy-0').units[1].barrier).toBe(0);
  });

  test('a contract names its elites by their place in the battle, and the battle is set up with them', () => {
    const mission: Mission = {
      id: 'x', title: 'X', phase: 'patrol', client: 'c', briefing: [], debrief: '', reward: 0,
      battles: [{ enemies: ['recon-drone', 'heavy-mech'], background: 'bg-vault', marks: { 1: 'swift' } }, { enemies: ['recon-drone'], background: 'bg-vault' }],
    };
    const first = startMissionBattle(DEMO_BUILD, mission, 0, ALL_ENEMIES, CATALOG, 3);
    expect(first.units.map((u) => u.mark)).toEqual([undefined, undefined, 'swift']);
    const won = { ...first, outcome: 'victory' as const };
    expect(startMissionBattle(DEMO_BUILD, mission, 1, ALL_ENEMIES, CATALOG, 3, won).units.map((u) => u.mark)).toEqual([undefined, undefined]);
  });
});
