import { guarded } from '../../src/platform/guard';

test('a step that runs is not interfered with', () => {
  const seen: number[] = [];
  const faults: string[] = [];
  const step = guarded((now) => { seen.push(now); }, (message) => faults.push(message));
  step(1);
  step(2);
  expect(seen).toEqual([1, 2]);
  expect(faults).toEqual([]);
});

test('a step that throws is reported, and the next step still runs', () => {
  const seen: number[] = [];
  const faults: string[] = [];
  const step = guarded((now) => {
    seen.push(now);
    if (now === 2) throw new Error('boom');
  }, (message) => faults.push(message));
  expect(() => { step(1); step(2); step(3); }).not.toThrow();
  expect(seen).toEqual([1, 2, 3]);
  expect(faults).toEqual(['boom']);
});

test('the same fault frame after frame is reported once, a different one again', () => {
  const faults: string[] = [];
  let what = 'stuck';
  const step = guarded(() => { throw new Error(what); }, (message) => faults.push(message));
  step(1);
  step(2);
  step(3);
  what = 'other';
  step(4);
  expect(faults).toEqual(['stuck', 'other']);
});

test('something thrown that is not an error is reported as what it is', () => {
  const faults: string[] = [];
  guarded(() => { throw 'plain'; }, (message) => faults.push(message))(1); // eslint-disable-line no-throw-literal
  expect(faults).toEqual(['plain']);
});
