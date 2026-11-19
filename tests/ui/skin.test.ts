import { MenuList } from '../../src/ui/menuList';
import {
  BAR_H, CHAR_W, COLORS, LINE, PANEL_SHADOW, drawList, drawMenu, drawMeter, drawOutlined, drawPanel, drawRowLight, drawScrollMenu, drawTabs, drawText, shade,
} from '../../src/ui/widgets';
import { setLanguage } from '../../src/content/language';
import { SCENES } from '../../src/content/scenes';
import { accept, done, inHub, press, select, snap, strong } from '../helpers/app';
import { record, type Drawn, type Filled, type Washed } from '../helpers/canvas';

/** What was filled on a canvas that makes no gradients: the kind most tests draw on. */
function plain(draw: (ctx: CanvasRenderingContext2D) => void): { x: number; y: number; w: number; h: number; color: string }[] {
  const filled: { x: number; y: number; w: number; h: number; color: string }[] = [];
  const state: Record<string, unknown> = { fillStyle: '' };
  const ctx = new Proxy(state, {
    get: (t, name: string) => {
      if (name === 'fillRect') return (x: number, y: number, w: number, h: number) => { filled.push({ x, y, w, h, color: String(t.fillStyle) }); };
      if (name === 'measureText') return (text: string) => ({ width: text.length * 4.8 });
      // No gradients here: asking for one gets nothing.
      return name in t ? t[name] : () => undefined;
    },
    set: (t, name: string, value) => { t[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  draw(ctx);
  return filled;
}

type Box = { x: number; y: number; w: number; h: number };
const covers = (r: Box, x: number, y: number): boolean => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const within = (r: Box, box: Box): boolean => r.x >= box.x && r.y >= box.y && r.x + r.w <= box.x + box.w && r.y + r.h <= box.y + box.h;
const apart = (a: Box, b: Box): boolean => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
const area = (r: Box): number => r.w * r.h;

const PLATE_TOP = 'rgba(27, 25, 52, 0.95)';
const SHADOW_TOP = 'rgba(0, 0, 8, 0.5)';
const ROW_LIGHT = 'rgba(255, 93, 177, 0.3)';
const plate = (page: Drawn): Washed[] => page.washes.filter((w) => w.stops[0]?.[1] === PLATE_TOP);
const shadows = (page: Drawn): Washed[] => page.washes.filter((w) => w.stops[0]?.[1] === SHADOW_TOP);
const lit = (page: Drawn): Washed[] => page.washes.filter((w) => w.stops[0]?.[1] === ROW_LIGHT);
const frame = (page: Drawn): Filled[] => page.rects.filter((r) => r.color === COLORS.border || r.color === COLORS.accent);

describe('a colour, lighter or darker', () => {
  test('it goes towards white or towards black as far as it is told, and no further than there', () => {
    expect(shade('#204060', 0)).toBe('#204060');
    expect(shade('#204060', 0.5)).toBe('#90a0b0');
    expect(shade('#204060', -0.5)).toBe('#102030');
    expect(shade('#204060', 1)).toBe('#ffffff');
    expect(shade('#204060', -1)).toBe('#000000');
    expect(shade('#204060', 3)).toBe('#ffffff');
    expect(shade('#204060', -3)).toBe('#000000');
    expect(shade('#0A0b0C', 0)).toBe('#0a0b0c');
  });

  test('what is not a plain colour is handed back as it came', () => {
    expect(shade('rgba(1, 2, 3, 0.5)', 0.5)).toBe('rgba(1, 2, 3, 0.5)');
    expect(shade('#abc', 0.5)).toBe('#abc');
    expect(shade('', 0.5)).toBe('');
  });
});

describe('the box everything is written in', () => {
  const BOX = { x: 7, y: 20, w: 100, h: 60 };
  const drawn = (box = BOX): Drawn => record((ctx) => drawPanel(ctx, box.x, box.y, box.w, box.h));

  test('its plate is a little lighter at the top than at the bottom, in pieces that never lie over each other', () => {
    const pieces = plate(drawn());
    expect(pieces.length).toBeGreaterThan(1);
    for (const piece of pieces) {
      expect(within(piece, BOX)).toBe(true);
      expect(piece.blend).toBe('source-over');
      expect(piece.stops.map((s) => s[0])).toEqual([0, 0.45, 1]);
    }
    pieces.forEach((a, i) => pieces.slice(i + 1).forEach((b) => expect(apart(a, b)).toBe(true)));
    // All of the box but three pixels at each corner.
    expect(pieces.reduce((sum, piece) => sum + area(piece), 0)).toBe(BOX.w * BOX.h - 12);
  });

  test('its corners are cut: nothing at all is drawn on the three pixels at each', () => {
    const page = drawn();
    const { x, y, w, h } = BOX;
    const cut = [
      [x, y], [x + 1, y], [x, y + 1],
      [x + w - 1, y], [x + w - 2, y], [x + w - 1, y + 1],
      [x, y + h - 1], [x + 1, y + h - 1], [x, y + h - 2],
      [x + w - 1, y + h - 1], [x + w - 2, y + h - 1], [x + w - 1, y + h - 2],
    ];
    for (const [px, py] of cut) {
      expect([...page.rects, ...page.washes].filter((r) => covers(r, px, py))).toEqual([]);
    }
  });

  test('a frame goes all the way round, stepping round the corners, and nothing of it is outside the box', () => {
    const page = drawn();
    const { x, y, w, h } = BOX;
    const lines = frame(page);
    for (const line of lines) expect(within(line, BOX)).toBe(true);
    const on = (px: number, py: number): boolean => lines.some((line) => covers(line, px, py));
    for (let px = x + 2; px <= x + w - 3; px++) { expect(on(px, y)).toBe(true); expect(on(px, y + h - 1)).toBe(true); }
    for (let py = y + 2; py <= y + h - 3; py++) { expect(on(x, py)).toBe(true); expect(on(x + w - 1, py)).toBe(true); }
    for (const [px, py] of [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]]) expect(on(px, py)).toBe(true);
    // The frame is one pixel thick: the middle of the box has none of it.
    expect(on(x + 2, y + 2)).toBe(false);
    expect(on(x + w / 2, y + h / 2)).toBe(false);
  });

  test('the game\'s colour marks the top left and the bottom right, eight pixels each, and a line of light lies under the top edge', () => {
    const page = drawn();
    const { x, y, w, h } = BOX;
    const marks = page.rects.filter((r) => r.color === COLORS.accent);
    expect(marks.map(({ x: mx, y: my, w: mw, h: mh }) => ({ x: mx, y: my, w: mw, h: mh }))).toEqual([
      { x: x + 2, y, w: 8, h: 1 },
      { x: x + w - 10, y: y + h - 1, w: 8, h: 1 },
    ]);
    // The marks are drawn after the frame, so they are what shows.
    const last = (px: number, py: number) => [...page.rects].reverse().find((r) => covers(r, px, py))?.color;
    expect(last(x + 2, y)).toBe(COLORS.accent);
    expect(last(x + 10, y)).toBe(COLORS.border);
    expect(last(x + w - 3, y + h - 1)).toBe(COLORS.accent);
    const light = page.rects.filter((r) => r.y === y + 1 && r.h === 1 && r.w > 1);
    expect(light).toHaveLength(1);
    expect(light[0]).toMatchObject({ x: x + 3, w: w - 6 });
    expect(light[0].color).not.toBe(COLORS.border);
  });

  test('it stands off what is behind it: a soft shadow under its bottom edge, and nowhere else', () => {
    const page = drawn();
    const { x, y, w, h } = BOX;
    const fall = shadows(page);
    expect(fall).toHaveLength(1);
    expect(PANEL_SHADOW).toBe(4);
    expect(fall[0]).toMatchObject({ x: x + 2, y: y + h, w: w - 4, h: PANEL_SHADOW, blend: 'source-over' });
    expect(fall[0].stops).toEqual([[0, SHADOW_TOP], [1, 'rgba(0, 0, 8, 0)']]);
    // Everything else stays in the box.
    for (const r of [...page.rects, ...page.washes.filter((wash) => wash !== fall[0])]) expect(within(r, BOX)).toBe(true);
  });

  test.each([2, 3, 4, 5])('at %i times its size every line of it is on whole pixels of the screen and inside the box', (scale) => {
    const page = record((ctx) => { ctx.scale(scale, scale); drawPanel(ctx, BOX.x, BOX.y, BOX.w, BOX.h); });
    const box = { x: BOX.x * scale, y: BOX.y * scale, w: BOX.w * scale, h: (BOX.h + PANEL_SHADOW) * scale };
    const all = [...page.rects, ...page.washes];
    expect(all.length).toBeGreaterThan(10);
    for (const r of all) {
      for (const n of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(n)).toBe(true);
      expect(within(r, box)).toBe(true);
    }
  });

  test('a low one is a bar across the screen: one plate with square corners and a line under it', () => {
    expect(BAR_H).toBe(16);
    for (const h of [14, 15, BAR_H]) {
      const page = record((ctx) => drawPanel(ctx, 0, 0, 310, h));
      expect(plate(page).map(({ x, y, w, h: ph }) => ({ x, y, w, h: ph }))).toEqual([{ x: 0, y: 0, w: 310, h }]);
      const under = page.rects.filter((r) => r.color === COLORS.border);
      expect(under.map(({ x, y, w, h: lh }) => ({ x, y, w, h: lh }))).toEqual([{ x: 0, y: h - 1, w: 310, h: 1 }]);
      expect(shadows(page).map(({ x, y, w, h: sh }) => ({ x, y, w, h: sh }))).toEqual([{ x: 0, y: h, w: 310, h: PANEL_SHADOW }]);
    }
    // One pixel taller and it is a box.
    expect(plate(record((ctx) => drawPanel(ctx, 0, 0, 310, BAR_H + 1))).length).toBeGreaterThan(1);
  });

  test('the bar at the top of the screen carries the game\'s colour at its left end; a strip further down is plain', () => {
    const marks = (y: number) => record((ctx) => drawPanel(ctx, 0, y, 310, 14)).rects.filter((r) => r.color === COLORS.accent);
    expect(marks(0).map(({ x, y, w, h }) => ({ x, y, w, h }))).toEqual([{ x: 0, y: 13, w: 28, h: 1 }]);
    expect(marks(16)).toEqual([]);
    // A bar shorter than the mark is marked from end to end and no further.
    expect(record((ctx) => drawPanel(ctx, 0, 0, 20, 14)).rects.filter((r) => r.color === COLORS.accent)[0]).toMatchObject({ x: 0, w: 20 });
  });

  test('whatever its size, nothing of it has no size or a size turned inside out, and nothing leaves it but its shadow', () => {
    for (let w = 1; w <= 24; w++) {
      for (const h of [1, 2, 3, 5, 9, 16, 17, 18, 21, 40]) {
        const page = record((ctx) => drawPanel(ctx, 3, 5, w, h));
        const box = { x: 3, y: 5, w, h: h + PANEL_SHADOW };
        for (const r of [...page.rects, ...page.washes]) {
          expect(r.w).toBeGreaterThan(0);
          expect(r.h).toBeGreaterThan(0);
          expect(within(r, box)).toBe(true);
        }
        expect(plate(page).length).toBeGreaterThan(0);
      }
    }
  });

  test('on a canvas that makes no gradients it is the plain dark plate, framed, with no shadow', () => {
    const filled = plain((ctx) => drawPanel(ctx, BOX.x, BOX.y, BOX.w, BOX.h));
    expect(filled.length).toBeGreaterThan(8);
    for (const r of filled) expect(within(r, BOX)).toBe(true);
    const body = filled.filter((r) => r.color === COLORS.panel);
    expect(body.reduce((sum, r) => sum + area(r), 0)).toBe(BOX.w * BOX.h - 12);
    expect(filled.some((r) => r.color === COLORS.border)).toBe(true);
    expect(filled.filter((r) => r.color === COLORS.accent)).toHaveLength(2);
    // And a bar likewise.
    const bar = plain((ctx) => drawPanel(ctx, 0, 0, 310, 14));
    expect(bar[0]).toEqual({ x: 0, y: 0, w: 310, h: 14, color: COLORS.panel });
    for (const r of bar) expect(within(r, { x: 0, y: 0, w: 310, h: 14 })).toBe(true);
  });
});

describe('a bar that shows how much is left', () => {
  const bar = (w: number, h: number, value: number, max = 100) => record((ctx) => drawMeter(ctx, 10, 30, w, h, value, max, '#408040')).rects;
  const TICK = 'rgba(8, 8, 20, 0.45)';

  test('a thin one is two flat strokes, as it always was', () => {
    for (const h of [1, 2]) {
      expect(bar(60, h, 50).map(({ x, y, w, h: rh, color }) => ({ x, y, w, h: rh, color }))).toEqual([
        { x: 10, y: 30, w: 60, h, color: COLORS.empty },
        { x: 10, y: 30, w: 30, h, color: '#408040' },
      ]);
    }
  });

  test('one with height to it has light along its top, shade along its bottom and a bright end where it stops', () => {
    const rects = bar(60, 4, 50);
    const at = (color: string) => rects.filter((r) => r.color === color).map(({ x, y, w, h }) => ({ x, y, w, h }));
    expect(at(shade('#408040', 0.4))).toEqual([{ x: 10, y: 30, w: 30, h: 1 }]);
    expect(at(shade('#408040', -0.35))).toEqual([{ x: 10, y: 33, w: 30, h: 1 }]);
    expect(at(shade('#408040', 0.7))).toEqual([{ x: 39, y: 30, w: 1, h: 4 }]);
    // Three pixels is height enough.
    expect(bar(60, 3, 50).filter((r) => r.color === shade('#408040', 0.4))).toHaveLength(1);
  });

  test('a full one has no bright end, and an empty one no light at all', () => {
    expect(bar(60, 4, 100).filter((r) => r.color === shade('#408040', 0.7))).toEqual([]);
    expect(bar(60, 4, 100).filter((r) => r.color === shade('#408040', 0.4))).toHaveLength(1);
    const empty = bar(60, 4, 0);
    for (const tint of [0.4, -0.35, 0.7]) expect(empty.filter((r) => r.color === shade('#408040', tint))).toEqual([]);
    // Nothing to divide by is an empty bar too.
    expect(bar(60, 4, 5, 0).filter((r) => r.color === shade('#408040', 0.4))).toEqual([]);
  });

  test('a long one is marked at every tenth, inside the bar; a short one is not', () => {
    const marks = bar(60, 4, 50).filter((r) => r.color === TICK);
    expect(marks.map((r) => r.x)).toEqual([16, 22, 28, 34, 40, 46, 52, 58, 64]);
    for (const mark of marks) expect(mark).toMatchObject({ y: 30, w: 1, h: 4 });
    expect(bar(50, 4, 50).filter((r) => r.color === TICK)).toHaveLength(9);
    expect(bar(49, 4, 50).filter((r) => r.color === TICK)).toEqual([]);
    // A thin one is never marked, however long.
    expect(bar(200, 2, 50).filter((r) => r.color === TICK)).toEqual([]);
    // The marks are the last thing drawn: they show over the fill and over the empty part alike.
    const all = bar(60, 4, 50);
    expect(all.slice(-9).every((r) => r.color === TICK)).toBe(true);
  });

  test('nothing of it is ever outside the bar', () => {
    for (const value of [0, 1, 33, 99, 100, 250, -5]) {
      for (const r of bar(77, 5, value)) expect(within(r, { x: 10, y: 30, w: 77, h: 5 })).toBe(true);
    }
  });
});

describe('the row the cursor is on', () => {
  const items = [
    { id: 'a', label: 'Fire', enabled: true },
    { id: 'b', label: 'Field Repair', enabled: true, note: '2' },
    { id: 'c', label: 'Retreat', enabled: false },
  ];

  test('is lit from the left in the game\'s colour, fading out to nothing at its right end', () => {
    const page = record((ctx) => drawRowLight(ctx, 20, 50, 90));
    expect(page.rects).toEqual([]);
    expect(page.washes).toHaveLength(1);
    expect(page.washes[0]).toMatchObject({ x: 20, y: 50, w: 90, h: LINE, blend: 'source-over' });
    expect(page.washes[0].stops).toEqual([[0, ROW_LIGHT], [0.6, 'rgba(255, 93, 177, 0.1)'], [1, 'rgba(255, 93, 177, 0)']]);
    // A row that is taller than a line of text is lit as tall as it is told.
    expect(record((ctx) => drawRowLight(ctx, 20, 50, 90, 21)).washes[0]).toMatchObject({ y: 50, h: 21 });
  });

  test('a canvas that makes no gradients is left as it is', () => {
    expect(plain((ctx) => drawRowLight(ctx, 20, 50, 90))).toEqual([]);
    expect(plain((ctx) => drawMenu(ctx, 6, 100, items, 1))).toEqual([]);
  });

  test('in a menu the light is behind the row chosen and no other, and reaches past the widest row', () => {
    for (const cursor of [0, 1, 2]) {
      const page = record((ctx) => drawMenu(ctx, 6, 100, items, cursor));
      const light = lit(page);
      expect(light).toHaveLength(1);
      const mark = page.texts.find((t) => t.text === '>')!;
      expect(mark.y).toBe(100 + cursor * LINE);
      expect(light[0]).toMatchObject({ x: 3, y: mark.y + 1, h: LINE });
      const widest = Math.max(...page.texts.map((t) => t.right));
      expect(light[0].x + light[0].w).toBeGreaterThan(widest);
      expect(light[0].w).toBe(Math.round('Field Repair'.length * CHAR_W) + 20);
      // The light is laid down first: the words are written over it.
      expect(page.texts.map((t) => t.text)).toEqual(expect.arrayContaining(['>', 'Fire', 'Field Repair', 'Retreat']));
    }
    // No row chosen, no light.
    expect(lit(record((ctx) => drawMenu(ctx, 6, 100, items, -1)))).toEqual([]);
    expect(lit(record((ctx) => drawMenu(ctx, 6, 100, [], 0)))).toEqual([]);
  });

  test('a menu that scrolls lights the row where the cursor is shown, not where it is in the whole list', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ label: `Row ${i}`, enabled: true }));
    const page = record((ctx) => drawScrollMenu(ctx, 6, 100, many, 9, 4));
    const mark = page.texts.find((t) => t.text === '>')!;
    const label = page.texts.find((t) => t.text === 'Row 9')!;
    expect(label.y).toBe(mark.y);
    expect(lit(page).map((l) => l.y)).toEqual([mark.y + 1]);
    expect(mark.y).toBeLessThan(100 + 4 * LINE);
  });

  test('in a list the light runs the width of the list, from just before the mark to the note', () => {
    const list = new MenuList(items, 1);
    const page = record((ctx) => drawList(ctx, list, 12, 40, 120, 3));
    const light = lit(page);
    expect(light).toHaveLength(1);
    expect(light[0]).toMatchObject({ x: 9, y: 40 + LINE + 1, w: 123, h: LINE });
    const note = page.texts.find((t) => t.text === '2')!;
    expect(light[0].x + light[0].w).toBe(note.right);
    // Texts are where they were before there was any light.
    expect(page.texts.find((t) => t.text === '>')).toMatchObject({ x: 12, y: 40 + LINE });
    expect(page.texts.find((t) => t.text === 'Field Repair')).toMatchObject({ x: 20, y: 40 + LINE });
    // A list that has scrolled lights the row on screen.
    const long = new MenuList(Array.from({ length: 20 }, (_, i) => ({ id: `r${i}`, label: `Row ${i}`, enabled: true })), 15);
    const scrolled = record((ctx) => drawList(ctx, long, 12, 40, 120, 5));
    expect(lit(scrolled).map((l) => l.y)).toEqual([scrolled.texts.find((t) => t.text === 'Row 15')!.y + 1]);
  });
});

