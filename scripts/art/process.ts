/**
 * Turns raw generated images into game sprites.
 * Usage: tsx scripts/art/process.ts            process all raw images, write the manifest
 *        tsx scripts/art/process.ts palette    build art/palette.json from the family drawings
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as iq from 'image-q';
import sharp, { type Sharp } from 'sharp';
import { BOX, JOBS, POSE_BOX, paintFamilyOf, type ArtJob } from './jobs';
import { analyse, type PaintInfo } from '../../src/ui/paint';
import { bounds, chromaKeyGreen, quantize, trim, type RawImage, type RGB } from './imageOps';

const RAW = 'art/raw';
const OUT = 'public/sprites';
const PALETTE = 'art/palette.json';
const MANIFEST = 'src/content/sprites.json';

type Entry = { file: string; w: number; h: number; ox?: number; oy?: number; drop?: number; paint?: PaintInfo };

/**
 * Legs that are lower than a pair of legs: how many pixels the upper body comes down to meet them.
 * Measured from the proof sheets: ordinary legs start about 60 pixels down the pose box.
 */
const LEGS_DROP: Record<string, number> = { 'legs-crawler': 28 };

export async function decode(input: string | Buffer | Sharp): Promise<RawImage> {
  const s = typeof input === 'string' || Buffer.isBuffer(input) ? sharp(input) : input;
  const { data, info } = await s.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
}

export function encode(img: RawImage): Sharp {
  return sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length), {
    raw: { width: img.width, height: img.height, channels: 4 },
  });
}

async function buildPalette(): Promise<void> {
  // One shared palette from every family drawing, without the green backdrop.
  const kept: number[] = [];
  for (const job of JOBS.filter((j) => j.kind === 'family')) {
    const img = chromaKeyGreen(await decode(`${RAW}/${job.id}.png`));
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3] > 0) kept.push(img.data[i], img.data[i + 1], img.data[i + 2], 255);
    }
  }
  if (kept.length === 0) throw new Error('no family drawings found to build the palette from');
  const container = iq.utils.PointContainer.fromUint8Array(Uint8Array.from(kept), kept.length / 4, 1);
  const palette = await iq.buildPalette([container], { colors: 64 });
  const colours: RGB[] = palette.getPointContainer().getPointArray().map((p) => [p.r, p.g, p.b]);
  writeFileSync(PALETTE, JSON.stringify(colours) + '\n');
  console.log(`wrote ${colours.length} colours to ${PALETTE}`);
}

/** A layer keeps its place: the whole drawing is reduced to the pose box, then cropped with its offset recorded. */
async function processLayer(job: ArtJob, palette: RGB[]): Promise<Entry> {
  const keyed = chromaKeyGreen(await decode(`${RAW}/${job.id}.png`));
  const small = quantize(await decode(await encode(keyed).resize(POSE_BOX, POSE_BOX).png().toBuffer()), palette);
  const box = bounds(small);
  if (!box) throw new Error('image is empty after background removal');
  await encode(trim(small)).png().toFile(`${OUT}/${job.id}.png`);
  const drop = LEGS_DROP[job.id];
  return { file: `sprites/${job.id}.png`, w: box.w, h: box.h, ox: box.x, oy: box.y, ...(drop ? { drop } : {}) };
}

async function processFree(job: ArtJob, palette: RGB[]): Promise<Entry> {
  const box = BOX[job.kind as keyof typeof BOX];
  const src = `${RAW}/${job.source ?? job.id}.png`;
  let out: RawImage;
  if (job.kind === 'portrait') {
    // Portraits keep their own colours and lighting.
    out = await decode(sharp(src).resize(box.w, box.h, { fit: 'cover', position: 'centre' }));
  } else if (job.kind === 'background') {
    // Backgrounds are darkened instead of snapped to the mech palette, so units stand out against them.
    out = await decode(sharp(src).resize(box.w, box.h, { fit: 'cover', position: 'centre' })
      .modulate({ brightness: 0.55, saturation: 0.85 }));
  } else {
    const cut = trim(chromaKeyGreen(await decode(src)));
    let small = encode(cut).resize(box.w, box.h, { fit: 'inside' });
    if (job.flip) small = small.flop();
    out = quantize(await decode(await small.png().toBuffer()), palette);
  }
  await encode(out).png().toFile(`${OUT}/${job.id}.png`);
  return { file: `sprites/${job.id}.png`, w: out.width, h: out.height };
}

/**
 * Records on every frame layer what the paint needs to know about its family: which hues are trim
 * and how bright the armour runs. All layers cut from one drawing are judged together, so every
 * part of a family takes a paint scheme the same way.
 */
async function addPaintInfo(manifest: Record<string, Entry>): Promise<void> {
  // Per family: the layers cut from its own drawing, which are what it is judged by, and every layer that takes its paint.
  const families = new Map<string, { own: string[]; all: string[] }>();
  for (const job of JOBS) {
    if (job.kind !== 'layer' || !manifest[job.id]) continue;
    const family = paintFamilyOf(job);
    const group = families.get(family) ?? { own: [], all: [] };
    group.all.push(job.id);
    // Free-standing legs come from an edited copy of the drawing: they take the family's paint but do not shift it.
    if (job.references?.[0]?.endsWith(`family-${family}.png`)) group.own.push(job.id);
    families.set(family, group);
  }
  for (const [family, { own, all }] of families) {
    const ids = all;
    const images = await Promise.all((own.length > 0 ? own : all).map((id) => decode(`${OUT}/${id}.png`)));
    const paint = analyse(images);
    for (const id of ids) manifest[id].paint = paint;
    console.log(`paint ${family}: trim hues ${JSON.stringify(paint.accent)}, brightness ${paint.lo}/${paint.mid}/${paint.hi}`);
  }
  // Enemy sprites are whole pictures: each is judged on its own, so elites can be shown in other colours.
  for (const job of JOBS) {
    if ((job.kind !== 'enemy' && job.kind !== 'enemyMech') || !manifest[job.id]) continue;
    manifest[job.id].paint = analyse([await decode(`${OUT}/${job.id}.png`)]);
  }
}

async function main(): Promise<void> {
  if (process.argv[2] === 'palette') return buildPalette();
  const palette = JSON.parse(readFileSync(PALETTE, 'utf8')) as RGB[];
  mkdirSync(OUT, { recursive: true });
  const manifest: Record<string, Entry> = {};
  let failed = 0;
  for (const job of JOBS) {
    if (job.kind === 'family') continue; // families are only the source the layers are cut from
    if (!existsSync(`${RAW}/${job.source ?? job.id}.png`)) { console.log(`skip ${job.id} (no raw image)`); continue; }
    try {
      const entry = await (job.kind === 'layer' ? processLayer(job, palette) : processFree(job, palette));
      manifest[job.id] = entry;
      console.log(`ok   ${job.id} ${entry.w}x${entry.h}${entry.ox !== undefined ? ` at ${entry.ox},${entry.oy}` : ''}`);
    } catch (e) {
      failed++;
      console.error(`FAIL ${job.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  await addPaintInfo(manifest);
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  if (failed) process.exitCode = 1;
}

if (process.argv[1]?.endsWith('process.ts')) {
  main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
}
