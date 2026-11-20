import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { MARKS, type BattleState, type Carry } from '../../src/core/battle';
import { Dice, ENEMY_COST, HARMLESS, ROOTED, generateBoard, marksFor, rollEnemies } from '../../src/core/board';
import {
  BOON_CAP, BOON_IDS, ELITE_CHANCE, ELITE_FROM, RELIC_IDS, descend, doors, draft, draftSize, enter, fall, floorBudget, floorMission, isValidRun, isWardenFloor,
  runMods, runOverdrive, startRun, take, type Offer, type Run,
} from '../../src/core/gauntlet';
import { isValidState, newGame } from '../../src/core/game';
import { awardMedals, medalProgress } from '../../src/core/medals';
import { startMissionBattle } from '../../src/core/mission';
import { ALL_ENEMIES } from '../../src/content/arena';
import { BOARD_TEXT } from '../../src/content/board';
import { ENEMIES } from '../../src/content/enemies';
import { GAUNTLET_TEXT } from '../../src/content/gauntlet';
import { MEDALS } from '../../src/content/medals';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';

const BG = GAUNTLET_TEXT.backgrounds;
const names = Object.fromEntries(Object.values(ALL_ENEMIES).map((e) => [e.id, e.name]));
const fresh = (seed = 5, floor = 1): Run => ({ ...startRun(seed, STARTER_BUILD), floor });
const worn = (drive?: number): Carry => ({ ap: { core: 40, legs: 30 }, heat: 0, ammo: {}, restocked: {}, destroyed: false, ...(drive ? { drive } : {}) });
const whole = (drive: number): Carry => ({ ap: {}, heat: 0, ammo: {}, restocked: {}, destroyed: false, drive });
const said = (offer: Offer): string => JSON.stringify(offer);

/** The floor won in a frame that cannot lose. */
function win(run: Run): BattleState {
  const m = floorMission(run, GAUNTLET_TEXT, names);
  const od = runOverdrive(run);
  const start = startMissionBattle(run.build, m, 0, ALL_ENEMIES, CATALOG, run.seed + run.floor, undefined, {
    enemyScale: m.scale, mods: { ...runMods(run), armour: 30, energy: 400, aim: 60 }, carry: run.carry ?? undefined, ...(od ? { overdrive: od } : {}),
  });
  const end = runBattle(start, CATALOG, chooseAutoPlayerAction);
  expect(end.outcome).toBe('victory');
  return end;
}

describe('the Drive Core\'s meter', () => {
  const run: Run = { ...fresh(5, 7), relics: ['redline'], drafting: true, carry: worn(80) };

  test('is still there after a full service taken in the draft: the mech is whole, the meter where it was', () => {
    expect(draft(run, CATALOG)).toContainEqual({ kind: 'service' });
    const served = take(run, { kind: 'service' }, CATALOG);
    expect(served.carry).toEqual(whole(80));
    // Without a meter running a service leaves nothing to carry, as before.
    expect(take({ ...run, carry: worn() }, { kind: 'service' }, CATALOG).carry).toBeNull();
  });

  test('is still there after a part or a boon is taken', () => {
    // A worn mech is offered parts and the service; one that is whole, parts and a boon.
    const kinds = new Set<string>();
    for (const at of [run, { ...run, carry: whole(80) }]) {
      for (const offer of draft(at, CATALOG)) {
        kinds.add(offer.kind);
        expect(take(at, offer, CATALOG).carry!.drive, said(offer)).toBe(80);
      }
    }
    expect([...kinds].sort()).toEqual(['boon', 'part', 'service']);
  });

  test('is still there after the Spare Core: the floor is stood before again in a whole mech, with the meter it was entered with', () => {
    const entered = enter({ ...run, drafting: false, relics: ['redline', 'spare'] }, 0, BG);
    expect(fall(entered)!.carry).toEqual(whole(80));
    // No meter, nothing carried.
    expect(fall({ ...entered, carry: worn() })!.carry).toBeNull();
    expect(fall({ ...entered, carry: null })!.carry).toBeNull();
    // Nothing of the floor that was lost is left on the run: not its door, and not the elite that stood behind it.
    const lost = fall({ ...entered, elite: true })!;
    expect(lost).toMatchObject({ elite: false, fighting: false, revived: true });
    expect(lost.door).toBeUndefined();
  });
});

