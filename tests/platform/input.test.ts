import { InputMapper, KEY_MAP, PAD_BUTTON_MAP, type InputAction } from '../../src/platform/input';

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
