import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { DRIVE_MAX, MARKS, type BattleState } from '../../src/core/battle';
import { ENEMY_COST } from '../../src/core/board';
import {
  BOON_CAP, BOON_IDS, CANNON, ELITE_CHANCE, ELITE_FROM, GAUNTLET_PATCH, LEDGER_PAY, RELIC_IDS, RIG_PATCH, descend, doorOf, doors, draft, draftSize, enter, fall,
  floorMission, hasRelic, isValidRun, isWardenFloor, payout, relicOffers, runMods, runOverdrive, runPayout, startRun, take, takeRelic, wear,
  type RelicId, type Run,
} from '../../src/core/gauntlet';
import { startMissionBattle } from '../../src/core/mission';
import { ALL_ENEMIES } from '../../src/content/arena';
import { GAUNTLET_TEXT } from '../../src/content/gauntlet';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';

const BG = GAUNTLET_TEXT.backgrounds;
const names = Object.fromEntries(Object.values(ALL_ENEMIES).map((e) => [e.id, e.name]));
const fresh = (seed = 5, floor = 1): Run => ({ ...startRun(seed, STARTER_BUILD), floor });
const mission = (run: Run) => floorMission(run, GAUNTLET_TEXT, names);
/** The floor fought with a frame that cannot lose, so that what follows a win can be looked at. */
function win(run: Run, drive?: number): BattleState {
  const m = mission(run);
  const od = runOverdrive(run);
  const start = startMissionBattle(run.build, m, 0, ALL_ENEMIES, CATALOG, run.seed + run.floor, undefined, {
    enemyScale: m.scale, mods: { ...runMods(run), armour: 30, energy: 400, aim: 60 }, carry: run.carry ?? undefined, ...(od ? { overdrive: od } : {}),
  });
  if (drive !== undefined) start.units[0].drive = drive;
  const end = runBattle(start, CATALOG, chooseAutoPlayerAction);
  expect(end.outcome).toBe('victory');
  return end;
}
/** Every open floor of a few hundred runs, with its doors. */
function* openFloors(seeds = 120, deepest = 24): Generator<{ run: Run; found: ReturnType<typeof doors> }> {
  for (let seed = 1; seed <= seeds; seed++) {
    for (let floor = 1; floor <= deepest; floor++) {
      if (isWardenFloor(floor)) continue;
      const run = fresh(seed * 31, floor);
      yield { run, found: doors(run, BG) };
    }
  }
}
const withRelics = (run: Run, ...relics: RelicId[]): Run => ({ ...run, relics });

describe('the doors of a floor', () => {
  test('an open floor has two, a warden\'s floor one; they are the same every time they are looked at', () => {
    expect(doors(fresh(5, 1), BG)).toHaveLength(2);
    expect(doors(fresh(5, 4), BG)).toHaveLength(2);
    expect(doors(fresh(5, 5), BG)).toHaveLength(1);
    expect(doors(fresh(5, 5), BG)[0].enemies).toEqual(['scrap-king']);
    expect(doors(fresh(9, 7), BG)).toEqual(doors(fresh(9, 7), BG));
    expect(doors(fresh(9, 7), BG)).not.toEqual(doors(fresh(10, 7), BG));
  });

  test('the two lead to different ground, always, and to different machines nearly always', () => {
    let floors = 0;
    let same = 0;
    for (const { found } of openFloors()) {
      floors += 1;
      expect(found[0].background).not.toBe(found[1].background);
      expect(found[0].scale).toBe(found[1].scale);
      for (const door of found) {
        expect(door.enemies.length).toBeGreaterThan(0);
        for (const id of door.enemies) expect(ALL_ENEMIES[id], id).toBeDefined();
      }
      if ([...found[0].enemies].sort().join() === [...found[1].enemies].sort().join()) same += 1;
    }
    expect(same / floors).toBeLessThan(0.02);
  });

  test('a floor entered is fought behind the door that was taken, and no other', () => {
    const run = fresh(7, 2);
    const found = doors(run, BG);
    for (const door of [0, 1]) {
      const entered = enter(run, door, BG);
      expect(entered).toMatchObject({ door, fighting: true, elite: false });
      const m = mission(entered);
      expect(m.battles[0].enemies).toEqual(found[door].enemies);
      expect(m.battles[0].background).toBe(found[door].background);
      expect(m.scale).toBe(found[door].scale);
      expect(doorOf(entered, BG)).toEqual(found[door]);
    }
    // Until a door is taken the first is what is shown.
    expect(mission(run).battles[0].enemies).toEqual(found[0].enemies);
    expect(() => enter(run, 2, BG)).toThrow('no such door');
    expect(() => enter(run, -1, BG)).toThrow('no such door');
    expect(() => enter(fresh(7, 5), 1, BG)).toThrow('no such door');
    expect(() => enter({ ...run, drafting: true }, 0, BG)).toThrow('draft');
  });

  test('a floor won forgets its door: the next floor is chosen afresh', () => {
    const run = enter(fresh(7, 2), 1, BG);
    const next = descend(run, win(run));
    expect(next.door).toBeUndefined();
    expect(next).toMatchObject({ floor: 3, fighting: false, drafting: true });
  });
});

