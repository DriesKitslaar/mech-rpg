export type InputAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'prev' | 'next' | 'menu';
export type InputSource = 'key' | 'pad';

/** By KeyboardEvent.code. */
export const KEY_MAP: Record<string, InputAction> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Enter: 'confirm', Escape: 'cancel', KeyQ: 'prev', KeyE: 'next', Space: 'menu',
};

/** By standard-mapping gamepad button index. Adjust here if the handheld reports differently. */
export const PAD_BUTTON_MAP: Record<number, InputAction> = {
  12: 'up', 13: 'down', 14: 'left', 15: 'right', 0: 'confirm', 1: 'cancel', 4: 'prev', 5: 'next', 9: 'menu',
};

const DIRECTIONS = new Set<InputAction>(['up', 'down', 'left', 'right']);
export const ECHO_WINDOW_MS = 80;
export const REPEAT_DELAY_MS = 350;
export const REPEAT_INTERVAL_MS = 120;
const AXIS_THRESHOLD = 0.5;

interface Held { sources: Set<InputSource>; nextRepeat: number }

/**
 * Turns raw down/up signals into discrete actions.
 * One physical press can arrive from the gamepad and as a key event; it is delivered once.
 */
export class InputMapper {
  private queue: InputAction[] = [];
  private held = new Map<InputAction, Held>();
  private lastPress = new Map<InputAction, { time: number; source: InputSource }>();

  setDown(source: InputSource, action: InputAction, down: boolean, timeMs: number): void {
    const held = this.held.get(action);
    if (!down) {
      if (!held) return;
      held.sources.delete(source);
      if (held.sources.size === 0) this.held.delete(action);
      return;
    }
    if (held) {
      held.sources.add(source); // already down: the same press seen again
      return;
    }
    const last = this.lastPress.get(action);
    const echo = !!last && last.source !== source && timeMs - last.time <= ECHO_WINDOW_MS;
    this.held.set(action, { sources: new Set([source]), nextRepeat: (echo ? last.time : timeMs) + REPEAT_DELAY_MS });
    if (echo) return;
    this.lastPress.set(action, { time: timeMs, source });
    this.queue.push(action);
  }

  /** Actions to deliver now, oldest first. Clears the queue. */
  poll(timeMs: number): InputAction[] {
    for (const [action, held] of this.held) {
      if (!DIRECTIONS.has(action)) continue;
      while (timeMs >= held.nextRepeat) {
        this.queue.push(action);
        held.nextRepeat += REPEAT_INTERVAL_MS;
      }
    }
    const out = this.queue;
    this.queue = [];
    return out;
  }
}

/** Wires a window's keyboard and gamepads to a mapper. Call `sample` once per frame. */
export function attachInput(target: Window, mapper: InputMapper): { sample(timeMs: number): void; detach(): void } {
  const onKey = (down: boolean) => (event: KeyboardEvent) => {
    const action = KEY_MAP[event.code];
    if (!action) return;
    event.preventDefault();
    if (event.repeat) return;
    mapper.setDown('key', action, down, performance.now());
  };
  const keydown = onKey(true);
  const keyup = onKey(false);
  target.addEventListener('keydown', keydown);
  target.addEventListener('keyup', keyup);

  const padDown = new Set<InputAction>();
  const sample = (timeMs: number): void => {
    const now = new Set<InputAction>();
    for (const pad of target.navigator.getGamepads?.() ?? []) {
      if (!pad) continue;
      for (const [index, action] of Object.entries(PAD_BUTTON_MAP)) {
        if (pad.buttons[Number(index)]?.pressed) now.add(action);
      }
      const [x = 0, y = 0] = pad.axes;
      if (x <= -AXIS_THRESHOLD) now.add('left');
      if (x >= AXIS_THRESHOLD) now.add('right');
      if (y <= -AXIS_THRESHOLD) now.add('up');
      if (y >= AXIS_THRESHOLD) now.add('down');
    }
    for (const action of now) if (!padDown.has(action)) mapper.setDown('pad', action, true, timeMs);
    for (const action of padDown) if (!now.has(action)) mapper.setDown('pad', action, false, timeMs);
    padDown.clear();
    for (const action of now) padDown.add(action);
  };

  return {
    sample,
    detach: () => {
      target.removeEventListener('keydown', keydown);
      target.removeEventListener('keyup', keyup);
    },
  };
}
