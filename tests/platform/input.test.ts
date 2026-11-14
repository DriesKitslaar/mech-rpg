import { FACE_BUTTONS, FACE_KEYS, InputMapper, KEY_MAP, PAD_BUTTON_MAP, attachInput, type InputAction } from '../../src/platform/input';

test('a press delivers its action once', () => {
  const m = new InputMapper();
  m.setDown('key', 'confirm', true, 0);
  expect(m.poll(0)).toEqual(['confirm']);
  expect(m.poll(16)).toEqual([]);
});

test('the same press arriving from both sources counts once', () => {
  const m = new InputMapper();
  m.setDown('pad', 'up', true, 0);
  m.setDown('key', 'up', true, 30);
  expect(m.poll(30)).toEqual(['up']);
});

test('a quick tap echoed by the other source shortly after release counts once', () => {
  const m = new InputMapper();
  m.setDown('pad', 'confirm', true, 0);
  m.setDown('pad', 'confirm', false, 20);
  m.setDown('key', 'confirm', true, 40);
  expect(m.poll(40)).toEqual(['confirm']);
});

test('two separate presses from different sources both count', () => {
  const m = new InputMapper();
  m.setDown('pad', 'up', true, 0);
  m.setDown('pad', 'up', false, 50);
  m.setDown('key', 'up', true, 200);
  expect(m.poll(200)).toEqual(['up', 'up']);
});

test('repeated down events from one source without a release count once', () => {
  const m = new InputMapper();
  m.setDown('key', 'left', true, 0);
  m.setDown('key', 'left', true, 10);
  expect(m.poll(10)).toEqual(['left']);
});

test('a held direction repeats after 350 ms and then every 120 ms', () => {
  const m = new InputMapper();
  m.setDown('pad', 'down', true, 0);
  expect(m.poll(349)).toEqual(['down']);
  expect(m.poll(350)).toEqual(['down']);
  expect(m.poll(469)).toEqual([]);
  expect(m.poll(470)).toEqual(['down']);
  m.setDown('pad', 'down', false, 480);
  expect(m.poll(2000)).toEqual([]);
});

test('a direction stays held while either source holds it', () => {
  const m = new InputMapper();
  m.setDown('pad', 'down', true, 0);
  m.setDown('key', 'down', true, 10);
  m.setDown('pad', 'down', false, 100);
  expect(m.poll(350)).toEqual(['down', 'down']);
});

test('confirm does not repeat when held', () => {
  const m = new InputMapper();
  m.setDown('key', 'confirm', true, 0);
  expect(m.poll(2000)).toEqual(['confirm']);
});

test('actions are delivered in the order they were pressed', () => {
  const m = new InputMapper();
  m.setDown('key', 'left', true, 0);
  m.setDown('key', 'confirm', true, 5);
  expect(m.poll(10)).toEqual(['left', 'confirm']);
});

test('the key and pad maps together cover every action', () => {
  const all: InputAction[] = ['up', 'down', 'left', 'right', 'confirm', 'cancel', 'prev', 'next', 'menu'];
  expect(new Set(Object.values(KEY_MAP))).toEqual(new Set(all));
  expect(new Set(Object.values(PAD_BUTTON_MAP))).toEqual(new Set(all));
});

test('a long gap between polls delivers one repeat, not a burst', () => {
  const m = new InputMapper();
  m.setDown('key', 'down', true, 0);
  expect(m.poll(0)).toEqual(['down']);
  expect(m.poll(5000)).toEqual(['down']);
  expect(m.poll(5119)).toEqual([]);
  expect(m.poll(5120)).toEqual(['down']);
});

test('releaseAll stops every held action', () => {
  const m = new InputMapper();
  m.setDown('key', 'down', true, 0);
  m.setDown('pad', 'left', true, 0);
  m.poll(0);
  m.releaseAll();
  expect(m.poll(5000)).toEqual([]);
  m.setDown('key', 'down', true, 6000);
  expect(m.poll(6000)).toEqual(['down']);
});

