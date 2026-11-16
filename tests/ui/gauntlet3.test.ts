import { doors, draft, relicOffers, startRun, type RelicId, type Run } from '../../src/core/gauntlet';
import { GAUNTLET_BUILD, GAUNTLET_TEXT } from '../../src/content/gauntlet';
import { CATALOG } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { ALL_ENEMIES } from '../../src/content/arena';
import { createBattle } from '../../src/core/battle';
import { ENEMIES } from '../../src/content/enemies';
import { DEMO_BUILD } from '../../src/content/parts';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen, MARK_TURN_MS } from '../../src/ui/battleScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import { done, finishBattle, ids, inHub, press, savedGame, select, snap, strong } from '../helpers/app';
import { overlap, record, type Drawn, type Written } from '../helpers/canvas';

const BG = GAUNTLET_TEXT.backgrounds;
const G = STRINGS.gauntlet;
/** The panel the room writes in: from 150 to 306 across, and nothing below 264. */
const PANEL = { left: 150, right: 306, bottom: 264 };
interface View { floor: number | null; drafting: boolean; shown: number; relicOwed: boolean; relics: string[]; revived: boolean; wear: number; offers: { kind: string }[] }
type AppOf = ReturnType<typeof inHub>['app'];
const g = (app: AppOf): View => snap(app).gauntlet as View;
const MIGHTY = { plating: 30, capacitor: 20, optics: 30, heatsinks: 10 };
const whole = (drive: number) => ({ ap: {}, heat: 0, ammo: {}, restocked: {}, destroyed: false, drive });

/** Puts the app in the Gauntlet's room with the run as given. */
function room(run: Partial<Run> & { seed?: number }) {
  const made = inHub(strong(done('intro-1', 'intro-2')));
  const base = startRun(run.seed ?? 77, GAUNTLET_BUILD);
  made.app.commit({ ...made.app.game!, gauntlet: { ...base, ...run } });
  made.app.go('gauntlet');
  expect(snap(made.app).screen).toBe('gauntlet');
  return made;
}
/** A seed and floor whose doors are as asked. */
function find(want: (found: ReturnType<typeof doors>) => boolean, from = 3, to = 5): { seed: number; floor: number } {
  for (let seed = 1; seed < 600; seed++) {
    for (let floor = from; floor < to; floor++) if (want(doors({ ...startRun(seed, GAUNTLET_BUILD), floor }, BG))) return { seed, floor };
  }
  throw new Error('no such floor');
}
/** The room as it is drawn. */
function drawn(app: AppOf): Drawn {
  app.update(16);
  return record((ctx) => app.draw(ctx));
}
const one = (page: Drawn, text: string): Written => {
  const found = page.texts.filter((t) => t.text === text);
  expect(found, text).toHaveLength(1);
  return found[0];
};
/** Everything written in the panel stays in it, and no two things written on a row run into each other. */
function tidy(page: Drawn): void {
  const inPanel = page.texts.filter((t) => t.left >= PANEL.left - 0.5 && t.y > 14);
  for (const t of inPanel) {
    expect(t.right, t.text).toBeLessThanOrEqual(PANEL.right + 0.5);
    expect(t.y + t.size, t.text).toBeLessThanOrEqual(PANEL.bottom);
  }
  for (let i = 0; i < inPanel.length; i++) {
    for (let j = i + 1; j < inPanel.length; j++) expect(overlap(inPanel[i], inPanel[j]), `"${inPanel[i].text}" on "${inPanel[j].text}"`).toBe(false);
  }
}
const names = (ids: string[]): string[] => ids.map((id) => ALL_ENEMIES[id]?.name ?? id);

