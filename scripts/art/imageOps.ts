/** Pure pixel operations on RGBA images. No file or library access. */
export type RawImage = { width: number; height: number; data: Uint8ClampedArray };
export type RGB = [number, number, number];

/** Makes every pixel within `tolerance` (Euclidean RGB distance) of `key` fully transparent. */
export function chromaKey(img: RawImage, key: RGB, tolerance: number): RawImage {
  const data = new Uint8ClampedArray(img.data);
  const limit = tolerance * tolerance;
  for (let i = 0; i < data.length; i += 4) {
    const d = (data[i] - key[0]) ** 2 + (data[i + 1] - key[1]) ** 2 + (data[i + 2] - key[2]) ** 2;
    if (d <= limit) data[i + 3] = 0;
  }
  return { width: img.width, height: img.height, data };
}

/**
 * Removes a green backdrop by dominance instead of distance: any pixel where green clearly
 * outweighs red and blue goes, whatever its exact shade. Generated backdrops are never one flat colour.
 */
export function chromaKeyGreen(img: RawImage): RawImage {
  const data = new Uint8ClampedArray(img.data);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (g > 120 && g > r * 1.35 && g > b * 1.35) data[i + 3] = 0;
  }
  return { width: img.width, height: img.height, data };
}

/** Bounding box of pixels with alpha of 128 or more, or null when there are none. */
export function bounds(img: RawImage): { x: number; y: number; w: number; h: number } | null {
  let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] >= 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Crops to the bounding box of pixels with alpha of 128 or more. */
export function trim(img: RawImage): RawImage {
  const box = bounds(img);
  if (!box) throw new Error('image is empty after background removal');
  const data = new Uint8ClampedArray(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) {
    const start = ((y + box.y) * img.width + box.x) * 4;
    data.set(img.data.subarray(start, start + box.w * 4), y * box.w * 4);
  }
  return { width: box.w, height: box.h, data };
}

/** Snaps opaque pixels to the nearest palette colour and makes alpha binary at 128. */
export function quantize(img: RawImage, palette: RGB[]): RawImage {
  const data = new Uint8ClampedArray(img.data.length);
  for (let i = 0; i < data.length; i += 4) {
    if (img.data[i + 3] < 128) continue;
    let best = palette[0];
    let bestD = Infinity;
    for (const c of palette) {
      const d = (img.data[i] - c[0]) ** 2 + (img.data[i + 1] - c[1]) ** 2 + (img.data[i + 2] - c[2]) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    data[i] = best[0]; data[i + 1] = best[1]; data[i + 2] = best[2]; data[i + 3] = 255;
  }
  return { width: img.width, height: img.height, data };
}

/**
 * The pixel of a picture a hit lands on, given where it is aimed: the solid pixel nearest to `aim`
 * that has solid pixels all round it for `inside` pixels, so that what lands is seen on the thing
 * and not on its outline or in a gap of it. A picture too thin to have such a pixel is hit on the
 * solid pixel nearest to `aim`. Of pixels equally near, the higher one, and of those the one
 * further left. Null for a picture with nothing in it.
 */
export function hitSpot(img: RawImage, aim: { x: number; y: number }, inside = 2): { x: number; y: number } | null {
  const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < img.width && y < img.height && img.data[(y * img.width + x) * 4 + 3] >= 128;
  const deep = (x: number, y: number): boolean => {
    for (let dy = -inside; dy <= inside; dy++) for (let dx = -inside; dx <= inside; dx++) if (!solid(x + dx, y + dy)) return false;
    return true;
  };
  let best: { x: number; y: number; d: number } | null = null;
  let fallback: { x: number; y: number; d: number } | null = null;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (!solid(x, y)) continue;
      const d = (x - aim.x) ** 2 + (y - aim.y) ** 2;
      if (!fallback || d < fallback.d) fallback = { x, y, d };
      if ((!best || d < best.d) && deep(x, y)) best = { x, y, d };
    }
  }
  const found = best ?? fallback;
  return found ? { x: found.x, y: found.y } : null;
}
