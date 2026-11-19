import { createBattle, type BattleState, type Objective } from '../../src/core/battle';
import { MECH_ENEMIES } from '../../src/core/board';
import { JOB_KINDS, makeJob } from '../../src/core/jobs';
import { BOARD_TEXT } from '../../src/content/board';
import { ENEMIES } from '../../src/content/enemies';
import { DRILLS } from '../../src/content/drills';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { SIDE_WORK } from '../../src/content/sidework';
import SPRITES from '../../src/content/sprites.json';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleFx, DEATH_MS, FAR_SIZE, FREIGHT, HIT_MS, TEXT_MS, WRECK_AT, WRECK_MS, WRECK_SIZE } from '../../src/ui/battleFx';
import { BRIGHT, BattleScreen, FREIGHT_BURNS, PUSH } from '../../src/ui/battleScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import {
  ENEMY_LEFT, FIELD_Y, FREIGHT_X, HERO, PANEL_Y, PLACES, PLAIN, enemySpots, farLine, freightAt, freightSpot, placeFor, standAt,
} from '../../src/ui/stage';
import { COLORS } from '../../src/ui/widgets';
import { record, type Drawn, type Pictured } from '../helpers/canvas';

/**
 * What an escort keeps alive, on the field: where it stands, that it is drawn there and nowhere
 * when it has no picture, and what is seen when it is struck, worn down and lost.
 */

const sheet = SPRITES as Record<string, { w: number; h: number }>;
/** A sprite store that names its pictures and gives each the size the sheet has it at. */
const sprites: SpriteStore = {
  get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: sheet[id]?.w ?? fallback.w, h: sheet[id]?.h ?? fallback.h }),
};
const idOf = (image: Pictured): string => (image.image as { id: string }).id;
const ASSETS = Object.keys(sheet).filter((id) => id.startsWith('asset-'));
const CONVOY: Objective = { type: 'protect', name: 'Convoy', hp: 9, sprite: 'asset-convoy' };
const battle = (objective: Objective | undefined, enemies = ['recon-drone', 'gun-turret', 'recon-drone'], seed = 3): BattleState =>
  createBattle(DEMO_BUILD, enemies.map((id) => ENEMIES[id]), CATALOG, seed, objective ? { objective } : {});

function made(state: BattleState, opts: { fast?: boolean; calm?: boolean; background?: string } = {}) {
  const flow = new BattleFlow(state, CATALOG, { quiet: true });
  /** What was asked to be heard, and how long after it was asked. */
  const heard: [string, number][] = [];
  const sfx = { play: (name: string, delayMs = 0) => { heard.push([name, delayMs]); } } as never;
  /** How long the handheld was asked to rumble, each time it was. */
  const felt: number[] = [];
  const screen = new BattleScreen(flow, sprites, CATALOG, {
    fast: opts.fast ?? false, calm: opts.calm, background: opts.background ?? 'bg-mine', sfx, rumble: (ms) => { felt.push(ms); },
  });
  /** Steps the screen until the pilot may act or the battle is over. */
  const settle = (): void => { for (let i = 0; i < 20000 && (screen.banner || !['action', 'result'].includes(flow.phase)); i++) screen.update(16); };
  const choose = (id: string): void => {
    const at = flow.menu.items.findIndex((item) => item.id === id);
    expect(at, id).toBeGreaterThanOrEqual(0);
    for (let n = flow.menu.cursor; n < at; n++) screen.onInput('down');
    for (let n = flow.menu.cursor; n > at; n--) screen.onInput('up');
    screen.onInput('confirm');
  };
  /** Ends the pilot's turn and steps on, a frame at a time, until the freight is said to have lost something; then `more` milliseconds further. */
  const untilStruck = (more = 0): void => {
    const name = flow.state.asset!.name;
    choose('endTurn');
    for (let i = 0; i < 20000 && !(flow.message ?? '').includes(name) && flow.phase !== 'result'; i++) screen.update(16);
    for (let ms = 0; ms < more; ms += 16) screen.update(16);
  };
  const page = (): Drawn => record((ctx) => screen.draw(ctx));
  const freight = (shown: Drawn): Pictured[] => shown.images.filter((image) => idOf(image).startsWith('asset-'));
  return { flow, screen, settle, choose, untilStruck, page, freight, heard, felt };
}