describe('the names of the pages along the top', () => {
  test('the page that is open is underlined from the first letter of its name to the last, and no other is', () => {
    const labels = ['PERKS', 'MEDALS', 'RECORD', 'DRIVE'];
    for (let current = 0; current < labels.length; current++) {
      const page = record((ctx) => drawTabs(ctx, 305, 1, labels, current));
      expect(page.rects).toHaveLength(1);
      const name = page.texts.find((t) => t.text === labels[current])!;
      expect(name.color).toBe(COLORS.accent);
      expect(page.rects[0]).toMatchObject({ y: 12, h: 1, color: COLORS.accent });
      expect(page.rects[0].x).toBeCloseTo(name.left, 0);
      expect(page.rects[0].x + page.rects[0].w).toBe(name.right);
      expect(page.rects[0].w).toBe(Math.round(labels[current].length * CHAR_W));
      for (const other of page.texts.filter((t) => t !== name)) expect(other.color).toBe(COLORS.dim);
    }
    // Where they are written has not changed: the last name ends at the right, the others eight pixels apart.
    const page = record((ctx) => drawTabs(ctx, 305, 1, labels, 0));
    expect(page.texts.find((t) => t.text === 'DRIVE')!.right).toBe(305);
    expect(page.texts.find((t) => t.text === 'RECORD')!.right).toBe(305 - Math.round(5 * CHAR_W) - 8);
    // No page open, nothing underlined.
    expect(record((ctx) => drawTabs(ctx, 305, 1, labels, -1)).rects).toEqual([]);
  });
});

