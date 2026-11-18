import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import SPRITES from '../../src/content/sprites.json';
import { LOGICAL_W } from '../../src/ui/display';
import { BACK_BOX, VIEWS } from '../../src/ui/mechLayout';
import {
  BARS_H, ENEMY_LEFT, ENEMY_RIGHT, ENEMY_TOP, FAR_LINE, FIELD, FIELD_Y, FLYERS, FLY_LIFT, HERO, HERO_FEET, HERO_GROUND, LOWEST_ROW, NEAR_LINE, PANEL_Y, PLACES, PLAIN,
  SMALL_GROUND, SMALL_MIDDLE, depthOf, duelAt, enemySpots, farLine, farToNear, horizonOf, pictureTop, placeBars, placeFor, standAt, type Place,
} from '../../src/ui/stage';

/**
 * Where everything stands in a battle that is looked at over the shoulder: the pilot's mech near
 * and to the left, what it fights further off and to the right, on the floor of the place.
 */

interface Entry { w: number; h: number; ox?: number; oy?: number; gx?: number; gy?: number }
const MANIFEST = SPRITES as Record<string, Entry>;
const BACKGROUNDS = Object.keys(MANIFEST).filter((id) => id.startsWith('bg-'));
const ALL_PLACES = [...BACKGROUNDS.map(placeFor), PLAIN];
/** Every picture a machine on the field can be. */
const MACHINES = Object.keys(MANIFEST).filter((id) => id.startsWith('enemy-') || id.startsWith('boss-'));
/** Room under a machine for its two bars. */
const BARS = 7;

describe('a place, looked at over the shoulder', () => {
  test('every picture a battle can be fought in front of is known, and one that is not is taken to be like most', () => {
    expect(BACKGROUNDS).toHaveLength(13);
    for (const id of BACKGROUNDS) expect(Object.hasOwn(PLACES, id), id).toBe(true);
    expect(placeFor('bg-nowhere')).toBe(PLAIN);
    expect(placeFor('toString')).toBe(PLAIN);
  });

  test('the band of the picture that is shown lies inside the picture: no edge of it shows', () => {
    for (const place of ALL_PLACES) {
      expect(place.row).toBeGreaterThanOrEqual(0);
      expect(place.row).toBeLessThanOrEqual(LOWEST_ROW);
      expect(pictureTop(place)).toBeLessThanOrEqual(FIELD_Y);
      expect(pictureTop(place) + 270).toBeGreaterThanOrEqual(PANEL_Y);
    }
    expect(LOWEST_ROW).toBe(270 - FIELD.height);
  });

  test('the floor begins about half way down the field, and there is floor to stand on under it', () => {
    for (const [id, place] of [...Object.entries(PLACES), ['plain', PLAIN] as const]) {
      const horizon = horizonOf(place);
      expect(horizon, id).toBeGreaterThanOrEqual(FIELD_Y + FIELD.height * 0.5);
      expect(horizon, id).toBeLessThanOrEqual(PANEL_Y - 40);
      // Unless the picture's floor is too low to be brought there, it begins at one height everywhere.
      if (place.row < LOWEST_ROW) expect(horizon, id).toBe(FIELD_Y + 90);
    }
  });

  test('the field is the screen between the message bar and the panel', () => {
    expect(FIELD).toEqual({ top: 14, height: 164, width: LOGICAL_W });
    expect(FIELD.top + FIELD.height).toBe(PANEL_Y);
  });
});

