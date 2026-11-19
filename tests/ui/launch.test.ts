import { computeBuildStats } from '../../src/core/build';
import { completeMission } from '../../src/core/campaign';
import { type GameState } from '../../src/core/game';
import { launchRumble } from '../../src/core/launch';
import type { Build } from '../../src/core/types';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { WORLD } from '../../src/content/codex';
import { setLanguage } from '../../src/content/language';
import { MISSIONS } from '../../src/content/missions';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { CATALOG } from '../../src/content/parts';
import { SCENES } from '../../src/content/scenes';
import { STRINGS } from '../../src/content/strings';
import { SOUNDS, type SoundName } from '../../src/platform/audio';
import { SHUTTER_MS, type App } from '../../src/ui/app';
import { INTRO_MS } from '../../src/ui/battleScreen';
import { LOGICAL_H, LOGICAL_W } from '../../src/ui/display';
import {
  LAMPS_AT, LAUNCH_BODY, LAUNCH_BOOSTERS, LAUNCH_EXIT, LAUNCH_FAR, LAUNCH_FEET, LAUNCH_GLOW_MS, LAUNCH_GO_MS, LAUNCH_LAMPS, LAUNCH_LINES, LAUNCH_LINES_CALM,
  LAUNCH_MS, LAUNCH_PICTURE, LAUNCH_READY_MS, LAUNCH_VEIL, LAUNCH_WORD_MS, LaunchScene, drawLaunchVeil, launchBloom, launchFeet, launchScale, launchShare,
  type LaunchOpts,
} from '../../src/ui/launch';
import { drawMech, mechSprites } from '../../src/ui/mechView';
import { idlePose } from '../../src/ui/pose';
import { canWrite } from '../../src/ui/signType';
import type { SpriteStore } from '../../src/ui/sprites';
import { COLORS } from '../../src/ui/widgets';
import { done, inHub, press, select, snap, strong } from '../helpers/app';
import { wearing } from '../helpers/builds';
import { overlap, record, signIn, type Drawn } from '../helpers/canvas';

/**
 * The launch a contract flown from the hangar opens with: the scene itself, and how the contract's
 * screen holds the battle still under it.
 */

afterEach(() => setLanguage('en'));

/** A store that names what it hands out, so that a picture drawn can be told from another. */
const named: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h, ox: fallback.ox, oy: fallback.oy }) };
const idOf = (image: unknown): string => (image as { id?: string }).id ?? '';
const BUILD = ARCHETYPE_BUILDS.marksman.late;

interface Heard { sounds: SoundName[]; rumbles: number[] }
function scene(extra: Partial<LaunchOpts> = {}, build: Build = BUILD, paint?: string): { scene: LaunchScene; heard: Heard } {
  const heard: Heard = { sounds: [], rumbles: [] };
  const made = new LaunchScene(named, build, paint, {
    calm: false, sfx: { play: (name) => { heard.sounds.push(name); } }, rumble: (ms) => { heard.rumbles.push(ms); }, rumbleMs: 90,
    callsign: 'VANTA', kind: 'SHARPSHOOTER', bay: 'CATAPULT', go: 'LAUNCH', ...extra,
  });
  return { scene: made, heard };
}
/** The scene this far in, reached a frame at a time. */
function at(ms: number, extra: Partial<LaunchOpts> = {}, build: Build = BUILD): { scene: LaunchScene; heard: Heard } {
  const made = scene(extra, build);
  for (let now = 0; now < ms; now += 16) made.scene.update(Math.min(16, ms - now));
  return made;
}
const shown = (made: LaunchScene): Drawn => record((ctx) => made.draw(ctx));
/** The pictures of the machine that were drawn: everything that is not the tunnel. */
const machine = (drawn: Drawn) => drawn.images.filter((image) => idOf(image.image) !== LAUNCH_PICTURE);
/** The lines of light: runs of single pixels in one of their two colours. */
const lines = (drawn: Drawn) => drawn.rects.filter((r) => r.w === 1 && r.h === 1 && (r.color === '#ffd27a' || r.color === '#8fe6ff'));
/** What lies over the whole picture: the veil the picture goes to. */
const veils = (drawn: Drawn) => drawn.rects.filter((r) => r.x === 0 && r.y === 0 && r.w === LOGICAL_W && r.h === LOGICAL_H && r.alpha < 1);

