import { ARCHETYPES, archetypeOf, type Archetype } from '../../src/core/archetype';
import { DIFFICULTY_SCALE, saveLoadout, type GameState } from '../../src/core/game';
import { crownHeld, crownsHeld, masterBeaten, masterId } from '../../src/core/masters';
import { SEAT_ID } from '../../src/core/seat';
import { xpForLevel } from '../../src/core/pilot';
import { tunable } from '../../src/core/tuning';
import type { Build } from '../../src/core/types';
import { ALL_ENEMIES } from '../../src/content/arena';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { WORLD } from '../../src/content/codex';
import { setLanguage } from '../../src/content/language';
import { MASTERS, masterOf } from '../../src/content/masters';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { CATALOG } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { TOAST_MS, type App } from '../../src/ui/app';
import { LOGICAL_W } from '../../src/ui/display';
import { battleTrack } from '../../src/ui/soundtrack';
import type { SpriteStore } from '../../src/ui/sprites';
import { COLORS, LINE, charsFor, wrap } from '../../src/ui/widgets';
import { autoBattle, done, ids, inHub, press, savedGame, select, snap } from '../helpers/app';
import { wearing } from '../helpers/builds';
import { overlap, record, type Drawn, type Written } from '../helpers/canvas';

/**
 * The masters of the arena, as the player meets them: the arena's second page, the briefing that
 * says what the crown asks, the duel, and what is kept of it.
 */

afterEach(() => setLanguage('en'));

const A = STRINGS.arena;
const M = A.masters;
const drawn = (app: App): Drawn => record((ctx) => app.draw(ctx));
const written = (shown: Drawn, text: string): Written => {
  const found = shown.texts.filter((t) => t.text === text);
  expect(found, text).toHaveLength(1);
  return found[0];
};
const late = (kind: Archetype): Build => ARCHETYPE_BUILDS[kind].late;
/**
 * A champion of the ladder who has everything a pilot can have: every perk that helps in a fight, the bench's
 * last step on every part worn, and the game set to its gentlest. These tests are about what follows a duel,
 * not about winning one.
 */
