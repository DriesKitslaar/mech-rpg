import '@fontsource/vt323/latin-400.css';
import { createBattle } from './core/battle';
import { ENCOUNTERS, ENEMIES } from './content/enemies';
import { CATALOG, DEMO_BUILD } from './content/parts';
import manifest from './content/sprites.json';
import { InputMapper, attachInput } from './platform/input';
import { BattleFlow, BattleScreen } from './ui/battleScreen';
import { fitCanvas } from './ui/display';
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
  const encounter = ENCOUNTERS[params.get('encounter') ?? ''] ?? ENCOUNTERS.intro;
  const seedParam = Number(params.get('seed'));
  const seed = Number.isInteger(seedParam) && params.has('seed') ? seedParam : Date.now() % 2147483647;
  const fast = params.get('fast') === '1';

  const [sprites] = await Promise.all([
    loadSprites(manifest),
    // A font that fails to load must not block the game; the browser falls back to its default.
    document.fonts.load(`12px ${FONT}`).catch(() => undefined),
  ]);

  const flow = new BattleFlow(createBattle(DEMO_BUILD, encounter.map((id) => ENEMIES[id]), CATALOG, seed), CATALOG);
  const screen = new BattleScreen(flow, sprites, CATALOG, { fast });
  const mapper = new InputMapper();
  const input = attachInput(window, mapper);

  (window as any).__game = {
    battle: () => ({
      outcome: flow.state.outcome, round: flow.state.round, phase: flow.phase, menu: flow.menu, message: flow.message,
    }),
  };

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min(100, now - last);
    last = now;
    input.sample(now);
    for (const action of mapper.poll(now)) screen.onInput(action);
    screen.update(dt);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    screen.draw(ctx);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void start();
