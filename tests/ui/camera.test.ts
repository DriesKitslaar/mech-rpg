import {
  Camera, HOME, MAX_PUSH, MIDDLE, PUSH_HOLD_MS, PUSH_IN_MS, PUSH_MS, PUSH_OUT_MS, TRAVEL_SHARE, applyView, atHome, inField, openingView, pushLevel, seenBy, type View,
} from '../../src/ui/camera';
import { FIELD, FIELD_Y, PANEL_Y, PLACES, PLAIN, pictureTop, placeFor, type Place } from '../../src/ui/stage';
import { record } from '../helpers/canvas';

/**
 * The camera a battle is looked at through: at home whenever nothing moves, coming down from the
 * top of the place's picture as a battle opens, pushing in towards a blow as it lands. On its way
 * down it shows nothing from outside the picture; pushed in, nothing from outside the field as it stands.
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
/** True when a view shows only what the field shows as it stands at home, give or take the smallest part of a pixel. */
function onField(view: View): boolean {
  const seen = seenBy(view);
  const slack = 1e-6;
  return seen.left >= -slack && seen.left + seen.width <= FIELD.width + slack && seen.top >= FIELD_Y - slack && seen.top + seen.height <= PANEL_Y + slack;
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

describe('a view that shows nothing from outside the field as it stands', () => {
  test('is left as it is when it already does, and moved only as far as it must be when it does not', () => {
    expect(inField(HOME)).toEqual(HOME);
    // Twice as close there is room to look a quarter of the field to either side, and a quarter of it up and down, and no further.
    expect(inField({ x: 0, y: HOME.y, zoom: 2 })).toEqual({ x: 77.5, y: HOME.y, zoom: 2 });
    expect(inField({ x: 400, y: HOME.y, zoom: 2 })).toEqual({ x: 232.5, y: HOME.y, zoom: 2 });
    expect(inField({ x: 100, y: HOME.y, zoom: 2 })).toEqual({ x: 100, y: HOME.y, zoom: 2 });
    expect(inField({ x: HOME.x, y: -500, zoom: 2 })).toEqual({ x: HOME.x, y: FIELD_Y + 41, zoom: 2 });
    expect(inField({ x: HOME.x, y: 900, zoom: 2 })).toEqual({ x: HOME.x, y: PANEL_Y - 41, zoom: 2 });
    expect(inField({ x: HOME.x, y: 70, zoom: 2 })).toEqual({ x: HOME.x, y: 70, zoom: 2 });
    // At its own size the field is all there is: there is no looking sideways, up or down at all.
    expect(inField({ x: 100, y: 30, zoom: 1 })).toEqual(HOME);
    // Further away than its own size it cannot be looked at: the field would show its edges.
    expect(inField({ x: HOME.x, y: HOME.y, zoom: 0.5 })).toEqual(HOME);
  });

  test('whatever is asked for', () => {
    let seed = 11;
    const next = (): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let i = 0; i < 2000; i++) {
      const asked = { x: next() * 500 - 100, y: next() * 500 - 200, zoom: 0.5 + next() * 3 };
      const view = inField(asked);
      expect(onField(view), JSON.stringify(asked)).toBe(true);
      // And what is on the field is in the picture, in every place: the field is a band of it.
      for (const [id, place] of ALL_PLACES) expect(inside(view, place), id).toBe(true);
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
    camera.push(ENEMY, 0.1);
    // The moment it is asked for nothing has moved yet.
    expect(camera.view()).toBe(HOME);
    camera.update(PUSH_IN_MS);
    expect(camera.view().zoom).toBeCloseTo(1.1, 6);
    camera.update(PUSH_HOLD_MS + PUSH_OUT_MS);
    expect(camera.view()).toBe(HOME);
    // And it stays there: a push is over when it is over.
    for (let ms = 0; ms < PUSH_MS; ms += 16) {
      camera.update(16);
      expect(camera.view()).toBe(HOME);
    }
  });

  test('pushes in towards what was hit: to the right for an enemy, to the left for the pilot\'s mech, as far as the field lets it turn', () => {
    const right = new Camera(NEON);
    right.push(ENEMY, 0.1);
    right.update(PUSH_IN_MS);
    const left = new Camera(NEON);
    left.push(OWN, 0.1);
    left.update(PUSH_IN_MS);
    expect(right.view().x).toBeGreaterThan(HOME.x + 5);
    expect(left.view().x).toBeLessThan(HOME.x - 5);
    // A tenth closer there are fourteen pixels of field to turn into on either side: it turns that far and no further.
    expect(right.view().x).toBeCloseTo(310 - 155 / 1.1, 6);
    expect(left.view().x).toBeCloseTo(155 / 1.1, 6);
    expect(onField(right.view())).toBe(true);
    // Up and down there are seven and a half: what was hit is fourteen under the middle, and it turns down as far as there is field.
    expect(right.view().y).toBeCloseTo(PANEL_Y - 82 / 1.1, 6);
    expect(right.view().y - HOME.y).toBeCloseTo(82 - 82 / 1.1, 6);
    // Something less far from the middle than that is looked straight at; something high up, as far up as there is field.
    const near = new Camera(NEON);
    near.push({ x: 160, y: 100 }, 0.1);
    near.update(PUSH_IN_MS);
    expect([near.view().x, near.view().y].map((n) => Math.round(n * 1e6) / 1e6)).toEqual([160, 100]);
    const high = new Camera(NEON);
    high.push({ x: 155, y: 20 }, 0.1);
    high.update(PUSH_IN_MS);
    expect(high.view().y).toBeCloseTo(FIELD_Y + 82 / 1.1, 6);
    // In every place alike: the rows a picture has to spare over and under the field are not looked at.
    for (const [id, place] of ALL_PLACES) {
      const camera = new Camera(place);
      camera.push({ x: 60, y: 170 }, MAX_PUSH);
      camera.update(PUSH_IN_MS);
      expect(camera.view().y, id).toBeCloseTo(PANEL_Y - 82 / (1 + MAX_PUSH), 6);
    }
  });

  test('what it pushes in on is where the blow landed, whatever becomes of the point it was told with', () => {
    const camera = new Camera(NEON);
    const at = { ...ENEMY };
    camera.push(at, 0.1);
    // The one who asked goes on to use its point for something else.
    at.x = 0;
    at.y = 300;
    camera.update(PUSH_IN_MS);
    expect(camera.view().x).toBeGreaterThan(HOME.x + 5);
    expect(camera.view().y).toBeGreaterThan(HOME.y + 5);
    expect(camera.view().y).toBeLessThan(ENEMY.y);
  });

  test('a push that is to come starts when its moment does: a blow is pushed in on as it lands, not as it is fired', () => {
    const camera = new Camera(NEON);
    camera.push(ENEMY, 0.1, 200);
    camera.update(199);
    expect(camera.view()).toBe(HOME);
    camera.update(1 + PUSH_IN_MS);
    expect(camera.view().zoom).toBeCloseTo(1.1, 6);
  });

  test('of two pushes at once the closer says how close the camera is, and each has its say in where it looks by how far in it is', () => {
    // The stronger was asked for first here and the weaker last: it is not the last that wins.
    for (const order of [[0.12, 0.05], [0.05, 0.12]]) {
      const camera = new Camera(NEON);
      for (const amount of order) camera.push(amount === 0.12 ? ENEMY : OWN, amount);
      camera.update(PUSH_IN_MS);
      const view = camera.view();
      expect(view.zoom).toBeCloseTo(1.12, 6);
      // Each by itself would look as far to its own side as there is field: together they look between, nearer the stronger's.
      const [right, left] = [310 - 155 / 1.12, 155 / 1.12];
      expect(view.x).toBeCloseTo((right * 0.12 + left * 0.05) / 0.17, 6);
      expect(view.x).toBeGreaterThan(HOME.x);
      expect(view.x).toBeLessThan(right - 5);
      expect(onField(view)).toBe(true);
    }
    // Two that push in on the same thing look at it as one would.
    const same = new Camera(NEON);
    same.push(ENEMY, 0.05);
    same.push(ENEMY, 0.12);
    same.update(PUSH_IN_MS);
    const one = new Camera(NEON);
    one.push(ENEMY, 0.12);
    one.update(PUSH_IN_MS);
    expect(same.view().zoom).toBeCloseTo(one.view().zoom, 9);
    expect(same.view().x).toBeCloseTo(one.view().x, 9);
    expect(same.view().y).toBeCloseTo(one.view().y, 9);
  });

  test('a push that begins while another goes on takes the picture over by degrees: it never jumps from the one to the other', () => {
    // A hit on a machine to the right, high up, and then something on the pilot's own side, lower down (an Overdrive set
    // off, a hit taken): at every moment the second can begin, with either the stronger. The first four pairs are
    // strengths a battle uses; the last is the closest a camera can be pushed at all, twice.
    for (const [first, second, across, down] of [[0.06, 0.08, 8, 4.5], [0.12, 0.06, 8, 4.5], [0.09, 0.12, 8, 4.5], [0.12, 0.12, 8, 4.5], [0.15, 0.15, 10, 5.5]]) {
      for (let begin = 0; begin <= PUSH_MS; begin += 16) {
        const camera = new Camera(NEON);
        camera.push({ x: 300, y: 20 }, first);
        let last = camera.view();
        let alone = 0;
        for (let ms = 0; ms < begin + PUSH_MS + 32; ms += 16) {
          if (ms === begin) camera.push({ x: 10, y: 170 }, second);
          camera.update(16);
          const view = camera.view();
          const what = `${first} then ${second} at ${begin}, ${ms} in`;
          expect(Math.abs(view.zoom - last.zoom), what).toBeLessThan(0.06);
          expect(Math.abs(view.x - last.x), what).toBeLessThan(across);
          expect(Math.abs(view.y - last.y), what).toBeLessThan(down);
          expect(onField(view), what).toBe(true);
          // Once the first is over the second has the picture to itself: the camera looks to the pilot's side, and down.
          if (ms + 16 >= PUSH_MS && ms + 16 > begin && ms + 16 < begin + PUSH_MS) {
            alone++;
            expect(view.x, what).toBeLessThan(HOME.x);
            expect(view.y, what).toBeGreaterThan(HOME.y);
          }
          last = view;
        }
        expect(last, `${first} then ${second} at ${begin}`).toBe(HOME);
        expect(alone, `${first} then ${second} at ${begin}`).toBe(begin / 16);
      }
    }
  });

  test('a push by itself is never further from the frame before it than that either, wherever it is aimed', () => {
    for (const focus of [{ x: 0, y: FIELD_Y }, { x: 310, y: PANEL_Y }, { x: 58, y: 150 }, { x: 240, y: 60 }, { x: -500, y: 900 }]) {
      const camera = new Camera(NEON);
      camera.push(focus, MAX_PUSH);
      let last = camera.view();
      for (let ms = 0; ms < PUSH_MS + 32; ms += 16) {
        camera.update(16);
        const view = camera.view();
        expect(Math.abs(view.x - last.x), JSON.stringify(focus)).toBeLessThan(8);
        expect(Math.abs(view.y - last.y), JSON.stringify(focus)).toBeLessThan(4.5);
        last = view;
      }
    }
  });

  test('no push is closer than the closest there is, and a push by nothing is no push', () => {
    const far = new Camera(NEON);
    far.push(ENEMY, 5);
    far.update(PUSH_IN_MS);
    expect(far.view().zoom).toBeCloseTo(1 + MAX_PUSH, 6);
    // A push by nothing, or by less than nothing, is no push.
    const none = new Camera(NEON);
    none.push(ENEMY, 0);
    none.push(ENEMY, -1);
    none.push(ENEMY, Number.NaN);
    for (let ms = 0; ms < PUSH_MS; ms += 16) {
      none.update(16);
      expect(none.view()).toBe(HOME);
    }
  });

  test('pushed in, it never shows anything from outside the field as it stands, whatever it is pushed towards and whenever it is asked, in every place', () => {
    let seed = 5;
    const next = (): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (const [id, place] of ALL_PLACES) {
      const camera = new Camera(place);
      let last = camera.view();
      for (let i = 0; i < 300; i++) {
        if (next() < 0.2) camera.push({ x: next() * 400 - 40, y: next() * 300 - 60 }, next() * 0.3, next() * 200);
        camera.update(16);
        const view = camera.view();
        expect(onField(view), `${id} ${JSON.stringify(view)}`).toBe(true);
        expect(inside(view, place), `${id} ${JSON.stringify(view)}`).toBe(true);
        expect(view.zoom, id).toBeGreaterThanOrEqual(1);
        expect(view.zoom, id).toBeLessThanOrEqual(1 + MAX_PUSH + 1e-9);
        // However many pushes come over each other, as hard as a push can be and from wherever: no frame is far from the one before it.
        expect(Math.abs(view.x - last.x), `${id} frame ${i}`).toBeLessThan(12);
        expect(Math.abs(view.y - last.y), `${id} frame ${i}`).toBeLessThan(6.5);
        last = view;
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
      // Up and down it has the whole picture to turn in: it turns there by degrees too, as far as it has pushed in.
      expect(Math.abs(view.y - last.y)).toBeLessThan(6);
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
    // Settled, it forgets the one that is going on and the one that is still to come: for good.
    camera.push(OWN, 0.12, 100);
    camera.settle();
    expect(camera.view()).toBe(HOME);
    for (let ms = 0; ms < 100 + PUSH_MS; ms += 16) {
      camera.update(16);
      expect(camera.view()).toBe(HOME);
    }
    // And it can be pushed again after.
    camera.push(ENEMY, 0.1);
    camera.update(PUSH_IN_MS);
    expect(camera.view().zoom).toBeCloseTo(1.1, 6);
  });

  test('one that does not move stands at home always: no travel as a battle opens, no push', () => {
    const still = new Camera(NEON, false);
    still.push(ENEMY, 0.1);
    still.update(PUSH_IN_MS);
    expect(still.view()).toBe(HOME);
    expect(still.view(0)).toBe(HOME);
    expect(still.view(0.3)).toBe(HOME);
    for (let ms = 0; ms < PUSH_MS; ms += 16) {
      still.update(16);
      expect(still.view()).toBe(HOME);
    }
  });
});