function champion(build: Build, extra: Partial<GameState> = {}): GameState {
  const story = done('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'hadron-2', 'lumen-2', 'undertow-2', 'rival-1', 'choice-lumen');
  const worn = wearing(story, build);
  const tuning = Object.fromEntries(Object.values(build).filter((id): id is string => id !== undefined && tunable(CATALOG[id])).map((id) => [id, 5]));
  return {
    ...worn, codex: WORLD.map((entry) => entry.id), scenes: ['act-1', 'act-2'], arenaRank: 10, cycle: 3, xp: xpForLevel(20), credits: 5000,
    perks: { marksman: 3, reflexes: 3, capacitor: 3, heatsinks: 3, fieldTech: 2, plating: 3 }, tuning,
    settings: { ...worn.settings, difficulty: 'story' }, lessons: ['momentum', 'rout'], ...extra,
  };
}
/** Into the arena and on to its second page. */
function atMasters(saved: GameState, seed?: number): ReturnType<typeof inHub> {
  const made = inHub(saved, seed);
  select(made.app, 'arena');
  expect(snap(made.app).screen).toBe('arena');
  press(made.app, 'next');
  expect(snap(made.app).page).toBe('masters');
  return made;
}
const toRow = (app: App, id: string): void => {
  for (let i = 0; i < 40 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
  expect(snap(app).menu.items[snap(app).menu.cursor]?.id).toBe(id);
};
interface MasterView { kind: Archetype; state: string }
const masterShown = (app: App): MasterView | null => (snap(app) as unknown as { master: MasterView | null }).master;
interface CrownLine { kind: Archetype; met: boolean; held: boolean; fits: number | null }
const crownLine = (app: App): CrownLine | null => (snap(app).briefing as unknown as { crown: CrownLine | null }).crown;
interface Bill { won: boolean; reward: number; crowned: Archetype | null }
const bill = (app: App): Bill => snap(app).settlement as unknown as Bill;
/** From the masters' page: challenges the master of a class, accepts, and flies the duel on Auto Turn to its settlement. */
function duel(app: App, kind: Archetype): void {
  toRow(app, masterId(kind));
  press(app, 'confirm');
  expect(snap(app).screen).toBe('briefing');
  select(app, 'accept');
  expect(snap(app).screen).toBe('battle');
  autoBattle(app);
  press(app, 'confirm');
  expect(snap(app).screen).toBe('settlement');
}
/** A duel won: the same pilot, with whatever seed first gives the win these tests are about. */
function won(saved: GameState, kind: Archetype): ReturnType<typeof inHub> {
  for (let seed = 1; seed <= 12; seed++) {
    const made = atMasters(saved, seed);
    duel(made.app, kind);
    if (bill(made.app).won) return made;
  }
  throw new Error(`no win against the master of the ${kind}s in twelve tries`);
}

describe('the arena has two pages', () => {
  test('the ladder as it was, and the masters: L1 and R1 turn from one to the other, and the tabs say which is open', () => {
    const { app } = inHub(champion(late('duellist')));
    select(app, 'arena');
    expect(snap(app)).toMatchObject({ screen: 'arena', page: 'ladder' });
    expect(ids(app).slice(0, 2)).toEqual(['rank-1', 'rank-2']);
    expect(masterShown(app)).toBeNull();
    press(app, 'next');
    expect(snap(app).page).toBe('masters');
    press(app, 'next');
    expect(snap(app).page).toBe('ladder');
    press(app, 'prev');
    expect(snap(app).page).toBe('masters');
    const tabs = () => drawn(app).texts.filter((t) => t.y === 1 && (t.text === 'LADDER' || t.text === 'MASTERS'));
    expect(tabs().map((t) => [t.text, t.color])).toEqual([['MASTERS', COLORS.accent], ['LADDER', COLORS.dim]]);
    expect(tabs()[0].right).toBe(LOGICAL_W - 5);
    press(app, 'prev');
    expect(tabs().map((t) => [t.text, t.color])).toEqual([['MASTERS', COLORS.dim], ['LADDER', COLORS.accent]]);
    // B leaves for the hub from either.
    press(app, 'next', 'cancel');
    expect(snap(app).screen).toBe('hub');
  });

  test('the pilot\'s rank has moved into the list\'s panel to make room for the tabs; on the masters\' page the crowns are counted there', () => {
    const { app } = inHub(champion(late('duellist'), { crowns: ['bastion', 'lancer'], masters: ['bastion', 'lancer'] }));
    select(app, 'arena');
    let shown = drawn(app);
    expect(written(shown, 'YOUR RANK 10/15')).toMatchObject({ left: 10, y: 22, size: 10, color: COLORS.dim });
    expect(written(shown, 'ARENA')).toMatchObject({ left: 5, y: 1 });
    expect(written(shown, 'PURSE')).toMatchObject({ right: 146, y: 22 });
    press(app, 'next');
    shown = drawn(app);
    expect(written(shown, 'CROWNS 2/7')).toMatchObject({ left: 10, y: 22, size: 10, color: COLORS.dim });
    expect(shown.texts.some((t) => /YOUR RANK/.test(t.text))).toBe(false);
    // Nothing in the header runs into anything else.
    const header = shown.texts.filter((t) => t.y === 1);
    for (const a of header) for (const b of header) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
  });

  test('the masters\' page lists the seven classes in the order the rules ask about them, each with the purse of its master', () => {
    const { app } = atMasters(champion(late('duellist')));
    // (Under the seven is the eighth seat, which is no class's: tests/ui/seat.test.ts.)
    const rows = snap(app).menu.items;
    expect(rows.map((row) => row.id)).toEqual([...ARCHETYPES.map(masterId), SEAT_ID]);
    expect(rows.map((row) => row.label)).toEqual(['Duellist', 'Sharpshooter', 'Artillery', 'Lancer', 'Bastion', 'Skirmisher', 'All-rounder', 'The Eighth Seat']);
    expect(rows.slice(0, 7).every((row) => row.enabled && row.note === '9000')).toBe(true);
    expect(masterShown(app)).toEqual({ kind: 'duellist', state: 'open' });
    toRow(app, masterId('bastion'));
    expect(masterShown(app)).toEqual({ kind: 'bastion', state: 'open' });
  });

  test('under the list: the master by name, what they are the master of, how they fight, and how it stands', () => {
    const { app } = atMasters(champion(late('duellist')));
    for (const master of MASTERS) {
      toRow(app, masterId(master.kind));
      const shown = drawn(app);
      expect(written(shown, master.name.toUpperCase())).toMatchObject({ left: 12, y: 189, size: 16, color: COLORS.accent });
      expect(written(shown, M.titles[master.kind].toUpperCase())).toMatchObject({ left: 12, y: 207, color: COLORS.armor });
      expect(written(shown, 'OPEN')).toMatchObject({ right: LOGICAL_W - 12, y: 191, color: COLORS.armor });
      const style = wrap(master.style, charsFor(LOGICAL_W - 28));
      expect(shown.texts.filter((t) => t.y >= 207 + LINE && t.y < 252 && t.left === 12).map((t) => t.text)).toEqual(style);
      expect(written(shown, A.back)).toMatchObject({ y: 253, color: COLORS.dim });
      const panel = shown.texts.filter((t) => t.y >= 184);
      for (const a of panel) for (const b of panel) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
      for (const t of shown.texts) expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 4);
    }
  });

  test('beside the list stands the master\'s own machine, in the paint only they wear', () => {
    const asked: string[] = [];
    const painting: SpriteStore = {
      get: (_id, fallback) => ({ image: {} as CanvasImageSource, w: fallback.w, h: fallback.h }),
      painted: (id, paint, fallback) => { asked.push(`${paint}:${id.split('.')[0]}`); return { image: {} as CanvasImageSource, w: fallback.w, h: fallback.h }; },
    };
    const { app } = inHub(champion(late('duellist')), undefined, { sprites: painting });
    select(app, 'arena');
    press(app, 'next');
    for (const master of MASTERS) {
      toRow(app, masterId(master.kind));
      asked.length = 0;
      drawn(app);
      expect(asked.length, master.name).toBeGreaterThan(0);
      expect(asked.every((entry) => entry.startsWith(`${master.paint}:`)), master.name).toBe(true);
      for (const slot of ['head', 'core', 'arms', 'legs'] as const) expect(asked, master.name).toContain(`${master.paint}:${master.build[slot]}`);
    }
  });

  test('a master beaten is marked beaten and pays a quarter; a crown held is marked on the row and in the panel', () => {
    const { app } = atMasters(champion(late('duellist'), { masters: ['duellist', 'bastion'], crowns: ['bastion'] }));
    const row = (kind: Archetype) => snap(app).menu.items.find((item) => item.id === masterId(kind))!;
    expect(row('duellist')).toMatchObject({ enabled: true, note: '2250' });
    expect(row('bastion')).toMatchObject({ enabled: true, note: 'CROWN' });
    expect(row('lancer')).toMatchObject({ enabled: true, note: '9000' });
    expect(masterShown(app)).toEqual({ kind: 'duellist', state: 'beaten' });
    expect(written(drawn(app), 'BEATEN')).toMatchObject({ right: LOGICAL_W - 12, y: 191, color: COLORS.dim });
    toRow(app, masterId('bastion'));
    expect(masterShown(app)).toEqual({ kind: 'bastion', state: 'crown' });
    // The word stands twice: on the row, and in the panel in the colour of what is the pilot's.
    const crowns = drawn(app).texts.filter((t) => t.text === 'CROWN');
    expect(crowns.map((t) => t.y).sort((a, b) => a - b)).toEqual([32 + 4 * LINE, 191]);
    expect(crowns.find((t) => t.y === 191)).toMatchObject({ right: LOGICAL_W - 12, color: COLORS.accent });
    expect(written(drawn(app), 'CROWNS 1/7').y).toBe(22);
  });
});

describe('the masters take challenges from the champion', () => {
  test('before that the page is there to be read, every row locked, and it says why', () => {
    const { app } = atMasters(champion(late('duellist'), { arenaRank: 9 }));
    const rows = snap(app).menu.items;
    expect(rows.map((row) => row.id)).toEqual([...ARCHETYPES.map(masterId), SEAT_ID]);
    expect(rows.slice(0, 7).every((row) => !row.enabled && row.note === 'LOCKED')).toBe(true);
    expect(masterShown(app)).toEqual({ kind: 'duellist', state: 'locked' });
    const shown = drawn(app);
    // The master is there to be looked at: their name and what they are the master of.
    expect(written(shown, 'QUILLON').y).toBe(189);
    expect(written(shown, 'MASTER DUELLIST').y).toBe(207);
    expect(shown.texts.find((t) => t.text === 'LOCKED' && t.y === 191)).toMatchObject({ right: LOGICAL_W - 12, color: COLORS.danger });
    // Where the line about how they fight would stand: whom they take challenges from.
    expect(shown.texts.filter((t) => t.y >= 207 + LINE && t.y < 252 && t.left === 12).map((t) => t.text)).toEqual(wrap(M.locked, charsFor(LOGICAL_W - 28)));
    press(app, 'confirm');
    expect(snap(app).screen).toBe('arena');
  });

  test('no duel is opened or started by any road, and none is on offer once the pilot\'s own mech may not deploy', () => {
    const { app } = atMasters(champion(late('duellist'), { arenaRank: 9 }));
    app.openMasterBriefing('duellist');
    expect(snap(app).screen).toBe('arena');
    app.openBriefing(masterId('duellist'));
    expect(snap(app).screen).toBe('arena');
    app.startMission(masterId('duellist'));
    expect(snap(app).screen).toBe('arena');
    app.startMission(masterId('duellist'), false, null, false, 0);
    expect(snap(app).screen).toBe('arena');
    // A champion, with every weapon taken off the mech on the floor.
    const base = champion(late('duellist'));
    const unarmed = inHub({ ...base, build: { ...base.build, rightHand: undefined, leftHand: undefined, shoulder: undefined } }).app;
    expect(unarmed.buildErrors().length).toBeGreaterThan(0);
    unarmed.openMasterBriefing('duellist');
    expect(snap(unarmed).screen).toBe('briefing');
    select(unarmed, 'accept');
    expect(snap(unarmed).screen).toBe('briefing');
    unarmed.startMission(masterId('duellist'));
    expect(snap(unarmed).screen).toBe('briefing');
    // An id that names no class starts nothing either.
    const sound = atMasters(champion(late('duellist'))).app;
    sound.startMission('arena-master-nobody');
    expect(snap(sound).screen).toBe('arena');
    // A kept game that says champion of a pilot whose introductions are not done: the arena is not open to them, and neither are the masters.
    const early = inHub({ ...champion(late('duellist')), completed: ['intro-1'], cycle: 0, tuning: {} }).app;
    expect(snap(early).menu.items.find((item) => item.id === 'arena')!.enabled).toBe(false);
    early.openMasterBriefing('duellist');
    expect(snap(early).screen).toBe('hub');
    early.startMission(masterId('duellist'));
    expect(snap(early).screen).toBe('hub');
  });
});

describe('the briefing of a duel', () => {
  test('A opens it: how the master fights and what they say, the build row and no second pilot, the purse, and what the crown asks', () => {
    const saved = saveLoadout(champion(late('bastion'), { scenes: ['act-1', 'act-2', 'talk-kite'], choices: { kite: 'pass' } }), 0);
    const { app } = atMasters(saved);
    toRow(app, masterId('bastion'));
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'briefing', briefing: { mission: 'arena-master-bastion', reward: 9000, lent: false, wingman: null } });
    expect(ids(app)).toEqual(['accept', 'build', 'back']);
    // The bastion saved is the one on the floor: a build is not listed twice, so there is no other to point to.
    expect(crownLine(app)).toEqual({ kind: 'bastion', met: true, held: false, fits: null });
    const shown = drawn(app);
    expect(written(shown, 'KEYSTONE')).toMatchObject({ left: 72, y: 8 });
    expect(written(shown, M.tag)).toMatchObject({ left: 72, y: 40, color: COLORS.dim });
    // The build on the floor is a bastion: the line is lit, and points nowhere.
    expect(written(shown, 'CROWN: WIN AS A BASTION')).toMatchObject({ left: 72, y: 51, color: COLORS.armor });
    const master = masterOf('bastion');
    const said = shown.texts.filter((t) => t.y >= 78 && t.y < 190 && t.left === 12).map((t) => t.text).join(' ');
    expect(said).toContain(master.style.slice(0, 40));
    expect(said).toContain(`"${master.taunt.slice(0, 20)}`);
    for (const t of shown.texts) expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 4);
    const header = shown.texts.filter((t) => t.y < 68);
    for (const a of header) for (const b of header) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
  });

  test('in a machine of another class the line is a notice, and points to the saved build that is of the class when there is one', () => {
    // A lancer on the floor; a sharpshooter saved first and a bastion second.
    let saved = saveLoadout(champion(late('marksman')), 0);
    saved = saveLoadout(wearing(saved, late('bastion')), 1);
    saved = wearing(saved, late('lancer'));
    const { app } = atMasters(saved);
    toRow(app, masterId('bastion'));
    press(app, 'confirm');
    expect(crownLine(app)).toEqual({ kind: 'bastion', met: false, held: false, fits: 1 });
    expect(written(drawn(app), 'CROWN: WIN AS A BASTION (BUILD 2)')).toMatchObject({ left: 72, y: 51, color: COLORS.heat });
    // Turned to the sharpshooter, it still points to the bastion; turned to the bastion, it is lit.
    toRow(app, 'build');
    press(app, 'right');
    expect(crownLine(app)).toMatchObject({ met: false, fits: 1 });
    press(app, 'right');
    expect(crownLine(app)).toMatchObject({ met: true, fits: 1 });
    expect(written(drawn(app), 'CROWN: WIN AS A BASTION')).toMatchObject({ color: COLORS.armor });
    // With nothing of the class saved it points nowhere.
    const alone = atMasters(champion(late('lancer'))).app;
    toRow(alone, masterId('bastion'));
    press(alone, 'confirm');
    expect(crownLine(alone)).toEqual({ kind: 'bastion', met: false, held: false, fits: null });
    expect(written(drawn(alone), 'CROWN: WIN AS A BASTION')).toMatchObject({ color: COLORS.heat });
  });

  test('a pilot who holds the crown is told so, whatever is flown; the purse is a quarter', () => {
    const { app } = atMasters(champion(late('lancer'), { masters: ['bastion'], crowns: ['bastion'] }));
    toRow(app, masterId('bastion'));
    press(app, 'confirm');
    expect(snap(app).briefing).toMatchObject({ mission: 'arena-master-bastion', reward: 2250 });
    expect(crownLine(app)).toMatchObject({ kind: 'bastion', held: true });
    const shown = drawn(app);
    expect(written(shown, 'YOU HOLD THIS CROWN')).toMatchObject({ left: 72, y: 51, color: COLORS.armor });
    expect(shown.texts.some((t) => /^CROWN: WIN AS/.test(t.text))).toBe(false);
  });

  test('B, and Back, go back to the masters\' page, to that master', () => {
    const { app } = atMasters(champion(late('duellist')));
    toRow(app, masterId('skirmisher'));
    press(app, 'confirm', 'cancel');
    expect(snap(app)).toMatchObject({ screen: 'arena', page: 'masters' });
    expect(masterShown(app)).toEqual({ kind: 'skirmisher', state: 'open' });
    press(app, 'confirm');
    select(app, 'back');
    expect(snap(app)).toMatchObject({ screen: 'arena', page: 'masters' });
    expect(masterShown(app)!.kind).toBe('skirmisher');
  });

  test('the longest words there are fit the header: the all-rounders\' line with a saved build to point to', () => {
    let saved = saveLoadout(champion(late('allrounder')), 2);
    saved = wearing(saved, late('lancer'));
    const { app } = atMasters(saved);
    toRow(app, masterId('allrounder'));
    press(app, 'confirm');
    const line = written(drawn(app), 'CROWN: WIN AS AN ALL-ROUNDER (BUILD 3)');
    expect(line.right).toBeLessThanOrEqual(LOGICAL_W - 8);
  });
});