describe('the mark an elite carries', () => {
  test('is one that changes something about the machine: a machine that stands still is never swift, one that does no harm never overclocked', () => {
    expect(ROOTED.sort()).toEqual(['arc-pylon', 'gun-turret', 'jammer', 'lance-tower', 'mortar-nest']);
    expect(HARMLESS).toEqual(['jammer']);
    expect(marksFor('tank')).toEqual(MARKS);
    expect(marksFor('bomb-crawler')).toEqual(MARKS);
    expect(marksFor('gun-turret')).toEqual(MARKS.filter((mark) => mark !== 'swift'));
    expect(marksFor('jammer').sort()).toEqual(['armoured', 'shielded']);
  });

  test('the lists say what the machines are: no legs, and neither a weapon nor a charge', () => {
    for (const def of Object.values(ENEMIES)) {
      expect(ROOTED.includes(def.id), def.id).toBe(!def.build.legs);
      const armed = (['rightHand', 'leftHand', 'shoulder'] as const).some((slot) => CATALOG[def.build[slot] ?? '']?.kind === 'weapon');
      expect(HARMLESS.includes(def.id), def.id).toBe(!armed && !def.abilities?.bomb);
    }
    // Everything an open floor or an open contract can field is in the book.
    for (const id of Object.keys(ENEMY_COST)) expect(ENEMIES[id], id).toBeDefined();
  });

  test('behind the Gauntlet\'s doors every elite has a mark that applies, and the still machines are among them', () => {
    const still = new Set<string>();
    let elites = 0;
    for (let seed = 1; seed <= 400; seed++) {
      for (let floor = ELITE_FROM; floor <= 24; floor++) {
        if (isWardenFloor(floor)) continue;
        for (const door of doors(fresh(seed * 31, floor), BG)) {
          if (!door.elite) continue;
          elites += 1;
          const id = door.enemies[door.elite.at];
          expect(marksFor(id), `${id} ${door.elite.mark}`).toContain(door.elite.mark);
          if (ROOTED.includes(id)) still.add(id);
        }
      }
    }
    expect(elites).toBeGreaterThan(1000);
    // The case is met, not avoided: turrets and towers are elites too, with marks that count.
    expect(still.size).toBeGreaterThanOrEqual(3);
  });

  test('on the board likewise', () => {
    let elites = 0;
    for (let wins = 15; wins < 700; wins++) {
      const mission = generateBoard(wins, 0, BOARD_TEXT)[2];
      if (!mission.elite) continue;
      elites += 1;
      const battle = mission.battles[mission.battles.length - 1];
      const at = Number(Object.keys(battle.marks!)[0]);
      expect(marksFor(battle.enemies[at]), `${battle.enemies[at]} ${mission.elite}`).toContain(mission.elite);
    }
    expect(elites).toBeGreaterThan(200);
  });
});

describe('where elites are met', () => {
  test('from the third floor on, and behind two open floors in five', () => {
    expect(ELITE_FROM).toBe(3);
    expect(ELITE_CHANCE).toBe(0.4);
    const share = (floor: number): number => {
      let withElite = 0;
      for (let seed = 1; seed <= 1500; seed++) if (doors(fresh(seed * 31, floor), BG).some((door) => door.elite)) withElite += 1;
      return withElite / 1500;
    };
    expect(share(2)).toBe(0);
    // The third floor is the first with one, as often as any later floor.
    expect(share(3)).toBeGreaterThan(0.35);
    expect(share(3)).toBeLessThan(0.45);
    expect(share(9)).toBeGreaterThan(0.35);
    expect(share(9)).toBeLessThan(0.45);
  });

  test('the first door is the floor as it was before there were doors: the same machines, rolled the same way', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const floor of [1, 2, 3, 4, 6, 9, 13, 22]) {
        const run = fresh(seed * 17, floor);
        const before = rollEnemies(new Dice((Math.imul(run.seed, 31) + floor * 7919 + 104729) | 0), floorBudget(floor));
        expect(doors(run, BG)[0].enemies, `seed ${run.seed} floor ${floor}`).toEqual(before);
      }
    }
  });
});

