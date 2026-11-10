import { layoutMech } from '../../src/ui/mechLayout';

const sizes = {
  legs: { w: 60, h: 50 }, core: { w: 50, h: 40 }, head: { w: 24, h: 20 }, arm: { w: 20, h: 40 },
  rightHand: { w: 50, h: 18 }, leftHand: { w: 40, h: 16 }, shoulder: { w: 56, h: 20 },
};

test('a full mech is laid out back to front', () => {
  const cmds = layoutMech(sizes);
  expect(cmds.map((c) => c.slot + (c.dim ? '*' : ''))).toEqual(
    ['shoulder', 'leftHand*', 'arm*', 'legs', 'core', 'head', 'arm', 'rightHand']);
});

test('frame parts stack on the fixed ground point', () => {
  const cmds = layoutMech(sizes);
  const at = (slot: string, dim: boolean) => cmds.find((c) => c.slot === slot && c.dim === dim)!;
  expect(at('legs', false)).toMatchObject({ x: 30, y: 96 });   // bottom-centre on the ground point (60,146)
  expect(at('core', false)).toMatchObject({ x: 35, y: 62 });   // overlaps the legs by 6
  expect(at('head', false)).toMatchObject({ x: 48, y: 46 });   // centred on the core, overlapping it by 4
  expect(at('arm', false)).toMatchObject({ x: 50, y: 63 });
  expect(at('arm', true)).toMatchObject({ x: 44, y: 61 });
});

test('weapons attach to the hand and the shoulder mount', () => {
  const cmds = layoutMech(sizes);
  const at = (slot: string) => cmds.find((c) => c.slot === slot)!;
  // front arm hand point = (50 + 10, 63 + 36) = (60, 99); grip = (10, 9)
  expect(at('rightHand')).toMatchObject({ x: 50, y: 90, dim: false });
  // the pod's bottom-right corner sits at (35 + 22.5, 62 + 10): slung over the back shoulder, behind the body
  expect(at('shoulder')).toMatchObject({ x: 2, y: 52 });
});

test('a turret with only a core and a shoulder weapon sits on the ground point', () => {
  const cmds = layoutMech({ core: sizes.core, shoulder: sizes.shoulder });
  expect(cmds.map((c) => c.slot)).toEqual(['shoulder', 'core']);
  const core = cmds[1];
  expect(core.x + sizes.core.w / 2).toBe(60);
  expect(core.y + sizes.core.h).toBe(146);
});

test('hand weapons are skipped when there are no arms', () => {
  const cmds = layoutMech({ core: sizes.core, rightHand: sizes.rightHand });
  expect(cmds.map((c) => c.slot)).toEqual(['core']);
});
