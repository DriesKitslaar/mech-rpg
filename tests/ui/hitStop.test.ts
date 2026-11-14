import { HitStop } from '../../src/ui/hitStop';

test('time passes untouched while nothing has landed', () => {
  const stop = new HitStop();
  expect(stop.pass(16)).toBe(16);
  expect(stop.flash).toBe(0);
});

test('a killing blow holds the field still for a moment, then lets time run again', () => {
  const stop = new HitStop();
  stop.strike(90);
  // The frame the blow lands in is held whole and takes nothing off the hold: the flash is drawn at its brightest.
  expect(stop.pass(16)).toBe(0);
  expect(stop.flash).toBe(0.55);
  expect(stop.pass(16)).toBe(0);
  expect(stop.pass(16)).toBe(0);
  // The frame in which the hold ends passes on what is left of it.
  expect(stop.pass(70)).toBe(12);
  expect(stop.pass(16)).toBe(16);
  expect(stop.flash).toBe(0);
});

test('the flash is brightest at the blow and gone by the end of the hold', () => {
  const stop = new HitStop();
  stop.strike(100);
  const first = stop.flash;
  stop.pass(16);
  stop.pass(50);
  expect(stop.flash).toBeLessThan(first);
  stop.pass(60);
  expect(stop.flash).toBe(0);
});

test('a second blow during a hold does not shorten it, and with motion off nothing is ever held', () => {
  const stop = new HitStop();
  stop.strike(100);
  stop.pass(30);
  stop.strike(40);
  expect(stop.pass(60)).toBe(0);
  const off = new HitStop(false);
  off.strike(100);
  expect(off.pass(16)).toBe(16);
  expect(off.flash).toBe(0);
});