describe('where it stands', () => {
  test('on the farthest line of the floor, its middle over its spot and its foot on it, in every place', () => {
    expect(FREIGHT_X).toBe(132);
    for (const [id, place] of [...Object.entries(PLACES), ['plain', PLAIN] as const]) {
      const spot = freightSpot(place);
      expect(spot, id).toEqual({ x: 132, y: farLine(place) });
      for (const asset of ASSETS) {
        const size = sheet[asset];
        const at = freightAt(spot, size);
        expect(at).toEqual({ x: Math.round(132 - size.w / 2), y: spot.y - size.h, ground: spot.y });
        // On the field, clear of its top and of the panel, and wholly left of the furthest an enemy's middle ever is to the left.
        expect(at.y, `${asset} in ${id}`).toBeGreaterThanOrEqual(FIELD_Y + 12);
        expect(at.y + size.h).toBeLessThanOrEqual(PANEL_Y - 20);
        expect(at.x).toBeGreaterThanOrEqual(HERO.x + 96);
        expect(at.x + size.w).toBeLessThanOrEqual(164);
      }
    }
  });

  test('in every line-up there can be beside it, no machine\'s box is covered by more than a quarter of the freight, and none of the common size is touched', () => {
    // The sizes machines come in: the common one, and the largest a machine that is one picture can be.
    const common = { w: 64, h: 64 };
    const mech = { w: 104, h: 104 };
    for (const place of [...Object.values(PLACES), PLAIN]) {
      for (const asset of ASSETS) {
        const f = { ...freightAt(freightSpot(place), sheet[asset]), ...sheet[asset] };
        for (const count of [1, 2, 3]) {
          for (const [i, spot] of enemySpots(count, place).entries()) {
            const small = standAt(spot, common);
            expect(Math.max(0, f.x + f.w - small.x), `${asset} beside a common machine at ${i} of ${count}`).toBe(0);
            const large = standAt(spot, mech);
            expect(large.x).toBeGreaterThanOrEqual(ENEMY_LEFT);
            expect(Math.max(0, f.x + f.w - large.x), `${asset} beside a mech at ${i} of ${count}`).toBeLessThanOrEqual(Math.ceil(f.w / 4));
          }
        }
      }
    }
  });

  test('every escort the board and the story field has freight that fits that rule with the machines it is really against', () => {
    // The story's own (the train twice, the stack twice), the favour's convoy twice, and the convoy of the drill.
    const missions = [...new Map([...MISSIONS, ...SIDE_WORK].map((mission) => [mission.id, mission])).values()];
    const story = [
      ...missions.flatMap((mission) => mission.battles.map((b) => ({ id: mission.id, b }))),
      ...DRILLS.map((drill) => ({ id: drill.id, b: drill.battle })),
    ].filter(({ b }) => b.objective?.type === 'protect' && b.objective.sprite);
    const board = Array.from({ length: 120 }, (_, seed) => ({ id: `escort ${seed}`, b: makeJob('escort', 2 + (seed % 7), seed + 1, BOARD_TEXT).battles[0] }));
    expect(story.map(({ id }) => id).sort()).toEqual(['drill-protect', 'favour-sixty', 'favour-sixty', 'hadron-2', 'hadron-2', 'lumen-5', 'lumen-5']);
    for (const { id, b } of [...story, ...board]) {
      const place = placeFor(b.background);
      const sprite = (b.objective as { sprite: string }).sprite;
      const f = { ...freightAt(freightSpot(place), sheet[sprite]), ...sheet[sprite] };
      for (const [i, spot] of enemySpots(b.enemies.length, place).entries()) {
        const picture = ENEMIES[b.enemies[i]].sprite ?? b.enemies[i];
        const box = standAt(spot, sheet[picture] ?? { w: 64, h: 64 });
        const covered = Math.max(0, f.x + f.w - box.x);
        expect(covered, `${id}: ${sprite} and ${b.enemies[i]}`).toBeLessThanOrEqual(MECH_ENEMIES.includes(b.enemies[i]) ? Math.ceil(f.w / 4) : 2);
      }
    }
  });
});

describe('on the field', () => {
  test('it is drawn once, where it stands, before every machine and before the pilot\'s mech, with a shadow under it', () => {
    const m = made(battle(CONVOY));
    m.settle();
    const shown = m.page();
    const size = sheet['asset-convoy'];
    const at = freightAt(freightSpot(placeFor('bg-mine')), size);
    const drawn = m.freight(shown);
    expect(drawn.map((image) => [idOf(image), image.x, image.y, image.w, image.h, image.alpha, image.blend])).toEqual([['asset-convoy', at.x, at.y, size.w, size.h, 1, 'source-over']]);
    expect(m.screen.freight).toEqual({ sprite: 'asset-convoy', x: at.x, y: at.y, w: size.w, h: size.h });
    // Before the first machine and before anything of the pilot's mech: whatever stands nearer stands in front of it.
    const order = shown.images.map(idOf);
    const mine = order.indexOf('asset-convoy');
    const firstEnemy = order.findIndex((id) => id.startsWith('enemy-'));
    const firstOfMech = order.findIndex((id) => /^(legs|core|arms|head|wpn)-/.test(id));
    expect(firstEnemy).toBeGreaterThan(mine);
    expect(firstOfMech).toBeGreaterThan(mine);
    // Its shadow: on the floor under its middle, nine tenths as wide as it is.
    const shadow = shown.glows.filter((glow) => glow.x === at.x + size.w / 2 && Math.abs(glow.y - (at.ground - 1)) < 0.01);
    expect(shadow).toHaveLength(1);
    expect(shadow[0].r).toBeCloseTo((size.w * 0.9) / 2, 0);
  });

  test('freight without a picture, and a battle without freight, are drawn with nothing of it: no picture, no box, no shadow there', () => {
    const plain = made(battle({ type: 'protect', name: 'Hangar', hp: 9 }));
    plain.settle();
    const none = made(battle(undefined));
    none.settle();
    const pictured = made(battle(CONVOY));
    pictured.settle();
    for (const m of [plain, none]) {
      expect(m.freight(m.page())).toEqual([]);
      expect(m.screen.freight).toBeNull();
    }
    // Picture for picture and light for light, the battle with the hangar is the battle with nothing to guard; the one with a convoy has one of each more.
    expect(plain.page().images.map(idOf)).toEqual(none.page().images.map(idOf));
    expect(plain.page().glows.length).toBe(none.page().glows.length);
    expect(pictured.page().images.length).toBe(none.page().images.length + 1);
    expect(pictured.page().glows.length).toBe(none.page().glows.length + 1);
  });

  test('a hurried screen draws it standing, and a picture the sheet does not have is the store\'s placeholder, where it stands', () => {
    const fast = made(battle(CONVOY), { fast: true });
    fast.settle();
    const size = sheet['asset-convoy'];
    const at = freightAt(freightSpot(placeFor('bg-mine')), size);
    expect(fast.freight(fast.page()).map((image) => [image.x, image.y])).toEqual([[at.x, at.y]]);
    const odd = made(battle({ type: 'protect', name: 'Convoy', hp: 9, sprite: 'asset-nothing' }));
    odd.settle();
    // The size the screen asks for when the store has nothing: forty-eight by thirty-two, on the same spot.
    const fallback = freightAt(freightSpot(placeFor('bg-mine')), { w: 48, h: 32 });
    expect(odd.freight(odd.page()).map((image) => [idOf(image), image.x, image.y, image.w, image.h])).toEqual([['asset-nothing', fallback.x, fallback.y, 48, 32]]);
  });

  test('it stands in the place\'s own far line: lower on a floor that begins low', () => {
    const low = made(battle(CONVOY), { background: 'bg-sluice' });
    low.settle();
    const size = sheet['asset-convoy'];
    const at = freightAt(freightSpot(placeFor('bg-sluice')), size);
    expect(farLine(placeFor('bg-sluice'))).toBeGreaterThan(farLine(placeFor('bg-mine')));
    expect(low.freight(low.page()).map((image) => [image.x, image.y])).toEqual([[at.x, at.y]]);
  });
});

