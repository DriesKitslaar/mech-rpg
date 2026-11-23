import {
  ARCHETYPES, LANCER_WEAPONS, QUICK_LEGS, SLOW_LEGS, archetypeOf, kindsWon, mostWonAs, recordWinAs, wonAs, type Archetype,
} from '../../src/core/archetype';
import { isValidState, newGame, type GameState } from '../../src/core/game';
import { startNewCycle } from '../../src/core/campaign';
import type { Build, Catalog, FramePart, Part, Weapon } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, DEMO_BUILD, SHOP_PARTS, STARTER_BUILD } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';
import { STARTERS } from '../../src/content/starters';
import { done } from '../helpers/app';

/**
 * What kind of machine a build is. The rules are few and asked in order; only the weapons, a
 * shield and the legs are asked about; and the pilot's record keeps what was won as each kind.
 */

const kind = (build: Build, catalog: Catalog = CATALOG): Archetype => archetypeOf(build, catalog);
/** The Hauler with nothing in its hands: what is put there is what the test is about. */
const BARE: Build = { head: 'head-scout-mk1', core: 'core-hauler', arms: 'arms-rigger', legs: 'legs-strider', generator: 'gen-kd1', booster: 'bst-stock', fcs: 'fcs-stock' };
const armed = (weapons: Pick<Build, 'rightHand' | 'leftHand' | 'shoulder'>, rest: Partial<Build> = {}): Build => ({ ...BARE, ...rest, ...weapons });
const weapons = SHOP_PARTS.filter((part): part is Weapon => part.kind === 'weapon');
const legs = SHOP_PARTS.filter((part): part is FramePart => part.kind === 'legs');

describe('the kinds there are', () => {
  test('are seven, in the order the rules are asked: what a machine fights with first, then how it stands, then anything else', () => {
    expect([...ARCHETYPES]).toEqual(['duellist', 'marksman', 'artillery', 'lancer', 'bastion', 'skirmisher', 'allrounder']);
    expect([QUICK_LEGS, SLOW_LEGS, LANCER_WEAPONS]).toEqual([40, 18, 2]);
  });
});

