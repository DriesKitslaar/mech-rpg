import { MIRROR_SCALE } from '../../src/core/arena';
import { DIFFICULTY_SCALE, saveLoadout, type GameState } from '../../src/core/game';
import { xpForLevel } from '../../src/core/pilot';
import { rangeLimit } from '../../src/core/range';
import { tunedCatalog } from '../../src/core/tuning';
import { ALL_ENEMIES } from '../../src/content/arena';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { UNITS, WORLD } from '../../src/content/codex';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import type { App } from '../../src/ui/app';
import type { SpriteStore } from '../../src/ui/sprites';
import { LOGICAL_W } from '../../src/ui/display';
import { COLORS, LINE } from '../../src/ui/widgets';
import { JUGGERNAUT, autoBattle, done, fresh, ids, inHub, press, savedGame, select, snap, strong } from '../helpers/app';
import { wearing } from '../helpers/builds';
import { overlap, record, type Drawn, type Written } from '../helpers/canvas';

/**
 * The range, as the player meets it: the simulator's second page, a fight in the pilot's own build
 * against a machine met, and a bill that is shown and not booked.
 */

afterEach(() => setLanguage('en'));

const T = STRINGS.training;
const drawn = (app: App): Drawn => record((ctx) => app.draw(ctx));
const quiet = (base: GameState): GameState => ({ ...base, codex: WORLD.map((entry) => entry.id), scenes: ['act-1'] });
const ORDER = UNITS.map((unit) => unit.id);
const written = (shown: Drawn, text: string): Written => {
  const found = shown.texts.filter((t) => t.text === text);
  expect(found, text).toHaveLength(1);
  return found[0];
};
interface RangeView { kind: string; count: number; limit: number }
const rangeOf = (app: App): RangeView | null => (snap(app) as unknown as { range: RangeView | null }).range;
const MET = ['recon-drone', 'gun-turret', 'tank', 'heavy-mech', 'leviathan'];
const BASTION = ARCHETYPE_BUILDS.bastion.war;
/** What the range lists for a game: what the app holds as met (the record of contracts done counts too), in the database's order. */
const listed = (app: App): string[] => ORDER.filter((id) => app.game!.met.includes(id));
/** A pilot at the war in the juggernaut, who has met a dozen machines and has a bastion saved. */
function pilot(extra: Partial<GameState> = {}): GameState {
  const story = done('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'hadron-2', 'lumen-2', 'undertow-2', 'rival-1', 'choice-lumen');
  const saved = saveLoadout(wearing(story, BASTION), 0);
  return { ...quiet(strong(saved)), met: MET, scenes: ['act-1', 'act-2', 'talk-kite'], choices: { kite: 'pass' }, lessons: [], ...extra };
}
/** Into the simulator and on to its second page. */
function onRange(saved: GameState): ReturnType<typeof inHub> {
  const made = inHub(saved);
  select(made.app, 'training');
  expect(snap(made.app).screen).toBe('training');
  press(made.app, 'next');
  expect(snap(made.app).page).toBe('range');
  return made;
}
const toRow = (app: App, id: string): void => {
  for (let i = 0; i < 60 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
  expect(snap(app).menu.items[snap(app).menu.cursor]?.id).toBe(id);
};
/** Plays the fight on screen to its settlement with Auto Turn. */
function fly(app: App): void {
  autoBattle(app);
  press(app, 'confirm');
  expect(snap(app).screen).toBe('settlement');
}

describe('the simulator has two pages', () => {
  test('the drills as they were, and the range: L1 and R1 turn from one to the other, round and round', () => {
    const { app } = inHub(pilot());
    select(app, 'training');
    expect(snap(app)).toMatchObject({ screen: 'training', page: 'drills', count: 'PASSED 0/13' });
    expect(ids(app)[0]).toBe('drill-aim');
    press(app, 'next');
    expect(snap(app)).toMatchObject({ page: 'range', count: `SEEN ${listed(app).length}/${ORDER.length}` });
    expect(listed(app).length).toBeGreaterThanOrEqual(MET.length);
    press(app, 'next');
    expect(snap(app).page).toBe('drills');
    press(app, 'prev');
    expect(snap(app).page).toBe('range');
    press(app, 'prev');
    expect(snap(app).page).toBe('drills');
    // The tabs say which is open.
    const tabs = () => drawn(app).texts.filter((t) => t.y === 1 && (t.text === 'DRILLS' || t.text === 'TEST RANGE'));
    expect(tabs().map((t) => [t.text, t.color])).toEqual([['TEST RANGE', COLORS.dim], ['DRILLS', COLORS.accent]]);
    expect(tabs()[0].right).toBe(LOGICAL_W - 5);
    press(app, 'next');
    expect(tabs().map((t) => [t.text, t.color])).toEqual([['TEST RANGE', COLORS.accent], ['DRILLS', COLORS.dim]]);
    press(app, 'prev');
    // B leaves for the hub from either.
    press(app, 'next', 'cancel');
    expect(snap(app).screen).toBe('hub');
  });

  test('the range lists every machine met, by its name, in the order the database has them', () => {
    const { app } = onRange(pilot());
    // (The pilot's saved builds head the list; they are another describe's.)
    const machines = snap(app).menu.items.filter((item) => !item.id.startsWith('spar-'));
    expect(machines.map((item) => item.id)).toEqual(listed(app));
    // Those the pilot was said to have met are among them, and nothing the pilot has not met is.
    for (const kind of MET) expect(ids(app)).toContain(kind);
    expect(ids(app)).not.toContain('strip-miner');
    expect(machines.length).toBeLessThan(ORDER.length);
    expect(machines.map((item) => item.label)).toEqual(machines.map((item) => ALL_ENEMIES[item.id].name));
    expect(machines.every((item) => item.enabled && item.note === 'x1')).toBe(true);
    toRow(app, 'recon-drone');
    expect(rangeOf(app)).toEqual({ kind: 'recon-drone', count: 1, limit: 3 });
  });

  test('left and right say how many: up to three of a light machine, round and round; one of a mech or a machine of the story', () => {
    const { app } = onRange(pilot());
    toRow(app, 'gun-turret');
    const turn = (key: 'left' | 'right'): number => { press(app, key); return rangeOf(app)!.count; };
    expect([turn('right'), turn('right'), turn('right'), turn('right')]).toEqual([2, 3, 1, 2]);
    expect([turn('left'), turn('left'), turn('left')]).toEqual([1, 3, 2]);
    expect(snap(app).menu.items.find((item) => item.id === 'gun-turret')!.note).toBe('x2');
    // The count is each machine's own.
    toRow(app, 'tank');
    expect(rangeOf(app)).toEqual({ kind: 'tank', count: 1, limit: 3 });
    for (const kind of ['heavy-mech', 'leviathan']) {
      toRow(app, kind);
      expect(rangeLimit(kind)).toBe(1);
      expect([turn('right'), turn('left')]).toEqual([1, 1]);
    }
    toRow(app, 'gun-turret');
    expect(rangeOf(app)!.count).toBe(2);
  });

  test('with nothing met the page says so, and A does nothing', () => {
    // A pilot who has not flown yet has met nothing.
    const { app } = onRange(quiet(fresh()));
    expect(snap(app)).toMatchObject({ page: 'range', count: `SEEN 0/${ORDER.length}` });
    expect(ids(app)).toEqual([]);
    expect(rangeOf(app)).toBeNull();
    expect(drawn(app).texts.some((t) => t.text === T.rangeEmpty)).toBe(true);
    press(app, 'confirm', 'left', 'right', 'up', 'down');
    expect(snap(app).screen).toBe('training');
  });

  test('with every machine met the list stays in its panel and scrolls', () => {
    const { app } = onRange(pilot({ met: [...ORDER] }));
    expect(ids(app).filter((id) => !id.startsWith('spar-'))).toEqual(ORDER);
    const rows = (): Written[] => drawn(app).texts.filter((t) => t.left === 18 && t.y >= 32 && t.y < 184);
    expect(rows().length).toBeLessThanOrEqual(13);
    expect(Math.max(...rows().map((t) => t.y)) + LINE).toBeLessThanOrEqual(181);
    // Down past the bottom of the window: the last machine comes into it.
    for (let i = 0; i < ids(app).length - 1; i++) press(app, 'down');
    expect(rangeOf(app)!.kind).toBe(ORDER[ORDER.length - 1]);
    expect(rows().map((t) => t.text)).toContain(ALL_ENEMIES[ORDER[ORDER.length - 1]].name);
    expect(Math.max(...rows().map((t) => t.y)) + LINE).toBeLessThanOrEqual(181);
  });

  test('beside the list stand as many of the machine as are to be fielded, in a row, inside their box', () => {
    const { app } = onRange(pilot());
    toRow(app, 'gun-turret');
    const standing = () => drawn(app).images.filter((image) => image.x >= 160 && image.w < 150 && image.h < 170).sort((a, b) => a.x - b.x);
    // One, twice its size, in the middle of the box, on the floor of it.
    expect(standing().map((image) => [image.x, image.y, image.w, image.h])).toEqual([[168, 52, 128, 128]]);
    press(app, 'right');
    expect(standing()).toHaveLength(2);
    press(app, 'right');
    const three = standing();
    expect(three).toHaveLength(3);
    // The same size each, a little over half a width apart, and none of them outside the box.
    expect(new Set(three.map((image) => `${image.w}x${image.h}`)).size).toBe(1);
    expect(three[1].x - three[0].x).toBe(three[2].x - three[1].x);
    expect(three[1].x - three[0].x).toBeGreaterThan(three[0].w / 2);
    expect(three[1].x - three[0].x).toBeLessThan(three[0].w);
    expect(three[0].x).toBeGreaterThanOrEqual(160);
    expect(three[2].x + three[2].w).toBeLessThanOrEqual(304);
    expect(new Set(three.map((image) => image.y + image.h))).toEqual(new Set([180]));
    // The drills' page shows the mech a drill lends, as it always did, and no machine of the range.
    press(app, 'prev');
    expect(snap(app).page).toBe('drills');
  });

  test('under the list: the machine by its name, what the database knows of it, and how to field it', () => {
    const { app } = onRange(pilot());
    toRow(app, 'gun-turret');
    const shown = drawn(app);
    expect(written(shown, 'GUN TURRET')).toMatchObject({ left: 12, y: 189, size: 16, color: COLORS.accent });
    // Armour, and what it is weak to, on one line; then what the database says of it.
    const note = UNITS.find((unit) => unit.id === 'gun-turret')!.note;
    expect(shown.texts.some((t) => t.y === 207 && /ARMOUR \d+/.test(t.text) && /WEAK TO/.test(t.text))).toBe(true);
    expect(shown.texts.filter((t) => t.y >= 219 && t.y < 252).map((t) => t.text).join(' ')).toBe(note);
    expect(written(shown, T.rangeHint)).toMatchObject({ y: 255, color: COLORS.dim });
    const panel = shown.texts.filter((t) => t.y >= 184);
    for (const a of panel) for (const b of panel) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
    // How many, at the right of the name: lit where it can be set, dim where one is all there may be.
    const many = (): Written => drawn(app).texts.filter((t) => t.y === 191 && /^x\d$/.test(t.text))[0];
    expect(many()).toMatchObject({ text: 'x1', right: LOGICAL_W - 12, color: COLORS.text });
    press(app, 'right');
    expect(many()).toMatchObject({ text: 'x2', color: COLORS.text });
    toRow(app, 'heavy-mech');
    expect(many()).toMatchObject({ text: 'x1', color: COLORS.dim });
  });
});

describe('the briefing of a fight on the range', () => {
  test('A opens it: the machines chosen, the build row, no wingman, no pay, and the simulator\'s word that nothing is billed', () => {
    const { app } = onRange(pilot());
    toRow(app, 'gun-turret');
    press(app, 'right', 'confirm');
    expect(snap(app).screen).toBe('briefing');
    expect(snap(app).briefing).toMatchObject({ mission: 'range-2-gun-turret', reward: 0, lent: false, wingman: null });
    expect(ids(app)).toEqual(['accept', 'build', 'back']);
    const shown = drawn(app);
    expect(written(shown, 'TEST RANGE')).toMatchObject({ y: 8, size: 16 });
    expect(written(shown, T.client).y).toBe(26);
    expect(shown.texts.filter((t) => t.y === 40 || t.y === 51).map((t) => t.text).join(' ')).toBe(T.rangeTag);
    expect(written(shown, 'Gun Turret x2').left).toBe(104);
    // Where a contract says what it pays, this says that it is free.
    expect(written(shown, T.rangePays)).toMatchObject({ left: 12, y: 215, size: 16, color: COLORS.armor });
    expect(shown.texts.some((t) => /^PAYS/.test(t.text))).toBe(false);
    // What the simulator says, written out.
    const body = shown.texts.filter((t) => t.y >= 78 && t.y < 190 && t.left === 12).map((t) => t.text).join(' ');
    expect(body).toContain('The simulator fields Gun Turret x2 against your own machine');
    expect(body).toContain('Nothing here is billed, paid or counted.');
  });

  test('B goes back to the range, to the machine and the number that were chosen', () => {
    const { app } = onRange(pilot());
    toRow(app, 'tank');
    press(app, 'right', 'right', 'confirm');
    expect(snap(app).briefing!.mission).toBe('range-3-tank');
    press(app, 'cancel');
    expect(snap(app)).toMatchObject({ screen: 'training', page: 'range' });
    expect(rangeOf(app)).toEqual({ kind: 'tank', count: 3, limit: 3 });
    // And Back does the same.
    press(app, 'confirm');
    select(app, 'back');
    expect(rangeOf(app)).toEqual({ kind: 'tank', count: 3, limit: 3 });
  });

  test('a machine that has not been met cannot be asked for, by any road', () => {
    const { app } = onRange(pilot());
    app.openRangeBriefing('strip-miner', 1);
    expect(snap(app).screen).toBe('training');
    app.startMission('range-1-strip-miner');
    expect(snap(app).screen).toBe('training');
    app.openRangeBriefing('no-such-machine', 1);
    expect(snap(app).screen).toBe('training');
    // More than may be fielded is as many as may be.
    app.startMission('range-3-heavy-mech');
    expect(snap(app).screen).toBe('battle');
    expect(snap(app).battle).toMatchObject({ mission: 'range-1-heavy-mech', enemies: ['heavy-mech'] });
  });
});

describe('the fight', () => {
  test('is in the pilot\'s own build, against what was chosen, as hard as the game is set', () => {
    const base = pilot();
    const { app } = onRange({ ...base, settings: { ...base.settings, difficulty: 'veteran' } });
    toRow(app, 'gun-turret');
    press(app, 'right', 'confirm');
    select(app, 'accept');
    expect(snap(app).screen).toBe('battle');
    expect(snap(app).battle).toMatchObject({ mission: 'range-2-gun-turret', index: 0, of: 1, enemies: ['gun-turret', 'gun-turret'], enemyScale: DIFFICULTY_SCALE.veteran });
    const armour = (['head', 'core', 'arms', 'legs'] as const).reduce((sum, slot) => sum + (CATALOG[JUGGERNAUT[slot]] as { ap: number }).ap, 0);
    expect(snap(app).player!.maxAp).toBe(armour);
  });

  test('is the real thing: the pilot\'s perks, the bench\'s work and the Overdrive all go along', () => {
    const { app } = onRange(pilot({ xp: xpForLevel(4), perks: { marksman: 2 }, tuning: { [JUGGERNAUT.generator]: 1 } }));
    toRow(app, 'tank');
    press(app, 'confirm');
    const mission = (app as unknown as { current: { mission: Parameters<App['fight']>[0] } }).current.mission;
    const fight = app.fight(mission);
    expect(fight.opts.mods).toMatchObject({ aim: expect.any(Number), tune: { [JUGGERNAUT.generator]: 1 } });
    expect(fight.opts.mods!.aim).toBeGreaterThan(0);
    expect(fight.opts.overdrive).toBe('second-wind');
    select(app, 'accept');
    expect((snap(app).battle as unknown as { drive: { kind: string } | null }).drive).toMatchObject({ kind: 'second-wind' });
  });

  test('a saved build chosen at the briefing is the one that is flown, and stays fitted', () => {
    const { app, store } = onRange(pilot());
    toRow(app, 'tank');
    press(app, 'confirm');
    select(app, 'build');
    expect((snap(app).briefing as unknown as { build: { slot: number | null; kind: string } }).build).toMatchObject({ slot: 0, kind: 'bastion' });
    for (let i = 0; i < 4 && snap(app).menu.items[snap(app).menu.cursor]?.id !== 'accept'; i++) press(app, 'up');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('battle');
    expect(savedGame(store).build).toEqual(BASTION);
  });
});

describe('nothing of it is kept', () => {
  /** What a flight could change, if it were booked. */
  const kept = (game: GameState) => ({
    credits: game.credits, xp: game.xp, battlesWon: game.battlesWon, stats: game.stats, wonAs: game.wonAs, met: game.met, medals: game.medals,
    ranks: game.ranks, completed: game.completed, lessons: game.lessons, overdrives: game.overdrives, drills: game.drills, build: game.build,
  });

  test('a fight won: the bill a real flight would have had is shown, and the kept game is as it was', () => {
    const { app, store } = onRange(pilot());
    const before = savedGame(store);
    toRow(app, 'gun-turret');
    press(app, 'right', 'right', 'confirm');
    select(app, 'accept');
    fly(app);
    const s = snap(app).settlement as unknown as { won: boolean; reward: number; net: number; ammoCost: number; repairCost: number; simulated: boolean; rank: string | null; bonus: number };
    expect(s).toMatchObject({ won: true, reward: 0, simulated: true, rank: null, bonus: 0 });
    expect(s.net).toBe(-(s.ammoCost + s.repairCost));
    expect(kept(savedGame(store))).toEqual(kept(before));
    expect(savedGame(store)).toEqual(before);
    // Three machines at once make it an open battle; what Dispatch says once about those was not said here.
    expect(savedGame(store).lessons).toEqual([]);
  });

  test('a fight walked away from: the same', () => {
    const { app, store } = onRange(pilot());
    const before = savedGame(store);
    toRow(app, 'tank');
    press(app, 'confirm');
    select(app, 'accept');
    for (let i = 0; i < 4000 && snap(app).battle?.phase !== 'action'; i++) {
      if (snap(app).battle!.phase === 'animating') app.update(16);
      else press(app, 'confirm');
    }
    select(app, 'retreat');
    select(app, 'yes');
    for (let i = 0; i < 4000 && snap(app).battle?.phase !== 'result'; i++) app.update(16);
    press(app, 'confirm');
    expect(snap(app).screen).toBe('settlement');
    expect(snap(app).settlement).toMatchObject({ won: false, reward: 0 });
    expect(savedGame(store)).toEqual(before);
    // The bill of a fight that was lost is headed so.
    expect(written(drawn(app), 'SHOT DOWN')).toMatchObject({ y: 26, size: 16, color: COLORS.danger });
    expect(drawn(app).texts.some((t) => t.text === 'RANGE CLEARED')).toBe(false);
  });

  test('the bill is the pilot\'s own: a pilot who pays less for repairs would have paid less here too', () => {
    const bill = (perks: Record<string, number>): { ammoCost: number; repairCost: number } => {
      const { app } = onRange(pilot({ perks }));
      toRow(app, 'gun-turret');
      press(app, 'right', 'right', 'confirm');
      select(app, 'accept');
      fly(app);
      return snap(app).settlement as unknown as { ammoCost: number; repairCost: number };
    };
    const plain = bill({});
    const thrifty = bill({ quartermaster: 2 });
    expect(plain.repairCost).toBeGreaterThan(20);
    // Three tenths off, part by part: to within the rounding of four parts.
    expect(thrifty.repairCost).toBeLessThan(plain.repairCost);
    expect(Math.abs(thrifty.repairCost - plain.repairCost * 0.7)).toBeLessThanOrEqual(4);
  });

  test('the machine on the range wears the pilot\'s own paint, which a lent mech in a drill does not', () => {
    const asked: string[] = [];
    const painting: SpriteStore = {
      get: (_id, fallback) => ({ image: {} as CanvasImageSource, w: fallback.w, h: fallback.h }),
      painted: (_id, paint, fallback) => { asked.push(paint); return { image: {} as CanvasImageSource, w: fallback.w, h: fallback.h }; },
    };
    const { app } = inHub(pilot({ paint: 'crimson' }), undefined, { sprites: painting });
    select(app, 'training');
    press(app, 'next');
    toRow(app, 'tank');
    press(app, 'confirm');
    select(app, 'accept');
    expect(snap(app).screen).toBe('battle');
    asked.length = 0;
    drawn(app);
    expect(asked).toContain('crimson');
    // A drill is flown in the simulator's machine, in the simulator's colours.
    const lent = inHub(pilot({ paint: 'crimson' }), undefined, { sprites: painting }).app;
    select(lent, 'training');
    select(lent, 'drill-aim');
    select(lent, 'accept');
    expect(snap(lent).screen).toBe('battle');
    asked.length = 0;
    drawn(lent);
    expect(asked).not.toContain('crimson');
  });

  test('the settlement says what it is: cleared or shot down, no fee, what it would have cost, and that it is not billed', () => {
    const { app, store } = onRange(pilot());
    toRow(app, 'gun-turret');
    press(app, 'right', 'right', 'confirm');
    select(app, 'accept');
    fly(app);
    const s = snap(app).settlement as unknown as { ammoCost: number; repairCost: number };
    const shown = drawn(app);
    expect(T.rangeWon).toBe('RANGE CLEARED');
    expect(written(shown, 'RANGE CLEARED')).toMatchObject({ y: 26, size: 16, color: COLORS.accent });
    expect(shown.texts.some((t) => t.text === STRINGS.settlement.reward)).toBe(false);
    expect(shown.texts.some((t) => t.text === STRINGS.settlement.net)).toBe(false);
    expect(written(shown, STRINGS.settlement.ammo).y).toBe(55);
    expect(written(shown, STRINGS.settlement.repairs).y).toBe(66);
    // Where the net stands on a bill that is paid: what this one would have come to, and not in the colours of money.
    const label = written(shown, STRINGS.settlement.wouldCost);
    expect(label).toMatchObject({ y: 186, size: 16, color: COLORS.dim });
    const total = shown.texts.find((t) => t.y === 186 && t.align === 'right')!;
    expect(total).toMatchObject({ text: String(s.ammoCost + s.repairCost), color: COLORS.dim });
    // The balance is the balance.
    expect(shown.texts.find((t) => t.y === 206 && t.align === 'right')!.text).toBe(String(savedGame(store).credits));
    // The simulator's last word.
    expect(shown.texts.filter((t) => t.y >= 144 && t.y < 180).map((t) => t.text).join(' ')).toBe(T.rangeDebrief);
  });

  test('A on the settlement goes back to the range, to the machine and the number that were fought', () => {
    const { app } = onRange(pilot());
    toRow(app, 'gun-turret');
    press(app, 'right', 'confirm');
    select(app, 'accept');
    fly(app);
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'training', page: 'range' });
    expect(rangeOf(app)).toEqual({ kind: 'gun-turret', count: 2, limit: 3 });
  });
});

