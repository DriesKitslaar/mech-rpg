import { COLORS, FONT } from './widgets';

export type SpriteManifest = Record<string, { file: string; w: number; h: number }>;
export interface Sprite { image: CanvasImageSource; w: number; h: number }
export interface SpriteStore {
  /** Returns the sprite, or a labelled placeholder of the fallback size when it is unavailable. */
  get(id: string, fallback: { w: number; h: number; label: string }): Sprite;
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
    if (image) loaded.set(id, { image, w: entry.w, h: entry.h });
  }));
  const placeholders = new Map<string, Sprite>();
  return {
    get(id, fallback) {
      const sprite = loaded.get(id);
      if (sprite) return sprite;
      if (!placeholders.has(id)) placeholders.set(id, placeholder(fallback.w, fallback.h, fallback.label));
      return placeholders.get(id)!;
    },
  };
}
