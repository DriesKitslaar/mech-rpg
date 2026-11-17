import { LOGICAL_W } from './display';

/**
 * Where everything stands in a battle. The field is looked at over the shoulder of the pilot's
 * mech: that mech is near, in the lower left, seen from behind; what it fights stands further off,
 * to the right and higher up, facing it; and between them lies the floor of the place.
 *
 * Every place's picture has a floor in its lower third. The field shows a band of the picture
 * chosen so that the floor begins about half way down it: `row` is the row of the picture at the
 * top of the field when the camera is at home. Everything here is in the screen's own pixels with
 * the camera at home.
 */

/** Top of the field: the message bar ends here. And its bottom: the panel begins here. */
export const FIELD_Y = 14;
export const PANEL_Y = 178;
export const FIELD = { top: FIELD_Y, height: PANEL_Y - FIELD_Y, width: LOGICAL_W };

/** How tall a place's picture is: as tall as the screen. */
const PICTURE_H = 270;
/** The lowest row a picture can be looked at from: lower, and its bottom edge would show. */
export const LOWEST_ROW = PICTURE_H - FIELD.height;

/** What is known of a place's picture: which of its rows is at the top of the field at home, and the row its floor begins at. */
export interface Place { row: number; floor: number }

/** Where the floor is wanted on the screen: this far down from the top of the field. */
const FLOOR_AT = 90;
const lookingAt = (floor: number): Place => ({ row: Math.max(0, Math.min(LOWEST_ROW, floor - FLOOR_AT)), floor });

/** The row each picture's floor begins at: where its walls, railings or far edge end. Read from the pictures. */
export const PLACES: Record<string, Place> = {
  'bg-arena': lookingAt(158),
  'bg-clearing': lookingAt(193),
  'bg-foundry': lookingAt(188),
  'bg-garage': lookingAt(170),
  'bg-mine': lookingAt(193),
  'bg-neon-district': lookingAt(180),
  'bg-plaza': lookingAt(196),
  'bg-rooftop': lookingAt(188),
  'bg-simulator': lookingAt(150),
  'bg-sluice': lookingAt(223),
  'bg-undercity': lookingAt(188),
  'bg-vault': lookingAt(183),
};
/** A picture nothing is known of is taken to be like most of them. */
export const PLAIN: Place = lookingAt(180);
export const placeFor = (background: string): Place => (Object.hasOwn(PLACES, background) ? PLACES[background] : PLAIN);

/** Where the top of a place's picture is on the screen, with the camera at home. */
export const pictureTop = (place: Place): number => FIELD_Y - place.row;
/** Where its floor begins on the screen, with the camera at home. */
export const horizonOf = (place: Place): number => pictureTop(place) + place.floor;

/** The pilot's mech, from behind: the corner of its pose box, and the row of that box its feet stand on. */
export const HERO = { x: 4, y: 53 };
export const HERO_GROUND = 124;
/** The line on the screen the pilot's mech stands on: a pixel over the panel. */
export const HERO_FEET = HERO.y + HERO_GROUND;

/** The nearest line an enemy stands on (its bars are under it, over the panel), and the farthest. */
export const NEAR_LINE = 160;
export const FAR_LINE = 118;
/** An enemy stands this far onto the floor at least: never on its very edge. */
const ONTO_FLOOR = 12;
/** The part of the field enemies are kept in: right of the pilot's mech and what it holds, clear of the edges. */
export const ENEMY_LEFT = 146;
export const ENEMY_RIGHT = LOGICAL_W - 2;
export const ENEMY_TOP = FIELD_Y + 2;
/** How far over the floor what flies hangs. */
export const FLY_LIFT = 14;

/** Sprites of machines that fly: these hang over the floor and bob up and down, everything else stands on it. */
export const FLYERS = new Set([
  'enemy-recon-drone', 'enemy-gunship', 'enemy-shield-drone', 'enemy-repair-drone', 'enemy-lien-drone', 'boss-overseer',
  'enemy-hunter-drone', 'enemy-longshot',
]);

/** The farthest line of a place: `FAR_LINE`, or nearer where its floor begins lower than most. */
export function farLine(place: Place): number {
  return Math.min(NEAR_LINE - 14, Math.max(FAR_LINE, horizonOf(place) + ONTO_FLOOR));
}

/** A place to stand: the middle of the feet, and how far off it is (0 on the nearest line, 1 on the farthest). */
export interface Spot { x: number; y: number; depth: number }

/**
 * Where each enemy stands, by how many places there are: one stands alone in the middle; two stand
 * one behind the other, the first further off; of three the first two stand at the back and the
 * third in front, between them. What is listed first is as a rule the largest, and stands furthest.
 */
