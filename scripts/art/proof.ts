/**
 * Builds a contact sheet of every combination of the proof families' frame parts,
 * so a person can judge whether mixed mechs hold together.
 * Usage: tsx scripts/art/proof.ts
 */
import { mkdirSync, readFileSync } from 'node:fs';
import sharp, { type OverlayOptions } from 'sharp';
import { MECH_BOX, layoutMech, type SpriteSize, type SpriteSlot } from '../../src/ui/mechLayout';

type Manifest = Record<string, SpriteSize & { file: string }>;
const manifest = JSON.parse(readFileSync('src/content/sprites.json', 'utf8')) as Manifest;

const VARIANTS = {
  legs: ['legs-strider', 'legs-proof-b'],
  core: ['core-hauler', 'core-proof-b'],
  head: ['head-scout-mk1', 'head-proof-b'],
  arms: ['arms-rigger', 'arms-proof-b'],
};
const WEAPONS = { rightHand: 'wpn-rivet-rifle', leftHand: 'wpn-arc-pistol', shoulder: 'wpn-mortar-pod' };
const CELL_W = 200;
const CELL_H = 170;
const SCALE = 3;

async function main(): Promise<void> {
  const layers: OverlayOptions[] = [];
  let cell = 0;
  for (const legs of VARIANTS.legs) for (const core of VARIANTS.core) for (const head of VARIANTS.head) for (const arms of VARIANTS.arms) {
    const ids: Record<SpriteSlot, string> = { legs, core, head, armNear: `${arms}.near`, armFar: `${arms}.far`, ...WEAPONS };
    const missing = Object.values(ids).filter((id) => !manifest[id]);
    if (missing.length) throw new Error(`missing processed sprite: ${missing.join(', ')}`);
    const sizes = Object.fromEntries(Object.entries(ids).map(([slot, id]) => [slot, manifest[id]]));
    const ox = (cell % 4) * CELL_W + 4;
    const oy = Math.floor(cell / 4) * CELL_H + (CELL_H - MECH_BOX) / 2;
    for (const cmd of layoutMech(sizes)) {
      layers.push({ input: `public/${manifest[ids[cmd.slot]].file}`, left: ox + cmd.x, top: oy + cmd.y });
    }
    cell++;
  }
  mkdirSync('art/proof', { recursive: true });
  const w = CELL_W * 4;
  const h = CELL_H * 4;
  const sheet = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 24, g: 20, b: 40, alpha: 1 } } })
    .composite(layers).png().toBuffer();
  await sharp(sheet).resize(w * SCALE, h * SCALE, { kernel: 'nearest' }).toFile('art/proof/contact-sheet.png');
  console.log('wrote art/proof/contact-sheet.png');
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
