/**
 * Joins screenshots into one sheet, two across at half size, to review several screens at a glance.
 * Usage: tsx scripts/grid.ts out.png shot1.png shot2.png ...
 */
import sharp from 'sharp';

async function main(): Promise<void> {
  const [out, ...files] = process.argv.slice(2);
  if (!out || files.length === 0) throw new Error('usage: grid.ts out.png shot.png ...');
  const W = 620;
  const H = 540;
  const cols = 2;
  const layers = await Promise.all(files.map(async (file, i) => ({
    input: await sharp(file).resize(W, H, { kernel: 'nearest' }).png().toBuffer(),
    left: (i % cols) * W, top: Math.floor(i / cols) * H,
  })));
  await sharp({ create: { width: W * cols, height: H * Math.ceil(files.length / cols), channels: 4, background: '#000000' } })
    .composite(layers).png().toFile(out);
  console.log(`wrote ${out}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
