import { createBattle, type BattleEvent, type BattleState } from '../../src/core/battle';
import { ARCHETYPES } from '../../src/core/archetype';
import type { Settlement } from '../../src/core/economy';
import { buy, isValidState, sell, type GameState } from '../../src/core/game';
import type { EnemyDef } from '../../src/core/types';
import { JUKEBOX, UNITS, WORLD } from '../../src/content/codex';
import { FINDS } from '../../src/content/finds';
import { setLanguage } from '../../src/content/language';
import { MEDALS } from '../../src/content/medals';
import { MESSAGES, MISSIONS } from '../../src/content/missions';
import { arrivedMessages, checksHeld, decide, noteArrivals } from '../../src/core/campaign';
import '../../src/content/nl';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';
import type { App } from '../../src/ui/app';
import { BattleFlow } from '../../src/ui/battleFlow';
import { LOGICAL_W } from '../../src/ui/display';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { STRINGS } from '../../src/content/strings';
import { COMPARE_LINE_CHARS, PART_LINE_CHARS, compareParts, partLines } from '../../src/ui/partInfo';
import { MANUAL } from '../../src/content/codex';
import { driveTitle, shelfToast, TOAST_TITLE_CHARS } from '../../src/ui/app';
import { HINT_Y, STYLE_Y } from '../../src/ui/arenaScreen';
import { UNFLOWN_MARK, isUnflown } from '../../src/ui/hubScreen';
import { SKIP_AT } from '../../src/ui/sceneScreen';
import { REPAIR_LINES, SettlementScreen, WORDS_LINES, WORDS_Y } from '../../src/ui/settlementScreen';
import { DETAIL_TEXT_X } from '../../src/ui/shopScreen';
import { CHAR_W, COLORS, LINE, OVER_PICTURE, STATE_COLORS } from '../../src/ui/widgets';
import { done, finishMission, inHub, makeApp, medalPay, press, retreat, savedGame, select, snap, strong, toHub, type Store } from '../helpers/app';
import { overlap, record, type Written } from '../helpers/canvas';

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

