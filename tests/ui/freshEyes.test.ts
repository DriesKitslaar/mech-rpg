import { createBattle, type BattleEvent, type BattleState } from '../../src/core/battle';
import type { GameState } from '../../src/core/game';
import type { EnemyDef } from '../../src/core/types';
import { JUKEBOX, UNITS, WORLD } from '../../src/content/codex';
import { FINDS } from '../../src/content/finds';
import { setLanguage } from '../../src/content/language';
import { MEDALS } from '../../src/content/medals';
import '../../src/content/nl';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';
import type { App } from '../../src/ui/app';
import { BattleFlow } from '../../src/ui/battleFlow';
import { LOGICAL_W } from '../../src/ui/display';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { STRINGS } from '../../src/content/strings';
import { COMPARE_LINE_CHARS, PART_LINE_CHARS, compareParts, partLines } from '../../src/ui/partInfo';
import { DETAIL_TEXT_X } from '../../src/ui/shopScreen';
import { CHAR_W } from '../../src/ui/widgets';
import { done, finishMission, inHub, press, savedGame, select, snap, strong, type Store } from '../helpers/app';
import { record, type Written } from '../helpers/canvas';

/**
 * What four testers who had not seen the game found on its screens, held so that it stays mended.
 */
afterEach(() => setLanguage('en'));

describe('a part\'s lines in the shop', () => {
  test('the widest of them ends inside the panel, clear of its border, in English and in Dutch', () => {
    // The shop's panel runs to the screen's edge, and its border is the last pixel but one.
    const border = LOGICAL_W - 1;
    expect(DETAIL_TEXT_X + PART_LINE_CHARS * CHAR_W).toBeLessThan(border - 2);
    expect(COMPARE_LINE_CHARS).toBeLessThanOrEqual(PART_LINE_CHARS);
    for (const language of ['en', 'nl'] as const) {
      setLanguage(language);
      const wide: string[] = [];
      for (const part of Object.values(CATALOG)) {
        for (const line of partLines(part)) if (line.length > PART_LINE_CHARS) wide.push(`${language} ${part.name}: ${line}`);
      }
      expect(wide).toEqual([]);
    }
  });
});

describe('the three kinds of damage have one letter each, the same wherever they are written', () => {
  test('the comparison of two fire controls uses the letters of the line above it, in English and in Dutch', () => {
    const [a, b] = [CATALOG['fcs-omni'], CATALOG['fcs-lattice']];
    expect([a.kind, b.kind]).toEqual(['fcs', 'fcs']);
    for (const [language, strings] of [['en', STRINGS], ['nl', STRINGS_NL]] as const) {
      setLanguage(language);
      const I = strings.partInfo;
      const letters = [I.typeLetters.kinetic, I.typeLetters.energy, I.typeLetters.explosive];
      // The line of a part, and of every part with armour, names the three in this order.
      expect(I.aimByType, language).toBe(`${I.aim} ${letters.join('/')}`);
      expect(I.resist, language).toMatch(new RegExp(` ${letters.join('/')}$`));
      expect(new Set(letters).size).toBe(3);
      const chips = compareParts(b, a).flat().map((chip) => chip.text);
      const aims = chips.filter((text) => text.startsWith(`${I.aim} `)).map((text) => text.split(' ')[1]);
      expect(aims.length, language).toBeGreaterThan(0);
      for (const letter of aims) expect(letters, `${language}: ${letter}`).toContain(letter);
    }
    setLanguage('en');
    expect([STRINGS.partInfo.typeLetters, STRINGS_NL.partInfo.typeLetters]).toEqual([
      { kinetic: 'K', energy: 'E', explosive: 'X' }, { kinetic: 'K', energy: 'S', explosive: 'E' },
    ]);
  });
});

