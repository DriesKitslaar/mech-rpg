import type { InputAction } from '../../src/platform/input';
import { setDetail } from '../../src/ui/light';
import { LONGEST_STEP_MS, frameStep, type FrameParts } from '../../src/ui/loop';

/**
 * One frame of the game as the browser's loop runs it. The one way the game learns whether the
 * handheld keeps up is that each frame tells it how long the frame before took: this is where that
 * is told.
 */

afterEach(() => setDetail(2));

/** The parts of a frame, each of which writes down what it was asked, in the order it was asked. */
function parts(over: { fps?: number; swapAB?: boolean; actions?: InputAction[][]; scale?: number } = {}) {
  const said: string[] = [];
  const queue = [...(over.actions ?? [])];
  const ctx = {
    imageSmoothingEnabled: true,
    setTransform: (...m: number[]) => { said.push(`transform ${m.join(',')} smooth ${ctx.imageSmoothingEnabled}`); },
  };
  const mapper = { swapFace: false, poll: (now: number): InputAction[] => { said.push(`poll ${now} swap ${mapper.swapFace}`); return queue.shift() ?? []; } };
  const made: FrameParts = {
    app: {
      frame: (gap) => { said.push(`frame ${gap}`); },
      fps: over.fps ?? 60,
      settings: over.swapAB === undefined ? {} : { swapAB: over.swapAB },
      update: (dt) => { said.push(`update ${dt}`); },
      draw: (c) => { said.push(c === (ctx as unknown) ? 'draw' : 'draw on another canvas'); },
    },
    debug: {
      pace: (fps, light) => { said.push(`pace ${fps} ${light}`); },
      action: (action) => { said.push(`saw ${action}`); },
      draw: (c) => { said.push(c === (ctx as unknown) ? 'debug' : 'debug on another canvas'); },
    },
    input: { sample: (now) => { said.push(`sample ${now}`); } },
    mapper,
    music: { update: () => { said.push('music'); } },
    ctx: ctx as unknown as CanvasRenderingContext2D,
    scale: () => over.scale ?? 4,
    handle: (action) => { said.push(`do ${action}`); },
  };
  return { made, said };
}

describe('a frame of the game', () => {
  test('the game is told how long it has been since the frame before: all of it, every frame', () => {
    const { made, said } = parts();
    const step = frameStep(made, 1000);
    step(1016.7);
    step(1050.7);
    step(1051);
    const told = said.filter((s) => s.startsWith('frame ')).map((s) => Number(s.slice(6)));
    expect(told).toHaveLength(3);
    expect(told[0]).toBeCloseTo(16.7, 9);
    expect(told[1]).toBeCloseTo(34, 9);
    expect(told[2]).toBeCloseTo(0.3, 9);
    // A long gap is told as it was: whether it was a pause is for the game to say.
    step(6051);
    expect(said.filter((s) => s.startsWith('frame ')).at(-1)).toBe('frame 5000');
  });

  test('the game is moved on by as long as the frame took, and by a tenth of a second at most', () => {
    expect(LONGEST_STEP_MS).toBe(100);
    const { made, said } = parts();
    const step = frameStep(made, 0);
    step(16);
    step(116);
    step(117);
    step(5117);
    expect(said.filter((s) => s.startsWith('update '))).toEqual(['update 16', 'update 100', 'update 1', 'update 100']);
  });

  test('what happens in a frame, in order: the pace, the controls, the game, the music, the picture, and the window over it', () => {
    const { made, said } = parts({ fps: 47, actions: [['confirm', 'down']], scale: 3 });
    setDetail(1);
    frameStep(made, 100)(120);
    expect(said).toEqual([
      'frame 20', 'pace 47 1', 'sample 120', 'poll 120 swap false', 'saw confirm', 'do confirm', 'saw down', 'do down',
      'update 20', 'music', 'transform 3,0,0,3,0,0 smooth false', 'draw', 'debug',
    ]);
  });

  test('the window is told how much light there is now, and the buttons are swapped when the options say so', () => {
    const plain = parts();
    frameStep(plain.made, 0)(16);
    expect(plain.said).toContain('pace 60 2');
    expect(plain.said).toContain('poll 16 swap false');
    const swapped = parts({ swapAB: true });
    setDetail(0);
    frameStep(swapped.made, 0)(16);
    expect(swapped.said).toContain('pace 60 0');
    expect(swapped.said).toContain('poll 16 swap true');
    const not = parts({ swapAB: false });
    not.made.mapper.swapFace = true;
    frameStep(not.made, 0)(16);
    expect(not.said).toContain('poll 16 swap false');
  });

  test('the size the game is drawn at is asked for every frame: the screen can be turned or resized', () => {
    const { made, said } = parts();
    let scale = 2;
    made.scale = () => scale;
    const step = frameStep(made, 0);
    step(16);
    scale = 5;
    step(32);
    expect(said.filter((s) => s.startsWith('transform'))).toEqual(['transform 2,0,0,2,0,0 smooth false', 'transform 5,0,0,5,0,0 smooth false']);
  });
});
