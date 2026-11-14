/**
 * Renders mechs for a list of builds side by side, so new parts can be judged on a mech.
 * Usage: tsx scripts/art/loadouts.ts out.png "legs,core,head,arms,rightHand,leftHand,shoulder" ["..."]
 * A slot may be left empty: "legs-strider,core-hauler,head-scout-mk1,arms-rigger,wpn-arc-blade,,".
 */
import { readFileSync } from 'node:fs';
import sharp, { type OverlayOptions } from 'sharp';
import { MECH_BOX, layoutMech, type SpriteSize, type SpriteSlot } from '../../src/ui/mechLayout';

type Manifest = Record<string, SpriteSize & { file: string }>;
const manifest = JSON.parse(readFileSync('src/content/sprites.json', 'utf8')) as Manifest;
const SCALE = 3;
const CELL = MECH_BOX + 30;

async function main(): Promise<void> {
  const [out, ...specs] = process.argv.slice(2);
  if (!out || specs.length === 0) throw new Error('usage: loadouts.ts out.png "legs,core,head,arms,right,left,shoulder" ...');
  const layers: OverlayOptions[] = [];
  specs.forEach((spec, i) => {
    const [legs, core, head, arms, rightHand, leftHand, shoulder] = spec.split(',');
    const ids: Partial<Record<SpriteSlot, string>> = {
      legs, core, head, armNear: `${arms}.near`, armFar: `${arms}.far`,
      ...(rightHand ? { rightHand } : {}), ...(leftHand ? { leftHand } : {}), ...(shoulder ? { shoulder } : {}),
    };
    const missing = Object.values(ids).filter((id) => !manifest[id!]);
    if (missing.length) throw new Error(`missing processed sprite: ${missing.join(', ')}`);
    const sizes = Object.fromEntries(Object.entries(ids).map(([slot, id]) => [slot, manifest[id!]]));
    for (const cmd of layoutMech(sizes)) {
      layers.push({ input: `public/${manifest[ids[cmd.slot]!].file}`, left: i * CELL + 10 + cmd.x, top: 10 + cmd.y });
    }
  });
  const w = CELL * specs.length;
  const h = MECH_BOX + 20;
  const sheet = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 24, g: 20, b: 40, alpha: 1 } } })
    .composite(layers).png().toBuffer();
  await sharp(sheet).resize(w * SCALE, h * SCALE, { kernel: 'nearest' }).toFile(out);
  console.log(`wrote ${out}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
