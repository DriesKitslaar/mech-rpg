import { createBattle, type BattleEvent, type BattleState } from '../../src/core/battle';
import { RADIO_CUES } from '../../src/core/wingman';
import { ENEMIES } from '../../src/content/enemies';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { WINGMEN } from '../../src/content/wingmen';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen } from '../../src/ui/battleScreen';
import { RADIO_CHARS, RADIO_MS, RADIO_WARN, Radio, cheered, radioText } from '../../src/ui/radio';
import type { SpriteStore } from '../../src/ui/sprites';
import { done, finishBattle, inHub, select, snap, strong } from '../helpers/app';

const LINES = { start: 'here', kill: 'mine', cheer: 'yours', warn: 'careful', win: 'done' };
const battle = (): BattleState => createBattle(DEMO_BUILD, [ENEMIES['recon-drone'], ENEMIES['recon-drone'], ENEMIES['recon-drone'], ENEMIES['recon-drone']], CATALOG, 3);
const shot = (target: string, hit = true): BattleEvent => ({ type: 'shot', unit: target === 'player' ? 'enemy-0' : 'player', weapon: 'rightHand', target, part: 'core', appliedTo: 'core', hit, damage: hit ? 10 : 0 });
const dead = (unit: string): BattleEvent => ({ type: 'unitDestroyed', unit });
const support = (target: string): BattleEvent => ({ type: 'support', name: 'Kite', target, damage: 18 });

describe('the wingman on the radio', () => {
  test('reports in when the battle opens, by name', () => {
    const radio = new Radio('Old Sixty', LINES);
    expect(radio.line).toBeNull();
    radio.open();
    expect(radio.line).toBe('OLD SIXTY: here');
    expect(radioText('Kite', 'x')).toBe('KITE: x');
  });

  test('a line stays up for a moment and then goes by itself', () => {
    const radio = new Radio('Kite', LINES);
    radio.open();
    radio.update(RADIO_MS - 1);
    expect(radio.line).toBe('KITE: here');
    radio.update(1);
    expect(radio.line).toBeNull();
    // Nothing to say, nothing to wait for.
    radio.update(5000);
    expect(radio.line).toBeNull();
  });

  test('claims a machine their own shot finished, every time', () => {
    const radio = new Radio('Kite', LINES);
    const s = battle();
    radio.hear(support('enemy-0'), s);
    radio.hear(dead('enemy-0'), s);
    expect(radio.line).toBe('KITE: mine');
    radio.update(RADIO_MS);
    radio.hear(support('enemy-1'), s);
    radio.hear(dead('enemy-1'), s);
    expect(radio.line).toBe('KITE: mine');
  });

  test('has a word for the pilot\'s first kill and every third after it, and none for the others', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(cheered)).toEqual([true, false, false, true, false, false, true]);
    const radio = new Radio('Kite', LINES);
    const s = battle();
    const said: (string | null)[] = [];
    for (const id of ['enemy-0', 'enemy-1', 'enemy-2', 'enemy-3']) {
      radio.update(RADIO_MS);
      radio.hear(shot(id), s);
      radio.hear(dead(id), s);
      said.push(radio.line);
    }
    expect(said).toEqual(['KITE: yours', null, null, 'KITE: yours']);
  });

  test('a kill is the pilot\'s when the pilot fired last, whoever fired before', () => {
    const radio = new Radio('Kite', LINES);
    const s = battle();
    radio.hear(support('enemy-0'), s);
    radio.hear(shot('enemy-0'), s);
    radio.hear(dead('enemy-0'), s);
    expect(radio.line).toBe('KITE: yours');
  });

  test('says nothing when it is the pilot who goes down', () => {
    const radio = new Radio('Kite', LINES);
    radio.hear(shot('player'), battle());
    radio.hear(dead('player'), battle());
    expect(radio.line).toBeNull();
  });

  test('warns once when a hit leaves the pilot\'s core thin, and not for a hit that does not', () => {
    const radio = new Radio('Kite', LINES);
    const s = battle();
    const core = s.units[0].parts.core!;
    core.ap = Math.ceil(core.maxAp * RADIO_WARN);
    radio.hear(shot('player'), s);
    expect(radio.line).toBeNull();
    core.ap = Math.ceil(core.maxAp * RADIO_WARN) - 1;
    // A shot that missed, or one at somebody else, is no reason.
    radio.hear(shot('player', false), s);
    radio.hear(shot('enemy-0'), s);
    expect(radio.line).toBeNull();
    radio.hear(shot('player'), s);
    expect(radio.line).toBe('KITE: careful');
    radio.update(RADIO_MS);
    radio.hear(shot('player'), s);
    expect(radio.line).toBeNull();
    // A bomb counts as a hit.
    const other = new Radio('Kite', LINES);
    other.hear({ type: 'blast', unit: 'enemy-0', target: 'player', damage: 30 }, s);
    expect(other.line).toBe('KITE: careful');
  });

  test('has the last word when the battle is won, and none when it is lost', () => {
    const radio = new Radio('Kite', LINES);
    radio.hear({ type: 'outcome', outcome: 'victory' }, battle());
    expect(radio.line).toBe('KITE: done');
    const lost = new Radio('Kite', LINES);
    lost.hear({ type: 'outcome', outcome: 'defeat' }, battle());
    expect(lost.line).toBeNull();
  });

  test('every line that comes up is counted once, for the sound that goes with it', () => {
    const radio = new Radio('Kite', LINES);
    expect(radio.takeFresh()).toBe(0);
    radio.open();
    radio.hear({ type: 'outcome', outcome: 'victory' }, battle());
    expect(radio.takeFresh()).toBe(2);
    expect(radio.takeFresh()).toBe(0);
  });
});