describe('struck', () => {
  test('as a round begins it is thrown and lit, and what it lost is written over it and not under the strip', () => {
    const m = made(battle(CONVOY));
    m.settle();
    const size = sheet['asset-convoy'];
    const at = freightAt(freightSpot(placeFor('bg-mine')), size);
    m.untilStruck(32);
    expect(m.flow.state.asset).toMatchObject({ hp: 6 });
    const shown = m.page();
    const drawn = m.freight(shown);
    // Thrown two pixels to one side (the field itself is thrown by one with it), and laid on again as light.
    expect(Math.abs(Math.abs(drawn[0].x - at.x) - 2)).toBeLessThanOrEqual(1);
    expect(drawn[0].x).not.toBe(at.x);
    expect(Math.abs(drawn[0].y - at.y)).toBeLessThanOrEqual(1);
    expect(drawn.length).toBeGreaterThan(1);
    expect(drawn.slice(1).every((image) => image.blend === 'lighter' && image.x === drawn[0].x && image.y === drawn[0].y)).toBe(true);
    // As bright as a machine that is hit: its picture is laid on as light until that much is made up.
    expect(drawn.slice(1).reduce((sum, image) => sum + image.alpha, 0)).toBeCloseTo(BRIGHT.hit - 1, 5);
    // The figure, in the colour of harm, over where it stands.
    const figure = shown.texts.filter((t) => t.text === '-3' && t.color === COLORS.danger);
    expect(figure).toHaveLength(1);
    expect(shown.texts.filter((t) => /^-\d+$/.test(t.text) && t.color === COLORS.danger)).toHaveLength(1);
    expect(Math.abs((figure[0].left + figure[0].right) / 2 - (at.x + size.w / 2))).toBeLessThanOrEqual(6);
    expect(figure[0].y).toBeLessThan(at.y);
    expect(figure[0].y).toBeGreaterThan(at.y - 40);
    // Heard as it always was, and as nothing more: it has not gone up.
    expect(m.heard.filter(([name]) => ['asset', 'unitDestroyed'].includes(name))).toEqual([['asset', 0]]);
    // A moment later it stands where it stood, unlit.
    for (let ms = 0; ms < HIT_MS + 32; ms += 16) m.screen.update(16);
    expect(m.freight(m.page()).map((image) => [image.x, image.y, image.blend])).toEqual([[at.x, at.y, 'source-over']]);
  });

  test('freight without a picture has what it lost written under the strip, as it always was', () => {
    const m = made(battle({ type: 'protect', name: 'Hangar', hp: 9 }));
    m.settle();
    m.untilStruck(32);
    const shown = m.page();
    const figure = shown.texts.filter((t) => t.text === '-3' && t.color === COLORS.danger);
    expect(figure).toHaveLength(1);
    // Where it always was: by the strip in the corner that names what is guarded, a little above the forty-fourth line as it rises.
    expect(Math.abs((figure[0].left + figure[0].right) / 2 - 30)).toBeLessThanOrEqual(1);
    expect(figure[0].y).toBeLessThanOrEqual(44);
    expect(figure[0].y).toBeGreaterThan(20);
    // And nothing is lit or thrown for it: there is nothing on the field to light.
    expect(shown.images.some((image) => idOf(image).startsWith('asset-'))).toBe(false);
  });

  test('in a calm picture it is lit gently, and the field is not thrown', () => {
    const calm = made(battle(CONVOY), { calm: true });
    calm.settle();
    calm.untilStruck(32);
    const loud = made(battle(CONVOY));
    loud.settle();
    loud.untilStruck(32);
    const lit = (m: typeof calm): number => m.freight(m.page()).filter((image) => image.blend === 'lighter').reduce((sum, image) => sum + image.alpha, 0);
    expect(lit(calm)).toBeCloseTo(BRIGHT.calm - 1, 5);
    expect(lit(loud)).toBeCloseTo(BRIGHT.hit - 1, 5);
    // The freight flinches as a machine does, and nothing else moves: the field stands still under it.
    const size = sheet['asset-convoy'];
    const at = freightAt(freightSpot(placeFor('bg-mine')), size);
    const [first] = calm.freight(calm.page());
    expect(Math.abs(first.x - at.x)).toBe(2);
    expect(first.y).toBe(at.y);
    // The figure is written at it all the same.
    const figure = calm.page().texts.filter((t) => t.text === '-3' && t.color === COLORS.danger);
    expect(figure).toHaveLength(1);
    expect(Math.abs((figure[0].left + figure[0].right) / 2 - (at.x + size.w / 2))).toBeLessThanOrEqual(1);
  });

  test('a round that begins with nobody standing against it takes nothing from it: it is not thrown or lit, no figure is written and nothing is said', () => {
    // One machine on the field, which is down, and one still to come: the round begins with nothing against the freight.
    const state = createBattle(DEMO_BUILD, [ENEMIES['recon-drone']], CATALOG, 3, { objective: CONVOY, reserve: [ENEMIES['gun-turret']] });
    state.units[1].destroyed = true;
    const m = made(state, { calm: true });
    m.settle();
    const size = sheet['asset-convoy'];
    const at = freightAt(freightSpot(placeFor('bg-mine')), size);
    const said: string[] = [];
    m.choose('endTurn');
    for (let i = 0; i < 20000 && !(m.flow.phase === 'action' && m.flow.state.round === 2); i++) {
      m.screen.update(16);
      if (m.flow.message && said[said.length - 1] !== m.flow.message) said.push(m.flow.message);
      if (i % 4 === 0) {
        const shown = m.page();
        expect(m.freight(shown).map((image) => [image.x, image.y, image.blend])).toEqual([[at.x, at.y, 'source-over']]);
        expect(shown.texts.filter((t) => /^-\d+$/.test(t.text) && t.color === COLORS.danger)).toEqual([]);
      }
    }
    expect(m.flow.state.round).toBe(2);
    expect(m.flow.state.asset).toMatchObject({ hp: 9, maxHp: 9 });
    expect(m.flow.state.units.filter((unit) => unit.side === 'enemy' && !unit.destroyed)).toHaveLength(1);
    expect(said.some((line) => line.includes('Convoy'))).toBe(false);
  });
});