describe('the cursor\'s light on the screens that draw their own rows', () => {
  const picture = (app: { draw(ctx: CanvasRenderingContext2D): void }): Drawn => record((ctx) => app.draw(ctx));
  /** The light behind the mark: on its row, starting before it, and reaching past whatever is written on that row left of `until`. */
  const behind = (page: Drawn, height = LINE, until = 310): Washed => {
    const marks = page.texts.filter((t) => t.text === '>');
    expect(marks).toHaveLength(1);
    const light = lit(page);
    expect(light).toHaveLength(1);
    expect(light[0]).toMatchObject({ y: marks[0].y + 1, h: height });
    expect(light[0].x).toBeLessThan(marks[0].left);
    const row = page.texts.filter((t) => t.y >= marks[0].y && t.y <= marks[0].y + 1 && t.left >= marks[0].left && t.left < until);
    expect(row.length).toBeGreaterThan(1);
    expect(light[0].x + light[0].w).toBeGreaterThanOrEqual(Math.max(...row.map((t) => t.right)));
    return light[0];
  };

  test('the garage: the slot the cursor is on, and it follows the cursor down', () => {
    const { app } = inHub();
    select(app, 'garage');
    const first = behind(picture(app));
    press(app, 'down');
    const second = behind(picture(app));
    expect(second.y).toBe(first.y + 15);
    expect(second.x).toBe(first.x);
    // The light stays inside the list's own box.
    expect(first.x).toBeGreaterThan(162);
    expect(first.x + first.w).toBeLessThan(310);
  });

  test('the garage: the builds that were saved, and what can be done with one', () => {
    const { app } = inHub();
    select(app, 'garage');
    press(app, 'right');
    expect(snap(app).menu.items.length).toBe(7);
    behind(picture(app));
    press(app, 'confirm');
    // Two lists are on screen now; the one being answered is lit.
    const page = picture(app);
    const marks = page.texts.filter((t) => t.text === '>');
    expect(marks.length).toBe(2);
    const menu = marks.reduce((a, b) => (a.y > b.y ? a : b));
    expect(lit(page).map((l) => l.y)).toContain(menu.y + 1);
  });

  test('the battle: the weapon the cursor is on, as tall as the two lines each weapon takes', () => {
    const { app } = inHub();
    accept(app, 'patrol');
    for (let i = 0; i < 4000 && snap(app).battle?.phase !== 'action'; i++) {
      if (snap(app).battle!.phase === 'animating') app.update(16);
      else press(app, 'confirm');
    }
    press(app, 'confirm');
    expect(snap(app).battle?.phase).toBe('weapon');
    const page = picture(app);
    // The other half of the panel is the mech's own page: the row is what is written in the menu's half.
    const light = behind(page, 2 * LINE - 1, 154);
    // The cost under the weapon's name is on the light too, and the light stays in the menu's half.
    const mark = page.texts.find((t) => t.text === '>')!;
    const cost = page.texts.find((t) => t.y === mark.y + LINE - 1 && t.left > mark.left && t.left < 154)!;
    expect(cost).toBeDefined();
    expect(light.x + light.w).toBeGreaterThanOrEqual(cost.right);
    expect(light.x + light.w).toBeLessThan(154);
  });

  test('the pilot: the medal the cursor is on', () => {
    const { app } = inHub();
    select(app, 'pilot');
    press(app, 'next');
    expect(snap(app).page).toBe('medals');
    const first = behind(picture(app));
    press(app, 'down');
    expect(behind(picture(app)).y).toBe(first.y + LINE);
    expect(first.x).toBeGreaterThan(4);
    expect(first.x + first.w).toBeLessThan(306);
  });
});

