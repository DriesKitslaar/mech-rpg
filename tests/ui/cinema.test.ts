import { createBattle, type BattleOptions, type BattleState } from '../../src/core/battle';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen } from '../../src/ui/battleScreen';
import { PLAIN, pictureTop } from '../../src/ui/stage';
import {
  CUT_IN_H, CUT_IN_MS, CUT_IN_NAME_TALL, CUT_IN_NAME_W, CUT_IN_SCALE, FINISH_FIELD_MS, FINISH_HOLD_MS, FINISH_SLOW, FINISH_ZOOM, LETTERBOX, MOTES, RAYS, RESULT_IN_MS, SPEED_LINES, STAMP_FX_MS, STAMP_SPARKS,
  cutInOpen, drawCutIn, drawDefeat, drawLetterbox, drawStamp, drawVictory, endsBattle, focusOn, letterbox, lookClose,
} from '../../src/ui/cinema';
import type { Settlement } from '../../src/core/economy';
import { MISSIONS } from '../../src/content/missions';
import { AMBIENCE } from '../../src/ui/ambience';
import type { App } from '../../src/ui/app';
import { SettlementScreen } from '../../src/ui/settlementScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import { COLORS } from '../../src/ui/widgets';
import { onStage, record, signCount, signIn, type Drawn, type Filled } from '../helpers/canvas';
import { eyesIn } from '../helpers/eyes';
import { setLanguage } from '../../src/content/language';
import { RESULT_TALL, RESULT_W, RESULT_WORD_Y } from '../../src/ui/battleScreen';
import { fitTall, wordWidth } from '../../src/ui/signType';

/** The moments a battle is staged like a film: the Overdrive's band, the last machine going down, a field won and one lost. */

