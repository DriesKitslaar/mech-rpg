import { InputDebug } from '../../src/ui/inputDebug';
import { COLORS } from '../../src/ui/widgets';

function recorder() {
  const calls: { name: string; args: unknown[] }[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get: (t, name: string) => (name in t ? t[name] : (...args: unknown[]) => { calls.push({ name, args }); }),
    set: (t, name: string, value) => { t[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  const texts = () => calls.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]));
  return { ctx, texts };
}

test('the input window is closed until it is asked for, and says how to close it again', () => {
  const debug = new InputDebug();
  const closed = recorder();
  debug.draw(closed.ctx);
  expect(closed.texts()).toEqual([]);
  debug.toggle();
  const open = recorder();
  debug.draw(open.ctx);
  expect(open.texts()).toEqual(expect.arrayContaining(['INPUT', 'START: close']));
  debug.toggle();
  const again = recorder();
  debug.draw(again.ctx);
  expect(again.texts()).toEqual([]);
});

test('it shows the last action as the game took it, and the last key as the handheld sent it', () => {
  const debug = new InputDebug();
  debug.toggle();
  debug.action('cancel');
  debug.record(96, 'ButtonA');
  const { ctx, texts } = recorder();
  debug.draw(ctx);
  expect(texts()).toEqual(expect.arrayContaining(['action: cancel', 'key: 96 > ButtonA']));
  debug.record(188, '');
  const other = recorder();
  debug.draw(other.ctx);
  expect(other.texts()).toContain('key: 188 (unmapped)');
});

test('it shows the size the game is drawn at, so a picture that does not fill the screen can be explained', () => {
  const debug = new InputDebug();
  debug.toggle();
  debug.screen(1239, 1080, 4);
  const { ctx, texts } = recorder();
  debug.draw(ctx);
  expect(texts()).toContain('screen: 1239x1080 x4');
});

test('a fault opens the window by itself and is shown, cut to what fits', () => {
  const debug = new InputDebug();
  debug.fault('Cannot read properties of undefined (reading \'parts\')');
  const { ctx, texts } = recorder();
  debug.draw(ctx);
  const shown = texts();
  expect(shown).toContain('INPUT');
  const line = shown.find((text) => text.startsWith('error: '))!;
  expect(line).toBeDefined();
  expect(line.length).toBeLessThanOrEqual(30);
  expect(line.startsWith('error: Cannot read')).toBe(true);
});

/** What was written, and in which colour. */
function coloured() {
  const drawn: { text: string; color: unknown }[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get: (t, name: string) => (name in t ? t[name] : name === 'fillText' ? (text: unknown) => { drawn.push({ text: String(text), color: t.fillStyle }); } : () => undefined),
    set: (t, name: string, value) => { t[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, colours: (start: string) => drawn.filter((d) => d.text.startsWith(start)).map((d) => d.color) };
}

test('it shows how many frames a second the handheld is showing, and how much of the soft light is being drawn', () => {
  const debug = new InputDebug();
  debug.toggle();
  const before = recorder();
  debug.draw(before.ctx);
  expect(before.texts()).toContain('pace: -');
  debug.pace(58, 1);
  const { ctx, texts } = recorder();
  debug.draw(ctx);
  // Under the size of the screen, above how to close the window, and whole.
  const shown = texts();
  expect(shown.slice(shown.indexOf('screen: -'))).toEqual(['screen: -', 'pace: 58 fps, light 1', 'START: close']);
  debug.pace(120, 2);
  const quick = recorder();
  debug.draw(quick.ctx);
  expect(quick.texts()).toContain('pace: 120 fps, light 2');
});

test('what went wrong is the one line in red, under the pace', () => {
  const debug = new InputDebug();
  debug.pace(60, 2);
  debug.fault('boom');
  const { ctx, colours } = coloured();
  debug.draw(ctx);
  expect(colours('error: boom')).toContain(COLORS.danger);
  for (const line of ['action:', 'key:', 'screen:', 'pace:', 'START']) {
    expect(colours(line).length, line).toBeGreaterThan(0);
    expect(colours(line), line).not.toContain(COLORS.danger);
  }
});
