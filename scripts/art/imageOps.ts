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

/** Crops to the bounding box of pixels with alpha of 128 or more. */
export function trim(img: RawImage): RawImage {
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
  if (maxX < 0) throw new Error('image is empty after background removal');
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const start = ((y + minY) * img.width + minX) * 4;
    data.set(img.data.subarray(start, start + width * 4), y * width * 4);
  }
  return { width, height, data };
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
