import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/** A picture read from a file: its size, and the red, green, blue and opacity of each of its pixels. */
export interface Picture { w: number; h: number; at(x: number, y: number): [number, number, number, number] }

/**
 * Reads a PNG as the game's pictures are saved: eight bits a channel, with or without opacity, not
 * interlaced. Anything else is refused rather than read wrongly.
 */
export function readPng(path: string): Picture {
  const file = readFileSync(path);
  if (file.readUInt32BE(0) !== 0x89504e47) throw new Error(`${path} is not a PNG`);
  let w = 0;
  let h = 0;
  let channels = 0;
  const packed: Buffer[] = [];
  for (let at = 8; at < file.length;) {
    const length = file.readUInt32BE(at);
    const kind = file.toString('latin1', at + 4, at + 8);
    const body = file.subarray(at + 8, at + 8 + length);
    if (kind === 'IHDR') {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      const [depth, type, , , interlace] = [body[8], body[9], body[10], body[11], body[12]];
      if (depth !== 8 || (type !== 2 && type !== 6) || interlace !== 0) throw new Error(`${path}: only plain 8-bit colour is read here`);
      channels = type === 6 ? 4 : 3;
    }
    if (kind === 'IDAT') packed.push(body);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(packed));
  const stride = w * channels;
  const pixels = Buffer.alloc(h * stride);
  // Each row was stored as its difference from what is left of it, above it, or both: put back here.
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const value = raw[y * (stride + 1) + 1 + i];
      const left = i >= channels ? pixels[y * stride + i - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + i] : 0;
      const corner = y > 0 && i >= channels ? pixels[(y - 1) * stride + i - channels] : 0;
      let guess = 0;
      if (filter === 1) guess = left;
      else if (filter === 2) guess = up;
      else if (filter === 3) guess = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - corner;
        const [a, b, c] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - corner)];
        guess = a <= b && a <= c ? left : b <= c ? up : corner;
      }
      pixels[y * stride + i] = (value + guess) & 255;
    }
  }
  return {
    w, h,
    at: (x, y) => {
      const i = y * stride + x * channels;
      return [pixels[i], pixels[i + 1], pixels[i + 2], channels === 4 ? pixels[i + 3] : 255];
    },
  };
}

/**
 * How bright what is round a point of a picture is, from 0 to 255: the brightest channel of each
 * pixel in reach, averaged over the brightest quarter of them. A lamp, a sign or a thin line of
 * light is bright by this measure though the dark round it is not; a place with nothing in it is not.
 */
export function brightAt(picture: Picture, x: number, y: number, reach = 3): number {
  const levels: number[] = [];
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const px = Math.round(x) + dx;
      const py = Math.round(y) + dy;
      if (px < 0 || py < 0 || px >= picture.w || py >= picture.h) continue;
      levels.push(Math.max(...picture.at(px, py).slice(0, 3)));
    }
  }
  const best = levels.sort((a, b) => b - a).slice(0, Math.max(1, Math.ceil(levels.length / 4)));
  return best.reduce((sum, level) => sum + level, 0) / best.length;
}

/** How bright a whole picture is on average: the brightest channel of every pixel. */
export function brightOverall(picture: Picture): number {
  let sum = 0;
  for (let y = 0; y < picture.h; y++) for (let x = 0; x < picture.w; x++) sum += Math.max(...picture.at(x, y).slice(0, 3));
  return sum / (picture.w * picture.h);
}
