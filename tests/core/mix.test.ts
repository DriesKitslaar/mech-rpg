import { isValidState, newGame, setPaint, type GameState } from '../../src/core/game';
import { mirrorEnemy } from '../../src/core/arena';
import {
  DEFAULT_MIXES, MIX_KEYS, MIX_SHAPE, MIX_SLOTS, MIX_STEPS, isMix, likenessPaint, mixId, mixesOf, parseMix, setMix, stepMix, type Mix,
} from '../../src/core/mix';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';

/** A paint of the pilot's own mixing, as the rules have it: five steps and the place it is kept in, written as the paint's own name. */

const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const mix = (slot: number, hue: number, finish: number, shade: number, trim: number, glow: number): Mix => ({ slot, hue, finish, shade, trim, glow });

describe('what a mix is', () => {
  test('five things in so many steps each, and three places to keep one', () => {
    expect(MIX_STEPS).toEqual({ hue: 24, finish: 4, shade: 5, trim: 24, glow: 3 });
    expect(MIX_KEYS).toEqual(['hue', 'finish', 'shade', 'trim', 'glow']);
    expect(MIX_SLOTS).toBe(3);
    // Every paint there is to mix.
    expect(MIX_KEYS.reduce((all, key) => all * MIX_STEPS[key], 1)).toBe(34_560);
  });

  test('its name as a paint says which of the three it is and its five steps, in that order', () => {
    expect(mixId(mix(1, 14, 3, 2, 13, 2))).toBe('mix1-14-3-2-13-2');
    expect(mixId(mix(3, 0, 0, 0, 0, 0))).toBe('mix3-0-0-0-0-0');
    expect(mixId(mix(2, 23, 3, 4, 23, 2))).toBe('mix2-23-3-4-23-2');
    expect(parseMix('mix1-14-3-2-13-2')).toEqual(mix(1, 14, 3, 2, 13, 2));
    expect(parseMix('mix2-23-3-4-23-2')).toEqual(mix(2, 23, 3, 4, 23, 2));
  });

  test('every mix there is reads back from its name as it was written', () => {
    for (let slot = 1; slot <= MIX_SLOTS; slot++) {
      for (const key of MIX_KEYS) {
        for (let step = 0; step < MIX_STEPS[key]; step++) {
          const one = { ...mix(slot, 5, 1, 2, 7, 1), [key]: step };
          expect(parseMix(mixId(one)), mixId(one)).toEqual(one);
          expect(isMix(mixId(one))).toBe(true);
        }
      }
    }
  });

  test.each([
    ['a ready paint', 'crimson'], ['the word alone', 'mix'], ['no steps', 'mix1'], ['too few steps', 'mix1-1-1-1-1'], ['too many', 'mix1-1-1-1-1-1-1'],
    ['a place there is not', 'mix0-1-1-1-1-1'], ['a fourth place', 'mix4-1-1-1-1-1'], ['a colour past the wheel', 'mix1-24-0-0-0-0'], ['a fifth finish', 'mix1-0-4-0-0-0'],
    ['a sixth shade', 'mix1-0-0-5-0-0'], ['a trim past the wheel', 'mix1-0-0-0-24-0'], ['a fourth glow', 'mix1-0-0-0-0-3'], ['a step written with a nought before it', 'mix1-01-0-0-0-0'],
    ['a step below nothing', 'mix1--1-0-0-0-0'], ['something after it', 'mix1-1-1-1-1-1 '], ['something before it', ' mix1-1-1-1-1-1'], ['capitals', 'MIX1-1-1-1-1-1'],
    ['a step that is no number', 'mix1-a-1-1-1-1'], ['half a step', 'mix1-1.5-1-1-1-1'], ['nothing', ''],
  ])('%s is no mix', (_what, name) => {
    expect(parseMix(name)).toBeNull();
    expect(isMix(name)).toBe(false);
  });

  test('and neither is anything that is no text', () => {
    for (const thing of [undefined, null, 7, {}, [], ['mix1-1-1-1-1-1'], true]) {
      expect(parseMix(thing)).toBeNull();
      expect(isMix(thing)).toBe(false);
    }
  });

  test('the shape of the name is told from its numbers: a name of that shape with a step that is too high is still of that shape', () => {
    for (const name of ['mix1-14-3-2-13-2', 'mix1-99-9-9-99-9', 'mix9-0-0-0-0-0']) expect(MIX_SHAPE.test(name), name).toBe(true);
    for (const name of ['mix1-1-1-1-1', 'mix1-1-1-1-1-1-1', 'mix1-100-1-1-1-1', 'mixa-1-1-1-1-1', 'crimson', 'mix1-1-1-1-1-1;drop', 'drop;mix1-1-1-1-1-1', 'remix1-1-1-1-1-1', '']) {
      expect(MIX_SHAPE.test(name), name).toBe(false);
    }
  });
});

