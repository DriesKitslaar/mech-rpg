import { expect, test } from '@playwright/test';
import { open } from './helpers';

interface Heard { peak: number; rms: number; clipped: number; quietShare: number; firstSound: number }

/**
 * Nobody hears a test run, so the sound is measured instead: every song and every effect is played
 * into an audio engine that renders to memory, and what comes out is checked for being there, for
 * not being silent where it should play on, and for staying well inside what a speaker can take.
 */
test('every song and every sound effect makes sound, none of it too loud, and a song that loops has no holes in it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  const heard = await page.evaluate(async () => {
    // Loaded the way the game loads them, so what is measured is what ships.
    const [music, songs, audio] = await Promise.all([
      import('/src/platform/music.ts' as string), import('/src/content/songs.ts' as string), import('/src/platform/audio.ts' as string),
    ]);
    const RATE = 44100;
    const measure = (buffer: AudioBuffer) => {
      const data = buffer.getChannelData(0);
      const window = Math.floor(RATE * 0.25);
      let peak = 0;
      let sum = 0;
      let clipped = 0;
      let firstSound = -1;
      for (let i = 0; i < data.length; i++) {
        const level = Math.abs(data[i]);
        if (level > peak) peak = level;
        if (level >= 0.999) clipped += 1;
        if (firstSound < 0 && level > 0.002) firstSound = i / RATE;
        sum += data[i] * data[i];
      }
      let quiet = 0;
      let windows = 0;
      for (let from = 0; from + window <= data.length; from += window) {
        let energy = 0;
        for (let i = from; i < from + window; i++) energy += data[i] * data[i];
        windows += 1;
        if (Math.sqrt(energy / window) < 0.002) quiet += 1;
      }
      return { peak, rms: Math.sqrt(sum / data.length), clipped, quietShare: quiet / windows, firstSound };
    };
    const song = async (name: string, seconds: number) => {
      const ctx = new OfflineAudioContext(2, RATE * seconds, RATE);
      const player = new music.Music(() => ctx);
      player.play(name);
      // The player queues a quarter of a second ahead each time it is asked, as the game's frame loop asks it.
      for (let t = 0.1; t < seconds - 0.05; t += 0.1) void ctx.suspend(t).then(() => { player.update(); void ctx.resume(); });
      player.update();
      return measure(await ctx.startRendering());
    };
    const effect = async (name: string) => {
      const ctx = new OfflineAudioContext(2, RATE * 2, RATE);
      const sfx = new audio.Sfx(() => ctx);
      sfx.unlock();
      sfx.play(name);
      return measure(await ctx.startRendering());
    };
    const out: { songs: Record<string, Heard & { loop: boolean }>; sounds: Record<string, Heard> } = { songs: {}, sounds: {} };
    for (const name of Object.keys(songs.SONGS)) out.songs[name] = { ...(await song(name, 12)), loop: songs.SONGS[name].loop !== false };
    for (const name of Object.keys(audio.SOUNDS)) out.sounds[name] = await effect(name);
    return out;
  });

  expect(Object.keys(heard.songs)).toHaveLength(10);
  for (const [name, song] of Object.entries(heard.songs)) {
    expect(song.peak, `${name} is audible`).toBeGreaterThan(0.05);
    expect(song.peak, `${name} leaves room for the effects`).toBeLessThan(0.4);
    expect(song.clipped, `${name} does not clip`).toBe(0);
    expect(song.firstSound, `${name} starts at once`).toBeLessThan(0.2);
    // A looping song plays on without a quarter second of silence anywhere; a jingle is over in a few seconds.
    if (song.loop) expect(song.quietShare, `${name} has no holes`).toBe(0);
    else expect(song.quietShare, `${name} ends`).toBeGreaterThan(0.3);
  }
  expect(Object.keys(heard.sounds).length).toBeGreaterThanOrEqual(30);
  for (const [name, sound] of Object.entries(heard.sounds)) {
    expect(sound.peak, `${name} is audible`).toBeGreaterThan(0.01);
    expect(sound.peak, `${name} is not deafening`).toBeLessThan(0.6);
    expect(sound.clipped, `${name} does not clip`).toBe(0);
    expect(sound.firstSound, `${name} starts at once`).toBeLessThan(0.05);
    // An effect is over well inside two seconds.
    expect(sound.quietShare, `${name} ends`).toBeGreaterThan(0.4);
  }
  // The loudest effect is still several times quieter than the loudest a speaker can take, so a handful at once fit.
  expect(Math.max(...Object.values(heard.sounds).map((s) => s.peak))).toBeLessThan(0.5);
  expect(errors).toEqual([]);
});
