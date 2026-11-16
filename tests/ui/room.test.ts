import { completeMission } from '../../src/core/campaign';
import { MISSIONS } from '../../src/content/missions';
import { SCENES } from '../../src/content/scenes';
import { AMBIENCE } from '../../src/ui/ambience';
import { MECH_FEET, SPARK_MS, SPILL, WELD, drawMechShadow, drawRoom, drawRoomSpill, weldSparks, welding } from '../../src/ui/room';
import { fresh, inHub, press, select, snap } from '../helpers/app';
import { record, type Drawn, type Glowed } from '../helpers/canvas';

/** A room with a mech standing in it: the room's lights behind the mech, a shadow at its feet, light spilling over it; a welder in the hangar. */

const isLight = (g: Glowed): boolean => g.blend === 'lighter';
const isVignette = (g: Glowed): boolean => g.blend === 'source-over' && g.stops[0][1] === 'rgba(4, 4, 14, 0)';
const isShadow = (g: Glowed): boolean => g.blend === 'source-over' && /^rgba\(0, 0, 8, /.test(g.stops[0][1]);
const strength = (g: Glowed): number => Number(/, ([\d.]+)\)$/.exec(g.stops[0][1])![1]);
const welder = (page: Drawn): Glowed[] => page.glows.filter((g) => isLight(g) && g.x === WELD.x && g.y === WELD.y);
const SPARKS = ['#ffffff', '#ffe08a', '#ff9a3c'];
const sparks = (page: Drawn) => page.rects.filter((r) => SPARKS.includes(r.color));
/** A moment in the middle of the welder's first spell, and one well after it. */
const WELDING = 1800 + 600;
const QUIET = 1800 + WELD.lasts + SPARK_MS + 200;

describe('the welder up on the hangar\'s walkway', () => {
  test('works for a while, stops for longer, and starts a little after the room is come into', () => {
    expect(welding(0)).toBeNull();
    expect(welding(1799)).toBeNull();
    expect(welding(1800)).toBe(0);
    expect(welding(1800 + WELD.lasts / 2)).toBeCloseTo(0.5, 5);
    expect(welding(1800 + WELD.lasts - 1)).toBeLessThan(1);
    expect(welding(1800 + WELD.lasts)).toBeNull();
    expect(welding(1800 + WELD.every - 1)).toBeNull();
    expect(welding(1800 + WELD.every)).toBe(0);
    expect(WELD.lasts).toBeLessThan(WELD.every / 2);
  });

  test('sparks fly only while there is welding, and for a moment after', () => {
    expect(weldSparks(0)).toEqual([]);
    expect(weldSparks(QUIET)).toEqual([]);
    expect(weldSparks(WELDING).length).toBeGreaterThan(0);
    let most = 0;
    for (let t = 0; t < WELD.every * 3; t += 16) {
      const now = weldSparks(t);
      most = Math.max(most, now.length);
      expect(now.length).toBeLessThanOrEqual(WELD.sparks);
      if (now.length > 0) {
        const at = (t + WELD.every - 1800) % WELD.every;
        expect(at).toBeLessThan(WELD.lasts + SPARK_MS);
      }
    }
    expect(most).toBeGreaterThanOrEqual(3);
  });

  test('each spark leaves the weld white, goes up and a little sideways, falls, and cools to orange', () => {
    // The first spark of the first spell, followed through its life.
    const life = Array.from({ length: Math.floor(SPARK_MS / 10) }, (_, i) => weldSparks(1800 + i * 10)[0]);
    expect(life.every(Boolean)).toBe(true);
    expect(life[0]).toMatchObject({ x: WELD.x, y: WELD.y, color: '#ffffff', long: true });
    const highest = Math.min(...life.map((s) => s.y));
    expect(highest).toBeLessThan(WELD.y);
    expect(life.at(-1)!.y).toBeGreaterThan(WELD.y);
    expect(life.at(-1)).toMatchObject({ color: '#ff9a3c', long: false });
    expect(life.map((s) => s.color).filter((c, i, all) => c !== all[i - 1])).toEqual(SPARKS);
    // It never jumps: a pixel or two a step at most.
    for (let i = 1; i < life.length; i++) {
      expect(Math.abs(life[i].x - life[i - 1].x)).toBeLessThanOrEqual(1);
      expect(Math.abs(life[i].y - life[i - 1].y)).toBeLessThanOrEqual(2);
    }
    // Two spells do not throw their sparks the same way.
    const way = (spell: number) => weldSparks(1800 + spell * WELD.every + 300).map((s) => `${s.x},${s.y}`).join(' ');
    expect(way(0)).not.toBe(way(1));
  });
});

