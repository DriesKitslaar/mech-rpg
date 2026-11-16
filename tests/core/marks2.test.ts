import { MARK, activeUnit, applyAction, createBattle, type BattleState, type EnemyMark } from '../../src/core/battle';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';

const mech = ENEMIES['heavy-mech'];
const drone = ENEMIES['recon-drone'];
const unit = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!;
const armour = (s: BattleState, id: string): number => Object.values(unit(s, id).parts).reduce((sum, p) => sum + (p?.maxAp ?? 0), 0);
const endTurn = (s: BattleState): BattleState => applyAction(s, { type: 'endTurn' }, CATALOG);
function until(s: BattleState, done: (s: BattleState) => boolean): BattleState {
  for (let i = 0; i < 60 && !done(s) && s.outcome === 'ongoing'; i++) s = endTurn(s);
  return s;
}

describe('what a mark is worth', () => {
  test('two fifths more armour, a quarter more damage, fifteen in a hundred harder to hit, a barrier of a tenth of the armour', () => {
    expect(MARK).toEqual({ armour: 0.4, damage: 1.25, evasion: 15, shield: 0.1 });
  });
});

describe('a shielded elite\'s barrier', () => {
  /** A battle at the pilot's turn in which another machine has its turn between the pilot's and the elite's. */
  function arranged(): { s: BattleState; elite: string; between: string } {
    for (const at of [0, 1]) {
      for (let seed = 1; seed <= 12; seed++) {
        const s = until(createBattle(DEMO_BUILD, [mech, drone], CATALOG, seed, { marks: { [at]: 'shielded' } }), (b) => activeUnit(b).side === 'player');
        const next = s.order[s.turn + 1];
        if (next && next !== `enemy-${at}`) return { s, elite: `enemy-${at}`, between: next };
      }
    }
    throw new Error('no order puts another machine between the pilot and the elite');
  }

  test('is not mended by anybody else\'s turn: worn by the pilot, it is still worn when the next machine moves, and whole when the elite does', () => {
    const { s: start, elite, between } = arranged();
    const shield = unit(start, elite).barrier;
    expect(shield).toBe(Math.round(armour(start, elite) * 0.1));
    let s = applyAction(start, { type: 'fire', weapon: 'rightHand', target: elite, part: 'core' }, CATALOG, () => 0);
    const worn = unit(s, elite).barrier;
    expect(worn).toBeLessThan(shield);
    s = endTurn(s);
    // The machine between them is up: its turn has begun, and the elite's barrier is as the pilot left it.
    expect(activeUnit(s).id).toBe(between);
    expect(unit(s, elite).barrier).toBe(worn);
    // Until the elite's own turn begins, nothing mends it.
    for (let i = 0; i < 6 && activeUnit(s).id !== elite && s.outcome === 'ongoing'; i++) {
      expect(unit(s, elite).barrier, activeUnit(s).id).toBe(worn);
      s = endTurn(s);
    }
    expect(activeUnit(s).id).toBe(elite);
    expect(unit(s, elite).barrier).toBe(shield);
  });

  test('is a tenth of the armour the machine came with, however much of it is left', () => {
    let s = until(createBattle(DEMO_BUILD, [mech, drone], CATALOG, 4, { marks: { 0: 'shielded' } }), (b) => activeUnit(b).side === 'player');
    const shield = unit(s, 'enemy-0').barrier;
    // Most of its armour gone, and the barrier with it.
    for (const part of Object.values(unit(s, 'enemy-0').parts)) if (part) part.ap = Math.max(1, Math.round(part.maxAp * 0.2));
    unit(s, 'enemy-0').barrier = 0;
    s = endTurn(s);
    s = until(s, (b) => activeUnit(b).id === 'enemy-0');
    expect(activeUnit(s).id).toBe('enemy-0');
    expect(unit(s, 'enemy-0').barrier).toBe(shield);
  });
});

describe('a marked carrier', () => {
  test.each(['armoured', 'shielded', 'swift', 'overclocked'] as EnemyMark[])('launches plain machines: what it sends out carries no mark (%s)', (mark) => {
    const plain = createBattle(DEMO_BUILD, [ENEMIES.carrier], CATALOG, 3);
    let s = createBattle(DEMO_BUILD, [ENEMIES.carrier], CATALOG, 3, { marks: { 0: mark } });
    expect(unit(s, 'enemy-0').mark).toBe(mark);
    s = until(s, (b) => b.units.length > 2);
    const launched = s.units[2];
    expect(launched.side).toBe('enemy');
    expect(launched.mark).toBeUndefined();
    expect(launched.barrier).toBe(0);
    // It is the machine an unmarked carrier sends out, to the last plate.
    const other = until(plain, (b) => b.units.length > 2).units[2];
    expect(launched.kind).toBe(other.kind);
    expect(armour(s, launched.id)).toBe(Object.values(other.parts).reduce((sum, p) => sum + (p?.maxAp ?? 0), 0));
    expect(launched.mods).toEqual(other.mods);
  });
});
