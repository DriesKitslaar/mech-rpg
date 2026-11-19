import type { GameState } from '../../src/core/game';
import { DEFAULT_MIXES, mixId, setMix, stepMix } from '../../src/core/mix';
import { WORLD } from '../../src/content/codex';
import { SCENES } from '../../src/content/scenes';
import { STRINGS } from '../../src/content/strings';
import { SHUTTER_MS } from '../../src/ui/app';
import type { SpriteStore } from '../../src/ui/sprites';
import { accept, done, inHub, press, savedGame, select, snap, strong } from '../helpers/app';
import { record } from '../helpers/canvas';

/**
 * A mix of the pilot's own is worn like any paint: wherever the pilot's machine is drawn, its frame
 * is asked for in the mix, by the mix's own name. (What colours that name stands for is the store's
 * to work out: see paint.test.ts.)
 */

/** A store that says what it was asked for in which paint. */
function painting(): { store: SpriteStore; asked: string[] } {
  const asked: string[] = [];
  const picture = (fallback: { w: number; h: number }) => ({ image: {} as CanvasImageSource, w: fallback.w, h: fallback.h });
  return { asked, store: { get: (_id, fallback) => picture(fallback), painted: (id, paint, fallback) => { asked.push(`${id}@${paint}`); return picture(fallback); } } };
}
const MIX = stepMix(stepMix(DEFAULT_MIXES[1], 'hue', 5), 'finish', 3);
const NAME = mixId(MIX);
// Every page of story read: a game that is not hurried holds each for a moment, and this is not about them.
const pilot = (): GameState => setMix({
  ...strong(done('intro-1', 'intro-2', 'hadron-1')), callsign: 'VANTA', lessons: ['momentum', 'rout', 'swarm'],
  scenes: SCENES.map((entry) => entry.id), codex: WORLD.map((entry) => entry.id),
}, MIX);
/** The pictures a machine's frame is made of: its head, its core, its legs, and its arms as two, the far one and the near. */
const frameOf = (game: GameState, view = ''): string[] =>
  [game.build.head, game.build.core, game.build.legs, `${game.build.arms}.far`, `${game.build.arms}.near`].map((id) => `${id}${view}@${NAME}`);

describe('a mix is worn like any paint', () => {
  test('in the hangar and in the garage the machine\'s frame is asked for in it, and the garage calls it by its place', () => {
    const { store, asked } = painting();
    const game = pilot();
    expect(game.paint).toBe(NAME);
    const { app } = inHub(game, undefined, { sprites: store });
    asked.length = 0;
    record((ctx) => app.draw(ctx));
    expect([...asked].sort()).toEqual(frameOf(game).sort());
    select(app, 'garage');
    asked.length = 0;
    const shown = record((ctx) => app.draw(ctx));
    expect([...asked].sort()).toEqual(frameOf(game).sort());
    expect(shown.texts.some((t) => t.text === STRINGS.garage.paint('Mix 2'))).toBe(true);
  });

  test('in a battle it is seen from behind in it', () => {
    const { store, asked } = painting();
    const game = pilot();
    const { app } = inHub(game, 7, { sprites: store });
    accept(app, 'patrol');
    asked.length = 0;
    record((ctx) => app.draw(ctx));
    // Every layer of the pilot's own machine from behind, and none of them in another paint.
    const back = asked.filter((entry) => entry.includes('.back@'));
    expect([...new Set(back)].sort()).toEqual(frameOf(game, '.back').sort());
  });

  test('and the launch a contract opens with shows it in it', () => {
    const { store, asked } = painting();
    const game = pilot();
    const { app } = inHub(game, 7, { sprites: store, fast: false });
    select(app, 'contracts');
    select(app, 'patrol');
    // The doors of the briefing are let open, so that what is pressed is taken.
    app.update(400);
    // The launch takes the machine's pictures as it begins.
    asked.length = 0;
    select(app, 'accept');
    expect(snap(app).screen).toBe('battle');
    expect((snap(app) as unknown as { launch: unknown }).launch).not.toBeNull();
    app.update(SHUTTER_MS);
    record((ctx) => app.draw(ctx));
    const back = asked.filter((entry) => entry.includes('.back@'));
    expect([...new Set(back)].sort()).toEqual(frameOf(game, '.back').sort());
  });

  test('stepping the paint in the garage goes through the three and changes none of them', () => {
    const { store } = painting();
    const made = inHub(pilot(), undefined, { sprites: store });
    const before = savedGame(made.store).mixes;
    select(made.app, 'garage');
    const seen: string[] = [];
    for (let i = 0; i < 20; i++) { press(made.app, 'next'); seen.push(savedGame(made.store).paint); }
    expect(seen).toContain(mixId(DEFAULT_MIXES[0]));
    expect(seen).toContain(NAME);
    expect(seen).toContain(mixId(DEFAULT_MIXES[2]));
    expect(savedGame(made.store).mixes).toEqual(before);
  });
});
