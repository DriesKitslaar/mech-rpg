/**
 * Turns raw generated images into game sprites.
 * Usage: tsx scripts/art/process.ts            process all raw images, write the manifest
 *        tsx scripts/art/process.ts palette    build art/palette.json from the family drawings
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as iq from 'image-q';
import sharp, { type Sharp } from 'sharp';
import { BACK_POSE_BOX, BACK_TILT, BOX, JOBS, POSE_BOX, SMALL_POSE_BOX, paintGroups, type ArtJob } from './jobs';
import { analyse, type PaintInfo } from '../../src/ui/paint';
import { bounds, chromaKeyGreen, hitSpot, quantize, trim, type RawImage, type RGB } from './imageOps';
import { HIT_LAYER, VIEWS, type HitPart, type MechView } from '../../src/ui/mechLayout';

const RAW = 'art/raw';
const OUT = 'public/sprites';
const PALETTE = 'art/palette.json';
const MANIFEST = 'src/content/sprites.json';

type Entry = {
  file: string; w: number; h: number; ox?: number; oy?: number; drop?: number; paint?: PaintInfo;
  /** On a weapon turned for the view from behind: where in it it is held, and where it fires from. */
  gx?: number; gy?: number; mx?: number; my?: number;
  /** On a frame layer that can be hit in its view: where in it a hit lands. */
  hx?: number; hy?: number;
  /** On an arm whose fist was not drawn where its view has the fist: where in it that fist is. */
  fx?: number; fy?: number;
};

/** The view a layer's drawing is for, and the part of the frame it is hit as, if it is one that is: both are in its name. */
export function hitPartOf(id: string): { view: MechView; part: HitPart } | null {
  const view: MechView = id.endsWith('.back') ? 'back' : id.endsWith('.small') ? 'small' : 'front';
  const name = id.replace(/\.(back|small)$/, '');
  const slot = name.startsWith('legs-') ? 'legs' : name.startsWith('core-') ? 'core' : name.startsWith('head-') ? 'head' : name.endsWith('.near') ? 'armNear' : null;
  const part = (Object.keys(HIT_LAYER) as HitPart[]).find((p) => HIT_LAYER[p] === slot);
  return part ? { view, part } : null;
}

/**
 * Legs that are lower than a pair of legs: how many pixels the upper body comes down to meet them.
 * Measured from the proof sheets: ordinary legs start about 60 pixels down the pose box.
 */
const LEGS_DROP: Record<string, number> = { 'legs-crawler': 28 };
/**
 * The same from behind, measured from the proof sheets of the drawings from behind, which are not
 * the drawings from the front made smaller: a walker's hip block sits lower there, and a hover unit
 * was drawn so short that the whole mech has to come down (`lower`: its own layer comes down by as
 * much as what sits on it) or it would hang a third of its height over the ground.
 */
const LEGS_FROM_BEHIND: Record<string, { drop: number; lower?: number }> = {
  'legs-crawler.back': { drop: 22 }, 'legs-spider.back': { drop: 12 }, 'legs-glide.back': { drop: 20, lower: 20 },
};

/**
 * Arms whose fist was not drawn where the pose has it, and where in the pose box of their view the hand is,
 * measured from the proof sheet. The pose is shared and nearly every arm kept it to a pixel; a squat frame carries
 * its shoulders low, and from behind its arms came out lower than the others: the one stretched forward reaches
 * out level where the others are raised, the one held back hangs longer. Drawn again with the fist raised the
 * arm lost its shoulder, so both stay as they were drawn and say where their hands are.
 */
export const FISTS: Record<string, { x: number; y: number }> = {
  'arms-dozer.near.back': { x: 103, y: 46 }, 'arms-dozer.far.back': { x: 22, y: 70 },
};
/** What a layer's entry says of its fist: where in its own picture it is, for a layer whose corner is at (ox, oy) of the pose box; nothing for a layer that names none. */
export function fistEntry(id: string, ox: number, oy: number): { fx?: number; fy?: number } {
  const fist = FISTS[id];
  return fist ? { fx: fist.x - ox, fy: fist.y - oy } : {};
}

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

/**
 * A layer keeps its place: the whole drawing is reduced to the pose box, then cropped with its offset recorded.
 * A layer cut from a drawing from behind has a smaller pose box of its own.
 */
async function processLayer(job: ArtJob, palette: RGB[]): Promise<Entry> {
  const keyed = chromaKeyGreen(await decode(`${RAW}/${job.source ?? job.id}.png`));
  const side = job.box ?? POSE_BOX;
  const small = quantize(await decode(await encode(keyed).resize(side, side).png().toBuffer()), palette);
  const box = bounds(small);
  if (!box) throw new Error('image is empty after background removal');
  const cut = trim(small);
  await encode(cut).png().toFile(`${OUT}/${job.id}.png`);
  const behind = LEGS_FROM_BEHIND[job.id];
  // The same legs from the front in a smaller pose box bring the upper body down by as much less.
  const full = LEGS_DROP[job.id.replace(/\.small$/, '')];
  const drop = behind ? behind.drop : full ? Math.round((full * side) / POSE_BOX) : 0;
  const oy = box.y + (behind?.lower ?? 0);
  // In a view that is fought in: the spot of this layer a hit on its part lands on, as near as its pixels let it be to where the view has the part.
  const hit = hitPartOf(job.id);
  const aim = hit && VIEWS[hit.view].hit?.[hit.part];
  const spot = aim ? hitSpot(cut, { x: aim.x - box.x, y: aim.y - oy }) : null;
  return {
    file: `sprites/${job.id}.png`, w: box.w, h: box.h, ox: box.x, oy, ...(drop ? { drop } : {}), ...(spot ? { hx: spot.x, hy: spot.y } : {}),
    ...fistEntry(job.id, box.x, oy),
  };
}

