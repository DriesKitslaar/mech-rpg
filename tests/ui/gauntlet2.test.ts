import { createBattle } from '../../src/core/battle';
import { doors, payout, relicOffers, startRun, type RelicId, type Run } from '../../src/core/gauntlet';
import { ENEMIES } from '../../src/content/enemies';
import { GAUNTLET_BUILD, GAUNTLET_TEXT } from '../../src/content/gauntlet';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { SaveFile } from '../../src/platform/storage';
import { App } from '../../src/ui/app';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen } from '../../src/ui/battleScreen';
import type { SpriteStore } from '../../src/ui/sprites';
import { done, finishBattle, ids, inHub, medalPay, press, savedGame, select, snap, strong } from '../helpers/app';

const BG = GAUNTLET_TEXT.backgrounds;
interface DoorView { enemies: string[]; ground: string | null; elite: { at: number; mark: string } | null }
interface View {
  best: number; floor: number | null; drafting: boolean; offers: { kind: string }[]; enemies: string[]; ground: string | null; wear: number;
  doors: DoorView[]; shown: number; relics: string[]; relicOwed: boolean; relicOffers: string[]; revived: boolean; pays: number;
  last: { cleared: number; paid: number; record: boolean } | null;
}
type AppOf = ReturnType<typeof inHub>['app'];
const g = (app: AppOf): View => snap(app).gauntlet as View;
const ready = () => inHub(strong(done('intro-1', 'intro-2')));
/** A frame that does not lose: for tests about what happens around a floor, not on it. */
const MIGHTY = { plating: 30, capacitor: 20, optics: 30, heatsinks: 10 };
/** Puts the app in the Gauntlet's room with the run as given. */
function room(run: Partial<Run> & { seed?: number }, deps: Parameters<typeof inHub>[2] = {}) {
  const made = inHub(strong(done('intro-1', 'intro-2')), undefined, deps);
  const base = startRun(run.seed ?? 77, GAUNTLET_BUILD);
  made.app.commit({ ...made.app.game!, gauntlet: { ...base, ...run } });
  made.app.go('gauntlet');
  expect(snap(made.app).screen).toBe('gauntlet');
  return made;
}
/** Wins the floor behind the door chosen and comes back to the room. */
function clear(app: AppOf, id: string): void {
  select(app, id);
  expect(snap(app).screen).toBe('battle');
  finishBattle(app);
  expect(snap(app).battle?.outcome).toBe('victory');
  press(app, 'confirm');
  expect(snap(app).screen).toBe('gauntlet');
}
/** Walks away from the floor being fought. */
function leave(app: AppOf): void {
  for (let i = 0; i < 4000 && snap(app).battle?.phase !== 'action'; i++) {
    if (snap(app).battle?.phase === 'animating') app.update(16);
    else press(app, 'confirm');
  }
  select(app, 'retreat');
  select(app, 'yes');
  for (let i = 0; i < 2000 && snap(app).battle?.phase !== 'result'; i++) {
    if (snap(app).battle?.phase === 'animating') app.update(16);
    else press(app, 'confirm');
  }
  press(app, 'confirm');
  expect(snap(app).screen).toBe('gauntlet');
}
/** A seed and floor whose doors are as asked. */
function find(want: (found: ReturnType<typeof doors>) => boolean, from = 3): { seed: number; floor: number } {
  for (let seed = 1; seed < 400; seed++) {
    for (let floor = from; floor < 5; floor++) if (want(doors({ ...startRun(seed, GAUNTLET_BUILD), floor }, BG))) return { seed, floor };
  }
  throw new Error('no such floor');
}
/** What the room writes when it is drawn. */
function written(app: AppOf): string[] {
  const said: string[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get: (t, name: string) => (name in t ? t[name] : name === 'measureText' ? () => ({ width: 10 })
      : (...args: unknown[]) => { if (name === 'fillText') said.push(String(args[0])); }),
    set: (t, name: string, value) => { t[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  app.update(16);
  app.draw(ctx);
  return said;
}

describe('the doors', () => {
  test('an open floor is entered by one of two doors, and the room shows who is behind the one being looked at', () => {
    const { app } = room({ floor: 2 });
    expect(ids(app)).toEqual(['door-0', 'door-1', 'abandon', 'back']);
    expect(snap(app).menu.items.slice(0, 2).map((i) => i.label)).toEqual(['Left door', 'Right door']);
    const [left, right] = g(app).doors;
    expect(g(app).doors).toHaveLength(2);
    expect(left.ground).not.toBe(right.ground);
    expect(g(app)).toMatchObject({ shown: 0, enemies: left.enemies, ground: left.ground });
    press(app, 'down');
    expect(g(app)).toMatchObject({ shown: 1, enemies: right.enemies, ground: right.ground });
    // Further down the list the door last looked at stays in view.
    press(app, 'down');
    expect(g(app)).toMatchObject({ shown: 1, enemies: right.enemies });
    press(app, 'up', 'up');
    expect(g(app).shown).toBe(0);
  });

  test('the shoulder buttons and the sides of the pad look at the other door, and the cursor goes along while it is on a door', () => {
    const { app } = room({ floor: 2 });
    for (const button of ['next', 'prev', 'right', 'left'] as const) {
      const before = g(app).shown;
      press(app, button);
      expect(g(app).shown).toBe(1 - before);
      expect(snap(app).menu.cursor).toBe(1 - before);
    }
    // From further down the list the door is looked at and the cursor stays where it is.
    expect(g(app).shown).toBe(0);
    press(app, 'down', 'down');
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('abandon');
    // The cursor passed the right door on its way down, and that is the one in view.
    expect(g(app).shown).toBe(1);
    press(app, 'next');
    expect(g(app).shown).toBe(0);
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('abandon');
    // Asked whether to end the run, there is nothing to look at: the question waits for its answer.
    press(app, 'confirm');
    expect(ids(app)).toEqual(['no', 'yes']);
    press(app, 'next');
    expect(g(app).shown).toBe(0);
    // Said no, the cursor is back on the door that was in view.
    press(app, 'cancel');
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('door-0');
  });

  test('the door taken is the floor fought, and it is written down before the first shot', () => {
    for (const door of [0, 1]) {
      const { app, store } = room({ floor: 2 });
      const behind = g(app).doors[door];
      select(app, `door-${door}`);
      expect(snap(app).screen).toBe('battle');
      expect([...snap(app).battle!.enemies].sort()).toEqual([...behind.enemies].sort());
      expect((snap(app).battle as unknown as { ground: string | null }).ground).toBe(behind.ground);
      expect(savedGame(store).gauntlet).toMatchObject({ floor: 2, door, fighting: true });
    }
  });

  test('a warden\'s floor has one way in, and there is no other door to look at', () => {
    const { app } = room({ floor: 5, boons: MIGHTY });
    expect(ids(app)).toEqual(['descend', 'abandon', 'back']);
    expect(g(app).doors).toHaveLength(1);
    press(app, 'next', 'right');
    expect(g(app).shown).toBe(0);
    expect(written(app)).not.toContain('L1/R1: other door');
    expect(written(app)).toContain('EXPECTED');
  });

  test('while something is being taken the other door can still be looked at', () => {
    const { app } = room({ floor: 2, boons: MIGHTY });
    clear(app, 'door-0');
    expect(g(app)).toMatchObject({ floor: 3, drafting: true, shown: 0 });
    const [left, right] = g(app).doors;
    expect(g(app).enemies).toEqual(left.enemies);
    const cursor = snap(app).menu.cursor;
    press(app, 'next');
    expect(g(app)).toMatchObject({ shown: 1, enemies: right.enemies });
    expect(snap(app).menu.cursor).toBe(cursor);
    expect(written(app)).toEqual(expect.arrayContaining(['RIGHT DOOR', 'TAKE ONE', 'L1/R1: other door']));
    // With the thing taken the doors are the list, and the first is under the cursor.
    press(app, 'confirm');
    expect(g(app)).toMatchObject({ drafting: false, shown: 0 });
    expect(snap(app).menu.cursor).toBe(0);
  });
});

describe('an elite behind a door', () => {
  const elite = (side: number) => find((found) => found.length === 2 && !!found[side].elite);

  test('the room says which door hides one and what sets it apart', () => {
    const { seed, floor } = elite(1);
    const { app } = room({ seed, floor });
    const marked = g(app).doors[1].elite!;
    expect(g(app).doors[0].elite).toBeNull();
    expect(written(app)).toContain('ELITE');
    expect(written(app)).not.toContain(STRINGS.tags.marks[marked.mark]);
    press(app, 'down');
    expect(written(app)).toContain(STRINGS.tags.marks[marked.mark]);
  });

  test('it is on the field with its mark, and beating it puts four things on offer', () => {
    const { seed, floor } = elite(0);
    const { app, store } = room({ seed, floor, boons: MIGHTY });
    const marked = g(app).doors[0].elite!;
    select(app, 'door-0');
    expect((snap(app).battle as unknown as { elites: unknown[] }).elites).toEqual([{ id: `enemy-${marked.at}`, mark: marked.mark }]);
    expect(savedGame(store).gauntlet).toMatchObject({ elite: true });
    finishBattle(app);
    press(app, 'confirm');
    expect(g(app)).toMatchObject({ floor: floor + 1, drafting: true });
    expect(g(app).offers).toHaveLength(4);
    expect(ids(app)).toEqual(['offer-0', 'offer-1', 'offer-2', 'offer-3']);
    // The fourth can be taken like any other.
    select(app, 'offer-3');
    expect(g(app).drafting).toBe(false);
    expect(savedGame(store).gauntlet).toMatchObject({ elite: false });
  });

  test('the door beside it is an ordinary floor: nobody marked, three on offer', () => {
    const { seed, floor } = elite(0);
    const { app } = room({ seed, floor, boons: MIGHTY });
    select(app, 'door-1');
    expect((snap(app).battle as unknown as { elites: unknown[] }).elites).toEqual([]);
    finishBattle(app);
    press(app, 'confirm');
    expect(g(app).offers).toHaveLength(3);
  });

  test('on the field an elite is known by its mark: over its head, and among its tags when it is aimed at', () => {
    const sprites: SpriteStore = { get: (id, fallback) => ({ image: { id } as unknown as CanvasImageSource, w: fallback.w, h: fallback.h }) };
    const flow = new BattleFlow(createBattle(DEMO_BUILD, [ENEMIES['heavy-mech'], ENEMIES['recon-drone']], CATALOG, 7, { marks: { 0: 'swift' } }), CATALOG, { quiet: true });
    const screen = new BattleScreen(flow, sprites, CATALOG, { fast: true });
    for (let i = 0; i < 50 && flow.phase !== 'action'; i++) screen.update(16);
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
    expect(said().filter((text) => text === 'SWIFT')).toHaveLength(1);
    screen.onInput('confirm');
    screen.onInput('confirm');
    expect(flow.phase).toBe('target');
    expect(flow.targetId).toBe('enemy-0');
    expect(said().filter((text) => text === 'SWIFT')).toHaveLength(2);
  });
});

describe('what a warden leaves', () => {
  /** A run that has just beaten the first warden. `played` collects the sounds the app asks for from then on. */
  const played: string[] = [];
  function beaten(relics: RelicId[] = []) {
    const made = room({ floor: 5, boons: MIGHTY, relics }, { sfx: { muted: false, play: (name: string) => { played.push(name); }, unlock: () => {} } as never });
    clear(made.app, 'descend');
    played.length = 0;
    return made;
  }

  test('two relics are on offer before anything else, and the one taken is held for the rest of the run', () => {
    const { app, store } = beaten();
    expect(g(app)).toMatchObject({ floor: 6, drafting: true, relicOwed: true, relics: [] });
    const offers = relicOffers(savedGame(store).gauntlet!);
    expect(g(app).relicOffers).toEqual(offers);
    expect(ids(app)).toEqual(offers.map((id) => `relic-${id}`));
    expect(snap(app).menu.items.map((i) => i.label)).toEqual(offers.map((id) => STRINGS.gauntlet.relics[id].name));
    expect(written(app)).toEqual(expect.arrayContaining(['THE WARDEN LEFT', STRINGS.gauntlet.relics[offers[0]].name]));
    // It is owed: leaving for the hub and coming back finds the same two.
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
    select(app, 'gauntlet');
    expect(g(app).relicOffers).toEqual(offers);
    press(app, 'down', 'confirm');
    // Whatever else was announced in passing meanwhile, the relic has its own sound, once.
    expect(played.filter((name) => name === 'relic')).toEqual(['relic']);
    expect(g(app)).toMatchObject({ relicOwed: false, relics: [offers[1]], drafting: true });
    expect(savedGame(store).gauntlet).toMatchObject({ relicOwed: false, relics: [offers[1]] });
    // Then the ordinary three.
    expect(ids(app)).toEqual(['offer-0', 'offer-1', 'offer-2'].concat(offers[1] === 'key' ? ['offer-3'] : []));
    expect(written(app)).toContain(STRINGS.gauntlet.relics[offers[1]].short);
  });

  test('a run that holds every relic is offered none, and goes straight to what is on offer', () => {
    const { app } = beaten(['redline', 'rig', 'key', 'spare', 'cannon', 'ledger']);
    expect(g(app)).toMatchObject({ relicOwed: false, drafting: true });
    expect(ids(app)[0]).toBe('offer-0');
  });

  test('Redline Core: the frame is flown with Second Wind, and one set off down there counts for the pilot', () => {
    const { app, store } = room({ floor: 2, boons: MIGHTY, relics: ['redline'], carry: { ap: {}, heat: 0, ammo: {}, restocked: {}, destroyed: false, drive: 100 } });
    select(app, 'door-0');
    const drive = () => (snap(app).battle as unknown as { drive: { kind: string; value: number } | null }).drive;
    expect(drive()).toEqual({ kind: 'second-wind', value: 100 });
    const toAction = (): void => {
      for (let i = 0; i < 4000 && snap(app).battle?.phase !== 'action'; i++) {
        if (snap(app).battle?.phase === 'animating') app.update(16);
        else press(app, 'confirm');
      }
    };
    toAction();
    // A Second Wind gives a turn back: something of this one is spent first.
    press(app, 'next');
    expect(drive()!.value).toBe(100);
    press(app, 'confirm', 'confirm', 'confirm');
    toAction();
    press(app, 'next');
    expect(drive()!.value).toBe(0);
    finishBattle(app);
    press(app, 'confirm');
    expect(savedGame(store).overdrives).toBe(1);
    expect(savedGame(store).medals).toContain('overdrive');
  });

  test('Spare Core: a floor walked away from is stood before again in a whole mech; the second time the run is over', () => {
    const { app, store } = room({ floor: 7, relics: ['rig', 'spare'], carry: { ap: { core: 30 }, heat: 0, ammo: {}, restocked: {}, destroyed: false } });
    expect(g(app).wear).toBeGreaterThan(0);
    const credits = snap(app).credits;
    select(app, 'door-1');
    leave(app);
    expect(g(app)).toMatchObject({ floor: 7, revived: true, relics: ['rig'], wear: 0, last: null });
    expect(snap(app).credits).toBe(credits);
    expect(written(app)).toContain('SPARE CORE SPENT');
    expect(savedGame(store).gauntlet).toMatchObject({ floor: 7, fighting: false, carry: null, relics: ['rig'] });
    expect(ids(app)).toEqual(['door-0', 'door-1', 'abandon', 'back']);
    select(app, 'door-0');
    expect(savedGame(store).gauntlet).toMatchObject({ revived: false, fighting: true });
    const medals = savedGame(store).medals;
    leave(app);
    expect(g(app)).toMatchObject({ floor: null, last: { cleared: 6, paid: payout(6) } });
    // What it paid, and what the medals for getting that deep paid on top.
    expect(snap(app).credits).toBe(credits + payout(6) + medalPay(savedGame(store).medals) - medalPay(medals));
  });

  test('Spare Core: a game closed on a floor spends it too, and the run is still there', () => {
    const { app, store } = room({ floor: 7, relics: ['spare'] });
    select(app, 'door-0');
    expect(savedGame(store).gauntlet).toMatchObject({ fighting: true });
    const again = new App({ catalog: CATALOG, save: new SaveFile(store, CATALOG), sprites: app.deps.sprites, fast: true, seed: 9 });
    press(again, 'confirm');
    expect(snap(again).screen).toBe('hub');
    expect(savedGame(store).gauntlet).toMatchObject({ floor: 7, fighting: false, relics: [], revived: true, carry: null });
  });

  test('Hazard Pay: the run pays half as much again, and the question about ending it says so', () => {
    const { app, store } = room({ floor: 8, relics: ['ledger'] });
    const credits = snap(app).credits;
    const medals = savedGame(store).medals;
    const pay = Math.round(payout(7) * 1.5);
    expect(g(app).pays).toBe(pay);
    select(app, 'abandon');
    expect(written(app)).toContain(STRINGS.gauntlet.abandonAsk(pay));
    select(app, 'yes');
    expect(g(app)).toMatchObject({ floor: null, last: { cleared: 7, paid: pay } });
    expect(snap(app).credits).toBe(credits + pay + medalPay(savedGame(store).medals) - medalPay(medals));
  });

  test('Glass Cannon: the frame on the floor is thinner by fifteen in a hundred', () => {
    const armour = (app: AppOf) => (snap(app).player as { maxAp: number }).maxAp;
    const plain = room({ floor: 2 });
    select(plain.app, 'door-0');
    const thin = room({ floor: 2, relics: ['cannon'] });
    select(thin.app, 'door-0');
    expect(armour(thin.app)).toBeLessThan(armour(plain.app) * 0.87);
    expect(armour(thin.app)).toBeGreaterThan(armour(plain.app) * 0.83);
  });
});

describe('the Gauntlet\'s music', () => {
  test('its room has a song of its own, its open floors another, a warden\'s floor the boss\'s, and all three are heard for the jukebox', () => {
    const tracks: (string | null)[] = [];
    const music = { enabled: true, tense: false, play: (t: string | null) => { tracks.push(t); } };
    const { app } = inHub(strong(done('intro-1', 'intro-2')), 5, { music });
    expect(tracks.at(-1)).toBe('hub');
    select(app, 'gauntlet');
    expect(tracks.at(-1)).toBe('gauntlet');
    select(app, 'start');
    select(app, 'door-0');
    expect(tracks.at(-1)).toBe('descent');
    // Back in the room after the floor, the room's song again.
    finishBattle(app);
    press(app, 'confirm');
    expect(snap(app).screen).toBe('gauntlet');
    expect(tracks.at(-1)).toBe('gauntlet');
    // The warden's floor.
    app.commit({ ...app.game!, gauntlet: { ...startRun(77, GAUNTLET_BUILD), floor: 5, boons: MIGHTY } });
    app.go('gauntlet');
    select(app, 'descend');
    expect(tracks.at(-1)).toBe('boss');
    expect(app.heard()).toEqual(expect.arrayContaining(['gauntlet', 'descent', 'boss']));
    // Leaving the room for the hub brings the hub's song back.
    finishBattle(app);
    press(app, 'confirm');
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
    expect(tracks.at(-1)).toBe('hub');
  });
});

describe('the Gauntlet\'s medals for elites and relics', () => {
  const elite = () => find((found) => found.length === 2 && !!found[0].elite);

  test('an elite beaten is counted and earns its medal; the plain door beside it counts for nothing', () => {
    const { seed, floor } = elite();
    const { app, store } = room({ seed, floor, boons: MIGHTY });
    clear(app, 'door-0');
    expect(savedGame(store).elites).toBe(1);
    expect(savedGame(store).medals).toContain('elite');
    expect(savedGame(store).medals).not.toContain('elite-10');
    const plain = room({ seed, floor, boons: MIGHTY });
    clear(plain.app, 'door-1');
    expect(savedGame(plain.store).elites ?? 0).toBe(0);
    expect(savedGame(plain.store).medals).not.toContain('elite');
  });

  test('ten of them earn the second', () => {
    const { seed, floor } = elite();
    const made = room({ seed, floor, boons: MIGHTY });
    made.app.commit({ ...made.app.game!, elites: 9 });
    clear(made.app, 'door-0');
    expect(savedGame(made.store).elites).toBe(10);
    expect(savedGame(made.store).medals).toEqual(expect.arrayContaining(['elite', 'elite-10']));
  });

  test('the most relics held at once in a run is remembered, and three of them earn a medal', () => {
    const { app, store } = room({ floor: 5, boons: MIGHTY, relics: ['rig', 'ledger'] });
    clear(app, 'descend');
    expect(g(app).relicOwed).toBe(true);
    press(app, 'confirm');
    expect(savedGame(store).relicsHeld).toBe(3);
    expect(savedGame(store).medals).toContain('relics-3');
    // A later run with fewer does not take it back.
    app.commit({ ...app.game!, gauntlet: { ...startRun(9, GAUNTLET_BUILD), floor: 5, boons: MIGHTY } });
    app.go('gauntlet');
    clear(app, 'descend');
    press(app, 'confirm');
    expect(savedGame(store).relicsHeld).toBe(3);
  });
});
