import { BACK_BOX, BACK_JOINTS, BACK_MOUNT, FAR_FIST, MECH_BOX, NEAR_FIST, SMALL_BOX, VIEWS, layoutMech, muzzleOf } from '../../src/ui/mechLayout';

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

test('a shield, taller than it is wide, is strapped to the far forearm instead of gripped by one end', () => {
  const shield = { w: 33, h: 52 };
  const cmds = layoutMech({ ...layers, leftHand: shield });
  expect(cmds.find((c) => c.slot === 'leftHand')).toEqual({
    slot: 'leftHand', x: Math.round(FAR_FIST.x - 0.5 * shield.w), y: Math.round(FAR_FIST.y - 0.6 * shield.h),
  });
});

test('low legs, such as tracks, lower everything that sits on them', () => {
  const tracks = { ...layers.legs, oy: 100, drop: 20 };
  const normal = layoutMech({ ...layers, ...weapons });
  const lowered = layoutMech({ ...layers, legs: tracks, ...weapons });
  const at = (cmds: typeof normal, slot: string) => cmds.find((c) => c.slot === slot)!;
  expect(at(lowered, 'legs')).toMatchObject({ x: 30, y: 100 });
  for (const slot of ['armFar', 'core', 'head', 'armNear', 'rightHand', 'leftHand', 'shoulder']) {
    expect(at(lowered, slot).x).toBe(at(normal, slot).x);
    expect(at(lowered, slot).y).toBe(at(normal, slot).y + 20);
  }
});

describe('the mech seen from behind', () => {
  const rifle = { w: 45, h: 18, gx: 10, gy: 12, mx: 46, my: 4 };
  const pod = { w: 33, h: 24, gx: 19, gy: 13, mx: 34, my: 8 };
  const shield = { w: 27, h: 42, gx: 13, gy: 25, mx: 13, my: 25 };
  const at = (cmds: ReturnType<typeof layoutMech>, slot: string) => cmds.find((c) => c.slot === slot)!;

  test('its pose box is four fifths of the one from the front', () => {
    expect([MECH_BOX, BACK_BOX, VIEWS.back.box, VIEWS.back.suffix]).toEqual([160, 128, 128, '.back']);
    expect([VIEWS.front.box, VIEWS.front.suffix]).toEqual([160, '']);
  });

  test('the joints from behind are narrow and lie inside the pose box: a neck over the body, a waist under it, a bar across the shoulders', () => {
    const { neck, shoulders, waist } = BACK_JOINTS;
    for (const joint of [neck, shoulders, waist]) {
      expect(joint.x).toBeGreaterThanOrEqual(0);
      expect(joint.y).toBeGreaterThanOrEqual(0);
      expect(joint.x + joint.w).toBeLessThanOrEqual(BACK_BOX);
      expect(joint.y + joint.h).toBeLessThanOrEqual(BACK_BOX);
    }
    // A neck and a waist stand upright and are narrow; the bar lies down, and is wider than both arms' shoulders are apart.
    expect(neck.h).toBeGreaterThan(neck.w);
    expect(waist.h).toBeGreaterThan(waist.w);
    expect(shoulders.w).toBeGreaterThan(shoulders.h * 4);
    expect(Math.max(neck.w, waist.w, shoulders.h)).toBeLessThanOrEqual(8);
    // From top to bottom: the neck, the bar, the waist; the neck reaches down into the bar, so they are one piece.
    expect(neck.y).toBeLessThan(shoulders.y);
    expect(neck.y + neck.h).toBeGreaterThanOrEqual(shoulders.y);
    expect(waist.y).toBeGreaterThan(shoulders.y + shoulders.h);
    // The neck and the waist are on the bar's width, and the bar reaches from the far arm's side to the near arm's.
    for (const upright of [neck, waist]) {
      expect(upright.x).toBeGreaterThan(shoulders.x);
      expect(upright.x + upright.w).toBeLessThan(shoulders.x + shoulders.w);
    }
    expect(shoulders.x).toBeLessThan(VIEWS.back.mount.x + 8);
    expect(shoulders.x + shoulders.w).toBeLessThan(VIEWS.back.nearFist.x);
  });

  test('what is nearest the camera is drawn last: the head is beyond the body, the shoulder weapon lies on the back over both, and the near arm over that', () => {
    expect(layoutMech({ ...layers, ...weapons }, 'back').map((c) => c.slot)).toEqual(
      ['armFar', 'leftHand', 'legs', 'head', 'core', 'shoulder', 'armNear', 'rightHand']);
  });

  test('frame layers keep the position they had in the pose from behind', () => {
    const cmds = layoutMech(layers, 'back');
    for (const [slot, size] of Object.entries(layers)) expect(at(cmds, slot)).toMatchObject({ x: size.ox, y: size.oy });
  });

  test('a weapon that was turned is held where it says it is held: on the fist, or on the mount', () => {
    const cmds = layoutMech({ ...layers, rightHand: rifle, leftHand: shield, shoulder: pod }, 'back');
    const { nearFist, farFist, mount } = VIEWS.back;
    expect(at(cmds, 'rightHand')).toEqual({ slot: 'rightHand', x: nearFist.x - 10, y: nearFist.y - 12 });
    expect(at(cmds, 'leftHand')).toEqual({ slot: 'leftHand', x: farFist.x - 13, y: farFist.y - 25 });
    expect(at(cmds, 'shoulder')).toEqual({ slot: 'shoulder', x: mount.x - 19, y: mount.y - 13 });
  });

  test('the fists and the mount from behind are on the mech: the near fist far to the right and high, the far one low on the left, the mount on the left shoulder', () => {
    const { nearFist, farFist, mount, box } = VIEWS.back;
    for (const p of [nearFist, farFist, mount]) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(box);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(box);
    }
    expect(nearFist.x).toBeGreaterThan(box * 0.7);
    expect(nearFist.y).toBeLessThan(box * 0.4);
    expect(farFist.x).toBeLessThan(box * 0.35);
    expect(farFist.y).toBeGreaterThan(nearFist.y + 15);
    expect(mount.x).toBeLessThan(box * 0.45);
    expect(mount.y).toBeLessThan(nearFist.y);
  });

  test('low legs lower what sits on them from behind too', () => {
    const tracks = { ...layers.legs, oy: 80, drop: 22 };
    const normal = layoutMech({ ...layers, rightHand: rifle, shoulder: pod }, 'back');
    const lowered = layoutMech({ ...layers, legs: tracks, rightHand: rifle, shoulder: pod }, 'back');
    expect(at(lowered, 'legs').y).toBe(80);
    for (const slot of ['armFar', 'core', 'head', 'armNear', 'rightHand', 'shoulder']) expect(at(lowered, slot).y).toBe(at(normal, slot).y + 22);
  });
});

