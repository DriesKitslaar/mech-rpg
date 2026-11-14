/**
 * Cuts the app icon and the launch screens for Android from art/raw/app-icon.png.
 * Usage: tsx scripts/art/icon.ts
 */
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const SOURCE = 'art/raw/app-icon.png';
const RES = 'android/app/src/main/res';
/** Launcher icon sizes per screen density, and the larger canvas of the adaptive icon's foreground. */
const DENSITIES: [string, number, number][] = [
  ['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216], ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432],
];
const SPLASHES: [string, number, number][] = [
  ['drawable', 480, 320],
  ['drawable-land-mdpi', 480, 320], ['drawable-land-hdpi', 800, 480], ['drawable-land-xhdpi', 1280, 720],
  ['drawable-land-xxhdpi', 1600, 960], ['drawable-land-xxxhdpi', 1920, 1280],
  ['drawable-port-mdpi', 320, 480], ['drawable-port-hdpi', 480, 800], ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 960, 1600], ['drawable-port-xxxhdpi', 1280, 1920],
];

const hex = (n: number): string => n.toString(16).padStart(2, '0');

async function main(): Promise<void> {
  // The colour around the subject: the launcher's own background and the launch screen continue it.
  const corner = await sharp(SOURCE).extract({ left: 8, top: 8, width: 16, height: 16 }).resize(1, 1).raw().toBuffer();
  const background = { r: corner[0], g: corner[1], b: corner[2], alpha: 1 };
  const colour = `#${hex(corner[0])}${hex(corner[1])}${hex(corner[2])}`;
  const icon = (size: number) => sharp(SOURCE).resize(size, size, { kernel: 'nearest' });

  for (const [density, size, canvas] of DENSITIES) {
    const dir = `${RES}/mipmap-${density}`;
    await icon(size).png().toFile(`${dir}/ic_launcher.png`);
    const circle = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
    await icon(size).composite([{ input: circle, blend: 'dest-in' }]).png().toFile(`${dir}/ic_launcher_round.png`);
    // The launcher shows only the middle two thirds of the foreground: the picture is set inside that.
    const inner = Math.round(canvas * (72 / 108));
    await sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await icon(inner).png().toBuffer(), gravity: 'centre' }]).png().toFile(`${dir}/ic_launcher_foreground.png`);
  }
  writeFileSync(`${RES}/values/ic_launcher_background.xml`,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${colour.toUpperCase()}</color>\n</resources>\n`);

  for (const [dir, w, h] of SPLASHES) {
    const size = Math.round(Math.min(w, h) * 0.5);
    await sharp({ create: { width: w, height: h, channels: 4, background } })
      .composite([{ input: await icon(size).png().toBuffer(), gravity: 'centre' }]).png().toFile(`${RES}/${dir}/splash.png`);
  }
  console.log(`icon and launch screens written; background ${colour}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
