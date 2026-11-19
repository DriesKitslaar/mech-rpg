import { createBattle, type BattleEvent, type BattleState } from '../../src/core/battle';
import type { Build, EnemyDef, FrameSlot } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';
import { STRINGS } from '../../src/content/strings';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen, INTRO_MS } from '../../src/ui/battleScreen';
import { BACK_BOX, VIEWS, layoutMech, muzzleOf } from '../../src/ui/mechLayout';
import { mechSprites } from '../../src/ui/mechView';
import type { Sprite, SpriteStore } from '../../src/ui/sprites';
import {
  BARS_H, ENEMY_LEFT, FIELD_Y, FLYERS, FLY_LIFT, HERO, HERO_FEET, PANEL_Y, PLACES, SMALL_GROUND, SMALL_MIDDLE, duelAt, enemySpots, farToNear, horizonOf,
  pictureTop, placeBars, placeFor, standAt,
} from '../../src/ui/stage';
import { COLORS } from '../../src/ui/widgets';
import { onStage, record, type Drawn, type Glowed, type Pictured } from '../helpers/canvas';
import { readPng } from '../helpers/png';

/**
 * A battle as it is looked at: over the shoulder of the pilot's mech. That mech is near, in the
 * lower left, seen from behind; what it fights stands further off on the floor of the place, to
 * the right and higher up; and what is fired leaves the weapon that is drawn and lands on the
 * machine that is drawn. The pictures here have the sizes and places the game's own have.
 */

type Entry = Omit<Sprite, 'image'>;
const MANIFEST = SPRITES as unknown as Record<string, Entry>;
const sprites: SpriteStore = { get: (id, fallback) => ({ ...(MANIFEST[id] ?? fallback), image: { id } as unknown as CanvasImageSource }) };
const idOf = (image: { image: unknown }): string => (image.image as { id: string }).id;
const isShadow = (g: Glowed): boolean => g.blend === 'source-over' && g.stops[0][1].startsWith('rgba(0, 0, 8,');

function screenOf(enemies: (string | EnemyDef)[], opts: { build?: Build; background?: string; fast?: boolean; coach?: boolean } = {}) {
  const state: BattleState = createBattle(opts.build ?? DEMO_BUILD, enemies.map((enemy) => (typeof enemy === 'string' ? ENEMIES[enemy] : enemy)), CATALOG, 7);
  const flow = new BattleFlow(state, CATALOG, { quiet: true });
  const screen = new BattleScreen(flow, sprites, CATALOG, {
    fast: opts.fast ?? true, background: opts.background ?? 'bg-neon-district', ...(opts.coach ? { coach: true } : {}),
  });
  screen.update(16);
  // The field as it stands on the stage: where the camera is, is another matter (tests/ui/cameraScreen.test.ts).
  const page = (): Drawn => onStage(record((ctx) => screen.draw(ctx)), screen.motion.view);
  return { state, flow, screen, page };
}
/** The pictures of the pilot's mech on a page: those drawn from behind. */
const ownOf = (page: Drawn): Pictured[] => page.images.filter((image) => idOf(image).endsWith('.back'));
/** The pictures of the enemies' machines. */
const machinesOf = (page: Drawn): Pictured[] => page.images.filter((image) => /^(enemy|boss)-/.test(idOf(image)));
/**
 * Whether a picture that was drawn is solid at a point of the stage, by the pixels of the picture
 * that shipped. One that is drawn turned round runs leftward from its right edge.
 */
function solidAt(drawn: Pictured, at: { x: number; y: number }): boolean {
  const picture = readPng(`public/${(MANIFEST[idOf(drawn)] as unknown as { file: string }).file}`);
  const x = drawn.w < 0 ? drawn.x - at.x : at.x - drawn.x;
  const y = at.y - drawn.y;
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < picture.w && y < picture.h && picture.at(x, y)[3] >= 128;
}
/** Every part of the frame there is a drawing of, by the kind of part: eleven lower bodies, and eight each of the others. */
const partsOf = (kind: 'legs' | 'core' | 'head' | 'arms'): string[] =>
  Object.keys(MANIFEST).flatMap((id) => new RegExp(`^(${kind}-[a-z0-9-]+?)(\\.near)?\\.back$`).exec(id)?.[1] ?? []).filter((id, i, all) => all.indexOf(id) === i).sort();
/** Mechs that between them wear every part there is: each pair of legs once, the other parts in turn (there are more legs than of any other part). */
const turn = (kind: 'core' | 'head' | 'arms', i: number): string => partsOf(kind)[i % partsOf(kind).length];
const WARDROBE: Build[] = partsOf('legs').map((legs, i) => ({ ...DEMO_BUILD, legs, core: turn('core', i), head: turn('head', i + 3), arms: turn('arms', i + 5) }));
/** The layer a hit on a part is seen on, for a build in a view. */
const hitLayer = (build: Build, part: FrameSlot, suffix: string): string => (part === 'arms' ? `${build.arms}.near${suffix}` : `${build[part]}${suffix}`);