describe('elites', () => {
  test('there are none on the first two floors; after that about two open floors in five hide one, behind one door only', () => {
    let later = 0;
    let withElite = 0;
    for (const { run, found } of openFloors()) {
      const elites = found.filter((door) => door.elite);
      if (run.floor < ELITE_FROM) { expect(elites).toEqual([]); continue; }
      later += 1;
      expect(elites.length).toBeLessThanOrEqual(1);
      if (elites.length === 1) withElite += 1;
    }
    expect(ELITE_FROM).toBe(3);
    expect(withElite / later).toBeGreaterThan(ELITE_CHANCE - 0.05);
    expect(withElite / later).toBeLessThan(ELITE_CHANCE + 0.05);
  });

  test('the elite is the dearest machine behind its door, it stands behind either door, and every mark is met', () => {
    const marks = new Set<string>();
    const sides = new Set<number>();
    for (const { found } of openFloors()) {
      found.forEach((door, side) => {
        if (!door.elite) return;
        marks.add(door.elite.mark);
        sides.add(side);
        const costs = door.enemies.map((id) => ENEMY_COST[id]);
        expect(costs[door.elite.at]).toBe(Math.max(...costs));
        // The first of them, when two cost the same.
        expect(costs.indexOf(Math.max(...costs))).toBe(door.elite.at);
      });
    }
    expect([...marks].sort()).toEqual([...MARKS].sort());
    expect([...sides].sort()).toEqual([0, 1]);
    for (const mark of MARKS) expect(STRINGS.tags.marks[mark]).toMatch(/^[A-Z]+$/);
  });

  test('wardens\' floors have none', () => {
    for (let seed = 1; seed <= 60; seed++) for (const floor of [5, 10, 15, 50]) expect(doors(fresh(seed, floor), BG)[0].elite).toBeUndefined();
  });

  /** A run standing before a floor with an elite door, and which door that is. */
  function beforeElite(): { run: Run; at: number } {
    for (const { run, found } of openFloors()) {
      const at = found.findIndex((door) => door.elite);
      if (at >= 0) return { run, at };
    }
    throw new Error('no elite found');
  }

  test('the battle behind an elite\'s door fields it with its mark, and the other door fields nobody marked', () => {
    const { run, at } = beforeElite();
    const elite = doors(run, BG)[at].elite!;
    const m = mission(enter(run, at, BG));
    expect(m.battles[0].marks).toEqual({ [elite.at]: elite.mark });
    const state = startMissionBattle(run.build, m, 0, ALL_ENEMIES, CATALOG, 1);
    expect(state.units.filter((u) => u.mark).map((u) => [u.id, u.mark])).toEqual([[`enemy-${elite.at}`, elite.mark]]);
    const other = mission(enter(run, 1 - at, BG));
    expect(other.battles[0].marks).toBeUndefined();
    expect(startMissionBattle(run.build, other, 0, ALL_ENEMIES, CATALOG, 1).units.some((u) => u.mark)).toBe(false);
  });

  test('an elite beaten puts one more on offer, once: the draft after the next floor is three again', () => {
    const { run, at } = beforeElite();
    const entered = enter(run, at, BG);
    expect(entered.elite).toBe(true);
    const next = descend(entered, win(entered));
    expect(next.elite).toBe(true);
    expect(draftSize(next)).toBe(4);
    const offers = draft(next, CATALOG);
    expect(offers).toHaveLength(4);
    expect(new Set(offers.map((o) => JSON.stringify(o))).size).toBe(4);
    // The first three are what there would have been without it.
    expect(offers.slice(0, 3)).toEqual(draft({ ...next, elite: false }, CATALOG));
    const taken = take(next, offers[3], CATALOG);
    expect(taken.elite).toBe(false);
    // The other door of the same floor earns nothing extra.
    const plain = enter(run, 1 - at, BG);
    expect(plain.elite).toBe(false);
    expect(draft(descend(plain, win(plain)), CATALOG)).toHaveLength(3);
  });
});

