import { chooseAutoPlayerAction } from '../../src/core/ai';
import {
  DEADEYE_DAMAGE, DRIVE_GAIN, DRIVE_MAX, IRON_SKIN, STAGGER_ENERGY, activeUnit, applyAction, checkAction, createBattle, turnEnergyOf, turnSpent,
  type BattleState, type OverdriveId,
} from '../../src/core/battle';
import { isValidState, newGame } from '../../src/core/game';
import { awardMedals, medalProgress } from '../../src/core/medals';
import type { Build, EnemyDef } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { MEDALS } from '../../src/content/medals';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';

/** What the review of the Overdrive found that no test would have caught. */

const hit = () => 0;
const od = { type: 'overdrive' } as const;
const me = (s: BattleState) => s.units[0];
/** A battle on the pilot's turn. */
function start(build: Build, enemies: EnemyDef[], overdrive?: OverdriveId, drive?: number): BattleState {
  let s = createBattle(build, enemies, CATALOG, 4, { ...(overdrive ? { overdrive } : {}), ...(drive !== undefined ? { drive } : {}) });
  for (let i = 0; i < 8 && activeUnit(s).side !== 'player'; i++) s = applyAction(s, { type: 'endTurn' }, CATALOG);
  return s;
}
/** Ends turns until it is this unit's turn again. */
function until(s: BattleState, id: string): BattleState {
  s = applyAction(s, { type: 'endTurn' }, CATALOG);
  for (let i = 0; i < 12 && activeUnit(s).id !== id && s.outcome === 'ongoing'; i++) s = applyAction(s, { type: 'endTurn' }, CATALOG);
  return s;
}
const tank = ENEMIES.tank;
const drone = ENEMIES['recon-drone'];
const gunner = (weapon: string): EnemyDef => ({ id: 'test-gunner', name: 'Gunner', ai: 'gunner', sprite: 'none', build: { ...STARTER_BUILD, rightHand: weapon } });

describe('the figures are the ones the pilot is told', () => {
  test('a volley landed 8, one taken 10, a blast 10, a machine destroyed 15, out of a hundred', () => {
    expect(DRIVE_GAIN).toEqual({ landed: 8, taken: 10, blast: 10, kill: 15 });
    expect(DRIVE_MAX).toBe(100);
  });

  test('Iron Skin halves, Deadeye adds a quarter, and the second medal asks for fifty', () => {
    expect(IRON_SKIN).toBe(0.5);
    expect(DEADEYE_DAMAGE).toBe(1.25);
    const fifty = MEDALS.find((m) => m.id === 'overdrive-50')!;
    const game = newGame(CATALOG, STARTER_BUILD);
    expect(medalProgress(fifty, { ...game, overdrives: 49 })).toEqual({ have: 49, need: 50, earned: false });
    const held = (overdrives: number) => awardMedals({ ...game, overdrives }, MEDALS).game.medals.filter((id) => id.startsWith('overdrive'));
    expect(held(0)).toEqual([]);
    expect(held(1)).toEqual(['overdrive']);
    expect(held(49)).toEqual(['overdrive']);
    expect(held(50)).toEqual(['overdrive', 'overdrive-50']);
  });
});

