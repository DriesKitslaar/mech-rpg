import type { SpriteSlot } from './mechLayout';

/**
 * How a mech moves. A mech is a paper doll of layers cut from one drawing, so it can be made to
 * breathe, kick, flinch and fall apart by shifting those layers a few whole pixels: no picture
 * is drawn twice. Everything here is arithmetic on time; nothing is drawn.
 *
 * Offsets are in the mech's own pose box, where forward (towards the enemy) is to the right. A mech
 * drawn mirrored needs nothing changed.
 */
export type LayerOffset = { dx: number; dy: number };
export type Pose = Partial<Record<SpriteSlot, LayerOffset>>;
export type ActionName = 'fireNear' | 'fireFar' | 'fireShoulder' | 'hit' | 'boost' | 'strike' | 'destroyed';
/** What a unit is in the middle of, as far as its stance shows it. */
export interface Stance { guarding?: boolean; staggered?: boolean; overheated?: boolean }

export const POSE_MS: Record<ActionName, number> = {
  fireNear: 220, fireFar: 220, fireShoulder: 300, hit: 260, boost: 420, strike: 320, destroyed: 550,
};

const r = (n: number): number => Math.round(n) || 0;
/** A sharp start that dies away: 1 at the beginning, 0 at the end. */
const kick = (p: number): number => (1 - p) * (1 - p);
/** Up and back down again: 0 at both ends, 1 in the middle. */
const arc = (p: number): number => Math.sin(Math.PI * p);

/** Builds a pose from offsets per layer, leaving out the layers that do not move. */
function pose(parts: Partial<Record<SpriteSlot, [number, number]>>): Pose {
  const out: Pose = {};
  for (const [slot, [dx, dy]] of Object.entries(parts) as [SpriteSlot, [number, number]][]) {
    const offset = { dx: r(dx), dy: r(dy) };
    if (offset.dx !== 0 || offset.dy !== 0) out[slot] = offset;
  }
  return out;
}

/** A weapon goes where the arm that holds it goes. */
function held(parts: Partial<Record<SpriteSlot, [number, number]>>): Partial<Record<SpriteSlot, [number, number]>> {
  return { ...parts, ...(parts.armNear ? { rightHand: parts.armNear } : {}), ...(parts.armFar ? { leftHand: parts.armFar } : {}) };
}

export function addPoses(...poses: Pose[]): Pose {
  const out: Pose = {};
  for (const p of poses) {
    for (const [slot, offset] of Object.entries(p) as [SpriteSlot, LayerOffset][]) {
      const had = out[slot] ?? { dx: 0, dy: 0 };
      out[slot] = { dx: had.dx + offset.dx, dy: had.dy + offset.dy };
    }
  }
  return out;
}

/**
 * Standing still: the body rises and settles on planted legs, the head and the arms a beat behind
 * it, and every few seconds the weight shifts a pixel. `phase` keeps two mechs out of step.
 */
export function idlePose(clockMs: number, phase = 0): Pose {
  const t = clockMs / 520 + phase;
  const breath = Math.sin(t);
  const lean = Math.sin(clockMs / 2600 + phase * 1.7);
  const body: [number, number] = [lean * 0.8, breath];
  const arms: [number, number] = [lean * 0.8, Math.sin(t - 0.9)];
  return pose(held({ core: body, shoulder: body, head: [lean * 1.2, Math.sin(t - 0.5)], armNear: arms, armFar: [lean * 0.8, Math.sin(t - 1.3)] }));
}