describe('what is written at the right of a row', () => {
  const rows = (note: string) => [
    { id: 'a', label: 'Arena', enabled: false, note },
    { id: 'g', label: 'The Gauntlet', enabled: false, note },
  ];
  const noteOn = (page: Drawn, label: string) => {
    const name = page.texts.find((t) => t.text === label)!;
    const note = page.texts.find((t) => t.y >= name.y && t.y <= name.y + 1 && t.align === 'right')!;
    return { name, note };
  };

  test('a note that would run into the name beside it is written smaller, and then stands clear of it', () => {
    const page = record((ctx) => drawList(ctx, new MenuList(rows('after Hot Barrel')), 156, 96, 140, 10));
    const tight = noteOn(page, 'The Gauntlet');
    expect(tight.note).toMatchObject({ text: 'after Hot Barrel', size: 10, right: 296, y: tight.name.y + 1 });
    // At the usual size it would have touched; now there is more than a letter's width between them.
    expect(296 - 'after Hot Barrel'.length * CHAR_W).toBeLessThan(tight.name.right + CHAR_W);
    expect(tight.note.left - tight.name.right).toBeGreaterThan(CHAR_W);
  });

  test('where one row needs that, every note of the list is written so: the same words are not in two sizes on two rows', () => {
    const page = record((ctx) => drawList(ctx, new MenuList(rows('after Hot Barrel')), 156, 96, 140, 10));
    // Beside "Arena" the note had room at the usual size; it is written as the one under it is.
    const roomy = noteOn(page, 'Arena');
    expect(296 - 'after Hot Barrel'.length * CHAR_W).toBeGreaterThan(roomy.name.right + CHAR_W);
    expect(roomy.note).toMatchObject({ text: 'after Hot Barrel', size: 10, right: 296, y: roomy.name.y + 1 });
    expect(noteOn(page, 'The Gauntlet').note.size).toBe(10);
  });

  test('that holds whichever rows are in view: scrolling a list does not change the size its notes are written at', () => {
    const many = [
      ...Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, label: `Row ${i}`, enabled: true, note: '150' })),
      { id: 'long', label: 'A Name As Long As This One', enabled: true, note: '150' },
    ];
    // Three rows in view from the top: the long name is four rows further down.
    const top = record((ctx) => drawList(ctx, new MenuList(many, 0), 156, 96, 140, 3));
    expect(top.texts.some((t) => t.text === 'A Name As Long As This One')).toBe(false);
    expect(top.texts.filter((t) => t.text === '150').map((t) => t.size)).toEqual([10, 10, 10]);
    const foot = record((ctx) => drawList(ctx, new MenuList(many, 6), 156, 96, 140, 3));
    expect(foot.texts.some((t) => t.text === 'A Name As Long As This One')).toBe(true);
    expect(foot.texts.filter((t) => t.text === '150').map((t) => t.size)).toEqual([10, 10, 10]);
    // A list in which nothing is tight is left at the usual size.
    const easy = record((ctx) => drawList(ctx, new MenuList(many.slice(0, 6), 0), 156, 96, 140, 3));
    expect(easy.texts.filter((t) => t.text === '150').map((t) => t.size)).toEqual([12, 12, 12]);
  });

  test('one that fits with a letter to spare is left at its size', () => {
    // Twelve letters of name from 164 end at 221.6: a note may start at 226.4 or later, which is fourteen letters.
    const fits = record((ctx) => drawList(ctx, new MenuList(rows('12345678901234')), 156, 96, 140, 10));
    expect(noteOn(fits, 'The Gauntlet').note.size).toBe(12);
    expect(noteOn(fits, 'Arena').note.size).toBe(12);
    const over = record((ctx) => drawList(ctx, new MenuList(rows('123456789012345')), 156, 96, 140, 10));
    expect(noteOn(over, 'The Gauntlet').note.size).toBe(10);
  });

  test('in the hub of a new pilot, nothing on a locked row touches anything else on it', () => {
    const { app } = inHub();
    const page = record((ctx) => app.draw(ctx));
    for (const label of ['Arena', 'The Gauntlet']) {
      const { name, note } = noteOn(page, label);
      expect(note.text).toBe('after Hot Barrel');
      expect(note.left - name.right, label).toBeGreaterThan(CHAR_W);
    }
  });
});