describe('while the pilot\'s own mech cannot deploy', () => {
  /** The pilot with every weapon taken off the mech on the floor: a saved build is still there, and fit to fly. */
  function unarmed(extra: Partial<GameState> = {}): GameState {
    const base = pilot(extra);
    return { ...base, build: { ...base.build, rightHand: undefined, leftHand: undefined, shoulder: undefined } };
  }
  const SHUT = 'CLOSED: your mech cannot deploy (No weapon).';

  test('the range is closed: what it could field is listed and dim, A and left and right do nothing, and the page says why where the hint stood', () => {
    const { app } = onRange(unarmed());
    expect(app.buildErrors()).toEqual(['noWeapon']);
    expect(T.rangeShut(STRINGS.buildErrors.noWeapon)).toBe(SHUT);
    // The saved build and the machines met are all there to be read, and none of them can be chosen.
    const rows = snap(app).menu.items;
    expect(rows.map((item) => item.id)).toEqual(['spar-0', ...listed(app)]);
    expect(rows.every((item) => !item.enabled)).toBe(true);
    // No row carries a note: a list writes the note of a row that cannot be chosen in red, and what is wrong is said once.
    expect(rows.every((item) => item.note === undefined)).toBe(true);
    expect(drawn(app).texts.filter((t) => t.color === COLORS.danger).map((t) => t.text)).toEqual([SHUT]);
    expect(snap(app).count).toBe(`SEEN ${listed(app).length}/${ORDER.length}`);
    for (const id of ['spar-0', 'gun-turret', 'heavy-mech']) {
      toRow(app, id);
      press(app, 'confirm');
      expect(snap(app).screen, id).toBe('training');
      press(app, 'right');
      expect(rangeOf(app), id).toMatchObject({ kind: id, count: 1 });
      press(app, 'left');
      expect(rangeOf(app), id).toMatchObject({ kind: id, count: 1 });
      const shown = drawn(app);
      // Why, in the colour of what is wrong, in the middle of the row where the keys are otherwise named.
      const why = written(shown, SHUT);
      expect(why).toMatchObject({ y: 255, color: COLORS.danger, align: 'center', x: LOGICAL_W / 2 });
      expect(why.left).toBeGreaterThanOrEqual(12);
      expect(why.right).toBeLessThanOrEqual(LOGICAL_W - 12);
      expect(shown.texts.some((t) => t.text === T.rangeHint || t.text === T.hint), id).toBe(false);
      // How many would stand there is still said of a machine, dimly: it is not to be set.
      if (id !== 'spar-0') expect(written(shown, 'x1').color, id).toBe(COLORS.dim);
    }
    // The pages still turn, and B still leaves.
    press(app, 'prev');
    expect(snap(app).page).toBe('drills');
    press(app, 'next', 'cancel');
    expect(snap(app).screen).toBe('hub');
  });

  test('it says the first thing that is wrong, as the hub does', () => {
    // The juggernaut's frame on the legs the pilot began with, and no weapon on it: too heavy, and unarmed.
    const { app } = inHub(wearing(pilot(), { ...JUGGERNAUT, legs: STARTER_BUILD.legs, rightHand: undefined, leftHand: undefined, shoulder: undefined }));
    expect(app.buildErrors()).toEqual(['overweight', 'noWeapon']);
    expect(snap(app).menu.items.find((item) => item.id === 'contracts')!.note).toBe('Overweight');
    select(app, 'training');
    press(app, 'next');
    const shown = drawn(app);
    expect(written(shown, 'CLOSED: your mech cannot deploy (Overweight).').y).toBe(255);
    expect(shown.texts.some((t) => t.text.includes('No weapon'))).toBe(false);
  });

  test('the drills are as they were: each lends a mech of its own', () => {
    const { app } = inHub(unarmed());
    select(app, 'training');
    expect(snap(app).page).toBe('drills');
    expect(snap(app).menu.items[0]).toMatchObject({ id: 'drill-aim', enabled: true });
    const shown = drawn(app);
    expect(written(shown, T.hint).y).toBe(255);
    expect(shown.texts.some((t) => t.text === SHUT)).toBe(false);
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'briefing', briefing: { mission: 'drill-aim' } });
  });

  test('with nothing met the page says both: that there is nothing to field, and why it is closed', () => {
    const base = quiet(fresh());
    const { app } = onRange({ ...base, build: { ...base.build, rightHand: undefined, leftHand: undefined, shoulder: undefined } });
    expect(ids(app)).toEqual([]);
    const shown = drawn(app);
    expect(shown.texts.some((t) => t.text === T.rangeEmpty)).toBe(true);
    expect(written(shown, SHUT)).toMatchObject({ y: 255, color: COLORS.danger });
    expect(shown.texts.some((t) => t.text === T.hint)).toBe(false);
  });

  test('no fight on the range starts, by any road, and nothing is fitted for one', () => {
    const { app, store } = onRange(unarmed());
    const before = savedGame(store);
    const floor = { ...app.game!.build };
    app.openRangeBriefing('tank', 1);
    expect(snap(app).screen).toBe('training');
    app.openRangeBriefing('spar-0', 1);
    expect(snap(app).screen).toBe('training');
    app.openBriefing('range-1-tank');
    expect(snap(app).screen).toBe('training');
    app.startMission('range-1-tank');
    expect(snap(app).screen).toBe('training');
    app.startMission('range-spar-0');
    expect(snap(app).screen).toBe('training');
    // Nor with a saved build named to fly it in: the fight is not on offer, so nothing is fitted for it.
    app.startMission('range-1-tank', false, null, false, 0);
    expect(snap(app).screen).toBe('training');
    app.startMission('range-spar-0', false, null, false, 0);
    expect(snap(app).screen).toBe('training');
    expect(app.game!.build).toEqual(floor);
    expect(savedGame(store)).toEqual(before);
    // No odds either: nothing would start.
    expect(Object.keys(app.enemies()).filter((id) => id.startsWith('spar-'))).toEqual(['spar-0']);
  });

  test('put right in the garage, the range is open again: the saved build loaded is a mech that may deploy', () => {
    const { app } = onRange(unarmed());
    expect(snap(app).menu.items.every((item) => !item.enabled)).toBe(true);
    app.commit(app.fitted(0)!);
    expect(app.buildErrors()).toEqual([]);
    press(app, 'cancel');
    select(app, 'training');
    press(app, 'next');
    expect(snap(app).menu.items.every((item) => item.enabled)).toBe(true);
    expect(snap(app).menu.items.map((item) => item.note).slice(0, 2)).toEqual(['Bastion', 'x1']);
    expect(written(drawn(app), T.hint).y).toBe(255);
    toRow(app, 'tank');
    expect(written(drawn(app), T.rangeHint).y).toBe(255);
    press(app, 'right', 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'briefing', briefing: { mission: 'range-2-tank' } });
  });

  test('in Dutch', () => {
    const base = unarmed();
    const { app } = onRange({ ...base, settings: { ...base.settings, language: 'nl' } });
    const said = 'DICHT: je mech kan niet uitrukken (Geen wapen).';
    expect(STRINGS_NL.training.rangeShut(STRINGS_NL.buildErrors.noWeapon)).toBe(said);
    const why = written(drawn(app), said);
    expect(why).toMatchObject({ y: 255, color: COLORS.danger });
    expect(why.left).toBeGreaterThanOrEqual(12);
    expect(why.right).toBeLessThanOrEqual(LOGICAL_W - 12);
    // The longest thing that can be wrong still fits the row, in both languages.
    for (const strings of [STRINGS, STRINGS_NL]) {
      for (const error of Object.values(strings.buildErrors)) {
        expect(strings.training.rangeShut(error).length * 4.8, error).toBeLessThanOrEqual(LOGICAL_W - 24);
      }
    }
  });
});