describe('a boon', () => {
  test('can be taken five times in a run; after that it is no longer offered', () => {
    expect(BOON_CAP).toBe(5);
    const offered = (boons: Record<string, number>): Set<string> => {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 80; seed++) {
        for (const offer of draft({ ...fresh(seed, 3), drafting: true, boons }, CATALOG)) if (offer.kind === 'boon') seen.add(offer.boon);
      }
      return seen;
    };
    expect([...offered({ plating: 4 })].sort()).toEqual([...BOON_IDS].sort());
    expect(offered({ plating: 5 }).has('plating')).toBe(false);
    expect(offered({ plating: 5, optics: 9 }).has('optics')).toBe(false);
    expect(offered({ plating: 5, optics: 9 }).has('capacitor')).toBe(true);
  });

  test('with every boon taken as often as it can be, parts fill the list: it is as long as it should be', () => {
    const full = Object.fromEntries(BOON_IDS.map((id) => [id, BOON_CAP]));
    for (let seed = 1; seed <= 40; seed++) {
      for (const elite of [false, true]) {
        const run: Run = { ...fresh(seed, 12), drafting: true, boons: full, elite };
        const offers = draft(run, CATALOG);
        expect(offers).toHaveLength(elite ? 4 : 3);
        expect(offers.every((o) => o.kind !== 'boon')).toBe(true);
        expect(new Set(offers.map((o) => JSON.stringify(o))).size).toBe(offers.length);
        const parts = offers.flatMap((o) => (o.kind === 'part' ? [o.slot] : []));
        expect(new Set(parts).size).toBe(parts.length);
      }
    }
  });
});