describe('changing one', () => {
  test('a step on, or back, goes round: past the last is the first again', () => {
    const one = mix(1, 23, 3, 4, 0, 0);
    expect(stepMix(one, 'hue', 1)).toEqual({ ...one, hue: 0 });
    expect(stepMix(one, 'hue', -1)).toEqual({ ...one, hue: 22 });
    expect(stepMix(one, 'finish', 1)).toEqual({ ...one, finish: 0 });
    expect(stepMix(one, 'shade', 1)).toEqual({ ...one, shade: 0 });
    expect(stepMix(one, 'trim', -1)).toEqual({ ...one, trim: 23 });
    expect(stepMix(one, 'glow', -1)).toEqual({ ...one, glow: 2 });
    expect(stepMix(one, 'glow', 1)).toEqual({ ...one, glow: 1 });
    // Round the whole of each and back where it began, either way; and the mix that was given is not changed.
    for (const key of MIX_KEYS) {
      let on = one;
      let back = one;
      for (let i = 0; i < MIX_STEPS[key]; i++) {
        on = stepMix(on, key, 1);
        back = stepMix(back, key, -1);
        expect(isMix(mixId(on)), `${key} ${i}`).toBe(true);
        expect(isMix(mixId(back)), `${key} ${i}`).toBe(true);
      }
      expect(on).toEqual(one);
      expect(back).toEqual(one);
    }
    expect(one).toEqual(mix(1, 23, 3, 4, 0, 0));
  });

  test('it changes that one thing and nothing else, and stays in its place', () => {
    const one = mix(2, 5, 1, 2, 7, 1);
    for (const key of MIX_KEYS) {
      const next = stepMix(one, key, 1);
      expect(next.slot).toBe(2);
      for (const other of MIX_KEYS) expect(next[other], `${key} ${other}`).toBe(other === key ? one[key] + 1 : one[other]);
    }
  });
});

