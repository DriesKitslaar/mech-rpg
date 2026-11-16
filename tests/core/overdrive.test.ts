import { chooseAutoPlayerAction } from '../../src/core/ai';
import {
  DEADEYE_DAMAGE, DRIVE_GAIN, DRIVE_MAX, IRON_SKIN, OVERDRIVES, activeUnit, applyAction, carryFrom, checkAction, createBattle, previewShot,
  type BattleState, type OverdriveId,
} from '../../src/core/battle';
import { intentOf } from '../../src/core/intent';
import { startMissionBattle } from '../../src/core/mission';
import { OVERDRIVE_LEVEL, fittedOverdrive, overdriveOpen, xpForLevel } from '../../src/core/pilot';
import { newGame } from '../../src/core/game';
import { ALL_ENEMIES } from '../../src/content/arena';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';

/** A battle on the pilot's turn. */
function start(overdrive?: OverdriveId, enemies = [ENEMIES.tank, ENEMIES['recon-drone']], drive?: number): BattleState {
  let s = createBattle(DEMO_BUILD, enemies, CATALOG, 4, { ...(overdrive ? { overdrive } : {}), ...(drive !== undefined ? { drive } : {}) });
  for (let i = 0; i < 6 && activeUnit(s).side !== 'player'; i++) s = applyAction(s, { type: 'endTurn' }, CATALOG);
  return s;
}
const me = (s: BattleState) => s.units[0];
const hit = () => 0;
const miss = () => 0.999;
const fire = (s: BattleState, weapon: 'rightHand' | 'leftHand' | 'shoulder', target = 'enemy-0', roll = hit) =>
  applyAction(s, { type: 'fire', weapon, target, part: 'core' }, CATALOG, roll);
const od = { type: 'overdrive' } as const;

describe('the meter', () => {
  test('a mech with no Overdrive has no meter: nothing fills it and there is nothing to set off', () => {
    const s = fire(start(), 'rightHand');
    expect(me(s).drive).toBe(0);
    expect(checkAction(s, od, CATALOG)).toBe('noOverdrive');
    expect(OVERDRIVES).toEqual(['second-wind', 'iron-skin', 'deadeye']);
  });

  test('fills by 8 for a volley that lands, however many shots are in it, and not at all for one that misses', () => {
    const s = start('second-wind');
    expect(me(s).drive).toBe(0);
    expect(me(fire(s, 'rightHand')).drive).toBe(DRIVE_GAIN.landed);
    expect(me(fire(s, 'rightHand', 'enemy-0', miss)).drive).toBe(0);
    const two = fire(fire(s, 'rightHand'), 'leftHand');
    expect(me(two).drive).toBe(2 * DRIVE_GAIN.landed);
  });

  test('fills by 15 more for a machine destroyed, by 10 for a volley taken and by 10 for a bomb\'s blast', () => {
    const s = start('second-wind');
    s.units[2].parts.core!.ap = 1;
    expect(me(fire(s, 'rightHand', 'enemy-1')).drive).toBe(DRIVE_GAIN.landed + DRIVE_GAIN.kill);
    // The enemy's turn: every volley that lands on the pilot adds ten.
    let t = applyAction(s, { type: 'endTurn' }, CATALOG);
    let landed = 0;
    for (let i = 0; i < 20 && activeUnit(t).side !== 'player' && t.outcome === 'ongoing'; i++) {
      const before = t.events.length;
      t = applyAction(t, { type: 'fire', weapon: 'shoulder', target: 'player', part: 'core' }, CATALOG, hit);
      if (t.events.slice(before).some((e) => e.type === 'shot' && e.hit)) landed += 1;
      if (activeUnit(t).side !== 'player') t = applyAction(t, { type: 'endTurn' }, CATALOG);
    }
    expect(landed).toBeGreaterThan(0);
    expect(me(t).drive).toBe(landed * DRIVE_GAIN.taken);
    let b = createBattle(DEMO_BUILD, [ENEMIES['bomb-crawler']], CATALOG, 3, { overdrive: 'iron-skin' });
    for (let i = 0; i < 40 && !b.events.some((e) => e.type === 'blast'); i++) b = applyAction(b, { type: 'endTurn' }, CATALOG);
    expect(me(b).drive).toBe(DRIVE_GAIN.blast);
  });

  test('stops at a hundred, and may be handed over full', () => {
    const s = start('deadeye', undefined, 96);
    expect(me(s).drive).toBe(96);
    expect(me(fire(s, 'rightHand')).drive).toBe(DRIVE_MAX);
    expect(me(start(undefined, undefined, 100)).drive).toBe(0);
    expect(me(start('deadeye', undefined, 500)).drive).toBe(DRIVE_MAX);
  });

  test('is carried through the battles of a contract by a mech that has an Overdrive, and by no other', () => {
    const mission = MISSIONS.find((m) => m.id === 'undertow-1')!;
    const first = startMissionBattle(DEMO_BUILD, mission, 0, ALL_ENEMIES, CATALOG, 3, undefined, { overdrive: 'second-wind' });
    first.units[0].drive = 64;
    expect(carryFrom(first).drive).toBe(64);
    const won = { ...first, outcome: 'victory' as const };
    expect(startMissionBattle(DEMO_BUILD, mission, 1, ALL_ENEMIES, CATALOG, 3, won, { overdrive: 'second-wind' }).units[0].drive).toBe(64);
    expect(startMissionBattle(DEMO_BUILD, mission, 1, ALL_ENEMIES, CATALOG, 3, won).units[0].drive).toBe(0);
    expect(carryFrom(startMissionBattle(DEMO_BUILD, mission, 0, ALL_ENEMIES, CATALOG, 3)).drive).toBeUndefined();
  });
});

