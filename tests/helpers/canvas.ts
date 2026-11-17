import { LINE, MAX_TALL, MIN_TALL, canWrite, drawWord, wordHeight, wordWidth, type Metal } from '../../src/ui/signType';

/** One piece of text as it was written: its row, where it starts and ends on it, how large it is and in what colour. */
export interface Written {
  text: string;
  x: number;
  y: number;
  left: number;
  right: number;
  size: number;
  align: string;
  color: string;
}
export interface Filled { x: number; y: number; w: number; h: number; color: string; blend: string; alpha: number }
/** A picture as it was drawn: what it was handed (a sprite store that names its pictures makes this tellable) and where. */
export interface Pictured {
  image: unknown; x: number; y: number; w: number; h: number; blend: string; alpha: number; filter: string;
  /** The box the drawing was kept inside when the picture was drawn, or null when it was free to go anywhere. */
  clip: { x: number; y: number; w: number; h: number } | null;
  /** The part of the picture that was drawn, where it was not all of it. */
  from?: Box;
}
/** A soft light or shadow: a round gradient, where its middle is, how far it reaches, its colours and how it was laid on. */
export interface Glowed { x: number; y: number; r: number; ry: number; stops: [number, string][]; blend: string }
/** A gradient that runs in a line, laid over a rectangle: where the rectangle is, the gradient's colours, and how it was laid on. */
export interface Washed { x: number; y: number; w: number; h: number; stops: [number, string][]; blend: string }
/** A line that was stroked: its points, how wide, in what colour and how it was laid on. */
export interface Stroked { points: { x: number; y: number }[]; width: number; color: string; blend: string }
/** A shape that was filled: its corners, what it was filled with (a colour, or a gradient's colours) and how it was laid on. */
export interface Shaped { points: { x: number; y: number }[]; color: string; stops: [number, string][]; blend: string }
/** One thing that was drawn, by what kind of thing it was and its place among those of its kind. */
export interface Step { kind: 'text' | 'rect' | 'image' | 'glow' | 'stroke' | 'wash' | 'shape'; at: number }
/** A box on the screen. */
export interface Box { x: number; y: number; w: number; h: number }
export interface Drawn {
  texts: Written[]; rects: Filled[]; images: Pictured[]; glows: Glowed[]; strokes: Stroked[]; washes: Washed[]; shapes: Shaped[];
  /** Everything that was drawn, in the order it was drawn in: what comes later lies over what came before. */
  order: Step[];
  /** The box the drawing was kept inside as each text, rectangle, light, line, shape and wash was drawn (a picture says so itself): null where it was free. */
  kept: { texts: (Box | null)[]; rects: (Box | null)[]; glows: (Box | null)[]; strokes: (Box | null)[]; shapes: (Box | null)[]; washes: (Box | null)[] };
}

interface Gradient { x: number; y: number; r: number; linear?: boolean; stops: [number, string][]; addColorStop(offset: number, color: string): void }
const isGradient = (style: unknown): style is Gradient => typeof style === 'object' && style !== null && Array.isArray((style as Gradient).stops);

/**
 * Draws on a canvas that paints nothing and remembers what it was asked to write, fill, stroke and
 * light, and where: positions are where things end up, with whatever the drawing moved or scaled
 * the canvas by taken into account. A letter is as wide as the game takes it to be: four tenths of
 * its size.
 */
export function record(draw: (ctx: CanvasRenderingContext2D) => void): Drawn {
  const { ctx, drawn } = recorder();
  draw(ctx);
  return drawn;
}

/**
 * Such a canvas to keep: what is drawn on it, whenever it is drawn, is added to what it remembers.
 * `wiped` is every time a part of it was cleared: which part, and how many things had been drawn on it by then.
 */
