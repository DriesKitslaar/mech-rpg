import type { InputAction } from '../platform/input';
import { detail } from './light';

/** The longest stretch of time the game is moved on by in one frame: after a pause it does not leap. */
export const LONGEST_STEP_MS = 100;

/** What a frame of the game is made with: the game, the window that shows what the handheld does, the controls, the music and the canvas. */
export interface FrameParts {
  app: {
    frame(gapMs: number): void;
    readonly fps: number;
    readonly settings: { swapAB?: boolean };
    update(dtMs: number): void;
    draw(ctx: CanvasRenderingContext2D): void;
  };
  debug: { pace(fps: number, light: number): void; action(action: InputAction): void; draw(ctx: CanvasRenderingContext2D): void };
  input: { sample(now: number): void };
  mapper: { swapFace: boolean; poll(now: number): InputAction[] };
  music: { update(): void };
  ctx: CanvasRenderingContext2D;
  /** How many times the game is enlarged on the screen, as it is at this moment. */
  scale: () => number;
  /** What an input does. */
  handle: (action: InputAction) => void;
}

/**
 * One frame of the game, given the time it is now. The app is told how long it has been since the
 * frame before, all of it: that is the one way it learns whether the handheld keeps up. Then the
 * controls are read and acted on, and the game is moved on (by no more than a tenth of a second)
 * and drawn. `start` is the time the first frame is measured from.
 */
export function frameStep(parts: FrameParts, start: number): (now: number) => void {
  let last = start;
  return (now) => {
    const { app, debug, input, mapper, music, ctx } = parts;
    const gap = now - last;
    last = now;
    app.frame(gap);
    debug.pace(app.fps, detail());
    input.sample(now);
    // The options can swap the pad's A and B; the mapper does it, to those two buttons only.
    mapper.swapFace = app.settings.swapAB === true;
    for (const action of mapper.poll(now)) {
      debug.action(action);
      parts.handle(action);
    }
    app.update(Math.min(LONGEST_STEP_MS, gap));
    music.update();
    ctx.imageSmoothingEnabled = false;
    const scale = parts.scale();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    app.draw(ctx);
    debug.draw(ctx);
  };
}