/** How much smaller than from the front a weapon is drawn in each view: as much as the mech that carries it. */
const VIEW_SCALE = { back: BACK_POSE_BOX / POSE_BOX, small: SMALL_POSE_BOX / POSE_BOX };

/**
 * A weapon or a shield for a view other than from the front, from the same raw picture. For a
 * mech that stands far off it is only reduced. From behind a weapon is also turned upwards (a
 * shield stands as it stood), and where it is held and where it fires from are worked out with
 * it: turned, a picture's corners are no longer where the layout would look for them.
 */
async function processCarried(job: ArtJob, palette: RGB[]): Promise<Entry> {
  const box = BOX[job.kind as keyof typeof BOX];
  const cut = trim(chromaKeyGreen(await decode(`${RAW}/${job.source ?? job.id}.png`)));
  // What it is reduced by from the front: as large as fits its box.
  const front = Math.min(box.w / cut.width, box.h / cut.height);
  const scale = front * VIEW_SCALE[job.view!];
  const tilt = job.view === 'back' && job.kind !== 'shield' ? BACK_TILT : 0;
  let picture = encode(cut);
  if (job.flip) picture = picture.flop();
  if (tilt) picture = sharp(await picture.png().toBuffer()).rotate(-tilt, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const turned = await decode(await picture.png().toBuffer());
  const w = Math.max(1, Math.round(turned.width * scale));
  const h = Math.max(1, Math.round(turned.height * scale));
  const small = quantize(await decode(await encode(turned).resize(w, h, { fit: 'fill' }).png().toBuffer()), palette);
  const kept = bounds(small);
  if (!kept) throw new Error('image is empty after background removal');
  await encode(trim(small)).png().toFile(`${OUT}/${job.id}.png`);
  const entry: Entry = { file: `sprites/${job.id}.png`, w: kept.w, h: kept.h };
  if (job.view !== 'back') return entry;
  // Where the layout holds it from the front, as shares of the picture: a hand weapon a fifth of the way
  // along, a shoulder weapon by its mount, a shield on the forearm. And where it fires from: its far end.
  const hold = job.kind === 'handWeapon' ? { x: 0.2, y: 0.5 } : job.kind === 'shoulderWeapon' ? { x: 0.6, y: 0.5 } : { x: 0.5, y: 0.6 };
  const fire = job.kind === 'shield' ? hold : { x: 1, y: 0.5 };
  const rad = (tilt * Math.PI) / 180;
  /** A point of the picture before it was turned, as it lies in the sprite that was kept. */
  const place = (share: { x: number; y: number }): { x: number; y: number } => {
    const dx = (share.x - 0.5) * cut.width;
    const dy = (share.y - 0.5) * cut.height;
    // Turned against the clock: what was to the right goes up.
    const x = turned.width / 2 + dx * Math.cos(rad) + dy * Math.sin(rad);
    const y = turned.height / 2 - dx * Math.sin(rad) + dy * Math.cos(rad);
    return { x: Math.round(x * scale - kept.x), y: Math.round(y * scale - kept.y) };
  };
  const g = place(hold);
  const m = place(fire);
  return { ...entry, gx: g.x, gy: g.y, mx: m.x, my: m.y };
}

async function processFree(job: ArtJob, palette: RGB[]): Promise<Entry> {
  const box = BOX[job.kind as keyof typeof BOX];
  const src = `${RAW}/${job.source ?? job.id}.png`;
  let out: RawImage;
  if (job.kind === 'portrait' || job.kind === 'icon') {
    // Portraits and the icon keep their own colours and lighting.
    out = await decode(sharp(src).resize(box.w, box.h, { fit: 'cover', position: 'centre' }));
  } else if (job.kind === 'background') {
    // Backgrounds are darkened instead of snapped to the mech palette, so units stand out against them.
    out = await decode(sharp(src).resize(box.w, box.h, { fit: 'cover', position: 'centre' })
      .modulate({ brightness: 0.55, saturation: 0.85 }));
  } else if (job.kind === 'still') {
    // A still is the picture itself: it keeps its colours, and the scene screen puts its own shade behind the text.
    out = await decode(sharp(src).resize(box.w, box.h, { fit: 'cover', position: 'centre' }));
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
  const families = paintGroups(JOBS.filter((job) => manifest[job.id]));
  for (const [family, { judged, all }] of families) {
    const ids = all;
    const images = await Promise.all(judged.map((id) => decode(`${OUT}/${id}.png`)));
    const paint = analyse(images);
    for (const id of ids) manifest[id].paint = paint;
    console.log(`paint ${family}: trim hues ${JSON.stringify(paint.accent)}, brightness ${paint.lo}/${paint.mid}/${paint.hi}`);
  }
  // Enemy sprites are whole pictures: each is judged on its own, so elites can be shown in other colours.
  for (const job of JOBS) {
    if ((job.kind !== 'enemy' && job.kind !== 'enemyMech' && job.kind !== 'boss') || !manifest[job.id]) continue;
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
      const entry = await (job.kind === 'layer' ? processLayer(job, palette) : job.view ? processCarried(job, palette) : processFree(job, palette));
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