describe('where the pilot\'s mech stands', () => {
  test('near, in the lower left: its feet a pixel over the panel, its box on the field', () => {
    expect(HERO_FEET).toBe(PANEL_Y - 1);
    expect(HERO.y + HERO_GROUND).toBe(HERO_FEET);
    expect(HERO.x).toBeGreaterThanOrEqual(0);
    expect(HERO.x + BACK_BOX).toBeLessThanOrEqual(LOGICAL_W / 2);
    expect(HERO.y).toBeGreaterThan(FIELD_Y);
  });

  test('no pair of legs it can stand on reaches under the panel, and all of them reach close to it', () => {
    const legs = Object.keys(MANIFEST).filter((id) => id.startsWith('legs-') && id.endsWith('.back'));
    expect(legs).toHaveLength(11);
    for (const id of legs) {
      const bottom = HERO.y + MANIFEST[id].oy! + MANIFEST[id].h;
      expect(bottom, id).toBeLessThanOrEqual(PANEL_Y);
      // A hover unit hangs over the floor; everything else stands within a few pixels of it.
      expect(bottom, id).toBeGreaterThanOrEqual(PANEL_Y - (id === 'legs-glide.back' ? 18 : 12));
    }
  });

  test('whatever it carries stays on the field, clear of the Overdrive\'s meter on the left and of the enemies on the right', () => {
    const carried = Object.keys(MANIFEST).filter((id) => /^(wpn|shd)-/.test(id) && id.endsWith('.back'));
    expect(carried.length).toBeGreaterThan(30);
    const { nearFist, farFist, mount } = VIEWS.back;
    for (const id of carried) {
      const { w, gx, gy } = MANIFEST[id];
      // In the far fist it reaches furthest left, in the near fist furthest right, on the mount highest.
      expect(HERO.x + farFist.x - gx!, id).toBeGreaterThanOrEqual(7);
      expect(HERO.x + nearFist.x - gx! + w, id).toBeLessThanOrEqual(ENEMY_LEFT);
      expect(HERO.y + mount.y - gy!, id).toBeGreaterThanOrEqual(FIELD_Y + 12);
    }
  });
});

