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
export interface Drawn {
  texts: Written[]; rects: Filled[]; images: Pictured[]; glows: Glowed[]; strokes: Stroked[]; washes: Washed[]; shapes: Shaped[];
  /** Everything that was drawn, in the order it was drawn in: what comes later lies over what came before. */
  order: Step[];
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
  const texts: Written[] = [];
  const rects: Filled[] = [];
  const images: Pictured[] = [];
  const glows: Glowed[] = [];
  const strokes: Stroked[] = [];
  const washes: Washed[] = [];
  const shapes: Shaped[] = [];
  const order: Step[] = [];
  const state: Record<string, unknown> = {
    font: '12px x', textAlign: 'left', fillStyle: '', strokeStyle: '', lineWidth: 1, globalCompositeOperation: 'source-over', globalAlpha: 1, filter: 'none',
  };
  // Where the drawing has moved the canvas to, and by how much it has scaled it.
  let at = { tx: 0, ty: 0, sx: 1, sy: 1 };
  type Box = { x: number; y: number; w: number; h: number };
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
      texts.push({ text: said, x: where, y: Y(Number(y)), left, right: left + width, size: size(), align, color: String(state.fillStyle) });
    },
    fillRect: (x, y, w, h) => {
      const style = state.fillStyle;
      if (isGradient(style) && style.linear) {
        order.push({ kind: 'wash', at: washes.length });
        washes.push({ x: X(Number(x)), y: Y(Number(y)), w: Number(w) * at.sx, h: Number(h) * at.sy, stops: style.stops, blend: String(state.globalCompositeOperation) });
        return;
      }
      if (isGradient(style)) {
        order.push({ kind: 'glow', at: glows.length });
        glows.push({ x: X(style.x), y: Y(style.y), r: style.r * at.sx, ry: style.r * at.sy, stops: style.stops, blend: String(state.globalCompositeOperation) });
        return;
      }
      order.push({ kind: 'rect', at: rects.length });
      rects.push({ x: X(Number(x)), y: Y(Number(y)), w: Number(w) * at.sx, h: Number(h) * at.sy, color: String(style), blend: String(state.globalCompositeOperation), alpha: Number(state.globalAlpha) });
    },
    drawImage: (image, x, y, w, h) => {
      order.push({ kind: 'image', at: images.length });
      images.push({
        image, x: X(Number(x)), y: Y(Number(y)), w: Number(w) * at.sx, h: Number(h) * at.sy,
        blend: String(state.globalCompositeOperation), alpha: Number(state.globalAlpha), filter: String(state.filter), clip: clip ? { ...clip } : null,
      });
    },
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
    stroke: () => { order.push({ kind: 'stroke', at: strokes.length }); strokes.push({ points: [...path], width: Number(state.lineWidth), color: String(state.strokeStyle), blend: String(state.globalCompositeOperation) }); },
    fill: () => {
      const style = state.fillStyle;
      order.push({ kind: 'shape', at: shapes.length });
      shapes.push({ points: [...path], color: isGradient(style) ? '' : String(style), stops: isGradient(style) ? style.stops : [], blend: String(state.globalCompositeOperation) });
    },
  };
  const ctx = new Proxy(state, {
    get: (t, name: string) => (name in t ? t[name] : methods[name] ?? (() => undefined)),
    set: (t, name: string, value) => { t[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  draw(ctx);
  return { texts, rects, images, glows, strokes, washes, shapes, order };
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