describe('worn down and lost', () => {
  const worn = (hp: number): BattleState => { const state = battle({ ...CONVOY, hp: 9 } as Objective); state.asset!.hp = hp; return state; };
  /** The rows of its smoke that are drawn: discs in two greys no other smoke has, rising from its top and nowhere else. */
  const smoke = (shown: Drawn): { x: number; y: number; w: number; h: number }[] => shown.rects.filter((rect) => ['#5c5868', '#757083'].includes(rect.color));

  test('from a third of what it could take downwards it burns: smoke off its top and a lick of flame; with more than that it does not', () => {
    expect(FREIGHT_BURNS).toBe(3);
    const size = sheet['asset-convoy'];
    const at = freightAt(freightSpot(placeFor('bg-mine')), size);
    const flame = (shown: Drawn): number => shown.rects.filter((rect) => rect.color === '#ff8a3c' && rect.w === 3 && rect.h === 2 && Math.abs(rect.x - (at.x + size.w / 2)) <= 3 && rect.y === at.y + 3).length;
    for (const [hp, burns] of [[9, false], [4, false], [3, true], [1, true]] as const) {
      const m = made(worn(hp));
      m.settle();
      const shown = m.page();
      expect(flame(shown), `at ${hp}`).toBe(burns ? 1 : 0);
      expect(smoke(shown).length > 0, `smoke at ${hp}`).toBe(burns);
      // Over its middle, from its top upwards and no higher than thirty lines above it.
      for (const row of smoke(shown)) {
        expect(row.x).toBeGreaterThanOrEqual(at.x + size.w / 2 - 12);
        expect(row.x + row.w).toBeLessThanOrEqual(at.x + size.w / 2 + 13);
        expect(row.y).toBeLessThanOrEqual(at.y + 6);
        expect(row.y).toBeGreaterThanOrEqual(at.y - 36);
      }
    }
    // It rises: the same puff is higher a little later.
    const rising = made(worn(1));
    rising.settle();
    const top = (shown: Drawn): number => Math.min(...smoke(shown).map((row) => row.y));
    const tops = new Set<number>();
    for (let i = 0; i < 40; i++) { rising.screen.update(48); tops.add(top(rising.page())); }
    expect(tops.size).toBeGreaterThan(3);
    // A hurried screen has no smoke of any kind, and freight that is whole has none on any screen.
    const fast = made(worn(1), { fast: true });
    fast.settle();
    expect(flame(fast.page())).toBe(0);
    expect(smoke(fast.page())).toEqual([]);
  });

  test('lost, it is struck, goes up and is gone, and the battle ends in defeat for it', () => {
    const m = made(worn(2));
    m.settle();
    const size = sheet['asset-convoy'];
    const at = freightAt(freightSpot(placeFor('bg-mine')), size);
    m.untilStruck(32);
    expect(m.flow.state.asset!.hp).toBe(0);
    // Still there as it is struck.
    expect(m.freight(m.page()).length).toBeGreaterThanOrEqual(1);
    expect(m.screen.freight).not.toBeNull();
    // Then it fades as it goes up, and is gone; and the battle is not over on the screen until it is.
    let faded = false;
    let ms = 32;
    for (let i = 0; i < 400 && m.screen.freight; i++) {
      m.screen.update(16);
      ms += 16;
      const drawn = m.freight(m.page());
      if (drawn.some((image) => image.alpha < 1 && image.blend === 'source-over')) faded = true;
      if (m.screen.freight) expect(m.flow.phase).toBe('animating');
    }
    expect(faded).toBe(true);
    expect(m.screen.freight).toBeNull();
    expect(m.freight(m.page())).toEqual([]);
    // That is as long as the blow and the going up take, with the moment the field is held; and the camera is home again by then.
    expect(ms).toBeGreaterThanOrEqual(HIT_MS + DEATH_MS);
    expect(ms).toBeLessThanOrEqual(HIT_MS + DEATH_MS + 90 + 64);
    expect(m.screen.motion.view.zoom).toBe(1);
    // The end follows at once, and nothing of the freight comes back under it while the last fire burns out.
    let frames = 0;
    for (; frames < 2000 && m.flow.phase !== 'result'; frames++) m.screen.update(16);
    expect(frames).toBeLessThanOrEqual(2);
    for (let i = 0; i < 60; i++) { m.screen.update(16); expect(m.screen.freight).toBeNull(); expect(m.freight(m.page())).toEqual([]); }
    expect(m.flow.state.outcome).toBe('defeat');
    expect(m.flow.resultNote).toBe('Convoy: lost.');
    expect(m.freight(m.page())).toEqual([]);
    // Heard to be struck, and then to go up as it is seen to: a moment after the blow.
    expect(m.heard.filter(([name]) => ['asset', 'unitDestroyed'].includes(name)).sort((a, b) => a[1] - b[1])).toEqual([['asset', 0], ['unitDestroyed', HIT_MS]]);
    // No shadow is left where it stood.
    expect(m.page().glows.filter((glow) => glow.x === at.x + size.w / 2 && Math.abs(glow.y - (at.ground - 1)) < 0.01)).toEqual([]);
  });

  test('freight without a picture that is lost is heard as it was: struck, and nothing going up', () => {
    const state = battle({ type: 'protect', name: 'Hangar', hp: 9 });
    state.asset!.hp = 2;
    const m = made(state);
    m.settle();
    m.untilStruck();
    // The end comes when the line has been up for as long as any line is: there is nothing on the field to wait for.
    let frames = 0;
    for (; frames < 2000 && m.flow.phase !== 'result'; frames++) m.screen.update(16);
    expect(m.flow.phase).toBe('result');
    expect(frames).toBeGreaterThanOrEqual(30);
    expect(frames).toBeLessThanOrEqual(40);
    expect(m.flow.state.outcome).toBe('defeat');
    expect(m.flow.resultNote).toBe('Hangar: lost.');
    expect(m.heard.filter(([name]) => ['asset', 'unitDestroyed'].includes(name))).toEqual([['asset', 0]]);
    // And nothing is left on the field where freight would stand: no wreck smokes there.
    const at = freightSpot(placeFor('bg-mine'));
    const shown = m.page();
    expect(shown.rects.filter((rect) => ['#3a3644', '#4a4654'].includes(rect.color) && Math.abs(rect.x - at.x) < 24)).toEqual([]);
  });

  test('on a hurried screen what is lost is gone at once', () => {
    const m = made(worn(2), { fast: true });
    m.settle();
    expect(m.screen.freight).not.toBeNull();
    m.choose('endTurn');
    // Frame by frame: there is none, with the result up or before it, on which lost freight is still to be seen.
    let lost = 0;
    for (let i = 0; i < 200 && m.flow.phase !== 'result'; i++) {
      m.screen.update(16);
      if ((m.flow.assetLeft ?? 1) > 0) continue;
      lost++;
      expect(m.screen.freight).toBeNull();
      expect(m.freight(m.page())).toEqual([]);
    }
    expect(lost).toBeGreaterThan(0);
    m.settle();
    expect(m.flow.state.asset!.hp).toBe(0);
    expect(m.screen.freight).toBeNull();
    expect(m.freight(m.page())).toEqual([]);
  });

  test('won with freight standing, it stands to the end', () => {
    let state = battle(CONVOY, ['recon-drone']);
    for (const part of Object.values(state.units[1].parts)) if (part) part.ap = 1;
    const m = made(state);
    m.settle();
    for (let i = 0; i < 40 && m.flow.phase !== 'result'; i++) {
      if (m.flow.phase === 'action') { m.choose('fire'); m.screen.onInput('confirm'); m.screen.onInput('confirm'); m.screen.onInput('confirm'); }
      m.settle();
      if (m.flow.phase === 'action' && m.flow.state.outcome === 'ongoing') { m.choose('endTurn'); m.settle(); }
    }
    state = m.flow.state;
    expect(state.outcome).toBe('victory');
    expect(m.screen.freight).toMatchObject({ sprite: 'asset-convoy' });
    expect(m.freight(m.page())).toHaveLength(1);
  });
});