describe('the duel', () => {
  test('is one against one in the arena against the master, as hard as the master is set and the game is set, to the arena\'s song', () => {
    const { app } = atMasters(champion(late('duellist')));
    toRow(app, masterId('lancer'));
    press(app, 'confirm');
    select(app, 'accept');
    const master = masterOf('lancer');
    expect(snap(app).battle).toMatchObject({ mission: 'arena-master-lancer', index: 0, of: 1, enemies: ['arena-master-lancer'] });
    expect(snap(app).battle!.enemyScale).toBeCloseTo(master.scale * DIFFICULTY_SCALE.story, 5);
    const mission = (app as unknown as { current: { mission: Parameters<typeof battleTrack>[0] } }).current.mission;
    expect(battleTrack(mission, 0, ALL_ENEMIES)).toBe('arena');
    expect(mission.crown).toBe('lancer');
  });

  test('won in a machine of another class: the purse, the master beaten, and no crown', () => {
    // Artillery goes through the duellists' master.
    const { app, store } = won(champion(late('artillery')), 'duellist');
    expect(bill(app)).toMatchObject({ won: true, reward: 9000, crowned: null });
    const kept = savedGame(store);
    expect(masterBeaten(kept, 'duellist')).toBe(true);
    expect(crownsHeld(kept)).toBe(0);
    expect(kept.crowns).toBeUndefined();
    expect(kept.wonAs).toMatchObject({ artillery: 1 });
    // The bill is headed as any contract's is, and says where the crown goes.
    const shown = drawn(app);
    expect(written(shown, STRINGS.settlement.won).y).toBe(26);
    expect(shown.texts.filter((t) => t.y >= 144 && t.y < 180).map((t) => t.text).join(' ')).toBe(M.win);
    expect(snap(app).toasts.some((toast) => /crown/i.test(toast))).toBe(false);
    // On to the hub, as after any fight in the arena; the master now pays a quarter.
    press(app, 'confirm');
    expect(snap(app).screen).toBe('hub');
    select(app, 'arena');
    press(app, 'next');
    expect(snap(app).menu.items[0]).toMatchObject({ id: 'arena-master-duellist', note: '2250' });
    expect(masterShown(app)).toEqual({ kind: 'duellist', state: 'beaten' });
  });

  test('won in a machine of the master\'s own class: the crown, said on the bill in the master\'s own words and in a notice', () => {
    const { app, store } = won(champion(late('bastion')), 'bastion');
    expect(bill(app)).toMatchObject({ won: true, reward: 9000, crowned: 'bastion' });
    const kept = savedGame(store);
    expect(crownHeld(kept, 'bastion')).toBe(true);
    expect(masterBeaten(kept, 'bastion')).toBe(true);
    expect(kept.crowns).toEqual(['bastion']);
    expect(kept.wonAs).toMatchObject({ bastion: 1 });
    const shown = drawn(app);
    expect(written(shown, 'THE CROWN IS YOURS')).toMatchObject({ y: 26, size: 16, color: COLORS.accent });
    expect(shown.texts.some((t) => t.text === STRINGS.settlement.won)).toBe(false);
    expect(shown.texts.filter((t) => t.y >= 144 && t.y < 180).map((t) => t.text).join(' ')).toBe(`"${masterOf('bastion').concede}"`);
    for (const t of shown.texts) expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 4);
    // The notice names what the pilot now is. It waits its turn behind whatever else is being announced.
    expect([snap(app).toast, ...snap(app).toasts]).toContain('crown:bastion');
    for (let i = 0; i < 40 && snap(app).toast !== 'crown:bastion'; i++) app.update(TOAST_MS + 1);
    expect(snap(app).toast).toBe('crown:bastion');
    const notice = drawn(app);
    expect(notice.texts.some((t) => t.text === 'CROWN TAKEN')).toBe(true);
    expect(notice.texts.some((t) => t.text === 'Master Bastion')).toBe(true);
    for (const t of notice.texts) expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 4);
    press(app, 'confirm');
    expect(snap(app).screen).toBe('hub');
    select(app, 'arena');
    press(app, 'next');
    toRow(app, masterId('bastion'));
    expect(masterShown(app)).toEqual({ kind: 'bastion', state: 'crown' });
    expect(snap(app).menu.items[4]).toMatchObject({ note: 'CROWN' });
  });

  test('the class that counts is that of the build the duel was flown in: a saved build turned to at the briefing', () => {
    // A lancer on the floor and a bastion saved: the lancer would only take the purse.
    let saved = saveLoadout(champion(late('bastion')), 0);
    saved = wearing(saved, late('lancer'));
    expect(archetypeOf(saved.build, CATALOG)).toBe('lancer');
    for (let seed = 1; seed <= 12; seed++) {
      const { app, store } = atMasters(saved, seed);
      toRow(app, masterId('bastion'));
      press(app, 'confirm');
      toRow(app, 'build');
      press(app, 'right');
      expect(crownLine(app)).toMatchObject({ met: true });
      select(app, 'accept');
      autoBattle(app);
      press(app, 'confirm');
      if (!bill(app).won) continue;
      expect(bill(app).crowned).toBe('bastion');
      expect(savedGame(store).crowns).toEqual(['bastion']);
      expect(savedGame(store).build).toEqual(late('bastion'));
      return;
    }
    throw new Error('no win in twelve tries');
  });

  test('a master beaten before in another machine still has the crown to give: a quarter of the purse, and the crown', () => {
    const { app, store } = won(champion(late('bastion'), { masters: ['bastion'] }), 'bastion');
    expect(bill(app)).toMatchObject({ won: true, reward: 2250, crowned: 'bastion' });
    const kept = savedGame(store);
    expect(kept.masters).toEqual(['bastion']);
    expect(kept.crowns).toEqual(['bastion']);
    expect(written(drawn(app), 'THE CROWN IS YOURS').y).toBe(26);
  });

  test('a crown is taken once: the holder\'s rematch pays a quarter, says the arena\'s usual word, and changes nothing that is kept', () => {
    const { app, store } = won(champion(late('bastion'), { masters: ['bastion'], crowns: ['bastion'] }), 'bastion');
    expect(bill(app)).toMatchObject({ won: true, reward: 2250, crowned: null });
    const kept = savedGame(store);
    expect(kept.crowns).toEqual(['bastion']);
    expect(kept.masters).toEqual(['bastion']);
    const shown = drawn(app);
    expect(written(shown, STRINGS.settlement.won).y).toBe(26);
    expect(shown.texts.filter((t) => t.y >= 144 && t.y < 180).map((t) => t.text).join(' ')).toBe(A.win);
    expect(snap(app).toasts).not.toContain('crown:bastion');
  });

  test('lost, or walked away from: nothing of it is kept', () => {
    // A pilot with nothing: the starter's perks, no bench, the game at its hardest, against the wall.
    const weak = champion(late('skirmisher'), { perks: {}, tuning: {}, cycle: 0, xp: 0 });
    const { app, store } = atMasters({ ...weak, settings: { ...weak.settings, difficulty: 'veteran' } });
    duel(app, 'bastion');
    expect(bill(app)).toMatchObject({ won: false, reward: 0, crowned: null });
    const kept = savedGame(store);
    expect(kept.masters).toBeUndefined();
    expect(kept.crowns).toBeUndefined();
    expect(written(drawn(app), STRINGS.settlement.lost).y).toBe(26);
  });
});

