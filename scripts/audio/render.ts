/**
 * Renders every song offline in Chromium with the engine the game uses, and checks that it makes sound at a
 * sane level. Nobody has to listen for this: a song fails when it clips, is all but silent, or (for a loop)
 * has long stretches of dead air.
 * Usage: npx tsx scripts/audio/render.ts [song ...] [--full] [--voices] [--wav dir]
 *   --full     render each loop once through and a little into its repeat, instead of its first 20 seconds
 *   --voices   also render each voice on its own, without the compressor, to balance a mix
 *   --wav dir  write what was measured to dir as 16-bit wav files, for a person to listen to
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// esbuild and playwright are not dependencies of their own: they come with tsx, which runs this script, and
// with the browser tests.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { SONGS, type SongName } from '../../src/content/songs';
import { songSeconds } from '../../src/platform/music';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RATE = 44100;
/** How much of a looping song is rendered unless --full asks for all of it. */
const SECONDS = 20;
/** A jingle is rendered to its end plus this, so that its last chord and echo are measured too. */
const TAIL = 1.5;
/** A tenth of a second quieter than this counts as silence: sixty decibels under full scale. */
const SILENCE = 0.001;
const LIMITS = { peak: 1, rms: 0.005, silent: 0.3 };

type Engine = typeof import('../../src/platform/music') & typeof import('../../src/content/songs');
interface Job { name: SongName; seconds: number; solo: string | null; wav: boolean; rate: number; silence: number }
interface Measured { peak: number; rms: number; silent: number; pcm: string | null }

/**
 * The Chromium to launch. The project never runs `playwright install`, so the build this version of Playwright
 * asks for may be missing; any Chromium that Playwright installed earlier renders audio just as well.
 */
function chromiumPath(): string | undefined {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH;
  if (existsSync(chromium.executablePath())) return undefined;
  const home = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!home || !existsSync(home)) return undefined;
  const builds = readdirSync(home).filter((dir) => /^chromium-\d+$/.test(dir)).sort().reverse();
  return builds.flatMap((dir) => ['chrome-linux64/chrome', 'chrome-linux/chrome'].map((file) => join(home, dir, file))).find((file) => existsSync(file));
}

/** The engine and the songs as one script for the page, under the global name Ironwage. */
async function bundle(): Promise<string> {
  const result = await build({
    stdin: { contents: "export * from './src/platform/music'; export { SONGS } from './src/content/songs';", resolveDir: ROOT, loader: 'ts' },
    bundle: true, format: 'iife', globalName: 'Ironwage', target: 'es2022', write: false, logLevel: 'silent',
  });
  return result.outputFiles[0].text;
}

/**
 * Runs in the page. Plays a song through the real `Music` into an offline audio engine and measures the
 * result. It is sent to the browser as text, so it can use nothing from this file but its argument, and it
 * must not define named functions of its own: tsx wraps those in a helper that the page does not have.
 */
async function renderInPage(job: Job): Promise<Measured> {
  const { Music, SONGS: songs } = (globalThis as unknown as { Ironwage: Engine }).Ironwage;
  const ctx = new OfflineAudioContext(2, Math.ceil(job.seconds * job.rate), job.rate);
  let song = songs[job.name];
  if (job.solo) {
    // One voice on its own and no compressor, so that what is measured is that voice's own level.
    const patterns = Object.fromEntries(Object.entries(song.patterns).map(([key, pattern]) =>
      [key, { ...pattern, lines: Object.fromEntries(Object.entries(pattern.lines).filter(([voice]) => voice === job.solo)) }]));
    song = { ...song, patterns };
    (ctx as { createDynamicsCompressor?: unknown }).createDynamicsCompressor = undefined;
  }
  const music = new Music(() => ctx as unknown as AudioContext, { [job.name]: song });
  music.play(job.name);
  music.update();
  // The frames of the game, in rendered time: the engine queues a quarter second ahead, so ten calls a second keep it fed.
  for (let at = 0.1; at < job.seconds - 0.05; at += 0.1) {
    void ctx.suspend(at).then(() => { music.update(); void ctx.resume(); });
  }
  const buffer = await ctx.startRendering();
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const size = job.rate / 10;
  let peak = 0;
  let total = 0;
  let windows = 0;
  let quiet = 0;
  for (let start = 0; start + size <= left.length; start += size) {
    let energy = 0;
    for (let i = start; i < start + size; i++) {
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
      energy += (left[i] * left[i] + right[i] * right[i]) / 2;
    }
    total += energy;
    windows++;
    if (Math.sqrt(energy / size) < job.silence) quiet++;
  }
  let pcm: string | null = null;
  if (job.wav) {
    const samples = new Int16Array(left.length * 2);
    for (let i = 0; i < left.length; i++) {
      samples[i * 2] = Math.round(Math.max(-1, Math.min(1, left[i])) * 32767);
      samples[i * 2 + 1] = Math.round(Math.max(-1, Math.min(1, right[i])) * 32767);
    }
    const bytes = new Uint8Array(samples.buffer);
    let text = '';
    for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    pcm = btoa(text);
  }
  return { peak, rms: Math.sqrt(total / (windows * size)), silent: quiet / windows, pcm };
}