describe('the times of it', () => {
  test('about a second and a half: seven tenths on the catapult, eight to go, and a fifth of light after', () => {
    expect([LAUNCH_READY_MS, LAUNCH_GO_MS, LAUNCH_MS, LAUNCH_GLOW_MS]).toEqual([700, 800, 1500, 200]);
    expect(LAMPS_AT).toEqual([140, 330, 520]);
    // Every lamp is on before the catapult fires, and the word is gone before the machine is.
    expect(Math.max(...LAMPS_AT)).toBeLessThan(LAUNCH_READY_MS);
    expect(LAUNCH_WORD_MS).toBeLessThan(LAUNCH_GO_MS);
  });

  test('the machine goes from where it stands to the foot of the opening, smaller as it goes and faster', () => {
    expect([launchShare(0), launchShare(699), launchShare(700), launchShare(1100), launchShare(1500), launchShare(9000)]).toEqual([0, 0, 0, 0.5, 1, 1]);
    expect(launchScale(0)).toBe(1);
    expect(launchScale(1)).toBeCloseTo(1 / LAUNCH_FAR, 10);
    expect(LAUNCH_FAR).toBe(15);
    expect(launchFeet(0)).toEqual(LAUNCH_FEET);
    expect(launchFeet(1)).toEqual({ x: LAUNCH_EXIT.x, y: LAUNCH_EXIT.y + 4 });
    // On the rail all the way: straight up the middle, never back.
    let last = launchFeet(0);
    for (let i = 1; i <= 50; i++) {
      const now = launchFeet(i / 50);
      expect(now.x).toBe(LAUNCH_FEET.x);
      expect(now.y).toBeLessThanOrEqual(last.y);
      expect(launchScale(i / 50)).toBeLessThan(launchScale((i - 1) / 50));
      last = now;
    }
    // It gathers speed: less ground in the first tenth of the time than in the second.
    expect(launchFeet(0).y - launchFeet(0.1).y).toBeLessThan(launchFeet(0.1).y - launchFeet(0.2).y);
  });

  test('the light at the opening takes nothing of the picture until the machine is past halfway, and all of it at the end', () => {
    expect([launchBloom(0), launchBloom(0.3), launchBloom(0.55)]).toEqual([0, 0, 0]);
    expect(launchBloom(0.8)).toBeGreaterThan(0);
    expect(launchBloom(0.8)).toBeLessThan(0.5);
    expect(launchBloom(1)).toBe(1);
    for (let i = 0; i < 50; i++) expect(launchBloom((i + 1) / 50)).toBeGreaterThanOrEqual(launchBloom(i / 50));
  });
});