describe('the screen holds what it was opened with', () => {
  test('the app is not asked for its lists again with every frame, nor for every key', () => {
    const { app } = inHub(pilot());
    select(app, 'training');
    const range = vi.spyOn(app, 'rangeList');
    const drills = vi.spyOn(app, 'drillList');
    const errors = vi.spyOn(app, 'buildErrors');
    for (const page of ['drills', 'range'] as const) {
      expect(snap(app).page).toBe(page);
      for (let frame = 0; frame < 5; frame++) {
        app.update(16);
        drawn(app);
        snap(app);
        press(app, 'down', 'right', 'left');
      }
      press(app, 'next');
    }
    expect(range).not.toHaveBeenCalled();
    expect(drills).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    // What it shows is still what the app would say now.
    press(app, 'next');
    expect(snap(app).menu.items.map((item) => item.id)).toEqual(app.rangeList().map((entry) => entry.kind));
  });
});

describe('in Dutch', () => {
  test('the page, the hint, the briefing\'s word and the settlement', () => {
    const { app } = onRange(pilot());
    setLanguage('nl');
    const N = STRINGS_NL.training;
    expect(snap(app).count).toBe(`GEZIEN ${listed(app).length}/${ORDER.length}`);
    toRow(app, 'gun-turret');
    let shown = drawn(app);
    expect(shown.texts.filter((t) => t.y === 1).map((t) => t.text)).toEqual(expect.arrayContaining([N.pages.drills, N.pages.range]));
    expect(written(shown, N.rangeHint).y).toBe(255);
    press(app, 'right', 'confirm');
    shown = drawn(app);
    expect(shown.texts.filter((t) => t.y === 40 || t.y === 51).map((t) => t.text).join(' ')).toBe(N.rangeTag);
    expect(shown.texts.filter((t) => t.y >= 78 && t.y < 190 && t.left === 12).map((t) => t.text).join(' ')).toContain('De simulator zet Gun Turret x2 tegenover je eigen machine');
    expect(written(shown, 'GRATIS')).toMatchObject({ left: 12, y: 215, size: 16 });
    expect(shown.texts.some((t) => /^LOON/.test(t.text))).toBe(false);
    expect(STRINGS_NL.settlement.wouldCost).toBe('ZOU KOSTEN');
    // Nothing on the page runs out of it.
    for (const t of shown.texts) expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 4);
  });
});