describe('aiming at a part that is already destroyed', () => {
  const mech: EnemyDef = { id: 'test-mech', name: 'Test Mech', ai: 'gunner', sprite: 'none', build: STARTER_BUILD };
  function aimed(change: (state: BattleState) => void): BattleFlow {
    const state = structuredClone(createBattle(DEMO_BUILD, [mech], CATALOG, 1));
    change(state);
    const flow = new BattleFlow(state, CATALOG, {});
    for (let i = 0; i < 800 && flow.phase === 'animating'; i++) flow.advance();
    const pick = (id: string): void => {
      for (let i = 0; i < 12 && flow.menu.items[flow.menu.cursor]?.id !== id; i++) flow.onInput('down');
      expect(flow.menu.items[flow.menu.cursor]?.id).toBe(id);
      flow.onInput('confirm');
    };
    pick('fire');
    pick('rightHand');
    expect(flow.phase).toBe('target');
    return flow;
  }
  const row = (flow: BattleFlow, id: string) => flow.menu.items.find((item) => item.id === id)!;

  test('its row says where the shot goes: on to the core, for half; a part that still stands is named and no more', () => {
    const flow = aimed((state) => { state.units[1].parts.legs!.ap = 0; });
    expect(row(flow, 'legs').label).toBe('Legs: gone, half to core');
    expect(row(flow, 'arms').label).toBe('Arms');
    expect(row(flow, 'core').label).toBe('Core');
    expect(row(flow, 'legs').enabled).toBe(true);
    // And what the row says is what the aiming line then promises, and what the rules do: half of what the same shot is worth on a part that stands.
    for (let i = 0; i < 6 && flow.menu.items[flow.menu.cursor].id !== 'legs'; i++) flow.onInput('down');
    const gone = flow.preview!.damage;
    const whole = aimed(() => {});
    for (let i = 0; i < 6 && whole.menu.items[whole.menu.cursor].id !== 'legs'; i++) whole.onInput('down');
    expect(gone).toBe(Math.max(1, Math.floor(whole.preview!.damage / 2)));
    const before = flow.state.units[1].parts.core!.ap;
    flow.onInput('confirm');
    const shots = flow.state.events.filter((event): event is BattleEvent & { type: 'shot' } => event.type === 'shot' && event.unit === 'player');
    expect(shots.length).toBeGreaterThan(0);
    for (const shot of shots) expect(shot).toMatchObject({ part: 'legs', appliedTo: 'core' });
    expect(flow.state.units[1].parts.core!.ap).toBeLessThanOrEqual(before);
  });

  test('in Dutch the row says the same', () => {
    setLanguage('nl');
    const flow = aimed((state) => { state.units[1].parts.arms!.ap = 0; });
    expect(row(flow, 'arms').label).toBe('Armen: weg, helft op kern');
    expect(row(flow, 'legs').label).toBe('Benen');
  });
});

describe('a row of the arena that cannot be challenged does not offer to be', () => {
  const words = (app: App): string[] => record((ctx) => app.draw(ctx)).texts.map((t) => t.text);
  const inHand = (app: App) => snap(app).menu.items[snap(app).menu.cursor];

  test('the hint has A on a row that takes a challenge, and leaves it out on one that is locked: on the ladder and among the masters', () => {
    const { app } = inHub(strong(done('intro-1', 'intro-2')));
    select(app, 'arena');
    expect(inHand(app).enabled).toBe(true);
    expect(words(app)).toContain(STRINGS.arena.back);
    expect(words(app)).not.toContain(STRINGS.arena.backLocked);
    // Down to the first row that is locked.
    for (let i = 0; i < 40 && inHand(app).enabled; i++) press(app, 'down');
    expect(inHand(app).enabled).toBe(false);
    expect(words(app)).toContain(STRINGS.arena.backLocked);
    expect(words(app)).not.toContain(STRINGS.arena.back);
    // The masters take no challenge from a pilot who is not champion: none of their rows offers one.
    press(app, 'next');
    expect(snap(app).page).toBe('masters');
    expect(inHand(app).enabled).toBe(false);
    expect(words(app)).toContain(STRINGS.arena.backLocked);
    expect(words(app)).not.toContain(STRINGS.arena.back);
    expect([STRINGS.arena.back, STRINGS.arena.backLocked]).toEqual(['A: challenge   L1/R1: page   B: back', 'L1/R1: page   B: back']);
    expect([STRINGS_NL.arena.back, STRINGS_NL.arena.backLocked]).toEqual(['A: daag uit   L1/R1: blad   B: terug', 'L1/R1: blad   B: terug']);
  });
});

