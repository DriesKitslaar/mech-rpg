import { BACK_MOUNT, FAR_FIST, NEAR_FIST, layoutMech } from '../../src/ui/mechLayout';

/** Frame layers carry their own position inside the pose; weapons only have a size. */
const layers = {
  armFar: { w: 30, h: 40, ox: 20, oy: 40 },
  legs: { w: 90, h: 80, ox: 30, oy: 75 },
  core: { w: 40, h: 50, ox: 60, oy: 30 },
  head: { w: 20, h: 22, ox: 70, oy: 10 },
  armNear: { w: 50, h: 30, ox: 95, oy: 35 },
};
const weapons = { rightHand: { w: 70, h: 20 }, leftHand: { w: 40, h: 16 }, shoulder: { w: 40, h: 24 } };

test('a full mech is drawn back to front', () => {
  expect(layoutMech({ ...layers, ...weapons }).map((c) => c.slot)).toEqual(
    ['shoulder', 'armFar', 'leftHand', 'legs', 'core', 'head', 'armNear', 'rightHand']);
});

test('frame layers keep the position they had in the pose', () => {
  const cmds = layoutMech(layers);
  for (const [slot, size] of Object.entries(layers)) {
    expect(cmds.find((c) => c.slot === slot)).toMatchObject({ x: size.ox, y: size.oy });
  }
});

test('hand weapons are gripped at the fists and the shoulder weapon sits on the back mount', () => {
  const cmds = layoutMech({ ...layers, ...weapons });
  const at = (slot: string) => cmds.find((c) => c.slot === slot)!;
  expect(at('rightHand')).toEqual({ slot: 'rightHand', x: Math.round(NEAR_FIST.x - 14), y: Math.round(NEAR_FIST.y - 10) });
  expect(at('leftHand')).toEqual({ slot: 'leftHand', x: Math.round(FAR_FIST.x - 8), y: Math.round(FAR_FIST.y - 8) });
  expect(at('shoulder')).toEqual({ slot: 'shoulder', x: Math.round(BACK_MOUNT.x - 24), y: Math.round(BACK_MOUNT.y - 12) });
});

test('a hand weapon is not drawn without the arm that holds it', () => {
  const { armNear: _near, ...noNear } = layers;
  expect(layoutMech({ ...noNear, ...weapons }).map((c) => c.slot)).not.toContain('rightHand');
  const { armFar: _far, ...noFar } = layers;
  expect(layoutMech({ ...noFar, ...weapons }).map((c) => c.slot)).not.toContain('leftHand');
});

test('absent slots are simply left out', () => {
  expect(layoutMech({ core: layers.core, shoulder: weapons.shoulder }).map((c) => c.slot)).toEqual(['shoulder', 'core']);
});

test('a frame layer without a recorded position is placed at the origin', () => {
  expect(layoutMech({ core: { w: 10, h: 10 } })).toEqual([{ slot: 'core', x: 0, y: 0 }]);
});
