import { layoutMech } from '../../src/ui/mechLayout';

const sizes = {
  legs: { w: 60, h: 50 }, core: { w: 50, h: 40 }, head: { w: 24, h: 20 }, arm: { w: 20, h: 40 },
  rightHand: { w: 50, h: 18 }, leftHand: { w: 40, h: 16 }, shoulder: { w: 56, h: 20 },
};

test('a full mech is laid out back to front', () => {
  const cmds = layoutMech(sizes);
  expect(cmds.map((c) => c.slot + (c.dim ? '*' : ''))).toEqual(
    ['leftHand*', 'arm*', 'legs', 'core', 'head', 'shoulder', 'arm', 'rightHand']);
});

test('frame parts stack on the fixed ground point', () => {
  const cmds = layoutMech(sizes);
  const at = (slot: string, dim: boolean) => cmds.find((c) => c.slot === slot && c.dim === dim)!;
  expect(at('legs', false)).toMatchObject({ x: 22, y: 58 });
  expect(at('core', false)).toMatchObject({ x: 27, y: 22 });
  expect(at('head', false)).toMatchObject({ x: 46, y: 5 });
  expect(at('arm', false)).toMatchObject({ x: 42, y: 28 });
  expect(at('arm', true)).toMatchObject({ x: 36, y: 26 });
});

test('weapons attach to the hand and the shoulder mount', () => {
  const cmds = layoutMech(sizes);
  const at = (slot: string) => cmds.find((c) => c.slot === slot)!;
  // front arm hand point = (42 + 10, 28 + 36.8) = (52, 64.8); grip = (12.5, 9)
  expect(at('rightHand')).toMatchObject({ x: 40, y: 56, dim: false });
  // shoulder mount = (27 + 15, 22 + 2) = (42, 24); anchor = (22.4, 20)
  expect(at('shoulder')).toMatchObject({ x: 20, y: 4 });
});

test('a turret with only a core and a shoulder weapon sits on the ground point', () => {
  const cmds = layoutMech({ core: sizes.core, shoulder: sizes.shoulder });
  expect(cmds.map((c) => c.slot)).toEqual(['core', 'shoulder']);
  const core = cmds[0];
  expect(core.x + sizes.core.w / 2).toBe(52);
  expect(core.y + sizes.core.h).toBe(108);
});

test('hand weapons are skipped when there are no arms', () => {
  const cmds = layoutMech({ core: sizes.core, rightHand: sizes.rightHand });
  expect(cmds.map((c) => c.slot)).toEqual(['core']);
});