describe('the room while a relic is being chosen', () => {
  test('the shoulder buttons do not turn to the other door unseen: what is on offer afterwards opens on the first', () => {
    const { app } = room({ floor: 6, drafting: true, relicOwed: true });
    expect(g(app)).toMatchObject({ relicOwed: true, shown: 0 });
    // One press at a time: two would turn to the other door and back again, and show nothing.
    for (const button of ['next', 'right', 'prev', 'left'] as const) {
      press(app, button);
      expect(g(app).shown, button).toBe(0);
    }
    press(app, 'confirm');
    expect(g(app)).toMatchObject({ relicOwed: false, drafting: true, shown: 0 });
    expect(drawn(app).texts.map((t) => t.text)).toContain(G.doors[0].toUpperCase());
    // Once the relic is taken the other door can be looked at again, as with any draft.
    press(app, 'next');
    expect(g(app).shown).toBe(1);
  });

  test('both relics are on their rows, and what the one under the cursor does is written under them, inside the panel', () => {
    const { app, store } = room({ floor: 6, drafting: true, relicOwed: true });
    const offers = relicOffers(savedGame(store).gauntlet!);
    expect(offers).toHaveLength(2);
    for (const at of [0, 1]) {
      const page = drawn(app);
      const rows = offers.map((id) => one(page, G.relics[id].name));
      expect(rows[1].y).toBeGreaterThan(rows[0].y);
      // The note is the one for the relic the cursor is on, every line of it, below both rows.
      const note = page.texts.filter((t) => t.y > rows[1].y && t.x === 156 && t.text !== G.hint).map((t) => t.text).join(' ');
      expect(note).toBe(G.relics[offers[at]].note);
      expect(note).not.toBe(G.relics[offers[1 - at]].note);
      tidy(page);
      press(app, 'down');
    }
  });
});

describe('what is on offer, as it is drawn', () => {
  test.each([[3, {}], [4, { elite: true }], [5, { elite: true, relics: ['key'] as RelicId[] }]])('all %i of them are on the panel, each on a row of its own', (count, extra) => {
    const { app, store } = room({ floor: 9, drafting: true, ...extra });
    const offers = draft(savedGame(store).gauntlet!, CATALOG);
    expect(offers).toHaveLength(count);
    const labels = snap(app).menu.items.map((item) => item.label);
    expect(labels).toHaveLength(count);
    const page = drawn(app);
    const rows = labels.map((label) => page.texts.filter((t) => t.text === label && t.x === 164));
    for (const row of rows) expect(row).toHaveLength(1);
    const ys = rows.map((row) => row[0].y);
    expect(new Set(ys).size).toBe(count);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    tidy(page);
  });

  test('the lines under the list are about the offer the cursor is on', () => {
    const { app, store } = room({ floor: 9, drafting: true, elite: true });
    const offers = draft(savedGame(store).gauntlet!, CATALOG);
    const about = (offer: (typeof offers)[number]): string => (offer.kind === 'boon' ? G.boons[offer.boon].note : offer.kind === 'service' ? G.serviceNote : G.slot(G.slots[offer.slot]));
    const notes = offers.map(about);
    // Different things say different things, or the test would see nothing.
    expect(new Set(notes).size).toBeGreaterThan(1);
    offers.forEach((offer, at) => {
      const said = drawn(app).texts.map((t) => t.text);
      expect(said, `cursor on ${at}`).toContain(about(offer));
      for (const other of notes) if (other !== about(offer)) expect(said, `cursor on ${at}`).not.toContain(other);
      press(app, 'down');
    });
  });
});

describe('the doors, as they are drawn', () => {
  test.each([0, 1])('ELITE is written on the row of the door that hides one (door %i), and nowhere else', (side) => {
    const { seed, floor } = find((found) => found.length === 2 && !!found[side].elite);
    const { app } = room({ seed, floor });
    const page = drawn(app);
    const rows = [0, 1].map((i) => page.texts.find((t) => t.text === G.doors[i] && t.x === 164)!);
    const elite = one(page, G.elite);
    expect(elite.y).toBe(rows[side].y);
    expect(elite.y).not.toBe(rows[1 - side].y);
    expect(elite.right).toBeLessThanOrEqual(PANEL.right);
    expect(overlap(elite, rows[side])).toBe(false);
    tidy(page);
  });

  test('the elite\'s mark is written beside the machine that carries it, on its row and clear of its name', () => {
    // An elite that is not the first behind its door: a mark beside the first machine would be on the wrong row.
    const { seed, floor } = find((found) => found.length === 2 && !!found[1].elite && found[1].elite.at > 0, 3, 5);
    const { app } = room({ seed, floor });
    press(app, 'next');
    expect(g(app).shown).toBe(1);
    const door = doors({ ...startRun(seed, GAUNTLET_BUILD), floor }, BG)[1];
    const page = drawn(app);
    const mark = one(page, STRINGS.tags.marks[door.elite!.mark]);
    const lines = names(door.enemies).map((name) => page.texts.filter((t) => t.text === name && t.x === 156));
    // Two of a kind behind one door are written twice: the row is told by its place, not its name.
    const rowOf = (at: number): Written => page.texts.filter((t) => t.x === 156 && names(door.enemies).includes(t.text))[at];
    expect(lines.every((line) => line.length >= 1)).toBe(true);
    expect(mark.y).toBe(rowOf(door.elite!.at).y);
    expect(mark.y).not.toBe(rowOf(0).y);
    expect(mark.align).toBe('right');
    expect(overlap(mark, rowOf(door.elite!.at))).toBe(false);
    tidy(page);
  });

  test.each([[7, 4], [10, 3]])('every row of the list is on the panel, the last one too (floor %i: %i rows)', (floor, count) => {
    const { app } = room({ floor });
    const labels = snap(app).menu.items.map((item) => item.label);
    expect(labels).toHaveLength(count);
    expect(labels.at(-1)).toBe(G.back);
    const page = drawn(app);
    const rows = labels.map((label) => page.texts.filter((t) => t.text === label && t.x === 164));
    for (const row of rows) expect(row).toHaveLength(1);
    const ys = rows.map((row) => row[0].y);
    expect(new Set(ys).size).toBe(count);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    tidy(page);
  });

  test('coming back to the list, the cursor is on the door in view', () => {
    const { app } = room({ floor: 7 });
    press(app, 'next');
    expect(g(app).shown).toBe(1);
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('door-1');
    select(app, 'abandon');
    expect(ids(app)).toEqual(['no', 'yes']);
    press(app, 'cancel');
    expect(ids(app)).toEqual(['door-0', 'door-1', 'abandon', 'back']);
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('door-1');
    expect(g(app).shown).toBe(1);
  });
});