describe('the scene', () => {
  test('the lamps come on one after another, each heard once; then the catapult is heard and felt, once', () => {
    const made = scene();
    const lamps = (): number => made.scene.view().lamps;
    made.scene.update(139);
    expect([lamps(), made.heard.sounds]).toEqual([0, []]);
    made.scene.update(1);
    expect([lamps(), made.heard.sounds]).toEqual([1, ['lamp']]);
    made.scene.update(189);
    expect(lamps()).toBe(1);
    made.scene.update(1);
    expect([lamps(), made.heard.sounds]).toEqual([2, ['lamp', 'lamp']]);
    made.scene.update(190);
    expect([lamps(), made.heard.sounds, made.scene.view().stage]).toEqual([3, ['lamp', 'lamp', 'lamp'], 'ready']);
    expect(made.heard.rumbles).toEqual([]);
    made.scene.update(179);
    expect(made.scene.view()).toEqual({ ms: 699, stage: 'ready', lamps: 3 });
    made.scene.update(1);
    expect(made.scene.view()).toEqual({ ms: 700, stage: 'go', lamps: 3 });
    expect(made.heard).toEqual({ sounds: ['lamp', 'lamp', 'lamp', 'catapult'], rumbles: [90] });
    // Nothing more is heard or felt while it goes, and then it is over.
    for (let i = 0; i < 49; i++) made.scene.update(16);
    expect(made.scene.done).toBe(false);
    made.scene.update(16);
    expect([made.scene.done, made.scene.view().ms]).toEqual([true, LAUNCH_MS]);
    made.scene.update(500);
    expect(made.heard).toEqual({ sounds: ['lamp', 'lamp', 'lamp', 'catapult'], rumbles: [90] });
  });

  test('a long frame misses nothing: everything due in it is heard, once', () => {
    const made = scene();
    made.scene.update(5000);
    expect(made.heard).toEqual({ sounds: ['lamp', 'lamp', 'lamp', 'catapult'], rumbles: [90] });
    expect(made.scene.done).toBe(true);
    // Time does not run backwards for it.
    const still = scene();
    still.scene.update(-50);
    expect(still.scene.view().ms).toBe(0);
  });

  test('the tunnel fills the screen, and the machine stands on its rail from behind: the build that is flown, in its paint, its body over the middle of the rail', () => {
    const drawn = shown(at(100).scene);
    const [tunnel] = drawn.images;
    expect(idOf(tunnel.image)).toBe(LAUNCH_PICTURE);
    expect(tunnel).toMatchObject({ x: 0, y: 0, w: LOGICAL_W, h: LOGICAL_H });
    const layers = machine(drawn).map((image) => idOf(image.image));
    // From behind: every layer of it is the back view's.
    expect(layers.length).toBeGreaterThanOrEqual(6);
    for (const id of layers) expect(id, id).toMatch(/\.back$/);
    for (const part of [BUILD.head, BUILD.core, BUILD.legs]) expect(layers).toContain(`${part}.back`);
    expect(layers).toContain(`${BUILD.rightHand}.back`);
    // The box it is drawn in has the middle of the body over the middle of the rail and the feet on it (a breath of sway apart).
    const core = machine(drawn).find((image) => idOf(image.image) === `${BUILD.core}.back`)!;
    expect(Math.abs(core.x - (LAUNCH_FEET.x - LAUNCH_BODY.x + 0))).toBeLessThanOrEqual(80);
    for (const image of machine(drawn)) {
      expect(image.y + image.h, idOf(image.image)).toBeLessThanOrEqual(LAUNCH_FEET.y + 6);
      expect(image.x, idOf(image.image)).toBeGreaterThanOrEqual(LAUNCH_FEET.x - LAUNCH_BODY.x - 4);
    }
    // And in the paint the pilot wears: the store is asked for it by name.
    const asked: string[] = [];
    const painting: SpriteStore = { ...named, painted: (id, paint, fallback) => { asked.push(`${id}@${paint}`); return named.get(id, fallback); } };
    new LaunchScene(painting, BUILD, 'crimson', { calm: false, rumble: () => {}, rumbleMs: 60, callsign: '', kind: 'X', bay: 'Y', go: 'Z' });
    expect(asked).toContain(`${BUILD.core}.back@crimson`);
    expect(asked.every((entry) => entry.endsWith('@crimson'))).toBe(true);
  });

  test('it is laid out as the field lays out the pilot\'s machine from behind: the same layers in the same places, one over another the same way', () => {
    const parts = mechSprites(named, BUILD, undefined, 'back');
    for (const ms of [100, 400]) {
      const field = record((ctx) => drawMech(ctx, parts, LAUNCH_FEET.x - LAUNCH_BODY.x, LAUNCH_FEET.y - LAUNCH_BODY.y, { dx: 0, dy: 0 }, 0, idlePose(ms), 'back'));
      const here = machine(shown(at(ms).scene));
      const laid = (images: Drawn['images']) => images.map((image) => [idOf(image.image), image.x, image.y, image.w, image.h]);
      expect(laid(here), `at ${ms}`).toEqual(laid(field.images));
    }
    // (Laid out as from the front, the same layers would stand elsewhere: the test is not blind to it.)
    const front = record((ctx) => drawMech(ctx, parts, LAUNCH_FEET.x - LAUNCH_BODY.x, LAUNCH_FEET.y - LAUNCH_BODY.y, { dx: 0, dy: 0 }, 0, idlePose(100), 'front'));
    expect(front.images.map((image) => [idOf(image.image), image.x, image.y])).not.toEqual(machine(shown(at(100).scene)).map((image) => [idOf(image.image), image.x, image.y]));
  });

  test('a machine with an empty hand or no shoulder weapon is drawn with what it has', () => {
    const bare: Build = { ...BUILD, leftHand: undefined, shoulder: undefined };
    const drawn = shown(at(100, {}, bare).scene);
    const layers = machine(drawn).map((image) => idOf(image.image));
    expect(layers).toContain(`${bare.core}.back`);
    expect(layers.some((id) => id.includes('undefined'))).toBe(false);
  });

  test('the lamps hang over the rail, dark until their moment, then each in its colour', () => {
    const { y, gap, colors } = LAUNCH_LAMPS;
    expect(colors).toEqual([COLORS.danger, COLORS.heat, '#62e27f']);
    // (A lamp is a disc drawn in rows: its widest row is at its middle.)
    const lampColors = (drawn: Drawn): string[] => [-1, 0, 1].map((i) => drawn.rects.find((r) => r.y === y && r.x <= LAUNCH_EXIT.x + i * gap && r.x + r.w > LAUNCH_EXIT.x + i * gap && r.h === 1)!.color);
    expect(lampColors(shown(at(100).scene))).toEqual([COLORS.empty, COLORS.empty, COLORS.empty]);
    expect(lampColors(shown(at(200).scene))).toEqual([colors[0], COLORS.empty, COLORS.empty]);
    expect(lampColors(shown(at(400).scene))).toEqual([colors[0], colors[1], COLORS.empty]);
    expect(lampColors(shown(at(600).scene))).toEqual([...colors]);
    expect(lampColors(shown(at(1200).scene))).toEqual([...colors]);
    // A lamp that is on has its light round it; one that is not has none.
    const lights = (drawn: Drawn) => drawn.glows.filter((g) => g.y === y && g.r === 12);
    expect(lights(shown(at(100).scene))).toHaveLength(0);
    expect(lights(shown(at(400).scene)).map((g) => g.x)).toEqual([LAUNCH_EXIT.x - gap, LAUNCH_EXIT.x]);
  });

  test('who is going, in what, and from where are written in the corners, and run into nothing', () => {
    const drawn = shown(at(300).scene);
    const texts = Object.fromEntries(drawn.texts.map((t) => [t.text, t]));
    expect(texts.VANTA).toMatchObject({ left: 10, y: 18, color: COLORS.text });
    expect(texts.SHARPSHOOTER).toMatchObject({ left: 10, y: 30, size: 10, color: COLORS.armor });
    expect(texts.CATAPULT).toMatchObject({ right: LOGICAL_W - 10, y: 18, size: 10, color: COLORS.dim });
    expect(drawn.texts).toHaveLength(3);
    for (const a of drawn.texts) for (const b of drawn.texts) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
    // A pilot with no callsign has the class where the name would be.
    const nameless = shown(at(300, { callsign: '' }).scene);
    expect(nameless.texts.map((t) => [t.text, t.y])).toEqual([['SHARPSHOOTER', 18], ['CATAPULT', 18]]);
    // The longest class there is, in either language, stays clear of the lamps' housing.
    for (const names of [STRINGS.classes.names, STRINGS_NL.classes.names]) {
      for (const name of Object.values(names)) {
        const long = shown(at(300, { kind: name.toUpperCase() }).scene);
        expect(long.texts.find((t) => t.text === name.toUpperCase())!.right, name).toBeLessThan(LAUNCH_EXIT.x - LAUNCH_LAMPS.gap - 7);
      }
    }
  });

  test('while it stands nothing runs and nothing burns; as the catapult fires the lines of light run out of the opening and its boosters are lit', () => {
    const before = shown(at(690).scene);
    expect(lines(before)).toHaveLength(0);
    expect(before.rects.filter((r) => r.color === '#ffffff')).toHaveLength(0);
    const going = shown(at(900).scene);
    // Fourteen lines, each a run of pixels going away from the opening.
    const runs = lines(going);
    expect(runs.length).toBeGreaterThan(LAUNCH_LINES * 8);
    const far = (r: { x: number; y: number }): number => Math.hypot(r.x - LAUNCH_EXIT.x, r.y - LAUNCH_EXIT.y);
    for (const r of runs) expect(far(r)).toBeGreaterThanOrEqual(12);
    // Two flames, whitest at the nozzle, one on each side of the middle of its back, with a light round each.
    const flames = going.rects.filter((r) => r.color === '#ffffff' && r.alpha === 1);
    expect(flames).toHaveLength(2);
    const feet = launchFeet(launchShare(900));
    const scale = launchScale(launchShare(900));
    expect(flames.map((r) => Math.sign(r.x + r.w / 2 - feet.x))).toEqual([-1, 1]);
    for (const flame of flames) expect(flame.y).toBe(feet.y - Math.round(LAUNCH_BOOSTERS.up * scale));
    expect(going.glows.filter((g) => g.y === feet.y - Math.round(LAUNCH_BOOSTERS.up * scale))).toHaveLength(2);
    // They lie over the machine: drawn after its last layer.
    const lastLayer = Math.max(...going.order.map((step, i) => (step.kind === 'image' ? i : -1)));
    const firstFlame = going.order.findIndex((step) => step.kind === 'rect' && going.rects[step.at] === flames[0]);
    expect(firstFlame).toBeGreaterThan(lastLayer);
  });

  test('as it goes the machine is drawn smaller and further up the rail, and the picture shakes less and less', () => {
    const boxOf = (ms: number) => {
      const core = machine(shown(at(ms).scene)).find((image) => idOf(image.image) === `${BUILD.core}.back`)!;
      return { w: core.w, bottom: core.y + core.h };
    };
    const [standing, early, late] = [boxOf(600), boxOf(900), boxOf(1300)];
    expect(early.w).toBeLessThan(standing.w);
    expect(late.w).toBeLessThan(early.w / 2);
    expect(early.bottom).toBeLessThan(standing.bottom);
    expect(late.bottom).toBeLessThan(early.bottom);
    expect(late.bottom).toBeLessThan(LAUNCH_EXIT.y + 30);
    // The tunnel is thrown a pixel or two to the side at first and stands again at the end; it never moves up or down.
    const tunnelX = (ms: number): number => shown(at(ms).scene).images[0].x;
    const thrown = Array.from({ length: 50 }, (_, i) => tunnelX(700 + i * 16));
    expect(Math.max(...thrown.map(Math.abs))).toBe(2);
    expect(Math.max(...thrown.slice(40).map(Math.abs))).toBeLessThanOrEqual(1);
    expect(tunnelX(600)).toBe(0);
    for (let ms = 700; ms < 1500; ms += 80) expect(shown(at(ms).scene).images[0].y).toBe(0);
  });

  test('the word stands across the picture as the catapult fires, in the logo\'s letters, and is gone before the machine is', () => {
    const word = (ms: number, text = 'LAUNCH', extra: Partial<LaunchOpts> = {}) => signIn(shown(at(ms, { go: text, ...extra }).scene), text, 'amber');
    expect(word(690)).toBeNull();
    for (const text of [STRINGS.catapult.go, STRINGS_NL.catapult.go]) {
      const up = word(1050, text)!;
      expect(up, text).not.toBeNull();
      // Across the middle, between the lamps and the opening, and fully lit by then.
      expect(up.x + up.w / 2).toBeCloseTo(LOGICAL_W / 2, 0);
      expect(up.x).toBeGreaterThanOrEqual(30);
      expect(up.x + up.w).toBeLessThanOrEqual(LOGICAL_W - 30);
      expect(up.y).toBeGreaterThan(LAUNCH_LAMPS.y + 8);
      expect(up.y + up.h).toBeLessThan(LAUNCH_EXIT.y);
      expect(up.level).toBe(1);
    }
    // It comes on as a sign does, with a strike and a flicker; a calm picture has it simply on.
    expect(word(700 + 30)!.level).toBe(0);
    expect(word(700 + 30, 'LAUNCH', { calm: true })!.level).toBe(1);
    expect(word(700 + LAUNCH_WORD_MS - 16)).not.toBeNull();
    expect(word(700 + LAUNCH_WORD_MS + 16)).toBeNull();
    // Both languages' words are ones the sign can write.
    for (const text of [STRINGS.catapult.go, STRINGS_NL.catapult.go]) expect(canWrite(text), text).toBe(true);
    // A word it cannot write is written in the font, in the same place.
    expect(canWrite('go~')).toBe(false);
    const plain = shown(at(900, { go: 'go~' }).scene);
    expect(plain.texts.find((t) => t.text === 'go~')).toMatchObject({ x: LOGICAL_W / 2, align: 'center', size: 16 });
    expect(shown(at(700 + LAUNCH_WORD_MS + 16, { go: 'go~' }).scene).texts.some((t) => t.text === 'go~')).toBe(false);
  });

  test('the light at the opening takes the picture: white over all of it at the end, and nothing over it before the machine is past halfway', () => {
    expect(veils(shown(at(1100).scene))).toHaveLength(0);
    const [late] = veils(shown(at(1400).scene));
    expect(late.color).toBe(LAUNCH_VEIL.light);
    expect(late.alpha).toBeGreaterThan(0.4);
    expect(late.alpha).toBeLessThan(1);
    const end = shown(at(LAUNCH_MS).scene);
    const whole = end.rects.filter((r) => r.x === 0 && r.y === 0 && r.w === LOGICAL_W && r.h === LOGICAL_H && r.color === LAUNCH_VEIL.light);
    expect(whole).toHaveLength(1);
    expect(whole[0].alpha).toBeCloseTo(1, 10);
    // And a light grows out of the opening itself as it does.
    const bloom = (ms: number) => shown(at(ms).scene).glows.filter((g) => g.x === LAUNCH_EXIT.x && g.y === LAUNCH_EXIT.y);
    expect(bloom(1100)).toHaveLength(0);
    expect(bloom(1300)[0].r).toBeLessThan(bloom(1450)[0].r);
  });

  test('in a calm picture nothing shakes, the lines are few and stand still, the flames burn steadily, and the picture goes to dark', () => {
    const calm = { calm: true };
    for (let ms = 700; ms < 1500; ms += 16) expect(shown(at(ms, calm).scene).images[0].x).toBe(0);
    const [a, b] = [lines(shown(at(900, calm).scene)), lines(shown(at(1000, calm).scene))];
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThan(lines(shown(at(900).scene)).length);
    expect(a.map((r) => [r.x, r.y])).toEqual(b.map((r) => [r.x, r.y]));
    expect(LAUNCH_LINES_CALM).toBeLessThan(LAUNCH_LINES);
    // The flames are as long at one moment as at the next, where the picture's own are not.
    const flame = (ms: number, extra: Partial<LaunchOpts>) => shown(at(ms, extra).scene).rects.filter((r) => r.color === '#ffffff' && r.alpha === 1 && r.w < 20)[0].h;
    const shareOf = (ms: number): number => launchScale(launchShare(ms));
    expect(flame(720, calm) / shareOf(720)).toBeCloseTo(flame(736, calm) / shareOf(736), 0);
    // No white, and no light out of the opening: the dark takes the picture.
    const end = shown(at(1400, calm).scene);
    expect(veils(end).map((r) => r.color)).toEqual([LAUNCH_VEIL.calm]);
    expect(end.glows.filter((g) => g.x === LAUNCH_EXIT.x && g.y === LAUNCH_EXIT.y)).toHaveLength(0);
    expect(shown(at(LAUNCH_MS, calm).scene).rects.some((r) => r.color === LAUNCH_VEIL.light && r.w === LOGICAL_W)).toBe(false);
  });

  test('the veil the picture goes to is laid over all of it as strongly as asked, and not at all for nothing', () => {
    const veil = (strength: number, calm: boolean) => record((ctx) => drawLaunchVeil(ctx, strength, calm)).rects;
    expect(veil(0, false)).toEqual([]);
    expect(veil(-1, true)).toEqual([]);
    expect(veil(0.5, false)).toMatchObject([{ x: 0, y: 0, w: LOGICAL_W, h: LOGICAL_H, color: '#ffffff', alpha: 0.5 }]);
    expect(veil(0.25, true)).toMatchObject([{ color: '#07061a', alpha: 0.25 }]);
    expect(veil(7, false)).toMatchObject([{ alpha: 1 }]);
    // It leaves the canvas as it found it.
    const after = record((ctx) => { drawLaunchVeil(ctx, 0.5, false); ctx.fillStyle = '#123456'; ctx.fillRect(1, 1, 1, 1); }).rects;
    expect(after[1]).toMatchObject({ color: '#123456', alpha: 1 });
  });

  test('its two sounds are sounds the game has: a lamp is short, the catapult lasts about as long as the going', () => {
    const long = (name: SoundName): number => Math.max(...SOUNDS[name].map((tone) => tone.start + tone.dur));
    expect(long('lamp')).toBeLessThan(0.1);
    expect(long('catapult')).toBeGreaterThan(0.5);
    expect(long('catapult')).toBeLessThanOrEqual(LAUNCH_GO_MS / 1000);
    // The lamps do not run into one another.
    for (let i = 1; i < LAMPS_AT.length; i++) expect((LAMPS_AT[i] - LAMPS_AT[i - 1]) / 1000).toBeGreaterThan(long('lamp'));
  });
});