const FIELD = { top: 14, height: 164, width: 310 };
const BAND = 'rgba(8, 6, 22, 0.94)';
const BARS = '#04040c';
const GREY = '#808080';
function standIn(): CanvasRenderingContext2D {
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get: (t, name: string) => (name in t ? t[name] : name === 'measureText' ? () => ({ width: 10 }) : () => undefined),
    set: (t, name: string, value) => { t[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
}
/** A mech that is one picture a hundred and sixty square, drawn with its corner at 0, 0. */
const MECH = { id: 'the-mech' } as unknown as CanvasImageSource;
const mech = (ctx: CanvasRenderingContext2D): void => { ctx.drawImage(MECH, 0, 0, 160, 160); };
const WORDS = { heading: 'OVERDRIVE', name: 'SECOND WIND' };

describe('the band an Overdrive goes off behind', () => {
  const band = (ms: number, calm = false): Drawn => record((ctx) => drawCutIn(ctx, ms, FIELD, WORDS, mech, calm));
  const plate = (page: Drawn): Filled => page.rects.find((r) => r.color === BAND)!;
  /** The band, open, for an Overdrive of this name. */
  const called = (name: string): Drawn => record((ctx) => drawCutIn(ctx, 400, FIELD, { heading: 'OVERDRIVE', name }, mech));

  test('it opens in a tenth of a second, stays, and closes; before and after there is nothing', () => {
    expect(CUT_IN_MS).toBe(900);
    expect(cutInOpen(-1)).toBe(0);
    expect(cutInOpen(0)).toBe(0);
    expect(cutInOpen(55)).toBeCloseTo(0.5, 5);
    expect(cutInOpen(110)).toBe(1);
    expect(cutInOpen(500)).toBe(1);
    expect(cutInOpen(750)).toBe(1);
    expect(cutInOpen(825)).toBeCloseTo(0.5, 5);
    expect(cutInOpen(899)).toBeGreaterThan(0);
    expect(cutInOpen(900)).toBe(0);
    for (const ms of [-20, 0, 900, 5000]) {
      const page = band(ms);
      expect(page.rects).toEqual([]);
      expect(page.images).toEqual([]);
      expect(page.texts).toEqual([]);
    }
  });

  test('open, it lies across the middle of the field from edge to edge, edged in the game\'s colour', () => {
    const page = band(400);
    const p = plate(page);
    expect(p).toMatchObject({ x: 0, w: 310, h: CUT_IN_H });
    expect(p.y).toBeGreaterThan(FIELD.top + 30);
    expect(p.y + p.h).toBeLessThan(FIELD.top + FIELD.height - 30);
    const edges = page.rects.filter((r) => r.color === COLORS.accent && r.w === 310);
    expect(edges.map((r) => [r.y, r.h])).toEqual([[p.y, 1], [p.y + p.h - 1, 1]]);
    // The game's colour washes in from the left, as light.
    expect(page.washes).toHaveLength(1);
    expect(page.washes[0]).toMatchObject({ x: 0, y: p.y, w: 310, h: p.h, blend: 'lighter' });
    expect(page.washes[0].stops.at(-1)![1]).toBe('rgba(255, 93, 177, 0)');
    // Nothing at all is drawn outside the band.
    for (const r of page.rects) {
      expect(r.y).toBeGreaterThanOrEqual(p.y);
      expect(r.y + r.h).toBeLessThanOrEqual(p.y + p.h);
    }
  });

  test('the mech is in it at twice life size, comes in fast from the left, and then drifts on', () => {
    expect(CUT_IN_SCALE).toBe(2);
    const at = (ms: number) => band(ms).images[0];
    expect(band(400).images).toHaveLength(1);
    const settled = at(400);
    expect(settled.image).toBe(MECH);
    expect(settled).toMatchObject({ w: 320, h: 320 });
    // Its head, which is at 83, 27 on it, is in the left of the band and in its upper half.
    const p = plate(band(400));
    const head = { x: settled.x + 83 * 2, y: settled.y + 27 * 2 };
    expect(head.x).toBeGreaterThan(60);
    expect(head.x).toBeLessThan(110);
    expect(head.y).toBeGreaterThan(p.y);
    expect(head.y).toBeLessThan(p.y + p.h / 2 + 4);
    // Seventy pixels further left at the first moment, there within a fifth of a second, drifting right after that.
    expect(at(1).x).toBeLessThan(settled.x - 60);
    expect(at(90).x).toBeGreaterThan(at(1).x);
    expect(at(90).x).toBeLessThan(at(180).x);
    expect(at(800).x).toBeGreaterThan(at(180).x);
    expect(at(800).x - at(180).x).toBeLessThan(10);
    // Up and down it does not move.
    expect(new Set([1, 90, 180, 400, 800].map((ms) => at(ms).y)).size).toBe(1);
    // Whole pixels of the screen, every time.
    for (const ms of [1, 33, 90, 400]) { expect(Number.isInteger(at(ms).x)).toBe(true); expect(Number.isInteger(at(ms).y)).toBe(true); }
    // At twice its size it is taller than the band: nothing of it is let out of the band, open or still opening.
    expect(settled.h).toBeGreaterThan(p.h * 2);
    expect(settled.clip).toEqual({ x: 0, y: p.y, w: 310, h: p.h });
    const opening = band(40);
    expect(opening.images[0].clip).toEqual({ x: 0, y: plate(opening).y, w: 310, h: plate(opening).h });
    // And the canvas is free again afterwards.
    const after = record((ctx) => { drawCutIn(ctx, 400, FIELD, WORDS, mech); ctx.drawImage(MECH, 0, 0, 10, 10); }).images.at(-1)!;
    expect(after.clip).toBeNull();
    expect(after).toMatchObject({ x: 0, y: 0, w: 10, h: 10 });
  });

  test('speed lines race through it from right to left, each a pixel high and inside the band', () => {
    const lines = (ms: number) => band(ms).rects.filter((r) => /^rgba\(255, (255, 255, 0\.5|93, 177, 0\.45)\)$/.test(r.color));
    const now = lines(400);
    expect(now).toHaveLength(SPEED_LINES);
    const p = plate(band(400));
    for (const line of now) {
      expect(line.h).toBe(1);
      expect(line.w).toBeGreaterThanOrEqual(24);
      expect(line.y).toBeGreaterThan(p.y);
      expect(line.y).toBeLessThan(p.y + p.h - 1);
    }
    // Sixteen milliseconds on, each is further left, or has come round again from the right.
    const later = lines(416);
    let moved = 0;
    now.forEach((line, i) => {
      expect(later[i].y).toBe(line.y);
      if (later[i].x < line.x) moved++;
      else expect(later[i].x).toBeGreaterThan(line.x + 100);
    });
    expect(moved).toBeGreaterThanOrEqual(SPEED_LINES - 3);
    // They are not all at one height.
    expect(new Set(now.map((line) => line.y)).size).toBeGreaterThan(8);
  });

  test('what the Overdrive is called is written at the right, with a dark edge, clear of the mech\'s head', () => {
    const page = band(400);
    const p = plate(page);
    const heading = page.texts.find((t) => t.text === 'OVERDRIVE')!;
    expect(heading).toMatchObject({ size: 10, align: 'right', color: COLORS.accent, right: 298 });
    // The name is in the sign's letters, steel, fully lit: as tall as fits beside the mech, its right
    // edge by the band's, its letters' middle a pixel above the band's own.
    const name = signIn(page, 'SECOND WIND', 'steel')!;
    expect(name).not.toBeNull();
    expect(name).toMatchObject({ level: 1, tall: fitTall('SECOND WIND', CUT_IN_NAME_W, CUT_IN_NAME_TALL) });
    expect(name.tall).toBeLessThan(CUT_IN_NAME_TALL);
    expect(name.x + name.w).toBe(300);
    expect(name.middle).toBe(p.y + p.h / 2 - 1);
    expect(name.x).toBeGreaterThan(150);
    expect(name.y).toBeGreaterThan(p.y + 2);
    expect(name.y + name.h).toBeLessThan(p.y + p.h - 2);
    expect(heading.y).toBeGreaterThan(p.y + 2);
    expect(heading.y + 10).toBeLessThanOrEqual(name.y);
    expect(page.texts.filter((t) => t.text === 'SECOND WIND')).toEqual([]);
    // A short name is written as tall as a name in the band is.
    expect(signIn(called('DEADEYE'), 'DEADEYE', 'steel')).toMatchObject({ tall: CUT_IN_NAME_TALL });
    // Every name there is, in either language, is one the sign writes, and starts right of the mech's head.
    try {
      for (const language of ['en', 'nl'] as const) {
        setLanguage(language);
        for (const id of Object.keys(STRINGS.overdrive.names)) {
          const name = STRINGS.overdrive.names[id].toUpperCase();
          expect(name.length).toBeLessThanOrEqual(14);
          const found = signIn(called(name), name, 'steel');
          expect(found, `${language}: ${name}`).not.toBeNull();
          expect(found!.x, name).toBeGreaterThan(150);
        }
      }
    } finally {
      setLanguage('en');
    }
    // A name the sign cannot write, or one too long to fit beside the mech at its smallest, is written in the font, with a dark edge, where it always was.
    for (const odd of ['Second wind', 'SCHERPSCHUTTER']) {
      const other = called(odd);
      expect(signCount(other), odd).toBe(0);
      const names = other.texts.filter((t) => t.text === odd);
      expect(names, odd).toHaveLength(9);
      expect(names.at(-1), odd).toMatchObject({ size: 20, align: 'right', color: '#ffffff', right: 298 });
      expect(names.at(-1)!.left, odd).toBeGreaterThan(150);
    }
    expect(wordWidth('SCHERPSCHUTTER', 14)).toBeGreaterThan(CUT_IN_NAME_W);
  });

  test('while it is still opening it is thinner and says nothing yet', () => {
    const page = band(40);
    const p = plate(page);
    expect(p.h).toBeLessThan(CUT_IN_H / 2);
    expect(p.h).toBeGreaterThanOrEqual(2);
    expect(page.texts).toEqual([]);
    // It opens from its middle: the middle of the band is where it is when open.
    const open = plate(band(400));
    expect(Math.abs(p.y + p.h / 2 - (open.y + open.h / 2))).toBeLessThanOrEqual(1);
    for (const r of page.rects) {
      expect(r.y).toBeGreaterThanOrEqual(p.y);
      expect(r.y + r.h).toBeLessThanOrEqual(p.y + p.h);
    }
  });

  test('it opens with a flash of its own, which a calm picture leaves out', () => {
    const flash = (ms: number, calm = false) => band(ms, calm).rects.filter((r) => /^rgba\(255, 255, 255, 0\.[0-4]\d\)$/.test(r.color) && r.w === 310 && r.h > 1);
    expect(flash(10)).toHaveLength(1);
    expect(flash(60)).toHaveLength(1);
    expect(flash(70)).toEqual([]);
    expect(flash(400)).toEqual([]);
    expect(flash(10, true)).toEqual([]);
    // Its wash of colour is soft light: a calm picture has it at half strength. Nothing else about it changes.
    expect(band(400).washes[0].stops[0][1]).toBe('rgba(255, 93, 177, 0.34)');
    expect(band(400, true).washes[0].stops[0][1]).toBe('rgba(255, 93, 177, 0.17)');
    expect(band(400, true).washes[0].stops[1][1]).toBe('rgba(255, 93, 177, 0.03)');
    expect(band(400, true).rects).toEqual(band(400).rects);
    expect(band(400, true).texts).toEqual(band(400).texts);
    expect(() => drawCutIn(standIn(), 400, FIELD, WORDS, () => undefined)).not.toThrow();
  });
});

describe('the machine a battle ends with', () => {
  const gone = (unit: string) => ({ type: 'unitDestroyed', unit });
  const shot = { type: 'shot', unit: 'player' };

  test('is the last to fall of the side that lost', () => {
    const won = [shot, gone('enemy-0'), shot, gone('enemy-1'), { type: 'outcome' }];
    expect(endsBattle(won, 'victory', 3)).toBe(true);
    // Not the one before it, and not what is no destruction at all.
    expect(endsBattle(won, 'victory', 1)).toBe(false);
    expect(endsBattle(won, 'victory', 0)).toBe(false);
    expect(endsBattle(won, 'victory', 4)).toBe(false);
    expect(endsBattle(won, 'victory', 99)).toBe(false);
    const lost = [shot, gone('enemy-0'), shot, gone('player'), { type: 'outcome' }];
    expect(endsBattle(lost, 'defeat', 3)).toBe(true);
    // A machine of the side that won is never it, even when it is the last to go.
    expect(endsBattle(lost, 'defeat', 1)).toBe(false);
    expect(endsBattle([gone('player'), gone('enemy-0')], 'defeat', 1)).toBe(false);
    expect(endsBattle([gone('enemy-0'), gone('player')], 'victory', 1)).toBe(false);
  });

  test('while the battle is still on nothing is, and of two that go up in one blow only the second', () => {
    expect(endsBattle([shot, gone('enemy-0')], 'ongoing', 1)).toBe(false);
    const both = [shot, gone('enemy-0'), gone('enemy-1'), { type: 'outcome' }];
    expect(endsBattle(both, 'victory', 1)).toBe(false);
    expect(endsBattle(both, 'victory', 2)).toBe(true);
    // A bomb that takes the pilot with it goes up after the pilot does: the battle still ends with the pilot.
    const together = [{ type: 'blast' }, gone('player'), gone('enemy-0'), { type: 'outcome' }];
    expect(endsBattle(together, 'defeat', 1)).toBe(true);
    expect(endsBattle(together, 'defeat', 2)).toBe(false);
    // And the other way about: the last machine falls, and something of the pilot's side after it.
    const after = [gone('enemy-0'), gone('enemy-1'), gone('player')];
    expect(endsBattle(after, 'victory', 1)).toBe(true);
    expect(endsBattle(after, 'victory', 0)).toBe(false);
    expect(endsBattle(after, 'victory', 2)).toBe(false);
  });
});

describe('looking at the last machine from close by', () => {
  test('what it is drawn round is the point asked for, moved only as far as keeps the rest of the screen out of view', () => {
    expect(FINISH_ZOOM).toBe(2);
    expect(focusOn({ x: 155, y: 96 }, FIELD)).toEqual({ x: 155, y: 96 });
    expect(focusOn({ x: 150.4, y: 90.6 }, FIELD)).toEqual({ x: 150, y: 91 });
    // Half of half the field is 78 by 41.
    expect(focusOn({ x: 300, y: 170 }, FIELD)).toEqual({ x: 232, y: 137 });
    expect(focusOn({ x: 5, y: 20 }, FIELD)).toEqual({ x: 78, y: 55 });
    expect(focusOn({ x: -40, y: 400 }, FIELD)).toEqual({ x: 78, y: 137 });
  });

  test('the point is put in the middle of the field and everything is twice its size, on whole pixels', () => {
    const page = record((ctx) => {
      lookClose(ctx, { x: 200, y: 120 }, FIELD);
      ctx.fillStyle = '#123456';
      ctx.fillRect(200, 120, 10, 6);
      ctx.fillRect(0, 14, 310, 164);
    });
    expect(page.rects[0]).toMatchObject({ x: 155, y: 96, w: 20, h: 12 });
    // The field as a whole reaches past the field's own box on every side: nothing behind it shows.
    const whole = page.rects[1];
    expect(whole.x).toBeLessThanOrEqual(0);
    expect(whole.y).toBeLessThanOrEqual(FIELD.top);
    expect(whole.x + whole.w).toBeGreaterThanOrEqual(310);
    expect(whole.y + whole.h).toBeGreaterThanOrEqual(FIELD.top + FIELD.height);
    // And that holds for the corners it can be drawn round.
    for (const at of [{ x: 0, y: 0 }, { x: 310, y: 0 }, { x: 0, y: 270 }, { x: 310, y: 270 }]) {
      const corner = record((ctx) => { lookClose(ctx, focusOn(at, FIELD), FIELD); ctx.fillRect(0, 14, 310, 164); }).rects[0];
      expect(corner.x).toBeLessThanOrEqual(0);
      expect(corner.y).toBeLessThanOrEqual(FIELD.top);
      expect(corner.x + corner.w).toBeGreaterThanOrEqual(310);
      expect(corner.y + corner.h).toBeGreaterThanOrEqual(FIELD.top + FIELD.height);
      expect(Number.isInteger(corner.x) && Number.isInteger(corner.y)).toBe(true);
    }
  });

  test('two black bars close in over the top and the bottom of the field, and open again', () => {
    // They close in over the first eighth of a second of the player's time...
    expect(letterbox(-1, 0)).toBe(0);
    expect(letterbox(0, 0)).toBe(0);
    expect(letterbox(60, 0)).toBeCloseTo(0.5, 5);
    expect(letterbox(120, 0)).toBe(1);
    expect(letterbox(5000, 100)).toBe(1);
    // ...and open over the last of the look, which is counted on the field's own clock.
    expect(FINISH_FIELD_MS).toBe(500);
    expect(letterbox(900, FINISH_FIELD_MS - 75)).toBe(1);
    expect(letterbox(900, FINISH_FIELD_MS - 37.5)).toBeCloseTo(0.5, 5);
    expect(letterbox(900, FINISH_FIELD_MS)).toBe(0);
    expect(letterbox(900, FINISH_FIELD_MS + 40)).toBe(0);
    // A look so short that they are still closing when it ends: whichever is less.
    expect(letterbox(30, FINISH_FIELD_MS - 60)).toBeCloseTo(0.25, 5);
    const bars = (open: number) => record((ctx) => drawLetterbox(ctx, open, FIELD)).rects;
    expect(bars(0)).toEqual([]);
    expect(bars(-2)).toEqual([]);
    expect(bars(1).map(({ x, y, w, h, color }) => ({ x, y, w, h, color }))).toEqual([
      { x: 0, y: 14, w: 310, h: LETTERBOX, color: BARS },
      { x: 0, y: 178 - LETTERBOX, w: 310, h: LETTERBOX, color: BARS },
    ]);
    expect(bars(0.5).map((r) => r.h)).toEqual([6, 6]);
    expect(bars(3)).toEqual(bars(1));
  });
});

describe('a field that was won', () => {
  const won = (ms: number, calm = false, still = false): Drawn => record((ctx) => {
    ctx.globalCompositeOperation = 'source-over';
    drawVictory(ctx, ms, FIELD, calm, still);
    expect(ctx.globalCompositeOperation).toBe('source-over');
  });
  const share = (page: Drawn): number => Number(/, ([\d.]+)\)$/.exec(page.washes[0].stops[0][1])![1]);

  test('warm light from above and shafts of it behind the word, as light added to the picture', () => {
    const page = won(RESULT_IN_MS);
    expect(page.washes).toHaveLength(1);
    expect(page.washes[0]).toMatchObject({ x: 0, y: FIELD.top, w: 310, blend: 'lighter' });
    expect(page.washes[0].h).toBeCloseTo(FIELD.height * 0.7, 5);
    expect(page.washes[0].stops[0][1]).toBe('rgba(255, 214, 150, 0.240)');
    expect(page.shapes).toHaveLength(RAYS * 2);
    for (const ray of page.shapes) {
      expect(ray.blend).toBe('lighter');
      // Every shaft starts behind where the word is written, in the middle of the field's width.
      expect(Math.hypot(ray.points[0].x - 155, ray.points[0].y - (FIELD.top + 46))).toBeLessThan(1);
      expect(ray.stops[1][1]).toMatch(/, 0\)$/);
    }
    // They fan out all the way round.
    const ways = page.shapes.filter((_, i) => i % 2 === 0).map((ray) => Math.atan2((ray.points[1].y + ray.points[2].y) / 2 - (FIELD.top + 46), (ray.points[1].x + ray.points[2].x) / 2 - 155));
    expect(new Set(ways.map((a) => Math.round(a * 10))).size).toBe(RAYS);
    expect(Math.max(...ways) - Math.min(...ways)).toBeGreaterThan(Math.PI);
  });

  test('it comes over the field in half a second and then holds', () => {
    expect(won(0).washes).toEqual([]);
    expect(won(-50).washes).toEqual([]);
    expect(share(won(RESULT_IN_MS / 2))).toBeCloseTo(0.12, 3);
    expect(share(won(RESULT_IN_MS))).toBeCloseTo(0.24, 3);
    expect(share(won(RESULT_IN_MS * 9))).toBeCloseTo(0.24, 3);
  });

  test('the shafts turn slowly and motes rise through them, inside the field', () => {
    const a = won(1000);
    const b = won(3000);
    expect(b.shapes[0].points[1]).not.toEqual(a.shapes[0].points[1]);
    const motes = (page: Drawn) => page.rects.filter((r) => /^rgba\(255, 226, 170, /.test(r.color));
    expect(motes(a)).toHaveLength(MOTES);
    expect(a.rects).toHaveLength(MOTES);
    for (const mote of motes(a)) {
      expect(mote).toMatchObject({ w: 1, h: 1 });
      expect(mote.x).toBeGreaterThanOrEqual(0);
      expect(mote.x).toBeLessThan(310);
      expect(mote.y).toBeGreaterThanOrEqual(FIELD.top);
      expect(mote.y).toBeLessThan(FIELD.top + FIELD.height);
    }
    // A moment later each is where it was or higher, unless it has come round to the bottom again.
    const next = motes(won(1100));
    motes(a).forEach((mote, i) => { if (next[i].y > mote.y) expect(next[i].y - mote.y).toBeGreaterThan(100); });
    expect(motes(a).filter((mote, i) => next[i].y < mote.y).length).toBeGreaterThan(MOTES / 2);
  });

  test('a hurried game has all of it at once and standing still', () => {
    const still = won(0, false, true);
    expect(share(still)).toBeCloseTo(0.24, 3);
    expect(still.rects).toEqual([]);
    expect(still.shapes).toHaveLength(RAYS * 2);
    expect(won(4000, false, true).shapes).toEqual(still.shapes);
    expect(won(RESULT_IN_MS).shapes[0].stops[0][1]).toBe('rgba(255, 217, 160, 0.120)');
  });

  test('a calm picture has no light lying over the whole field: the motes rise, and that is all', () => {
    const calm = won(RESULT_IN_MS * 2, true);
    expect(calm.washes).toEqual([]);
    expect(calm.shapes).toEqual([]);
    expect(calm.glows).toEqual([]);
    expect(calm.rects.filter((r) => /^rgba\(255, 226, 170, /.test(r.color))).toHaveLength(MOTES);
    expect(calm.rects).toHaveLength(MOTES);
    // Calm and hurried at once: nothing at all.
    const both = won(RESULT_IN_MS * 2, true, true);
    expect([both.washes, both.shapes, both.rects, both.glows]).toEqual([[], [], [], []]);
    expect(() => drawVictory(standIn(), 800, FIELD)).not.toThrow();
  });
});

describe('a field that was lost', () => {
  const lost = (ms: number, still = false): Drawn => record((ctx) => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    drawDefeat(ctx, ms, FIELD, still);
    expect(ctx.globalCompositeOperation).toBe('source-over');
    expect(ctx.globalAlpha).toBe(1);
  });

  test('the colour goes out of it, it darkens, and red closes in from its edges', () => {
    const page = lost(RESULT_IN_MS);
    expect(page.rects).toHaveLength(2);
    // Grey laid on so that only the colour is taken away, over the field and nothing else.
    expect(page.rects[0]).toMatchObject({ x: 0, y: FIELD.top, w: 310, h: FIELD.height, color: GREY, blend: 'saturation' });
    expect(page.rects[0].alpha).toBeCloseTo(0.85, 5);
    expect(page.rects[1]).toMatchObject({ x: 0, y: FIELD.top, w: 310, h: FIELD.height, color: 'rgba(6, 4, 10, 0.300)', blend: 'source-over', alpha: 1 });
    expect(page.glows).toHaveLength(1);
    expect(page.glows[0].blend).toBe('source-over');
    expect(page.glows[0]).toMatchObject({ x: 155, y: FIELD.top + FIELD.height / 2 });
    // Nothing in the middle, red at the edge.
    expect(page.glows[0].stops).toEqual([[0, 'rgba(150, 16, 16, 0)'], [1, 'rgba(150, 16, 16, 0.420)']]);
  });

  test('it comes over the field in half a second and then holds; a hurried game has it at once', () => {
    expect(lost(0).rects).toEqual([]);
    expect(lost(0).glows).toEqual([]);
    expect(lost(RESULT_IN_MS / 2).rects[0].alpha).toBeCloseTo(0.425, 5);
    expect(lost(RESULT_IN_MS / 2).rects[1].color).toBe('rgba(6, 4, 10, 0.150)');
    expect(lost(RESULT_IN_MS * 20).rects).toEqual(lost(RESULT_IN_MS).rects);
    expect(lost(0, true).rects).toEqual(lost(RESULT_IN_MS).rects);
    expect(lost(0, true).glows).toEqual(lost(RESULT_IN_MS).glows);
    expect(() => drawDefeat(standIn(), 800, FIELD)).not.toThrow();
  });
});

describe('a rank landing on the bill', () => {
  const at = { x: 250, y: 36 };
  const stamp = (ms: number, grand: boolean, calm = false): Drawn => record((ctx) => {
    ctx.globalAlpha = 1;
    drawStamp(ctx, at, ms, '#5fd9c2', grand, calm);
    expect(ctx.globalAlpha).toBe(1);
  });
  const ring = (page: Drawn) => page.rects.filter((r) => r.color === '#5fd9c2');
  const reach = (page: Drawn): number => Math.max(...ring(page).map((r) => Math.max(Math.abs(r.x - at.x), Math.abs(r.x + r.w - 1 - at.x))));

  test('a ring runs out from it and fades, and then there is nothing', () => {
    expect(STAMP_FX_MS).toBe(340);
    expect(ring(stamp(0, false)).length).toBeGreaterThan(8);
    expect(reach(stamp(0, false))).toBeGreaterThanOrEqual(8);
    expect(reach(stamp(300, false))).toBeGreaterThan(reach(stamp(0, false)) + 12);
    expect(ring(stamp(0, false))[0].alpha).toBe(1);
    expect(ring(stamp(170, false))[0].alpha).toBeCloseTo(0.5, 5);
    for (const ms of [-1, STAMP_FX_MS, 2000]) {
      expect(stamp(ms, true).rects).toEqual([]);
      expect(stamp(ms, true).glows).toEqual([]);
    }
  });

  test('a rank that does not pay gets the ring and no more; one that pays flares and throws sparks', () => {
    const plain = stamp(100, false);
    expect(plain.glows).toEqual([]);
    expect(plain.rects.every((r) => r.color === '#5fd9c2')).toBe(true);
    const grand = stamp(100, true);
    const sparks = grand.rects.filter((r) => r.color === '#ffffff');
    expect(sparks).toHaveLength(STAMP_SPARKS);
    for (const spark of sparks) expect(spark).toMatchObject({ w: 1, h: 1 });
    // The sparks fly outwards, all the way round.
    const far = (page: Drawn) => page.rects.filter((r) => r.color === '#ffffff').map((r) => Math.hypot(r.x - at.x, r.y - at.y));
    expect(Math.min(...far(stamp(300, true)))).toBeGreaterThan(Math.max(...far(stamp(20, true))));
    expect(new Set(sparks.map((r) => `${Math.sign(r.x - at.x)},${Math.sign(r.y - at.y)}`)).size).toBeGreaterThanOrEqual(4);
    expect(grand.glows).toHaveLength(1);
    expect(grand.glows[0]).toMatchObject({ x: at.x, y: at.y, blend: 'lighter' });
    // A calm picture has the flare at half strength and everything else as it is.
    const level = (page: Drawn): number => Number(/, ([\d.]+)\)$/.exec(page.glows[0].stops[0][1])![1]);
    expect(level(stamp(100, true, true))).toBeCloseTo(level(grand) / 2, 2);
    expect(stamp(100, true, true).rects).toEqual(grand.rects);
  });
});

