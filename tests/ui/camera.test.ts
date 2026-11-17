import {
  Camera, HOME, MAX_PUSH, MIDDLE, PUSH_HOLD_MS, PUSH_IN_MS, PUSH_MS, PUSH_OUT_MS, TRAVEL_SHARE, applyView, atHome, inPicture, openingView, pushLevel, seenBy, type View,
} from '../../src/ui/camera';
import { FIELD, FIELD_Y, PANEL_Y, PLACES, PLAIN, pictureTop, placeFor, type Place } from '../../src/ui/stage';
import { record } from '../helpers/canvas';

/**
 * The camera a battle is looked at through: at home whenever nothing moves, coming down from the
 * top of the place's picture as a battle opens, pushing in towards a blow as it lands. Whatever it
 * does, it shows nothing from outside the picture.
 */

const ALL_PLACES: [string, Place][] = [...Object.entries(PLACES), ['plain', PLAIN]];
const NEON = placeFor('bg-neon-district');
/** True when a view shows only what is in the place's picture, give or take the smallest part of a pixel. */
function inside(view: View, place: Place): boolean {
  const seen = seenBy(view);
  const top = pictureTop(place);
  const slack = 1e-6;
  return seen.left >= -slack && seen.left + seen.width <= FIELD.width + slack && seen.top >= top - slack && seen.top + seen.height <= top + 270 + slack;
}

describe('home', () => {
  test('is the middle of the field at its own size: the stage is the screen', () => {
    expect(HOME).toEqual({ x: 155, y: FIELD_Y + 82, zoom: 1 });
    expect(MIDDLE).toEqual({ x: HOME.x, y: HOME.y });
    expect(atHome(HOME)).toBe(true);
    expect(seenBy(HOME)).toEqual({ left: 0, top: FIELD_Y, width: 310, height: PANEL_Y - FIELD_Y });
    for (const view of [{ ...HOME, x: 156 }, { ...HOME, y: 95 }, { ...HOME, zoom: 1.01 }]) expect(atHome(view)).toBe(false);
  });

  test('a view from closer shows less of the stage, round the point it looks at', () => {
    expect(seenBy({ x: 200, y: 100, zoom: 2 })).toEqual({ left: 122.5, top: 59, width: 155, height: 82 });
  });

  test('applying it does nothing at all; applying any other view keeps the drawing in the field and puts the point looked at in its middle', () => {
    const calls: string[] = [];
    const ctx = new Proxy({}, { get: (_t, name: string) => (...args: unknown[]) => { calls.push(`${name}(${args.join(',')})`); } }) as unknown as CanvasRenderingContext2D;
    applyView(ctx, HOME);
    expect(calls).toEqual([]);
    applyView(ctx, { x: 200, y: 100, zoom: 2 });
    expect(calls).toEqual(['beginPath()', `rect(0,${FIELD_Y},310,${PANEL_Y - FIELD_Y})`, 'clip()', `translate(${155 - 400},${96 - 200})`, 'scale(2,2)']);
    // A dot drawn at the point looked at lands in the middle of the field, twice the size; one at a corner of what is seen, at a corner of the field.
    const page = record((c) => {
      applyView(c, { x: 200, y: 100, zoom: 2 });
      c.fillStyle = '#fff';
      c.fillRect(200, 100, 1, 1);
      c.fillRect(122.5, 59, 1, 1);
    });
    expect(page.rects.map((r) => [r.x, r.y, r.w, r.h])).toEqual([[155, 96, 2, 2], [0, FIELD_Y, 2, 2]]);
  });
});

describe('a view that shows nothing from outside the picture', () => {
  test('is left as it is when it already does, and moved only as far as it must be when it does not', () => {
    expect(inPicture(HOME, NEON)).toEqual(HOME);
    // Twice as close there is room to look a quarter of the field to either side, and no further.
    expect(inPicture({ x: 0, y: HOME.y, zoom: 2 }, NEON)).toEqual({ x: 77.5, y: HOME.y, zoom: 2 });
    expect(inPicture({ x: 400, y: HOME.y, zoom: 2 }, NEON)).toEqual({ x: 232.5, y: HOME.y, zoom: 2 });
    expect(inPicture({ x: 100, y: HOME.y, zoom: 2 }, NEON)).toEqual({ x: 100, y: HOME.y, zoom: 2 });
    // At its own size the field is as wide as the picture: there is no looking sideways at all.
    expect(inPicture({ x: 100, y: HOME.y, zoom: 1 }, NEON).x).toBe(HOME.x);
    // Up, the picture goes on for as many rows as are over the field; down, for as many as are under it.
    expect(inPicture({ x: HOME.x, y: -500, zoom: 1 }, NEON).y).toBe(HOME.y - NEON.row);
    expect(inPicture({ x: HOME.x, y: 900, zoom: 1 }, NEON).y).toBe(HOME.y + (270 - 164 - NEON.row));
    // Further away than the picture's own size it cannot be looked at: the field would show its edges.
    expect(inPicture({ x: HOME.x, y: HOME.y, zoom: 0.5 }, NEON)).toEqual(HOME);
  });

  test('whatever is asked for, in every place', () => {
    let seed = 11;
    const next = (): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (const [id, place] of ALL_PLACES) {
      for (let i = 0; i < 200; i++) {
        const asked = { x: next() * 500 - 100, y: next() * 500 - 200, zoom: 0.5 + next() * 3 };
        expect(inside(inPicture(asked, place), place), `${id} ${JSON.stringify(asked)}`).toBe(true);
      }
    }
  });
});