describe('the three a pilot keeps', () => {
  test('as they come: one in each place, each a mix there is, no two alike', () => {
    expect(DEFAULT_MIXES.map((one) => one.slot)).toEqual([1, 2, 3]);
    for (const one of DEFAULT_MIXES) expect(parseMix(mixId(one))).toEqual(one);
    expect(new Set(DEFAULT_MIXES.map((one) => mixId(one).slice(5))).size).toBe(3);
  });

  test('a game that keeps none has them as they come: a new one, and one from before there were mixes', () => {
    expect(fresh().mixes).toBeUndefined();
    expect(mixesOf(fresh())).toEqual(DEFAULT_MIXES);
    expect(mixesOf({})).toEqual(DEFAULT_MIXES);
  });

  test('what is kept is what they are, each in its own place', () => {
    const kept = ['mix1-3-3-2-11-1', 'mix2-0-0-4-0-2', 'mix3-20-1-0-5-0'];
    expect(mixesOf({ mixes: kept })).toEqual(kept.map((name) => parseMix(name)));
  });

  test('a place whose kept name is not right has its mix as it comes, and the others are as they were kept', () => {
    const good = 'mix2-9-2-2-9-2';
    const cases: unknown[] = [
      ['mix1-99-0-0-0-0', good, 'mix3-1-1-1-1-1'], ['crimson', good, 'mix3-1-1-1-1-1'], [7, good, 'mix3-1-1-1-1-1'], [null, good, 'mix3-1-1-1-1-1'],
      // The second place's mix, kept in the first: it is not the first's.
      ['mix2-1-1-1-1-1', good, 'mix3-1-1-1-1-1'],
    ];
    for (const mixes of cases) {
      const got = mixesOf({ mixes } as Pick<GameState, 'mixes'>);
      expect(got[0], JSON.stringify(mixes)).toEqual(DEFAULT_MIXES[0]);
      expect(got[1]).toEqual(parseMix(good));
      expect(got[2]).toEqual(mix(3, 1, 1, 1, 1, 1));
    }
  });

  test('a list that is too short, too long or no list is read as far as it goes, and never as more than three', () => {
    expect(mixesOf({ mixes: ['mix1-1-1-1-1-1'] })).toEqual([mix(1, 1, 1, 1, 1, 1), DEFAULT_MIXES[1], DEFAULT_MIXES[2]]);
    expect(mixesOf({ mixes: [] })).toEqual(DEFAULT_MIXES);
    expect(mixesOf({ mixes: ['mix1-1-1-1-1-1', 'mix2-2-2-2-2-2', 'mix3-3-3-3-3-0', 'mix1-4-0-4-4-0'] })).toHaveLength(3);
    for (const mixes of ['mix1-1-1-1-1-1', 7, null, { 0: 'mix1-1-1-1-1-1' }]) expect(mixesOf({ mixes } as unknown as Pick<GameState, 'mixes'>)).toEqual(DEFAULT_MIXES);
  });
});

describe('keeping one', () => {
  test('it is kept in its place and worn; the other two are as they were', () => {
    const base = { ...fresh(), mixes: ['mix1-3-3-2-11-1', 'mix2-0-0-4-0-2', 'mix3-20-1-0-5-0'] };
    const next = setMix(base, mix(2, 8, 2, 1, 16, 0));
    expect(next.paint).toBe('mix2-8-2-1-16-0');
    expect(next.mixes).toEqual(['mix1-3-3-2-11-1', 'mix2-8-2-1-16-0', 'mix3-20-1-0-5-0']);
    // The game it was given is as it was.
    expect(base.mixes).toEqual(['mix1-3-3-2-11-1', 'mix2-0-0-4-0-2', 'mix3-20-1-0-5-0']);
    expect(base.paint).toBe('factory');
  });

  test('in a game that kept none, the other two are written down as they come', () => {
    const next = setMix(fresh(), stepMix(DEFAULT_MIXES[0], 'hue', 1));
    expect(next.mixes).toEqual([mixId(stepMix(DEFAULT_MIXES[0], 'hue', 1)), mixId(DEFAULT_MIXES[1]), mixId(DEFAULT_MIXES[2])]);
    expect(mixesOf(next)[0].hue).toBe(DEFAULT_MIXES[0].hue + 1);
    expect(isValidState(next, CATALOG)).toBe(true);
  });

  test('what is no mix is not kept', () => {
    for (const bad of [mix(0, 1, 1, 1, 1, 1), mix(4, 1, 1, 1, 1, 1), mix(1, 24, 1, 1, 1, 1), mix(1, 1, 1, 1, 1, 3), mix(1, 1.5, 1, 1, 1, 1), mix(1, -1, 1, 1, 1, 1)]) {
      expect(() => setMix(fresh(), bad), mixId(bad)).toThrow('not a mix');
    }
  });
});