describe('the pilot\'s mech, over whose shoulder the battle is looked at', () => {
  test('is seen from behind: every one of its layers and everything it carries is the drawing from behind, laid out in its box in the lower left', () => {
    const { page } = screenOf(['gun-turret']);
    const own = ownOf(page());
    const parts = mechSprites(sprites, DEMO_BUILD, undefined, 'back');
    const laid = layoutMech(parts, 'back');
    // Five layers of the frame and the three things the demo build carries.
    expect(own.map(idOf)).toEqual(laid.map((cmd) => idOf(parts[cmd.slot]!)));
    expect(own).toHaveLength(8);
    own.forEach((image, i) => expect([image.x, image.y, image.w, image.h], idOf(image)).toEqual([HERO.x + laid[i].x, HERO.y + laid[i].y, parts[laid[i].slot]!.w, parts[laid[i].slot]!.h]));
    // Nothing of it is drawn from the front on the field.
    const fronts = Object.values(mechSprites(sprites, DEMO_BUILD)).map((sprite) => idOf(sprite!));
    for (const image of page().images) expect(fronts).not.toContain(idOf(image));
    // All of it is in the lower left: left of where the enemies stand, its feet just over the panel.
    for (const image of own) {
      expect(image.x + image.w, idOf(image)).toBeLessThanOrEqual(ENEMY_LEFT);
      expect(image.y + image.h, idOf(image)).toBeLessThanOrEqual(PANEL_Y);
      expect(image.x, idOf(image)).toBeGreaterThanOrEqual(0);
    }
    expect(Math.max(...own.map((image) => image.y + image.h))).toBeGreaterThanOrEqual(HERO_FEET - 2);
  });

  test('is the nearest thing on the field: drawn after every enemy, and under everything that is written over them', () => {
    const { page } = screenOf(['recon-drone', 'tank', 'gun-turret']);
    const drawn = page();
    const at = (image: Pictured): number => drawn.order.findIndex((step) => step.kind === 'image' && drawn.images[step.at] === image);
    const lastEnemy = Math.max(...machinesOf(drawn).map(at));
    const own = ownOf(drawn).map(at);
    expect(machinesOf(drawn)).toHaveLength(3);
    expect(Math.min(...own)).toBeGreaterThan(lastEnemy);
    // The enemies' bars come after the pilot's mech: nothing that stands on the field hides them.
    const bars = drawn.order.map((step, i) => (step.kind === 'rect' && drawn.rects[step.at].color === COLORS.armor && drawn.rects[step.at].y < PANEL_Y ? i : -1)).filter((i) => i >= 0);
    expect(bars.length).toBeGreaterThanOrEqual(3);
    expect(Math.min(...bars)).toBeGreaterThan(Math.max(...own));
  });

  test('its shadow lies under it on the floor, and it stands in front of the place\'s picture, not in it', () => {
    const { page } = screenOf(['gun-turret']);
    const drawn = page();
    const shadow = drawn.glows.filter(isShadow).reduce((a, b) => (b.r > a.r ? b : a));
    expect(shadow.y).toBeGreaterThan(HERO_FEET - 8);
    expect(shadow.y).toBeLessThan(HERO_FEET);
    expect(shadow.x).toBeGreaterThan(HERO.x + 40);
    expect(shadow.x).toBeLessThan(HERO.x + 80);
    // The picture is the first thing drawn.
    expect(idOf(drawn.images[0])).toBe('bg-neon-district');
  });

  test('on tracks it sits lower: its body, its head, its arms and what it carries come down, and its tracks stay on the floor', () => {
    const tracked = { ...DEMO_BUILD, legs: 'legs-crawler' };
    const walker = ownOf(screenOf(['gun-turret']).page());
    const crawler = ownOf(screenOf(['gun-turret'], { build: tracked }).page());
    const drop = MANIFEST['legs-crawler.back'].drop!;
    expect(drop).toBeGreaterThan(10);
    for (const image of crawler) {
      const id = idOf(image);
      if (id.startsWith('legs-')) { expect(image.y + image.h).toBeGreaterThanOrEqual(HERO_FEET - 4); continue; }
      expect(image.y, id).toBe(walker.find((other) => idOf(other) === id)!.y + drop);
    }
  });
});

describe('the place a battle is fought in', () => {
  test('its picture is drawn once, at its own size, so far up that the band with its floor is on the field: for every place', () => {
    for (const background of Object.keys(PLACES)) {
      const { page } = screenOf(['gun-turret'], { background });
      const pictures = page().images.filter((image) => idOf(image) === background);
      expect(pictures.map((image) => [image.x, image.y, image.w, image.h]), background).toEqual([[0, pictureTop(placeFor(background)), 310, 270]]);
      // The field shows rows of the picture, never past its top or its bottom.
      expect(pictures[0].y, background).toBeLessThanOrEqual(FIELD_Y);
      expect(pictures[0].y + 270, background).toBeGreaterThanOrEqual(PANEL_Y);
    }
  });

  test('everybody stands on its floor: under where the floor begins, in every place and with every number of enemies', () => {
    for (const background of Object.keys(PLACES)) {
      for (const enemies of [['tank'], ['tank', 'gun-turret'], ['tank', 'gun-turret', 'bomb-crawler']]) {
        const { page } = screenOf(enemies, { background });
        const horizon = horizonOf(placeFor(background));
        for (const machine of machinesOf(page())) expect(machine.y + machine.h, `${background} ${idOf(machine)}`).toBeGreaterThanOrEqual(horizon + 10);
        for (const shadow of page().glows.filter(isShadow)) expect(shadow.y, background).toBeGreaterThan(horizon);
      }
    }
  });
});

describe('what happens on the floor', () => {
  test('rain lands on the whole of it: from where the floor begins down to the panel, and nowhere over the floor', () => {
    const { screen, page } = screenOf(['gun-turret'], { fast: false });
    const horizon = horizonOf(placeFor('bg-neon-district'));
    const rows = new Set<number>();
    for (let i = 0; i < 400; i++) {
      screen.update(48);
      for (const crown of page().rects.filter((r) => r.w === 3 && r.h === 1 && r.color.startsWith('rgba(190, 215, 255,'))) rows.add(crown.y);
    }
    expect(rows.size).toBeGreaterThan(40);
    expect(Math.min(...rows)).toBeGreaterThanOrEqual(horizon + 3);
    expect(Math.min(...rows)).toBeLessThan(horizon + 12);
    expect(Math.max(...rows)).toBeLessThan(PANEL_Y);
    expect(Math.max(...rows)).toBeGreaterThanOrEqual(PANEL_Y - 6);
  });

  test('what falls off a machine comes to rest on the floor under that machine: a casing under the pilot\'s gun, wreckage under the drone it came off', () => {
    const { state, flow, screen } = screenOf(['recon-drone', 'tank'], { fast: false });
    // The drone at the back has a point of armour left: the first thing that lands takes it apart.
    for (const part of Object.values(state.units[1].parts)) if (part) part.ap = 1;
    for (let i = 0; i < 4000 && (flow.phase !== 'action' || screen.banner); i++) screen.update(16);
    const thrown: { kind: string; floor: number | undefined }[] = [];
    const particles = (screen as unknown as { particles: { emit: (...args: unknown[]) => void } }).particles;
    const emit = particles.emit.bind(particles);
    particles.emit = (...args: unknown[]) => { thrown.push({ kind: args[0] as string, floor: args[4] as number | undefined }); emit(...args); };
    screen.onInput('confirm'); screen.onInput('confirm'); screen.onInput('confirm');
    expect(flow.message).toMatch(/Rivet Rifle/);
    for (let i = 0; i < 200; i++) screen.update(16);
    const own = screen.motion.at.floor('player');
    const theirs = screen.motion.at.floor('enemy-0');
    expect(theirs).toBeLessThan(own - 40);
    // The rifle throws a casing: it falls at the pilot's feet.
    expect(thrown.filter((p) => p.kind === 'casing').map((p) => p.floor)).toEqual([own]);
    // The drone comes apart: every piece of it falls to the line under the drone, far up the screen from the pilot's feet.
    const debris = thrown.filter((p) => p.kind === 'debris');
    expect(debris.length).toBeGreaterThanOrEqual(3);
    expect(new Set(debris.map((p) => p.floor))).toEqual(new Set([theirs]));
  });
});