describe('as a battle opens', () => {
  test('the camera starts at the top of the place\'s picture and comes down to home before the banner leaves', () => {
    for (const [id, place] of ALL_PLACES) {
      const first = openingView(0, place);
      // The top row of the picture is at the top of the field.
      expect(seenBy(first).top, id).toBe(pictureTop(place));
      expect(first.y, id).toBe(HOME.y - place.row);
      expect(openingView(TRAVEL_SHARE, place), id).toEqual(HOME);
      expect(openingView(1, place), id).toEqual(HOME);
      expect(openingView(7, place), id).toEqual(HOME);
      expect(openingView(-1, place), id).toEqual(first);
    }
    expect(TRAVEL_SHARE).toBeGreaterThan(0.5);
    expect(TRAVEL_SHARE).toBeLessThan(0.88);
  });

  test('it only ever comes down, by whole pixels, at the picture\'s own size, and shows no edge of the picture on the way', () => {
    for (const [id, place] of ALL_PLACES) {
      let last = openingView(0, place).y;
      const steps = new Set<number>();
      for (let share = 0; share <= 1.0001; share += 0.01) {
        const view = openingView(share, place);
        expect(view.zoom, id).toBe(1);
        expect(view.x, id).toBe(HOME.x);
        expect(Number.isInteger(view.y), id).toBe(true);
        expect(view.y, id).toBeGreaterThanOrEqual(last);
        expect(inside(view, place), id).toBe(true);
        steps.add(view.y);
        last = view.y;
      }
      // It is a travel, not a cut: it is seen at many heights on the way.
      expect(steps.size, id).toBeGreaterThan(20);
    }
  });

  test('it starts slowly, is fastest half way, and comes to rest slowly', () => {
    const y = (share: number): number => openingView(share, NEON).y;
    const early = y(0.07) - y(0);
    const middle = y(0.385) - y(0.315);
    const late = y(0.7) - y(0.63);
    expect(middle).toBeGreaterThan(early * 3);
    expect(middle).toBeGreaterThan(late * 3);
    // Half way through its time it is half way down.
    expect(Math.abs(y(TRAVEL_SHARE / 2) - (HOME.y - NEON.row / 2))).toBeLessThanOrEqual(1);
  });
});

describe('a push', () => {
  test('comes in quickly, is held a moment, eases back slowly, and is over after half a second or so', () => {
    expect(pushLevel(0)).toBe(0);
    expect(pushLevel(-5)).toBe(0);
    expect(pushLevel(PUSH_IN_MS)).toBe(1);
    expect(pushLevel(PUSH_IN_MS + PUSH_HOLD_MS - 1)).toBe(1);
    expect(pushLevel(PUSH_MS)).toBe(0);
    expect(pushLevel(PUSH_MS + 100)).toBe(0);
    // In: more than half way after half the time. Out: slow to leave, slow to arrive.
    expect(pushLevel(PUSH_IN_MS / 2)).toBeCloseTo(0.75, 6);
    expect(pushLevel(PUSH_IN_MS + PUSH_HOLD_MS + PUSH_OUT_MS / 2)).toBeCloseTo(0.5, 6);
    expect(pushLevel(PUSH_IN_MS + PUSH_HOLD_MS + PUSH_OUT_MS * 0.1)).toBeGreaterThan(0.97);
    for (let ms = 0; ms < PUSH_IN_MS; ms += 5) expect(pushLevel(ms + 5)).toBeGreaterThan(pushLevel(ms));
    for (let ms = PUSH_IN_MS + PUSH_HOLD_MS; ms < PUSH_MS - 5; ms += 5) expect(pushLevel(ms + 5)).toBeLessThan(pushLevel(ms));
    expect(PUSH_OUT_MS).toBeGreaterThan(PUSH_IN_MS * 3);
    expect(PUSH_MS).toBeLessThanOrEqual(600);
  });
});

