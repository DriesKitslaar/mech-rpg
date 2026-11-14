import { adviceAfter, ADVICE } from '../../src/core/advice';
import { ROUND_LIMIT, createBattle, type BattleEvent, type BattleOptions, type BattleState } from '../../src/core/battle';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { charsFor, wrap } from '../../src/ui/widgets';

/** A lost battle, with whatever happened in it written in by hand. */
function lost(events: BattleEvent[] = [], opts: BattleOptions = {}, edit: (s: BattleState) => void = () => {}): BattleState {
  // A light mech first: it has the legs and arms a machine wanted in one piece must have.
  const s = structuredClone(createBattle(DEMO_BUILD, [ENEMIES['light-mech'], ENEMIES['gun-turret']], CATALOG, 1, opts));
  s.outcome = 'defeat';
  s.round = 4;
  s.events = events;
  s.units[0].repairsLeft = 0;
  edit(s);
  return s;
}
const stood: BattleEvent[] = [{ type: 'boost', unit: 'player' }, { type: 'guard', unit: 'player' }];

describe('what Dispatch says after a defeat', () => {
  test('nothing after a win, a battle still going, or a mech the pilot gave up themselves', () => {
    expect(adviceAfter(lost([], {}, (s) => { s.outcome = 'victory'; }))).toBeNull();
    expect(adviceAfter(lost([], {}, (s) => { s.outcome = 'ongoing'; }))).toBeNull();
    expect(adviceAfter(lost([], {}, (s) => { s.retreated = true; }))).toBeNull();
  });

  test('a machine wanted in one piece that was destroyed: aim at what has to come off', () => {
    const s = lost(stood, { objective: { type: 'disable', target: 0 } }, (d) => { d.units[1].destroyed = true; });
    expect(adviceAfter(s)).toBe('disable');
  });

  test('something that was to be protected and was lost: fewer enemies, sooner', () => {
    const s = lost(stood, { objective: { type: 'protect', name: 'Convoy', hp: 6 } }, (d) => { d.asset!.hp = 0; });
    expect(adviceAfter(s)).toBe('protect');
  });

  test('a pilot who overheated is told about venting', () => {
    expect(adviceAfter(lost([...stood, { type: 'overheat', unit: 'player' }]))).toBe('heat');
    // An enemy that overheats is no reason.
    expect(adviceAfter(lost([...stood, { type: 'overheat', unit: 'enemy-0' }]))).not.toBe('heat');
  });

  test('a pilot who never boosted and never guarded is told about both', () => {
    expect(adviceAfter(lost([]))).toBe('stance');
    expect(adviceAfter(lost([{ type: 'boost', unit: 'enemy-0' }]))).toBe('stance');
    expect(adviceAfter(lost([{ type: 'guard', unit: 'player' }]))).not.toBe('stance');
    expect(adviceAfter(lost([{ type: 'boost', unit: 'player' }]))).not.toBe('stance');
  });

  test('a pilot who went down with field repairs unused is told when to use them', () => {
    expect(adviceAfter(lost(stood, {}, (s) => { s.units[0].repairsLeft = 1; }))).toBe('repairs');
  });

  test('a battle that ran out of rounds is about firepower', () => {
    expect(adviceAfter(lost(stood, {}, (s) => { s.round = ROUND_LIMIT; }))).toBe('time');
  });

  test('otherwise one of three general things, the same one for the same battle', () => {
    const general = new Set<string | null>();
    for (let round = 1; round <= 9; round++) general.add(adviceAfter(lost(stood, {}, (s) => { s.round = round; })));
    expect([...general].sort()).toEqual(['auto', 'drills', 'patrol']);
    expect(adviceAfter(lost(stood))).toBe(adviceAfter(lost(stood)));
  });

  test('what went most plainly wrong is said first: the contract\'s own terms, then heat, then stance, then repairs', () => {
    const everything: BattleEvent[] = [{ type: 'overheat', unit: 'player' }];
    const s = lost(everything, { objective: { type: 'disable', target: 0 } }, (d) => { d.units[1].destroyed = true; d.units[0].repairsLeft = 2; });
    expect(adviceAfter(s)).toBe('disable');
    expect(adviceAfter(lost(everything, {}, (d) => { d.units[0].repairsLeft = 2; }))).toBe('heat');
    expect(adviceAfter(lost([], {}, (d) => { d.units[0].repairsLeft = 2; }))).toBe('stance');
  });

  test('every piece of advice has words, and they fit three lines of the settlement', () => {
    expect(Object.keys(STRINGS.advice).sort()).toEqual([...ADVICE].sort());
    for (const id of ADVICE) {
      const text = STRINGS.advice[id];
      expect(wrap(text, charsFor(210)).length, text).toBeLessThanOrEqual(3);
      // It names actions as the menu does.
      expect(text).not.toMatch(/\bCool\b|brace/i);
    }
    expect(STRINGS.advice.stance).toContain(STRINGS.actions.boost);
    expect(STRINGS.advice.stance).toContain(STRINGS.actions.guard);
    expect(STRINGS.advice.heat).toContain(STRINGS.actions.cool);
  });
});