describe('a room, as it is drawn round a mech', () => {
  test('behind the mech: darker edges, the room\'s own lights, and in the hangar the welder with his sparks', () => {
    const page = record((ctx) => drawRoom(ctx, 'bg-garage', WELDING));
    expect(page.glows.filter(isVignette)).toHaveLength(1);
    const place = AMBIENCE['bg-garage'].lights;
    const lights = page.glows.filter(isLight);
    expect(lights).toHaveLength(place.length + 1);
    expect(lights.slice(0, place.length).map((g) => [g.x, g.y])).toEqual(place.map((l) => [l.x, l.y]));
    expect(welder(page)).toHaveLength(1);
    expect(welder(page)[0].r).toBe(20);
    expect(sparks(page).length).toBe(weldSparks(WELDING).length);
    for (const s of sparks(page)) {
      expect(s.w).toBe(1);
      expect([1, 2]).toContain(s.h);
    }
    // Nothing else solid is laid over the picture.
    expect(page.rects).toHaveLength(sparks(page).length);
  });

  test('between spells there is no welder\'s light and nothing in the air', () => {
    const page = record((ctx) => drawRoom(ctx, 'bg-garage', QUIET));
    expect(welder(page)).toEqual([]);
    expect(page.rects).toEqual([]);
    expect(page.glows.filter(isLight)).toHaveLength(AMBIENCE['bg-garage'].lights.length);
  });

  test('the welder\'s light flickers; in a calm picture it holds steady at half strength, and the sparks stay', () => {
    const levels = Array.from({ length: 30 }, (_, i) => strength(welder(record((ctx) => drawRoom(ctx, 'bg-garage', 1800 + 100 + i * 33)))[0]));
    expect(Math.max(...levels) - Math.min(...levels)).toBeGreaterThan(0.1);
    expect(Math.max(...levels)).toBeLessThanOrEqual(0.6 + 1e-9);
    expect(Math.min(...levels)).toBeGreaterThan(0.3);
    const calm = Array.from({ length: 30 }, (_, i) => strength(welder(record((ctx) => drawRoom(ctx, 'bg-garage', 1800 + 100 + i * 33, true)))[0]));
    expect(new Set(calm).size).toBe(1);
    expect(calm[0]).toBeCloseTo(0.6 * 0.7 * 0.5, 3);
    expect(sparks(record((ctx) => drawRoom(ctx, 'bg-garage', WELDING, true))).length).toBe(weldSparks(WELDING).length);
  });

  test('a hurried game has nobody welding, and no other room has a welder at all', () => {
    for (let t = 0; t < WELD.every * 2; t += 100) {
      const still = record((ctx) => drawRoom(ctx, 'bg-garage', t, false, true));
      expect(welder(still)).toEqual([]);
      expect(still.rects).toEqual([]);
      for (const room of ['bg-vault', 'bg-arena', 'bg-simulator']) {
        const page = record((ctx) => drawRoom(ctx, room, t));
        expect(page.rects, room).toEqual([]);
        expect(page.glows.filter(isLight).length, room).toBe(AMBIENCE[room].lights.length);
      }
    }
  });

  test('the mech\'s shadow lies flat at its feet', () => {
    expect(MECH_FEET).toEqual({ x: 76, y: 155 });
    const page = record((ctx) => drawMechShadow(ctx, -8, 78));
    expect(page.glows).toHaveLength(1);
    expect(isShadow(page.glows[0])).toBe(true);
    expect(page.glows[0]).toMatchObject({ x: 68, y: 233 });
    expect(page.glows[0].r).toBe(54);
    expect(page.glows[0].ry).toBeLessThan(page.glows[0].r / 4);
  });

  test('over the mech: the room\'s lights once more, at four tenths of their strength, and the last of its haze', () => {
    expect(SPILL).toBe(0.4);
    const behind = record((ctx) => drawRoom(ctx, 'bg-vault', 900)).glows.filter(isLight);
    const page = record((ctx) => drawRoomSpill(ctx, 'bg-vault', 900));
    const over = page.glows.filter(isLight);
    expect(over).toHaveLength(behind.length);
    over.forEach((glow, i) => {
      expect([glow.x, glow.y, glow.r]).toEqual([behind[i].x, behind[i].y, behind[i].r]);
      expect(strength(glow)).toBeCloseTo(strength(behind[i]) * SPILL, 2);
    });
    // The vault has a haze; the hangar has none.
    expect(page.glows.filter((g) => !isLight(g)).length).toBe(3);
    expect(record((ctx) => drawRoomSpill(ctx, 'bg-garage', 900)).glows.filter((g) => !isLight(g))).toEqual([]);
    // A calm picture has the spill at half of that.
    const calm = record((ctx) => drawRoomSpill(ctx, 'bg-garage', 900, true)).glows.filter(isLight);
    const plain = record((ctx) => drawRoomSpill(ctx, 'bg-garage', 900)).glows.filter(isLight);
    expect(calm.length).toBe(plain.length);
    expect(strength(calm[2])).toBeLessThan(strength(plain[2]) * 0.6);
  });
});