describe('what a machine fights with', () => {
  test('a blade in either hand makes a duellist, whatever else it carries and whatever it stands on', () => {
    const blades = weapons.filter((weapon) => weapon.melee).map((weapon) => weapon.id);
    expect(blades.sort()).toEqual(['wpn-arc-blade', 'wpn-breach-pick', 'wpn-gavel', 'wpn-headsman', 'wpn-ram-fist', 'wpn-thermal-cutter']);
    for (const blade of blades) {
      expect(kind(armed({ rightHand: blade })), blade).toBe('duellist');
      expect(kind(armed({ leftHand: blade, rightHand: 'wpn-rivet-rifle' })), blade).toBe('duellist');
    }
    // With a weapon that charges, a salvo, a shield in mind or the slowest legs there are: the blade is asked about first.
    expect(kind(armed({ rightHand: 'wpn-arc-blade', leftHand: 'wpn-longbow' }))).toBe('duellist');
    expect(kind(armed({ rightHand: 'wpn-arc-blade', shoulder: 'wpn-hornet-salvo' }))).toBe('duellist');
    expect(kind(armed({ rightHand: 'wpn-arc-blade', leftHand: 'shd-tower' }, { legs: 'legs-crawler' }))).toBe('duellist');
    expect(kind(armed({ rightHand: 'wpn-arc-blade', leftHand: 'wpn-thermal-cutter' }))).toBe('duellist');
  });

  test('a weapon that has to charge makes a marksman, in a hand or on the shoulder', () => {
    const charged = weapons.filter((weapon) => weapon.charge).map((weapon) => weapon.id);
    expect(charged.sort()).toEqual(['wpn-coil-pistol', 'wpn-decree', 'wpn-gauss', 'wpn-longbow', 'wpn-sunlance']);
    for (const id of charged) {
      const slot = (CATALOG[id] as Weapon).mount === 'shoulder' ? 'shoulder' : 'rightHand';
      expect(kind(armed({ [slot]: id })), id).toBe('marksman');
    }
    // Before a salvo, before energy alone, before a shield and before the legs.
    expect(kind(armed({ rightHand: 'wpn-longbow', shoulder: 'wpn-hornet-salvo' }))).toBe('marksman');
    expect(kind(armed({ rightHand: 'wpn-pulse-carbine', shoulder: 'wpn-sunlance' }))).toBe('marksman');
    expect(kind(armed({ rightHand: 'wpn-coil-pistol', leftHand: 'shd-riot' }, { legs: 'legs-bulwark' }))).toBe('marksman');
    expect(kind(armed({ rightHand: 'wpn-longbow' }, { legs: 'legs-wraith' }))).toBe('marksman');
  });

  test('a salvo makes artillery', () => {
    const salvos = weapons.filter((weapon) => weapon.trait === 'salvo').map((weapon) => weapon.id);
    expect(salvos.sort()).toEqual(['wpn-hornet-salvo', 'wpn-micro-salvo', 'wpn-storm-array']);
    // Every salvo there is goes on the shoulder.
    expect(salvos.every((id) => (CATALOG[id] as Weapon).mount === 'shoulder')).toBe(true);
    for (const id of salvos) expect(kind(armed({ rightHand: 'wpn-rivet-rifle', shoulder: id })), id).toBe('artillery');
    // The salvo that is an energy weapon, beside energy weapons: still artillery. And on tracks, or behind a shield.
    expect(kind(armed({ rightHand: 'wpn-pulse-carbine', leftHand: 'wpn-arc-pistol', shoulder: 'wpn-storm-array' }))).toBe('artillery');
    expect(kind(armed({ rightHand: 'wpn-frag-launcher', leftHand: 'shd-plate', shoulder: 'wpn-micro-salvo' }, { legs: 'legs-crawler' }))).toBe('artillery');
    // Other fire from the shoulder is not a salvo: a mortar, a cannon, a rack.
    for (const id of ['wpn-mortar-pod', 'wpn-siege-cannon', 'wpn-swarm-rack', 'wpn-breaker-cannon']) {
      expect(kind(armed({ rightHand: 'wpn-rivet-rifle', shoulder: id })), id).toBe('allrounder');
    }
  });

  test('two weapons or more, every one of them an energy weapon, make a lancer; one alone, or one gun among them that is not, does not', () => {
    expect(kind(armed({ rightHand: 'wpn-pulse-carbine', leftHand: 'wpn-arc-pistol' }))).toBe('lancer');
    expect(kind(armed({ rightHand: 'wpn-lance-emitter', shoulder: 'wpn-halo-array' }))).toBe('lancer');
    expect(kind(armed({ rightHand: 'wpn-lance-emitter', leftHand: 'wpn-plasma', shoulder: 'wpn-null-beam' }))).toBe('lancer');
    // Whatever it stands on.
    expect(kind(armed({ rightHand: 'wpn-lance-emitter', shoulder: 'wpn-null-beam' }, { legs: 'legs-colossus' }))).toBe('lancer');
    expect(kind(armed({ rightHand: 'wpn-pulse-carbine', leftHand: 'wpn-arc-pistol' }, { legs: 'legs-wraith' }))).toBe('lancer');
    // One energy weapon is a sidearm: the Courier as it comes is no lancer.
    expect(kind(armed({ rightHand: 'wpn-arc-pistol' }))).toBe('allrounder');
    expect(kind(armed({ rightHand: 'wpn-pulse-carbine', leftHand: 'wpn-rivet-rifle' }))).toBe('allrounder');
    expect(kind(armed({ rightHand: 'wpn-pulse-carbine', leftHand: 'wpn-arc-pistol', shoulder: 'wpn-mortar-pod' }))).toBe('allrounder');
    // A shield is no weapon: one emitter behind a shield is a bastion with a sidearm.
    expect(kind(armed({ rightHand: 'wpn-lance-emitter', leftHand: 'shd-riot' }))).toBe('bastion');
    expect(kind(armed({ rightHand: 'wpn-lance-emitter', leftHand: 'shd-riot', shoulder: 'wpn-halo-array' }))).toBe('lancer');
  });
});

