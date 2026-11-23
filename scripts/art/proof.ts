/**
 * Builds a contact sheet of every family's upper body on every family's legs,
 * so a person can judge whether mixed mechs hold together.
 * Usage: tsx scripts/art/proof.ts [front|back|small]
 * From the front the sheet is art/proof/contact-sheet.png; another view has its name after it.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import sharp, { type OverlayOptions } from 'sharp';
import { BACK_JOINTS, VIEWS, dropOf, layoutMech, shoulderBar, type MechView, type SpriteSize, type SpriteSlot } from '../../src/ui/mechLayout';

type Manifest = Record<string, SpriteSize & { file: string }>;
const manifest = JSON.parse(readFileSync('src/content/sprites.json', 'utf8')) as Manifest;

const view = (process.argv[2] ?? 'front') as MechView;
if (!(view in VIEWS)) throw new Error(`no such view: ${view} (front, back or small)`);
const { box, suffix } = VIEWS[view];

const SIX = [
  { legs: 'legs-strider', core: 'core-hauler', head: 'head-scout-mk1', arms: 'arms-rigger' },
  { legs: 'legs-halo', core: 'core-halo', head: 'head-halo', arms: 'arms-halo' },
  { legs: 'legs-bulwark', core: 'core-bulwark', head: 'head-bulwark', arms: 'arms-bulwark' },
  { legs: 'legs-ronin', core: 'core-ronin', head: 'head-ronin', arms: 'arms-ronin' },
  { legs: 'legs-wraith', core: 'core-wraith', head: 'head-wraith', arms: 'arms-wraith' },
  { legs: 'legs-colossus', core: 'core-colossus', head: 'head-colossus', arms: 'arms-colossus' },
];
// The sheet from the front is the one a decision was written about: it keeps its six families. The other views show all there are.
const UPPERS = view === 'front' ? SIX : [
  ...SIX,
  { legs: 'legs-mantis', core: 'core-mantis', head: 'head-mantis', arms: 'arms-mantis' },
  { legs: 'legs-auditor', core: 'core-auditor', head: 'head-auditor', arms: 'arms-auditor' },
];
const LOWERS = view === 'front' ? SIX.map((family) => family.legs) : [...UPPERS.map((family) => family.legs), 'legs-crawler', 'legs-spider', 'legs-glide'];
const COLS = UPPERS.length;
const WEAPONS = { rightHand: 'wpn-rivet-rifle', leftHand: 'wpn-arc-pistol', shoulder: 'wpn-mortar-pod' };
const CELL_W = box + 40;
const CELL_H = box + 30;
const SCALE = 2;
/** The colours of a joint, as the game draws it under the layers of a mech from behind. */
const JOINT = { r: 27, g: 26, b: 36, alpha: 1 };

async function main(): Promise<void> {
  const layers: OverlayOptions[] = [];
  let cell = 0;
  // One row per set of legs, one column per upper body: the diagonal shows the pure families.
  for (const legs of LOWERS) for (const upper of UPPERS) {
    const { core, head, arms } = upper;
    const names: Record<SpriteSlot, string> = { legs, core, head, armNear: `${arms}.near`, armFar: `${arms}.far`, ...WEAPONS };
    const ids = Object.fromEntries(Object.entries(names).map(([slot, id]) => [slot, `${id}${suffix}`])) as Record<SpriteSlot, string>;
    const missing = Object.values(ids).filter((id) => !manifest[id]);
    if (missing.length) throw new Error(`missing processed sprite: ${missing.join(', ')}`);
    const sizes = Object.fromEntries(Object.entries(ids).map(([slot, id]) => [slot, manifest[id]]));
    const ox = (cell % COLS) * CELL_W + 4;
    const oy = Math.floor(cell / COLS) * CELL_H + 4;
    if (view === 'back') {
      for (const joint of [BACK_JOINTS.neck, shoulderBar(sizes), BACK_JOINTS.waist]) {
        layers.push({
          input: { create: { width: joint.w, height: joint.h, channels: 4, background: JOINT } },
          left: ox + joint.x, top: oy + joint.y + dropOf(sizes),
        });
      }
    }
    for (const cmd of layoutMech(sizes, view)) {
      layers.push({ input: `public/${manifest[ids[cmd.slot]].file}`, left: ox + cmd.x, top: oy + cmd.y });
    }
    cell++;
  }
  mkdirSync('art/proof', { recursive: true });
  const w = CELL_W * COLS;
  const h = CELL_H * LOWERS.length;
  const sheet = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 24, g: 20, b: 40, alpha: 1 } } })
    .composite(layers).png().toBuffer();
  const out = `art/proof/contact-sheet${view === 'front' ? '' : `-${view}`}.png`;
  await sharp(sheet).resize(w * SCALE, h * SCALE, { kernel: 'nearest' }).toFile(out);
  console.log(`wrote ${out}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