const LINE_UPS: Record<number, { x: number; depth: number }[]> = {
  1: [{ x: 238, depth: 0.4 }],
  2: [{ x: 204, depth: 0.9 }, { x: 270, depth: 0.05 }],
  3: [{ x: 196, depth: 1 }, { x: 276, depth: 0.7 }, { x: 240, depth: 0 }],
};
export function enemySpots(count: number, place: Place): Spot[] {
  const far = farLine(place);
  return (LINE_UPS[count] ?? LINE_UPS[3]).map(({ x, depth }) => ({ x, y: Math.round(NEAR_LINE - depth * (NEAR_LINE - far)), depth }));
}

/** Where a machine is drawn, and the line of the floor it stands on or hangs over. */
export interface Standing { x: number; y: number; ground: number }

/**
 * Stands a machine of this size on a spot: its feet on it, or `FLY_LIFT` over it when it flies. One
 * too wide for where it stands is moved in from the sides, and one too tall is moved down: the
 * floor under it is then as far down as it is.
 */
export function standAt(spot: { x: number; y: number }, size: { w: number; h: number }, flies = false): Standing {
  const x = Math.max(Math.min(ENEMY_LEFT, ENEMY_RIGHT - size.w), Math.min(Math.round(spot.x - size.w / 2), ENEMY_RIGHT - size.w));
  const y = Math.max(ENEMY_TOP, spot.y - (flies ? FLY_LIFT : 0) - size.h);
  return { x, y, ground: Math.max(spot.y, y + size.h) };
}

/** The order machines are drawn in: the farthest first, so that what is nearer stands in front of it. Of two on one line, the first listed is behind. */
export function farToNear<T extends { ground: number }>(standing: T[]): T[] {
  return standing.map((item, i) => ({ item, i })).sort((a, b) => a.item.ground - b.item.ground || a.i - b.i).map(({ item }) => item);
}

/** How tall the two bars under a machine are together: its armour, a gap, and its balance. */
export const BARS_H = 4;

/**
 * Where the bars of each machine go, given the boxes the machines are drawn in: two pixels under
 * its feet, a little narrower than it is. Machines that stand close have their feet close, and
 * their bars would lie on one another: of two that would, the higher stays and the lower is moved
 * down until a pixel is between them. None is moved under the panel. They come back in the order
 * the boxes were given in.
 */
export function placeBars(boxes: { x: number; y: number; w: number; h: number }[]): { x: number; y: number; w: number }[] {
  const bars = boxes.map((box) => ({ x: box.x + 8, y: box.y + box.h + 2, w: Math.max(8, box.w - 16) }));
  const lowest = PANEL_Y - 2 - BARS_H;
  const placed: typeof bars = [];
  for (const bar of [...bars].sort((a, b) => a.y - b.y || a.x - b.x)) {
    for (let moved = true; moved;) {
      moved = false;
      for (const other of placed) {
        const across = bar.x < other.x + other.w && other.x < bar.x + bar.w;
        if (across && bar.y < other.y + BARS_H + 1 && other.y < bar.y + BARS_H + 1 && bar.y < lowest) {
          bar.y = Math.min(lowest, other.y + BARS_H + 1);
          moved = true;
        }
      }
    }
    placed.push(bar);
  }
  return bars;
}

/**
 * How far off a line of the floor is: 0 where the pilot's mech stands, 1 on the farthest line there
 * is, and never outside the two.
 */
export function depthOf(y: number): number {
  return Math.max(0, Math.min(1, (HERO_FEET - y) / (HERO_FEET - FAR_LINE)));
}

/** The row of the small pose box a mech built from parts stands on, and where across it its body's middle is. */
export const SMALL_GROUND = 100;
export const SMALL_MIDDLE = 51;
/** The part of the small pose box its body takes up: what its bars and brackets go round. */
const SMALL_BODY = { x: 12, y: 2, w: 78, h: 98 };

/**
 * A mech built from parts that is fought alone stands on its spot turned round, facing the pilot's:
 * its small pose box is mirrored, so its right edge is given, with its top; and the box its body
 * takes up on the screen.
 */
export function duelAt(spot: { x: number; y: number }): { right: number; top: number; body: { x: number; y: number; w: number; h: number } } {
  const right = Math.min(ENEMY_RIGHT + SMALL_BODY.x, spot.x + SMALL_MIDDLE);
  const top = Math.max(ENEMY_TOP, spot.y - SMALL_GROUND);
  return { right, top, body: { x: right - SMALL_BODY.x - SMALL_BODY.w, y: top + SMALL_BODY.y, w: SMALL_BODY.w, h: SMALL_BODY.h } };
}