describe('what is on offer after a floor', () => {
  const full = Object.fromEntries(BOON_IDS.map((id) => [id, BOON_CAP]));
  // Two frames near their limits, as play and a search turned them up: few mounts have anything left that fits.
  const played: Run = {
    ...startRun(254, { head: 'head-wraith', core: 'core-colossus', arms: 'arms-wraith', legs: 'legs-strider', generator: 'gen-kd1', booster: 'bst-stock', fcs: 'fcs-stock', rightHand: 'wpn-disruptor', leftHand: 'shd-barrier' }),
    floor: 32, boons: { ...full, optics: 4 }, relics: ['key'], drafting: true,
  };
  const searched: Run = {
    ...startRun(1, { head: 'head-wraith', core: 'core-halo', arms: 'arms-wraith', legs: 'legs-strider', generator: 'gen-kd1', booster: 'bst-phase', fcs: 'fcs-hawkeye', shoulder: 'wpn-decree', leftHand: 'wpn-gavel', module: 'mod-limiter' }),
    floor: 30, boons: full, relics: ['key'], drafting: true, elite: true,
  };

  test('is as much as is due even when the boons have run out and few mounts have anything that fits', () => {
    for (const run of [played, searched]) {
      expect(isValidRun(JSON.parse(JSON.stringify(run)), CATALOG)).toBe(true);
      const offers = draft(run, CATALOG);
      expect(offers).toHaveLength(draftSize(run));
      expect(new Set(offers.map(said)).size).toBe(offers.length);
      // Every one of them can be taken.
      for (const offer of offers) expect(take(run, offer, CATALOG).drafting).toBe(false);
    }
    expect(draftSize(played)).toBe(4);
    expect(draftSize(searched)).toBe(5);
  });

  test('two things for one mount only once every mount has had its turn, and a service for a whole mech only after that', () => {
    const offers = draft(searched, CATALOG);
    const parts = offers.flatMap((o) => (o.kind === 'part' ? [o.slot] : []));
    // The frame is whole, so the service is there to fill the list, and it comes last.
    expect(searched.carry).toBeNull();
    expect(parts.length).toBeGreaterThan(new Set(parts).size);
    expect(offers.findIndex((o) => o.kind === 'service')).toBe(offers.some((o) => o.kind === 'service') ? offers.length - 1 : -1);
    // A frame with room is still offered one thing to a mount, and no service it has no use for.
    for (let seed = 1; seed <= 60; seed++) {
      const roomy = draft({ ...fresh(seed, 12), drafting: true, boons: full, elite: true }, CATALOG);
      const slots = roomy.flatMap((o) => (o.kind === 'part' ? [o.slot] : []));
      expect(new Set(slots).size).toBe(slots.length);
      expect(roomy.some((o) => o.kind === 'service')).toBe(false);
    }
  });

  test('there is always something: when no part is left to offer and no boon, the service is, so the list is never empty', () => {
    const run: Run = { ...fresh(5, 12), drafting: true, boons: full };
    // A catalogue with nothing in it but what the frame already carries: there is no part to offer.
    const bare = Object.fromEntries(Object.values(run.build).map((id) => [id, CATALOG[id]]));
    expect(draft(run, bare)).toEqual([{ kind: 'service' }]);
    expect(take(run, { kind: 'service' }, bare)).toMatchObject({ drafting: false, carry: null });
    // One part in it and that part comes first; the service still fills the list after it, once.
    const part = draft(run, CATALOG).find((offer) => offer.kind === 'part')!;
    expect(part.kind).toBe('part');
    const one = { ...bare, ...(part.kind === 'part' ? { [part.part]: CATALOG[part.part] } : {}) };
    expect(draft(run, one)).toEqual([part, { kind: 'service' }]);
    // A worn mech is offered the service where it always was, and not a second time.
    const worn: Run = { ...run, carry: { ap: { core: 5 }, heat: 0, ammo: {}, restocked: {}, destroyed: false } };
    expect(draft(worn, one)).toEqual([part, { kind: 'service' }]);
    expect(draft(worn, bare)).toEqual([{ kind: 'service' }]);
  });
});

