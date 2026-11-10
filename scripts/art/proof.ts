/**
 * Builds a contact sheet of every combination of the two proof variants of each frame part,
 * so a person can judge whether mechs assembled from generated parts hold together.
 * Usage: tsx scripts/art/proof.ts
 */
import { mkdirSync, readFileSync } from 'node:fs';
import sharp, { type OverlayOptions, type Sharp } from 'sharp';
import { MECH_BOX, layoutMech, type SpriteSlot } from '../../src/ui/mechLayout';

type Manifest = Record<string, { file: string; w: number; h: number }>;
const manifest = JSON.parse(readFileSync('src/content/sprites.json', 'utf8')) as Manifest;

const VARIANTS = {
  legs: ['legs-strider', 'legs-proof-b'],
  core: ['core-hauler', 'core-proof-b'],
  head: ['head-scout-mk1', 'head-proof-b'],
  arm: ['arms-rigger', 'arms-proof-b'],
};
const WEAPONS = { rightHand: 'wpn-rivet-rifle', leftHand: 'wpn-arc-pistol', shoulder: 'wpn-mortar-pod' };
const CELL = 124;
const SCALE = 3;

async function sprite(id: string, dim: boolean): Promise<Buffer> {
  const img = sharp(`public/${manifest[id].file}`);
  return (dim ? img.modulate({ brightness: 0.65 }) : img).png().toBuffer();
}

async function main(): Promise<void> {
  const layers: OverlayOptions[] = [];
  let cell = 0;
  for (const legs of VARIANTS.legs) for (const core of VARIANTS.core) for (const head of VARIANTS.head) for (const arm of VARIANTS.arm) {
    const ids: Record<SpriteSlot, string> = { legs, core, head, arm, ...WEAPONS };
    const missing = Object.values(ids).filter((id) => !manifest[id]);
    if (missing.length) throw new Error(`missing processed sprite: ${missing.join(', ')}`);
    const sizes = Object.fromEntries(Object.entries(ids).map(([slot, id]) => [slot, manifest[id]]));
    const ox = (cell % 4) * CELL + (CELL - MECH_BOX) / 2;
    const oy = Math.floor(cell / 4) * CELL + (CELL - MECH_BOX) / 2;
    for (const cmd of layoutMech(sizes)) {
      const left = ox + cmd.x;
      const top = oy + cmd.y;
      if (left < 0 || top < 0) throw new Error(`sprite ${ids[cmd.slot]} falls outside the sheet`);
      layers.push({ input: await sprite(ids[cmd.slot], cmd.dim), left, top });
    }
    cell++;
  }
  mkdirSync('art/proof', { recursive: true });
  const sheet = await sharp({
    create: { width: CELL * 4, height: CELL * 4, channels: 4, background: { r: 28, g: 30, b: 34, alpha: 1 } },
  }).composite(layers).png().toBuffer();
  await sharp(sheet).resize(CELL * 4 * SCALE, CELL * 4 * SCALE, { kernel: 'nearest' }).toFile('art/proof/contact-sheet.png');
  console.log('wrote art/proof/contact-sheet.png');
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