/** The stance a state puts a mech in, for as long as the state lasts. */
export function statePose(stance: Stance, clockMs: number): Pose {
  const poses: Pose[] = [];
  // Braced: knees bent, the far arm (the shield arm) brought across the body.
  if (stance.guarding) poses.push(pose(held({ core: [0, 3], head: [-1, 4], shoulder: [0, 3], armNear: [-2, 3], armFar: [8, 0] })));
  // Off balance: sagging, and swaying on its feet.
  if (stance.staggered) {
    const sway = Math.sin(clockMs / 170) * 2.4;
    poses.push(pose(held({ core: [sway, 2], shoulder: [sway, 2], head: [sway * 1.4, 3], armNear: [sway, 4], armFar: [sway, 4] })));
  }
  // Shut down: the whole upper body hangs.
  if (stance.overheated) poses.push(pose(held({ core: [-1, 3], shoulder: [-1, 3], head: [-2, 5], armNear: [-2, 6], armFar: [-1, 5] })));
  return addPoses(...poses);
}

/** One action at a point `p` of its length, from 0 (it begins) to 1 (it is over). */
export function actionPose(name: ActionName, p: number): Pose {
  if (p >= 1 && name !== 'destroyed') return {};
  const k = kick(Math.max(0, p));
  const a = arc(Math.max(0, Math.min(1, p)));
  switch (name) {
    case 'fireNear':
      return pose(held({ armNear: [-6 * k, -1 * k], core: [-2 * k, 0], head: [-2 * k, -1 * k], shoulder: [-2 * k, 0], armFar: [-1 * k, 0] }));
    case 'fireFar':
      return pose(held({ armFar: [-5 * k, -1 * k], core: [-2 * k, 0], head: [-1 * k, 0], shoulder: [-2 * k, 0] }));
    case 'fireShoulder':
      return pose(held({ shoulder: [-5 * k, 2 * k], core: [-2 * k, 2 * k], head: [-2 * k, 2 * k], armNear: [-1 * k, 2 * k], armFar: [-1 * k, 2 * k] }));
    case 'hit':
      return pose(held({ core: [-4 * k, 0], shoulder: [-4 * k, 0], head: [-7 * k, -1 * k], armNear: [-5 * k, 1 * k], armFar: [-3 * k, 1 * k] }));
    case 'boost':
      return pose(held({ core: [4 * a, 2 * a], shoulder: [3 * a, 2 * a], head: [6 * a, 3 * a], armNear: [3 * a, 3 * a], armFar: [1 * a, 3 * a] }));
    case 'strike': {
      // The near arm is drawn back and up, then brought down and through.
      const swing = p < 0.4 ? -8 * (p / 0.4) : -8 + 18 * Math.min(1, (p - 0.4) / 0.35);
      const reach = p < 0.4 ? -4 * (p / 0.4) : 8 * arc(Math.min(1, (p - 0.4) / 0.6));
      return pose(held({ armNear: [reach, swing * (1 - Math.max(0, (p - 0.75) / 0.25))], core: [reach * 0.4, 0], head: [reach * 0.5, 0], shoulder: [reach * 0.4, 0] }));
    }
    case 'destroyed': {
      // Every layer is thrown its own way and falls.
      const q = Math.max(0, Math.min(1, p));
      const fall = 46 * q * q - 18 * q;
      const fly = (x: number, lift: number): [number, number] => [x * q, fall - lift * q];
      return pose({
        head: fly(-14, 26), core: fly(4, 4), shoulder: fly(-30, 14), armNear: fly(34, 12), armFar: fly(-22, 6),
        rightHand: fly(46, 20), leftHand: fly(-34, 2), legs: [0, 6 * q * q],
      });
    }
  }
}

/**
 * Where the four quarters of a machine that is one picture have got to, `q` of the way through its
 * destruction: each is thrown outward from the middle and falls. Offsets are whole pixels, for the
 * quarters in reading order (top left, top right, bottom left, bottom right).
 */
export function shatter(q: number): LayerOffset[] {
  const p = Math.max(0, Math.min(1, q));
  const fall = 40 * p * p;
  return [[-16, -22], [18, -16], [-12, -4], [14, -8]].map(([x, lift]) => ({ dx: r(x * p), dy: r(lift * p + fall) }));
}

/**
 * The moving part of one mech: what it has been told to do and when, on top of standing still and
 * whatever state it is in. With motion off (the test mode) it never moves.
 */
