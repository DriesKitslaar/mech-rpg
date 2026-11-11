import '@fontsource/vt323/latin-400.css';
import { CATALOG } from './content/parts';
import manifest from './content/sprites.json';
import { Sfx, soundForInput } from './platform/audio';
import { InputMapper, attachInput, type InputAction } from './platform/input';
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
  let scale = 1;
  const resize = (): void => {
    scale = fitCanvas(canvas, window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
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
  sfx.muted = fast;
  const app = new App({ catalog: CATALOG, save: new SaveFile(openStore(), CATALOG), sprites, sfx, fast, seed });

  const mapper = new InputMapper();
  const input = attachInput(window, mapper);
  const debug = new InputDebug();
  // The Android shell reports every controller key here, mapped or not, so unknown buttons can be identified.
  (window as any).__nativeKey = (keyCode: number, mappedTo: string): void => debug.record(keyCode, mappedTo);
  (window as any).__game = { snapshot: () => app.snapshot() };

  const handle = (action: InputAction): void => {
    sfx.unlock(); // browsers only allow sound after an input
    if (action === 'menu') { debug.toggle(); return; }
    // Comparing what the app reports before and after tells whether the input did anything.
    const before = JSON.stringify(app.snapshot());
    app.onInput(action);
    const sound = soundForInput(action, JSON.stringify(app.snapshot()) !== before);
    if (sound) sfx.play(sound);
  };

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min(100, now - last);
    last = now;
    input.sample(now);
    for (const action of mapper.poll(now)) { debug.action(action); handle(action); }
    app.update(dt);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    app.draw(ctx);
    debug.draw(ctx);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void start();