describe('relics', () => {
  const afterWarden = (run: Run = fresh(5, 5)): Run => { const entered = enter(run, 0, BG); return descend(entered, win(entered)); };

  test('a warden beaten leaves two to choose from, different ones, the same two every time; the draft waits until one is taken', () => {
    const run = afterWarden();
    expect(run).toMatchObject({ floor: 6, relicOwed: true, drafting: true, carry: null });
    const offers = relicOffers(run);
    expect(offers).toHaveLength(2);
    expect(offers[0]).not.toBe(offers[1]);
    expect(relicOffers(run)).toEqual(offers);
    for (const id of offers) expect(RELIC_IDS).toContain(id);
    expect(() => take(run, draft(run, CATALOG)[0], CATALOG)).toThrow('relic is owed');
    const other = RELIC_IDS.find((id) => !offers.includes(id))!;
    expect(() => takeRelic(run, other)).toThrow('not on offer');
    const held = takeRelic(run, offers[1]);
    expect(held).toMatchObject({ relicOwed: false, relics: [offers[1]], drafting: true });
    expect(() => takeRelic(held, offers[0])).toThrow('no relic is owed');
    expect(take(held, draft(held, CATALOG)[0], CATALOG).drafting).toBe(false);
  });

  test('an open floor leaves none', () => {
    const entered = enter(fresh(5, 4), 0, BG);
    expect(descend(entered, win(entered)).relicOwed).toBe(false);
  });

  test('one that is held is not offered again; with one left there is one, with none left none is owed', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) for (const id of relicOffers({ ...fresh(seed, 6), relicOwed: true, drafting: true })) seen.add(id);
    expect([...seen].sort()).toEqual([...RELIC_IDS].sort());
    for (let seed = 1; seed <= 40; seed++) {
      const run = withRelics({ ...fresh(seed, 11), drafting: true, relicOwed: true }, 'rig', 'key');
      const offers = relicOffers(run);
      expect(offers).toHaveLength(2);
      expect(offers).not.toContain('rig');
      expect(offers).not.toContain('key');
    }
    const five = RELIC_IDS.filter((id) => id !== 'ledger');
    expect(relicOffers(withRelics({ ...fresh(3, 31), relicOwed: true, drafting: true }, ...five))).toEqual(['ledger']);
    expect(afterWarden(withRelics(fresh(5, 5), ...RELIC_IDS))).toMatchObject({ relicOwed: false, drafting: true });
  });

  test('every relic has a name, a short name and a line that says what it does', () => {
    for (const id of RELIC_IDS) {
      const text = STRINGS.gauntlet.relics[id];
      expect(text.name.length, id).toBeGreaterThan(0);
      expect(text.name.length, id).toBeLessThanOrEqual(26);
      expect(text.short).toMatch(/^[A-Z]+$/);
      expect(text.note.length, id).toBeGreaterThan(10);
    }
    expect(new Set(RELIC_IDS.map((id) => STRINGS.gauntlet.relics[id].short)).size).toBe(RELIC_IDS.length);
    // All six held are still said on two small lines.
    expect(RELIC_IDS.map((id) => STRINGS.gauntlet.relics[id].short).join('  ').length).toBeLessThanOrEqual(72);
  });

  test('Redline Core: the frame has Second Wind, and its meter goes from floor to floor, through a warden\'s service too', () => {
    expect(runOverdrive(fresh())).toBeUndefined();
    const run = withRelics(fresh(5, 2), 'redline');
    expect(runOverdrive(run)).toBe('second-wind');
    const entered = enter(run, 0, BG);
    const end = win(entered);
    const meter = end.units[0].drive;
    expect(end.units[0].overdrive).toBe('second-wind');
    expect(meter).toBeGreaterThan(0);
    const next = descend(entered, end);
    expect(next.carry!.drive).toBe(meter);
    const m = mission(next);
    const start = startMissionBattle(next.build, m, 0, ALL_ENEMIES, CATALOG, 1, undefined, { enemyScale: m.scale, carry: next.carry ?? undefined, overdrive: runOverdrive(next) });
    expect(start.units[0].drive).toBe(meter);
    // A warden's service makes the mech whole and leaves the meter where it was.
    const before = enter(withRelics(fresh(5, 5), 'redline'), 0, BG);
    const fought = win(before, 0);
    fought.units[0].drive = 64;
    const served = descend(before, fought);
    expect(served.carry).toEqual({ ap: {}, heat: 0, ammo: {}, restocked: {}, destroyed: false, drive: 64 });
    expect(wear(served, CATALOG)).toBe(0);
    // Without the relic there is no meter to carry, and the service leaves nothing.
    const plain = enter(fresh(5, 5), 0, BG);
    expect(descend(plain, win(plain)).carry).toBeNull();
  });

  test('Salvage Rig: twice as much of what is missing is patched between floors', () => {
    expect(RIG_PATCH).toBe(GAUNTLET_PATCH * 2);
    const run = enter(fresh(5, 2), 0, BG);
    const end = win(run);
    end.units[0].parts.core!.ap = Math.round(end.units[0].parts.core!.maxAp * 0.5);
    const { ap, maxAp } = end.units[0].parts.core!;
    expect(descend(run, end).carry!.ap.core).toBe(ap + Math.round((maxAp - ap) * GAUNTLET_PATCH));
    expect(descend(withRelics(run, 'rig'), end).carry!.ap.core).toBe(ap + Math.round((maxAp - ap) * RIG_PATCH));
  });

  test('Quartermaster Key: one more on offer after every floor, and one more again after an elite', () => {
    const base: Run = { ...fresh(5, 7), drafting: true };
    expect(draftSize(base)).toBe(3);
    expect(draftSize(withRelics(base, 'key'))).toBe(4);
    expect(draftSize({ ...withRelics(base, 'key'), elite: true })).toBe(5);
    const offers = draft({ ...withRelics(base, 'key'), elite: true }, CATALOG);
    expect(offers).toHaveLength(5);
    expect(new Set(offers.map((o) => JSON.stringify(o))).size).toBe(5);
  });

  test('Spare Core: a floor lost is stood before again in a whole mech, once', () => {
    const worn: Run = { ...enter(withRelics(fresh(5, 7), 'rig', 'spare'), 1, BG), carry: { ap: { core: 5 }, heat: 40, ammo: {}, restocked: {}, destroyed: false } };
    const again = fall(worn)!;
    expect(again).toMatchObject({ floor: 7, carry: null, fighting: false, revived: true, relics: ['rig'], drafting: false, elite: false });
    expect(again.door).toBeUndefined();
    // Spent: the next loss ends the run.
    expect(fall(again)).toBeNull();
    expect(fall(enter(fresh(5, 7), 0, BG))).toBeNull();
    // Entering the floor again takes the notice down.
    expect(enter(again, 0, BG).revived).toBe(false);
    // It may be offered again once it is spent.
    expect(hasRelic(again, 'spare')).toBe(false);
  });

  test('Glass Cannon: three tenths more damage, armour thinner by fifteen in a hundred of the plain armour, with plating or without', () => {
    expect(runMods(withRelics(fresh(), 'cannon'))).toEqual({ damage: CANNON.damage, armour: CANNON.armour });
    expect(runMods({ ...withRelics(fresh(), 'cannon'), boons: { plating: 3 } })).toEqual({ damage: 1.3, armour: 0.09 });
    expect(runMods({ ...fresh(), boons: { plating: 3 } })).toEqual({ armour: 0.24 });
    const run = withRelics(fresh(5, 2), 'cannon');
    const m = mission(run);
    const start = (r: Run) => startMissionBattle(r.build, m, 0, ALL_ENEMIES, CATALOG, 1, undefined, { enemyScale: m.scale, mods: runMods(r) });
    const [thin, plain] = [start(run).units[0], start(fresh(5, 2)).units[0]];
    expect(thin.parts.core!.maxAp).toBe(Math.round(plain.parts.core!.maxAp * 0.85));
    expect(thin.mods.damage).toBe(1.3);
    // A whole mech is a whole mech, however thin.
    expect(wear({ ...run, carry: { ap: { core: thin.parts.core!.maxAp }, heat: 0, ammo: {}, restocked: {}, destroyed: false } }, CATALOG)).toBe(0);
  });

  test('Hazard Pay: the run pays half as much again', () => {
    expect(LEDGER_PAY).toBe(1.5);
    expect(runPayout(fresh(5, 8))).toBe(payout(7));
    expect(runPayout(withRelics(fresh(5, 8), 'ledger'))).toBe(Math.round(payout(7) * 1.5));
    expect(runPayout(withRelics(fresh(5, 1), 'ledger'))).toBe(0);
  });
});

