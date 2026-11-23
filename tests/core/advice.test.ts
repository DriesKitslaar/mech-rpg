import { adviceAfter, armourLeft, ADVICE, OUTMATCHED_SHARE } from '../../src/core/advice';
import { ROUND_LIMIT, createBattle, type BattleEvent, type BattleOptions, type BattleState } from '../../src/core/battle';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { STRINGS_NL } from '../../src/content/nl/strings';
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
  // The other side took its share: half of its armour is gone. (A defeat that barely marked them is a matter of its own.)
  for (const unit of s.units.filter((u) => u.side === 'enemy')) for (const part of Object.values(unit.parts)) part.ap = Math.floor(part.maxAp / 2);
  edit(s);
  return s;
}
/** Sets the armour every machine of the other side has left, as a share of what it came with. */
const leave = (share: number) => (s: BattleState): void => {
  for (const unit of s.units.filter((u) => u.side === 'enemy')) for (const part of Object.values(unit.parts)) part.ap = Math.round(part.maxAp * share);
};
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

  test('a pilot who flew it soundly and barely marked them is told that the machine was not up to it, before anything about repairs', () => {
    expect(OUTMATCHED_SHARE).toBeCloseTo(2 / 3);
    // Untouched, or with four fifths of their armour left: the machine. Repairs unused are not the story of such a defeat.
    expect(adviceAfter(lost(stood, {}, leave(1)))).toBe('outmatched');
    expect(adviceAfter(lost(stood, {}, (s) => { leave(0.8)(s); s.units[0].repairsLeft = 2; }))).toBe('outmatched');
    expect(adviceAfter(lost(stood, {}, (s) => { leave(0.8)(s); s.round = ROUND_LIMIT; }))).toBe('outmatched');
    // With half of it gone, it was a fight: what was left undone is said as before.
    expect(adviceAfter(lost(stood, {}, (s) => { leave(0.5)(s); s.units[0].repairsLeft = 2; }))).toBe('repairs');
    // A turn lost to heat, or no Boost and no Guard, comes first: that is flying, and the machine is not judged on it.
    expect(adviceAfter(lost([...stood, { type: 'overheat', unit: 'player' }], {}, leave(1)))).toBe('heat');
    expect(adviceAfter(lost([], {}, leave(1)))).toBe('stance');
    // What the share is taken of: all the armour the other side came with, a machine that is down counting for nothing left.
    const s = lost(stood, {}, leave(1));
    expect(armourLeft(s)).toBe(1);
    for (const part of Object.values(s.units[1].parts)) part.ap = 0;
    const whole = s.units.filter((u) => u.side === 'enemy').flatMap((u) => Object.values(u.parts)).reduce((sum, part) => sum + part.maxAp, 0);
    const left = Object.values(s.units[2].parts).reduce((sum, part) => sum + part.maxAp, 0);
    expect(armourLeft(s)).toBeCloseTo(left / whole);
    expect(armourLeft(lost(stood, {}, leave(0)))).toBe(0);
    // With nobody on the other side there is no armour left on it: none, and not all.
    const alone = lost(stood);
    alone.units = alone.units.filter((unit) => unit.side === 'player');
    expect(armourLeft(alone)).toBe(0);
    expect(adviceAfter(alone)).not.toBe('outmatched');
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
    // The Dutch fits the same three lines.
    for (const id of ADVICE) expect(wrap(STRINGS_NL.advice[id], charsFor(210)).length, id).toBeLessThanOrEqual(3);
  });
});