describe('the rooms of the game', () => {
  /** What was drawn, in order: the room's picture, soft lights, the shadow, the mech's own pictures. */
  const order = (page: Drawn, room: string) => {
    const picture = page.images.findIndex((i) => (i.image as { id?: string }).id === room);
    return { picture, shadow: page.glows.findIndex(isShadow), lights: page.glows.filter(isLight).length, vignette: page.glows.findIndex(isVignette) };
  };
  const named = { sprites: { get: (id: string, fallback: { w: number; h: number }) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) } };
  /** A pilot past the introductions who has read every page of story there is: nothing stands between the title and the hub. */
  const past = () => ({ ...['intro-1', 'intro-2'].reduce((g, id) => completeMission(g, id, MISSIONS), fresh()), scenes: SCENES.map((s) => s.id) });

  test('the hub: the hangar\'s lights behind the mech and again over it, and a shadow under its feet', () => {
    const { app } = inHub(past(), undefined, { ...named, fast: false });
    app.update(WELDING);
    const page = record((ctx) => app.draw(ctx));
    const seen = order(page, 'bg-garage');
    expect(seen.picture).toBe(0);
    expect(seen.vignette).toBe(0);
    expect(seen.shadow).toBeGreaterThan(0);
    // Six behind, the welder's, and six over the mech.
    expect(seen.lights).toBe(13);
    expect(page.glows.filter(isShadow)).toHaveLength(1);
    expect(page.glows.find(isShadow)).toMatchObject({ x: -8 + MECH_FEET.x, y: 78 + MECH_FEET.y });
    expect(sparks(page).length).toBeGreaterThan(0);
    // The shadow is laid before the lights that spill over the mech.
    const spill = page.glows.filter(isLight).slice(7);
    expect(page.glows.indexOf(spill[0])).toBeGreaterThan(seen.shadow);
  });

  test('a hurried hub stands still: the lights where they are at the start, nobody welding', () => {
    const { app } = inHub(past(), undefined, named);
    const first = record((ctx) => app.draw(ctx));
    app.update(WELDING);
    const later = record((ctx) => app.draw(ctx));
    expect(later.glows).toEqual(first.glows);
    expect(sparks(later)).toEqual([]);
    expect(first.glows.filter(isLight)).toHaveLength(12);
    expect(first.glows.filter(isShadow)).toHaveLength(1);
  });

  test('a calm hub has its lights at half strength', () => {
    const lit = (calm: boolean) => {
      const { app } = inHub({ ...past(), settings: { ...past().settings, calm } }, undefined, { ...named, fast: false });
      app.update(700);
      return record((ctx) => app.draw(ctx)).glows.filter(isLight).map(strength);
    };
    const plain = lit(false);
    const calm = lit(true);
    expect(calm).toHaveLength(plain.length);
    calm.forEach((level, i) => expect(level).toBeLessThan(plain[i] * 0.62));
  });

  test('the garage, the vault, the arena and the simulator: each has its lights and a shadow under the mech in it', () => {
    const rooms: [string, string, number][] = [['garage', 'bg-garage', 12], ['gauntlet', 'bg-vault', 12], ['arena', 'bg-arena', 10], ['training', 'bg-simulator', 10]];
    for (const [entry, room, lights] of rooms) {
      const { app } = inHub(past(), undefined, named);
      select(app, entry);
      expect(snap(app).screen, entry).toBe(entry);
      const page = record((ctx) => app.draw(ctx));
      const seen = order(page, room);
      expect(seen.picture, entry).toBe(0);
      expect(seen.lights, entry).toBe(lights);
      // The vault's frame is only there once a run is on: no mech, no shadow.
      expect(page.glows.filter(isShadow), entry).toHaveLength(entry === 'gauntlet' ? 0 : 1);
      press(app, 'cancel');
    }
  });
});
