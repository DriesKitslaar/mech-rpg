import { Typewriter } from '../../src/ui/typewriter';

const lines = ['Hello there.', 'General reply.'];

test('nothing is written at first, and it is written a line at a time at the given speed', () => {
  const t = new Typewriter(lines, 10);
  expect(t.visible()).toEqual(['', '']);
  expect(t.done).toBe(false);
  t.update(500);
  expect(t.visible()).toEqual(['Hello', '']);
  t.update(1000);
  expect(t.visible()).toEqual(['Hello there.', 'Gen']);
});

test('it is done when everything is written, and stays done', () => {
  const t = new Typewriter(lines, 10);
  t.update(2500);
  expect(t.done).toBe(false);
  t.update(200);
  expect(t.done).toBe(true);
  expect(t.visible()).toEqual(lines);
  t.update(99999);
  expect(t.visible()).toEqual(lines);
});

test('finishing writes the rest at once', () => {
  const t = new Typewriter(lines, 10);
  t.update(300);
  t.finish();
  expect(t.done).toBe(true);
  expect(t.visible()).toEqual(lines);
});

test('an instant one is written from the start, and so is one with nothing to write', () => {
  expect(new Typewriter(lines, 10, true).done).toBe(true);
  expect(new Typewriter(lines, 10, true).visible()).toEqual(lines);
  expect(new Typewriter([], 10).done).toBe(true);
  expect(new Typewriter(['', ''], 10).done).toBe(true);
});

test('it reports the characters that appeared since the last look, for the sound of typing', () => {
  const t = new Typewriter(['abc def'], 10);
  expect(t.update(250)).toBe(2);
  expect(t.update(250)).toBe(3);
  expect(t.update(5000)).toBe(2);
  expect(t.update(100)).toBe(0);
});

test('the lines it was given are not changed', () => {
  const given = ['one', 'two'];
  const t = new Typewriter(given, 10);
  t.update(100);
  t.visible()[0] = 'changed';
  expect(given).toEqual(['one', 'two']);
});