describe('what the wingmen have to say', () => {
  test.each(['en', 'nl'] as const)('every wingman has a line for every moment, and with their name it fits the strip (%s)', (language) => {
    setLanguage(language);
    try {
      for (const wingman of WINGMEN) {
        expect(Object.keys(wingman.radio).sort()).toEqual([...RADIO_CUES].sort());
        for (const cue of RADIO_CUES) {
          const line = radioText(wingman.name, wingman.radio[cue]);
          expect(wingman.radio[cue].length, `${wingman.id} ${cue}`).toBeGreaterThan(0);
          expect(line.length, line).toBeLessThanOrEqual(RADIO_CHARS);
        }
      }
    } finally {
      setLanguage('en');
    }
  });

  test('no two of them say the same thing', () => {
    const all = WINGMEN.flatMap((w) => Object.values(w.radio));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('the radio on the battle screen', () => {
  const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
  function screenOf(opts: { radio?: boolean; coach?: boolean; talk?: boolean } = {}) {
    const state = createBattle(DEMO_BUILD, [ENEMIES['recon-drone']], CATALOG, 7, { support: { name: 'Kite', damage: 500, orders: true } });
    const played: string[] = [];
    const flow = new BattleFlow(state, CATALOG, opts.talk ? { talk: [{ at: 'start', who: 'Dispatch', text: 'Listen.' }] } : { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, {
      fast: true, coach: !!opts.coach, sfx: { play: (name: string) => { played.push(name); } } as never,
      ...(opts.radio === false ? {} : { radio: { who: 'Kite', lines: LINES } }),
    });
    const said = (): string[] => {
      const texts: string[] = [];
      const target: Record<string, unknown> = {};
      const ctx = new Proxy(target, {
        get: (t, name: string) => (name in t ? t[name] : name === 'measureText' ? () => ({ width: 10 })
          : (...args: unknown[]) => { if (name === 'fillText') texts.push(String(args[0])); }),
        set: (t, name: string, value) => { t[name] = value; return true; },
      }) as unknown as CanvasRenderingContext2D;
      screen.draw(ctx);
      return texts;
    };
    return { flow, screen, said, played };
  }

  test('the wingman reports in once the banner is gone, with a click on the radio, and the line is written at the foot of the field', () => {
    const { screen, said, played } = screenOf();
    expect(screen.radioLine).toBeNull();
    screen.update(16);
    expect(screen.radioLine).toBe('KITE: here');
    expect(said()).toEqual(expect.arrayContaining(['KITE:', ' here']));
    expect(played).toEqual(['radio']);
    // It is gone again after a moment, with nothing pressed.
    for (let i = 0; i < 200; i++) screen.update(16);
    expect(screen.radioLine).toBeNull();
    expect(said()).not.toContain('KITE:');
  });

  test('a battle without a hired wingman has no radio', () => {
    const { screen, said, played } = screenOf({ radio: false });
    for (let i = 0; i < 10; i++) screen.update(16);
    expect(screen.radioLine).toBeNull();
    expect(said()).not.toContain('KITE:');
    expect(played).not.toContain('radio');
  });

  test('while somebody is talking the radio waits: the line is neither written nor heard until they are done', () => {
    const { flow, screen, said, played } = screenOf({ talk: true });
    for (let i = 0; i < 400; i++) screen.update(16);
    expect(flow.phase).toBe('talk');
    expect(said()).not.toContain('KITE:');
    expect(played).not.toContain('radio');
    screen.onInput('confirm');
    screen.onInput('confirm');
    expect(flow.phase).not.toBe('talk');
    screen.update(16);
    expect(said()).toContain('KITE:');
    expect(played).toContain('radio');
  });

  test('where a new pilot is being told the buttons the line is left off the field', () => {
    const { screen, said } = screenOf({ coach: true });
    screen.update(16);
    expect(screen.radioLine).toBe('KITE: here');
    expect(said()).not.toContain('KITE:');
  });

  test('a machine the wingman\'s shot finishes is claimed, and the battle won gets the last word', () => {
    const { flow, screen } = screenOf();
    const heard: string[] = [];
    for (let i = 0; i < 600 && flow.phase !== 'result'; i++) {
      screen.update(16);
      if (screen.radioLine && heard[heard.length - 1] !== screen.radioLine) heard.push(screen.radioLine);
      if (flow.phase === 'action') {
        for (let j = 0; j < 12 && flow.menu.items[flow.menu.cursor]?.id !== 'endTurn'; j++) flow.onInput('down');
        screen.onInput('confirm');
      }
    }
    expect(flow.state.outcome).toBe('victory');
    // The result is up; the frame after it the wingman has said their piece.
    screen.update(16);
    if (screen.radioLine && heard[heard.length - 1] !== screen.radioLine) heard.push(screen.radioLine);
    expect(heard).toEqual(['KITE: here', 'KITE: mine', 'KITE: done']);
  });
});

describe('a hired wingman in a contract', () => {
  const radio = (app: ReturnType<typeof inHub>['app']) => (snap(app).battle as unknown as { radio: string | null }).radio;

  test('is heard on the radio; an ally the story sends, and a pilot flying alone, are not', () => {
    const { app } = inHub(strong(done('intro-1', 'intro-2')));
    select(app, 'contracts');
    select(app, 'hadron-1');
    // The briefing offers the wingmen for hire: Kite is the first.
    const items = snap(app).menu.items.map((i) => i.id);
    expect(items).toContain('wingman');
    select(app, 'wingman');
    select(app, 'accept');
    expect(snap(app).screen).toBe('battle');
    app.update(16);
    expect(radio(app)).toBe(`KITE: ${WINGMEN[0].radio.start}`);
    finishBattle(app);
    const alone = inHub(strong(done('intro-1', 'intro-2'))).app;
    select(alone, 'contracts');
    select(alone, 'hadron-1');
    select(alone, 'accept');
    alone.update(16);
    expect(radio(alone)).toBeNull();
  });
});

describe('whose kill it is', () => {
  const blast = (unit: string, target = 'player', damage = 30): BattleEvent => ({ type: 'blast', unit, target, damage });
  const pulse = (unit: string): BattleEvent => ({ type: 'module', unit, effect: 'shock', amount: 0, damage: 40 });

  test('a bomb going off is nobody\'s kill: the wingman has no word for it, and it does not count as one of the pilot\'s', () => {
    const radio = new Radio('Kite', LINES);
    const s = battle();
    radio.hear(blast('enemy-0'), s);
    radio.hear(dead('enemy-0'), s);
    expect(radio.line).toBeNull();
    // The pilot's next is still the pilot's first.
    radio.hear(shot('enemy-1'), s);
    radio.hear(dead('enemy-1'), s);
    expect(radio.line).toBe('KITE: yours');
  });

  test('the warning a blast raised stays up when the bomb is gone', () => {
    const radio = new Radio('Kite', LINES);
    const s = battle();
    const core = s.units[0].parts.core!;
    core.ap = Math.ceil(core.maxAp * RADIO_WARN) - 1;
    radio.hear(blast('enemy-0'), s);
    radio.hear(dead('enemy-0'), s);
    expect(radio.line).toBe('KITE: careful');
  });

  test('a machine that goes down after an enemy fired is not the pilot\'s either', () => {
    const radio = new Radio('Kite', LINES);
    const s = battle();
    radio.hear(shot('player'), s);
    radio.hear(dead('enemy-1'), s);
    expect(radio.line).toBeNull();
  });

  test('the wingman\'s claim ends with whatever lands next: a shot, a blast or a module', () => {
    const s = battle();
    const after = (next: BattleEvent): string | null => {
      const radio = new Radio('Kite', LINES);
      radio.hear(support('enemy-0'), s);
      radio.hear(next, s);
      radio.hear(dead('enemy-0'), s);
      return radio.line;
    };
    expect(after(shot('enemy-0'))).toBe('KITE: yours');
    expect(after(pulse('player'))).toBe('KITE: yours');
    expect(after(blast('enemy-0'))).toBeNull();
    expect(after(pulse('enemy-1'))).toBeNull();
    expect(after(shot('player'))).toBeNull();
    // Something that is no fire at all leaves the claim where it was.
    expect(after({ type: 'guard', unit: 'player' })).toBe('KITE: mine');
  });

  test('a hit that finishes the pilot is past warning about', () => {
    const radio = new Radio('Kite', LINES);
    const s = battle();
    s.units[0].parts.core!.ap = 0;
    radio.hear(shot('player'), s);
    radio.hear(blast('enemy-0'), s);
    expect(radio.line).toBeNull();
  });

  test('the core is thin below thirty-five in a hundred, and the strip is no wider than the field in front of the lowest enemy', () => {
    expect(RADIO_WARN).toBe(0.35);
    // The strip starts 8 from the left and a letter is 4 wide: with its margins it must end by 172, where the bars of a mech standing third begin.
    expect(RADIO_CHARS).toBe(39);
    expect(8 + 8 + RADIO_CHARS * 4).toBeLessThanOrEqual(172);
  });
});

describe('where the strip is written', () => {
  const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
  /** Every rectangle filled and every text written while the screen is drawn, with where. */
  function drawn(screen: BattleScreen): { rects: number[][]; texts: { text: string; x: number; y: number }[] } {
    const rects: number[][] = [];
    const texts: { text: string; x: number; y: number }[] = [];
    const target: Record<string, unknown> = {};
    const ctx = new Proxy(target, {
      get: (t, name: string) => (name in t ? t[name] : name === 'measureText' ? () => ({ width: 10 })
        : (...args: unknown[]) => {
          if (name === 'fillText') texts.push({ text: String(args[0]), x: Number(args[1]), y: Number(args[2]) });
          if (name === 'fillRect') rects.push(args.map(Number));
        }),
      set: (t, name: string, value) => { t[name] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
    screen.draw(ctx);
    return { rects, texts };
  }

  test('from the left edge of the field, just above the panel, on a strip as wide as the line', () => {
    const state = createBattle(DEMO_BUILD, [ENEMIES['recon-drone']], CATALOG, 7, { support: { name: 'Kite', damage: 500, orders: true } });
    const screen = new BattleScreen(new BattleFlow(state, CATALOG, { quiet: true }), sprites, CATALOG, { fast: true, radio: { who: 'Kite', lines: LINES } });
    screen.update(16);
    const { rects, texts } = drawn(screen);
    const name = texts.find((t) => t.text === 'KITE:')!;
    const words = texts.find((t) => t.text === ' here')!;
    expect(name.x).toBe(12);
    // What is said follows the name on the same row.
    expect(words.x).toBe(12 + 'KITE:'.length * 4);
    expect(words.y).toBe(name.y);
    // The strip behind them: from 8, as wide as the line and its margins, and it ends above the panel.
    const strip = rects.find(([x, y]) => x === 8 && y === name.y - 1)!;
    expect(strip).toEqual([8, name.y - 1, 'KITE: here'.length * 4 + 8, 11]);
    expect(strip[1] + strip[3]).toBeLessThan(180);
    expect(strip[1]).toBeGreaterThan(150);
  });
});

describe('an ally the story sends', () => {
  test('fires from off the field and keeps off the radio: only a wingman who was hired speaks', () => {
    const { app } = inHub(strong(done('intro-1', 'intro-2', 'rival-1', 'choice-lumen', 'finale-lumen', 'audit-1', 'audit-2')));
    select(app, 'contracts');
    select(app, 'audit-3');
    select(app, 'accept');
    expect(snap(app).screen).toBe('battle');
    for (let i = 0; i < 20; i++) app.update(16);
    const view = snap(app).battle as unknown as { radio: string | null; support: string | null };
    expect(view.support).toBe('Ashfall');
    expect(view.radio).toBeNull();
  });
});