describe('the Spare Core, spent', () => {
  test('is said beside the armour figure, on its row and clear of it', () => {
    const { app } = room({ floor: 7, revived: true, relics: ['rig'] });
    const page = drawn(app);
    const spent = one(page, G.revived);
    const armour = one(page, G.armour(100));
    expect(spent.y).toBe(armour.y);
    expect(overlap(spent, armour)).toBe(false);
    expect(spent.right).toBeLessThanOrEqual(PANEL.right);
    tidy(page);
  });

  test('a floor lost in battle, not walked away from, is stood before again too', () => {
    // A frame with next to no armour left, against a warden: it does not last.
    const carry = { ap: { core: 1, legs: 1, arms: 1, head: 1 }, heat: 0, ammo: {}, restocked: {}, destroyed: false };
    const { app, store } = room({ floor: 20, relics: ['spare', 'rig'], carry });
    select(app, 'descend');
    expect(snap(app).screen).toBe('battle');
    finishBattle(app);
    expect(snap(app).battle).toMatchObject({ outcome: 'defeat' });
    press(app, 'confirm');
    expect(snap(app).screen).toBe('gauntlet');
    expect(g(app)).toMatchObject({ floor: 20, revived: true, relics: ['rig'], wear: 0 });
    expect(savedGame(store).gauntlet).toMatchObject({ floor: 20, fighting: false, carry: null, relics: ['rig'], revived: true });
    // Without one the same loss ends the run.
    const plain = room({ floor: 20, carry });
    select(plain.app, 'descend');
    finishBattle(plain.app);
    expect(snap(plain.app).battle).toMatchObject({ outcome: 'defeat' });
    press(plain.app, 'confirm');
    expect(g(plain.app).floor).toBeNull();
    expect(savedGame(plain.store).gauntlet).toBeNull();
  });
});

describe('relics, through the app', () => {
  const battle = (app: AppOf) => snap(app) as unknown as { player: { maxAp: number; damage: number }; battle: { drive: { kind: string; value: number } | null } };

  test('Glass Cannon: the frame on the floor hits three tenths harder', () => {
    const plain = room({ floor: 2 });
    select(plain.app, 'door-0');
    expect(battle(plain.app).player.damage).toBe(1);
    const glass = room({ floor: 2, relics: ['cannon'] });
    select(glass.app, 'door-0');
    expect(battle(glass.app).player.damage).toBe(1.3);
  });

  test('Redline Core: a full service taken after a floor leaves the meter where it was, and the next floor starts with it', () => {
    const carry = { ap: { core: 20, legs: 20 }, heat: 0, ammo: {}, restocked: {}, destroyed: false, drive: 80 };
    const { app, store } = room({ floor: 7, relics: ['redline'], drafting: true, carry, boons: MIGHTY });
    expect(g(app).wear).toBeGreaterThan(25);
    const at = g(app).offers.findIndex((offer) => offer.kind === 'service');
    expect(at).toBeGreaterThanOrEqual(0);
    select(app, `offer-${at}`);
    expect(g(app)).toMatchObject({ drafting: false, wear: 0 });
    expect(savedGame(store).gauntlet!.carry).toEqual(whole(80));
    select(app, 'door-0');
    expect(battle(app).battle.drive).toEqual({ kind: 'second-wind', value: 80 });
  });

  test('Redline Core: the Spare Core keeps the meter too', () => {
    const carry = { ap: { core: 20 }, heat: 0, ammo: {}, restocked: {}, destroyed: false, drive: 55 };
    const { app, store } = room({ floor: 7, relics: ['redline', 'spare'], carry });
    select(app, 'door-0');
    // Closing the game on the floor loses it.
    press(app, 'cancel');
    expect(savedGame(store).gauntlet).toMatchObject({ fighting: true });
    const again = inHub(savedGame(store));
    expect(savedGame(again.store).gauntlet).toMatchObject({ floor: 7, revived: true, relics: ['redline'], carry: whole(55) });
  });
});