export function recorder(): { ctx: CanvasRenderingContext2D; drawn: Drawn; wiped: (Box & { after: number })[] } {
  const texts: Written[] = [];
  const rects: Filled[] = [];
  const images: Pictured[] = [];
  const glows: Glowed[] = [];
  const strokes: Stroked[] = [];
  const washes: Washed[] = [];
  const shapes: Shaped[] = [];
  const order: Step[] = [];
  const kept: Drawn['kept'] = { texts: [], rects: [], glows: [], strokes: [], shapes: [], washes: [] };
  const wiped: (Box & { after: number })[] = [];
  const state: Record<string, unknown> = {
    font: '12px x', textAlign: 'left', fillStyle: '', strokeStyle: '', lineWidth: 1, globalCompositeOperation: 'source-over', globalAlpha: 1, filter: 'none',
  };
  // Where the drawing has moved the canvas to, and by how much it has scaled it.
  let at = { tx: 0, ty: 0, sx: 1, sy: 1 };
  // What the drawing is kept inside, and the last box that was laid out as a path.
  let clip: Box | null = null;
  let boxed: Box | null = null;
  const saved: { at: typeof at; state: Record<string, unknown>; clip: Box | null }[] = [];
  let path: { x: number; y: number }[] = [];
  const X = (x: number): number => at.tx + x * at.sx;
  const Y = (y: number): number => at.ty + y * at.sy;
  const size = (): number => Number(/(\d+(?:\.\d+)?)px/.exec(String(state.font))?.[1] ?? 12);
  const methods: Record<string, (...args: unknown[]) => unknown> = {
    measureText: (text) => ({ width: String(text).length * size() * 0.4 }),
    save: () => { saved.push({ at: { ...at }, state: { ...state }, clip }); },
    restore: () => {
      const back = saved.pop();
      if (!back) return;
      at = back.at;
      clip = back.clip;
      for (const key of Object.keys(state)) delete state[key];
      Object.assign(state, back.state);
    },
    translate: (x, y) => { at = { ...at, tx: X(Number(x)), ty: Y(Number(y)) }; },
    scale: (x, y) => { at = { ...at, sx: at.sx * Number(x), sy: at.sy * Number(y) }; },
    createRadialGradient: (_x0, _y0, _r0, x1, y1, r1) => {
      const gradient: Gradient = { x: Number(x1), y: Number(y1), r: Number(r1), stops: [], addColorStop(offset, color) { this.stops.push([offset, color]); } };
      return gradient;
    },
    createLinearGradient: () => {
      const gradient: Gradient = { x: 0, y: 0, r: 0, linear: true, stops: [], addColorStop(offset, color) { this.stops.push([offset, color]); } };
      return gradient;
    },
    fillText: (text, x, y) => {
      const said = String(text);
      const width = said.length * size() * 0.4 * at.sx;
      const align = String(state.textAlign);
      const where = X(Number(x));
      const left = align === 'right' ? where - width : align === 'center' ? where - width / 2 : where;
      order.push({ kind: 'text', at: texts.length });
      kept.texts.push(clip ? { ...clip } : null);
      texts.push({ text: said, x: where, y: Y(Number(y)), left, right: left + width, size: size(), align, color: String(state.fillStyle) });
    },
    fillRect: (x, y, w, h) => {
      const style = state.fillStyle;
      if (isGradient(style) && style.linear) {
        order.push({ kind: 'wash', at: washes.length });
        kept.washes.push(clip ? { ...clip } : null);
        washes.push({ x: X(Number(x)), y: Y(Number(y)), w: Number(w) * at.sx, h: Number(h) * at.sy, stops: style.stops, blend: String(state.globalCompositeOperation) });
        return;
      }
      if (isGradient(style)) {
        order.push({ kind: 'glow', at: glows.length });
        kept.glows.push(clip ? { ...clip } : null);
        glows.push({ x: X(style.x), y: Y(style.y), r: style.r * at.sx, ry: style.r * at.sy, stops: style.stops, blend: String(state.globalCompositeOperation) });
        return;
      }
      order.push({ kind: 'rect', at: rects.length });
      kept.rects.push(clip ? { ...clip } : null);
      rects.push({ x: X(Number(x)), y: Y(Number(y)), w: Number(w) * at.sx, h: Number(h) * at.sy, color: String(style), blend: String(state.globalCompositeOperation), alpha: Number(state.globalAlpha) });
    },
    drawImage: (image, ...where) => {
      // With eight numbers, the first four say which part of the picture is drawn and the last four where it goes.
      const part = where.length >= 8;
      const [x, y, w, h] = part ? where.slice(4) : where;
      order.push({ kind: 'image', at: images.length });
      images.push({
        image, x: X(Number(x)), y: Y(Number(y)), w: Number(w) * at.sx, h: Number(h) * at.sy,
        blend: String(state.globalCompositeOperation), alpha: Number(state.globalAlpha), filter: String(state.filter), clip: clip ? { ...clip } : null,
        ...(part ? { from: { x: Number(where[0]), y: Number(where[1]), w: Number(where[2]), h: Number(where[3]) } } : {}),
      });
    },
    clearRect: (x, y, w, h) => { wiped.push({ x: X(Number(x)), y: Y(Number(y)), w: Number(w) * at.sx, h: Number(h) * at.sy, after: order.length }); },
    beginPath: () => { path = []; boxed = null; },
    rect: (x, y, w, h) => { boxed = { x: X(Number(x)), y: Y(Number(y)), w: Number(w) * at.sx, h: Number(h) * at.sy }; },
    clip: () => {
      if (!boxed) return;
      if (!clip) { clip = boxed; return; }
      const x = Math.max(clip.x, boxed.x);
      const y = Math.max(clip.y, boxed.y);
      clip = { x, y, w: Math.max(0, Math.min(clip.x + clip.w, boxed.x + boxed.w) - x), h: Math.max(0, Math.min(clip.y + clip.h, boxed.y + boxed.h) - y) };
    },
    moveTo: (x, y) => { path.push({ x: X(Number(x)), y: Y(Number(y)) }); },
    lineTo: (x, y) => { path.push({ x: X(Number(x)), y: Y(Number(y)) }); },
    stroke: () => { order.push({ kind: 'stroke', at: strokes.length }); kept.strokes.push(clip ? { ...clip } : null); strokes.push({ points: [...path], width: Number(state.lineWidth), color: String(state.strokeStyle), blend: String(state.globalCompositeOperation) }); },
    fill: () => {
      const style = state.fillStyle;
      order.push({ kind: 'shape', at: shapes.length });
      kept.shapes.push(clip ? { ...clip } : null);
      shapes.push({ points: [...path], color: isGradient(style) ? '' : String(style), stops: isGradient(style) ? style.stops : [], blend: String(state.globalCompositeOperation) });
    },
  };
  const ctx = new Proxy(state, {
    get: (t, name: string) => (name in t ? t[name] : methods[name] ?? (() => undefined)),
    set: (t, name: string, value) => { t[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, drawn: { texts, rects, images, glows, strokes, washes, shapes, order, kept }, wiped };
}

/** The field of a battle: what a camera that has left home keeps its drawing inside. */
const FIELD_BOX: Box = { x: 0, y: 14, w: 310, h: 164 };

/**
 * A battle's field as it stands on the stage, whatever the camera was doing when it was drawn. A
 * camera that has left home moves and scales everything on the field, and keeps the drawing
 * inside the field while it does: here every picture, light, rectangle and text that was drawn so
 * is put back where and as large as it is on the stage, and so is every line, shape and wash.
 * What was drawn over the field (a band, the panel, what is written along its top) is left as it
 * is. `view` is the screen's own account of where its camera is.
 */
export function onStage(drawn: Drawn, view: { x: number; y: number; zoom: number }): Drawn {
  const middle = { x: FIELD_BOX.w / 2, y: FIELD_BOX.y + FIELD_BOX.h / 2 };
  if (view.zoom === 1 && view.x === middle.x && view.y === middle.y) return drawn;
  const under = (box: Box | null): boolean => !!box && box.x === FIELD_BOX.x && box.y === FIELD_BOX.y && box.w === FIELD_BOX.w && box.h === FIELD_BOX.h;
  // To a ten-thousandth of a pixel: what stands on whole pixels on the stage comes back on them.
  const whole = (n: number): number => Math.round(n * 1e4) / 1e4;
  const x = (n: number): number => whole((n - middle.x) / view.zoom + view.x);
  const y = (n: number): number => whole((n - middle.y) / view.zoom + view.y);
  const size = (n: number): number => whole(n / view.zoom);
  return {
    ...drawn,
    images: drawn.images.map((image) => (under(image.clip) ? { ...image, x: x(image.x), y: y(image.y), w: size(image.w), h: size(image.h) } : image)),
    glows: drawn.glows.map((glow, i) => (under(drawn.kept.glows[i]) ? { ...glow, x: x(glow.x), y: y(glow.y), r: size(glow.r), ry: size(glow.ry) } : glow)),
    rects: drawn.rects.map((rect, i) => (under(drawn.kept.rects[i]) ? { ...rect, x: x(rect.x), y: y(rect.y), w: size(rect.w), h: size(rect.h) } : rect)),
    texts: drawn.texts.map((text, i) => (under(drawn.kept.texts[i]) ? { ...text, x: x(text.x), y: y(text.y), left: x(text.left), right: x(text.right) } : text)),
    strokes: drawn.strokes.map((stroke, i) => (under(drawn.kept.strokes[i]) ? { ...stroke, points: stroke.points.map((p) => ({ x: x(p.x), y: y(p.y) })) } : stroke)),
    shapes: drawn.shapes.map((shape, i) => (under(drawn.kept.shapes[i]) ? { ...shape, points: shape.points.map((p) => ({ x: x(p.x), y: y(p.y) })) } : shape)),
    washes: drawn.washes.map((wash, i) => (under(drawn.kept.washes[i]) ? { ...wash, x: x(wash.x), y: y(wash.y), w: size(wash.w), h: size(wash.h) } : wash)),
  };
}

/** Whether two pieces of text share a row and run into each other. */
export const overlap = (a: Written, b: Written): boolean => a.y === b.y && a.left < b.right && b.left < a.right;

/** A word in the sign's letters as it was found in a drawing: its box, how tall its letters are, and how lit it is. */
export interface Sign { x: number; y: number; w: number; h: number; tall: number; metal: Metal; level: number; middle: number }

/**
 * Where a word in the sign's letters is in a drawing, or null when it is not there. It is there
 * when every run of it was filled, in order and in its metal's colours, lit or not. `tall` narrows
 * the search to one height; without it every height the sign can be written at is tried.
 */
export function signIn(page: Drawn, text: string, metal: Metal, tall?: number): Sign | null {
  if (!canWrite(text)) return null;
  const heights = tall ? [tall] : Array.from({ length: MAX_TALL - MIN_TALL + 1 }, (_, i) => MAX_TALL - i);
  for (const height of heights) {
    const find = (level: 0 | 1): { x: number; y: number; alpha: number } | null => {
      const want = record((ctx) => drawWord(ctx, text, 0, 0, { tall: height, metal, level, align: 'left' })).rects;
      for (let i = 0; i + want.length <= page.rects.length; i++) {
        const dx = page.rects[i].x - want[0].x;
        const dy = page.rects[i].y - want[0].y;
        let all = true;
        for (let k = 0; k < want.length && all; k++) {
          const got = page.rects[i + k];
          all = got.color === want[k].color && got.w === want[k].w && got.h === want[k].h && got.x - want[k].x === dx && got.y - want[k].y === dy;
        }
        if (all) return { x: dx, y: dy, alpha: page.rects[i].alpha };
      }
      return null;
    };
    const lit = find(1);
    const dark = lit ? null : find(0);
    const at = lit ?? dark;
    if (!at) continue;
    return {
      x: at.x, y: at.y, w: wordWidth(text, height), h: wordHeight(height), tall: height, metal,
      level: lit ? lit.alpha : 0,
      // The middle of its letters, which is what is put where the font's word was.
      middle: at.y + 1 + height / 2,
    };
  }
  return null;
}

/** How many words in the sign's letters a drawing holds, whatever they say: each is laid on the dark line round it. */
export function signCount(page: Drawn): number {
  let count = 0;
  let inLine = false;
  for (const rect of page.rects) {
    const line = rect.color === LINE && rect.h === 1;
    if (line && !inLine) count++;
    inLine = line;
  }
  return count;
}