describe('sparring with a saved build', () => {
  const armourOf = (build: typeof BASTION): number => (['head', 'core', 'arms', 'legs'] as const).reduce((sum, slot) => sum + (CATALOG[build[slot]!] as { ap: number }).ap, 0);

  test('the saved builds that can be flown head the list, each with its class: one of each, whatever is pressed', () => {
    const { app } = onRange(pilot());
    expect(ids(app)[0]).toBe('spar-0');
    expect(ids(app).slice(1)).toEqual(listed(app));
    expect(snap(app).menu.items[0]).toEqual({ id: 'spar-0', label: 'Saved Build 1', enabled: true, note: 'Bastion' });
    expect(rangeOf(app)).toEqual({ kind: 'spar-0', count: 1, limit: 1 });
    press(app, 'right', 'left', 'right');
    expect(rangeOf(app)).toEqual({ kind: 'spar-0', count: 1, limit: 1 });
    expect(snap(app).menu.items[0].note).toBe('Bastion');
    // The count above the list is of machines met, as it was.
    expect(snap(app).count).toBe(`SEEN ${listed(app).length}/${ORDER.length}`);
  });

  test('a saved build that cannot be flown is not an opponent, and with none saved the list is the machines', () => {
    const none = onRange(pilot({ loadouts: [null, null, null] })).app;
    expect(ids(none)).toEqual(listed(none));
    const base = pilot();
    const sold = onRange({ ...base, inventory: { ...base.inventory, [BASTION.core]: 0 } }).app;
    expect(ids(sold)).toEqual(listed(sold));
    // Two saved: both head the list, in the garage's order, by the garage's numbers.
    const two = onRange({ ...base, loadouts: [null, BASTION, base.build] }).app;
    expect(ids(two).slice(0, 2)).toEqual(['spar-1', 'spar-2']);
    expect(snap(two).menu.items.slice(0, 2).map((item) => [item.label, item.note])).toEqual([['Saved Build 2', 'Bastion'], ['Saved Build 3', 'Lancer']]);
  });

  test('beside the list stands the build, and under it what kind of machine it is, its figures, and that the simulator flies it', () => {
    const { app } = onRange(pilot());
    const shown = drawn(app);
    expect(written(shown, 'SAVED BUILD 1')).toMatchObject({ left: 12, y: 189, size: 16, color: COLORS.accent });
    expect(shown.texts.some((t) => t.y === 207 && /^Armour \d+ {3}Mobility \d+ {3}Energy \d+$/.test(t.text))).toBe(true);
    expect(written(shown, `Armour ${armourOf(BASTION)}   Mobility 7   Energy 235`).color).toBe(COLORS.armor);
    expect(written(shown, 'BASTION: takes it and stays standing').y).toBe(219);
    expect(T.sparNote).toBe('The simulator flies this build against you.');
    expect(written(shown, T.sparNote).y).toBe(219 + LINE);
    expect(written(shown, T.hint).y).toBe(255);
    expect((snap(app).detail as { title: string }).title).toBe('SAVED BUILD 1');
    // The figures are the build's as it would fly: with what the bench has done to its parts.
    const benched = onRange(pilot({ tuning: { [BASTION.core]: 2 } })).app;
    const tuned = tunedCatalog(CATALOG, { [BASTION.core]: 2 });
    const armour = (['head', 'core', 'arms', 'legs'] as const).reduce((sum, slot) => sum + (tuned[BASTION[slot]!] as { ap: number }).ap, 0);
    expect(armour).toBeGreaterThan(armourOf(BASTION));
    expect(drawn(benched).texts.some((t) => t.y === 207 && t.text.startsWith(`Armour ${armour}   `))).toBe(true);
    // The build is drawn as a mech, part by part, where a machine of the range would stand.
    expect(shown.images.filter((image) => image.x >= 150 && image.w < 200).length).toBeGreaterThan(3);
    const panel = shown.texts.filter((t) => t.y >= 184);
    for (const a of panel) for (const b of panel) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
  });

  test('A opens its briefing: which build is flown against the pilot, the build row to answer with, and no pay', () => {
    const { app } = onRange(pilot());
    press(app, 'confirm');
    expect(snap(app).screen).toBe('briefing');
    expect(snap(app).briefing).toMatchObject({ mission: 'range-spar-0', reward: 0, wingman: null });
    expect(ids(app)).toEqual(['accept', 'build', 'back']);
    const shown = drawn(app);
    expect(written(shown, 'SPARRING')).toMatchObject({ y: 8, size: 16 });
    expect(shown.texts.filter((t) => t.y === 40 || t.y === 51).map((t) => t.text).join(' ')).toBe(T.rangeTag);
    // What is expected is the build, by the name the garage gives it.
    expect(written(shown, 'Saved Build 1').left).toBe(104);
    const body = shown.texts.filter((t) => t.y >= 78 && t.y < 190 && t.left === 12).map((t) => t.text).join(' ');
    expect(body).toContain('The simulator flies your saved build 1 against the machine you bring');
    expect(body).toContain('Nothing here is billed, paid or counted.');
    expect(written(shown, T.rangePays).y).toBe(215);
    // B goes back to the range, to that build's row.
    press(app, 'cancel');
    expect(snap(app)).toMatchObject({ screen: 'training', page: 'range' });
    expect(rangeOf(app)!.kind).toBe('spar-0');
  });

  test('the fight is against that build, with the bench\'s work on it, scaled as a mirror match is; and nothing of it is kept', () => {
    const base = pilot({ tuning: { [BASTION.generator!]: 1 } });
    const { app, store } = onRange({ ...base, settings: { ...base.settings, difficulty: 'veteran' } });
    const before = savedGame(store);
    press(app, 'confirm');
    select(app, 'accept');
    expect(snap(app).screen).toBe('battle');
    expect(snap(app).battle).toMatchObject({ mission: 'range-spar-0', enemies: ['spar-0'], enemyScale: MIRROR_SCALE * DIFFICULTY_SCALE.veteran });
    const opponent = app.enemies()['spar-0'];
    expect(opponent).toMatchObject({ name: 'Saved Build 1', composed: true, build: BASTION, ai: 'bruiser', tune: { [BASTION.generator!]: 1 } });
    fly(app);
    expect(snap(app).settlement).toMatchObject({ reward: 0, simulated: true });
    expect(savedGame(store)).toEqual(before);
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'training', page: 'range' });
    expect(rangeOf(app)!.kind).toBe('spar-0');
  });

  test('the build the pilot answers with can be another saved one, or the very one that is flown against them', () => {
    const { app, store } = onRange(pilot());
    press(app, 'confirm');
    select(app, 'build');
    expect((snap(app).briefing as unknown as { build: { slot: number | null; kind: string } }).build).toMatchObject({ slot: 0, kind: 'bastion' });
    for (let i = 0; i < 4 && snap(app).menu.items[snap(app).menu.cursor]?.id !== 'accept'; i++) press(app, 'up');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('battle');
    // Bastion against bastion: the pilot's is fitted, and the opponent is still the saved one.
    expect(savedGame(store).build).toEqual(BASTION);
    expect(app.enemies()['spar-0'].build).toEqual(BASTION);
    expect(snap(app).player!.maxAp).toBe(armourOf(BASTION));
  });

  test('a build that is not saved, or cannot be flown, cannot be sparred with by any road', () => {
    const { app } = onRange(pilot());
    app.openRangeBriefing('spar-1', 1);
    expect(snap(app).screen).toBe('training');
    app.startMission('range-spar-2');
    expect(snap(app).screen).toBe('training');
    app.startMission('range-spar-7');
    expect(snap(app).screen).toBe('training');
    expect(Object.keys(app.enemies()).filter((id) => id.startsWith('spar-'))).toEqual(['spar-0']);
  });

  test('the odds of a spar are counted like any other: against that build', () => {
    const { app } = onRange(pilot());
    press(app, 'confirm');
    const mission = (app as unknown as { current: { mission: Parameters<App['fight']>[0] } }).current.mission;
    const prospect = app.prospect(mission, null, null)!;
    expect(prospect.mission.id).toBe('range-spar-0');
    expect(prospect.fight.enemies['spar-0'].build).toEqual(BASTION);
    expect(prospect.fight.opts.enemyScale).toBe(MIRROR_SCALE);
  });

  test('in Dutch', () => {
    // A game kept in Dutch: the screens are made in the language the game is set to.
    const base = pilot();
    const { app } = onRange({ ...base, settings: { ...base.settings, language: 'nl' } });
    const N = STRINGS_NL.training;
    expect(N.spar(1)).toBe('Mijn build 1');
    expect(snap(app).menu.items[0]).toMatchObject({ label: 'Mijn build 1', note: 'Bastion' });
    let shown = drawn(app);
    expect(written(shown, 'MIJN BUILD 1').y).toBe(189);
    expect(written(shown, N.sparNote).y).toBe(219 + LINE);
    press(app, 'confirm');
    shown = drawn(app);
    expect(N.sparTitle).toBe('Sparren');
    expect(written(shown, 'SPARREN').y).toBe(8);
    expect(written(shown, 'Mijn build 1').left).toBe(104);
    expect(shown.texts.filter((t) => t.y >= 78 && t.y < 190 && t.left === 12).map((t) => t.text).join(' ')).toContain('De simulator vliegt je bewaarde build 1');
    for (const t of shown.texts) expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 4);
  });
});