// ---- Through the app: the contract's screen holds the battle still under the launch.

type Launch = { ms: number; stage: string; lamps: number } | null;
const launchOf = (app: App): Launch => (snap(app) as unknown as { launch: Launch }).launch;
const phase = (app: App): string => snap(app).battle!.phase;
const banner = (app: App): boolean => (snap(app).battle as unknown as { banner: boolean }).banner;
const spoken = (app: App): string | null => (snap(app).battle as unknown as { spoken: string | null }).spoken;
const pilot = (extra: Partial<GameState> = {}): GameState => ({
  ...strong(done('intro-1', 'intro-2', 'hadron-1')), callsign: 'VANTA', lessons: ['momentum', 'rout', 'swarm'],
  // Every page of story read: an unhurried game holds each for a moment, and these tests are not about them.
  scenes: SCENES.map((entry) => entry.id), codex: WORLD.map((entry) => entry.id), ...extra,
});
/** An app that is not hurried, in the hangar, and what it rumbled and played. */
function unhurried(saved: GameState, deps: Parameters<typeof inHub>[2] = {}) {
  const buzz: number[] = [];
  const made = inHub(saved, 5, { fast: false, vibrate: (ms: number) => { buzz.push(ms); }, ...deps });
  return { ...made, buzz };
}
/** Into a contract from the hangar's list: the doors are let open, so that what is pressed is taken. */
function fly(app: App, id: string): void {
  select(app, 'contracts');
  select(app, id);
  app.update(400);
  select(app, 'accept');
}

