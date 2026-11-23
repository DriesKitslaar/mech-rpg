import { isMix } from '../core/mix';
import { paintById, recolour, type PaintInfo } from './paint';
import { MIX_KEPT, PaintedCache } from './paintedCache';
import { COLORS, FONT } from './widgets';

export type SpriteManifest = Record<string, {
  file: string; w: number; h: number; ox?: number; oy?: number; drop?: number; paint?: PaintInfo;
  gx?: number; gy?: number; mx?: number; my?: number; hx?: number; hy?: number; fx?: number; fy?: number; bar?: number;
}>;
/**
 * `ox`/`oy` is a mech layer's place inside the pose box; `drop`, the `gx`/`gy` and `mx`/`my` of a
 * weapon that was turned for its view, the `hx`/`hy` of a layer that can be hit and the `fx`/`fy` of an
 * arm that names its own fist, and the `bar` of an arm with a low shoulder, are explained in mechLayout.
 */
export interface Sprite {
  image: CanvasImageSource; w: number; h: number; ox?: number; oy?: number; drop?: number;
  gx?: number; gy?: number; mx?: number; my?: number; hx?: number; hy?: number; fx?: number; fy?: number; bar?: number;
}
/** A sheet to draw on that is not the screen: what is drawn on it can be handed to the screen as one picture. */
export interface Sheet { image: CanvasImageSource; ctx: CanvasRenderingContext2D }
export interface SpriteStore {
  /** Returns the sprite, or a labelled placeholder of the fallback size when it is unavailable. */
  get(id: string, fallback: { w: number; h: number; ox?: number; oy?: number; label: string }): Sprite;
  /**
   * The sprite in a paint scheme. Sprites that take no paint (weapons, enemies, anything missing)
   * and the factory scheme come back as they are.
   */
  painted?(id: string, paint: string, fallback: { w: number; h: number; ox?: number; oy?: number; label: string }): Sprite;
  /**
   * Lends a sheet at least this large, or null where there is none to be had. There is one, and
   * whoever asks next gets the same one: it is for drawing on and handing over at once, and it is
   * not wiped between one loan and the next.
   */
  sheet?(w: number, h: number): Sheet | null;
}

function placeholder(w: number, h: number, label: string): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#5a2a6a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#c08ad0';
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  ctx.fillStyle = COLORS.text;
  ctx.font = `10px ${FONT}`;
  ctx.textBaseline = 'top';
  ctx.fillText(label, 2, 1, w - 4);
  return { image: canvas, w, h };
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** A picture and what the manifest says of it: its size, and whatever of the rest it has. */
export function spriteOf(image: CanvasImageSource, entry: SpriteManifest[string]): Sprite {
  const { gx, gy, mx, my, hx, hy, fx, fy } = entry;
  return {
    image, w: entry.w, h: entry.h, ox: entry.ox, oy: entry.oy, ...(entry.drop ? { drop: entry.drop } : {}),
    // A weapon that was turned for its view: where it is held and where it fires from.
    ...(gx !== undefined && gy !== undefined && mx !== undefined && my !== undefined ? { gx, gy, mx, my } : {}),
    // A layer that can be hit: where in it a hit lands.
    ...(hx !== undefined && hy !== undefined ? { hx, hy } : {}),
    // An arm whose fist was not drawn where its view has the fist: where it is.
    ...(fx !== undefined && fy !== undefined ? { fx, fy } : {}),
    // An arm from behind with a shoulder lower than the bar across the shoulders: how much of the bar is left off at its end.
    ...(entry.bar ? { bar: entry.bar } : {}),
  };
}

/** Loads every sprite in the manifest. Never rejects: a missing file becomes a placeholder on use. */
export async function loadSprites(manifest: SpriteManifest): Promise<SpriteStore> {
  const loaded = new Map<string, Sprite>();
  await Promise.all(Object.entries(manifest).map(async ([id, entry]) => {
    const image = await loadImage(entry.file);
    if (!image) return;
    loaded.set(id, spriteOf(image, entry));
  }));
  const placeholders = new Map<string, Sprite>();
  // Coloured once for each paint and kept: but for the pilot's own mixes, of which only the last few asked for are.
  const paintedSprites = new PaintedCache<Sprite>(MIX_KEPT, isMix);
  // The one sheet that is lent out: made when it is first asked for, null when the browser would not give one.
  let lent: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null | undefined;
  const get: SpriteStore['get'] = (id, fallback) => {
    const sprite = loaded.get(id);
    if (sprite) return sprite;
    if (!placeholders.has(id)) placeholders.set(id, { ...placeholder(fallback.w, fallback.h, fallback.label), ox: fallback.ox, oy: fallback.oy });
    return placeholders.get(id)!;
  };
  return {
    get,
    painted(id, paint, fallback) {
      const base = loaded.get(id);
      const scheme = paintById(paint);
      const info = Object.hasOwn(manifest, id) ? manifest[id].paint : undefined;
      if (!base || !scheme || !info) return get(id, fallback);
      return paintedSprites.get(id, scheme.id, () => repaint(base, (pixels) => recolour(pixels, scheme, info)));
    },
    sheet(w, h) {
      try {
        if (lent === undefined) {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          lent = ctx ? { canvas, ctx } : null;
        }
        if (!lent) return null;
        // It only ever grows: making a canvas another size throws away what it holds and what it was set to.
        if (lent.canvas.width < w || lent.canvas.height < h) {
          lent.canvas.width = Math.max(lent.canvas.width, Math.ceil(w));
          lent.canvas.height = Math.max(lent.canvas.height, Math.ceil(h));
        }
        // What it draws stays on whole pixels: nothing on it is ever smoothed.
        lent.ctx.imageSmoothingEnabled = false;
        return { image: lent.canvas, ctx: lent.ctx };
      } catch {
        lent = null;
        return null;
      }
    },
  };
}

/** A copy of a sprite with its pixels run through `change`. A browser that refuses pixel access keeps the original. */
function repaint(sprite: Sprite, change: (pixels: Uint8ClampedArray) => Uint8ClampedArray): Sprite {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = sprite.w;
    canvas.height = sprite.h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(sprite.image, 0, 0, sprite.w, sprite.h);
    const pixels = ctx.getImageData(0, 0, sprite.w, sprite.h);
    pixels.data.set(change(pixels.data));
    ctx.putImageData(pixels, 0, 0);
    return { ...sprite, image: canvas };
  } catch {
    return sprite;
  }
}