export class Puppet {
  private now = 0;
  private acts: { name: ActionName; start: number }[] = [];
  private wrecked = false;
  /** How the unit stood at the moment it began to come apart: it is held there, not snapped upright. */
  private last: Pose | null = null;

  /** `breathes` is false for a machine that is one picture and stands on the ground: a turret does not heave. */
  constructor(private phase = 0, private moving = true, private breathes = true) {}

  /** Starts an action, now or after a delay. */
  play(name: ActionName, delayMs = 0): void {
    if (!this.moving) return;
    this.acts.push({ name, start: this.now + delayMs });
  }

  update(dtMs: number): void {
    this.now += dtMs;
    for (const act of this.acts) if (act.name === 'destroyed' && this.now >= act.start + POSE_MS.destroyed) this.wrecked = true;
    this.acts = this.acts.filter((act) => this.now < act.start + POSE_MS[act.name]);
  }

  /** How far along its destruction this unit is, from 0 to 1; null while it is whole. */
  get breaking(): number | null {
    if (this.wrecked) return 1;
    const act = this.acts.find((a) => a.name === 'destroyed' && this.now >= a.start);
    return act ? Math.min(1, (this.now - act.start) / POSE_MS.destroyed) : null;
  }

  /** True while something that was started is still playing or waiting to. */
  get busy(): boolean {
    return this.acts.length > 0;
  }

  pose(stance: Stance, clockMs: number): Pose {
    if (!this.moving) return {};
    if (this.wrecked) return actionPose('destroyed', 1);
    const playing = this.acts.filter((act) => this.now >= act.start).map((act) => actionPose(act.name, (this.now - act.start) / POSE_MS[act.name]));
    // A mech that is coming apart no longer breathes or sways: it breaks up from however it stood.
    if (this.acts.some((act) => act.name === 'destroyed' && this.now >= act.start)) {
      this.last ??= addPoses(this.breathes ? idlePose(clockMs, this.phase) : {}, statePose(stance, clockMs));
      return addPoses(this.last, ...playing);
    }
    return addPoses(this.breathes ? idlePose(clockMs, this.phase) : {}, statePose(stance, clockMs), ...playing);
  }
}

/** The events that change how a unit stands. */
type StanceEvent = { type: string; unit?: string };
interface StanceSource { id: string; destroyed: boolean; guarding: boolean; staggered: number; overheated: boolean }

/**
 * How each unit stands as far as the screen has shown: the rules are always a few messages ahead of
 * what is on screen, so a guard that the rules have already dropped is kept up until the screen gets
 * to the turn that drops it, and a stagger starts with its own message, not with the shot before it.
 */
export class ShownStance {
  private shown = new Map<string, Required<Stance>>();

  private entry(id: string): Required<Stance> {
    let s = this.shown.get(id);
    if (!s) { s = { guarding: false, staggered: false, overheated: false }; this.shown.set(id, s); }
    return s;
  }

  /** An event has just been shown. */
  onEvent(event: StanceEvent): void {
    if (!event.unit) return;
    const s = this.entry(event.unit);
    switch (event.type) {
      case 'guard': s.guarding = true; break;
      case 'stagger': s.staggered = true; break;
      case 'recover': s.staggered = false; break;
      case 'overheat': s.overheated = true; break;
      // A turn that is taken starts upright; one that is lost to heat is spent hanging.
      case 'turnStart': s.guarding = false; s.overheated = false; break;
      case 'turnSkipped': s.guarding = false; break;
      default: break;
    }
  }

  /** Everything has been shown: the screen and the rules agree, so take the rules' word. A wreck stays as it fell. */
  sync(units: StanceSource[]): void {
    for (const u of units) {
      if (u.destroyed) continue;
      const s = this.entry(u.id);
      s.guarding = u.guarding;
      s.staggered = u.staggered > 0;
      // Heat that cost the turn just shown keeps the mech hanging until its next turn starts.
      if (u.overheated) s.overheated = true;
    }
  }

  of(id: string): Stance { return this.entry(id); }
}
