import { isMix } from '../../src/core/mix';
import { MIX_KEPT, PaintedCache } from '../../src/ui/paintedCache';

/**
 * The pictures of a machine as they are coloured for a paint, kept so that each is only coloured
 * once. For the ready paints that is a number that has an end. For the pilot's own mixes it has
 * none worth the name (there are thousands, and a pilot trying colours asks for a new one with every
 * press), so the pictures of a mix are forgotten again once enough others have been asked for.
 */

const mixName = (n: number): string => `mix1-${n % 24}-${Math.floor(n / 24) % 4}-0-0-0`;

describe('the pictures kept for a paint', () => {
  test('a picture is made once for a paint and handed out again after', () => {
    const cache = new PaintedCache<object>(4, isMix);
    let made = 0;
    const make = () => { made++; return {}; };
    const first = cache.get('core', 'crimson', make);
    expect(cache.get('core', 'crimson', make)).toBe(first);
    expect(made).toBe(1);
    // Another picture, or another paint, is another.
    expect(cache.get('legs', 'crimson', make)).not.toBe(first);
    expect(cache.get('core', 'cobalt', make)).not.toBe(first);
    expect(made).toBe(3);
    expect(cache.size).toBe(3);
  });

  test('the pictures of four mixes are kept, and of no more: the one asked for longest ago is forgotten', () => {
    expect(MIX_KEPT).toBe(4);
    const cache = new PaintedCache<string>(MIX_KEPT, isMix);
    const parts = ['head', 'core', 'arms', 'legs'];
    const wear = (paint: string): string[] => parts.map((part) => cache.get(part, paint, () => `${part} in ${paint}`));
    for (let n = 0; n < 4; n++) wear(mixName(n));
    expect(cache.size).toBe(16);
    // A fifth: the first goes, with every picture of it.
    wear(mixName(4));
    expect(cache.size).toBe(16);
    let made = 0;
    cache.get('head', mixName(1), () => { made++; return 'again'; });
    expect(made).toBe(0);
    cache.get('head', mixName(0), () => { made++; return 'again'; });
    expect(made).toBe(1);
  });

  test('a mix that is asked for again is not the one forgotten next', () => {
    const cache = new PaintedCache<string>(4, isMix);
    for (let n = 0; n < 4; n++) cache.get('core', mixName(n), () => 'made');
    // The first is worn again; then two new ones are tried.
    cache.get('core', mixName(0), () => 'made');
    cache.get('core', mixName(4), () => 'made');
    cache.get('core', mixName(5), () => 'made');
    const remade: number[] = [];
    for (const n of [0, 3, 4, 5]) cache.get('core', mixName(n), () => { remade.push(n); return 'made'; });
    expect(remade).toEqual([]);
    for (const n of [1, 2]) cache.get('core', mixName(n), () => { remade.push(n); return 'made'; });
    expect(remade).toEqual([1, 2]);
  });

  test('a hundred mixes tried in a row leave the pictures of four, and no ready paint is ever forgotten', () => {
    const cache = new PaintedCache<string>(4, isMix);
    const ready = ['crimson', 'cobalt', 'mercury', 'touchstone', 'bone', 'obsidian'];
    for (const paint of ready) for (const part of ['head', 'core']) cache.get(part, paint, () => 'made');
    for (let n = 0; n < 100; n++) for (const part of ['head', 'core', 'arms']) cache.get(part, mixName(n), () => 'made');
    expect(cache.size).toBe(ready.length * 2 + 4 * 3);
    let made = 0;
    for (const paint of ready) for (const part of ['head', 'core']) cache.get(part, paint, () => { made++; return 'again'; });
    expect(made).toBe(0);
    // The last four tried are the four kept.
    for (let n = 96; n < 100; n++) cache.get('arms', mixName(n), () => { made++; return 'again'; });
    expect(made).toBe(0);
    cache.get('arms', mixName(95), () => { made++; return 'again'; });
    expect(made).toBe(1);
  });

  test('a picture whose name has the bar in it is not mistaken for another paint\'s', () => {
    const cache = new PaintedCache<string>(1, isMix);
    cache.get('odd|part', 'crimson', () => 'kept');
    cache.get('core', mixName(0), () => 'first');
    cache.get('core', mixName(1), () => 'second');
    let made = 0;
    cache.get('odd|part', 'crimson', () => { made++; return 'again'; });
    expect(made).toBe(0);
    expect(cache.size).toBe(2);
  });
});
