import '@fontsource/vt323/latin-400.css';
import { createBattle } from './core/battle';
import { ENCOUNTERS, ENEMIES } from './content/enemies';
import { CATALOG, DEMO_BUILD } from './content/parts';
import manifest from './content/sprites.json';
import { InputMapper, attachInput, type InputAction } from './platform/input';
import { BattleFlow, BattleScreen } from './ui/battleScreen';
import { fitCanvas } from './ui/display';
import { InputDebug } from './ui/inputDebug';
import { loadSprites } from './ui/sprites';
import { FONT } from './ui/widgets';

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
  const names = Object.keys(ENCOUNTERS);
  const requested = params.get('encounter') ?? '';
  let encounterIndex = Math.max(0, names.indexOf(requested));
  const seedParam = Number(params.get('seed'));
  let seed = Number.isInteger(seedParam) && params.has('seed') ? seedParam : Date.now() % 2147483647;
  const fast = params.get('fast') === '1';

  const [sprites] = await Promise.all([
    loadSprites(manifest),
    // A font that fails to load must not block the game; the browser falls back to its default.
    document.fonts.load(`12px ${FONT}`).catch(() => undefined),
  ]);

  let flow!: BattleFlow;
  let screen!: BattleScreen;
  let battlesStarted = 0;
  const startBattle = (): void => {
    const enemies = ENCOUNTERS[names[encounterIndex]].map((id) => ENEMIES[id]);
    flow = new BattleFlow(createBattle(DEMO_BUILD, enemies, CATALOG, seed), CATALOG);
    screen = new BattleScreen(flow, sprites, CATALOG, { fast });
    battlesStarted += 1;
  };
  startBattle();

  const mapper = new InputMapper();
  const input = attachInput(window, mapper);
  const debug = new InputDebug();
  // The Android shell reports every controller key here, mapped or not, so unknown buttons can be identified.
  (window as any).__nativeKey = (keyCode: number, mappedTo: string): void => debug.record(keyCode, mappedTo);

  (window as any).__game = {
    battle: () => ({
      outcome: flow.state.outcome, round: flow.state.round, phase: flow.phase, menu: flow.menu, message: flow.message,
    }),
    battlesStarted: () => battlesStarted,
  };

  const handle = (action: InputAction): void => {
    if (action === 'menu') { debug.toggle(); return; }
    if (flow.phase === 'result') {
      // Until there is a mission board, the result screen leads straight into the next encounter.
      if (action !== 'confirm') return;
      encounterIndex = (encounterIndex + 1) % names.length;
      seed = (seed + 1) % 2147483647;
      startBattle();
      return;
    }
    screen.onInput(action);
  };

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min(100, now - last);
    last = now;
    input.sample(now);
    for (const action of mapper.poll(now)) { debug.action(action); handle(action); }
    screen.update(dt);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    screen.draw(ctx);
    debug.draw(ctx);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void start();