describe('a run kept in a save', () => {
  const run: Run = { ...fresh(5, 6), relics: ['rig'], drafting: true, relicOwed: true };
  const valid = (value: unknown): boolean => isValidRun(JSON.parse(JSON.stringify(value)), CATALOG);

  test('owes a relic only where a warden was just beaten and there is one left to take', () => {
    expect(valid(run)).toBe(true);
    expect(valid({ ...run, floor: 11 })).toBe(true);
    // Not on a floor no warden stood before, the first least of all.
    for (const floor of [1, 3, 5, 7, 10]) expect(valid({ ...run, floor }), `floor ${floor}`).toBe(false);
    // Not with every relic held: there would be nothing to choose, and no way on.
    expect(valid({ ...run, relics: [...RELIC_IDS] })).toBe(false);
    expect(valid({ ...run, relics: RELIC_IDS.slice(0, 5) })).toBe(true);
    // What play makes of a warden beaten is sound, with five relics held too.
    const entered = enter({ ...fresh(5, 5), relics: RELIC_IDS.slice(0, 5) }, 0, BG);
    const after = descend(entered, win(entered));
    expect(after.relicOwed).toBe(true);
    expect(valid(after)).toBe(true);
  });

  test('holds a door only while its floor is fought', () => {
    const open = fresh(5, 7);
    expect(valid({ ...open, door: 1, fighting: true })).toBe(true);
    expect(valid({ ...open, door: 1 })).toBe(false);
    expect(valid({ ...open, door: 0, fighting: false })).toBe(false);
    expect(valid({ ...open, door: 1, drafting: true })).toBe(false);
    // What play writes down on the way in and on the way out is sound.
    const entered = enter(open, 1, BG);
    expect(valid(entered)).toBe(true);
    expect(valid(descend(entered, win(entered)))).toBe(true);
  });
});

describe('the Gauntlet\'s medals for elites and relics', () => {
  const game = newGame(CATALOG, STARTER_BUILD);
  const held = (extra: object): string[] => awardMedals({ ...game, ...extra }, MEDALS).game.medals.filter((id) => id.startsWith('elite') || id.startsWith('relics'));
  const medal = (id: string) => MEDALS.find((m) => m.id === id)!;

  test('one elite earns the first, ten the second, and nine do not', () => {
    expect(held({})).toEqual([]);
    expect(held({ elites: 1 })).toEqual(['elite']);
    expect(held({ elites: 9 })).toEqual(['elite']);
    expect(held({ elites: 10 })).toEqual(['elite', 'elite-10']);
    expect(medalProgress(medal('elite-10'), { ...game, elites: 9 })).toEqual({ have: 9, need: 10, earned: false });
  });

  test('three relics held in one run earn theirs, and two do not', () => {
    expect(held({ relicsHeld: 2 })).toEqual([]);
    expect(held({ relicsHeld: 3 })).toEqual(['relics-3']);
    expect(medalProgress(medal('relics-3'), { ...game, relicsHeld: 2 })).toEqual({ have: 2, need: 3, earned: false });
  });

  test('a run under way that already holds three counts, though the save never wrote the most down', () => {
    const run = (relics: string[]) => ({ ...fresh(5, 7), relics });
    expect(held({ gauntlet: run(['rig', 'key']) })).toEqual([]);
    expect(held({ gauntlet: run(['rig', 'key', 'ledger']) })).toEqual(['relics-3']);
    // The most there ever was stands, whatever the run holds now.
    expect(medalProgress(medal('relics-3'), { ...game, relicsHeld: 2, gauntlet: run(['rig']) as never }).have).toBe(2);
    expect(medalProgress(medal('relics-3'), { ...game, relicsHeld: 1, gauntlet: run(['rig', 'key']) as never }).have).toBe(2);
  });
});

describe('the Gauntlet\'s counters, kept in a save', () => {
  const game = newGame(CATALOG, STARTER_BUILD);

  test('are whole numbers that play could reach, or the save is not taken at its word', () => {
    expect(isValidState({ ...game, elites: 0, relicsHeld: 0 }, CATALOG)).toBe(true);
    expect(isValidState({ ...game, elites: 250, relicsHeld: 6 }, CATALOG)).toBe(true);
    for (const bad of [-1, 1.5, '4', null, 1_000_001]) {
      expect(isValidState({ ...game, elites: bad }, CATALOG), `elites ${String(bad)}`).toBe(false);
    }
    for (const bad of [-1, 2.5, '3', null, 100]) {
      expect(isValidState({ ...game, relicsHeld: bad }, CATALOG), `relicsHeld ${String(bad)}`).toBe(false);
    }
    // A save from before there were elites or relics has neither, and is sound.
    expect(isValidState(game, CATALOG)).toBe(true);
    expect('elites' in game || 'relicsHeld' in game).toBe(false);
  });
});