describe('the other side\'s offer, taken by a pilot who already holds what it hands over', () => {
  /** A later telling, where the first contract of a client has two offers; in a frame that wins it. */
  const again = (codex: string[]): GameState => ({ ...strong(done('intro-1', 'intro-2')), cycle: 1, completed: ['intro-1', 'intro-2'], scenes: ['act-1', 'again-1'], codex });
  const announced = (app: App): string[] => [snap(app).toast, ...snap(app).toasts].filter((id): id is string => id !== null);
  function flown(codex: string[]): { app: App; store: Store } {
    const made = inHub(again(codex));
    select(made.app, 'contracts');
    select(made.app, 'hadron-1');
    expect(snap(made.app).screen).toBe('briefing');
    select(made.app, 'other');
    select(made.app, 'accept');
    finishMission(made.app);
    return made;
  }

  test('the bill says so: the paper is named under ALREADY FOUND, where otherwise nothing would be said at all', () => {
    const { app, store } = flown(['paper-order']);
    expect(savedGame(store).choices).toMatchObject({ seam: 'stand' });
    expect(announced(app)).toContain('held:paper-order');
    expect(announced(app).filter((id) => id.startsWith('find'))).toEqual([]);
    // Shown, it has the words the game has for it.
    for (let i = 0; i < 80 && snap(app).toast !== 'held:paper-order'; i++) app.update(snap(app).toast === null ? 16 : 3000);
    expect(snap(app).toast).toBe('held:paper-order');
    const words = record((ctx) => app.draw(ctx)).texts.map((t) => t.text);
    expect(words).toContain('ALREADY FOUND');
    expect(words).toContain('PURCHASE ORDER');
    expect(STRINGS_NL.database.heldToast).toBe('AL GEVONDEN');
  });

  test('a pilot who does not hold it is told it is found, as ever, and not that it was held', () => {
    const { app, store } = flown([]);
    expect(savedGame(store).codex).toContain('paper-order');
    expect(announced(app).some((id) => id === 'find:paper-order' || id.startsWith('finds:'))).toBe(true);
    expect(announced(app).filter((id) => id.startsWith('held:'))).toEqual([]);
  });
});

describe('the shop says where its short words are explained', () => {
  const foot = (app: App) => record((ctx) => app.draw(ctx)).texts.filter((t) => t.y >= 255).map((t) => t.text);

  test('under the hint, in small letters, by the names the hub and the database have for the place', () => {
    for (const [language, S] of [['en', STRINGS], ['nl', STRINGS_NL]] as const) {
      const { app } = inHub({ ...done(), settings: { ...done().settings, language } });
      select(app, 'shop');
      expect(foot(app)).toEqual([S.shop.wordsHint]);
      expect(S.shop.wordsHint).toContain(S.hub.database);
      expect(S.shop.wordsHint).toContain(S.database.pages.manual);
      expect(S.shop.wordsHint.length * 4).toBeLessThanOrEqual(LOGICAL_W - 12);
    }
  });

  test('a part just bought has that line for where it is fitted, as before', () => {
    const { app } = inHub({ ...done(), credits: 5000 });
    select(app, 'shop');
    press(app, 'confirm');
    expect(snap(app).message).toMatch(/^Bought /);
    expect(foot(app)).toEqual([STRINGS.shop.fitHint]);
  });
});

