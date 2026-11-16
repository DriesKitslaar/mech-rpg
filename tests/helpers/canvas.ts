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
export interface Filled { x: number; y: number; w: number; h: number; color: string }
export interface Drawn { texts: Written[]; rects: Filled[] }

/**
 * Draws on a canvas that paints nothing and remembers what it was asked to write and to fill, and
 * where. A letter is as wide as the game takes it to be: four tenths of its size.
 */
export function record(draw: (ctx: CanvasRenderingContext2D) => void): Drawn {
  const texts: Written[] = [];
  const rects: Filled[] = [];
  const state: Record<string, unknown> = { font: '12px x', textAlign: 'left', fillStyle: '' };
  const size = (): number => Number(/(\d+(?:\.\d+)?)px/.exec(String(state.font))?.[1] ?? 12);
  const ctx = new Proxy(state, {
    get: (t, name: string) => {
      if (name in t) return t[name];
      if (name === 'measureText') return (text: string) => ({ width: text.length * size() * 0.4 });
      return (...args: unknown[]) => {
        if (name === 'fillText') {
          const text = String(args[0]);
          const x = Number(args[1]);
          const width = text.length * size() * 0.4;
          const align = String(t.textAlign);
          const left = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
          texts.push({ text, x, y: Number(args[2]), left, right: left + width, size: size(), align, color: String(t.fillStyle) });
        }
        if (name === 'fillRect') rects.push({ x: Number(args[0]), y: Number(args[1]), w: Number(args[2]), h: Number(args[3]), color: String(t.fillStyle) });
      };
    },
    set: (t, name: string, value) => { t[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  draw(ctx);
  return { texts, rects };
}

/** Whether two pieces of text share a row and run into each other. */
export const overlap = (a: Written, b: Written): boolean => a.y === b.y && a.left < b.right && b.left < a.right;