describe('a contract opens with it', () => {
  test('the battle is the screen and has not begun: it is in no phase of its own, its banner has not started, and nothing of it moves', () => {
    const { app } = unhurried(pilot());
    fly(app, 'patrol');
    expect(snap(app).screen).toBe('battle');
    expect(launchOf(app)).toEqual({ ms: 0, stage: 'ready', lamps: 0 });
    expect(phase(app)).toBe('launch');
    const before = snap(app).battle!;
    for (let i = 0; i < 80; i++) app.update(16);
    expect(launchOf(app)).toMatchObject({ stage: 'go', lamps: 3 });
    const during = snap(app).battle!;
    expect(during).toEqual(before);
    // What is drawn is the tunnel and nothing of the field: no word of the battle's is on the screen.
    const drawn = record((ctx) => app.draw(ctx));
    expect(drawn.texts.map((t) => t.text)).toEqual(expect.arrayContaining(['VANTA', STRINGS.catapult.bay]));
    expect(drawn.texts.some((t) => t.text === STRINGS.battleIntro.destroy || t.text === STRINGS.battleIntro.open)).toBe(false);
  });

  test('when the machine has gone the battle begins with its banner, under what is left of the light', () => {
    const { app } = unhurried(pilot());
    fly(app, 'patrol');
    for (let ms = 0; ms < LAUNCH_MS; ms += 16) app.update(16);
    // (The frame the launch ends in is not also a frame of the battle.)
    expect(launchOf(app)).toBeNull();
    expect(phase(app)).not.toBe('launch');
    expect(banner(app)).toBe(true);
    const veil = (): number => record((ctx) => app.draw(ctx)).rects.filter((r) => r.w === LOGICAL_W && r.h === LOGICAL_H && r.color === LAUNCH_VEIL.light).reduce((sum, r) => sum + r.alpha, 0);
    expect(veil()).toBe(1);
    app.update(100);
    expect(veil()).toBeCloseTo(0.5, 5);
    app.update(100);
    expect(veil()).toBe(0);
    // The banner lasts as long as it ever did, counted from when the launch ended.
    for (let ms = 200; ms < INTRO_MS - 16; ms += 16) app.update(16);
    expect(banner(app)).toBe(true);
    app.update(32);
    expect(banner(app)).toBe(false);
  });

  test('A or B cuts it short and does nothing else: the banner is still to come, no light lies over it, and no row was picked', () => {
    for (const action of ['confirm', 'cancel'] as const) {
      const { app } = unhurried(pilot());
      fly(app, 'patrol');
      for (let i = 0; i < 20; i++) app.update(16);
      const cursor = snap(app).menu.cursor;
      press(app, action);
      // At once, before another frame: the battle is there as it was made, and nothing of it has been pressed.
      expect(launchOf(app)).toBeNull();
      expect(phase(app)).not.toBe('launch');
      expect(banner(app)).toBe(true);
      expect(snap(app).menu.cursor).toBe(cursor);
      expect(snap(app).screen).toBe('battle');
      expect((snap(app).battle as unknown as { round: number }).round).toBe(1);
      expect(record((ctx) => app.draw(ctx)).rects.some((r) => r.w === LOGICAL_W && r.h === LOGICAL_H && r.color === LAUNCH_VEIL.light)).toBe(false);
      // The banner then runs its whole time, counted from the press.
      for (let ms = 0; ms < INTRO_MS - 16; ms += 16) app.update(16);
      expect(banner(app)).toBe(true);
      app.update(32);
      expect(banner(app)).toBe(false);
    }
    // The next press is the battle's own: it dismisses the banner, as a press always has.
    const again = unhurried(pilot()).app;
    fly(again, 'patrol');
    for (let i = 0; i < 20; i++) again.update(16);
    press(again, 'confirm');
    expect(banner(again)).toBe(true);
    press(again, 'confirm');
    expect(banner(again)).toBe(false);
    // Any other button is not taken at all: the launch goes on, and nothing under it is pressed.
    const { app } = unhurried(pilot());
    fly(app, 'patrol');
    for (let i = 0; i < 20; i++) app.update(16);
    const before = snap(app);
    press(app, 'down', 'up', 'left', 'right', 'next', 'prev');
    expect(snap(app)).toEqual(before);
    expect(launchOf(app)).toMatchObject({ stage: 'ready' });
  });

  test('it shows the machine that is flown, by its class, and the handheld rumbles as long as that machine weighs', () => {
    for (const kind of ['bastion', 'skirmisher'] as const) {
      const build = ARCHETYPE_BUILDS[kind].late;
      const { app, buzz } = unhurried(wearing(pilot(), build));
      fly(app, 'patrol');
      const drawn = record((ctx) => app.draw(ctx));
      expect(drawn.texts.map((t) => t.text)).toContain(STRINGS.classes.names[kind].toUpperCase());
      for (let ms = 0; ms < 720; ms += 16) app.update(16);
      expect(buzz).toEqual([launchRumble(computeBuildStats(build, CATALOG).weight)]);
    }
    // A player who has turned the rumble off feels nothing.
    const base = pilot();
    const { app, buzz } = unhurried({ ...base, settings: { ...base.settings, rumble: false } });
    fly(app, 'patrol');
    for (let ms = 0; ms < 720; ms += 16) app.update(16);
    expect(buzz).toEqual([]);
  });

  test('a contract that opens with something said is launched like any other: nothing of that is said, held or heard until the battle begins', () => {
    // The ore train's contract: Dispatch speaks as its first battle opens.
    const { app } = unhurried(pilot());
    fly(app, 'hadron-2');
    expect(launchOf(app)).not.toBeNull();
    // Once the doors are open the screen is not holding anything: a press is taken, and it cuts the launch.
    app.update(SHUTTER_MS);
    expect(snap(app).busy).toBe(false);
    // (The line is the battle's first thing to say, and waits: no word of it is on the screen.)
    expect(spoken(app)).toBeTruthy();
    expect(record((ctx) => app.draw(ctx)).texts.some((t) => t.text === 'DISPATCH' || spoken(app)!.startsWith(t.text))).toBe(false);
    for (let ms = SHUTTER_MS; ms < 1000; ms += 16) { app.update(16); expect(snap(app).busy).toBe(false); }
    press(app, 'confirm');
    expect(launchOf(app)).toBeNull();
    expect(banner(app)).toBe(true);
    // The banner runs, and then Dispatch says what there was to say.
    for (let ms = 0; ms < INTRO_MS + 64; ms += 16) app.update(16);
    expect(phase(app)).toBe('talk');
    expect(record((ctx) => app.draw(ctx)).texts.some((t) => t.text === 'DISPATCH')).toBe(true);
  });

  test('it is drawn in the paint the pilot wears, and in a calm picture as a calm picture has it', () => {
    // A store that says what it was asked for in which paint.
    const asked: string[] = [];
    const painting: SpriteStore = { ...named, painted: (id, paint, fallback) => { asked.push(`${id}@${paint}`); return named.get(id, fallback); } };
    const base = pilot({ paint: 'crimson' });
    const { app } = unhurried(base, { sprites: painting });
    asked.length = 0;
    fly(app, 'patrol');
    const back = asked.filter((entry) => entry.includes('.back@'));
    expect(back.length).toBeGreaterThan(3);
    expect(back.every((entry) => entry.endsWith('@crimson'))).toBe(true);
    expect(back).toContain(`${base.build.core}.back@crimson`);

    // Calm: the tunnel never moves, the dark takes the picture, and the battle comes out of the dark.
    const calm = unhurried({ ...base, settings: { ...base.settings, calm: true } }, { sprites: named }).app;
    fly(calm, 'patrol');
    const tunnel = (): number => record((ctx) => calm.draw(ctx)).images.find((image) => idOf(image.image) === LAUNCH_PICTURE)!.x;
    const veil = (): string[] => record((ctx) => calm.draw(ctx)).rects.filter((r) => r.x === 0 && r.y === 0 && r.w === LOGICAL_W && r.h === LOGICAL_H && r.alpha < 1 && r.alpha > 0).map((r) => r.color);
    for (let ms = 0; ms < 1400; ms += 16) { calm.update(16); expect(tunnel()).toBe(0); }
    expect(veil()).toEqual([LAUNCH_VEIL.calm]);
    for (let ms = 1400; ms < LAUNCH_MS + 16; ms += 16) calm.update(16);
    expect(launchOf(calm)).toBeNull();
    calm.update(100);
    expect(veil()).toEqual([LAUNCH_VEIL.calm]);
    // Not calm, the same moments are white, and the tunnel is thrown about on the way.
    const loud = unhurried(base, { sprites: named }).app;
    fly(loud, 'patrol');
    const moved: number[] = [];
    for (let ms = 0; ms < 1400; ms += 16) { loud.update(16); moved.push(record((ctx) => loud.draw(ctx)).images.find((image) => idOf(image.image) === LAUNCH_PICTURE)!.x); }
    expect(Math.max(...moved.map(Math.abs))).toBe(2);
    for (let ms = 1400; ms < LAUNCH_MS + 16; ms += 16) loud.update(16);
    loud.update(100);
    expect(record((ctx) => loud.draw(ctx)).rects.filter((r) => r.w === LOGICAL_W && r.h === LOGICAL_H && r.alpha < 1 && r.alpha > 0).map((r) => r.color)).toEqual([LAUNCH_VEIL.light]);
  });

  test('in Dutch the words are Dutch', () => {
    const base = pilot();
    const { app } = unhurried({ ...base, settings: { ...base.settings, language: 'nl' } });
    fly(app, 'patrol');
    const texts = record((ctx) => app.draw(ctx)).texts.map((t) => t.text);
    expect(texts).toEqual(expect.arrayContaining(['VANTA', 'KATAPULT']));
    expect(texts).not.toContain('CATAPULT');
    expect([STRINGS_NL.catapult.bay, STRINGS_NL.catapult.go]).toEqual(['KATAPULT', 'START']);
  });
});