describe('no word lies over another, and none runs off the screen', () => {
  /** What is written on the screen once: a word with an edge is written several times a pixel apart. */
  function written(app: App): Written[] {
    const texts = record((ctx) => app.draw(ctx)).texts.filter((t) => t.text.trim() !== '');
    return texts.filter((t, i) => !texts.slice(0, i).some((u) => u.text === t.text && Math.abs(u.y - t.y) <= 2 && Math.abs(u.left - t.left) <= 2));
  }
  /** How tall the letters of a text stand: a row of the usual size is eleven apart from the next. */
  const tall = (t: Written): number => Math.max(6, t.size - 3);
  function crowded(app: App): string[] {
    const texts = written(app);
    const out: string[] = [];
    for (const t of texts) if (t.left < 0 || t.right > LOGICAL_W) out.push(`off the screen: ${t.text}`);
    texts.forEach((a, i) => texts.slice(i + 1).forEach((b) => {
      const sameRows = a.y < b.y + tall(b) && b.y < a.y + tall(a);
      if (sameRows && a.left < b.right - 0.5 && b.left < a.right - 0.5) out.push(`"${a.text}" over "${b.text}"`);
    }));
    return out;
  }
  /** A pilot with all of it open: the story told, the ladder climbed, the crowns and the seat, medals, an account. */
  function veteran(language: 'en' | 'nl'): GameState {
    const story = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1',
      'choice-hadron', 'hadron-3', 'hadron-4', 'hadron-5', 'finale-hadron', 'audit-1', 'audit-2', 'audit-3', 'verdict-enforce'];
    const base = strong(done(...story));
    return {
      ...base, endingSeen: true, scenes: [], credits: 1234567, xp: 99999, arenaRank: 15, battlesWon: 44,
      met: UNITS.map((unit) => unit.id), codex: [...WORLD.map((entry) => entry.id), ...FINDS.map((find) => find.id)],
      medals: MEDALS.map((medal) => medal.id), heard: JUKEBOX.map((song) => song.id),
      wonAs: { duellist: 15, marksman: 8, artillery: 3, lancer: 15, bastion: 2, skirmisher: 0, allrounder: 15 },
      grudge: { name: 'Brakk', kind: 'heavy-mech', origin: 'wrecked', knows: 'wpn-lance-emitter', met: 1, waited: 2 },
      stats: { ...base.stats, contracts: 123, lost: 45, retreats: 6, kills: 789, seconds: 360000 },
      settings: { ...base.settings, language },
    };
  }

  test.each(['en', 'nl'] as const)('in the rooms of the hub, on every page of each (%s)', (language) => {
    const { app } = inHub(veteran(language));
    const faults: string[] = [];
    const look = (where: string): void => { for (const fault of crowded(app)) faults.push(`${where}: ${fault}`); };
    look('hub');
    select(app, 'contracts');
    for (let i = 0; i < snap(app).menu.items.length; i++) { look(`contracts ${i}`); press(app, 'down'); }
    press(app, 'cancel');
    for (const [room, pages] of [['pilot', 5], ['database', 6], ['arena', 2], ['training', 2]] as const) {
      select(app, room);
      expect(snap(app).screen).toBe(room);
      for (let page = 0; page < pages; page++) {
        const rows = Math.min(snap(app).menu.items.length, 60);
        for (let row = 0; row < Math.max(1, rows); row++) { look(`${room} ${page}/${row}`); press(app, 'down'); }
        press(app, 'next');
      }
      press(app, 'cancel');
      expect(snap(app).screen).toBe('hub');
    }
    for (const room of ['gauntlet', 'options', 'messages'] as const) {
      select(app, room);
      for (let row = 0; row < Math.max(1, snap(app).menu.items.length); row++) { look(`${room} ${row}`); press(app, 'down'); }
      press(app, 'cancel');
      if (snap(app).screen !== 'hub') press(app, 'cancel');
      expect(snap(app).screen).toBe('hub');
    }
    expect(faults).toEqual([]);
  });

  test.each(['en', 'nl'] as const)('in the shop, on every shelf, buying and selling (%s)', (language) => {
    const { app } = inHub(veteran(language));
    select(app, 'shop');
    const faults: string[] = [];
    for (const side of ['buy', 'sell']) {
      for (let tab = 0; tab < 10; tab++) {
        const rows = snap(app).menu.items.length;
        for (let row = 0; row < Math.max(1, rows); row++) { for (const fault of crowded(app)) faults.push(`${side} ${tab}/${row}: ${fault}`); press(app, 'down'); }
        press(app, 'next');
      }
      press(app, 'right');
    }
    expect(faults).toEqual([]);
  });

  test.each(['en', 'nl'] as const)('in the garage: the slots, a slot\'s parts, the paint and the builds (%s)', (language) => {
    const { app } = inHub(veteran(language));
    select(app, 'garage');
    const faults: string[] = [];
    const look = (where: string): void => { for (const fault of crowded(app)) faults.push(`${where}: ${fault}`); };
    for (let slot = 0; slot < 11; slot++) {
      look(`slot ${slot}`);
      press(app, 'confirm');
      for (let row = 0; row < Math.min(6, snap(app).menu.items.length); row++) { look(`slot ${slot} part ${row}`); press(app, 'down'); }
      press(app, 'cancel');
      press(app, 'down');
    }
    press(app, 'left');
    look('paint');
    press(app, 'cancel');
    press(app, 'right');
    for (let row = 0; row < 7; row++) { look(`builds ${row}`); press(app, 'down'); }
    expect(faults).toEqual([]);
  });

  test.each(['en', 'nl'] as const)('in a briefing, a battle and on its bill (%s)', (language) => {
    const { app } = inHub(veteran(language));
    const faults: string[] = [];
    const look = (where: string): void => { for (const fault of crowded(app)) faults.push(`${where}: ${fault}`); };
    select(app, 'contracts');
    select(app, 'patrol');
    for (let row = 0; row < snap(app).menu.items.length; row++) { look(`briefing ${row}`); press(app, 'down'); }
    select(app, 'accept');
    for (let i = 0; i < 4000 && snap(app).battle!.phase !== 'action'; i++) app.update(16);
    for (let row = 0; row < snap(app).menu.items.length; row++) { look(`battle menu ${row}`); press(app, 'down'); }
    select(app, 'fire');
    look('battle weapons');
    press(app, 'confirm');
    look('battle aim');
    press(app, 'cancel', 'cancel');
    finishMission(app);
    look('bill');
    expect(faults).toEqual([]);
  });
});