describe('the staged moments in a battle', () => {
  const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
  /** A battle against these machines; the ones named are left with a single point of armour, so that anything that lands ends them. */
  function fight(enemies: string[], frail: number[], opts: BattleOptions = {}, seed = 7): BattleState {
    const state = createBattle(DEMO_BUILD, enemies.map((id) => ENEMIES[id]), CATALOG, seed, opts);
    for (const i of frail) for (const part of Object.values(state.units[i + 1].parts)) if (part) part.ap = 1;
    return state;
  }
  function screenOf(state: BattleState, opts: { fast?: boolean; calm?: boolean; speed?: number } = {}) {
    const played: { name: string; delay: number }[] = [];
    const flow = new BattleFlow(state, CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, {
      fast: opts.fast ?? false, background: 'bg-nowhere', ...(opts.calm ? { calm: true } : {}), ...(opts.speed ? { speed: opts.speed } : {}),
      sfx: { play: (name: string, delay = 0) => { played.push({ name, delay }); } } as never,
    });
    for (let i = 0; i < 400 && (flow.phase !== 'action' || screen.banner); i++) screen.update(16);
    expect(flow.phase).toBe('action');
    const page = (): Drawn => record((ctx) => screen.draw(ctx));
    /** Fires the first weapon at whatever is aimed at first. */
    const fire = (): void => { screen.onInput('confirm'); screen.onInput('confirm'); screen.onInput('confirm'); };
    /** Fires until the machine in this place is gone, a frame at a time, and stops on the frame its destruction is shown. */
    const kill = (index: number): void => {
      const id = flow.state.units[index + 1].id;
      for (let i = 0; i < 4000 && screen.motion.breaking(id) === null; i++) {
        if (flow.phase === 'action') fire();
        screen.update(16);
        if (flow.phase === 'result') break;
      }
      expect(screen.motion.breaking(id)).not.toBeNull();
    };
    return { flow, screen, page, fire, kill, played };
  }
  const background = (page: Drawn) => page.images.find((i) => (i.image as { id?: string }).id === 'bg-nowhere')!;

  test('an Overdrive goes off behind its band, named, for nine tenths of a second, and a hurried game has none', () => {
    const { flow, screen, page } = screenOf(fight(['gun-turret'], [], { overdrive: 'iron-skin', drive: 100 }));
    expect(screen.motion.cutIn).toBeNull();
    expect(page().rects.some((r) => r.color === BAND)).toBe(false);
    screen.onInput('next');
    screen.update(16);
    expect(flow.state.units[0].ironSkin).toBe(true);
    expect(screen.motion.cutIn).toBe('IRON SKIN');
    screen.update(300);
    // The camera pushes in on the mech as its Overdrive goes off: what stands on the field is measured as it stands there.
    expect(screen.motion.view.zoom).toBeGreaterThan(1);
    const up = onStage(page(), screen.motion.view);
    expect(up.rects.some((r) => r.color === BAND)).toBe(true);
    expect(up.texts.map((t) => t.text)).toEqual(expect.arrayContaining(['OVERDRIVE', 'IRON SKIN']));
    // The mech in the band is the pilot's own, from the front and at twice its size: one picture for each of its parts.
    // On the field the same parts are seen from behind, four fifths the size.
    const id = (i: { image: unknown }): string => (i.image as { id: string }).id;
    const big = up.images.filter((i) => i.w > 0 && !id(i).endsWith('.back')
      && up.images.some((o) => id(o) === `${id(i)}.back` && o.w === Math.round((i.w / 2) * 0.8) && o.h === Math.round((i.h / 2) * 0.8)));
    expect(big.length).toBeGreaterThanOrEqual(5);
    expect(big.every((i) => up.images.indexOf(i) > up.images.findIndex((o) => id(o) === `${id(i)}.back`))).toBe(true);
    for (let i = 0; i < 60 && screen.motion.cutIn; i++) screen.update(16);
    expect(screen.motion.cutIn).toBeNull();
    expect(page().rects.some((r) => r.color === BAND)).toBe(false);
    // In all it was up for as long as it should be, counted from the frame it went off in.
    const again = screenOf(fight(['gun-turret'], [], { overdrive: 'deadeye', drive: 100 }));
    again.screen.onInput('next');
    let frames = 0;
    for (; frames < 200; frames++) { again.screen.update(16); if (frames > 0 && !again.screen.motion.cutIn) break; }
    expect(frames * 16).toBeGreaterThanOrEqual(CUT_IN_MS - 32);
    expect(frames * 16).toBeLessThanOrEqual(CUT_IN_MS + 32);
    // Hurried: the Overdrive goes off all the same, with nothing staged.
    const fast = screenOf(fight(['gun-turret'], [], { overdrive: 'iron-skin', drive: 100 }), { fast: true });
    fast.screen.onInput('next');
    fast.screen.update(16);
    expect(fast.flow.state.units[0].ironSkin).toBe(true);
    expect(fast.screen.motion.cutIn).toBeNull();
    expect(fast.page().rects.some((r) => r.color === BAND)).toBe(false);
  });

  test('the machine a battle ends with is looked at from twice as close, between black bars, with nothing else over the field', () => {
    const { flow, screen, page, kill } = screenOf(fight(['gun-turret'], [0], { overdrive: 'iron-skin', drive: 100 }));
    const before = page();
    // The picture of the place, as far up as shows the band of it the field looks at.
    expect(background(before)).toMatchObject({ x: 0, y: pictureTop(PLAIN), w: 310, h: 270 });
    // The Overdrive's meter is one of the things written over the field while a battle goes on.
    const meter = (p: Drawn) => p.rects.filter((r) => r.x <= 6 && r.w <= 4 && r.h >= 40 && r.y > 14 && r.y + r.h <= 178);
    expect(meter(before).length).toBeGreaterThan(0);
    kill(0);
    expect(flow.state.outcome).toBe('victory');
    const focus = screen.motion.finish!;
    expect(focus).not.toBeNull();
    // It is drawn round the machine that went up, as near as the edge of the field allows.
    expect(focus.x).toBeGreaterThan(155);
    expect(focus.x).toBeLessThanOrEqual(232);
    expect(focus.y).toBeGreaterThanOrEqual(55);
    expect(focus.y).toBeLessThanOrEqual(137);
    screen.update(200);
    const close = page();
    // Twice its size; while a blast is shaking the field the picture is drawn a few pixels larger still, as it always is.
    const bg = background(close);
    expect([620, 644]).toContain(bg.w);
    expect([540, 564]).toContain(bg.h);
    if (bg.w === 620) {
      expect(bg.x).toBe(155 - focus.x * 2);
      expect(bg.y).toBe(14 + 82 - focus.y * 2);
    }
    // Nothing of the field at twice its size is let out over the bar along the top or the panel underneath.
    expect(bg.clip).toEqual({ x: 0, y: 14, w: 310, h: 164 });
    const bars = close.rects.filter((r) => r.color === BARS);
    expect(bars.map(({ x, y, w, h }) => ({ x, y, w, h }))).toEqual([{ x: 0, y: 14, w: 310, h: LETTERBOX }, { x: 0, y: 178 - LETTERBOX, w: 310, h: LETTERBOX }]);
    expect(meter(close)).toEqual([]);
    // What is said along the top stays, and at its usual size.
    const said = close.texts.find((t) => t.y === 1)!;
    expect(said).toBeDefined();
    expect(said.size).toBe(12);
  });

  test('from close by every light is four times the size, so half as many are drawn', () => {
    /** The most lights any frame of a machine's going up holds. */
    const most = (calm: boolean): { lights: number; close: boolean } => {
      const { screen, page, kill } = screenOf(fight(['gun-turret'], [0]), calm ? { calm: true } : {});
      kill(0);
      let lights = 0;
      let close = false;
      for (let i = 0; i < 90 && screen.motion.finish; i++) {
        screen.update(16);
        const frame = page();
        lights = Math.max(lights, frame.glows.filter((g) => g.blend === 'lighter').length);
        close = close || background(frame).w >= 620;
      }
      return { lights, close };
    };
    const near = most(false);
    expect(near.close).toBe(true);
    expect(near.lights).toBeLessThanOrEqual(8);
    expect(near.lights).toBeGreaterThanOrEqual(6);
    // A calm picture keeps its distance, and so keeps its sixteen: the same going up shows more of them.
    const far = most(true);
    expect(far.close).toBe(false);
    expect(far.lights).toBeGreaterThan(8);
    expect(far.lights).toBeLessThanOrEqual(16);
  });

  test('it lasts a little over a second, nothing more is said while it does, and then the field is as it was', () => {
    const { flow, screen, page, kill } = screenOf(fight(['gun-turret'], [0]));
    kill(0);
    expect(screen.motion.finish).not.toBeNull();
    const shown = flow.eventsShown;
    let ms = 0;
    for (; ms < 3000 && screen.motion.finish; ms += 16) {
      expect(flow.phase).toBe('animating');
      expect(flow.eventsShown).toBe(shown);
      screen.update(16);
    }
    // The field is held for 160, and then its clock runs at half speed for the 500 the look lasts on it.
    expect(ms).toBeGreaterThanOrEqual(FINISH_HOLD_MS + FINISH_FIELD_MS / FINISH_SLOW - 16);
    expect(ms).toBeLessThanOrEqual(FINISH_HOLD_MS + FINISH_FIELD_MS / FINISH_SLOW + 48);
    expect(background(page()).w).toBeLessThanOrEqual(322);
    expect(page().rects.filter((r) => r.color === BARS)).toEqual([]);
    // Now what is next is said after the usual wait, and the battle is over.
    expect(flow.phase).toBe('animating');
    for (let i = 0; i < 80 && flow.phase !== 'result'; i++) screen.update(16);
    expect(flow.phase).toBe('result');
  });

  test('only the last machine to fall gets it, and only where the battle is over with it', () => {
    const { flow, screen, kill } = screenOf(fight(['gun-turret', 'recon-drone'], [0, 1]));
    kill(0);
    expect(flow.state.units[1].destroyed).toBe(true);
    expect(flow.state.outcome).toBe('ongoing');
    expect(screen.motion.finish).toBeNull();
    // It goes up the way any machine does, and the battle goes on at its usual pace.
    for (let i = 0; i < 200 && flow.phase === 'animating'; i++) { screen.update(16); expect(screen.motion.finish).toBeNull(); }
    // The second one is the last: the battle is over with it, and it gets the close look.
    kill(1);
    expect(flow.state.outcome).toBe('victory');
    expect(screen.motion.finish).not.toBeNull();
  });

  test('time runs at half speed while it lasts, and its last blast is heard when it is seen', () => {
    expect(FINISH_SLOW).toBe(0.5);
    // One machine that is not the last, and one that is: how far each has come apart a while after it was struck.
    const first = screenOf(fight(['gun-turret', 'tank'], [0]));
    first.kill(0);
    expect(first.screen.motion.finish).toBeNull();
    const last = screenOf(fight(['gun-turret'], [0]));
    last.kill(0);
    expect(last.screen.motion.finish).not.toBeNull();
    // Both are at the frame their destruction is shown. Past the beat the field is held for, which is
    // longer for the last one, each is given the same time to come apart in.
    expect(first.screen.motion.breaking('enemy-0')).toBe(0);
    expect(last.screen.motion.breaking('enemy-0')).toBe(0);
    const step = (s: ReturnType<typeof screenOf>, ms: number): void => { for (let t = 0; t < ms; t += 16) s.screen.update(16); };
    step(first, 96 + 160);
    step(last, FINISH_HOLD_MS + 16 + 160);
    const quick = first.screen.motion.breaking('enemy-0')!;
    const slow = last.screen.motion.breaking('enemy-0')!;
    expect(quick).toBeGreaterThan(0.1);
    expect(quick).toBeLessThan(1);
    // Half the speed, half as far along.
    expect(slow).toBeGreaterThan(quick * 0.4);
    expect(slow).toBeLessThan(quick * 0.6);
  });

  test('whatever the pace, its last blast is seen in the close look and heard at the moment it is seen', () => {
    for (const speed of [1, 2.5, 4]) {
      const { screen, kill, played } = screenOf(fight(['gun-turret'], [0]), speed === 1 ? {} : { speed });
      kill(0);
      const booms = (): number => played.filter((p) => p.name === 'unitDestroyed').length;
      const slams = (): { name: string; delay: number }[] => played.filter((p) => p.name === 'slam');
      // The blow that ends the battle is a slam, heard at once as the field is held: the machine has not gone up yet.
      expect(slams()).toEqual([{ name: 'slam', delay: 0 }]);
      expect(booms()).toBe(0);
      let seenAt = -1;
      let heardAt = -1;
      let endedAt = -1;
      for (let ms = 16; ms <= 4000 && endedAt < 0; ms += 16) {
        screen.update(16);
        if (seenAt < 0 && screen.motion.blasts.includes(26)) seenAt = ms;
        if (heardAt < 0 && booms() === 1) heardAt = ms;
        if (!screen.motion.finish) endedAt = ms;
      }
      // Seen while the look is still up, heard in the same frame, and looked at for a while after.
      expect(seenAt, `speed ${speed}`).toBeGreaterThan(0);
      expect(heardAt, `speed ${speed}`).toBe(seenAt);
      expect(endedAt, `speed ${speed}`).toBeGreaterThan(seenAt);
      // Two fifths of the look are after the blast: 200 of the field's 500 milliseconds, at half speed.
      expect(endedAt - seenAt, `speed ${speed}`).toBeGreaterThanOrEqual(Math.floor(200 / FINISH_SLOW / speed) - 16);
      // And it is heard no more than that once, with no delay asked for; and there was the one slam.
      for (let i = 0; i < 120; i++) screen.update(16);
      expect(played.filter((p) => p.name === 'unitDestroyed')).toEqual([{ name: 'unitDestroyed', delay: 0 }]);
      expect(slams()).toHaveLength(1);
    }
    // A machine that is not the last is heard to go up at once, as any machine is, and there is no slam for it.
    const first = screenOf(fight(['gun-turret', 'tank'], [0]));
    first.kill(0);
    expect(first.played.filter((p) => p.name === 'unitDestroyed')).toEqual([{ name: 'unitDestroyed', delay: 0 }]);
    for (let i = 0; i < 120; i++) first.screen.update(16);
    expect(first.played.filter((p) => p.name === 'unitDestroyed')).toEqual([{ name: 'unitDestroyed', delay: 0 }]);
    expect(first.played.filter((p) => p.name === 'slam')).toEqual([]);
  });

  test('a press that ends the close look takes its last blast\'s sound with it: nothing is heard over what comes after', () => {
    const { flow, screen, kill, played } = screenOf(fight(['gun-turret'], [0]));
    kill(0);
    screen.update(96);
    screen.onInput('confirm');
    expect(screen.motion.finish).toBeNull();
    for (let i = 0; i < 20 && flow.phase !== 'result'; i++) { screen.onInput('confirm'); screen.update(16); }
    expect(flow.phase).toBe('result');
    for (let i = 0; i < 200; i++) screen.update(16);
    // The blow was heard, as a slam; the blast that was never seen is not heard, and no sound was put by for later.
    expect(played.filter((p) => p.name === 'slam')).toEqual([{ name: 'slam', delay: 0 }]);
    expect(played.filter((p) => p.name === 'unitDestroyed')).toEqual([]);
    expect(played.every((p) => p.delay < 700)).toBe(true);
  });

  test('a press that goes on to the result before the machine is seen to go up: nothing is staged over the result', () => {
    // The message that a machine is destroyed comes up at the end of one frame; what is seen and heard of
    // it starts in the next. A press in between goes on to the result first.
    const { flow, screen, page, played } = screenOf(fight(['gun-turret'], [0]));
    const shown = (): boolean => flow.state.events.slice(0, flow.eventsShown).some((e) => e.type === 'unitDestroyed');
    for (let i = 0; i < 4000 && !shown(); i++) {
      if (flow.phase === 'action') { screen.onInput('confirm'); screen.onInput('confirm'); screen.onInput('confirm'); }
      screen.update(16);
    }
    expect(shown()).toBe(true);
    expect(screen.motion.breaking('enemy-0')).toBeNull();
    for (let i = 0; i < 6 && flow.phase !== 'result'; i++) screen.onInput('confirm');
    expect(flow.phase).toBe('result');
    for (let i = 0; i < 90; i++) {
      screen.update(16);
      expect(screen.motion.finish).toBeNull();
    }
    const after = page();
    expect(background(after).w).toBeLessThanOrEqual(322);
    expect(after.rects.filter((r) => r.color === BARS)).toEqual([]);
    expect(played.filter((p) => p.name === 'unitDestroyed')).toHaveLength(1);
  });

  test('the band comes down with the result: it is never up beside the word that the battle is over', () => {
    const { flow, screen, page } = screenOf(fight(['gun-turret'], [0], { overdrive: 'deadeye', drive: 100 }));
    screen.onInput('next');
    screen.update(16);
    expect(screen.motion.cutIn).toBe('DEADEYE');
    // A pilot who taps through: the last machine is shot and every message pressed past.
    const over = (): boolean => flow.phase === 'result';
    for (let i = 0; i < 200 && !over(); i++) {
      if (flow.phase === 'action') { screen.onInput('confirm'); screen.onInput('confirm'); screen.onInput('confirm'); }
      else screen.onInput('confirm');
      // The press that brings the result up is followed by a drawing, not by another moment of the battle.
      if (!over()) screen.update(16);
    }
    expect(flow.phase).toBe('result');
    // The band has had well under its nine tenths of a second, and is still counted as up.
    expect(screen.motion.cutIn).toBe('DEADEYE');
    // Drawn straight away, before another moment has passed, and after one.
    expect(page().rects.some((r) => r.color === BAND)).toBe(false);
    // (The small tag on the mech that says the Overdrive is still on is another matter: the band's name is the large one.)
    expect(page().texts.filter((t) => t.text === 'DEADEYE' && t.size === 20)).toEqual([]);
    screen.update(16);
    expect(screen.motion.cutIn).toBeNull();
    expect(page().rects.some((r) => r.color === BAND)).toBe(false);
  });

  test('with battles played faster the band is up for less, but long enough to read', () => {
    const upFor = (speed: number): number => {
      const { screen } = screenOf(fight(['gun-turret'], [], { overdrive: 'iron-skin', drive: 100 }), speed === 1 ? {} : { speed });
      screen.onInput('next');
      let ms = 0;
      for (; ms < 3000; ms += 16) { screen.update(16); if (ms > 0 && !screen.motion.cutIn) break; }
      return ms;
    };
    expect(Math.abs(upFor(1) - CUT_IN_MS)).toBeLessThanOrEqual(32);
    expect(Math.abs(upFor(1.5) - CUT_IN_MS / 1.5)).toBeLessThanOrEqual(32);
    // Faster than that makes no more difference: six tenths of a second is the least.
    expect(Math.abs(upFor(2.5) - CUT_IN_MS / 1.5)).toBeLessThanOrEqual(32);
    expect(Math.abs(upFor(4) - CUT_IN_MS / 1.5)).toBeLessThanOrEqual(32);
  });

  test('a whole battle at three times the speed with Auto Turn: the ceilings hold, and nothing staged is left over the result', () => {
    for (const seed of [3, 7, 11]) {
      const { flow, screen, page } = screenOf(fight(['gun-turret', 'recon-drone', 'tank'], [], { overdrive: 'deadeye', drive: 100 }, seed), { speed: 3 });
      let most = 0;
      let lights = 0;
      let drove = false;
      for (let i = 0; i < 40000 && flow.phase !== 'result'; i++) {
        if (flow.phase === 'action') {
          // The Overdrive goes off as soon as it can, and after that the turn is left to Auto Turn.
          if (!drove && flow.overdrive === 'ready') { screen.onInput('next'); drove = true; }
          const at = flow.menu.items.findIndex((item) => item.id === 'auto');
          for (let n = flow.menu.cursor; n < at; n++) screen.onInput('down');
          for (let n = flow.menu.cursor; n > at; n--) screen.onInput('up');
          screen.onInput('confirm');
        } else if (flow.phase !== 'animating') screen.onInput('confirm');
        screen.update(16);
        most = Math.max(most, screen.motion.particles);
        if (i % 7 === 0) {
          const drawn = onStage(page(), screen.motion.view);
          lights = Math.max(lights, drawn.glows.filter((g) => g.blend === 'lighter').length - eyesIn(drawn).length);
        }
      }
      expect(flow.phase, `seed ${seed}`).toBe('result');
      expect(drove).toBe(true);
      expect(most).toBeLessThanOrEqual(320);
      // Sixteen lights of the battle's own at most, the eyes of its machines apart; this ground has none of its own.
      expect(lights).toBeLessThanOrEqual(16);
      expect(lights).toBeGreaterThan(0);
      // The battle is over: no band, no close look, no bars, and the field at its own size.
      for (let i = 0; i < 200; i++) screen.update(16);
      expect(screen.motion.cutIn).toBeNull();
      expect(screen.motion.finish).toBeNull();
      const after = page();
      expect(after.rects.filter((r) => r.color === BAND || r.color === BARS)).toEqual([]);
      expect(background(after).w).toBeLessThanOrEqual(322);
      // What was thrown up has come down: only what a wreck keeps smoking with is left.
      expect(screen.motion.particles).toBeLessThan(40);
    }
  });

  test('a press while it lasts goes on to what is next, and the close look is over', () => {
    const { flow, screen, page, kill } = screenOf(fight(['gun-turret'], [0]));
    kill(0);
    screen.update(100);
    expect(screen.motion.finish).not.toBeNull();
    screen.onInput('confirm');
    expect(screen.motion.finish).toBeNull();
    expect(background(page()).w).toBeLessThanOrEqual(322);
    for (let i = 0; i < 10 && flow.phase !== 'result'; i++) { screen.onInput('confirm'); screen.update(16); }
    expect(flow.phase).toBe('result');
  });

  test('a calm picture keeps its distance: slow, between the bars, but not from close by; a hurried game stages nothing', () => {
    const calm = screenOf(fight(['gun-turret'], [0]), { calm: true });
    calm.kill(0);
    expect(calm.screen.motion.finish).not.toBeNull();
    calm.screen.update(200);
    expect(background(calm.page())).toMatchObject({ x: 0, y: pictureTop(PLAIN), w: 310, h: 270 });
    expect(calm.page().rects.filter((r) => r.color === BARS)).toHaveLength(2);
    const fast = screenOf(fight(['gun-turret'], [0]), { fast: true });
    for (let i = 0; i < 200 && fast.flow.phase !== 'result'; i++) { if (fast.flow.phase === 'action') fast.fire(); fast.screen.update(16); expect(fast.screen.motion.finish).toBeNull(); }
    expect(fast.flow.phase).toBe('result');
    expect(fast.played.filter((p) => p.name === 'unitDestroyed')).toEqual([]);
  });

  test('the pilot\'s own mech going down is looked at the same way', () => {
    const state = fight(['tank'], []);
    for (const part of Object.values(state.units[0].parts)) if (part) part.ap = 1;
    const { flow, screen } = screenOf(state);
    let seen = false;
    for (let i = 0; i < 6000 && flow.phase !== 'result'; i++) {
      if (flow.phase === 'action') {
        // The pilot does nothing but end the turn, and the tank does the rest.
        const at = flow.menu.items.findIndex((item) => item.id === 'endTurn');
        for (let n = flow.menu.cursor; n < at; n++) screen.onInput('down');
        screen.onInput('confirm');
      }
      if (screen.motion.finish) { seen = true; break; }
      screen.update(16);
    }
    expect(flow.state.outcome).toBe('defeat');
    expect(seen).toBe(true);
    // Drawn round the pilot's mech: the left of the field.
    expect(screen.motion.finish!.x).toBeLessThan(155);
  });

  test('when it is over the field looks like what it was: light on one that was won, the colour gone from one that was lost', () => {
    const won = screenOf(fight(['gun-turret'], [0]));
    won.kill(0);
    for (let i = 0; i < 400 && won.flow.phase !== 'result'; i++) won.screen.update(16);
    expect(won.flow.state.outcome).toBe('victory');
    // Not yet: the look comes over the field once the battle has been over for a moment.
    won.screen.update(RESULT_IN_MS);
    const light = won.page();
    expect(light.washes.some((w) => w.blend === 'lighter' && w.stops[0][1] === 'rgba(255, 214, 150, 0.240)')).toBe(true);
    expect(light.shapes.length).toBe(RAYS * 2);
    expect(light.rects.some((r) => r.blend === 'saturation')).toBe(false);
    // The word is written over all of it in the sign's letters, in the game's colour and lit: its
    // middle where the font's word had its middle, in the box the result has always been in.
    const word = signIn(light, 'VICTORY', 'neon')!;
    expect(word).not.toBeNull();
    expect(word).toMatchObject({ tall: RESULT_TALL, level: 1, middle: 30 + RESULT_WORD_Y });
    expect(Math.abs(word.x + word.w / 2 - 155)).toBeLessThanOrEqual(0.5);
    expect(word.x).toBeGreaterThanOrEqual((310 - RESULT_W) / 2 + 8);
    expect(word.x + word.w).toBeLessThanOrEqual((310 + RESULT_W) / 2 - 8);
    expect(light.texts.some((t) => t.size === 32)).toBe(false);

    // Walking away from a battle loses it.
    const lost = screenOf(fight(['gun-turret'], []));
    const menu = lost.flow.menu.items.map((item) => item.id);
    for (let i = 0; i < menu.indexOf('retreat'); i++) lost.screen.onInput('down');
    lost.screen.onInput('confirm');
    lost.screen.onInput('down');
    lost.screen.onInput('confirm');
    for (let i = 0; i < 400 && lost.flow.phase !== 'result'; i++) lost.screen.update(16);
    expect(lost.flow.state.outcome).toBe('defeat');
    expect(lost.screen.motion.finish).toBeNull();
    lost.screen.update(RESULT_IN_MS);
    const grey = lost.page();
    const pall = grey.rects.find((r) => r.blend === 'saturation')!;
    expect(pall).toMatchObject({ x: 0, y: 14, w: 310, h: 164, color: GREY });
    expect(grey.shapes).toEqual([]);
    // Red, for a battle lost.
    expect(signIn(grey, 'DEFEAT', 'red')).toMatchObject({ tall: RESULT_TALL, level: 1, middle: 30 + RESULT_WORD_Y });
    expect(signIn(grey, 'DEFEAT', 'neon')).toBeNull();
    // The grey lies over the field and under the word: it is laid before the word's box.
    expect(grey.rects.indexOf(pall)).toBeLessThan(grey.rects.length - 1);

    // While a battle goes on there is neither.
    const going = screenOf(fight(['gun-turret'], [])).page();
    expect(going.rects.some((r) => r.blend === 'saturation')).toBe(false);
    expect(going.shapes).toEqual([]);

    // A hurried game has the look at once and standing still.
    const fast = screenOf(fight(['gun-turret'], [0]), { fast: true });
    for (let i = 0; i < 200 && fast.flow.phase !== 'result'; i++) { if (fast.flow.phase === 'action') fast.fire(); fast.screen.update(16); }
    const still = fast.page();
    expect(still.washes.some((w) => w.stops[0][1] === 'rgba(255, 214, 150, 0.240)')).toBe(true);
    expect(still.rects.filter((r) => /^rgba\(255, 226, 170, /.test(r.color))).toEqual([]);
  });
});

describe('the bill after a battle', () => {
  const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
  function bill(rank: Settlement['rank'], opts: { fast?: boolean; calm?: boolean } = {}) {
    const settlement = { net: 900, won: true, reward: 800, ammoCost: 40, repairCost: 60, lines: [], rank, bonus: rank === 'S' ? 200 : 0 } as unknown as Settlement;
    const app = {
      deps: { fast: opts.fast ?? false, sprites, catalog: CATALOG }, settings: { calm: opts.calm === true }, game: { credits: 5000 }, leaveSettlement: () => undefined,
    } as unknown as App;
    const screen = new SettlementScreen(app, settlement, MISSIONS[0]);
    return { screen, page: (): Drawn => record((ctx) => screen.draw(ctx)) };
  }
  const isLight = (g: { blend: string }): boolean => g.blend === 'lighter';
  /** The ring that runs out from the rank: single pixels in its colour, further from the letter than the letter is wide. */
  const ring = (page: Drawn, color: string) => page.rects.filter((r) => r.color === color && r.w === 1 && r.h === 1 && r.alpha < 1);

  test('the rank comes down after half a second, and as it lands a ring runs out from it; one that pays flares and throws sparks', () => {
    const { screen, page } = bill('S');
    screen.update(400);
    expect(page().texts.some((t) => t.text === 'S' && t.size === 32)).toBe(false);
    expect(ring(page(), COLORS.accent)).toEqual([]);
    // Landed: 500 to come down, 160 to land, and a moment after.
    screen.update(360);
    const landed = page();
    expect(landed.texts.find((t) => t.text === 'S' && t.size === 32)).toBeDefined();
    expect(ring(landed, COLORS.accent).length).toBeGreaterThan(8);
    expect(landed.rects.filter((r) => r.color === '#ffffff' && r.w === 1 && r.h === 1)).toHaveLength(STAMP_SPARKS);
    const flare = landed.glows.filter((g) => isLight(g) && g.r === 34);
    expect(flare).toHaveLength(1);
    // Round the letter: in the bill's upper right corner.
    expect(flare[0].x).toBeGreaterThan(200);
    expect(flare[0].y).toBeLessThan(60);
    // And then it is over.
    screen.update(STAMP_FX_MS);
    expect(ring(page(), COLORS.accent)).toEqual([]);
    expect(page().glows.filter((g) => isLight(g) && g.r === 34)).toEqual([]);
    expect(page().texts.find((t) => t.text === 'S' && t.size === 32)).toBeDefined();
  });

  test('a rank that does not pay gets the ring and no more; a bill without a rank, and a hurried game, get nothing', () => {
    const plain = bill('C');
    plain.screen.update(760);
    expect(ring(plain.page(), COLORS.dim).length).toBeGreaterThan(8);
    expect(plain.page().glows.filter((g) => isLight(g) && g.r === 34)).toEqual([]);
    const none = bill(undefined);
    none.screen.update(760);
    expect(none.page().rects.filter((r) => r.w === 1 && r.h === 1 && r.alpha < 1)).toEqual([]);
    const fast = bill('S', { fast: true });
    fast.screen.update(760);
    expect(fast.page().texts.find((t) => t.text === 'S' && t.size === 32)).toBeDefined();
    expect(ring(fast.page(), COLORS.accent)).toEqual([]);
    expect(fast.page().glows.filter((g) => isLight(g) && g.r === 34)).toEqual([]);
  });

  test('a calm picture has the flare of a rank that pays, and the hangar\'s lights, at half strength', () => {
    const at = (calm: boolean) => {
      const { screen, page } = bill('S', { calm });
      screen.update(760);
      const lights = page().glows.filter(isLight) as (Drawn['glows'][number])[];
      const level = (g: Drawn['glows'][number]): number => Number(/, ([\d.]+)\)$/.exec(g.stops[0][1])![1]);
      return { flare: level(lights.find((g) => g.r === 34)!), room: lights.filter((g) => g.r !== 34).map(level), sparks: page().rects.filter((r) => r.color === '#ffffff' && r.w === 1 && r.h === 1).length };
    };
    const plain = at(false);
    const calm = at(true);
    expect(calm.flare).toBeCloseTo(plain.flare / 2, 2);
    expect(calm.room.length).toBe(plain.room.length);
    expect(calm.room.length).toBeGreaterThanOrEqual(6);
    calm.room.forEach((level, i) => expect(level).toBeCloseTo(plain.room[i] / 2, 2));
    // The ring and the sparks are solid, and the same in both.
    expect(calm.sparks).toBe(plain.sparks);
    expect(calm.sparks).toBe(STAMP_SPARKS);
  });

  test('it is read in the hangar, and the hangar is lit behind it', () => {
    const { screen, page } = bill('A');
    screen.update(100);
    const lights = page().glows.filter(isLight);
    expect(lights.map((g) => [g.x, g.y])).toEqual(AMBIENCE['bg-garage'].lights.map((l) => [l.x, l.y]));
    // The lights are behind the bill: laid before its plate.
    const first = page();
    expect(first.images[0]).toMatchObject({ x: 0, y: 0, w: 310, h: 270 });
    expect(first.washes.length).toBeGreaterThan(0);
  });
});