describe('how a machine stands, when what it fights with says nothing', () => {
  test('a shield in the left hand makes a bastion, on any legs', () => {
    const shields = SHOP_PARTS.filter((part) => part.kind === 'shield').map((part) => part.id);
    expect(shields.sort()).toEqual(['shd-barrier', 'shd-plate', 'shd-riot', 'shd-tower']);
    for (const shield of shields) {
      expect(kind(armed({ rightHand: 'wpn-rivet-rifle', leftHand: shield })), shield).toBe('bastion');
      expect(kind(armed({ rightHand: 'wpn-rivet-rifle', leftHand: shield }, { legs: 'legs-wraith' })), shield).toBe('bastion');
    }
  });

  test('the slowest legs make a bastion and the quickest a skirmisher: the legs as they are sold, at eighteen or less and at forty or more', () => {
    const by = (name: Archetype): string[] => legs.filter((part) => kind(armed({ rightHand: 'wpn-rivet-rifle' }, { legs: part.id })) === name).map((part) => part.id).sort();
    expect(by('bastion')).toEqual(['legs-bulwark', 'legs-colossus', 'legs-crawler', 'legs-dozer']);
    expect(by('skirmisher')).toEqual(['legs-courier', 'legs-glide', 'legs-halo', 'legs-mantis', 'legs-shrike', 'legs-solstice', 'legs-sterling', 'legs-wraith']);
    expect(by('allrounder')).toEqual(['legs-auditor', 'legs-ronin', 'legs-sirocco', 'legs-sovereign', 'legs-spider', 'legs-strider']);
    // The edges are the Dozer's legs and the Courier's, and a point either side of each is another kind.
    expect([(CATALOG['legs-dozer'] as FramePart).mobility, (CATALOG['legs-courier'] as FramePart).mobility]).toEqual([SLOW_LEGS, QUICK_LEGS]);
    const withLegs = (mobility: number): Archetype => {
      const made: Catalog = { ...CATALOG, 'legs-t': { ...(CATALOG['legs-strider'] as FramePart), id: 'legs-t', mobility } };
      return kind(armed({ rightHand: 'wpn-rivet-rifle' }, { legs: 'legs-t' }), made);
    };
    expect([18, 19, 39, 40].map(withLegs)).toEqual(['bastion', 'allrounder', 'allrounder', 'skirmisher']);
  });

  test('it is the legs and not the load: a skirmisher that carries all its legs will bear is a skirmisher still', () => {
    const light = armed({ rightHand: 'wpn-rivet-rifle' }, { legs: 'legs-mantis' });
    const laden = armed({ rightHand: 'wpn-rail-lance', leftHand: 'wpn-scatter-gun', shoulder: 'wpn-siege-cannon' }, { legs: 'legs-mantis', core: 'core-colossus' });
    expect([kind(light), kind(laden)]).toEqual(['skirmisher', 'skirmisher']);
  });

  test('anything else is an all-rounder', () => {
    expect(kind(STARTER_BUILD)).toBe('allrounder');
    expect(kind(DEMO_BUILD)).toBe('allrounder');
    expect(kind(armed({}))).toBe('allrounder');
  });
});

describe('a part of no consequence', () => {
  const samples: Build[] = [
    ...Object.values(REFERENCE_BUILDS), ...STARTERS.map((starter) => starter.build),
    armed({ rightHand: 'wpn-pulse-carbine', leftHand: 'wpn-arc-pistol' }), armed({ rightHand: 'wpn-longbow' }), armed({ rightHand: 'wpn-rivet-rifle', shoulder: 'wpn-micro-salvo' }),
  ];
  const swappable: [keyof Build, Part['kind']][] = [['head', 'head'], ['core', 'core'], ['arms', 'arms'], ['generator', 'generator'], ['booster', 'booster'], ['fcs', 'fcs'], ['module', 'module']];

  test('does not change what a machine is called: any head, core, arms, generator, booster, fire control or module in place of the one fitted', () => {
    for (const build of samples) {
      const name = kind(build);
      for (const [slot, part] of swappable) {
        for (const other of SHOP_PARTS.filter((p) => p.kind === part)) expect(kind({ ...build, [slot]: other.id }), `${name}: ${String(slot)} ${other.id}`).toBe(name);
        // And taken out altogether, where it can be.
        if (slot === 'module') expect(kind({ ...build, module: undefined }), `${name}: no module`).toBe(name);
      }
    }
  });

  test('nor does a weapon swapped for another of the same sort: a gun for a gun, a blade for a blade', () => {
    const guns = weapons.filter((w) => w.mount === 'hand' && !w.melee && !w.charge && w.damageType !== 'energy').map((w) => w.id);
    for (const gun of guns) expect(kind({ ...DEMO_BUILD, rightHand: gun }), gun).toBe('allrounder');
    for (const gun of guns) expect(kind({ ...REFERENCE_BUILDS.tier5, rightHand: gun }), gun).toBe('duellist');
  });
});

describe('the machines the game knows', () => {
  test('the builds a pilot is measured in are an all-rounder to begin with, a bastion in heavy plate, a duellist on the ladder and a bastion at the top of it', () => {
    expect(Object.fromEntries(Object.entries(REFERENCE_BUILDS).map(([name, build]) => [name, kind(build)]))).toEqual({
      starter: 'allrounder', tier1: 'allrounder', tier2: 'allrounder', tier3: 'bastion', tier4: 'allrounder', tier5: 'duellist', tier6: 'bastion',
    });
  });

  test('the three frames on the lot are three kinds as they come: an all-rounder, a skirmisher and a bastion', () => {
    expect(STARTERS.map((starter) => [starter.id, kind(starter.build)])).toEqual([['hauler', 'allrounder'], ['courier', 'skirmisher'], ['dozer', 'bastion']]);
  });

  test('both swords of the Coast Circuit are duellists, and a build that lacks legs or anything in its hands is called something all the same', () => {
    expect([kind(ENEMIES.larder.build), kind(ENEMIES.argent.build)]).toEqual(['duellist', 'duellist']);
    for (const def of Object.values(ENEMIES)) expect(ARCHETYPES, def.id).toContain(kind(def.build));
    // A turret has no legs: it is not slow legs that make it what it is.
    expect(kind({ core: 'core-hauler', generator: 'gen-kd1' })).toBe('allrounder');
    // A part the catalogue does not know is no part: nothing is read from it.
    expect(kind({ ...BARE, legs: 'legs-of-no-such-make', rightHand: 'constructor' })).toBe('allrounder');
  });
});