describe('setting it off', () => {
  test('takes a full meter, costs nothing else, does not end the turn, and empties the meter', () => {
    expect(checkAction(start('second-wind', undefined, 99), od, CATALOG)).toBe('notCharged');
    const s = start('iron-skin', undefined, 100);
    expect(checkAction(s, od, CATALOG)).toBeNull();
    const after = applyAction(s, od, CATALOG);
    expect(me(after).drive).toBe(0);
    expect(activeUnit(after).id).toBe('player');
    expect(me(after).energy).toBe(me(s).energy);
    expect(after.events.at(-1)).toEqual({ type: 'overdrive', unit: 'player', kind: 'iron-skin' });
    expect(checkAction(after, od, CATALOG)).toBe('notCharged');
  });

  test('Second Wind starts the turn over: energy back, every weapon ready again, the heat still there', () => {
    let s = start('second-wind', undefined, 100);
    const energy = me(s).energy;
    s = fire(fire(s, 'rightHand'), 'leftHand');
    s = applyAction(s, { type: 'boost' }, CATALOG);
    const heat = me(s).heat;
    expect(me(s).energy).toBeLessThan(energy);
    expect(checkAction(s, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' }, CATALOG)).toBe('alreadyFired');
    s = applyAction(s, od, CATALOG);
    expect(me(s)).toMatchObject({ energy, fired: [], usedBoost: false, usedGuard: false, usedCool: false, heat });
    expect(checkAction(s, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' }, CATALOG)).toBeNull();
  });

  test('Iron Skin halves what the pilot takes, from guns and from bombs, and keeps the pilot on their feet, until their next turn', () => {
    const s = start('iron-skin', undefined, 100);
    const plain = previewShot(s, 'enemy-0', 'shoulder', 'player', 'core', CATALOG);
    let skin = applyAction(s, od, CATALOG);
    const less = previewShot(skin, 'enemy-0', 'shoulder', 'player', 'core', CATALOG);
    expect(less.damage).toBe(Math.max(1, Math.round(plain.damage * IRON_SKIN)));
    expect(less.hitChance).toBe(plain.hitChance);
    // What the pilot deals is as it was.
    expect(previewShot(skin, 'player', 'rightHand', 'enemy-0', 'core', CATALOG)).toEqual(previewShot(s, 'player', 'rightHand', 'enemy-0', 'core', CATALOG));
    // No stagger while it is up, however hard the push.
    skin.units[0].stagger = skin.units[0].staggerMax - 1;
    skin = applyAction(skin, { type: 'endTurn' }, CATALOG);
    for (let i = 0; i < 20 && activeUnit(skin).side !== 'player' && skin.outcome === 'ongoing'; i++) {
      skin = applyAction(skin, { type: 'fire', weapon: 'shoulder', target: 'player', part: 'core' }, CATALOG, hit);
      if (activeUnit(skin).side !== 'player') skin = applyAction(skin, { type: 'endTurn' }, CATALOG);
    }
    expect(skin.events.some((e) => e.type === 'stagger' && e.unit === 'player')).toBe(false);
    // It ends when the pilot's next turn begins.
    expect(activeUnit(skin).id).toBe('player');
    expect(me(skin).ironSkin).toBe(false);
  });

  test('Deadeye cannot miss and does a quarter more, until the turn ends', () => {
    const s = start('deadeye', undefined, 100);
    s.units[1].boosted = true;
    const plain = previewShot(s, 'player', 'rightHand', 'enemy-0', 'legs', CATALOG);
    expect(plain.hitChance).toBeLessThan(95);
    const sharp = applyAction(s, od, CATALOG);
    const sure = previewShot(sharp, 'player', 'rightHand', 'enemy-0', 'legs', CATALOG);
    expect(sure.hitChance).toBe(100);
    expect(sure.damage).toBe(Math.max(1, Math.round(plain.damage * DEADEYE_DAMAGE)));
    const shot = fire(sharp, 'rightHand', 'enemy-0', miss);
    expect(shot.events.filter((e) => e.type === 'shot').at(-1)).toMatchObject({ hit: true });
    let next = applyAction(shot, { type: 'endTurn' }, CATALOG);
    expect(me(next).deadeye).toBe(false);
    for (let i = 0; i < 10 && activeUnit(next).side !== 'player' && next.outcome === 'ongoing'; i++) next = applyAction(next, { type: 'endTurn' }, CATALOG);
    expect(previewShot(next, 'player', 'rightHand', 'enemy-0', 'legs', CATALOG).hitChance).toBeLessThan(100);
  });

  test('an enemy never has one, and what an enemy is read to be doing is not changed by the pilot\'s', () => {
    const s = start('iron-skin', undefined, 100);
    for (const unit of s.units.slice(1)) expect(unit.overdrive).toBeUndefined();
    expect(intentOf(applyAction(s, od, CATALOG), s.units[1], CATALOG)).toEqual(intentOf(start(), start().units[1], CATALOG));
  });
});

describe('who has which', () => {
  const at = (level: number) => ({ ...newGame(CATALOG, STARTER_BUILD), xp: xpForLevel(level) });

  test('they open at levels 3, 6 and 9; a pilot flies the one they chose, or the first that is open', () => {
    expect(OVERDRIVE_LEVEL).toEqual({ 'second-wind': 3, 'iron-skin': 6, deadeye: 9 });
    expect([2, 3, 6, 9].map((level) => OVERDRIVES.filter((id) => overdriveOpen(at(level), id)).length)).toEqual([0, 1, 2, 3]);
    expect(fittedOverdrive(at(2))).toBeUndefined();
    expect(fittedOverdrive(at(3))).toBe('second-wind');
    expect(fittedOverdrive({ ...at(9), overdrive: 'deadeye' })).toBe('deadeye');
    // A choice that is not open (a save from a higher level, edited down) falls back to what is.
    expect(fittedOverdrive({ ...at(4), overdrive: 'deadeye' })).toBe('second-wind');
  });
});

describe('the automatic pilot', () => {
  const choice = (s: BattleState) => chooseAutoPlayerAction(s, CATALOG).type;

  test('fires a turn empty before it takes its Second Wind, and then goes on firing', () => {
    let s = start('second-wind', undefined, 100);
    const seen: string[] = [];
    for (let i = 0; i < 30 && activeUnit(s).side === 'player' && s.outcome === 'ongoing'; i++) {
      const action = chooseAutoPlayerAction(s, CATALOG);
      seen.push(action.type);
      s = applyAction(s, action, CATALOG);
    }
    const at = seen.indexOf('overdrive');
    expect(at).toBeGreaterThan(0);
    expect(seen.slice(0, at)).toContain('fire');
    expect(seen.slice(at + 1)).toContain('fire');
    expect(seen.filter((a) => a === 'overdrive')).toHaveLength(1);
  });

  test('takes Deadeye before the first shot of a turn, and Iron Skin only once the core is going', () => {
    expect(choice(start('deadeye', undefined, 100))).toBe('overdrive');
    expect(choice(fire(start('deadeye', undefined, 92), 'rightHand'))).not.toBe('overdrive');
    const whole = start('iron-skin', undefined, 100);
    expect(choice(whole)).not.toBe('overdrive');
    whole.units[0].parts.core!.ap = Math.floor(whole.units[0].parts.core!.maxAp * 0.5);
    expect(choice(whole)).toBe('overdrive');
  });

  test('without an Overdrive it plays exactly as it did', () => {
    const s = start();
    const withOne = start('second-wind');
    expect(chooseAutoPlayerAction(withOne, CATALOG)).toEqual(chooseAutoPlayerAction(s, CATALOG));
  });
});
