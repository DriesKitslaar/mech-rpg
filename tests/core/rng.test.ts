import { nextRandom } from '../../src/core/rng';

function take(seed: number, n: number): number[] {
  const out: number[] = [];
  let state = seed;
  for (let i = 0; i < n; i++) {
    const r = nextRandom(state);
    out.push(r.value);
    state = r.state;
  }
  return out;
}

test('the same seed yields the same sequence', () => {
  expect(take(42, 5)).toEqual(take(42, 5));
});

test('different seeds yield different sequences', () => {
  expect(take(1, 5)).not.toEqual(take(2, 5));
});

test('values are uniform in [0, 1)', () => {
  const values = take(7, 10000);
  expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  expect(mean).toBeGreaterThan(0.48);
  expect(mean).toBeLessThan(0.52);
});