describe('where enemies stand', () => {
  test('on the floor, right of the pilot\'s mech, between the farthest line and the nearest, in every place', () => {
    for (const place of ALL_PLACES) {
      const far = farLine(place);
      expect(far).toBeGreaterThanOrEqual(FAR_LINE);
      expect(far).toBeGreaterThanOrEqual(horizonOf(place) + 12);
      expect(far).toBeLessThan(NEAR_LINE - 10);
      for (const count of [1, 2, 3]) {
        const spots = enemySpots(count, place);
        expect(spots).toHaveLength(count);
        for (const spot of spots) {
          expect(spot.x).toBeGreaterThan(ENEMY_LEFT + 30);
          expect(spot.x).toBeLessThan(ENEMY_RIGHT - 20);
          expect(spot.y).toBeGreaterThanOrEqual(far);
          expect(spot.y).toBeLessThanOrEqual(NEAR_LINE);
          expect(Number.isInteger(spot.y)).toBe(true);
          // Nearer the pilot's mech than the pilot's mech itself, nobody stands.
          expect(spot.y).toBeLessThan(HERO_FEET - 10);
        }
      }
    }
  });

  test('one stands alone; two stand one behind the other; of three, two stand at the back and one in front between them', () => {
    const place = placeFor('bg-neon-district');
    // One alone stands between the two lines, nearer the near one, and right of the middle of the enemies' side.
    const [alone] = enemySpots(1, place);
    expect(alone.y).toBeGreaterThan(farLine(place) + (NEAR_LINE - farLine(place)) * 0.4);
    expect(alone.y).toBeLessThan(NEAR_LINE - (NEAR_LINE - farLine(place)) * 0.2);
    expect(alone.x).toBeGreaterThan((ENEMY_LEFT + ENEMY_RIGHT) / 2);
    expect(Object.keys(alone).sort()).toEqual(['x', 'y']);
    const [back, front] = enemySpots(2, place);
    expect(back.y).toBeLessThan(front.y);
    expect(back.x).toBeLessThan(front.x);
    const [left, right, middle] = enemySpots(3, place);
    expect(left.y).toBeLessThan(middle.y);
    expect(right.y).toBeLessThan(middle.y);
    expect(left.x).toBeLessThan(middle.x);
    expect(middle.x).toBeLessThan(right.x);
    // The farthest stands on the farthest line there is, the nearest on the nearest.
    expect(left.y).toBe(farLine(place));
    expect(middle.y).toBe(NEAR_LINE);
    // A number of places nobody planned for is laid out as three.
    expect(enemySpots(5, place)).toEqual(enemySpots(3, place));
  });

  test('a place whose floor begins low keeps everybody on it: the lines are closer together there', () => {
    const sluice = placeFor('bg-sluice');
    expect(horizonOf(sluice)).toBeGreaterThan(FAR_LINE);
    expect(farLine(sluice)).toBeGreaterThan(FAR_LINE);
    for (const spot of enemySpots(3, sluice)) expect(spot.y).toBeGreaterThanOrEqual(horizonOf(sluice) + 12);
    expect(farLine(placeFor('bg-arena'))).toBe(FAR_LINE);
    // In every place there is, the floor begins high enough for two lines to stand on that are well apart: the sluice's
    // are the closest together, seventeen pixels.
    for (const place of ALL_PLACES) {
      expect(NEAR_LINE - farLine(place)).toBeGreaterThanOrEqual(17);
      expect(farLine(place)).toBe(Math.max(FAR_LINE, horizonOf(place) + 12));
    }
    expect(NEAR_LINE - farLine(sluice)).toBe(17);
  });

  test('what flies: the four drones, the gunship, the hunter, the longshot and the Overseer, and nothing else', () => {
    expect([...FLYERS].sort()).toEqual([
      'boss-overseer', 'enemy-gunship', 'enemy-hunter-drone', 'enemy-lien-drone', 'enemy-longshot', 'enemy-recon-drone', 'enemy-repair-drone', 'enemy-shield-drone',
    ]);
  });

  test('every machine there is stands on the field wherever it is put: inside the edges, under the message bar, its bars over the panel', () => {
    for (const place of ALL_PLACES) {
      for (const count of [1, 2, 3]) {
        for (const spot of enemySpots(count, place)) {
          for (const id of MACHINES) {
            const size = MANIFEST[id];
            const at = standAt(spot, size, FLYERS.has(id));
            const label = `${id} at ${spot.x},${spot.y}`;
            expect(at.x, label).toBeGreaterThanOrEqual(ENEMY_LEFT);
            expect(at.x + size.w, label).toBeLessThanOrEqual(ENEMY_RIGHT);
            expect(at.y, label).toBeGreaterThanOrEqual(ENEMY_TOP);
            expect(at.y + size.h + BARS, label).toBeLessThanOrEqual(PANEL_Y);
            // The floor under it is where it was put, or as far down as it had to be moved; never over its feet.
            expect(at.ground, label).toBeGreaterThanOrEqual(spot.y);
            expect(at.ground, label).toBeGreaterThanOrEqual(at.y + size.h);
            expect(at.ground, label).toBeLessThan(HERO_FEET);
          }
        }
      }
    }
  });

  test('what stands has its feet on its spot and its middle over it; what flies hangs over it', () => {
    const spot = { x: 240, y: 150 };
    expect(standAt(spot, { w: 64, h: 40 })).toEqual({ x: 208, y: 110, ground: 150 });
    expect(standAt(spot, { w: 64, h: 40 }, true)).toEqual({ x: 208, y: 110 - FLY_LIFT, ground: 150 });
    expect(FLY_LIFT).toBeGreaterThanOrEqual(8);
    // Too wide for where it stands: moved in from the edge. Too tall: moved down, and the floor with it.
    expect(standAt({ x: 290, y: 150 }, { w: 64, h: 40 }).x).toBe(ENEMY_RIGHT - 64);
    expect(standAt({ x: 150, y: 150 }, { w: 64, h: 40 }).x).toBe(ENEMY_LEFT);
    expect(standAt({ x: 240, y: 120 }, { w: 90, h: 128 })).toEqual({ x: 195, y: ENEMY_TOP, ground: ENEMY_TOP + 128 });
    // Wider than the whole of the enemies' side: it keeps to the right edge.
    expect(standAt(spot, { w: 200, h: 40 }).x).toBe(ENEMY_RIGHT - 200);
    for (const id of FLYERS) expect(MACHINES, id).toContain(id);
  });

  test('the farthest are drawn first, and of two on one line the one listed first', () => {
    const a = { name: 'a', ground: 150 };
    const b = { name: 'b', ground: 118 };
    const c = { name: 'c', ground: 150 };
    const d = { name: 'd', ground: 131 };
    expect(farToNear([a, b, c, d]).map((unit) => unit.name)).toEqual(['b', 'd', 'a', 'c']);
    expect(farToNear([c, a]).map((unit) => unit.name)).toEqual(['c', 'a']);
    expect(farToNear([])).toEqual([]);
  });

  test('in every line-up the story has, no machine is hidden by those that stand in front of it', () => {
    const lineUps = new Map<string, string[]>();
    for (const mission of MISSIONS) {
      for (const battle of mission.battles) {
        const sprites = battle.enemies.map((id) => ENEMIES[id].sprite);
        lineUps.set(sprites.join('+'), sprites);
      }
    }
    expect(lineUps.size).toBeGreaterThan(50);
    /** The most of a machine's head (the top third of its box, across its middle half) that the box of another may stand in front of: two fifths. */
    const HEAD_HIDDEN = 0.4;
    let worst = { hidden: 0, head: 0 };
    // In every place there is: the lines the enemies stand on are closer together where the floor is short.
    for (const [where, place] of [...Object.entries(PLACES), ['plain', PLAIN]] as [string, Place][]) {
      for (const [name, sprites] of lineUps) {
        const spots = enemySpots(sprites.length, place);
        const standing = sprites.map((id, slot) => ({ id, slot, ...MANIFEST[id], ...standAt(spots[slot], MANIFEST[id], FLYERS.has(id)) }));
        const order = farToNear(standing);
        order.forEach((unit, i) => {
          // How much of its box is behind the boxes of those drawn after it. A box is more than the machine in it, so this is the most that can be hidden.
          const cells = new Uint8Array(unit.w * unit.h);
          for (const front of order.slice(i + 1)) {
            for (let y = Math.max(unit.y, front.y); y < Math.min(unit.y + unit.h, front.y + front.h); y++) {
              for (let x = Math.max(unit.x, front.x); x < Math.min(unit.x + unit.w, front.x + front.w); x++) cells[(y - unit.y) * unit.w + x - unit.x] = 1;
            }
          }
          const hidden = cells.reduce((sum, cell) => sum + cell, 0) / cells.length;
          expect(hidden, `${where}, ${name}: ${unit.id} in place ${unit.slot}`).toBeLessThan(0.5);
          // And its head is clear: of the top third of it, across its middle half, how much is behind somebody.
          let covered = 0;
          let all = 0;
          for (let y = 0; y < Math.floor(unit.h / 3); y++) {
            for (let x = Math.floor(unit.w / 4); x < Math.ceil((unit.w * 3) / 4); x++) { all++; covered += cells[y * unit.w + x]; }
          }
          worst = { hidden: Math.max(worst.hidden, hidden), head: Math.max(worst.head, covered / all) };
          expect(covered / all, `${where}, ${name}: ${unit.id} head`).toBeLessThanOrEqual(HEAD_HIDDEN);
        });
      }
    }
    // What the worst of them come to: the bounds above are not far off what there is.
    expect(worst.hidden).toBeGreaterThan(0.4);
    expect(worst.head).toBeGreaterThan(HEAD_HIDDEN - 0.05);
  });
});