describe('the enemies, further off', () => {
  test('each stands on its spot: its feet on it and its middle over it, or over it when it flies', () => {
    const line = ['recon-drone', 'tank', 'gun-turret'];
    const { page } = screenOf(line);
    const spots = enemySpots(3, placeFor('bg-neon-district'));
    const machines = machinesOf(page());
    line.forEach((id, slot) => {
      const sprite = ENEMIES[id].sprite;
      const size = MANIFEST[sprite];
      const at = standAt(spots[slot], size, FLYERS.has(sprite));
      const drawn = machines.find((image) => idOf(image) === sprite)!;
      expect([drawn.x, drawn.w, drawn.h], id).toEqual([at.x, size.w, size.h]);
      // A hurried game has nothing bobbing: what flies hangs at its height, what stands stands.
      expect(drawn.y, id).toBe(at.y);
      expect(drawn.y + drawn.h, id).toBe(spots[slot].y - (FLYERS.has(sprite) ? FLY_LIFT : 0));
    });
    // All of them right of the pilot's mech.
    for (const machine of machines) expect(machine.x).toBeGreaterThanOrEqual(ENEMY_LEFT);
  });

  test('are drawn from the farthest to the nearest, whatever order they are listed in', () => {
    // A machine too tall for the farthest line is moved down, and is then nearer than the one listed after it.
    const line = ['overseer', 'tank', 'gun-turret'];
    const { page } = screenOf(line);
    const spots = enemySpots(3, placeFor('bg-neon-district'));
    const standing = line.map((id, slot) => ({ sprite: ENEMIES[id].sprite, ...standAt(spots[slot], MANIFEST[ENEMIES[id].sprite], FLYERS.has(ENEMIES[id].sprite)) }));
    const order = farToNear(standing).map((unit) => unit.sprite);
    expect(order).toEqual(['enemy-tank', 'boss-overseer', 'enemy-gun-turret']);
    expect(machinesOf(page()).map(idOf)).toEqual(order);
    // Three of a kind that stand as listed are drawn as listed.
    expect(farToNear(enemySpots(3, placeFor('bg-neon-district')).map((spot) => ({ ground: spot.y }))).map((unit) => unit.ground)).toEqual([118, 131, 160]);
  });

  test('what flies hangs over its shadow and bobs; what stands has its shadow at its feet and stands still', () => {
    const { screen, page } = screenOf(['recon-drone', 'tank'], { fast: false });
    screen.update(INTRO_MS + 16);
    const spots = enemySpots(2, placeFor('bg-neon-district'));
    const tops = { drone: new Set<number>(), tank: new Set<number>() };
    for (let i = 0; i < 80; i++) {
      screen.update(48);
      const machines = machinesOf(page());
      tops.drone.add(machines.find((image) => idOf(image) === 'enemy-recon-drone')!.y);
      tops.tank.add(machines.find((image) => idOf(image) === 'enemy-tank')!.y);
    }
    expect(tops.tank.size).toBe(1);
    expect(tops.drone.size).toBeGreaterThanOrEqual(3);
    const rest = spots[0].y - FLY_LIFT - MANIFEST['enemy-recon-drone'].h;
    for (const y of tops.drone) expect(Math.abs(y - rest)).toBeLessThanOrEqual(2);
    // Their shadows: both on the floor at their spots; the drone's is over nothing of the drone, the tank's under its tracks.
    const shadows = page().glows.filter(isShadow).sort((a, b) => a.y - b.y);
    expect(shadows).toHaveLength(3);
    expect(shadows[0].y).toBe(spots[0].y - 1);
    expect(shadows[1].y).toBe(spots[1].y - 1);
    expect(shadows[0].y).toBeGreaterThan(rest + MANIFEST['enemy-recon-drone'].h + FLY_LIFT - 4);
    // What hangs over the floor throws a smaller shadow than what stands on it, for its size.
    expect(shadows[0].r / MANIFEST['enemy-recon-drone'].w).toBeLessThan(shadows[1].r / MANIFEST['enemy-tank'].w);
  });

  test('their bars are under them, and stacked where they stand so close that the bars would lie on one another', () => {
    const line = ['heavy-mech', 'light-mech', 'gunship'];
    const { page } = screenOf(line, { background: 'bg-sluice' });
    const drawn = page();
    const boxes = line.map((id) => machinesOf(drawn).find((image) => idOf(image) === ENEMIES[id].sprite)!);
    const expected = placeBars(boxes);
    const armour = drawn.rects.filter((r) => r.color === COLORS.armor && r.h === 2 && r.y < PANEL_Y && r.y > FIELD_Y + 20);
    // Each machine's armour line begins where its bars were put: three of them, on three different rows.
    for (const bar of expected) expect(armour.some((r) => r.x === bar.x && r.y === bar.y), JSON.stringify(bar)).toBe(true);
    expect(new Set(expected.map((bar) => bar.y)).size).toBe(3);
    for (const bar of expected) expect(bar.y + BARS_H).toBeLessThanOrEqual(PANEL_Y - 2);
  });
});