describe('words over a picture', () => {
  test('are written once in a dark colour a pixel off in each of eight directions, and then themselves on top', () => {
    const page = record((ctx) => drawOutlined(ctx, 'Hold fast', 100, 40, { align: 'center', color: '#e4e2f0', size: 12 }));
    expect(page.texts).toHaveLength(9);
    expect(page.texts.at(-1)).toMatchObject({ text: 'Hold fast', x: 100, y: 40, color: '#e4e2f0', align: 'center', size: 12 });
    const round = page.texts.slice(0, 8);
    expect(round.map((t) => [t.x - 100, t.y - 40])).toEqual([[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]);
    for (const t of round) expect(t).toMatchObject({ text: 'Hold fast', color: '#07061a', align: 'center', size: 12 });
    // The edge can be given another colour, and the words keep whatever else was asked.
    const other = record((ctx) => drawOutlined(ctx, 'x', 5, 5, { size: 16 }, '#102030'));
    expect(other.texts[0]).toMatchObject({ color: '#102030', size: 16 });
    expect(other.texts.at(-1)).toMatchObject({ color: COLORS.text, size: 16 });
  });
});

describe('soft light and shadow, on every screen and in both languages', () => {
  afterEach(() => setLanguage('en'));
  const named = { sprites: { get: (id: string, fallback: { w: number; h: number }) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) } };
  /**
   * The words of a screen that something soft was laid over after they were written: a light, the
   * shadow under a box, or the light behind a row. (One box drawn over another is another matter.)
   */
  function smudged(page: Drawn): string[] {
    const found: string[] = [];
    const soft = (step: Drawn['order'][number]): { x: number; y: number; w: number; h: number } | null => {
      if (step.kind === 'glow') {
        const g = page.glows[step.at];
        // The darker edges of a room are laid over the whole of its picture, before anything is written.
        return { x: g.x - Math.abs(g.r), y: g.y - Math.abs(g.ry), w: Math.abs(g.r) * 2, h: Math.abs(g.ry) * 2 };
      }
      if (step.kind === 'wash') {
        const w = page.washes[step.at];
        return [SHADOW_TOP, ROW_LIGHT].includes(w.stops[0]?.[1]) ? w : null;
      }
      return null;
    };
    page.order.forEach((step, i) => {
      if (step.kind !== 'text') return;
      const t = page.texts[step.at];
      if (t.text.trim() === '') return;
      const box = { x: t.left, y: t.y + 2, w: t.right - t.left, h: t.size - 4 };
      for (const later of page.order.slice(i + 1)) {
        const over = soft(later);
        if (over && over.w > 0 && over.h > 0 && !apart(box, over)) { found.push(`${t.text} (${later.kind})`); break; }
      }
    });
    return found;
  }

  test.each(['en', 'nl'] as const)('%s: nothing soft is laid over a word after it was written', (language) => {
    const base = strong(done('intro-1', 'intro-2'));
    const { app } = inHub({ ...base, scenes: SCENES.map((scene) => scene.id), settings: { ...base.settings, language } }, undefined, named);
    const seen: string[] = [];
    const look = (what: string): void => {
      const page = record((ctx) => app.draw(ctx));
      expect(page.texts.length, what).toBeGreaterThan(3);
      expect(smudged(page), `${language} ${what}`).toEqual([]);
      seen.push(what);
    };
    // Whatever was announced as the hub came up is waited out: an announcement is a box over the screen.
    for (let i = 0; i < 400; i++) app.update(100);
    look('hub');
    select(app, 'contracts');
    look('contracts');
    press(app, 'confirm');
    if (snap(app).screen === 'briefing') { look('briefing'); press(app, 'cancel'); }
    press(app, 'cancel');
    for (const room of ['arena', 'training', 'gauntlet', 'shop', 'messages', 'options']) {
      select(app, room);
      expect(snap(app).screen, room).toBe(room);
      look(room);
      press(app, 'cancel');
      expect(snap(app).screen, room).toBe('hub');
    }
    select(app, 'garage');
    look('garage slots');
    press(app, 'confirm');
    look('garage parts');
    press(app, 'cancel', 'right');
    look('garage builds');
    press(app, 'confirm');
    look('garage build menu');
    press(app, 'cancel', 'cancel', 'cancel');
    if (snap(app).screen !== 'hub') press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
    for (const paged of ['pilot', 'database']) {
      select(app, paged);
      for (let n = 0; n < 5; n++) { look(`${paged} page ${n}`); press(app, 'next'); }
      press(app, 'cancel');
      expect(snap(app).screen).toBe('hub');
    }
    expect(seen.length).toBeGreaterThanOrEqual(21);
  });

  test('the check itself: a light laid over a word after it was written is found, and one laid before it is not', () => {
    const after = record((ctx) => {
      drawText(ctx, 'Word', 20, 30);
      drawRowLight(ctx, 10, 28, 80);
    });
    expect(smudged(after)).toEqual(['Word (wash)']);
    const before = record((ctx) => {
      drawRowLight(ctx, 10, 28, 80);
      drawText(ctx, 'Word', 20, 30);
    });
    expect(smudged(before)).toEqual([]);
    const shadow = record((ctx) => {
      drawText(ctx, 'Hint', 20, 61);
      drawPanel(ctx, 10, 20, 100, 40);
    });
    expect(smudged(shadow)).toEqual(['Hint (wash)']);
    const clear = record((ctx) => {
      drawText(ctx, 'Hint', 20, 66);
      drawPanel(ctx, 10, 20, 100, 40);
    });
    expect(smudged(clear)).toEqual([]);
  });
});