describe('the record of what was won as each kind', () => {
  const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);

  test('a new pilot has won nothing as anything', () => {
    const game = fresh();
    expect(game.wonAs).toBeUndefined();
    for (const name of ARCHETYPES) expect(wonAs(game, name)).toBe(0);
    expect([kindsWon(game), mostWonAs(game)]).toEqual([0, 0]);
  });

  test('a win is written down against the kind it was won as, and against no other', () => {
    let game = recordWinAs(fresh(), 'duellist');
    expect(game.wonAs).toEqual({ duellist: 1 });
    game = recordWinAs(recordWinAs(game, 'duellist'), 'bastion');
    expect(game.wonAs).toEqual({ duellist: 2, bastion: 1 });
    expect(ARCHETYPES.map((name) => wonAs(game, name))).toEqual([2, 0, 0, 0, 1, 0, 0]);
    // The game it was written into is not the game it was read from.
    const before = fresh();
    recordWinAs(before, 'lancer');
    expect(before.wonAs).toBeUndefined();
  });

  test('how many kinds have been won as, at least so many times each, and the most won as any one', () => {
    let game = fresh();
    for (const [name, times] of [['duellist', 5], ['bastion', 4], ['lancer', 1]] as [Archetype, number][]) {
      for (let i = 0; i < times; i++) game = recordWinAs(game, name);
    }
    expect([kindsWon(game), kindsWon(game, 1), kindsWon(game, 4), kindsWon(game, 5), kindsWon(game, 6)]).toEqual([3, 3, 2, 1, 0]);
    expect(mostWonAs(game)).toBe(5);
  });

  test('it is saved with the game, kept when the story starts over, and a game from before the kinds had names loads as it was', () => {
    const game = recordWinAs(recordWinAs(fresh(), 'marksman'), 'marksman');
    expect(isValidState(JSON.parse(JSON.stringify(game)), CATALOG)).toBe(true);
    expect(isValidState(JSON.parse(JSON.stringify(fresh())), CATALOG)).toBe(true);
    const story = MISSIONS.filter((m) => m.phase !== 'side' && m.phase !== 'patrol' && (!m.faction || m.faction === 'lumen') && m.id !== 'verdict-default' && m.id !== 'verdict-quorum').map((m) => m.id);
    const again = startNewCycle({ ...done(...story), wonAs: { marksman: 2 } }, MISSIONS);
    expect(again.cycle).toBe(1);
    expect(again.wonAs).toEqual({ marksman: 2 });
  });

  test('what is read from storage is checked: counts are whole and not negative, names are plain, and a kind a later version might add is kept and not counted', () => {
    const stored = (value: unknown) => isValidState({ ...JSON.parse(JSON.stringify(fresh())), wonAs: value }, CATALOG);
    expect(stored({ duellist: 3, bastion: 0 })).toBe(true);
    expect(stored({})).toBe(true);
    for (const bad of [{ duellist: -1 }, { duellist: 1.5 }, { duellist: '3' }, { duellist: null }, { duellist: 1_000_001 }, { 'Duellist!': 1 }, { '': 1 }, [1, 2], 'duellist', 7, null]) {
      expect(stored(bad), JSON.stringify(bad)).toBe(false);
    }
    // No more names than a save has any use for: thirty-two are read, thirty-three are not.
    const many = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`kind${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}`, 1]));
    expect(Object.keys(many(33))).toHaveLength(33);
    expect([stored(many(32)), stored(many(33))]).toEqual([true, false]);
    expect(stored({ [`${'a'.repeat(24)}`]: 1 })).toBe(true);
    expect(stored({ [`${'a'.repeat(25)}`]: 1 })).toBe(false);
    const later = { ...fresh(), wonAs: { duellist: 2, sapper: 9 } } as unknown as GameState;
    expect(isValidState(JSON.parse(JSON.stringify(later)), CATALOG)).toBe(true);
    expect([wonAs(later, 'duellist'), kindsWon(later), mostWonAs(later)]).toEqual([2, 1, 2]);
    // A count that is not one reads as none, wherever it came from.
    const odd = { wonAs: { duellist: -4, bastion: 2.5, lancer: Number.NaN } } as unknown as GameState;
    expect(ARCHETYPES.map((name) => wonAs(odd, name))).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(wonAs({ wonAs: Object.create({ duellist: 5 }) } as GameState, 'duellist')).toBe(0);
  });
});