describe('the bars under the enemies', () => {
  const overlap = (a: { x: number; y: number; w: number }, b: { x: number; y: number; w: number }): boolean =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + BARS_H + 1 && b.y < a.y + BARS_H + 1;

  test('under its machine, a little narrower than it: two pixels under its feet', () => {
    expect(placeBars([{ x: 200, y: 100, w: 64, h: 40 }])).toEqual([{ x: 208, y: 142, w: 48 }]);
    expect(BARS_H).toBe(4);
    // A machine too narrow to have its bars cut short keeps them a few pixels wide.
    expect(placeBars([{ x: 200, y: 100, w: 20, h: 60 }])[0].w).toBeGreaterThanOrEqual(8);
    expect(placeBars([])).toEqual([]);
  });

  test('machines that stand apart keep their bars where they are; they come back in the order the machines were given', () => {
    const boxes = [{ x: 240, y: 110, w: 64, h: 40 }, { x: 150, y: 70, w: 64, h: 40 }];
    expect(placeBars(boxes)).toEqual([{ x: 248, y: 152, w: 48 }, { x: 158, y: 112, w: 48 }]);
  });

  test('bars that would lie on one another are stacked: the higher stays, the lower is moved down until a pixel is between them', () => {
    // Three machines whose feet are all but level and whose boxes overlap: as two mechs and a gunship stand at the sluice.
    const boxes = [{ x: 158, y: 39, w: 92, h: 104 }, { x: 224, y: 44, w: 84, h: 104 }, { x: 208, y: 111, w: 64, h: 35 }];
    const bars = placeBars(boxes);
    expect(bars.map((bar) => bar.y)).toEqual([145, 155, 150]);
    for (const [i, bar] of bars.entries()) expect([bar.x, bar.w]).toEqual([boxes[i].x + 8, boxes[i].w - 16]);
    for (const a of bars) for (const b of bars) if (a !== b) expect(overlap(a, b)).toBe(false);
    // The same bars side by side need no moving.
    expect(placeBars([{ x: 150, y: 100, w: 60, h: 40 }, { x: 220, y: 100, w: 60, h: 40 }]).map((bar) => bar.y)).toEqual([142, 142]);
  });

  test('of two whose bars would lie on one row, the one further left stays and the other is moved down: whichever is listed first', () => {
    const left = { x: 190, y: 100, w: 60, h: 40 };
    const right = { x: 220, y: 100, w: 60, h: 40 };
    expect(placeBars([left, right]).map((bar) => bar.y)).toEqual([142, 147]);
    expect(placeBars([right, left]).map((bar) => bar.y)).toEqual([147, 142]);
  });

  test('bars that would only touch are moved apart too: a pixel is between any two that are one over the other', () => {
    // Two machines whose feet are four pixels apart: the lower one's armour line would lie right under the higher one's balance line.
    const boxes = [{ x: 200, y: 100, w: 64, h: 40 }, { x: 210, y: 104, w: 64, h: 40 }];
    expect(placeBars(boxes).map((bar) => bar.y)).toEqual([142, 147]);
    // Five apart, there is a pixel between them as they are.
    expect(placeBars([{ x: 200, y: 100, w: 64, h: 40 }, { x: 210, y: 105, w: 64, h: 40 }]).map((bar) => bar.y)).toEqual([142, 147]);
    // Six apart, nothing is moved.
    expect(placeBars([{ x: 200, y: 100, w: 64, h: 40 }, { x: 210, y: 106, w: 64, h: 40 }]).map((bar) => bar.y)).toEqual([142, 148]);
  });

  test('none goes under the panel, however many are stacked', () => {
    const boxes = [0, 1, 2, 3, 4].map(() => ({ x: 200, y: 110, w: 64, h: 50 }));
    for (const bar of placeBars(boxes)) expect(bar.y + BARS_H).toBeLessThanOrEqual(PANEL_Y - 2);
  });

  test('in every line-up the story has, in every place, every machine\'s bars are clear of every other\'s, close under it, and over the panel', () => {
    const lineUps = new Map<string, string[]>();
    for (const mission of MISSIONS) for (const battle of mission.battles) lineUps.set(battle.enemies.join('+'), battle.enemies.map((id) => ENEMIES[id].sprite));
    for (const place of ALL_PLACES) {
      for (const [name, sprites] of lineUps) {
        const spots = enemySpots(sprites.length, place);
        const boxes = sprites.map((id, slot) => ({ ...MANIFEST[id], ...standAt(spots[slot], MANIFEST[id], FLYERS.has(id)) }));
        const bars = placeBars(boxes);
        bars.forEach((bar, i) => {
          for (const other of bars.slice(i + 1)) expect(overlap(bar, other), name).toBe(false);
          expect(bar.y + BARS_H, name).toBeLessThanOrEqual(PANEL_Y - 2);
          expect(bar.y, name).toBeGreaterThanOrEqual(boxes[i].y + boxes[i].h + 2);
          expect(bar.y, name).toBeLessThanOrEqual(boxes[i].y + boxes[i].h + 2 + 2 * (BARS_H + 1));
        });
      }
    }
  });
});

