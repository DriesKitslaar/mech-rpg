import '@fontsource/vt323/latin-400.css';
import { CATALOG } from './content/parts';
import manifest from './content/sprites.json';
import { Sfx, soundForInput } from './platform/audio';
import { Music } from './platform/music';
import { guarded } from './platform/guard';
import { InputMapper, attachInput, type InputAction } from './platform/input';
import { vibrator, type NativeShell } from './platform/rumble';
import { SaveFile, type KeyValueStore } from './platform/storage';
import { App } from './ui/app';
import { fitCanvas } from './ui/display';
import { InputDebug } from './ui/inputDebug';
import { loadSprites } from './ui/sprites';
import { FONT } from './ui/widgets';

/** The browser's storage, or a throwaway stand-in when the device blocks it (the game then cannot save). */
function openStore(): KeyValueStore {
  try {
    const store = window.localStorage;
    store.getItem('ironwage-probe');
    return store;
  } catch {
    const data = new Map<string, string>();
    return {
      getItem: (key) => data.get(key) ?? null,
      setItem: () => { throw new Error('storage unavailable'); },
      removeItem: (key) => { data.delete(key); },
    };
  }
}

async function start(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const debug = new InputDebug();
  let scale = 1;
  const resize = (): void => {
    const ratio = window.devicePixelRatio || 1;
    scale = fitCanvas(canvas, window.innerWidth, window.innerHeight, ratio);
    debug.screen(window.innerWidth * ratio, window.innerHeight * ratio, scale);
  };
  window.addEventListener('resize', resize);
  resize();

  const params = new URLSearchParams(window.location.search);
  const seedParam = Number(params.get('seed'));
  const seed = Number.isInteger(seedParam) && params.has('seed') ? seedParam : Date.now() % 2147483647;
  const fast = params.get('fast') === '1';

  const [sprites] = await Promise.all([
    loadSprites(manifest),
    // A font that fails to load must not block the game; the browser falls back to its default.
    document.fonts.load(`12px ${FONT}`).catch(() => undefined),
  ]);

  const sfx = new Sfx();
  const music = new Music(() => sfx.context);
  // Inside the Android shell the shell drives the motor; elsewhere the browser is asked. A device without one simply does not answer.
  const vibrate = vibrator((window as { IronwageShell?: NativeShell }).IronwageShell, navigator);
  // Where sound needs no first input (the Android shell allows it), the title has its song from the start.
  // A browser that does need one keeps the engine asleep until the first press wakes it.
  if (!fast) sfx.unlock();
  const app = new App({ catalog: CATALOG, save: new SaveFile(openStore(), CATALOG), sprites, sfx, music, fast, seed, vibrate });

  const mapper = new InputMapper();
  const input = attachInput(window, mapper);
  // The Android shell reports every controller key here, mapped or not, so unknown buttons can be identified.
  (window as any).__nativeKey = (keyCode: number, mappedTo: string): void => debug.record(keyCode, mappedTo);
  (window as any).__game = { snapshot: () => app.snapshot() };

  const handle = (action: InputAction): void => {
    if (!fast) sfx.unlock(); // browsers only allow sound after an input; test runs stay silent
    if (action === 'menu') { debug.toggle(); return; }
    // Comparing what the app reports before and after tells whether the input did anything.
    const was = app.snapshot() as { busy?: boolean };
    const before = JSON.stringify(was);
    app.onInput(action);
    const sound = soundForInput(action, JSON.stringify(app.snapshot()) !== before, was.busy === true);
    if (sound) sfx.play(sound);
  };

  // The handheld's sound engine is put to sleep with the screen; it is woken when the game is looked at again,
  // not only at the next press.
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !fast) sfx.unlock(); });

  let last = performance.now();
  // One thing going wrong in a frame must not freeze the game: the next frame is still asked for, and what
  // went wrong is shown in the input window.
  const step = guarded((now: number): void => {
    const dt = Math.min(100, now - last);
    last = now;
    input.sample(now);
    // The options can swap the pad's A and B; the mapper does it, to those two buttons only.
    mapper.swapFace = app.settings.swapAB === true;
    for (const action of mapper.poll(now)) { debug.action(action); handle(action); }
    app.update(dt);
    music.update();
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    app.draw(ctx);
    debug.draw(ctx);
  }, (message) => debug.fault(message));
  const frame = (now: number): void => {
    step(now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void start();