function writeWav(file: string, pcm: string): void {
  const data = Buffer.from(pcm, 'base64');
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([header, data]));
}

/** What is wrong with a rendered song, in words; empty when it is fine. */
function faults(measured: Measured, loop: boolean): string[] {
  const found: string[] = [];
  if (!(measured.peak < LIMITS.peak)) found.push(`clips (peak ${measured.peak.toFixed(3)})`);
  if (!(measured.rms >= LIMITS.rms)) found.push(`is all but silent (rms ${measured.rms.toFixed(4)})`);
  if (loop && measured.silent > LIMITS.silent) found.push(`has dead air (${(measured.silent * 100).toFixed(0)}% of it silent)`);
  return found;
}

const row = (name: string, seconds: number, m: Measured, verdict: string): string =>
  `${name.padEnd(12)}${seconds.toFixed(1).padStart(7)}${m.peak.toFixed(3).padStart(8)}${m.rms.toFixed(4).padStart(9)}${`${(m.silent * 100).toFixed(1)}%`.padStart(9)}  ${verdict}`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const full = args.includes('--full');
  const voices = args.includes('--voices');
  const wavDir = args.includes('--wav') ? args[args.indexOf('--wav') + 1] : null;
  if (args.includes('--wav') && !wavDir) throw new Error('--wav needs a directory');
  const names = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--wav');
  for (const name of names) if (!(name in SONGS)) throw new Error(`no song called "${name}"; there are ${Object.keys(SONGS).join(', ')}`);
  const chosen = (names.length > 0 ? names : Object.keys(SONGS)) as SongName[];
  if (wavDir) mkdirSync(wavDir, { recursive: true });

  const browser = await chromium.launch({ executablePath: chromiumPath() });
  let failed = false;
  try {
    const page = await browser.newPage();
    await page.addScriptTag({ content: await bundle() });
    console.log(`${'song'.padEnd(12)}${'seconds'.padStart(7)}${'peak'.padStart(8)}${'rms'.padStart(9)}${'silent'.padStart(9)}`);
    for (const name of chosen) {
      const song = SONGS[name];
      const length = songSeconds(song);
      const seconds = !song.loop ? length + TAIL : full ? length + 4 : SECONDS;
      const job: Job = { name, seconds, solo: null, wav: wavDir !== null, rate: RATE, silence: SILENCE };
      const measured = await page.evaluate(renderInPage, job);
      const found = faults(measured, song.loop);
      if (found.length > 0) failed = true;
      console.log(row(name, seconds, measured, found.length > 0 ? `FAIL: ${found.join(', ')}` : 'ok'));
      if (wavDir && measured.pcm) writeWav(join(wavDir, `${name}.wav`), measured.pcm);
      if (voices) {
        for (const voice of Object.keys(song.voices)) {
          const alone = await page.evaluate(renderInPage, { ...job, solo: voice, wav: false });
          console.log(row(`  ${voice}`, seconds, alone, ''));
        }
      }
    }
  } finally {
    await browser.close();
  }
  if (failed) {
    console.error('Some songs failed the check.');
    process.exitCode = 1;
  } else {
    console.log(`All ${chosen.length} songs make sound at a sane level.`);
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