describe('what moves when it is struck', () => {
  /** The effects of a battle on a field that has freight standing here, or has none. */
  const effects = (freight: { at: { x: number; y: number }; top: number } | null | undefined): BattleFx => new BattleFx({
    muzzle: () => ({ x: 100, y: 50 }), hitPoint: () => ({ x: 240, y: 60 }), centre: () => ({ x: 240, y: 60 }), facing: () => -1,
    damageType: () => 'kinetic', isMelee: () => false, ...(freight === undefined ? {} : { freight: () => freight }),
  });
  const STILL = { dx: 0, dy: 0, lift: 0, flash: false, alpha: 1, glare: false, trail: 0, trailY: 0 };
  const HERE = { at: { x: 132, y: 110 }, top: 96 };

  test('struck where it stands: it is thrown and lit, sparks and a burst come off it, the field is thrown a little, and the figure is over it', () => {
    const fx = effects(HERE);
    fx.onEvent({ type: 'asset', hp: 6, lost: 3 });
    expect(fx.kinds().sort()).toEqual(['burst', 'hit', 'sparks', 'text']);
    expect(fx.texts()).toEqual(['-3']);
    expect(fx.transform(FREIGHT)).toEqual({ ...STILL, dx: 2, flash: true });
    // The burst is an impact, not a fire: nothing has gone up. It is as large as one that far off is.
    expect(fx.bursts()).toEqual([{ style: 'impact', size: 10 * FAR_SIZE }]);
    // The field is thrown by no more than a pixel, for a moment: the handheld is asked to rumble for six tenths of it.
    expect(fx.takeRumble()).toBe(84);
    let hardest = 0;
    for (let ms = 0; ms < 140; ms += 10) { fx.update(10); hardest = Math.max(hardest, Math.abs(fx.shake().dx), Math.abs(fx.shake().dy)); }
    expect(hardest).toBe(1);
    for (let ms = 140; ms < HIT_MS; ms += 10) fx.update(10);
    expect(fx.shake()).toEqual({ dx: 0, dy: 0 });
    expect(fx.transform(FREIGHT)).toEqual(STILL);
    expect(fx.isGone(FREIGHT)).toBe(false);
    // The figure rises from over its top, in the middle of it.
    const drawn = record((ctx) => fx.draw(ctx, false));
    const figure = drawn.texts.filter((t) => t.text === '-3' && t.color === COLORS.danger);
    expect(figure).toHaveLength(1);
    expect((figure[0].left + figure[0].right) / 2).toBeCloseTo(132, 0);
    expect(figure[0].y).toBeLessThan(96 - 2 - 10 + 1);
    for (let ms = 0; ms < TEXT_MS; ms += 10) fx.update(10);
    expect(fx.busy).toBe(false);
  });

  test('with nothing left it goes up a moment after the blow: three fires and a last one, the field thrown harder, and then it is gone', () => {
    const fx = effects(HERE);
    fx.onEvent({ type: 'asset', hp: 0, lost: 2 });
    expect(fx.texts()).toEqual(['-2']);
    expect(fx.bursts()).toEqual([{ style: 'impact', size: 10 * FAR_SIZE }]);
    expect(fx.takeRumble()).toBe(84);
    expect(fx.isGone(FREIGHT)).toBe(false);
    const fires = new Set<number>();
    let hardest = 0;
    let faded = false;
    for (let ms = 0; ms < HIT_MS + DEATH_MS + WRECK_AT + WRECK_MS; ms += 10) {
      fx.update(10);
      for (const burst of fx.bursts()) if (burst.style === 'fire') fires.add(burst.size);
      hardest = Math.max(hardest, Math.abs(fx.shake().dx), Math.abs(fx.shake().dy));
      const alpha = fx.transform(FREIGHT).alpha;
      if (alpha < 1 && alpha > 0) faded = true;
      // Nothing of its going is seen before the blow has been: it stands whole, where it stood, while it is struck.
      if (ms + 10 < HIT_MS) {
        expect(fires.size).toBe(0);
        expect(alpha).toBe(1);
        expect(fx.transform(FREIGHT).dy).toBe(0);
        expect(fx.kinds()).not.toContain('death');
        expect(fx.isGone(FREIGHT)).toBe(false);
      }
    }
    expect([...fires].sort((a, b) => a - b)).toEqual([11, 12, 13, WRECK_SIZE].map((size) => size * FAR_SIZE));
    expect(hardest).toBe(3);
    expect(faded).toBe(true);
    expect(fx.isGone(FREIGHT)).toBe(true);
    // The harder jolt was felt as well.
    expect(fx.takeRumble()).toBe(192);
  });

  test('struck with a little left it is struck and no more: it does not go up until nothing is left', () => {
    for (const hp of [3, 2, 1]) {
      const fx = effects(HERE);
      fx.onEvent({ type: 'asset', hp, lost: 3 });
      expect(fx.kinds().sort()).toEqual(['burst', 'hit', 'sparks', 'text']);
      expect(fx.takeRumble()).toBe(84);
      for (let ms = 0; ms < 2000; ms += 10) {
        fx.update(10);
        expect(fx.kinds()).not.toContain('death');
        expect(fx.bursts().filter((burst) => burst.style === 'fire')).toEqual([]);
        expect(fx.transform(FREIGHT).alpha).toBe(1);
      }
      expect(fx.isGone(FREIGHT)).toBe(false);
      expect(fx.takeRumble()).toBe(0);
    }
  });

  test('where it has no picture, in a scene that says so or one that says nothing, there is the figure by the strip and nothing else', () => {
    for (const freight of [null, undefined]) {
      const fx = effects(freight);
      fx.onEvent({ type: 'asset', hp: 0, lost: 3 });
      expect(fx.kinds()).toEqual(['text']);
      expect(fx.texts()).toEqual(['-3']);
      expect(fx.transform(FREIGHT)).toEqual(STILL);
      expect(fx.takeRumble()).toBe(0);
      const drawn = record((ctx) => fx.draw(ctx, false, 'over'));
      const figure = drawn.texts.filter((t) => t.text === '-3' && t.color === COLORS.danger);
      expect(figure).toHaveLength(1);
      expect((figure[0].left + figure[0].right) / 2).toBeCloseTo(30, 0);
      expect(figure[0].y).toBeLessThanOrEqual(34);
      for (let ms = 0; ms < 2000; ms += 10) fx.update(10);
      expect(fx.isGone(FREIGHT)).toBe(false);
    }
  });

  test('a round that took nothing from it is no effect at all, with a picture or without', () => {
    for (const freight of [HERE, null]) {
      const fx = effects(freight);
      fx.onEvent({ type: 'asset', hp: 9, lost: 0 });
      expect(fx.kinds()).toEqual([]);
      expect(fx.busy).toBe(false);
      expect(fx.takeRumble()).toBe(0);
    }
  });

  test('on the screen: bits come off it when it is struck, the camera stays where it is, and the handheld rumbles once', () => {
    const m = made(battle(CONVOY));
    m.settle();
    const home = { ...m.screen.motion.view };
    const before = m.screen.motion.particles;
    m.felt.length = 0;
    m.choose('endTurn');
    for (let i = 0; i < 20000 && !(m.flow.message ?? '').includes('Convoy'); i++) m.screen.update(16);
    m.felt.length = 0;
    const settledView = { ...m.screen.motion.view };
    m.screen.update(16);
    expect(m.screen.motion.particles).toBeGreaterThan(before);
    expect(m.screen.motion.flash).toBe(0);
    expect(m.screen.motion.blasts).toEqual([]);
    expect(m.screen.motion.wrecks).toEqual([]);
    for (let ms = 0; ms < 400; ms += 16) m.screen.update(16);
    // Nothing pushed the camera in for it: it is where the last machine's shot left it, on its way home or there.
    expect(m.screen.motion.view.zoom).toBeLessThanOrEqual(settledView.zoom);
    for (let ms = 0; ms < 3000 && m.flow.phase !== 'action'; ms += 16) m.screen.update(16);
    expect(m.screen.motion.view).toEqual(home);
    expect(m.felt).toEqual([84]);
  });

  test('on the screen: struck with a little left, it is struck and no more: nothing is held, nothing goes up, and the battle goes on', () => {
    const state = battle(CONVOY);
    state.asset!.hp = 5;
    const m = made(state);
    m.settle();
    const size = sheet['asset-convoy'];
    const at = freightAt(freightSpot(placeFor('bg-mine')), size);
    m.choose('endTurn');
    for (let i = 0; i < 20000 && !(m.flow.message ?? '').includes('Convoy'); i++) m.screen.update(16);
    m.felt.length = 0;
    expect(m.flow.assetLeft).toBe(2);
    for (let ms = 0; ms < 1500; ms += 16) {
      m.screen.update(16);
      expect(m.screen.motion.flash).toBe(0);
      expect(m.screen.motion.blasts).toEqual([]);
      expect(m.screen.motion.wrecks).toEqual([]);
      expect(m.screen.freight).toEqual({ sprite: 'asset-convoy', x: at.x, y: at.y, w: size.w, h: size.h });
    }
    expect(m.heard.filter(([name]) => name === 'unitDestroyed')).toEqual([]);
    expect(m.felt).toEqual([84]);
    for (let i = 0; i < 20000 && m.flow.phase !== 'action'; i++) m.screen.update(16);
    expect(m.flow.state.outcome).toBe('ongoing');
    expect(m.freight(m.page()).map((image) => [image.x, image.y, image.alpha])).toEqual([[at.x, at.y, 1]]);
  });

  test('a press goes on to the end at once, and the freight is seen to go up under it: fading, then gone for good while the fire still burns', () => {
    const state = battle(CONVOY);
    state.asset!.hp = 2;
    const m = made(state);
    m.settle();
    m.choose('endTurn');
    for (let i = 0; i < 20000 && !(m.flow.message ?? '').includes('Convoy'); i++) m.screen.update(16);
    m.screen.update(16);
    expect(m.flow.phase).toBe('animating');
    m.screen.onInput('confirm');
    expect(m.flow.phase).toBe('result');
    // Under the result it still stands for the moment of the blow.
    expect(m.screen.freight).not.toBeNull();
    let goneAt = -1;
    let burningAfter = 0;
    for (let i = 0; i < 120; i++) {
      m.screen.update(16);
      if (goneAt < 0 && !m.screen.freight) goneAt = i;
      if (goneAt >= 0) {
        expect(m.screen.freight).toBeNull();
        expect(m.freight(m.page())).toEqual([]);
        if (m.screen.motion.blasts.length > 0) burningAfter++;
      }
    }
    // Gone when it has been seen to go up, which is before its last fire is out.
    expect(goneAt).toBeGreaterThan(0);
    expect((goneAt + 1) * 16).toBeLessThanOrEqual(HIT_MS + DEATH_MS + 90 + 64);
    expect(burningAfter).toBeGreaterThan(3);
  });

  test('its shadow goes as it does: fainter as it fades, and gone with it', () => {
    // In a calm picture, where the camera and the field stand still and a place on the screen is a place on the stage.
    const state = battle(CONVOY);
    state.asset!.hp = 2;
    const m = made(state, { calm: true });
    m.settle();
    const size = sheet['asset-convoy'];
    const at = freightAt(freightSpot(placeFor('bg-mine')), size);
    const shadow = (shown: Drawn): number | null => {
      const found = shown.glows.filter((glow) => glow.x === at.x + size.w / 2 && Math.abs(glow.y - (at.ground - 1)) < 0.01);
      if (found.length === 0) return null;
      expect(found).toHaveLength(1);
      return Number(/rgba\(0, 0, 8, ([\d.]+)\)/.exec(found[0].stops[0][1])![1]);
    };
    expect(shadow(m.page())).toBe(0.45);
    m.choose('endTurn');
    for (let i = 0; i < 20000 && !(m.flow.message ?? '').includes('Convoy'); i++) m.screen.update(16);
    const seen: [number, number][] = [];
    for (let i = 0; i < 120 && m.screen.freight; i++) {
      m.screen.update(16);
      const shown = m.page();
      const picture = m.freight(shown).find((image) => image.blend === 'source-over');
      const dark = shadow(shown);
      // (While it is thrown by the blow its shadow is thrown with it, and is not at this place.)
      if (picture && dark !== null) seen.push([picture.alpha, dark]);
    }
    const fading = seen.filter(([alpha]) => alpha < 1);
    expect(fading.length).toBeGreaterThan(5);
    for (const [alpha, dark] of seen) expect(dark).toBeCloseTo(0.45 * alpha, 2);
    expect(Math.min(...fading.map(([, dark]) => dark))).toBeLessThan(0.2);
    expect(shadow(m.page())).toBeNull();
  });

  test('on the screen: lost, the field holds its breath, the camera pushes in on it, it goes up in fire, and what is left of it lies there and smokes', () => {
    const state = battle(CONVOY);
    state.asset!.hp = 2;
    const m = made(state);
    m.settle();
    const size = sheet['asset-convoy'];
    const at = freightAt(freightSpot(placeFor('bg-mine')), size);
    const middle = { x: at.x + size.w / 2, y: at.y + size.h / 2 };
    const home = { ...m.screen.motion.view };
    expect(home.zoom).toBe(1);
    m.choose('endTurn');
    for (let i = 0; i < 20000 && !(m.flow.message ?? '').includes('Convoy'); i++) m.screen.update(16);
    m.felt.length = 0;
    // The blow, in the frame after the message bar has said so: the field is held and washed white for a moment.
    m.screen.update(16);
    expect(m.screen.motion.flash).toBeGreaterThan(0);
    expect(m.screen.motion.wrecks).toEqual([{ x: middle.x, y: Math.min(PANEL_Y - 14, middle.y + 6) }]);
    const fires = new Set<number>();
    let closest = 1;
    let towards = { x: home.x, y: home.y };
    for (let i = 0; i < 400 && m.screen.freight; i++) {
      m.screen.update(16);
      for (const size of m.screen.motion.blasts) fires.add(size);
      const view = m.screen.motion.view;
      if (view.zoom > closest) { closest = view.zoom; towards = { x: view.x, y: view.y }; }
    }
    expect([...fires].sort((a, b) => a - b)).toEqual([11, 12, 13, WRECK_SIZE].map((size) => size * FAR_SIZE));
    // As close as the camera comes to a machine that goes up, and turned towards the freight: left of its home and lower, where the freight is.
    expect(closest).toBeGreaterThan(1.05);
    expect(closest).toBeLessThanOrEqual(1 + PUSH.wreck + 0.001);
    expect(towards.x).toBeLessThan(home.x - 8);
    expect(towards.x).toBeGreaterThanOrEqual(middle.x);
    expect(towards.y).toBeGreaterThan(home.y + 4);
    expect(towards.y).toBeLessThanOrEqual(middle.y);
    expect(m.felt).toEqual([84, 192]);
    // What is left of it smokes where it stood, for as long as the result is up.
    for (let i = 0; i < 2000 && m.flow.phase !== 'result'; i++) m.screen.update(16);
    for (let ms = 0; ms < 1500; ms += 16) m.screen.update(16);
    const smoke = m.page().rects.filter((rect) => ['#3a3644', '#4a4654'].includes(rect.color));
    expect(smoke.length).toBeGreaterThan(0);
    for (const row of smoke) expect(Math.abs(row.x + row.w / 2 - middle.x)).toBeLessThan(40);
  });
});