describe('how far off a line of the floor is', () => {
  test('nothing where the pilot\'s mech stands, all the way on the farthest line, and in between in between', () => {
    expect(depthOf(HERO_FEET)).toBe(0);
    expect(depthOf(FAR_LINE)).toBe(1);
    expect(depthOf(NEAR_LINE)).toBeGreaterThan(0.2);
    expect(depthOf(NEAR_LINE)).toBeLessThan(0.4);
    for (let y = FAR_LINE; y < HERO_FEET; y++) expect(depthOf(y)).toBeGreaterThan(depthOf(y + 1));
    // Above the farthest line and under the nearest it is no more and no less.
    expect(depthOf(40)).toBe(1);
    expect(depthOf(PANEL_Y + 30)).toBe(0);
  });
});

describe('a mech built from parts that is fought alone', () => {
  test('stands on its spot turned round: its feet on it, its middle over it, its body in the enemies\' part of the field', () => {
    for (const place of ALL_PLACES) {
      const [spot] = enemySpots(1, place);
      const { right, top, body } = duelAt(spot);
      expect(right - SMALL_MIDDLE).toBe(spot.x);
      expect(top + SMALL_GROUND).toBe(spot.y);
      expect(body.x).toBeGreaterThanOrEqual(ENEMY_LEFT);
      expect(body.x + body.w).toBeLessThanOrEqual(ENEMY_RIGHT);
      expect(body.y).toBeGreaterThanOrEqual(ENEMY_TOP);
      expect(body.y + body.h).toBeLessThanOrEqual(spot.y + 1);
      expect(body.y + body.h + BARS).toBeLessThanOrEqual(PANEL_Y);
      // Its body's box is as wide as a mech's legs stand and as tall as it is.
      expect(body.w).toBeGreaterThan(70);
      expect(body.h).toBeGreaterThan(90);
    }
  });

  test('its box is laid out from its spot and nothing else: its body\'s middle over the spot, its feet on it', () => {
    expect(duelAt({ x: 238, y: 143 })).toEqual({ right: 238 + SMALL_MIDDLE, top: 143 - SMALL_GROUND, body: { x: 238 + SMALL_MIDDLE - 90, y: 143 - SMALL_GROUND + 2, w: 78, h: 98 } });
    const [a, b] = [duelAt({ x: 238, y: 143 }), duelAt({ x: 250, y: 150 })];
    expect([b.right - a.right, b.top - a.top, b.body.x - a.body.x, b.body.y - a.body.y]).toEqual([12, 7, 12, 7]);
  });

  test('every pair of legs it can have stands on the line its box is put on', () => {
    const legs = Object.keys(MANIFEST).filter((id) => id.startsWith('legs-') && id.endsWith('.small'));
    expect(legs).toHaveLength(11);
    for (const id of legs) {
      const bottom = MANIFEST[id].oy! + MANIFEST[id].h;
      expect(bottom, id).toBeLessThanOrEqual(SMALL_GROUND + 1);
      expect(bottom, id).toBeGreaterThanOrEqual(SMALL_GROUND - 9);
    }
  });
});