describe('in Dutch', () => {
  test('the page, the briefing\'s two lines and the bill', () => {
    const base = champion(late('bastion'));
    const N = STRINGS_NL.arena;
    const { app } = won({ ...base, settings: { ...base.settings, language: 'nl' } }, 'bastion');
    let shown = drawn(app);
    expect(STRINGS_NL.settlement.crowned).toBe('DE KROON IS VAN JOU');
    expect(written(shown, 'DE KROON IS VAN JOU').y).toBe(26);
    expect(shown.texts.filter((t) => t.y >= 144 && t.y < 180).map((t) => t.text).join(' ')).toBe('"Verschoven. Voor het eerst in elf jaar. De kroon is van jou."');
    for (const t of shown.texts) expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 4);
    press(app, 'confirm');
    select(app, 'arena');
    press(app, 'next');
    shown = drawn(app);
    expect(shown.texts.filter((t) => t.y === 1).map((t) => t.text)).toEqual(expect.arrayContaining(['RANGLIJST', 'MEESTERS']));
    expect(written(shown, 'KRONEN 1/7').y).toBe(22);
    expect(snap(app).menu.items.map((row) => row.label)).toEqual(['Duellist', 'Scherpschutter', 'Artillerie', 'Lansier', 'Bastion', 'Jager', 'Allrounder', 'De achtste stoel']);
    expect(written(shown, 'MEESTERDUELLIST').y).toBe(207);
    expect(written(shown, N.back).y).toBe(253);
    for (const kind of ARCHETYPES) {
      toRow(app, masterId(kind));
      const page = drawn(app);
      expect(written(page, N.masters.titles[kind].toUpperCase()).y).toBe(207);
      const panel = page.texts.filter((t) => t.y >= 184);
      for (const a of panel) for (const b of panel) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
      for (const t of page.texts) expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 4);
    }
    // The briefing: the tag on one line, and under it what the crown asks; here it is held.
    toRow(app, masterId('bastion'));
    press(app, 'confirm');
    shown = drawn(app);
    expect(written(shown, 'MEESTERDUEL: een tegen een, om de pot')).toMatchObject({ left: 72, y: 40 });
    expect(written(shown, 'DEZE KROON IS VAN JOU')).toMatchObject({ left: 72, y: 51 });
    press(app, 'cancel');
    toRow(app, masterId('marksman'));
    press(app, 'confirm');
    expect(written(drawn(app), 'KROON: WIN ALS SCHERPSCHUTTER').right).toBeLessThanOrEqual(LOGICAL_W - 8);
  });
});