describe('the A and B buttons swapped', () => {
  const press = (m: InputMapper, source: 'key' | 'pad', action: InputAction, at: number, face: boolean): void => {
    m.setDown(source, action, true, at, face);
    m.setDown(source, action, false, at + 30, face);
  };

  test('with the swap off a face button is what it says', () => {
    const m = new InputMapper();
    press(m, 'key', 'confirm', 0, true);
    press(m, 'key', 'cancel', 100, true);
    expect(m.poll(200)).toEqual(['confirm', 'cancel']);
  });

  test('with the swap on, A goes back and B confirms', () => {
    const m = new InputMapper();
    m.swapFace = true;
    press(m, 'key', 'confirm', 0, true);
    press(m, 'key', 'cancel', 100, true);
    expect(m.poll(200)).toEqual(['cancel', 'confirm']);
  });

  test('only the face buttons change places: Enter, Escape and the system Back key stay what they are', () => {
    const m = new InputMapper();
    m.swapFace = true;
    press(m, 'key', 'confirm', 0, false);
    press(m, 'key', 'cancel', 100, false);
    press(m, 'key', 'up', 200, false);
    press(m, 'key', 'prev', 300, false);
    expect(m.poll(400)).toEqual(['confirm', 'cancel', 'up', 'prev']);
  });

  test('the press that turns the swap on is delivered once, and the button is not left stuck down', () => {
    const m = new InputMapper();
    m.setDown('key', 'confirm', true, 0, true);
    expect(m.poll(0)).toEqual(['confirm']);
    // What that press did was turn the swap on; the button is let go afterwards.
    m.swapFace = true;
    m.setDown('key', 'confirm', false, 60, true);
    expect(m.poll(60)).toEqual([]);
    // The same button pressed again now goes back.
    m.setDown('key', 'confirm', true, 400, true);
    expect(m.poll(400)).toEqual(['cancel']);
    m.setDown('key', 'confirm', false, 460, true);
    // And the other one confirms.
    m.setDown('key', 'cancel', true, 800, true);
    expect(m.poll(800)).toEqual(['confirm']);
  });

  test('a press that reaches the game both as a key and from the pad still counts once', () => {
    const m = new InputMapper();
    m.swapFace = true;
    m.setDown('pad', 'confirm', true, 0, true);
    m.setDown('key', 'confirm', true, 20, true);
    expect(m.poll(20)).toEqual(['cancel']);
  });

  test('the shell names the pad\'s A and B apart from Enter and Escape, and the pad\'s own first two buttons are the same two', () => {
    expect(KEY_MAP.ButtonA).toBe('confirm');
    expect(KEY_MAP.ButtonB).toBe('cancel');
    expect([...FACE_KEYS].sort()).toEqual(['ButtonA', 'ButtonB']);
    expect([...FACE_BUTTONS].sort()).toEqual([0, 1]);
    expect(FACE_KEYS.has('Enter')).toBe(false);
    expect(FACE_KEYS.has('Escape')).toBe(false);
  });
});

describe('keys and the pad wired to a mapper', () => {
  /** A stand-in for a window: listeners can be fired by hand, and the pad's buttons set. */
  function fakeWindow() {
    const listeners = new Map<string, ((event: unknown) => void)[]>();
    const pad = { buttons: Array.from({ length: 16 }, () => ({ pressed: false })), axes: [0, 0] };
    const target = {
      addEventListener: (type: string, fn: (event: unknown) => void) => { listeners.set(type, [...(listeners.get(type) ?? []), fn]); },
      removeEventListener: () => undefined,
      navigator: { getGamepads: () => [pad] },
    } as unknown as Window;
    const key = (type: 'keydown' | 'keyup', code: string) => listeners.get(type)!.forEach((fn) => fn({ code, repeat: false, preventDefault: () => undefined }));
    return { target, pad, key };
  }

  test('the shell\'s A and B are face buttons; its Back key and Enter are not', () => {
    const { target, key } = fakeWindow();
    const m = new InputMapper();
    attachInput(target, m);
    m.swapFace = true;
    key('keydown', 'ButtonA');
    key('keyup', 'ButtonA');
    key('keydown', 'ButtonB');
    key('keyup', 'ButtonB');
    key('keydown', 'Escape');
    key('keyup', 'Escape');
    key('keydown', 'Enter');
    key('keyup', 'Enter');
    expect(m.poll(performance.now() + 1000)).toEqual(['cancel', 'confirm', 'cancel', 'confirm']);
  });

  test('the pad\'s own A and B are face buttons too, its shoulder buttons and D-pad are not', () => {
    const { target, pad } = fakeWindow();
    const m = new InputMapper();
    const input = attachInput(target, m);
    m.swapFace = true;
    pad.buttons[0].pressed = true;
    input.sample(0);
    pad.buttons[0].pressed = false;
    input.sample(100);
    pad.buttons[1].pressed = true;
    input.sample(200);
    pad.buttons[1].pressed = false;
    pad.buttons[4].pressed = true;
    input.sample(300);
    pad.buttons[4].pressed = false;
    input.sample(400);
    expect(m.poll(400)).toEqual(['cancel', 'confirm', 'prev']);
  });
});
