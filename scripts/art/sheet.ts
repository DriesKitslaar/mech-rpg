/**
 * Joins raw images into one sheet at reduced size, to review a batch at a glance.
 * Usage: tsx scripts/art/sheet.ts out.png size columns image.png ...
 */
import sharp from 'sharp';

async function main(): Promise<void> {
  const [out, sizeArg, colsArg, ...files] = process.argv.slice(2);
  const size = Number(sizeArg);
  const cols = Number(colsArg);
  if (!out || !size || !cols || files.length === 0) throw new Error('usage: sheet.ts out.png size columns image.png ...');
  const layers = await Promise.all(files.map(async (file, i) => ({
    input: await sharp(file).resize(size, size, { fit: 'contain', background: '#181428' }).png().toBuffer(),
    left: (i % cols) * size, top: Math.floor(i / cols) * size,
  })));
  await sharp({ create: { width: size * cols, height: size * Math.ceil(files.length / cols), channels: 4, background: '#181428' } })
    .composite(layers).png().toFile(out);
  console.log(`wrote ${out}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