describe('an elite under a Shield Drone\'s cover', () => {
  const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
  /** What is said over the heads of the machines, frame by frame, for a while. */
  function overHeads(marks: Record<number, 'armoured'>): string[][] {
    const flow = new BattleFlow(createBattle(DEMO_BUILD, [ENEMIES['heavy-mech'], ENEMIES['shield-drone']], CATALOG, 7, { marks }), CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: true });
    for (let i = 0; i < 50 && flow.phase !== 'action'; i++) screen.update(16);
    expect(flow.phase).toBe('action');
    const frames: string[][] = [];
    for (let ms = 0; ms < 8000; ms += 100) {
      screen.update(100);
      frames.push(record((ctx) => screen.draw(ctx)).texts.map((t) => t.text).filter((text) => text === 'ARMOURED' || text === 'COVERED'));
    }
    return frames;
  }

  test('says its mark and its cover in turn: the mark is not hidden for as long as the drone stands', () => {
    const frames = overHeads({ 0: 'armoured' });
    // One thing at a time over its head, and each of the two for its share of the time.
    for (const frame of frames) expect(frame).toHaveLength(1);
    const said = frames.map((frame) => frame[0]);
    expect(said.filter((text) => text === 'ARMOURED').length).toBeGreaterThan(frames.length * 0.4);
    expect(said.filter((text) => text === 'COVERED').length).toBeGreaterThan(frames.length * 0.4);
    // Each stays up long enough to be read, a second and a half at a time: it does not flicker.
    expect(MARK_TURN_MS).toBe(1600);
    const turns: number[] = [];
    let since = 0;
    said.forEach((text, i) => { if (i > 0 && text !== said[i - 1]) { turns.push((i - since) * 100); since = i; } });
    expect(turns.length).toBeGreaterThanOrEqual(3);
    // The first is cut short by where the clock stood when the watching began; every one after it is whole.
    for (const turn of turns.slice(1)) expect(turn).toBe(MARK_TURN_MS);
  });

  test('a machine under cover with no mark says only that it is covered', () => {
    for (const frame of overHeads({})) expect(frame).toEqual(['COVERED']);
  });
});

describe('an elite, and the count of them', () => {
  test('a floor lost to an elite does not count as one beaten', () => {
    const { seed, floor } = find((found) => found.length === 2 && !!found[0].elite);
    // A frame with next to no armour left: the elite's floor is lost.
    const carry = { ap: { core: 1, legs: 1, arms: 1, head: 1 }, heat: 0, ammo: {}, restocked: {}, destroyed: false };
    const { app, store } = room({ seed, floor, carry });
    select(app, 'door-0');
    expect(savedGame(store).gauntlet).toMatchObject({ elite: true, fighting: true });
    finishBattle(app);
    expect(snap(app).battle).toMatchObject({ outcome: 'defeat' });
    press(app, 'confirm');
    expect(savedGame(store).elites ?? 0).toBe(0);
    expect(savedGame(store).medals).not.toContain('elite');
  });

  test('a run already holding three relics when the game is opened earns the medal there and then', () => {
    const saved = { ...strong(done('intro-1', 'intro-2')), gauntlet: { ...startRun(77, GAUNTLET_BUILD), floor: 12, relics: ['rig', 'key', 'ledger'] as RelicId[] } };
    expect(saved.medals).not.toContain('relics-3');
    const { store } = inHub(saved);
    expect(savedGame(store).medals).toContain('relics-3');
  });
});
