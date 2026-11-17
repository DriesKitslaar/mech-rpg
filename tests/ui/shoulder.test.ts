import { createBattle, type BattleState } from '../../src/core/battle';
import type { Build, FrameSlot } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';
import { STRINGS } from '../../src/content/strings';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen, INTRO_MS } from '../../src/ui/battleScreen';
import { BACK_BOX, VIEWS, layoutMech } from '../../src/ui/mechLayout';
import { mechSprites } from '../../src/ui/mechView';
import type { Sprite, SpriteStore } from '../../src/ui/sprites';
import {
  BARS_H, ENEMY_LEFT, FIELD_Y, FLYERS, FLY_LIFT, HERO, HERO_FEET, PANEL_Y, PLACES, SMALL_GROUND, SMALL_MIDDLE, duelAt, enemySpots, farToNear, horizonOf,
  pictureTop, placeBars, placeFor, standAt,
} from '../../src/ui/stage';
import { COLORS } from '../../src/ui/widgets';
import { onStage, record, type Drawn, type Glowed, type Pictured } from '../helpers/canvas';

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

function screenOf(enemies: string[], opts: { build?: Build; background?: string; fast?: boolean; coach?: boolean } = {}) {
  const state: BattleState = createBattle(opts.build ?? DEMO_BUILD, enemies.map((id) => ENEMIES[id]), CATALOG, 7);
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

  test('lands on the pilot\'s mech where that part of it is drawn: the head, the body, the near arm, the legs', () => {
    const { screen, page } = screenOf(['gun-turret']);
    const own = ownOf(page());
    const layer: Record<FrameSlot, string> = { head: 'head-scout-mk1.back', core: 'core-hauler.back', arms: 'arms-rigger.near.back', legs: 'legs-strider.back' };
    for (const part of ['head', 'core', 'arms', 'legs'] as FrameSlot[]) {
      const drawn = own.find((image) => idOf(image) === layer[part])!;
      const hit = screen.motion.at.hit('player', part);
      expect(hit.x >= drawn.x && hit.x <= drawn.x + drawn.w && hit.y >= drawn.y && hit.y <= drawn.y + drawn.h, `${part} at ${hit.x},${hit.y}`).toBe(true);
    }
    // Its middle is on its body, and the floor under it is the line its feet are on.
    const core = own.find((image) => idOf(image) === layer.core)!;
    const middle = screen.motion.at.centre('player');
    expect(middle.x).toBeGreaterThanOrEqual(core.x);
    expect(middle.x).toBeLessThanOrEqual(core.x + core.w);
    expect(screen.motion.at.floor('player')).toBe(HERO_FEET - 2);
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
    for (const weapon of ['rightHand', 'leftHand', 'shoulder'] as const) {
      const from = screen.motion.at.muzzle('enemy-0', weapon);
      // Inside its box, turned round: what lies at x in the box is at box.right - x on the screen.
      expect(from.x, weapon).toBeLessThan(box.right);
      expect(from.x, weapon).toBeGreaterThan(ENEMY_LEFT);
      // A hand that holds nothing fires from the fist; one that holds something, from further towards the pilot than the fist.
      const fist = weapon === 'rightHand' ? VIEWS.small.nearFist : weapon === 'leftHand' ? VIEWS.small.farFist : VIEWS.small.mount;
      if (parts[weapon]) expect(from.x, weapon).toBeLessThan(box.right - fist.x);
      else expect(from.x, weapon).toBe(box.right - fist.x);
      expect(from.y, weapon).toBeGreaterThan(box.top);
      expect(from.y, weapon).toBeLessThan(spot.y);
    }
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
