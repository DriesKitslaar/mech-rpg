/**
 * Turns raw generated images into game sprites.
 * Usage: tsx scripts/art/process.ts            process all raw images, write the manifest
 *        tsx scripts/art/process.ts palette    build art/palette.json from the style reference
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as iq from 'image-q';
import sharp, { type OverlayOptions, type Sharp } from 'sharp';
import { BOX, JOBS, type ArtJob } from './jobs';
import { chromaKey, quantize, trim, type RawImage, type RGB } from './imageOps';

const RAW = 'art/raw';
const OUT = 'public/sprites';
const PALETTE = 'art/palette.json';
const MANIFEST = 'src/content/sprites.json';
const KEY: RGB = [255, 0, 255];

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
  const img = await decode('art/reference/style-ref.png');
  // Leave out the near-black backdrop so the 32 colours go to the mech itself.
  const kept: number[] = [];
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i] + img.data[i + 1] + img.data[i + 2] > 60) kept.push(img.data[i], img.data[i + 1], img.data[i + 2], 255);
  }
  const container = iq.utils.PointContainer.fromUint8Array(Uint8Array.from(kept), kept.length / 4, 1);
  const palette = await iq.buildPalette([container], { colors: 31 });
  const colours: RGB[] = palette.getPointContainer().getPointArray().map((p) => [p.r, p.g, p.b]);
  colours.unshift([10, 10, 12]);
  writeFileSync(PALETTE, JSON.stringify(colours) + '\n');
  console.log(`wrote ${colours.length} colours to ${PALETTE}`);
}

async function processJob(job: ArtJob, palette: RGB[]): Promise<{ w: number; h: number }> {
  const box = BOX[job.kind];
  const src = `${RAW}/${job.id}.png`;
  let out: RawImage;
  if (job.kind === 'background') {
    // Backgrounds are darkened and desaturated instead of snapped to the mech palette,
    // so units stand out against them.
    out = await decode(sharp(src).resize(box.w, box.h, { fit: 'cover', position: 'centre' })
      .modulate({ brightness: 0.62, saturation: 0.55 }));
  } else {
    const cut = trim(chromaKey(await decode(src), KEY, 110));
    let small = encode(cut).resize(box.w, box.h, { fit: 'inside' });
    if (job.flip) small = small.flop();
    // The resize blends edge pixels with the removed background; binary alpha in quantize cleans that up.
    out = quantize(await decode(await small.png().toBuffer()), palette);
  }
  await encode(out).png().toFile(`${OUT}/${job.id}.png`);
  return { w: out.width, h: out.height };
}

async function main(): Promise<void> {
  if (process.argv[2] === 'palette') return buildPalette();
  const palette = JSON.parse(readFileSync(PALETTE, 'utf8')) as RGB[];
  mkdirSync(OUT, { recursive: true });
  const manifest: Record<string, { file: string; w: number; h: number }> = {};
  let failed = 0;
  for (const job of JOBS) {
    if (!existsSync(`${RAW}/${job.id}.png`)) { console.log(`skip ${job.id} (no raw image)`); continue; }
    try {
      const size = await processJob(job, palette);
      manifest[job.id] = { file: `sprites/${job.id}.png`, ...size };
      console.log(`ok   ${job.id} ${size.w}x${size.h}`);
    } catch (e) {
      failed++;
      console.error(`FAIL ${job.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  if (failed) process.exitCode = 1;
}

if (process.argv[1]?.endsWith('process.ts')) {
  main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
}
