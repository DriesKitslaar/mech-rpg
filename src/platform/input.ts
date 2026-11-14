export type InputAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'prev' | 'next' | 'menu';
export type InputSource = 'key' | 'pad';

/**
 * By KeyboardEvent.code. `ButtonA` and `ButtonB` are not keys of any keyboard: the Android shell
 * sends the pad's A and B under those names, so they can be told apart from Enter, Escape and the
 * system's Back key.
 */
export const KEY_MAP: Record<string, InputAction> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Enter: 'confirm', Escape: 'cancel', KeyQ: 'prev', KeyE: 'next', Space: 'menu',
  ButtonA: 'confirm', ButtonB: 'cancel',
};

/** By standard-mapping gamepad button index. Adjust here if the handheld reports differently. */
export const PAD_BUTTON_MAP: Record<number, InputAction> = {
  12: 'up', 13: 'down', 14: 'left', 15: 'right', 0: 'confirm', 1: 'cancel', 4: 'prev', 5: 'next', 9: 'menu',
};

/**
 * The pad's A and B, as key codes from the shell and as buttons of the pad itself: the two the
 * options can swap, for a handheld that reports them the other way round. Nothing else that
 * confirms or goes back is touched by that swap.
 */
export const FACE_KEYS = new Set(['ButtonA', 'ButtonB']);
export const FACE_BUTTONS = new Set([0, 1]);

const DIRECTIONS = new Set<InputAction>(['up', 'down', 'left', 'right']);
const SWAPPED: Partial<Record<InputAction, InputAction>> = { confirm: 'cancel', cancel: 'confirm' };
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
  /** True while the options have the pad's A and B swapped: a face button then delivers the other's action. */
  swapFace = false;
  private queue: { action: InputAction; face: boolean }[] = [];
  private held = new Map<InputAction, Held>();
  private lastPress = new Map<InputAction, { time: number; source: InputSource }>();

  /**
   * `face` says the signal is from the pad's A or B. What is held and what is an echo are kept by the
   * action a button stands for unswapped, so a swap that changes while a button is down leaves nothing stuck.
   */
  setDown(source: InputSource, action: InputAction, down: boolean, timeMs: number, face = false): void {
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
    this.queue.push({ action, face });
  }

  /** Forgets everything held, for when the window loses focus and key-up events may never arrive. */
  releaseAll(): void {
    this.held.clear();
  }

  /** Actions to deliver now, oldest first. Clears the queue. */
  poll(timeMs: number): InputAction[] {
    for (const [action, held] of this.held) {
      if (!DIRECTIONS.has(action)) continue;
      // At most one repeat per poll: a stalled frame must not turn into a burst of moves.
      if (timeMs >= held.nextRepeat) {
        this.queue.push({ action, face: false });
        held.nextRepeat = timeMs + REPEAT_INTERVAL_MS;
      }
    }
    const out = this.queue;
    this.queue = [];
    // The swap is applied as a press is handed over, to the two face buttons only.
    return out.map(({ action, face }) => (face && this.swapFace ? SWAPPED[action] ?? action : action));
  }
}

/** Wires a window's keyboard and gamepads to a mapper. Call `sample` once per frame. */
export function attachInput(target: Window, mapper: InputMapper): { sample(timeMs: number): void; detach(): void } {
  const onKey = (down: boolean) => (event: KeyboardEvent) => {
    const action = KEY_MAP[event.code];
    if (!action) return;
    event.preventDefault();
    if (event.repeat) return;
    mapper.setDown('key', action, down, performance.now(), FACE_KEYS.has(event.code));
  };
  const keydown = onKey(true);
  const keyup = onKey(false);
  target.addEventListener('keydown', keydown);
  target.addEventListener('keyup', keyup);
  const padDown = new Set<InputAction>();
  const release = (): void => { mapper.releaseAll(); padDown.clear(); };
  target.addEventListener('blur', release);
  target.document?.addEventListener('visibilitychange', release);

  const sample = (timeMs: number): void => {
    const now = new Set<InputAction>();
    const face = new Set<InputAction>();
    for (const pad of target.navigator.getGamepads?.() ?? []) {
      if (!pad) continue;
      for (const [index, action] of Object.entries(PAD_BUTTON_MAP)) {
        if (!pad.buttons[Number(index)]?.pressed) continue;
        now.add(action);
        if (FACE_BUTTONS.has(Number(index))) face.add(action);
      }
      const [x = 0, y = 0] = pad.axes;
      if (x <= -AXIS_THRESHOLD) now.add('left');
      if (x >= AXIS_THRESHOLD) now.add('right');
      if (y <= -AXIS_THRESHOLD) now.add('up');
      if (y >= AXIS_THRESHOLD) now.add('down');
    }
    for (const action of now) if (!padDown.has(action)) mapper.setDown('pad', action, true, timeMs, face.has(action));
    for (const action of padDown) if (!now.has(action)) mapper.setDown('pad', action, false, timeMs);
    padDown.clear();
    for (const action of now) padDown.add(action);
  };

  return {
    sample,
    detach: () => {
      target.removeEventListener('keydown', keydown);
      target.removeEventListener('keyup', keyup);
      target.removeEventListener('blur', release);
      target.document?.removeEventListener('visibilitychange', release);
    },
  };
}