describe('where there is none', () => {
  test('not in a hurried game: a contract is in its battle at once', () => {
    const { app } = inHub(pilot());
    fly(app, 'patrol');
    expect(launchOf(app)).toBeNull();
    expect(phase(app)).not.toBe('launch');
  });

  test('not for a player who has asked for faster battles', () => {
    const base = pilot();
    const { app } = unhurried({ ...base, settings: { ...base.settings, fastBattles: true } });
    fly(app, 'patrol');
    expect(launchOf(app)).toBeNull();
    expect(phase(app)).not.toBe('launch');
  });

  test('not before a contract\'s second battle: that one follows on the field', () => {
    const { app } = unhurried(pilot());
    const several = MISSIONS.find((mission) => mission.battles.length > 1 && mission.id === 'hadron-2')!;
    expect(several.battles.length).toBeGreaterThan(1);
    fly(app, several.id);
    expect(launchOf(app)).not.toBeNull();
    // Through the launch and the first battle, on Auto Turn, to the result; then on to the next.
    for (let i = 0; i < 60000 && snap(app).battle!.index === 0; i++) {
      const s = snap(app);
      if (s.battle!.phase === 'result') { press(app, 'confirm'); app.update(16); continue; }
      if (s.battle!.phase === 'action') { select(app, 'auto'); app.update(16); continue; }
      if (s.battle!.phase === 'talk') press(app, 'confirm');
      app.update(48);
    }
    expect(snap(app).battle).toMatchObject({ index: 1 });
    expect(launchOf(app)).toBeNull();
    expect(phase(app)).not.toBe('launch');
  });

  test('not in the arena, the simulator or the Gauntlet', () => {
    const base = pilot({ arenaRank: 0 });
    // The arena's first fight.
    const arena = unhurried(completeMission(base, 'hadron-2', MISSIONS)).app;
    select(arena, 'arena');
    arena.update(400);
    press(arena, 'confirm');
    arena.update(400);
    expect(snap(arena).screen).toBe('briefing');
    select(arena, 'accept');
    expect(snap(arena).screen).toBe('battle');
    expect(launchOf(arena)).toBeNull();
    // A drill.
    const training = unhurried(base).app;
    select(training, 'training');
    training.update(400);
    press(training, 'confirm');
    training.update(400);
    expect(snap(training).screen).toBe('briefing');
    select(training, 'accept');
    expect(snap(training).screen).toBe('battle');
    expect(launchOf(training)).toBeNull();
  });
});
