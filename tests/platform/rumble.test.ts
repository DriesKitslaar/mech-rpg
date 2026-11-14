import { vibrator } from '../../src/platform/rumble';

test('the Android shell is asked when there is one: the page\'s own call is refused there', () => {
  const asked: number[] = [];
  const page: number[] = [];
  const shell = { vibrate(ms: number) { asked.push(ms); } };
  vibrator(shell, { vibrate: (ms: number) => { page.push(ms); return false; } })(192.6);
  expect(asked).toEqual([193]);
  expect(page).toEqual([]);
});

test('the shell\'s method is called on the shell itself, as a bridge to Java requires', () => {
  const shell = { calls: 0, vibrate(this: { calls: number }) { this.calls += 1; } };
  vibrator(shell, {})(40);
  expect(shell.calls).toBe(1);
});

test('without a shell the browser is asked', () => {
  const page: number[] = [];
  vibrator(undefined, { vibrate: (ms: number) => { page.push(ms); return true; } })(80);
  expect(page).toEqual([80]);
});

test('a device with no way to vibrate, or one that refuses, is simply not vibrated', () => {
  expect(() => vibrator(undefined, {})(80)).not.toThrow();
  expect(() => vibrator({ vibrate() { throw new Error('no motor'); } }, {})(80)).not.toThrow();
  expect(() => vibrator(undefined, { vibrate() { throw new Error('not allowed'); } })(80)).not.toThrow();
  // A shell from an older build that has no such method falls back to the browser.
  const page: number[] = [];
  vibrator({} as { vibrate?: (ms: number) => void }, { vibrate: (ms: number) => { page.push(ms); return true; } })(30);
  expect(page).toEqual([30]);
});