describe('a run with doors and relics, kept in a save', () => {
  const run: Run = { ...fresh(5, 7), relics: ['rig', 'redline'], carry: { ap: { core: 50 }, heat: 0, ammo: {}, restocked: {}, destroyed: false, drive: 40 } };

  test('is flown on when it is sound', () => {
    const sound: Run[] = [
      run, { ...run, door: 1, fighting: true, elite: true }, { ...run, drafting: true, relicOwed: true }, { ...run, revived: true }, { ...run, relics: [] },
      { ...run, carry: { ...run.carry!, drive: DRIVE_MAX } },
    ];
    for (const value of sound) expect(isValidRun(JSON.parse(JSON.stringify(value)), CATALOG), JSON.stringify(value).slice(0, 120)).toBe(true);
  });

  test('is refused when anything about it is not', () => {
    const bad: unknown[] = [
      { ...run, door: 2 }, { ...run, door: -1 }, { ...run, door: 'left' }, { ...run, relics: ['rig', 'rig'] }, { ...run, relics: ['crown'] }, { ...run, relics: 'rig' },
      { ...run, relicOwed: 'yes' }, { ...run, elite: 1 }, { ...run, revived: 0 }, { ...run, relicOwed: true, drafting: false },
      { ...run, carry: { ...run.carry, drive: 101 } }, { ...run, carry: { ...run.carry, drive: -1 } }, { ...run, carry: { ...run.carry, drive: 'full' } },
    ];
    for (const value of bad) expect(isValidRun(value, CATALOG), JSON.stringify(value).slice(0, 120)).toBe(false);
  });
});