describe('what is fired', () => {
  const WEAPONS = ['rightHand', 'leftHand', 'shoulder'] as const;

  test('leaves the weapon that is drawn: the far end of what the pilot\'s mech holds in each fist and carries on its shoulder', () => {
    const { screen, page } = screenOf(['gun-turret']);
    const own = ownOf(page());
    for (const weapon of WEAPONS) {
      const id = `${DEMO_BUILD[weapon]}.back`;
      const drawn = own.find((image) => idOf(image) === id)!;
      const { mx, my } = MANIFEST[id];
      expect(screen.motion.at.muzzle('player', weapon), weapon).toEqual({ x: drawn.x + mx!, y: drawn.y + my! });
      // The far end is the end towards the enemies: right of where it is gripped, and no lower.
      expect(mx!, weapon).toBeGreaterThan(MANIFEST[id].gx!);
    }
    // What the near fist holds fires from furthest right; nothing fires from under the mech's waist.
    const from = WEAPONS.map((weapon) => screen.motion.at.muzzle('player', weapon));
    expect(from[0].x).toBeGreaterThan(from[1].x);
    expect(from[0].x).toBeGreaterThan(from[2].x);
    for (const point of from) expect(point.y).toBeLessThan(HERO.y + BACK_BOX * 0.65);
  });

  test('a mech that carries nothing on its shoulder, or has lost a hand\'s weapon, fires from the mount or the fist all the same', () => {
    const { shoulder: _shoulder, leftHand: _leftHand, ...bare } = DEMO_BUILD;
    const { screen } = screenOf(['gun-turret'], { build: bare as Build });
    const { mount, farFist } = VIEWS.back;
    expect(screen.motion.at.muzzle('player', 'shoulder')).toEqual({ x: HERO.x + mount.x, y: HERO.y + mount.y });
    expect(screen.motion.at.muzzle('player', 'leftHand')).toEqual({ x: HERO.x + farFist.x, y: HERO.y + farFist.y });
    // On tracks those points come down with the body.
    const tracked = screenOf(['gun-turret'], { build: { ...bare, legs: 'legs-crawler' } as Build });
    expect(tracked.screen.motion.at.muzzle('player', 'shoulder')).toEqual({ x: HERO.x + mount.x, y: HERO.y + mount.y + MANIFEST['legs-crawler.back'].drop! });
  });

  test('a mech whose arms name their own fists holds its weapons in those fists and fires from there: a Dozer\'s arms hang lower than the pose', () => {
    const build: Build = { ...DEMO_BUILD, arms: 'arms-dozer' };
    const { screen, page } = screenOf(['gun-turret'], { build });
    const own = ownOf(page());
    const usual = screenOf(['gun-turret']);
    const hands = [['rightHand', 'arms-dozer.near.back', VIEWS.back.nearFist], ['leftHand', 'arms-dozer.far.back', VIEWS.back.farFist]] as const;
    for (const [hand, layer, pose] of hands) {
      const entry = MANIFEST[layer];
      const id = `${build[hand]}.back`;
      const arm = own.find((image) => idOf(image) === layer)!;
      const held = own.find((image) => idOf(image) === id)!;
      const grip = { x: held.x + MANIFEST[id].gx!, y: held.y + MANIFEST[id].gy! };
      // Its grip is on the fist of the arm as it was drawn: on a pixel of the hand.
      expect(grip, hand).toEqual({ x: arm.x + entry.fx!, y: arm.y + entry.fy! });
      expect(solidAt(arm, grip), hand).toBe(true);
      // Another frame holds the same weapon where the pose has the fist: this one lower, by what its fist is lower.
      const other = ownOf(usual.page()).find((image) => idOf(image) === id)!;
      expect({ x: held.x - other.x, y: held.y - other.y }, hand).toEqual({ x: entry.ox! + entry.fx! - pose.x, y: entry.oy! + entry.fy! - pose.y });
      expect(held.y - other.y, hand).toBeGreaterThanOrEqual(6);
      // What is fired leaves the weapon where it is drawn.
      expect(screen.motion.at.muzzle('player', hand), hand).toEqual({ x: held.x + MANIFEST[id].mx!, y: held.y + MANIFEST[id].my! });
    }
    // What the shoulder carries is where it is on any frame: the mount is the pose's, not the arm's.
    expect(screen.motion.at.muzzle('player', 'shoulder')).toEqual(usual.screen.motion.at.muzzle('player', 'shoulder'));
    // With nothing in a hand a shot leaves the fist itself; on tracks the fist comes down with the arm.
    const { rightHand: _right, leftHand: _left, ...bare } = build;
    const empty = screenOf(['gun-turret'], { build: bare as Build });
    const tracked = screenOf(['gun-turret'], { build: { ...bare, legs: 'legs-crawler' } as Build });
    for (const [hand, layer] of hands) {
      const entry = MANIFEST[layer];
      const fist = { x: HERO.x + entry.ox! + entry.fx!, y: HERO.y + entry.oy! + entry.fy! };
      expect(empty.screen.motion.at.muzzle('player', hand), hand).toEqual(fist);
      expect(tracked.screen.motion.at.muzzle('player', hand), hand).toEqual({ x: fist.x, y: fist.y + MANIFEST['legs-crawler.back'].drop! });
    }
  });

  test('lands on the pilot\'s mech on the part that is hit, on a pixel of its drawing: whatever it wears, tracks, four legs and a hover unit among it', () => {
    expect([partsOf('legs').length, partsOf('core').length, partsOf('head').length, partsOf('arms').length]).toEqual([15, 12, 12, 12]);
    expect(new Set(WARDROBE.flatMap((build) => [build.legs, build.core, build.head, build.arms])).size).toBe(51);
    let lowered = 0;
    for (const build of WARDROBE) {
      for (const id of [build.legs!, build.core, build.head!, build.arms!]) expect(CATALOG[id], id).toBeDefined();
      const { screen, page } = screenOf(['gun-turret'], { build });
      const own = ownOf(page());
      const legs = MANIFEST[`${build.legs}.back`];
      if (legs.drop) lowered++;
      for (const part of ['head', 'core', 'arms', 'legs'] as FrameSlot[]) {
        const drawn = own.find((image) => idOf(image) === hitLayer(build, part, '.back'))!;
        const hit = screen.motion.at.hit('player', part);
        expect(solidAt(drawn, hit), `${part} of ${JSON.stringify([build.legs, build.core, build.head, build.arms])} at ${hit.x},${hit.y}`).toBe(true);
        // Near where the view has that part, wherever the legs have lowered the body to.
        const aim = VIEWS.back.hit![part];
        const off = Math.hypot(hit.x - (HERO.x + aim.x), hit.y - (HERO.y + aim.y + (part === 'legs' ? 0 : legs.drop ?? 0)));
        // A squat frame carries its head a little lower than the others: the hit is on the head it has, not over it.
        // The widest stance there is has the leg nearest the middle twenty-one from it.
        expect(off, `${part} of ${build.legs}`).toBeLessThanOrEqual({ core: 0, head: 5, arms: 7, legs: 21 }[part]);
      }
      // Its middle is under its body, at its waist or a little over it, and the floor under it is the line its feet are on.
      const core = own.find((image) => idOf(image) === `${build.core}.back`)!;
      const middle = screen.motion.at.centre('player');
      expect(middle.x, build.core).toBeGreaterThanOrEqual(core.x);
      expect(middle.x, build.core).toBeLessThanOrEqual(core.x + core.w);
      expect(middle.y, build.core).toBeGreaterThan(core.y + core.h / 2);
      expect(middle.y, build.core).toBeLessThan(core.y + core.h + 16);
      expect(screen.motion.at.floor('player')).toBe(HERO_FEET - 2);
    }
    // Three of the lower bodies carry what stands on them lower.
    expect(lowered).toBe(3);
  });

  test('lands on a mech that is fought alone on the part that is hit, on a pixel of its small drawing, turned round as it is', () => {
    for (const worn of WARDROBE) {
      const rival: EnemyDef = { ...ENEMIES.rival, build: { ...ENEMIES.rival.build, legs: worn.legs, core: worn.core, head: worn.head, arms: worn.arms } };
      const { state, screen, page } = screenOf([rival]);
      expect(state.units[1].composed).toBe(true);
      const small = page().images.filter((image) => idOf(image).endsWith('.small'));
      const box = duelAt(enemySpots(1, placeFor('bg-neon-district'))[0]);
      const legs = MANIFEST[`${worn.legs}.small`];
      for (const part of ['head', 'core', 'arms', 'legs'] as FrameSlot[]) {
        const drawn = small.find((image) => idOf(image) === hitLayer(rival.build as Build, part, '.small'))!;
        expect(drawn.w, idOf(drawn)).toBeLessThan(0);
        const hit = screen.motion.at.hit('enemy-0', part);
        expect(solidAt(drawn, hit), `${part} of ${JSON.stringify([worn.legs, worn.core, worn.head, worn.arms])} at ${hit.x},${hit.y}`).toBe(true);
        const aim = VIEWS.small.hit![part];
        const off = Math.hypot(hit.x - (box.right - aim.x), hit.y - (box.top + aim.y + (part === 'legs' ? 0 : legs.drop ?? 0)));
        expect(off, `${part} of ${worn.legs}`).toBeLessThanOrEqual({ core: 0, head: 2, arms: 7, legs: 20 }[part]);
      }
      // Its middle is under its body too: the body is drawn leftward from its right edge.
      const core = small.find((image) => idOf(image) === `${worn.core}.small`)!;
      const middle = screen.motion.at.centre('enemy-0');
      expect(middle.x, worn.core).toBeLessThanOrEqual(core.x);
      expect(middle.x, worn.core).toBeGreaterThanOrEqual(core.x + core.w);
      expect(middle.y, worn.core).toBeGreaterThan(core.y + core.h / 2);
      expect(middle.y, worn.core).toBeLessThan(core.y + core.h + 16);
    }
  });

  test('lands on the enemy that is drawn, and comes from its side that faces the pilot; what falls off it falls to the floor under it', () => {
    const line = ['recon-drone', 'tank', 'gun-turret'];
    const { screen, page } = screenOf(line);
    const machines = machinesOf(page());
    const spots = enemySpots(3, placeFor('bg-neon-district'));
    line.forEach((name, slot) => {
      const id = `enemy-${slot}`;
      const drawn = machines.find((image) => idOf(image) === ENEMIES[name].sprite)!;
      for (const part of ['head', 'core', 'arms', 'legs'] as FrameSlot[]) {
        const hit = screen.motion.at.hit(id, part);
        expect(hit.x > drawn.x && hit.x < drawn.x + drawn.w && hit.y > drawn.y && hit.y < drawn.y + drawn.h, `${name} ${part}`).toBe(true);
      }
      const from = screen.motion.at.muzzle(id, 'rightHand');
      expect(from.x, name).toBeLessThan(drawn.x + drawn.w / 4);
      expect(from.y, name).toBeGreaterThan(drawn.y);
      expect(from.y, name).toBeLessThan(drawn.y + drawn.h);
      // The floor under it is the line of its spot: further up the screen for one that stands further off.
      expect(screen.motion.at.floor(id), name).toBe(spots[slot].y - 1);
    });
    expect(screen.motion.at.floor('enemy-0')).toBeLessThan(screen.motion.at.floor('enemy-2'));
    expect(screen.motion.at.floor('enemy-2')).toBeLessThan(screen.motion.at.floor('player'));
  });

  test('travels up and to the right from the pilot, down and to the left from an enemy: the two stand across the floor from each other', () => {
    const { screen } = screenOf(['tank']);
    const out = screen.motion.at.muzzle('player', 'rightHand');
    const target = screen.motion.at.hit('enemy-0', 'core');
    expect(target.x).toBeGreaterThan(out.x + 40);
    const back = screen.motion.at.muzzle('enemy-0', 'rightHand');
    const own = screen.motion.at.hit('player', 'core');
    expect(own.x).toBeLessThan(back.x - 40);
    // The enemy's feet are further up the screen than the pilot's: it is further off.
    expect(screen.motion.at.floor('enemy-0')).toBeLessThan(screen.motion.at.floor('player') - 20);
  });
});

