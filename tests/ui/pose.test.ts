import { POSE_MS, Puppet, actionPose, addPoses, idlePose, statePose, type Pose } from '../../src/ui/pose';

const at = (pose: Pose, slot: keyof Pose) => pose[slot] ?? { dx: 0, dy: 0 };
const UPPER = ['core', 'head', 'armNear', 'armFar', 'rightHand', 'leftHand', 'shoulder'] as const;

describe('standing still', () => {
  test('the legs stay planted while the body above them breathes', () => {
    let moved = false;
    for (let t = 0; t < 12000; t += 90) {
      const pose = idlePose(t);
      expect(at(pose, 'legs')).toEqual({ dx: 0, dy: 0 });
      if (at(pose, 'core').dy !== 0) moved = true;
      // Never more than a couple of pixels: it breathes, it does not dance.
      for (const slot of UPPER) {
        expect(Math.abs(at(pose, slot).dx)).toBeLessThanOrEqual(2);
        expect(Math.abs(at(pose, slot).dy)).toBeLessThanOrEqual(2);
      }
    }
    expect(moved).toBe(true);
  });

  test('a weapon moves with the arm that holds it, and offsets are whole pixels', () => {
    for (let t = 0; t < 6000; t += 70) {
      const pose = idlePose(t);
      expect(at(pose, 'rightHand')).toEqual(at(pose, 'armNear'));
      expect(at(pose, 'leftHand')).toEqual(at(pose, 'armFar'));
      for (const slot of UPPER) {
        expect(Number.isInteger(at(pose, slot).dx)).toBe(true);
        expect(Number.isInteger(at(pose, slot).dy)).toBe(true);
      }
    }
  });

  test('two mechs given different phases do not breathe in step', () => {
    const differs = [0, 300, 600, 900, 1200].some((t) => at(idlePose(t), 'core').dy !== at(idlePose(t, 2), 'core').dy);
    expect(differs).toBe(true);
  });
});

describe('things a mech does', () => {
  test('firing the near hand kicks that arm and its weapon back hardest at the start, and it is back in place at the end', () => {
    const start = actionPose('fireNear', 0.05);
    expect(at(start, 'armNear').dx).toBeLessThanOrEqual(-3);
    expect(at(start, 'rightHand')).toEqual(at(start, 'armNear'));
    // The body rocks less than the arm, the legs not at all.
    expect(Math.abs(at(start, 'core').dx)).toBeLessThan(Math.abs(at(start, 'armNear').dx));
    expect(at(start, 'legs')).toEqual({ dx: 0, dy: 0 });
    expect(actionPose('fireNear', 1)).toEqual({});
  });

  test('each weapon mount has a kick of its own', () => {
    expect(at(actionPose('fireFar', 0.05), 'armFar').dx).toBeLessThan(0);
    expect(at(actionPose('fireFar', 0.05), 'armNear').dx).toBe(0);
    expect(at(actionPose('fireShoulder', 0.05), 'shoulder').dx).toBeLessThan(0);
  });

  test('a hit throws the upper body back, the head most of all', () => {
    const pose = actionPose('hit', 0.1);
    expect(at(pose, 'core').dx).toBeLessThan(0);
    expect(at(pose, 'head').dx).toBeLessThan(at(pose, 'core').dx);
    expect(actionPose('hit', 1)).toEqual({});
  });

  test('a boost leans the mech forward and a strike swings the near arm through', () => {
    expect(at(actionPose('boost', 0.5), 'core').dx).toBeGreaterThan(0);
    const early = at(actionPose('strike', 0.2), 'armNear').dy;
    const late = at(actionPose('strike', 0.8), 'armNear').dy;
    expect(early).toBeLessThan(0);
    expect(late).toBeGreaterThan(0);
  });

  test('a destroyed mech comes apart: its layers end up far from each other', () => {
    const pose = actionPose('destroyed', 1);
    const spread = UPPER.map((slot) => at(pose, slot).dx);
    expect(Math.max(...spread) - Math.min(...spread)).toBeGreaterThan(30);
    expect(actionPose('destroyed', 0)).toEqual({});
  });

  test('every action has a length', () => {
    for (const name of ['fireNear', 'fireFar', 'fireShoulder', 'hit', 'boost', 'strike', 'destroyed'] as const) expect(POSE_MS[name]).toBeGreaterThan(0);
  });
});

describe('states a mech is in', () => {
  test('guarding crouches and brings the far arm forward; staggered sags and sways; overheated slumps', () => {
    const guard = statePose({ guarding: true }, 0);
    expect(at(guard, 'core').dy).toBeGreaterThan(0);
    expect(at(guard, 'armFar').dx).toBeGreaterThan(0);
    expect(at(guard, 'leftHand')).toEqual(at(guard, 'armFar'));
    const sways = new Set([0, 100, 200, 300, 400].map((t) => at(statePose({ staggered: true }, t), 'core').dx));
    expect(sways.size).toBeGreaterThan(1);
    expect(at(statePose({ overheated: true }, 0), 'head').dy).toBeGreaterThan(at(statePose({ overheated: true }, 0), 'core').dy);
    expect(statePose({}, 0)).toEqual({});
  });
});

test('poses add up layer by layer', () => {
  expect(addPoses({ core: { dx: 1, dy: 2 } }, { core: { dx: -3, dy: 1 }, head: { dx: 1, dy: 0 } })).toEqual({ core: { dx: -2, dy: 3 }, head: { dx: 1, dy: 0 } });
});

describe('a puppet', () => {
  test('plays what it is told after its delay, for as long as it lasts, and then stands still again', () => {
    const puppet = new Puppet(1);
    puppet.play('fireNear', 100);
    expect(at(puppet.pose({}, 0), 'armNear').dx).toBeGreaterThanOrEqual(-2);
    puppet.update(110);
    expect(at(puppet.pose({}, 110), 'armNear').dx).toBeLessThanOrEqual(-3);
    puppet.update(POSE_MS.fireNear + 50);
    expect(puppet.busy).toBe(false);
    expect(Math.abs(at(puppet.pose({}, 0), 'armNear').dx)).toBeLessThanOrEqual(2);
  });

  test('once destroyed it stays apart and no longer breathes', () => {
    const puppet = new Puppet();
    puppet.play('destroyed');
    puppet.update(POSE_MS.destroyed + 500);
    expect(puppet.pose({}, 0)).toEqual(puppet.pose({}, 700));
    expect(at(puppet.pose({}, 0), 'head').dx).not.toBe(0);
  });

  test('with motion switched off it never moves', () => {
    const puppet = new Puppet(0, false);
    puppet.play('hit');
    puppet.update(20);
    expect(puppet.pose({ guarding: true, staggered: true }, 500)).toEqual({});
  });
});