describe('a kept game', () => {
  test('may wear a mix and keep three', () => {
    expect(isValidState(setPaint(fresh(), 'mix1-14-3-2-13-2'), CATALOG)).toBe(true);
    expect(isValidState({ ...fresh(), mixes: ['mix1-3-3-2-11-1', 'mix2-0-0-4-0-2', 'mix3-20-1-0-5-0'] }, CATALOG)).toBe(true);
    // One from before there were mixes is as good as it was.
    expect(isValidState(fresh(), CATALOG)).toBe(true);
    expect(isValidState(JSON.parse(JSON.stringify(setMix(fresh(), mix(3, 1, 2, 3, 4, 0)))), CATALOG)).toBe(true);
  });

  test('is not refused for a paint of the shape of a mix that is none: it is worn as factory colours are', () => {
    for (const paint of ['mix1-99-9-9-99-9', 'mix9-0-0-0-0-0', 'mix1-01-0-0-0-0']) {
      expect(isValidState(setPaint(fresh(), paint), CATALOG), paint).toBe(true);
      expect(isMix(paint)).toBe(false);
    }
    // Nor for a kept list with such a name in it, or a list that is short.
    expect(isValidState({ ...fresh(), mixes: ['mix1-99-9-9-99-9', 'mix2-0-0-4-0-2'] }, CATALOG)).toBe(true);
    expect(isValidState({ ...fresh(), mixes: [] }, CATALOG)).toBe(true);
  });

  test.each([
    ['a paint with half the shape', { paint: 'mix1-1-1' }], ['a paint with something after the shape', { paint: 'mix1-1-1-1-1-1;drop' }], ['a paint in capitals', { paint: 'MIX1-1-1-1-1-1' }],
    ['a paint with something before the shape', { paint: 'drop;mix1-1-1-1-1-1' }], ['a kept mix with something before it', { mixes: ['drop;mix1-1-1-1-1-1'] }],
    ['kept mixes that are no list', { mixes: 'mix1-1-1-1-1-1' }], ['a kept mix that is no text', { mixes: [7] }], ['a kept mix that is a plain word', { mixes: ['crimson'] }],
    ['a kept mix with something after it', { mixes: ['mix1-1-1-1-1-1;drop'] }], ['more kept mixes than a game could hold', { mixes: Array.from({ length: 9 }, () => 'mix1-1-1-1-1-1') }],
    ['kept mixes that are nothing', { mixes: null }],
  ])('is refused for %s', (_what, extra) => {
    expect(isValidState({ ...fresh(), ...extra } as unknown as GameState, CATALOG)).toBe(false);
  });
});

describe('a copy of the pilot\'s own machine, met in a fight', () => {
  test('wears obsidian, and bone where the pilot\'s own is obsidian or a mix of one of the two darkest shades: the two are told apart', () => {
    for (const paint of ['factory', 'crimson', 'bone', 'touchstone', 'plaid', 'mix1-99-9-9-99-9']) expect(likenessPaint(paint), paint).toBe('obsidian');
    expect(likenessPaint('obsidian')).toBe('bone');
    // Pale, light and mid are met by obsidian; dark and deep by bone.
    expect([0, 1, 2, 3, 4].map((shade) => likenessPaint(mixId(mix(1, 16, 0, shade, 0, 2))))).toEqual(['obsidian', 'obsidian', 'obsidian', 'bone', 'bone']);
    expect(MIX_STEPS.shade).toBe(5);
    // The black mix as it comes is one of those; the white one is not.
    expect(likenessPaint(mixId(DEFAULT_MIXES[1]))).toBe('bone');
    expect(likenessPaint(mixId(DEFAULT_MIXES[0]))).toBe('obsidian');
    // The arena's mirror is such a copy.
    expect(mirrorEnemy(setMix(fresh(), DEFAULT_MIXES[1]), 'Echo').paint).toBe('bone');
    expect(mirrorEnemy(setMix(fresh(), DEFAULT_MIXES[0]), 'Echo').paint).toBe('obsidian');
  });
});
