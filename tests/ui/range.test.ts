import { DIFFICULTY_SCALE, saveLoadout, type GameState } from '../../src/core/game';
import { xpForLevel } from '../../src/core/pilot';
import { rangeLimit } from '../../src/core/range';
import { ALL_ENEMIES } from '../../src/content/arena';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { UNITS, WORLD } from '../../src/content/codex';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { CATALOG } from '../../src/content/parts';
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
    expect(ids(app)).toEqual(listed(app));
    // Those the pilot was said to have met are among them, and nothing the pilot has not met is.
    for (const kind of MET) expect(ids(app)).toContain(kind);
    expect(ids(app)).not.toContain('strip-miner');
    expect(ids(app).length).toBeLessThan(ORDER.length);
    expect(snap(app).menu.items.map((item) => item.label)).toEqual(ids(app).map((id) => ALL_ENEMIES[id].name));
    expect(snap(app).menu.items.every((item) => item.enabled && item.note === 'x1')).toBe(true);
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
    expect(ids(app)).toEqual(ORDER);
    const rows = (): Written[] => drawn(app).texts.filter((t) => t.left === 18 && t.y >= 32 && t.y < 184);
    expect(rows().length).toBeLessThanOrEqual(13);
    expect(Math.max(...rows().map((t) => t.y)) + LINE).toBeLessThanOrEqual(181);
    // Down past the bottom of the window: the last machine comes into it.
    for (let i = 0; i < ORDER.length - 1; i++) press(app, 'down');
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

describe('in Dutch', () => {
  test('the page, the hint, the briefing\'s word and the settlement', () => {
    const { app } = onRange(pilot());
    setLanguage('nl');
    const N = STRINGS_NL.training;
    expect(snap(app).count).toBe(`GEZIEN ${listed(app).length}/${ORDER.length}`);
    let shown = drawn(app);
    expect(shown.texts.filter((t) => t.y === 1).map((t) => t.text)).toEqual(expect.arrayContaining([N.pages.drills, N.pages.range]));
    expect(written(shown, N.rangeHint).y).toBe(255);
    toRow(app, 'gun-turret');
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