describe('the camera', () => {
  const ENEMY = { x: 240, y: 110 };
  const OWN = { x: 60, y: 110 };

  test('stands at home until something moves it, and is home again, exactly, when a push is over', () => {
    const camera = new Camera(NEON);
    expect(camera.view()).toBe(HOME);
    expect(camera.busy).toBe(false);
    camera.push(ENEMY, 0.1);
    expect(camera.busy).toBe(true);
    // The moment it is asked for nothing has moved yet.
    expect(camera.view()).toBe(HOME);
    camera.update(PUSH_IN_MS);
    expect(camera.view().zoom).toBeCloseTo(1.1, 6);
    camera.update(PUSH_HOLD_MS + PUSH_OUT_MS);
    expect(camera.view()).toBe(HOME);
    expect(camera.busy).toBe(false);
  });

  test('pushes in towards what was hit: to the right for an enemy, to the left for the pilot\'s mech, as far as the picture lets it turn', () => {
    const right = new Camera(NEON);
    right.push(ENEMY, 0.1);
    right.update(PUSH_IN_MS);
    const left = new Camera(NEON);
    left.push(OWN, 0.1);
    left.update(PUSH_IN_MS);
    expect(right.view().x).toBeGreaterThan(HOME.x + 5);
    expect(left.view().x).toBeLessThan(HOME.x - 5);
    // A tenth closer there are fourteen pixels of picture to turn into on either side: it turns that far and no further.
    expect(right.view().x).toBeCloseTo(310 - 155 / 1.1, 6);
    expect(left.view().x).toBeCloseTo(155 / 1.1, 6);
    expect(inside(right.view(), NEON)).toBe(true);
    // Up and down the picture has rows to spare: it looks at the height of what was hit.
    expect(right.view().y).toBeCloseTo(ENEMY.y, 6);
  });

  test('a push that is to come starts when its moment does: a blow is pushed in on as it lands, not as it is fired', () => {
    const camera = new Camera(NEON);
    camera.push(ENEMY, 0.1, 200);
    camera.update(199);
    expect(camera.view()).toBe(HOME);
    expect(camera.busy).toBe(true);
    camera.update(1 + PUSH_IN_MS);
    expect(camera.view().zoom).toBeCloseTo(1.1, 6);
  });

  test('of two pushes at once the stronger has the picture, and no push is closer than the closest there is', () => {
    const camera = new Camera(NEON);
    camera.push(OWN, 0.05);
    camera.push(ENEMY, 0.12);
    camera.update(PUSH_IN_MS);
    expect(camera.view().zoom).toBeCloseTo(1.12, 6);
    expect(camera.view().x).toBeGreaterThan(HOME.x);
    const far = new Camera(NEON);
    far.push(ENEMY, 5);
    far.update(PUSH_IN_MS);
    expect(far.view().zoom).toBeCloseTo(1 + MAX_PUSH, 6);
    // A push by nothing, or by less than nothing, is no push.
    const none = new Camera(NEON);
    none.push(ENEMY, 0);
    none.push(ENEMY, -1);
    none.push(ENEMY, Number.NaN);
    expect(none.busy).toBe(false);
  });

  test('never shows anything from outside the picture, whatever it is pushed towards and whenever it is asked, in every place', () => {
    let seed = 5;
    const next = (): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (const [id, place] of ALL_PLACES) {
      const camera = new Camera(place);
      for (let i = 0; i < 300; i++) {
        if (next() < 0.2) camera.push({ x: next() * 400 - 40, y: next() * 300 - 60 }, next() * 0.3, next() * 200);
        camera.update(16);
        const view = camera.view();
        expect(inside(view, place), `${id} ${JSON.stringify(view)}`).toBe(true);
        expect(view.zoom, id).toBeGreaterThanOrEqual(1);
        expect(view.zoom, id).toBeLessThanOrEqual(1 + MAX_PUSH + 1e-9);
      }
    }
  });

  test('it comes in and goes out smoothly: from one frame to the next the picture never jumps', () => {
    const camera = new Camera(NEON);
    camera.push(ENEMY, MAX_PUSH);
    let last = camera.view();
    for (let ms = 0; ms < PUSH_MS + 32; ms += 16) {
      camera.update(16);
      const view = camera.view();
      expect(Math.abs(view.zoom - last.zoom)).toBeLessThan(0.06);
      expect(Math.abs(view.x - last.x)).toBeLessThan(8);
      last = view;
    }
    expect(last).toBe(HOME);
  });

  test('while a battle opens it is where the opening has it, whatever pushes there are; settled, it forgets them', () => {
    const camera = new Camera(NEON);
    camera.push(ENEMY, 0.1);
    camera.update(PUSH_IN_MS);
    expect(camera.view(0)).toEqual(openingView(0, NEON));
    expect(camera.view(0.35)).toEqual(openingView(0.35, NEON));
    expect(camera.view(1)).toEqual(HOME);
    expect(camera.view().zoom).toBeGreaterThan(1);
    camera.settle();
    expect(camera.view()).toBe(HOME);
    expect(camera.busy).toBe(false);
  });

  test('one that does not move stands at home always: no travel as a battle opens, no push', () => {
    const still = new Camera(NEON, false);
    still.push(ENEMY, 0.1);
    still.update(PUSH_IN_MS);
    expect(still.view()).toBe(HOME);
    expect(still.view(0)).toBe(HOME);
    expect(still.view(0.3)).toBe(HOME);
    expect(still.busy).toBe(false);
  });
});
