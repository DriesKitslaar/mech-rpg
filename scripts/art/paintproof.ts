/**
 * Builds sheets of every family in every paint scheme, so a person can judge the schemes.
 * Usage: tsx scripts/art/paintproof.ts        writes art/proof/paint-1.png and paint-2.png
 */
import { mkdirSync, readFileSync } from 'node:fs';
import sharp, { type OverlayOptions } from 'sharp';
import { MECH_BOX, layoutMech, type SpriteSize, type SpriteSlot } from '../../src/ui/mechLayout';
import { PAINTS, recolour, type PaintInfo, type PaintScheme } from '../../src/ui/paint';

type Manifest = Record<string, SpriteSize & { file: string; paint?: PaintInfo }>;
const manifest = JSON.parse(readFileSync('src/content/sprites.json', 'utf8')) as Manifest;

const FAMILIES = Object.keys(manifest).filter((id) => id.startsWith('core-') && manifest[id].paint).map((core) => {
  const legs = Object.keys(manifest).find((id) => id.startsWith('legs-') && manifest[id].paint === undefined ? false
    : id.startsWith('legs-') && JSON.stringify(manifest[id].paint) === JSON.stringify(manifest[core].paint))!;
  const head = Object.keys(manifest).find((id) => id.startsWith('head-') && JSON.stringify(manifest[id].paint) === JSON.stringify(manifest[core].paint))!;
  const arms = Object.keys(manifest).find((id) => id.endsWith('.near') && JSON.stringify(manifest[id].paint) === JSON.stringify(manifest[core].paint))!.replace('.near', '');
  return { legs, core, head, arms };
});

const CELL = MECH_BOX + 8;
const SCALE = 1.5;

async function pixels(id: string): Promise<{ data: Uint8ClampedArray; w: number; h: number }> {
  const { data, info } = await sharp(`public/${manifest[id].file}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), w: info.width, h: info.height };
}

async function sheet(schemes: (PaintScheme | null)[], out: string): Promise<void> {
  const layers: OverlayOptions[] = [];
  for (const [row, f] of FAMILIES.entries()) {
    const ids: Record<string, string> = { legs: f.legs, core: f.core, head: f.head, armNear: `${f.arms}.near`, armFar: `${f.arms}.far` };
    const sizes = Object.fromEntries(Object.entries(ids).map(([slot, id]) => [slot, manifest[id]]));
    for (const [col, scheme] of schemes.entries()) {
      for (const cmd of layoutMech(sizes as Partial<Record<SpriteSlot, SpriteSize>>)) {
        const id = ids[cmd.slot];
        const img = await pixels(id);
        const data = scheme ? recolour(img.data, scheme, manifest[id].paint!) : img.data;
        layers.push({
          input: Buffer.from(data.buffer, data.byteOffset, data.length), raw: { width: img.w, height: img.h, channels: 4 },
          left: col * CELL + 4 + cmd.x, top: row * CELL + 4 + cmd.y,
        });
      }
    }
  }
  const w = CELL * schemes.length;
  const h = CELL * FAMILIES.length;
  const flat = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 24, g: 20, b: 40, alpha: 1 } } })
    .composite(layers).png().toBuffer();
  await sharp(flat).resize(Math.round(w * SCALE), Math.round(h * SCALE), { kernel: 'nearest' }).toFile(out);
  console.log(`wrote ${out}`);
}

async function main(): Promise<void> {
  mkdirSync('art/proof', { recursive: true });
  // Factory colours first in each sheet, for comparison.
  await sheet([null, ...PAINTS.slice(0, 6)], 'art/proof/paint-1.png');
  await sheet([null, ...PAINTS.slice(6)], 'art/proof/paint-2.png');
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