describe('a volley counts once, however many shots are in it', () => {
  test.each([['wpn-needler', 'twin'], ['wpn-chain-gun', 'burst']])('%s (%s): several shots that all land fill the meter by 8, not by 8 a shot', (weapon) => {
    const s = start({ ...DEMO_BUILD, rightHand: weapon }, [tank], 'iron-skin');
    const after = applyAction(s, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' }, CATALOG, hit);
    expect(after.events.filter((e) => e.type === 'shot' && e.hit).length).toBeGreaterThan(1);
    expect(me(after).drive).toBe(DRIVE_GAIN.landed);
  });

  test('a salvo that lands on three machines is still one volley for the one who fired it', () => {
    const s = start({ ...DEMO_BUILD, shoulder: 'wpn-micro-salvo' }, [tank, tank, tank], 'iron-skin');
    const after = applyAction(s, { type: 'fire', weapon: 'shoulder', target: 'enemy-0', part: 'core' }, CATALOG, hit);
    expect(new Set(after.events.flatMap((e) => (e.type === 'shot' && e.hit ? [e.target] : []))).size).toBe(3);
    expect(me(after).drive).toBe(DRIVE_GAIN.landed);
  });

  test('a burst taken is one volley taken: 10, not 10 a shot', () => {
    let s = start(DEMO_BUILD, [gunner('wpn-chain-gun')], 'iron-skin');
    s = until(s, 'enemy-0');
    const before = me(s).drive;
    const after = applyAction(s, { type: 'fire', weapon: 'rightHand', target: 'player', part: 'core' }, CATALOG, hit);
    expect(after.events.filter((e) => e.type === 'shot' && e.hit).length).toBeGreaterThan(1);
    expect(me(after).drive).toBe(before + DRIVE_GAIN.taken);
  });

  test('a shock pulse that lands is a volley landed, and what it destroys counts', () => {
    const s = start({ ...DEMO_BUILD, module: 'mod-shock' }, [drone, drone], 'iron-skin');
    for (const unit of s.units.slice(1)) unit.parts.core!.ap = 1;
    const after = applyAction(s, { type: 'module' }, CATALOG);
    expect(after.units.slice(1).every((u) => u.destroyed)).toBe(true);
    expect(me(after).drive).toBe(DRIVE_GAIN.landed + 2 * DRIVE_GAIN.kill);
  });
});

describe('Iron Skin and a bomb', () => {
  test('the blast is halved like any other blow', () => {
    const blast = (skin: boolean): number => {
      let s = start(DEMO_BUILD, [ENEMIES['bomb-crawler']], 'iron-skin', 100);
      if (skin) s = applyAction(s, od, CATALOG);
      for (let i = 0; i < 40 && !s.events.some((e) => e.type === 'blast'); i++) {
        // The skin has to be up when the fuse runs out: it is put up again whenever the meter allows.
        if (skin && activeUnit(s).side === 'player' && !me(s).ironSkin) { me(s).drive = DRIVE_MAX; s = applyAction(s, od, CATALOG); }
        s = applyAction(s, { type: 'endTurn' }, CATALOG);
      }
      const event = s.events.find((e) => e.type === 'blast');
      return event?.type === 'blast' ? event.damage : -1;
    };
    const plain = blast(false);
    expect(plain).toBeGreaterThan(10);
    expect(blast(true)).toBe(Math.max(1, Math.round(plain * IRON_SKIN)));
  });
});

describe('Second Wind gives back the turn that was had', () => {
  const build: Build = { ...DEMO_BUILD, module: 'mod-coolant' };
  const fire = (s: BattleState, weapon: 'rightHand' | 'leftHand' | 'shoulder' = 'rightHand') =>
    applyAction(s, { type: 'fire', weapon, target: 'enemy-0', part: 'core' }, CATALOG, hit);

  test('with nothing of the turn spent it is refused, and the meter is kept', () => {
    const s = start(build, [tank], 'second-wind', 100);
    expect(turnSpent(me(s))).toBe(false);
    expect(checkAction(s, od, CATALOG)).toBe('nothingSpent');
    expect(() => applyAction(s, od, CATALOG)).toThrow('nothingSpent');
    // Any one thing spent is enough: a shot, a stance, a vent, the module.
    for (const action of [{ type: 'guard' }, { type: 'boost' }, { type: 'cool' }, { type: 'module' }] as const) {
      const spent = applyAction(s, action, CATALOG);
      expect(turnSpent(me(spent)), action.type).toBe(true);
      expect(checkAction(spent, od, CATALOG), action.type).toBeNull();
    }
    expect(checkAction(fire(s), od, CATALOG)).toBeNull();
    // The others have no such condition.
    expect(checkAction(start(build, [tank], 'iron-skin', 100), od, CATALOG)).toBeNull();
    expect(checkAction(start(build, [tank], 'deadeye', 100), od, CATALOG)).toBeNull();
  });

  test('the vent and the module can be used again; a guard that is still up stays the turn\'s one stance', () => {
    let s = start(build, [tank], 'second-wind', 100);
    s = applyAction(applyAction(applyAction(s, { type: 'guard' }, CATALOG), { type: 'cool' }, CATALOG), { type: 'module' }, CATALOG);
    expect(me(s)).toMatchObject({ usedGuard: true, usedCool: true, usedModule: true, guarding: true });
    s = applyAction(s, od, CATALOG);
    expect(me(s)).toMatchObject({ usedCool: false, usedModule: false, guarding: true, usedGuard: true, usedBoost: false });
    expect(checkAction(s, { type: 'cool' }, CATALOG)).toBeNull();
    expect(checkAction(s, { type: 'module' }, CATALOG)).toBeNull();
    // Guarding is not paid for twice, and is not joined by a boost.
    expect(checkAction(s, { type: 'guard' }, CATALOG)).toBe('alreadyUsed');
    expect(checkAction(s, { type: 'boost' }, CATALOG)).toBe('alreadyUsed');
  });

  test('a blade that has struck spent its boost: after Second Wind the pilot may boost again', () => {
    let s = start({ ...DEMO_BUILD, rightHand: 'wpn-breach-pick' }, [tank], 'second-wind', 100);
    s = applyAction(s, { type: 'boost' }, CATALOG);
    s = fire(s);
    expect(me(s)).toMatchObject({ boosted: false, usedBoost: true });
    s = applyAction(s, od, CATALOG);
    expect(me(s)).toMatchObject({ usedBoost: false, usedGuard: false });
    expect(checkAction(s, { type: 'boost' }, CATALOG)).toBeNull();
  });

  test('a staggered pilot gets a staggered turn back, not a whole one', () => {
    let s = start(build, [tank], 'second-wind', 100);
    me(s).staggered = 2;
    s = until(s, 'player');
    const full = turnEnergyOf(me(s), CATALOG);
    expect(me(s).energy).toBe(Math.floor(full * STAGGER_ENERGY));
    const began = me(s).energy;
    me(s).drive = DRIVE_MAX;
    s = applyAction(fire(s, 'leftHand'), od, CATALOG);
    expect(me(s).energy).toBe(began);
  });

  test('energy drained before the turn began is not given back', () => {
    let s = start(build, [tank], 'second-wind', 100);
    me(s).energyDebt = 60;
    s = until(s, 'player');
    const began = me(s).energy;
    expect(began).toBe(turnEnergyOf(me(s), CATALOG) - 60);
    me(s).drive = DRIVE_MAX;
    s = applyAction(fire(s), od, CATALOG);
    expect(me(s).energy).toBe(began);
  });

  test('it never takes energy away: what an Overclock added on top is kept', () => {
    let s = start({ ...DEMO_BUILD, module: 'mod-overclock' }, [tank], 'second-wind', 100);
    const began = me(s).energy;
    s = applyAction(s, { type: 'module' }, CATALOG);
    const boosted = me(s).energy;
    expect(boosted).toBeGreaterThan(began);
    s = applyAction(s, od, CATALOG);
    expect(me(s).energy).toBe(boosted);
  });

  test('heat that has tripped the limit stays tripped: the next turn is still lost', () => {
    let s = start(build, [tank], 'second-wind', 100);
    s = fire(s);
    me(s).overheated = true;
    const heat = me(s).heat;
    s = applyAction(s, od, CATALOG);
    expect(me(s)).toMatchObject({ overheated: true, heat });
  });
});

describe('the meter that is carried', () => {
  test('is kept within nought and a hundred, whatever is handed in', () => {
    const carry = (drive: number) => ({ ap: {}, heat: 0, ammo: {}, restocked: {}, destroyed: false, drive });
    const at = (drive: number) => createBattle(DEMO_BUILD, [tank], CATALOG, 1, { overdrive: 'deadeye', carry: carry(drive) }).units[0].drive;
    expect([at(64), at(500), at(-5)]).toEqual([64, DRIVE_MAX, 0]);
    expect(createBattle(DEMO_BUILD, [tank], CATALOG, 1, { carry: carry(64) }).units[0].drive).toBe(0);
  });
});

describe('the automatic pilot spends it where it does most', () => {
  /** What Auto Turn does with one turn, action by action, and how many weapons had been fired when it set off the Overdrive. */
  function turn(s: BattleState): { seen: string[]; end: BattleState; firedAtOverdrive: number } {
    const seen: string[] = [];
    let firedAtOverdrive = -1;
    for (let i = 0; i < 40 && activeUnit(s).side === 'player' && s.outcome === 'ongoing'; i++) {
      const action = chooseAutoPlayerAction(s, CATALOG);
      if (action.type === 'overdrive') firedAtOverdrive = s.units[0].fired.length;
      seen.push(action.type);
      s = applyAction(s, action, CATALOG);
    }
    return { seen, end: s, firedAtOverdrive };
  }
  const fires = (seen: string[]) => seen.filter((a) => a === 'fire').length;

  test('Second Wind comes when the first half of the turn is fired empty: every weapon first, and more shots after', () => {
    const { seen, firedAtOverdrive } = turn(start(DEMO_BUILD, [tank, tank], 'second-wind', 100));
    const at = seen.indexOf('overdrive');
    expect(at).toBeGreaterThan(0);
    // All three weapons the frame carries had been fired, not one of them.
    expect(firedAtOverdrive).toBe(3);
    expect(fires(seen.slice(0, at))).toBe(3);
    expect(fires(seen.slice(at + 1))).toBeGreaterThanOrEqual(2);
    expect(seen.filter((a) => a === 'overdrive')).toHaveLength(1);
  });

  test('a vent that is still worth making is made first', () => {
    let s = start(DEMO_BUILD, [tank, tank], 'second-wind', 100);
    s = applyAction(s, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' }, CATALOG, hit);
    // Hot enough that the next thing Auto Turn wants is to vent.
    let found: BattleState | null = null;
    for (let heat = 40; heat <= 400 && !found; heat += 5) {
      const hot = structuredClone(s);
      hot.units[0].heat = heat;
      if (!hot.units[0].overheated && chooseAutoPlayerAction({ ...hot, units: hot.units.map((u, i) => (i === 0 ? { ...u, overdrive: undefined } : u)) }, CATALOG).type === 'cool') found = hot;
    }
    expect(found).not.toBeNull();
    expect(chooseAutoPlayerAction(found!, CATALOG).type).toBe('cool');
  });

  test('a weapon that was only charged has not been fired: no Second Wind on the strength of it', () => {
    const { seen } = turn(start({ ...DEMO_BUILD, rightHand: 'wpn-longbow', leftHand: undefined, shoulder: undefined } as Build, [tank], 'second-wind', 100));
    expect(seen).toContain('charge');
    expect(seen).not.toContain('overdrive');
  });

  test('Deadeye waits for a shot to be the next thing, and a turn that opens with a charge still gets it before the first shot', () => {
    // With a bomb about to go off the first thing is to brace: no Deadeye for that.
    const braced = start(DEMO_BUILD, [ENEMIES['bomb-crawler'], tank], 'deadeye', 100);
    braced.units[1].fuse = 1;
    expect(chooseAutoPlayerAction(braced, CATALOG).type).toBe('guard');
    // A charge opens the turn; with energy left for a shot, Deadeye goes off before that shot.
    let s = start({ ...DEMO_BUILD, shoulder: 'wpn-gauss' }, [tank], 'deadeye', 100);
    expect(chooseAutoPlayerAction(s, CATALOG).type).toBe('charge');
    s = applyAction(s, { type: 'charge', weapon: 'shoulder' }, CATALOG);
    s.units[0].energy = 200;
    expect(s.units[0].fired).toEqual(['shoulder']);
    expect(chooseAutoPlayerAction(s, CATALOG).type).toBe('overdrive');
    s = applyAction(s, od, CATALOG);
    expect(chooseAutoPlayerAction(s, CATALOG).type).toBe('fire');
    // Once a real shot has gone it is too late for this turn.
    s = applyAction(s, chooseAutoPlayerAction(s, CATALOG), CATALOG, hit);
    s.units[0].drive = DRIVE_MAX;
    expect(chooseAutoPlayerAction(s, CATALOG).type).not.toBe('overdrive');
  });

  test('Iron Skin goes up when the core is under three fifths, and not a moment before', () => {
    const at = (share: number) => {
      const s = start(DEMO_BUILD, [tank], 'iron-skin', 100);
      s.units[0].parts.core!.ap = Math.round(s.units[0].parts.core!.maxAp * share);
      return chooseAutoPlayerAction(s, CATALOG).type;
    };
    expect(at(0.59)).toBe('overdrive');
    expect(at(0.61)).not.toBe('overdrive');
    expect(at(0.85)).not.toBe('overdrive');
  });
});

describe('a save and its Overdrive', () => {
  const game = newGame(CATALOG, STARTER_BUILD);

  test('one the game has is accepted, anything else is not', () => {
    expect(isValidState({ ...game, overdrive: 'deadeye' }, CATALOG)).toBe(true);
    expect(isValidState({ ...game, overdrive: 'third-wind' }, CATALOG)).toBe(false);
    expect(isValidState({ ...game, overdrive: 3 }, CATALOG)).toBe(false);
  });

  test('the count of them is a whole number that play could reach', () => {
    expect(isValidState({ ...game, overdrives: 120 }, CATALOG)).toBe(true);
    for (const bad of [-1, 1.5, '4', 1_000_001]) expect(isValidState({ ...game, overdrives: bad }, CATALOG), String(bad)).toBe(false);
  });
});