describe('a mech built from parts that is fought alone', () => {
  test('stands far off, small and turned round: every part its small drawing, drawn leftward from the right edge of its box, its feet on its spot', () => {
    const { state, page } = screenOf(['rival']);
    expect(state.units[1].composed).toBe(true);
    const drawn = page();
    const small = drawn.images.filter((image) => idOf(image).endsWith('.small'));
    const parts = mechSprites(sprites, state.units[1].build, undefined, 'small');
    const laid = layoutMech(parts, 'small');
    expect(small.map(idOf)).toEqual(laid.map((cmd) => idOf(parts[cmd.slot]!)));
    const [spot] = enemySpots(1, placeFor('bg-neon-district'));
    const box = duelAt(spot);
    small.forEach((image, i) => {
      // Turned round: a part that lies at x in the box is drawn from box.right - x leftward.
      expect(image.w, idOf(image)).toBe(-parts[laid[i].slot]!.w);
      expect([image.x, image.y], idOf(image)).toEqual([box.right - laid[i].x, box.top + laid[i].y]);
    });
    // Its feet are on its spot and its middle over it.
    const legs = small.find((image) => idOf(image).startsWith('legs-'))!;
    expect(Math.abs(legs.y + legs.h - spot.y)).toBeLessThanOrEqual(SMALL_GROUND - (MANIFEST[idOf(legs)].oy! + MANIFEST[idOf(legs)].h) + 1);
    expect(box.right - SMALL_MIDDLE).toBe(spot.x);
    // It is drawn before the pilot's mech, which is nearer; and no picture of it as one machine is drawn.
    expect(drawn.images.indexOf(small.at(-1)!)).toBeLessThan(drawn.images.indexOf(ownOf(drawn)[0]));
    expect(machinesOf(drawn)).toEqual([]);
  });

  test('fires from the left end of what it holds, towards the pilot; hits land on its body; its bars are under its feet', () => {
    const { state, screen, page } = screenOf(['rival']);
    const [spot] = enemySpots(1, placeFor('bg-neon-district'));
    const box = duelAt(spot);
    const parts = mechSprites(sprites, state.units[1].build, undefined, 'small');
    const small = page().images.filter((image) => idOf(image).endsWith('.small'));
    let held = 0;
    for (const weapon of ['rightHand', 'leftHand', 'shoulder'] as const) {
      const from = screen.motion.at.muzzle('enemy-0', weapon);
      // Inside its box, turned round: what lies at x in the box is at box.right - x on the screen.
      expect(from.x, weapon).toBeLessThan(box.right);
      expect(from.x, weapon).toBeGreaterThan(ENEMY_LEFT);
      const fist = weapon === 'rightHand' ? VIEWS.small.nearFist : weapon === 'leftHand' ? VIEWS.small.farFist : VIEWS.small.mount;
      const end = muzzleOf(parts, weapon, 'small');
      if (!parts[weapon]) {
        // A hand that holds nothing fires from the fist.
        expect(end, weapon).toBeNull();
        expect(from, weapon).toEqual({ x: box.right - fist.x, y: box.top + fist.y });
        continue;
      }
      held++;
      // One that holds something fires from its far end, exactly, turned round with it.
      expect(from, weapon).toEqual({ x: box.right - end!.x, y: box.top + end!.y });
      // That is on the picture of what it holds as it was drawn, at the end of it that points at the pilot: the left one.
      const drawn = small.find((image) => idOf(image) === idOf(parts[weapon]!))!;
      const [left, right] = [drawn.x + drawn.w, drawn.x];
      expect(left, weapon).toBeLessThan(right);
      expect(from.x, weapon).toBeGreaterThanOrEqual(left);
      expect(from.x, weapon).toBeLessThanOrEqual(left + (right - left) * 0.3);
      expect(from.y, weapon).toBeGreaterThanOrEqual(drawn.y);
      expect(from.y, weapon).toBeLessThanOrEqual(drawn.y + drawn.h);
      expect(from.x, weapon).toBeLessThan(box.right - fist.x);
    }
    expect(held).toBeGreaterThanOrEqual(2);
    // On tracks its body sits lower, and an empty fist and what the shoulder carries with it: by as much as its own
    // tracks lower it, whatever the pilot's mech stands on.
    const tracked = screenOf([{ ...ENEMIES.rival, build: { ...ENEMIES.rival.build, legs: 'legs-crawler' } }], { build: { ...DEMO_BUILD, legs: 'legs-spider' } });
    const low = MANIFEST['legs-crawler.small'].drop!;
    expect(low).toBeGreaterThan(5);
    expect(low).not.toBe(MANIFEST['legs-spider.back'].drop);
    for (const weapon of ['rightHand', 'leftHand', 'shoulder'] as const) {
      const [plain, lowered] = [screen.motion.at.muzzle('enemy-0', weapon), tracked.screen.motion.at.muzzle('enemy-0', weapon)];
      expect([lowered.x - plain.x, lowered.y - plain.y], weapon).toEqual([0, low]);
    }
    expect(tracked.screen.motion.at.centre('enemy-0').y - screen.motion.at.centre('enemy-0').y).toBe(low);
    // The rival carries a long gun in its near fist: that reaches furthest towards the pilot.
    expect(parts.rightHand).toBeDefined();
    expect(screen.motion.at.muzzle('enemy-0', 'rightHand').x).toBeLessThan(screen.motion.at.muzzle('enemy-0', 'leftHand').x);
    for (const part of ['head', 'core', 'arms', 'legs'] as FrameSlot[]) {
      const hit = screen.motion.at.hit('enemy-0', part);
      expect(hit.x > box.body.x && hit.x < box.body.x + box.body.w && hit.y > box.body.y && hit.y < box.body.y + box.body.h, part).toBe(true);
    }
    expect(screen.motion.at.floor('enemy-0')).toBe(spot.y - 1);
    const armour = page().rects.filter((r) => r.color === COLORS.armor && r.h === 2 && r.y < PANEL_Y && r.y > FIELD_Y + 20);
    expect(armour.some((r) => r.y === box.body.y + box.body.h + 2 && r.x === box.body.x + 8)).toBe(true);
  });

  test('among others it is one picture like the rest, and stands on its spot', () => {
    const { page } = screenOf(['rival', 'recon-drone']);
    const drawn = page();
    expect(drawn.images.filter((image) => idOf(image).endsWith('.small'))).toEqual([]);
    expect(machinesOf(drawn).map(idOf).sort()).toEqual(['enemy-recon-drone', 'enemy-rival']);
  });
});