describe('a new pilot is one in a first telling', () => {
  test('a pilot who starts the story again is no newcomer: the briefing has its row of builds from the first contract', () => {
    const rows = (app: App): string[] => { select(app, 'contracts'); select(app, 'intro-1'); return snap(app).menu.items.map((item) => item.id); };
    const first = inHub().app;
    expect(first.newcomer).toBe(true);
    expect(rows(first)).not.toContain('build');
    // The same two contracts to fly, in a second telling: this pilot has seen it all before.
    const again = inHub({ ...done(), cycle: 1, scenes: ['act-1', 'playback'] }).app;
    expect(again.newcomer).toBe(false);
    expect(rows(again)).toContain('build');
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
    // Each kind by its own letter: a fire control that aims better at one kind alone says that kind's letter, and no other's.
    for (const [language, strings] of [['en', STRINGS], ['nl', STRINGS_NL]] as const) {
      setLanguage(language);
      const I = strings.partInfo;
      for (const kind of ['kinetic', 'energy', 'explosive'] as const) {
        const better = { ...a, aim: { ...(a as { aim: Record<string, number> }).aim, [kind]: (a as { aim: Record<string, number> }).aim[kind] + 5 } } as typeof a;
        expect(compareParts(better, a).flat().map((chip) => chip.text), `${language} ${kind}`).toEqual([`${I.aim} ${I.typeLetters[kind]} +5`]);
      }
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
  /** How tall the letters of a text stand: a row of the usual size is eleven apart from the next. */
  const tall = (t: Written): number => Math.max(6, t.size - 3);
  /**
   * What is written on the screen once: a word with an edge is written several times a pixel apart. A word that a
   * panel was then drawn over is not on the screen: one that lies wholly under a solid fill that came after it.
   * (One that such a fill covers in part is still counted: half a word showing beside a panel is a fault.)
   */
  function written(app: App): Written[] {
    const drawn = record((ctx) => app.draw(ctx));
    let texts: Written[] = [];
    for (const step of drawn.order) {
      if (step.kind === 'text') texts.push(drawn.texts[step.at]);
      if (step.kind !== 'rect') continue;
      const fill = drawn.rects[step.at];
      if (fill.alpha !== 1 || fill.blend !== 'source-over' || !/^#[0-9a-f]{6}$/i.test(fill.color)) continue;
      texts = texts.filter((t) => !(t.left >= fill.x && t.right <= fill.x + fill.w && t.y >= fill.y && t.y + tall(t) <= fill.y + fill.h));
    }
    texts = texts.filter((t) => t.text.trim() !== '');
    return texts.filter((t, i) => !texts.slice(0, i).some((u) => u.text === t.text && Math.abs(u.y - t.y) <= 2 && Math.abs(u.left - t.left) <= 2));
  }
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
      // The longest callsign there is, bench work on what is fitted, and a part owned twice: each adds letters to a row.
      callsign: 'OCTAVIAN', tuning: { 'head-colossus': 2, 'wpn-lance-emitter': 2, 'gen-singularity': 1 },
      inventory: { ...base.inventory, 'wpn-pulse-carbine': 2, 'head-halo': 3 },
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

  test.each(['en', 'nl'] as const)('in the briefing of an open contract, on every row at each of its terms (%s)', (language) => {
    // With money for every bond, and with too little for the upper two: the page of terms that cannot be taken has a line of its own.
    for (const credits of [1234567, 2500]) {
      const { app } = inHub({ ...veteran(language), credits });
      const faults: string[] = [];
      // A contract that asks for a class, where the board has one: its second line stands under the line of the terms.
      const open = app.missions().filter((mission) => mission.id.startsWith('open-'));
      const contract = open.find((mission) => mission.asks !== undefined && mission.battles.length > 1) ?? open[open.length - 1];
      select(app, 'contracts');
      select(app, contract.id);
      expect(snap(app).menu.items.map((item) => item.id)).toContain('terms');
      for (let level = 0; level < 4; level++) {
        for (let row = 0; row < snap(app).menu.items.length; row++) {
          for (const fault of crowded(app)) faults.push(`${credits} terms ${level}, row ${snap(app).menu.items[snap(app).menu.cursor].id}: ${fault}`);
          press(app, 'down');
        }
        while (snap(app).menu.items[snap(app).menu.cursor].id !== 'terms') press(app, 'down');
        press(app, 'right');
      }
      expect(faults).toEqual([]);
    }
  });

  test.each(['en', 'nl'] as const)('where the long game put new words: a question on the class page, a rematch, the question before a new telling, and the list of one (%s)', (language) => {
    const { app } = inHub(veteran(language));
    const faults: string[] = [];
    const look = (where: string): void => { for (const fault of crowded(app)) faults.push(`${where}: ${fault}`); };
    // The class page: for every class whose build can be bought and fitted, the question over the list.
    select(app, 'pilot');
    for (let i = 0; i < 6 && snap(app).page !== 'classes'; i++) press(app, 'next');
    let asked = 0;
    for (let row = 0; row < ARCHETYPES.length; row++) {
      look(`class ${row}`);
      press(app, 'confirm');
      if ((snap(app).classes as { asking: boolean }).asking) { asked += 1; look(`class ${row} asked`); press(app, 'cancel'); }
      press(app, 'down');
    }
    expect(asked).toBeGreaterThan(3);
    press(app, 'cancel');
    // A rematch of the ladder's first rank: its briefing, row by row, and its bill.
    select(app, 'arena');
    select(app, 'rank-1');
    expect(snap(app).screen).toBe('briefing');
    for (let row = 0; row < snap(app).menu.items.length; row++) { look(`rematch briefing ${row}`); press(app, 'down'); }
    select(app, 'accept');
    finishMission(app);
    expect(record((ctx) => app.draw(ctx)).texts.some((t) => t.text === STRINGS.settlement.rematchWon)).toBe(true);
    look('rematch bill');
    press(app, 'confirm');
    if (snap(app).screen !== 'hub') press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
    // The question before a new telling: seven lines and two answers.
    select(app, 'cycle');
    look('cycle question');
    press(app, 'down');
    look('cycle question, on yes');
    press(app, 'confirm');
    for (let i = 0; i < 200 && snap(app).screen !== 'hub'; i++) press(app, 'confirm');
    expect(app.game!.cycle).toBe(1);
    // The list of a later telling: every row that was never won ends in a star, and the line under it says so.
    select(app, 'contracts');
    const rows = snap(app).menu.items;
    expect(rows.some((item) => item.label.endsWith(` ${UNFLOWN_MARK}`))).toBe(true);
    for (let i = 0; i < rows.length; i++) { look(`later contracts ${i}`); press(app, 'down'); }
    // And the first page of story that is told again, with what B does in its corner.
    expect(faults).toEqual([]);
  });
});

describe('one game: the same thing looks and is called the same on every screen', () => {
  const texts = (app: App): Written[] => record((ctx) => app.draw(ctx)).texts;
  const colorOf = (app: App, word: string): string | undefined => texts(app).find((t) => t.text === word && t.y > 180)?.color;
  const past = (): GameState => ({ ...strong(done('intro-1', 'intro-2')), scenes: ['act-1'] });

  test('a word for how something stands has one colour for each meaning: to do, done, shut', () => {
    expect(STATE_COLORS).toEqual({ todo: COLORS.armor, done: COLORS.dim, shut: COLORS.danger, held: COLORS.accent });
    // Training: a drill to run, and one that is passed.
    const { app } = inHub({ ...past(), drills: ['drill-aim'] });
    select(app, 'training');
    const drills = new Map<string, string>();
    for (let i = 0; i < snap(app).menu.items.length; i++) {
      for (const word of [STRINGS.training.passed, STRINGS.training.open, STRINGS.training.locked]) {
        const color = colorOf(app, word);
        if (color) drills.set(word, color);
      }
      press(app, 'down');
    }
    expect(drills.get(STRINGS.training.passed)).toBe(STATE_COLORS.done);
    expect(drills.get(STRINGS.training.open)).toBe(STATE_COLORS.todo);
    press(app, 'cancel');
    // A drill that is not yet open is shut, and red as every shut thing is.
    const early = inHub({ ...done('intro-1'), drills: [] }).app;
    select(early, 'training');
    const shut = new Map<string, string>();
    for (let i = 0; i < snap(early).menu.items.length; i++) {
      const color = colorOf(early, STRINGS.training.locked);
      if (color) shut.set(STRINGS.training.locked, color);
      press(early, 'down');
    }
    expect(shut.get(STRINGS.training.locked)).toBe(STATE_COLORS.shut);
    // The arena: the next opponent, one beaten, one that is shut; a cup that is open and one that is won.
    const arena = inHub({ ...past(), arenaRank: 10, cups: ['cup-bronze'] }).app;
    select(arena, 'arena');
    const seen = new Map<string, string>();
    for (let i = 0; i < snap(arena).menu.items.length; i++) {
      for (const word of [STRINGS.arena.next, STRINGS.arena.beaten, STRINGS.arena.locked, STRINGS.arena.cups.open, STRINGS.arena.cups.won]) {
        const color = colorOf(arena, word);
        if (color) seen.set(word, color);
      }
      press(arena, 'down');
    }
    expect(seen.get(STRINGS.arena.beaten)).toBe(STATE_COLORS.done);
    expect(seen.get(STRINGS.arena.cups.won)).toBe(STATE_COLORS.done);
    expect(seen.get(STRINGS.arena.cups.open)).toBe(STATE_COLORS.todo);
    expect(seen.get(STRINGS.arena.locked)).toBe(STATE_COLORS.shut);
  });

  test('every line that names buttons is written one way: the button, a colon, what it does, and three spaces before the next', () => {
    for (const S of [STRINGS, STRINGS_NL]) {
      const hints = [
        S.arena.back, S.arena.backLocked, S.pilot.hint, S.pilot.pageHint, S.database.hint, S.training.hint, S.training.rangeHint, S.options.hint,
        S.overdrive.hint, S.gauntlet.hint, S.starter.hint, S.callsign.hint, S.shop.hint, S.garage.back, S.garage.pages, S.garage.buildsHint,
        S.garage.toBench, S.garage.mixer.change, S.garage.paint('Factory'), S.coach.action, S.coach.weapon, S.coach.repairPart, S.briefing.wingmanHint, S.briefing.buildHint,
        S.messagesScreen.back,
      ];
      const one = /^[A-Z0-9/]+: [^:]+?(   [A-Z0-9/]+: [^:]+?)*$/;
      expect(hints.filter((hint) => !one.test(hint))).toEqual([]);
      // And every other text of the game that names two buttons, or begins with one and a colon, is such a line.
      const buttons = new Set(['A', 'B', 'L1', 'R1', 'L1/R1', 'UP/DOWN', 'LEFT/RIGHT', 'LEFT', 'RIGHT', 'OP/NEER', 'LINKS/RECHTS', 'LINKS', 'RECHTS']);
      const named = (text: string): number => new Set(text.split(/\s+/).map((word) => word.replace(/[:.,]$/, '')).filter((word) => buttons.has(word))).size;
      const lines: string[] = [];
      const walk = (node: unknown): void => {
        if (typeof node === 'string') { if (named(node) >= 2 || buttons.has(node.split(': ')[0])) lines.push(node); }
        else if (node && typeof node === 'object') Object.values(node).forEach(walk);
      };
      walk(S);
      expect(lines.length).toBeGreaterThan(20);
      expect(lines.filter((line) => !one.test(line))).toEqual([]);
      // What a button does is written small: a word in capitals after the colon is a name, or it is shouting.
      expect(hints.filter((hint) => /: [A-Z]{3,}/.test(hint.replace(/[A-Z0-9/]+: /g, ': ').replace(/^: /, '')))).toEqual([]);
    }
  });

  test('the simulator says that the shoulder buttons turn its page, and the page of saved builds says what A does', () => {
    expect(STRINGS.training.hint).toContain('L1/R1: page');
    expect(STRINGS.training.rangeHint).toContain('L1/R1: page');
    const { app } = inHub(past());
    select(app, 'garage');
    press(app, 'right');
    expect(texts(app).map((t) => t.text)).toContain(STRINGS.garage.buildsHint);
    press(app, 'cancel');
    expect(texts(app).map((t) => t.text)).not.toContain(STRINGS.garage.buildsHint);
  });

  test('what a class\'s build still has to buy is red, as a missing part is elsewhere: pink is the cursor\'s', () => {
    const { app } = inHub({ ...done('intro-1', 'intro-2'), scenes: ['act-1'], credits: 0 });
    select(app, 'pilot');
    for (let i = 0; i < 6 && snap(app).page !== 'classes'; i++) press(app, 'next');
    expect(snap(app).page).toBe('classes');
    const names = new Set(Object.values(CATALOG).map((part) => part.name));
    const parts = texts(app).filter((t) => t.y >= 182 && names.has(t.text));
    expect(parts.length).toBeGreaterThan(3);
    expect(parts.some((t) => t.color === COLORS.danger)).toBe(true);
    expect(parts.filter((t) => t.color === COLORS.accent)).toEqual([]);
  });

  test('the test range goes by one name: on its tab, in its briefing and in the manual', () => {
    expect(STRINGS.training.pages.range).toBe('TEST RANGE');
    expect(STRINGS.training.rangeTag).toMatch(/^TEST RANGE: /);
    expect(MANUAL.find((topic) => topic.id === 'range')!.title).toBe('THE TEST RANGE');
    expect(STRINGS.training.rangeTitle).toBe('Test Range');
  });

  test('the bill: what a contract pays is its fee, and mending armour is not called by the word for field repairs left', () => {
    expect(STRINGS.settlement.reward).toBe('Fee');
    expect(STRINGS.settlement.repairs).not.toBe(STRINGS.meters.repairs);
    expect(STRINGS.settlement.repairs.toUpperCase()).not.toBe(STRINGS.meters.repairs);
    expect(STRINGS_NL.settlement.repairs.toUpperCase()).not.toBe(STRINGS_NL.meters.repairs);
  });

  test('what is owned is counted one way in the shop and in the garage, and a slot with nothing in it has one word', () => {
    const { app } = inHub(past());
    select(app, 'shop');
    const owned = snap(app).menu.items.map((item) => item.label).filter((label) => / x\d+$/.test(label));
    expect(owned.length).toBeGreaterThan(0);
    expect(snap(app).menu.items.map((item) => item.label).filter((label) => /\(\d+\)$/.test(label))).toEqual([]);
    expect(STRINGS.garage.none).toBe(STRINGS.garage.empty);
    expect(STRINGS.shop.tabs.booster).toBe('Boost');
  });

  test('three Overdrives at once are named while their names fit the announcement, and counted when they do not', () => {
    const names = (S: { overdrive: { names: Record<string, string> } }): string[] => Object.values(S.overdrive.names);
    expect(names(STRINGS)).toHaveLength(3);
    for (const S of [STRINGS, STRINGS_NL]) {
      for (let n = 1; n <= 3; n++) expect(driveTitle(names(S).slice(0, n)).length).toBeLessThanOrEqual(TOAST_TITLE_CHARS);
    }
    expect(driveTitle(names(STRINGS).slice(0, 2))).toBe(names(STRINGS).slice(0, 2).join(', '));
    setLanguage('nl');
    expect(names(STRINGS).join(', ').length).toBeGreaterThan(TOAST_TITLE_CHARS);
    expect(driveTitle(names(STRINGS))).toBe('3 Overdrives');
  });

  test('a full bill keeps a clear line between its last row and what the client says of it', () => {
    const sprites = { get: (id: string, fallback: { w: number; h: number }) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
    // More parts damaged than a bill names.
    const lines = Object.keys(CATALOG).slice(0, 6).map((partId) => ({ partId, lost: 10, cost: 25 }));
    const bill = (extra: Partial<Settlement>, debrief: string): Written[] => {
      const settlement: Settlement = { net: 900, won: true, reward: 800, ammoCost: 40, repairCost: 150, lines, ...extra };
      const app = {
        deps: { fast: true, sprites, catalog: CATALOG }, settings: { calm: true }, game: { credits: 5000 }, leaveSettlement: () => undefined,
      } as unknown as App;
      const screen = new SettlementScreen(app, settlement, { ...MISSIONS[0], debrief });
      return record((ctx) => screen.draw(ctx)).texts;
    };
    // The plain bill, the one whose rank paid, and the one whose rank and class both paid: the most rows a bill has.
    const bills: Partial<Settlement>[] = [{}, { rank: 'S', bonus: 200 }, { rank: 'S', bonus: 200, asked: { kind: ARCHETYPES[0], bonus: 100 } }];
    // What the client says, in one line, in two and in three.
    const one = 'Paid in full.';
    const said = [one, `${one} The yard is clear and the trucks are rolling again.`, `${one} The yard is clear and the trucks are rolling again. Dispatch has your name down for the next one, and so do we.`];
    const named = said.map((debrief, n) => bills.map((extra) => {
      const texts = bill(extra, debrief);
      const rows = texts.filter((t) => t.left < 60 && t.y >= 55 && t.color !== COLORS.dim || t.text.startsWith('  '));
      const words = texts.filter((t) => t.left === 50 && t.y >= WORDS_Y && t.y < 180 && !t.text.startsWith('  '));
      expect(words).toHaveLength(n + 1);
      const last = Math.max(...rows.filter((t) => t.y < 180).map((t) => t.y));
      // A whole line stays empty under the last row: and no more than that is given away, so no repair line is left off for nothing.
      expect(words[0].y - last).toBeGreaterThanOrEqual(2 * LINE);
      // What is said never begins higher than it always does, and always ends above the rule under it.
      expect(words[0].y).toBeGreaterThanOrEqual(WORDS_Y);
      expect(words[n].y + LINE).toBeLessThanOrEqual(180 - 2);
      return rows.filter((t) => t.text.startsWith('  ')).length;
    }));
    // Three lines said cost a full bill a repair line or two; what is shorter moves down and costs it less, or nothing.
    expect(named).toEqual([[4, 4, 4], [4, 4, 3], [4, 3, 2]]);
    expect([REPAIR_LINES, WORDS_LINES]).toEqual([4, 3]);
  });

  test('the word RANK is written over the ring that runs out from the stamp, and the ring does not cut it', () => {
    const sprites = { get: (id: string, fallback: { w: number; h: number }) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
    const settlement: Settlement = { net: 900, won: true, reward: 800, ammoCost: 40, repairCost: 60, lines: [], rank: 'S', bonus: 200 };
    const app = {
      deps: { fast: false, sprites, catalog: CATALOG }, settings: { calm: false }, game: { credits: 5000 }, leaveSettlement: () => undefined,
    } as unknown as App;
    const screen = new SettlementScreen(app, settlement, MISSIONS[0]);
    // Half a second for the stamp to come down, a sixth to land, and the ring is on its way out.
    screen.update(760);
    const shown = record((ctx) => screen.draw(ctx));
    const word = shown.texts.findIndex((t) => t.text === STRINGS.settlement.rank);
    expect(word).toBeGreaterThanOrEqual(0);
    const when = (kind: string, at: number): number => shown.order.findIndex((step) => step.kind === kind && step.at === at);
    // The ring: single pixels in the rank's colour, fading as they run out.
    const ring = shown.rects.map((r, at) => ({ r, at })).filter(({ r }) => r.color === COLORS.accent && r.w === 1 && r.h === 1 && r.alpha < 1);
    expect(ring.length).toBeGreaterThan(8);
    // Some of it does pass where the word stands: which is why the order matters.
    const box = shown.texts[word];
    expect(ring.some(({ r }) => r.x >= box.left && r.x <= box.right && r.y >= box.y && r.y <= box.y + box.size)).toBe(true);
    expect(Math.max(...ring.map(({ at }) => when('rect', at)))).toBeLessThan(when('text', word));
  });

  test('the line of buttons under a master\'s three lines stands two lines below them, and its letters stay clear of the panel\'s edge', () => {
    for (const language of ['en', 'nl'] as const) {
      const { app } = inHub({ ...past(), arenaRank: 10 });
      setLanguage(language);
      select(app, 'arena');
      press(app, 'next');
      for (let row = 0; row < snap(app).menu.items.length; row++) {
        const all = texts(app);
        const hint = all.find((t) => t.text === STRINGS.arena.back || t.text === STRINGS.arena.backLocked)!;
        expect(hint.y).toBe(HINT_Y);
        // The panel ends at 266 with its border on the row before: the letters end above that.
        expect(hint.y + hint.size).toBeLessThanOrEqual(266 - 1);
        // How this one fights: up to three lines, the last of them two lines and more above the hint.
        const lines = all.filter((t) => t.left === 12 && t.y >= STYLE_Y && t.y < HINT_Y);
        expect(lines.length, `${language} row ${row}`).toBeGreaterThan(0);
        expect(lines.length).toBeLessThanOrEqual(3);
        expect(HINT_Y - Math.max(...lines.map((t) => t.y)), `${language} row ${row}`).toBeGreaterThanOrEqual(2 * LINE);
        // On the row of the name nothing lies over anything: the name, what they are called, and how it stands.
        const head = all.filter((t) => t.y >= 189 && t.y <= 191);
        expect(head.length).toBe(3);
        for (const a of head) for (const b of head) if (a !== b) expect(overlap(a, b), `${language}: "${a.text}" and "${b.text}"`).toBe(false);
        for (const t of head) expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 12);
        press(app, 'down');
      }
    }
    setLanguage('en');
  });
});

describe('the long game: a rematch in the arena', () => {
  const texts = (app: App): Written[] => record((ctx) => app.draw(ctx)).texts;
  /** A pilot past the introductions in the heaviest frame, three ranks up the ladder. */
  const ranked = (more: Partial<GameState> = {}): GameState => ({ ...strong(done('intro-1', 'intro-2')), scenes: ['act-1'], arenaRank: 3, ...more });
  const board = (app: App): string[] => { select(app, 'contracts'); const rows = snap(app).menu.items.map((item) => item.id); press(app, 'cancel'); return rows; };
  const fly = (app: App, row: string): void => {
    select(app, 'arena');
    select(app, row);
    expect(snap(app).screen).toBe('briefing');
    select(app, 'accept');
    finishMission(app);
  };

  test('pays its smaller purse and is no contract: the board stays as it was, the hub counts none, and no class is credited', () => {
    const { app, store } = inHub(ranked());
    const before = savedGame(store);
    const offered = board(app);
    select(app, 'arena');
    // The list says what a rematch pays now: a quarter of the purse.
    expect(snap(app).menu.items.find((item) => item.id === 'rank-1')!.note).toBe('200');
    select(app, 'rank-1');
    // Its briefing is headed as a rematch, and says nothing of a stripe on the way.
    const said = texts(app).map((t) => t.text);
    expect(said).toContain(STRINGS.arena.rematchTag);
    expect(said).not.toContain(STRINGS.arena.fight);
    select(app, 'accept');
    finishMission(app);
    expect(snap(app).settlement).toMatchObject({ won: true, reward: 200 });
    // The bill is a rematch's, and not a contract's.
    const bill = texts(app).map((t) => t.text);
    expect(bill).toContain(STRINGS.settlement.rematchWon);
    expect(bill).not.toContain(STRINGS.settlement.won);
    const after = savedGame(store);
    expect(after.credits).toBe(before.credits + snap(app).settlement!.net + medalPay(after.medals.filter((id) => !before.medals.includes(id))));
    expect(after.battlesWon).toBe(before.battlesWon);
    expect(after.stats.contracts).toBe(before.stats.contracts);
    expect(after.wonAs ?? {}).toEqual(before.wonAs ?? {});
    expect(after.arenaRank).toBe(3);
    expect(after.rematches).toEqual({ 'arena-1': 1 });
    // What its battle added up to is on the record all the same.
    expect(after.stats.kills).toBeGreaterThan(before.stats.kills);
    expect(after.stats.earned).toBeGreaterThan(before.stats.earned);
    toHub(app);
    expect(board(app)).toEqual(offered);
    // The next rematch of the same opponent pays half of this one, and the one after half of that.
    select(app, 'arena');
    expect(snap(app).menu.items.find((item) => item.id === 'rank-1')!.note).toBe('100');
    press(app, 'cancel');
    fly(app, 'rank-1');
    expect(snap(app).settlement).toMatchObject({ won: true, reward: 100 });
    expect(savedGame(store).rematches).toEqual({ 'arena-1': 2 });
    expect(savedGame(store).battlesWon).toBe(before.battlesWon);
  });

  test('a first win in the arena is booked as it was: a contract won, a win for the class, and a rank', () => {
    const { app, store } = inHub(ranked());
    const before = savedGame(store);
    const offered = board(app);
    select(app, 'arena');
    select(app, 'rank-4');
    const said = texts(app).map((t) => t.text);
    expect(said).toContain(STRINGS.arena.fight);
    expect(said).not.toContain(STRINGS.arena.rematchTag);
    select(app, 'accept');
    finishMission(app);
    expect(snap(app).settlement!.won).toBe(true);
    expect(texts(app).map((t) => t.text)).toContain(STRINGS.settlement.won);
    const after = savedGame(store);
    expect(after.battlesWon).toBe(before.battlesWon + 1);
    expect(after.stats.contracts).toBe(before.stats.contracts + 1);
    expect(Object.values(after.wonAs ?? {}).reduce((sum, n) => sum + n, 0)).toBe(Object.values(before.wonAs ?? {}).reduce((sum, n) => sum + n, 0) + 1);
    expect(after.arenaRank).toBe(4);
    expect(after.rematches).toBeUndefined();
    toHub(app);
    expect(board(app)).not.toEqual(offered);
  });

  test('a rematch lost or walked away from is no contract lost, and its purse stays what it was', () => {
    const { app, store } = inHub(ranked());
    const before = savedGame(store);
    select(app, 'arena');
    select(app, 'rank-2');
    select(app, 'accept');
    retreat(app);
    expect(snap(app).settlement!.won).toBe(false);
    expect(texts(app).map((t) => t.text)).toContain(STRINGS.settlement.rematchLost);
    const after = savedGame(store);
    expect([after.stats.lost, after.stats.retreats, after.stats.contracts]).toEqual([before.stats.lost, before.stats.retreats, before.stats.contracts]);
    expect(after.rematches).toBeUndefined();
    expect(after.battlesWon).toBe(before.battlesWon);
  });

  test('an account that is open does not wait through a rematch, and waits through a first win as through any contract', () => {
    const owed = { name: 'Brakk', kind: 'stalker', origin: 'wrecked' as const, met: 0, waited: 1 };
    const { app, store } = inHub(ranked({ grudge: owed }));
    fly(app, 'rank-1');
    expect(snap(app).settlement).toMatchObject({ won: true });
    expect(savedGame(store).grudge).toEqual(owed);
    toHub(app);
    fly(app, 'rank-4');
    expect(snap(app).settlement).toMatchObject({ won: true });
    expect(savedGame(store).grudge).toEqual({ ...owed, waited: 2 });
  });

  test('the briefing of a rematch does not count towards a stripe on its page of builds, and that of a first fight does', () => {
    const stripeLine = (app: App): boolean => texts(app).some((t) => /^NEXT STRIPE \d+\/\d+$/.test(t.text) || t.text === STRINGS.stripes.thisWin);
    const toBuild = (app: App, row: string): void => {
      select(app, 'arena');
      select(app, row);
      for (let i = 0; i < 8 && snap(app).menu.items[snap(app).menu.cursor]?.id !== 'build'; i++) press(app, 'down');
      expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('build');
    };
    const again = inHub(ranked()).app;
    toBuild(again, 'rank-1');
    expect(stripeLine(again)).toBe(false);
    const first = inHub(ranked()).app;
    toBuild(first, 'rank-4');
    expect(stripeLine(first)).toBe(true);
  });

  test('the words for it, in both languages, fit the line of the briefing they stand on', () => {
    for (const S of [STRINGS, STRINGS_NL]) {
      expect(S.arena.rematchTag.length).toBeLessThanOrEqual(Math.floor((LOGICAL_W - 84) / CHAR_W));
      expect(S.arena.rematchTag).toMatch(/^[A-Z]+: /);
    }
    expect(MANUAL.find((topic) => topic.id === 'rematches')!.text).toContain('It is no contract');
  });
});

describe('the long game: a telling that knows the pilot has been here', () => {
  const texts = (app: App): Written[] => record((ctx) => app.draw(ctx)).texts;
  const talk = (app: App) => snap(app).talk as { at: number; of: number; asking: boolean };
  /** Past the title, onto whatever page of story is due. */
  const opened = (saved: GameState): App => { const { app } = makeApp(saved); press(app, 'confirm'); return app; };
  /** The second telling, two contracts in: the bay's conversation is due, and it was held in the first. */
  const second = (more: Partial<GameState> = {}): GameState => ({
    ...done('intro-1', 'intro-2'), cycle: 1, scenes: ['act-1', 'playback'], ranks: { 'intro-1': 'A', 'intro-2': 'B' },
    told: { scenes: ['act-1', 'talk-kite'], read: ['welcome', 'after-intro-1'] }, ...more,
  });

  test('a conversation held in an earlier telling says that B skips it, and B goes to its last line: the question is still asked', () => {
    const app = opened(second());
    expect(snap(app)).toMatchObject({ screen: 'scene', scene: 'talk-kite', skippable: true });
    expect(talk(app).at).toBe(0);
    // (A word over a picture is written with a dark edge: the word itself is the one in the picture's own light colour.)
    const hint = texts(app).find((t) => t.text === STRINGS.scene.skip && t.color === OVER_PICTURE)!;
    expect(hint).toMatchObject({ right: SKIP_AT.right, y: SKIP_AT.y, size: 10 });
    // It lies over nothing else on the page.
    for (const other of texts(app).filter((t) => t.text !== STRINGS.scene.skip)) expect(overlap(hint, other), other.text).toBe(false);
    press(app, 'cancel');
    expect(talk(app)).toMatchObject({ at: talk(app).of - 1, asking: false });
    expect(snap(app).typing).toBe(false);
    // On the last line there is nothing left to skip: B does nothing, and A goes on to the question.
    press(app, 'cancel');
    expect(talk(app).at).toBe(talk(app).of - 1);
    press(app, 'confirm');
    expect(talk(app).asking).toBe(true);
    // The question is not skipped and says nothing of skipping: B does nothing to it.
    expect(texts(app).some((t) => t.text === STRINGS.scene.skip)).toBe(false);
    press(app, 'cancel');
    expect(talk(app).asking).toBe(true);
    expect(snap(app).menu.items.length).toBeGreaterThan(1);
  });

  test('in a first telling nothing is skipped: B does nothing on a page of story, and the page does not offer it', () => {
    const app = opened({ ...done('intro-1', 'intro-2'), scenes: ['act-1'] });
    expect(snap(app)).toMatchObject({ screen: 'scene', scene: 'talk-kite', skippable: false });
    expect(texts(app).some((t) => t.text === STRINGS.scene.skip)).toBe(false);
    press(app, 'cancel', 'cancel');
    expect(talk(app).at).toBe(0);
    // A page that is new to this telling is not skipped in a later one either.
    const later = opened({ ...done(), cycle: 1, told: { scenes: ['act-1'], read: [] } });
    expect(snap(later)).toMatchObject({ screen: 'scene', scene: 'act-1', skippable: true });
    expect(texts(later).find((t) => t.text === STRINGS.scene.skip && t.color === OVER_PICTURE)).toMatchObject({ right: SKIP_AT.right, y: SKIP_AT.y });
    // B leaves the page that was told before, at once: the next one is new, and stays.
    press(later, 'cancel');
    expect(snap(later)).toMatchObject({ screen: 'scene', scene: 'playback', skippable: false });
    press(later, 'cancel');
    expect(snap(later).scene).toBe('playback');
    expect(texts(later).some((t) => t.text === STRINGS.scene.skip)).toBe(false);
  });

  test('the words for it fit the corner they stand in, in both languages', () => {
    for (const S of [STRINGS, STRINGS_NL]) {
      expect(S.scene.skip).toMatch(/^B: /);
      expect(S.scene.skip.length * 4).toBeLessThanOrEqual(110);
    }
  });

  test('a letter read in an earlier telling comes again unmarked, and the hub counts only what is new', () => {
    const { app } = inHub(second({ scenes: ['act-1', 'playback', 'talk-kite'] }));
    const row = snap(app).menu.items.find((item) => item.id === 'messages')!;
    select(app, 'messages');
    const inbox = snap(app).menu.items;
    const noted = (id: string): string | undefined => inbox.find((item) => item.id === id)!.note;
    expect([noted('welcome'), noted('after-intro-1')]).toEqual([undefined, undefined]);
    const fresh = inbox.filter((item) => item.note === STRINGS.messagesScreen.isNew);
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.map((item) => item.id)).not.toContain('welcome');
    expect(row.note).toBe(STRINGS.hub.unread(fresh.length));
  });

  test('the inbox has the letter that came last on top, wherever the list of letters has it', () => {
    const { app, store } = inHub({ ...strong(done('intro-1', 'intro-2')), scenes: ['act-1', 'talk-kite'], arenaRank: 2 });
    // Reading a letter keeps the game: what has come so far is written down in the order of the list.
    select(app, 'messages');
    press(app, 'confirm', 'confirm', 'cancel');
    const before = savedGame(store).mail!;
    expect(before.length).toBeGreaterThan(2);
    expect(before).not.toContain('mirror-match');
    // The third rank brings the arena's proposal. Then a client is flown for, which brings a letter that stands earlier in the list.
    select(app, 'arena');
    select(app, 'rank-3');
    select(app, 'accept');
    finishMission(app);
    toHub(app);
    expect(savedGame(store).mail!.at(-1)).toBe('mirror-match');
    select(app, 'messages');
    expect(snap(app).menu.items[0]).toMatchObject({ id: 'mirror-match', note: STRINGS.messagesScreen.isNew });
    expect(snap(app).menu.items.slice(1).map((item) => item.id)).toEqual([...before].reverse());
  });

  test('a letter that a find brings is the last to come: on top and marked new, not under everything that was read', () => {
    // The end of the audit in a later telling, with the box and eight checks, and every letter read: the ninth
    // check is on a string among a thief's helmets, and with it comes the letter that makes the third offer.
    const WAR = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1',
      'choice-undertow', 'undertow-3', 'undertow-4', 'undertow-5', 'finale-undertow', 'quest-1', 'quest-2', 'quest-3', 'audit-1', 'audit-2', 'audit-3'];
    const eight = ['dock', 'krell', 'kite', 'marrow', 'convoy', 'debt', 'hatch', 'king'].map((id) => `check-${id}`);
    const audited: GameState = { ...decide(done(...WAR), 'logs', 'keep'), cycle: 1, codex: eight };
    const { app, store } = inHub(audited);
    app.commit({ ...app.game!, read: arrivedMessages(app.game!, MESSAGES, MISSIONS).map((m) => m.id) });
    app.go('hub');
    expect(checksHeld(app.game!)).toBe(8);
    expect(snap(app).menu.items.find((item) => item.id === 'messages')!.note).toBeUndefined();
    const before = savedGame(store).mail!;
    expect(before).not.toContain('third-offer');
    // More letters than the page has rows: one filed as the oldest would be out of sight.
    expect(before.length).toBeGreaterThanOrEqual(20);
    app.bookSettlement({ won: true, reward: 500, ammoCost: 0, repairCost: 0, net: 500, lines: [], rank: 'B' }, MISSIONS.find((m) => m.id === 'bounty-1')!);
    expect(app.game!.codex).toContain('check-magpie');
    expect(checksHeld(app.game!)).toBe(9);
    // It is written down with the game that the find was written down in, as the last to come.
    expect(savedGame(store).mail!.at(-1)).toBe('third-offer');
    app.go('hub');
    const row = snap(app).menu.items.find((item) => item.id === 'messages')!;
    expect(row.note).toBe(STRINGS.hub.unread(savedGame(store).mail!.length - before.length));
    select(app, 'messages');
    expect(snap(app).menu.items[0]).toMatchObject({ id: 'third-offer', note: STRINGS.messagesScreen.isNew });
    // And it is drawn: the word NEW is on the page, on the first row.
    const drawn = record((ctx) => app.draw(ctx)).texts;
    const subject = MESSAGES.find((m) => m.id === 'third-offer')!.subject;
    const title = drawn.find((t) => t.text.includes(subject))!;
    expect(title).toBeDefined();
    expect(drawn.some((t) => t.text === STRINGS.messagesScreen.isNew && Math.abs(t.y - title.y) <= 1)).toBe(true);
  });

  test('a letter that was never written down is read as the last to come, and one written down keeps its place', () => {
    const game: GameState = { ...done('intro-1', 'intro-2'), mail: ['after-intro-1'] };
    const ids = arrivedMessages(game, MESSAGES, MISSIONS).map((m) => m.id);
    expect(ids.length).toBeGreaterThan(2);
    expect(ids[0]).toBe('after-intro-1');
    // Those not written down follow it in the order of the list, as they would be written down.
    const rest = MESSAGES.map((m) => m.id).filter((id) => ids.includes(id) && id !== 'after-intro-1');
    expect(ids.slice(1)).toEqual(rest);
    expect(noteArrivals(game, MESSAGES, MISSIONS).mail).toEqual(ids);
    // A game from before letters were written down has them as the list does.
    const { mail: _, ...old } = game;
    expect(arrivedMessages(old, MESSAGES, MISSIONS).map((m) => m.id)).toEqual(MESSAGES.map((m) => m.id).filter((id) => ids.includes(id)));
  });

  test('a kept game with a thousand names for its mail is opened, written to, and opened again', () => {
    const many = Array.from({ length: 1000 }, (_, i) => `old-${i}`);
    const kept: GameState = { ...strong(done('intro-1', 'intro-2')), scenes: ['act-1', 'talk-kite'], mail: many };
    expect(isValidState(JSON.parse(JSON.stringify(kept)), CATALOG)).toBe(true);
    const { app, store } = inHub(kept);
    // Opening it wrote the letters that have come down, and what was written is a game that opens.
    const written = savedGame(store);
    expect(isValidState(written, CATALOG)).toBe(true);
    expect(written.mail).toHaveLength(1000);
    expect(written.mail!.at(-1)).not.toMatch(/^old-/);
    const again = inHub(written).app;
    expect(again.game!.mail).toEqual(written.mail);
    // And the inbox has its letters, the last to come on top.
    select(app, 'messages');
    expect(snap(app).menu.items[0].id).toBe(written.mail!.at(-1));
  });

  test('in a later telling a contract that was never won ends in a star, and the line under the list says what the star is; nothing is starred in a first telling', () => {
    const marked = (app: App): string[] => snap(app).menu.items.filter((item) => item.label.endsWith(` ${UNFLOWN_MARK}`)).map((item) => item.id);
    const { app } = inHub(second({ scenes: ['act-1', 'playback', 'talk-kite'] }));
    select(app, 'contracts');
    const rows = snap(app).menu.items;
    const stars = marked(app);
    expect(stars.length).toBeGreaterThan(0);
    // Every one of them is a contract of the story or beside it that has no rank from any telling; the patrol and the board are never starred.
    for (const id of stars) expect(Object.hasOwn(second().ranks, id), id).toBe(false);
    expect(stars.some((id) => id === 'patrol' || id.startsWith('open-'))).toBe(false);
    // On a starred row the line under the list explains the star; on the patrol it says what the patrol is.
    const at = rows.findIndex((item) => item.id === stars[0]);
    for (let i = 0; i < 40 && snap(app).menu.cursor !== at; i++) press(app, 'down');
    expect(snap(app).row).toBe(STRINGS.hub.kinds.unflown);
    for (let i = 0; i < 40 && snap(app).menu.items[snap(app).menu.cursor].id !== 'patrol'; i++) press(app, 'down');
    expect(snap(app).row).toBe(STRINGS.hub.kinds.patrol);
    // The same contracts in a first telling: no star on any row.
    const first = inHub({ ...done('intro-1', 'intro-2'), scenes: ['act-1', 'talk-kite'] }).app;
    select(first, 'contracts');
    expect(marked(first)).toEqual([]);
    expect(snap(first).menu.items.map((item) => item.id)).toEqual(expect.arrayContaining(stars));
    // What it is decided by: a later telling, a kind that only describes, and no rank kept.
    expect([isUnflown({ cycle: 1, ranks: {} }, { id: 'x' }, 'story'), isUnflown({ cycle: 1, ranks: {} }, { id: 'x' }, 'side')]).toEqual([true, true]);
    expect([isUnflown({ cycle: 0, ranks: {} }, { id: 'x' }, 'story'), isUnflown({ cycle: 1, ranks: { x: 'C' } }, { id: 'x' }, 'story')]).toEqual([false, false]);
    for (const kind of ['choice', 'verdict', 'open', 'asks', 'job', 'account', 'swarm', 'patrol', 'lent'] as const) expect(isUnflown({ cycle: 2, ranks: {} }, { id: 'x' }, kind), kind).toBe(false);
  });
});

describe('the long game: a saved build and its parts', () => {
  const texts = (app: App): Written[] => record((ctx) => app.draw(ctx)).texts;
  const shop = (app: App) => snap(app).shop as { mode: string; selected: string | null; neededBy: number[]; shortened: number[] };
  /** A pilot in the starter who owns a Halo Visor once, on the shelf, with the bench's work on it: the second saved build is the starter with that head. */
  const keeper = (more: Partial<GameState> = {}): GameState => {
    const base = buy({ ...done('intro-1', 'intro-2'), scenes: ['act-1', 'talk-kite'], credits: 50_000 }, 'head-halo', CATALOG);
    return { ...base, loadouts: [null, { ...base.build, head: 'head-halo' }, null], tuning: { 'head-halo': 2 }, ...more };
  };
  const toSell = (app: App, id: string): void => {
    select(app, 'shop');
    press(app, 'right');
    expect(shop(app).mode).toBe('sell');
    for (let i = 0; i < 30 && shop(app).selected !== id; i++) press(app, 'down');
    expect(shop(app).selected).toBe(id);
  };

  test('the shop says of a part under the cursor that a saved build needs it, and after the sale that the build is a part short', () => {
    const { app, store } = inHub(keeper());
    toSell(app, 'head-halo');
    expect(shop(app)).toMatchObject({ neededBy: [1], shortened: [] });
    expect(texts(app).find((t) => t.text === 'Saved build 2 needs this part')).toMatchObject({ y: 257, color: COLORS.heat });
    expect(texts(app).some((t) => t.text === STRINGS.shop.wordsHint)).toBe(false);
    // The sale is made all the same: nothing stops it.
    press(app, 'confirm');
    expect(savedGame(store).inventory['head-halo'] ?? 0).toBe(0);
    expect(shop(app).shortened).toEqual([1]);
    expect(texts(app).find((t) => t.text === 'Saved build 2 is a part short now')).toMatchObject({ y: 257, color: COLORS.danger });
    // It is said while the sale's own message stands, and no longer.
    press(app, 'down');
    expect(shop(app).shortened).toEqual([]);
    expect(texts(app).some((t) => t.text === 'Saved build 2 is a part short now')).toBe(false);
  });

  test('a part no saved build holds is sold without a word of it, and so is one of two copies', () => {
    const { app } = inHub(buy(keeper(), 'head-halo', CATALOG));
    toSell(app, 'head-halo');
    expect(shop(app).neededBy).toEqual([]);
    expect(texts(app).some((t) => t.text === STRINGS.shop.wordsHint)).toBe(true);
    press(app, 'confirm');
    expect(shop(app).shortened).toEqual([]);
    // One copy is left now, and the saved build holds it: the next sale would leave it short.
    expect(shop(app)).toMatchObject({ selected: 'head-halo', neededBy: [1] });
  });

  test('nothing is said of a saved build while buying: the part under the cursor is not about to leave', () => {
    // The Courier Visor is on the shelf of the shop and on the pilot's own; the second saved build holds it.
    const base = buy({ ...done('intro-1', 'intro-2'), scenes: ['act-1', 'talk-kite'], credits: 50_000 }, 'head-courier', CATALOG);
    const { app } = inHub({ ...base, loadouts: [null, { ...base.build, head: 'head-courier' }, null] });
    select(app, 'shop');
    expect(shop(app).mode).toBe('buy');
    for (let i = 0; i < 30 && shop(app).selected !== 'head-courier'; i++) press(app, 'down');
    expect(shop(app)).toMatchObject({ selected: 'head-courier', neededBy: [] });
    expect(texts(app).some((t) => /^Saved build /.test(t.text))).toBe(false);
    // The same part, to be sold: now it is said.
    press(app, 'right');
    for (let i = 0; i < 30 && shop(app).selected !== 'head-courier'; i++) press(app, 'down');
    expect(shop(app).neededBy).toEqual([1]);
  });

  test('a part the bench has worked on is listed with its step, to be sold and to be bought back', () => {
    // A Courier Visor on the shelf, worked on twice: the shop sells that head from the start.
    const base = buy({ ...done('intro-1', 'intro-2'), scenes: ['act-1', 'talk-kite'], credits: 50_000 }, 'head-courier', CATALOG);
    const { app } = inHub({ ...base, tuning: { 'head-courier': 2 } });
    const name = CATALOG['head-courier'].name;
    toSell(app, 'head-courier');
    expect(snap(app).menu.items.find((item) => item.id === 'head-courier')!.label).toBe(`${name} +2`);
    press(app, 'confirm', 'left');
    expect(shop(app).mode).toBe('buy');
    // Not owned now: no count after it, and the step it would come back with.
    const shelf = snap(app).menu.items;
    expect(shelf.find((item) => item.id === 'head-courier')!.label).toBe(`${name} +2`);
    // A part the bench never touched is listed as it always was: its name, and how often it is owned where it is.
    const others = shelf.filter((item) => item.id !== 'head-courier');
    expect(others.length).toBeGreaterThan(1);
    for (const item of others) expect(item.label.replace(/ x\d+$/, ''), item.id).toBe(CATALOG[item.id].name);
    expect(others.some((item) => / x1$/.test(item.label))).toBe(true);
    // Bought back, it says the step and then how many.
    for (let i = 0; i < 30 && shop(app).selected !== 'head-courier'; i++) press(app, 'down');
    press(app, 'confirm');
    expect(snap(app).menu.items.find((item) => item.id === 'head-courier')!.label).toBe(`${name} +2 x1`);
  });

  test('the briefing names a saved build that cannot be flown and what it is short of, where it would say that none is saved', () => {
    const sold = sell(keeper(), 'head-halo', CATALOG);
    const { app } = inHub(sold);
    select(app, 'contracts');
    select(app, 'patrol');
    for (let i = 0; i < 8 && snap(app).menu.items[snap(app).menu.cursor]?.id !== 'build'; i++) press(app, 'down');
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('build');
    const said = texts(app);
    expect(said.find((t) => t.text === 'BUILD 2: Halo Visor missing')).toMatchObject({ left: 12, color: COLORS.heat });
    expect(said.some((t) => t.text === STRINGS.briefing.buildNone)).toBe(false);
    // With another saved build to turn to, how to turn stands where it stood, and the build that is short is named beside it.
    const other = buy(sold, 'head-ronin', CATALOG);
    const two = inHub({ ...other, loadouts: [{ ...other.build, head: 'head-ronin' }, ...other.loadouts.slice(1)] }).app;
    select(two, 'contracts');
    select(two, 'patrol');
    for (let i = 0; i < 8 && snap(two).menu.items[snap(two).menu.cursor]?.id !== 'build'; i++) press(two, 'down');
    const both = texts(two);
    const hint = both.find((t) => t.text === STRINGS.briefing.buildHint)!;
    const short = both.find((t) => t.text === 'BUILD 2: Halo Visor missing')!;
    expect(hint.left).toBe(12);
    expect(short).toMatchObject({ right: LOGICAL_W - 12, size: 10, color: COLORS.heat });
    expect(overlap(hint, short)).toBe(false);
    // With every saved build flyable, the page is as it was.
    const whole = inHub(keeper()).app;
    select(whole, 'contracts');
    select(whole, 'patrol');
    for (let i = 0; i < 8 && snap(whole).menu.items[snap(whole).menu.cursor]?.id !== 'build'; i++) press(whole, 'down');
    expect(texts(whole).some((t) => /BUILD \d+: /.test(t.text) || /cannot deploy/.test(t.text))).toBe(false);
    // The Dutch of it fits the same row.
    expect([STRINGS_NL.briefing.buildShort(2, 'Halo Visor'), STRINGS_NL.briefing.buildGrounded(2)]).toEqual(['BUILD 2: Halo Visor ontbreekt', 'BUILD 2 niet inzetbaar']);
  });
});

describe('the long game: a frame that a duel puts in the shop is announced', () => {
  /** The story with Lumen, told to its verdict: the yard's pilots take bookings from then on. */
  const STORY = MISSIONS.filter((m) => m.phase !== 'side' && m.phase !== 'patrol' && (!m.faction || m.faction === 'lumen') && m.phase !== 'verdict').map((m) => m.id);
  const told = (): GameState => ({ ...done(...STORY, 'verdict-enforce'), endingSeen: true });
  const won = (game: GameState, id: string): GameState => ({ ...game, ranks: { ...game.ranks, [id]: 'A' } });

  test('a duel won names the frame and how many parts of it are for sale: once, and for nothing the story puts in stock', () => {
    const before = told();
    const after = won(before, 'duel-1');
    expect(shelfToast(before, after)).toEqual([
      { id: 'shelf:head-shrike+core-shrike+arms-shrike+legs-shrike', heading: 'NEW IN THE SHOP', title: 'Shrike: 4 parts', sound: 'entry' },
    ]);
    // It was said: nothing more to say of it.
    expect(shelfToast(after, after)).toEqual([]);
    expect(shelfToast(after, won(after, 'duel-1'))).toEqual([]);
    // Each of the yard's four, by its own name.
    const frames = ['duel-1', 'duel-2', 'duel-3', 'duel-4'].map((id) => shelfToast(before, won(before, id))[0].title);
    expect(frames).toEqual(['Shrike: 4 parts', 'Sterling: 4 parts', 'Sirocco: 4 parts', 'Solstice: 4 parts']);
    for (const title of frames) expect(title.length).toBeLessThanOrEqual(TOAST_TITLE_CHARS);
    // The seat's frame comes the same way.
    expect(shelfToast(before, { ...before, seat: true }).map((toast) => toast.title)).toEqual(['Sovereign: 4 parts']);
    // What the story puts in stock as it goes is not announced: the first client flown for stocks parts, and nothing is said.
    const early = done('intro-1', 'intro-2');
    const later = done('intro-1', 'intro-2', 'lumen-1');
    expect(shelfToast(early, later)).toEqual([]);
    // A game that is only now opened has nothing to compare with.
    expect(shelfToast(null, after)).toEqual([]);
  });

  test('it is announced as the duel is booked, in the words of the language set', () => {
    const { app } = inHub(strong(told()));
    const duel = MISSIONS.find((m) => m.id === 'duel-1')!;
    app.bookSettlement({ won: true, reward: duel.reward, ammoCost: 0, repairCost: 0, net: duel.reward, lines: [], rank: 'A', bonus: 0 }, duel);
    const said = [snap(app).toast, ...(snap(app).toasts as string[])];
    expect(said).toContain('shelf:head-shrike+core-shrike+arms-shrike+legs-shrike');
    expect([STRINGS_NL.shop.shelfToast, STRINGS_NL.shop.shelfParts('Shrike', 4)]).toEqual(['NIEUW IN DE WINKEL', 'Shrike: 4 stuks']);
    expect(STRINGS_NL.shop.shelfParts('Sovereign', 4).length).toBeLessThanOrEqual(TOAST_TITLE_CHARS);
  });
});
