import { paintById, recolour, type PaintInfo } from './paint';
import { COLORS, FONT } from './widgets';

export type SpriteManifest = Record<string, { file: string; w: number; h: number; ox?: number; oy?: number; paint?: PaintInfo }>;
/** `ox`/`oy` is a mech layer's place inside the pose box. */
export interface Sprite { image: CanvasImageSource; w: number; h: number; ox?: number; oy?: number }
export interface SpriteStore {
  /** Returns the sprite, or a labelled placeholder of the fallback size when it is unavailable. */
  get(id: string, fallback: { w: number; h: number; ox?: number; oy?: number; label: string }): Sprite;
  /**
   * The sprite in a paint scheme. Sprites that take no paint (weapons, enemies, anything missing)
   * and the factory scheme come back as they are.
   */
  painted?(id: string, paint: string, fallback: { w: number; h: number; ox?: number; oy?: number; label: string }): Sprite;
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

/** Loads every sprite in the manifest. Never rejects: a missing file becomes a placeholder on use. */
export async function loadSprites(manifest: SpriteManifest): Promise<SpriteStore> {
  const loaded = new Map<string, Sprite>();
  await Promise.all(Object.entries(manifest).map(async ([id, entry]) => {
    const image = await loadImage(entry.file);
    if (image) loaded.set(id, { image, w: entry.w, h: entry.h, ox: entry.ox, oy: entry.oy });
  }));
  const placeholders = new Map<string, Sprite>();
  const paintedSprites = new Map<string, Sprite>();
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
      const key = `${id}|${scheme.id}`;
      if (!paintedSprites.has(key)) paintedSprites.set(key, repaint(base, (pixels) => recolour(pixels, scheme, info)));
      return paintedSprites.get(key)!;
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