describe('what happens to a unit happens where that unit is', () => {
  type At = { x: number; y: number };
  /** A battle that is not hurried, with what is asked of the camera and of what flies about written down as it is asked. */
  function watched(enemies: (string | EnemyDef)[] = ['recon-drone', 'tank'], build?: Build) {
    const made = screenOf(enemies, { fast: false, ...(build ? { build } : {}) });
    for (let i = 0; i < 4000 && (made.flow.phase !== 'action' || made.screen.banner); i++) made.screen.update(16);
    const inner = made.screen as unknown as {
      move(event: BattleEvent, melee: boolean, flight: number, staged?: boolean): void;
      particles: { emit: (...args: unknown[]) => void };
      camera: { push: (at: At, amount: number, delay?: number) => void };
      fx: { onEvent(event: BattleEvent): void; transform(id: string): { dx: number; dy: number; lift: number }; effects: { kind: string; under?: boolean }[]; jolt(delay: number, amount: number, dur: number): void };
      arrived: Set<string>;
    };
    const thrown: { kind: string; from: At }[] = [];
    const pushed: { at: At; amount: number }[] = [];
    const emit = inner.particles.emit.bind(inner.particles);
    inner.particles.emit = (...args: unknown[]) => { thrown.push({ kind: args[0] as string, from: { ...(args[1] as At) } }); emit(...args); };
    const push = inner.camera.push.bind(inner.camera);
    inner.camera.push = (at, amount, delay) => { pushed.push({ at: { ...at }, amount }); push(at, amount, delay); };
    return { ...made, inner, thrown, pushed };
  }
  const shot = (unit: string, target: string, part: FrameSlot, weapon: 'rightHand' | 'leftHand' = 'rightHand'): BattleEvent =>
    ({ type: 'shot', unit, weapon, target, part, appliedTo: part, hit: true, damage: 10 });

  test('a unit that dashes kicks up dust from the floor under it: at the pilot\'s feet, and far up the screen under a machine', () => {
    const { screen, inner, thrown } = watched();
    inner.move({ type: 'boost', unit: 'player' } as BattleEvent, false, 0);
    inner.move({ type: 'boost', unit: 'enemy-1' } as BattleEvent, false, 0);
    const dust = thrown.filter((p) => p.kind === 'dust');
    expect(dust.map((p) => p.from)).toEqual([
      { x: screen.motion.at.centre('player').x, y: screen.motion.at.floor('player') },
      { x: screen.motion.at.centre('enemy-1').x, y: screen.motion.at.floor('enemy-1') },
    ]);
    expect(dust[1].from.y).toBeLessThan(dust[0].from.y - 10);
  });

  test('the camera pushes in on the part that was hit, and the sparks fly from there: not from the middle of the machine', () => {
    const { screen, inner, thrown, pushed } = watched();
    const spots = new Set<string>();
    for (const part of ['legs', 'core', 'head'] as FrameSlot[]) {
      inner.move(shot('player', 'enemy-1', part), false, 160);
      const hit = screen.motion.at.hit('enemy-1', part);
      expect(pushed.at(-1)!.at, part).toEqual(hit);
      expect(thrown.filter((p) => p.kind === 'sparks').at(-1)!.from, part).toEqual(hit);
      spots.add(`${hit.x},${hit.y}`);
    }
    expect(spots.size).toBe(3);
    // And on the pilot's own mech the same: a hit on its legs is pushed in on where its legs are hit.
    inner.move(shot('enemy-1', 'player', 'legs'), false, 160);
    expect(pushed.at(-1)!.at).toEqual(screen.motion.at.hit('player', 'legs'));
    expect(pushed.at(-1)!.at).not.toEqual(screen.motion.at.hit('player', 'core'));
  });

  test('a machine that is not there yet has no shadow, no bars and no glow of heat; one that has gone has none either', () => {
    const { flow, page, inner } = watched(['recon-drone', 'tank']);
    for (const unit of flow.state.units) unit.heat = 95;
    const heat = (drawn: Drawn): number => drawn.glows.filter((g) => g.blend === 'lighter' && g.stops[0][1].startsWith('rgba(255, 90, 32,')).length;
    const bars = (drawn: Drawn): number => drawn.rects.filter((r) => r.color === COLORS.armor && r.h === 2 && r.y < PANEL_Y && r.y > FIELD_Y + 20).length;
    const all = page();
    expect([heat(all), all.glows.filter(isShadow).length, bars(all), machinesOf(all).length]).toEqual([3, 3, 2, 2]);
    // The tank has not been launched yet: nothing of it is on the field, its heat least of all.
    inner.arrived.delete('enemy-1');
    const before = page();
    expect([heat(before), before.glows.filter(isShadow).length, bars(before), machinesOf(before).length]).toEqual([2, 2, 1, 1]);
    inner.arrived.add('enemy-1');
    expect(heat(page())).toBe(3);
  });

  test('when the pilot\'s mech is gone, so is its shadow', () => {
    const { flow, page } = screenOf(['recon-drone', 'tank']);
    expect(page().glows.filter(isShadow)).toHaveLength(3);
    // A hurried game: what is destroyed is gone at once.
    flow.state.units[0].destroyed = true;
    const after = page();
    expect(ownOf(after)).toEqual([]);
    expect(after.glows.filter(isShadow)).toHaveLength(2);
    // What is left are the machines' shadows, on their side of the field.
    for (const shadow of after.glows.filter(isShadow)) expect(shadow.x).toBeGreaterThan(ENEMY_LEFT);
  });

  test('the bars of a machine that has been destroyed take up no room: the others\' bars are where they would be without it', () => {
    // Three that stand so close that their bars are stacked on three rows: the gunship hangs between the other two.
    const line = ['heavy-mech', 'light-mech', 'gunship'];
    const { flow, page } = screenOf(line, { background: 'bg-sluice', fast: false });
    const armour = (drawn: Drawn) => drawn.rects.filter((r) => r.color === COLORS.armor && r.h === 2 && r.y < PANEL_Y && r.y > FIELD_Y + 20).map((r) => ({ x: r.x, y: r.y }));
    // Where each stands or hangs: what flies bobs as it is drawn, and its bars do not bob with it.
    const spots = enemySpots(3, placeFor('bg-sluice'));
    const boxes = line.map((id, slot) => {
      const picture = ENEMIES[id].sprite!;
      return { ...standAt(spots[slot], MANIFEST[picture], FLYERS.has(picture)), w: MANIFEST[picture].w, h: MANIFEST[picture].h };
    });
    const byRow = (bars: { x: number; y: number }[]) => bars.map(({ x, y }) => ({ x, y })).sort((p, q) => p.y - q.y);
    const stacked = placeBars(boxes);
    expect(byRow(armour(page()))).toEqual(byRow(stacked));
    expect(new Set(stacked.map((bar) => bar.y)).size).toBe(3);
    // The one whose bars are highest is destroyed: it is still seen coming apart, but it has no bars, and makes room.
    const first = stacked.indexOf(stacked.reduce((p, q) => (q.y < p.y ? q : p)));
    flow.state.units[first + 1].destroyed = true;
    const left = placeBars(boxes.filter((_, i) => i !== first));
    expect(byRow(armour(page()))).toEqual(byRow(left));
    // And that is not where they were: at least one of them has moved up.
    expect(left.some((bar) => !stacked.some((was) => was.x === bar.x && was.y === bar.y))).toBe(true);
  });

  test('a unit in a place nobody planned for stands on the last place there is', () => {
    const { flow, screen } = screenOf(['recon-drone', 'tank']);
    const spots = enemySpots(2, placeFor('bg-neon-district'));
    expect(screen.motion.at.foot('enemy-0').y).toBe(spots[0].y);
    flow.state.units[1].slot = 7;
    expect(screen.motion.at.foot('enemy-0').y).toBe(spots[1].y);
    expect(screen.motion.at.foot('enemy-0').y).not.toBe(spots[0].y);
  });

  test('on tracks the middle of the pilot\'s mech is as much lower as its body is', () => {
    const plain = screenOf(['gun-turret']).screen.motion.at.centre('player');
    const tracked = screenOf(['gun-turret'], { build: { ...DEMO_BUILD, legs: 'legs-crawler' } }).screen.motion.at.centre('player');
    expect([tracked.x - plain.x, tracked.y - plain.y]).toEqual([0, MANIFEST['legs-crawler.back'].drop!]);
    expect(MANIFEST['legs-crawler.back'].drop!).toBeGreaterThan(10);
  });

  test('only the pilot\'s own left hand is on the far side of its mech: what an enemy fires from its left hand is in plain view', () => {
    const { inner } = watched(['rival']);
    const under = (event: BattleEvent): string[] => {
      const before = inner.fx.effects.length;
      inner.fx.onEvent(event);
      return inner.fx.effects.slice(before).filter((fx) => fx.under).map((fx) => fx.kind).sort();
    };
    expect(under(shot('player', 'enemy-0', 'core', 'leftHand'))).toEqual(['muzzle', 'projectile']);
    expect(under(shot('player', 'enemy-0', 'core', 'rightHand'))).toEqual([]);
    expect(under(shot('enemy-0', 'player', 'core', 'leftHand'))).toEqual([]);
    expect(under(shot('enemy-0', 'player', 'core', 'rightHand'))).toEqual([]);
  });

  test('a machine that is one picture is kicked back by its own gun along its barrel, up the screen as well as down it', () => {
    const { screen, page, inner } = watched(['recon-drone', 'tank']);
    const drone = (drawn: Drawn) => machinesOf(drawn).filter((image) => idOf(image) === 'enemy-recon-drone').at(-1)!;
    // The drone hangs high: firing down at the pilot's legs it is kicked up and to the right.
    const rest = { x: drone(page()).x, y: drone(page()).y };
    inner.fx.onEvent(shot('enemy-0', 'player', 'legs'));
    // (What moves it by itself as it hangs there, its bob, does not change in a thousandth of a second.)
    screen.update(1);
    const t = inner.fx.transform('enemy-0');
    expect(t.lift).toBeLessThan(0);
    expect(t.dx).toBeGreaterThan(0);
    const kicked = drone(page());
    expect([kicked.x - rest.x, kicked.y - rest.y]).toEqual([t.dx, t.dy + t.lift]);
  });

  test('a mech that is fought alone goes down the floor when it dashes at the pilot: all of it, turned round as it is', () => {
    const { screen, page, inner } = watched(['rival']);
    const legs = (drawn: Drawn) => drawn.images.filter((image) => idOf(image).startsWith('legs-') && idOf(image).endsWith('.small')).at(-1)!;
    const rest = legs(page());
    inner.fx.onEvent({ type: 'boost', unit: 'enemy-0' } as BattleEvent);
    let furthest = { dx: 0, lift: 0 };
    for (let i = 0; i < 30; i++) {
      screen.update(16);
      const t = inner.fx.transform('enemy-0');
      const now = legs(page());
      // Drawn leftward from its right edge: a step to the left is a step to the left all the same.
      expect([now.x - rest.x, now.y - rest.y], `frame ${i}`).toEqual([t.dx, t.lift]);
      if (Math.abs(t.dx) > Math.abs(furthest.dx)) furthest = { dx: t.dx, lift: t.lift };
    }
    // Towards the pilot's mech: to the left, and down the screen, for that mech stands nearer.
    expect(furthest.dx).toBeLessThan(-5);
    expect(furthest.lift).toBeGreaterThan(0);
  });
});

