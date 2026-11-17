import type { Pt } from './light';
import { FIELD, type Place } from './stage';

/**
 * The camera a battle is looked at through. At home it shows the field as the stage lays it out,
 * pixel for pixel, and it is at home whenever nothing moves. It leaves home at two kinds of moment:
 * as a battle opens it starts high up in the place's picture and comes down to the floor and who
 * stands on it; and when a blow lands it pushes in a little towards what was hit, and eases back.
 * On its way down it shows the picture's upper rows and nothing from outside the picture; pushed
 * in, it shows a part of the field as it stands and nothing from outside that. A calm picture and
 * a hurried game have it standing at home always.
 */

/** A view of the stage: the point of it that is in the middle of the field, and how many times its own size it is shown at. */
export interface View { x: number; y: number; zoom: number }

/** The middle of the field: what the camera looks at when it is at home. */
export const MIDDLE: Pt = { x: FIELD.width / 2, y: FIELD.top + FIELD.height / 2 };
export const HOME: View = { x: MIDDLE.x, y: MIDDLE.y, zoom: 1 };
export const atHome = (view: View): boolean => view.x === HOME.x && view.y === HOME.y && view.zoom === 1;

/** The part of the stage a view shows. */
export interface Seen { left: number; top: number; width: number; height: number }
export function seenBy(view: View): Seen {
  const width = FIELD.width / view.zoom;
  const height = FIELD.height / view.zoom;
  return { left: view.x - width / 2, top: view.y - height / 2, width, height };
}

/**
 * The view nearest to this one that shows nothing from outside the field as it stands at home.
 * From closer there is room to turn, the same share of the field each way: across and up and down.
 */
export function inField(view: View): View {
  const zoom = Math.max(1, view.zoom);
  const halfW = FIELD.width / zoom / 2;
  const halfH = FIELD.height / zoom / 2;
  return {
    zoom,
    x: Math.max(halfW, Math.min(FIELD.width - halfW, view.x)),
    y: Math.max(FIELD.top + halfH, Math.min(FIELD.top + FIELD.height - halfH, view.y)),
  };
}

/** The share of the banner's time the camera takes to come down: it is home before the banner leaves. */
export const TRAVEL_SHARE = 0.7;
const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));

/**
 * The view as a battle opens, `share` of the way through its banner (0 as it comes up, 1 as it
 * goes): from the top of the place's picture, where its sky or its ceiling is, down to home. It
 * moves by whole pixels and stays at the picture's own size, so every frame of it is pixel for pixel.
 */
export function openingView(share: number, place: Place): View {
  const done = easeInOut(Math.max(0, Math.min(1, share / TRAVEL_SHARE)));
  return { x: HOME.x, y: HOME.y - Math.round(place.row * (1 - done)), zoom: 1 };
}

/** How long a push takes to come in, how long it is held, and how long it takes to ease back. */
export const PUSH_IN_MS = 90;
export const PUSH_HOLD_MS = 110;
export const PUSH_OUT_MS = 340;
export const PUSH_MS = PUSH_IN_MS + PUSH_HOLD_MS + PUSH_OUT_MS;
/** The closest the camera ever pushes in: a tenth and a half again. */
export const MAX_PUSH = 0.15;

/** How far in a push is, from 0 to 1, this long after it began: quickly in, held a moment, slowly out. */
export function pushLevel(ms: number): number {
  if (ms <= 0 || ms >= PUSH_MS) return 0;
  if (ms < PUSH_IN_MS) return 1 - (1 - ms / PUSH_IN_MS) ** 2;
  if (ms < PUSH_IN_MS + PUSH_HOLD_MS) return 1;
  return 1 - easeInOut((ms - PUSH_IN_MS - PUSH_HOLD_MS) / PUSH_OUT_MS);
}

interface Push { start: number; focus: Pt; amount: number }

export class Camera {
  private now = 0;
  private pushes: Push[] = [];

  /** A camera for a place. One that is not `moving` (a calm picture, a hurried game) stands at home always. */
  constructor(private place: Place, private moving = true) {}

  /** Lets time pass: the field's own time, so that what holds the field holds the camera too. */
  update(ms: number): void {
    this.now += ms;
    this.pushes = this.pushes.filter((push) => this.now < push.start + PUSH_MS);
  }

  /**
   * Pushes in towards a point of the stage by `amount` (0.1 is a tenth closer), starting `delay`
   * from now: for a blow, the moment it lands.
   */
  push(focus: Pt, amount: number, delay = 0): void {
    if (!this.moving || !(amount > 0)) return;
    this.pushes.push({ start: this.now + delay, focus: { ...focus }, amount: Math.min(MAX_PUSH, amount) });
  }

  /** Forgets every push: something else has the picture now. */
  settle(): void {
    this.pushes = [];
  }

  /** True while a push is going on or still to come. */
  get busy(): boolean {
    return this.pushes.length > 0;
  }

  /**
   * The view right now. `opening` is how far through its banner the battle is, while it is up.
   * Of several pushes at once the closest says how close the camera is, and each has its say in
   * where it looks by how far in it is. At home the view is `HOME` itself.
   */
  view(opening: number | null = null): View {
    if (!this.moving) return HOME;
    if (opening !== null) return openingView(opening, this.place);
    // Every push that is going on: how far through its own coming in and going out it is, and how far in that has it.
    const going = this.pushes
      .map((push) => { const turn = pushLevel(this.now - push.start); return { push, turn, level: turn * push.amount }; })
      .filter(({ level }) => level > 0);
    if (going.length === 0) return HOME;
    const zoom = 1 + Math.max(...going.map(({ level }) => level));
    // Each push has the camera turn towards what it pushes in on: as far as it has come in itself, and as far as the
    // field lets it that close. Of several, each has its say by how far in it is, and one that is only beginning has
    // little yet: it takes the picture over by degrees as it comes in and the other goes out, and the picture never
    // jumps from the one to the other.
    let x = 0;
    let y = 0;
    let all = 0;
    for (const { push, turn, level } of going) {
      const own = inField({ zoom, x: HOME.x + (push.focus.x - HOME.x) * turn, y: HOME.y + (push.focus.y - HOME.y) * turn });
      const say = level * turn;
      x += own.x * say;
      y += own.y * say;
      all += say;
    }
    return { zoom, x: x / all, y: y / all };
  }
}

/**
 * Moves and scales the canvas so that a view of the stage fills the field, and keeps the drawing
 * inside the field. At home nothing is done at all: the stage is the screen.
 */
export function applyView(ctx: CanvasRenderingContext2D, view: View): void {
  if (atHome(view)) return;
  ctx.beginPath();
  ctx.rect(0, FIELD.top, FIELD.width, FIELD.height);
  ctx.clip();
  ctx.translate(MIDDLE.x - view.x * view.zoom, MIDDLE.y - view.y * view.zoom);
  ctx.scale(view.zoom, view.zoom);
}