describe('a mech that stands far off', () => {
  test('is the mech from the front in a smaller box: the same order, the fists and the mount where they are from the front, reduced', () => {
    expect([SMALL_BOX, VIEWS.small.box, VIEWS.small.suffix]).toEqual([104, 104, '.small']);
    expect(VIEWS.small.order).toEqual(VIEWS.front.order);
    const k = SMALL_BOX / MECH_BOX;
    for (const [smaller, full] of [[VIEWS.small.nearFist, NEAR_FIST], [VIEWS.small.farFist, FAR_FIST], [VIEWS.small.mount, BACK_MOUNT]]) {
      expect(Math.abs(smaller.x - full.x * k)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(smaller.y - full.y * k)).toBeLessThanOrEqual(0.5);
    }
    const cmds = layoutMech({ ...layers, ...weapons }, 'small');
    expect(cmds.find((c) => c.slot === 'rightHand')).toEqual({
      slot: 'rightHand', x: Math.round(VIEWS.small.nearFist.x - 0.2 * 70), y: Math.round(VIEWS.small.nearFist.y - 10),
    });
  });
});

describe('where a weapon fires from', () => {
  test('from the front: four fifths of its length past the fist and a little above it; a shoulder weapon two fifths past its mount', () => {
    const sizes = { ...layers, ...weapons };
    expect(muzzleOf(sizes, 'rightHand')).toEqual({ x: Math.round(NEAR_FIST.x + 0.8 * 70), y: NEAR_FIST.y - 2 });
    expect(muzzleOf(sizes, 'leftHand')).toEqual({ x: Math.round(FAR_FIST.x + 0.8 * 40), y: FAR_FIST.y - 2 });
    expect(muzzleOf(sizes, 'shoulder')).toEqual({ x: Math.round(BACK_MOUNT.x + 0.4 * 40), y: BACK_MOUNT.y });
  });

  test('a weapon that was turned fires from where it says its far end is', () => {
    const rifle = { w: 45, h: 18, gx: 10, gy: 12, mx: 46, my: 4 };
    const pod = { w: 33, h: 24, gx: 19, gy: 13, mx: 34, my: 8 };
    const sizes = { ...layers, rightHand: rifle, shoulder: pod };
    const { nearFist, mount } = VIEWS.back;
    expect(muzzleOf(sizes, 'rightHand', 'back')).toEqual({ x: nearFist.x - 10 + 46, y: nearFist.y - 12 + 4 });
    expect(muzzleOf(sizes, 'shoulder', 'back')).toEqual({ x: mount.x - 19 + 34, y: mount.y - 13 + 8 });
    // Up and to the right of where it is held: it points away, at what the mech faces.
    expect(muzzleOf(sizes, 'rightHand', 'back')!.x).toBeGreaterThan(nearFist.x + 20);
    expect(muzzleOf(sizes, 'rightHand', 'back')!.y).toBeLessThan(nearFist.y);
  });

  test('low legs bring it down with the weapon, and a weapon that is not carried fires from nowhere', () => {
    const sizes = { ...layers, ...weapons };
    const tracks = { ...layers.legs, drop: 20 };
    expect(muzzleOf({ ...sizes, legs: tracks }, 'rightHand')).toEqual({ x: muzzleOf(sizes, 'rightHand')!.x, y: muzzleOf(sizes, 'rightHand')!.y + 20 });
    expect(muzzleOf(layers, 'rightHand')).toBeNull();
    const { armNear: _gone, ...armless } = sizes;
    expect(muzzleOf(armless, 'rightHand')).toBeNull();
  });
});