describe('paint', () => {
  /** A store that says which pictures it was asked for in a paint scheme: such a picture is named with its scheme after it. */
  const painting: SpriteStore = {
    get: (id, fallback) => ({ ...(MANIFEST[id] ?? fallback), image: { id } as unknown as CanvasImageSource }),
    painted: (id, paint, fallback) => ({ ...(MANIFEST[id] ?? fallback), image: { id: `${id}|${paint}` } as unknown as CanvasImageSource }),
  };
  const drawnBy = (enemies: string[], paint?: string): string[] => {
    const flow = new BattleFlow(createBattle(DEMO_BUILD, enemies.map((id) => ENEMIES[id]), CATALOG, 7), CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, painting, CATALOG, { fast: true, background: 'bg-neon-district', ...(paint ? { paint } : {}) });
    screen.update(16);
    return record((ctx) => screen.draw(ctx)).images.map(idOf);
  };

  test('the pilot\'s mech wears its paint from behind too: every layer of its frame, and nothing it carries', () => {
    const ids = drawnBy(['gun-turret'], 'crimson');
    for (const layer of ['head-scout-mk1.back', 'core-hauler.back', 'legs-strider.back', 'arms-rigger.near.back', 'arms-rigger.far.back']) {
      expect(ids, layer).toContain(`${layer}|crimson`);
      expect(ids, layer).not.toContain(layer);
    }
    for (const weapon of ['rightHand', 'leftHand', 'shoulder'] as const) expect(ids).toContain(`${DEMO_BUILD[weapon]}.back`);
    // Without a scheme it is in its factory colours.
    expect(drawnBy(['gun-turret']).some((id) => id.includes('|'))).toBe(false);
  });

  test('a mech that is fought alone wears the paint its pilot gave it, small as it stands', () => {
    expect(ENEMIES.bulldozer).toMatchObject({ composed: true, paint: 'steel' });
    const ids = drawnBy(['bulldozer']);
    const small = ids.filter((id) => id.includes('.small'));
    expect(small.length).toBeGreaterThanOrEqual(5);
    for (const layer of ['head', 'core', 'legs'] as const) expect(small, layer).toContain(`${ENEMIES.bulldozer.build[layer]}.small|steel`);
    expect(small).toContain(`${ENEMIES.bulldozer.build.arms}.near.small|steel`);
    // What it carries keeps its own colours; the pilot's own mech, which has no scheme here, is not painted by it.
    expect(small.filter((id) => /^(wpn|shd)-/.test(id)).every((id) => !id.includes('|'))).toBe(true);
    expect(ids.filter((id) => id.includes('.back')).every((id) => !id.includes('|'))).toBe(true);
  });
});

describe('what is written over the field', () => {
  test('the line for a new pilot is near the top of the field: the foot of it is where the pilot\'s mech stands', () => {
    const { page } = screenOf(['gun-turret'], { coach: true });
    const drawn = page();
    const line = drawn.texts.find((t) => t.text === STRINGS.coach.action)!;
    expect(line).toBeDefined();
    expect(line.y).toBeGreaterThanOrEqual(FIELD_Y + 12);
    expect(line.y + 10).toBeLessThanOrEqual(HERO.y - 5);
    // Its strip is behind it, and neither is over what stands at the foot of the field.
    const strip = drawn.rects.find((r) => r.y === line.y - 1 && r.h === 11)!;
    expect(strip).toBeDefined();
    expect(strip.y + strip.h).toBeLessThan(horizonOf(placeFor('bg-neon-district')));
  });
});