describe('as far as has been said', () => {
  // The rules take a round's toll as the last machine of the round acts; the screen takes it when the message bar says so.
  const ahead = (m: ReturnType<typeof made>, before: number): boolean => m.flow.state.asset!.hp < before && !(m.flow.message ?? '').includes(m.flow.state.asset!.name);
  // (The camera pushes in on a blow as the last machine fires: the flame is then a little larger than its three by two.)
  const flame = (shown: Drawn): number => shown.rects.filter((rect) => rect.color === '#ff8a3c' && Math.round(rect.w) === 3 && Math.round(rect.h) === 2).length;

  test('the strip counts what is left as the message bar has it, not a message early; and both agree once it is said', () => {
    for (const objective of [CONVOY, { type: 'protect', name: 'Hangar', hp: 9 } as Objective]) {
      const m = made(battle(objective));
      m.settle();
      const name = m.flow.state.asset!.name.toUpperCase();
      expect(m.flow.objective).toEqual({ text: `${name} 9/9`, meter: { value: 9, max: 9 } });
      m.choose('endTurn');
      let early = 0;
      for (let i = 0; i < 20000 && !(m.flow.message ?? '').includes(m.flow.state.asset!.name); i++) {
        m.screen.update(16);
        if (!ahead(m, 9)) continue;
        early++;
        expect(m.flow.state.asset!.hp).toBe(6);
        expect(m.flow.assetLeft).toBe(9);
        expect(m.flow.objective).toEqual({ text: `${name} 9/9`, meter: { value: 9, max: 9 } });
      }
      // There were such moments: the last machine's own shot was being shown.
      expect(early).toBeGreaterThan(10);
      expect(m.flow.assetLeft).toBe(6);
      expect(m.flow.objective).toEqual({ text: `${name} 6/9`, meter: { value: 6, max: 9 } });
    }
    // A battle with nothing to keep has nothing left of it to say.
    expect(made(battle(undefined)).flow.assetLeft).toBeNull();
  });

  test('it does not begin to burn before it is seen to be struck', () => {
    const state = battle(CONVOY);
    state.asset!.hp = 5;
    const m = made(state);
    m.settle();
    expect(flame(m.page())).toBe(0);
    m.choose('endTurn');
    let early = 0;
    for (let i = 0; i < 20000 && !(m.flow.message ?? '').includes('Convoy'); i++) {
      m.screen.update(16);
      if (!ahead(m, 5)) continue;
      early++;
      // The rules have it at two of nine, which burns; the screen has it at five still.
      expect(m.flow.state.asset!.hp).toBe(2);
      expect(flame(m.page())).toBe(0);
    }
    expect(early).toBeGreaterThan(10);
    expect(flame(m.page())).toBe(1);
  });

  test('burning freight burns until it is seen to be struck for the last time, and stands until then', () => {
    const state = battle(CONVOY);
    state.asset!.hp = 2;
    const m = made(state);
    m.settle();
    expect(flame(m.page())).toBe(1);
    m.choose('endTurn');
    let early = 0;
    for (let i = 0; i < 20000 && !(m.flow.message ?? '').includes('Convoy'); i++) {
      m.screen.update(16);
      if (!ahead(m, 2)) continue;
      early++;
      // The rules have it lost; on the screen it stands and burns, and the strip has two left.
      expect(m.flow.state.asset!.hp).toBe(0);
      expect(m.flow.state.outcome).toBe('defeat');
      expect(m.screen.freight).not.toBeNull();
      expect(flame(m.page())).toBe(1);
      expect(m.flow.objective).toMatchObject({ meter: { value: 2, max: 9 } });
    }
    expect(early).toBeGreaterThan(10);
    // Said: nothing is left, the flame on it is out, and it is struck and goes up.
    expect(m.flow.objective).toMatchObject({ meter: { value: 0, max: 9 } });
    expect(flame(m.page())).toBe(0);
    expect(m.screen.freight).not.toBeNull();
    for (let i = 0; i < 400 && m.screen.freight; i++) m.screen.update(16);
    expect(m.screen.freight).toBeNull();
  });

  test('a hurried screen, which shows nothing a message at a time, has it as the rules do', () => {
    const state = battle(CONVOY);
    state.asset!.hp = 5;
    const m = made(state, { fast: true });
    m.settle();
    m.choose('endTurn');
    m.settle();
    expect(m.flow.state.asset!.hp).toBe(2);
    expect(m.flow.assetLeft).toBe(2);
    expect(m.flow.objective).toMatchObject({ meter: { value: 2, max: 9 } });
  });
});

describe('what no other kind of job has', () => {
  test('a hit, a repossession and a holding action are drawn with no freight', () => {
    for (const kind of JOB_KINDS.filter((k) => k !== 'escort')) {
      const [b] = makeJob(kind, 4, 9, BOARD_TEXT).battles;
      const state = createBattle(DEMO_BUILD, b.enemies.map((id) => ENEMIES[id]), CATALOG, 3, { objective: b.objective, ...(b.marks ? { marks: b.marks } : {}) });
      const m = made(state, { background: b.background });
      m.settle();
      expect(m.screen.freight, kind).toBeNull();
      expect(m.freight(m.page())).toEqual([]);
    }
    // The freight's name among the effects is one no unit has.
    expect(FREIGHT).toBe('freight');
    expect(battle(CONVOY).units.some((unit) => unit.id === FREIGHT)).toBe(false);
  });
});
