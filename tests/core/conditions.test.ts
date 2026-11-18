import { completeMission, decide, reached } from '../../src/core/campaign';
import { checksHeld } from '../../src/core/codex';
import { newGame, type GameState } from '../../src/core/game';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';

const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const did = (...ids: string[]): GameState => ids.reduce((g, id) => completeMission(g, id, MISSIONS), fresh());
const is = (game: GameState, condition: string): boolean => reached(game, condition, MISSIONS);

describe('what a condition can wait for, as before', () => {
  test('the start, a contract by its id, the choice of a client, a finale, a verdict', () => {
    expect(is(fresh(), 'start')).toBe(true);
    expect(is(fresh(), 'intro-1')).toBe(false);
    expect(is(did('intro-1'), 'intro-1')).toBe(true);
    expect(is(did('choice-lumen'), 'choice')).toBe(true);
    expect(is(did('choice-lumen'), 'choice-hadron')).toBe(false);
    expect(is(did('finale-undertow'), 'finale')).toBe(true);
    expect(is(did('verdict-default'), 'verdict')).toBe(true);
    expect(is(did('finale-undertow'), 'verdict')).toBe(false);
  });

  test('an answer to a question, and an arena rank', () => {
    const vouched = decide(fresh(), 'kite', 'vouch');
    expect(is(vouched, 'chose:kite=vouch')).toBe(true);
    expect(is(vouched, 'chose:kite=pass')).toBe(false);
    expect(is(fresh(), 'chose:kite=vouch')).toBe(false);
    expect(is({ ...fresh(), arenaRank: 3 }, 'arena:3')).toBe(true);
    expect(is({ ...fresh(), arenaRank: 2 }, 'arena:3')).toBe(false);
  });
});

describe('what a condition can wait for now', () => {
  test('the cycle: the second telling is cycle 1', () => {
    expect(is(fresh(), 'cycle:1')).toBe(false);
    expect(is({ ...fresh(), cycle: 1 }, 'cycle:1')).toBe(true);
    expect(is({ ...fresh(), cycle: 3 }, 'cycle:1')).toBe(true);
    expect(is({ ...fresh(), cycle: 1 }, 'cycle:2')).toBe(false);
    expect(is(fresh(), 'cycle:0')).toBe(true);
  });

  test('an S rank on a contract, which outlasts the cycle it was earned in', () => {
    expect(is({ ...fresh(), ranks: { 'hadron-1': 'S' } }, 's:hadron-1')).toBe(true);
    expect(is({ ...fresh(), ranks: { 'hadron-1': 'A' } }, 's:hadron-1')).toBe(false);
    expect(is({ ...fresh(), ranks: { 'hadron-2': 'S' } }, 's:hadron-1')).toBe(false);
    expect(is(did('hadron-1'), 's:hadron-1')).toBe(false);
  });

  test('the deepest floor of the Gauntlet', () => {
    expect(is(fresh(), 'floor:5')).toBe(false);
    expect(is({ ...fresh(), gauntletBest: 4 }, 'floor:5')).toBe(false);
    expect(is({ ...fresh(), gauntletBest: 5 }, 'floor:5')).toBe(true);
    expect(is({ ...fresh(), gauntletBest: 12 }, 'floor:5')).toBe(true);
  });

  test('checks held: what the game has found whose id begins with check-', () => {
    const held = (n: number): GameState => ({ ...fresh(), codex: ['varn', 'paper-rhyme', ...Array.from({ length: n }, (_, i) => `check-${i}`)] });
    expect(checksHeld(held(0))).toBe(0);
    expect(checksHeld(held(8))).toBe(8);
    expect(is(held(8), 'checks:9')).toBe(false);
    expect(is(held(9), 'checks:9')).toBe(true);
    expect(is(held(11), 'checks:9')).toBe(true);
  });
});

describe('conditions joined', () => {
  const game = decide({ ...did('intro-1', 'intro-2'), cycle: 1 }, 'logs', 'keep');

  test('all of: every part has to hold', () => {
    expect(is(game, 'cycle:1&intro-2')).toBe(true);
    expect(is(game, 'cycle:1&intro-2&chose:logs=keep')).toBe(true);
    expect(is(game, 'cycle:1&rival-1')).toBe(false);
    expect(is(game, 'cycle:2&intro-2')).toBe(false);
  });

  test('any of: one part is enough', () => {
    expect(is(game, 'rival-1|intro-2')).toBe(true);
    expect(is(game, 'rival-1|cycle:2')).toBe(false);
    expect(is(game, 'chose:logs=keep|chose:logs=sell')).toBe(true);
    expect(is(fresh(), 'chose:logs=keep|chose:logs=sell')).toBe(false);
  });

  test('not: the part must not hold', () => {
    expect(is(game, '!rival-1')).toBe(true);
    expect(is(game, '!intro-1')).toBe(false);
    expect(is(game, 'intro-1&!chose:logs=sell')).toBe(true);
    expect(is(game, 'intro-1&!chose:logs=keep')).toBe(false);
  });

  test('any of binds loosest: a|b&c is a, or b and c', () => {
    expect(is(game, 'rival-1|intro-1&cycle:1')).toBe(true);
    expect(is(game, 'rival-1|intro-1&cycle:2')).toBe(false);
    expect(is(game, 'intro-1|rival-1&cycle:2')).toBe(true);
    expect(is(game, 'cycle:2&intro-1|rival-1')).toBe(false);
  });

  test('an id with a dash in it is still one id', () => {
    expect(is(did('choice-undertow', 'finale-undertow'), 'finale-undertow|cycle:1&finale')).toBe(true);
    expect(is(did('choice-lumen', 'finale-lumen'), 'finale-undertow|cycle:1&finale')).toBe(false);
    expect(is({ ...did('choice-lumen', 'finale-lumen'), cycle: 1 }, 'finale-undertow|cycle:1&finale')).toBe(true);
  });
});
