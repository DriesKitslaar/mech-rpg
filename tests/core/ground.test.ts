import { applyAction, activeUnit, coolingOf, coolingOn, createBattle, previewShot, type BattleState } from '../../src/core/battle';
import { boostProfile } from '../../src/core/build';
import { GROUNDS, groundFor, type Ground } from '../../src/core/ground';
import { startMissionBattle } from '../../src/core/mission';
import { ALL_ENEMIES } from '../../src/content/arena';
import { DRILLS } from '../../src/content/drills';
import { ENEMIES } from '../../src/content/enemies';
import { GAUNTLET_TEXT } from '../../src/content/gauntlet';
import { floorMission, startRun } from '../../src/core/gauntlet';
import { WEATHER } from '../../src/ui/weather';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import SPRITES from '../../src/content/sprites.json';
import { STRINGS } from '../../src/content/strings';
import { BRIEFING_CHARS, groundLines } from '../../src/ui/briefingScreen';

const on = (ground?: Ground): BattleState => createBattle(DEMO_BUILD, [ENEMIES['light-mech']], CATALOG, 3, ground ? { ground } : {});
const shot = (s: BattleState, from: string, slot: 'rightHand' | 'leftHand' | 'shoulder', to: string) => previewShot(s, from, slot, to, 'core', CATALOG);
const weaponOf = (slot: 'rightHand' | 'leftHand' | 'shoulder') => CATALOG[DEMO_BUILD[slot]!] as { damageType: string };

describe('the ground a battle is fought on', () => {
  test('every kind has one small rule, a name and a line that says what the rule is, in its own numbers', () => {
    expect(Object.keys(GROUNDS).sort()).toEqual(Object.keys(STRINGS.ground).sort());
    for (const ground of Object.values(GROUNDS)) {
      const { id, ...rule } = ground;
      expect(Object.keys(rule), id).toHaveLength(1);
      const { name, note } = STRINGS.ground[id];
      expect(`${name}: ${note}`.length, id).toBeLessThanOrEqual(BRIEFING_CHARS);
      const number = ground.cooling ?? ground.thrust ?? Object.values(ground.aim ?? {})[0] ?? Math.round((1 - Object.values(ground.damage ?? {})[0]!) * 100);
      expect(note, id).toContain(String(Math.abs(number)));
      expect(note, id).toContain(number > 0 && ground.damage === undefined ? 'more' : 'less');
    }
  });

  test('rain and furnace heat change what everyone sheds, the pilot and the enemy alike', () => {
    for (const [ground, by] of [[GROUNDS.rain, 4], [GROUNDS.furnace, -4]] as const) {
      const s = on(ground);
      for (const unit of s.units) expect(coolingOn(s, unit, CATALOG)).toBe(Math.max(0, coolingOf(unit, CATALOG) + by));
    }
    const plain = on();
    expect(coolingOn(plain, plain.units[0], CATALOG)).toBe(coolingOf(plain.units[0], CATALOG));
    // The cool action sheds the ground's amount.
    const hot = on(GROUNDS.rain);
    const me = activeUnit(hot);
    me.heat = 80;
    const cooled = applyAction(hot, { type: 'cool' }, CATALOG);
    expect(80 - cooled.units.find((u) => u.id === me.id)!.heat).toBe(coolingOn(hot, me, CATALOG));
  });

  test('dust spoils every shot by five, for both sides', () => {
    const plain = on();
    const dusty = on(GROUNDS.dust);
    expect(shot(dusty, 'player', 'rightHand', 'enemy-0').hitChance).toBe(shot(plain, 'player', 'rightHand', 'enemy-0').hitChance - 5);
    expect(shot(dusty, 'enemy-0', 'rightHand', 'player').hitChance).toBe(shot(plain, 'enemy-0', 'rightHand', 'player').hitChance - 5);
    expect(shot(dusty, 'player', 'rightHand', 'enemy-0').damage).toBe(shot(plain, 'player', 'rightHand', 'enemy-0').damage);
  });

  test('wind bends bullets only, clear air helps beams only, and a sealed vault dampens blasts only', () => {
    const plain = on();
    for (const slot of ['rightHand', 'leftHand', 'shoulder'] as const) {
      const type = weaponOf(slot).damageType;
      const base = shot(plain, 'player', slot, 'enemy-0');
      expect(shot(on(GROUNDS.wind), 'player', slot, 'enemy-0').hitChance, `wind ${type}`).toBe(base.hitChance - (type === 'kinetic' ? 6 : 0));
      expect(shot(on(GROUNDS.clear), 'player', slot, 'enemy-0').hitChance, `clear ${type}`).toBe(base.hitChance + (type === 'energy' ? 4 : 0));
      const sealed = shot(on(GROUNDS.sealed), 'player', slot, 'enemy-0').damage;
      if (type === 'explosive') expect(sealed).toBe(Math.max(1, Math.round(base.damage * 0.85)));
      else expect(sealed).toBe(base.damage);
    }
    // The demo build carries one of each kind, so each rule was really tried.
    expect(new Set((['rightHand', 'leftHand', 'shoulder'] as const).map((slot) => weaponOf(slot).damageType)).size).toBe(3);
  });

  test('in flood water a boost dodges six less, and standing still dodges what it always did', () => {
    const plain = on();
    const wet = on(GROUNDS.flood);
    expect(shot(wet, 'player', 'rightHand', 'enemy-0').hitChance).toBe(shot(plain, 'player', 'rightHand', 'enemy-0').hitChance);
    for (const s of [plain, wet]) s.units[1].boosted = true;
    const thrust = boostProfile(plain.units[1].build, CATALOG).thrust;
    expect(thrust).toBeGreaterThanOrEqual(6);
    expect(shot(wet, 'player', 'rightHand', 'enemy-0').hitChance).toBe(shot(plain, 'player', 'rightHand', 'enemy-0').hitChance + 6);
  });
});

describe('where each rule holds', () => {
  test('eight places have one of the seven rules; the arena, the simulator, the hangar, the clearing house and the undercity are level ground', () => {
    const places = Object.keys(SPRITES).filter((id) => id.startsWith('bg-'));
    const ruled = places.filter((id) => groundFor(id)).sort();
    expect(ruled).toEqual(['bg-foundry', 'bg-hall', 'bg-mine', 'bg-neon-district', 'bg-plaza', 'bg-rooftop', 'bg-sluice', 'bg-vault']);
    // The drowned hall stands in the same water the sluice does.
    expect(groundFor('bg-hall')).toBe(groundFor('bg-sluice'));
    expect(new Set(ruled.map((id) => groundFor(id)!.id)).size).toBe(7);
    for (const drill of DRILLS) expect(groundFor(drill.battle.background), drill.id).toBeUndefined();
  });

  test('every battle of a contract is fought on the ground of its place, and the briefing says so once for each kind', () => {
    for (const mission of MISSIONS) {
      mission.battles.forEach((battle, i) => {
        const s = startMissionBattle(DEMO_BUILD, mission, i, ALL_ENEMIES, CATALOG, 1);
        expect(s.ground, `${mission.id}/${i}`).toEqual(groundFor(battle.background));
      });
      const kinds = new Set(mission.battles.flatMap((b) => groundFor(b.background)?.id ?? []));
      expect(groundLines(mission)).toHaveLength(kinds.size);
    }
    expect(groundLines(MISSIONS.find((m) => m.id === 'patrol')!)).toEqual(['RAIN: all shed 4 more heat a turn']);
    // The Gauntlet's floors go through ruled places too.
    expect(GAUNTLET_TEXT.backgrounds.filter((id) => groundFor(id)).length).toBeGreaterThanOrEqual(4);
  });
});

describe('what the review of the ground found', () => {
  test('the heat shed at the end of a turn is the ground\'s, not the generator\'s alone', () => {
    for (const [ground, by] of [[GROUNDS.rain, 4], [GROUNDS.furnace, -4], [undefined, 0]] as const) {
      let s = on(ground);
      for (let i = 0; i < 6 && activeUnit(s).side !== 'player'; i++) s = applyAction(s, { type: 'endTurn' }, CATALOG);
      const me = activeUnit(s);
      me.heat = 70;
      const after = applyAction(s, { type: 'endTurn' }, CATALOG);
      expect(70 - after.units[0].heat, ground?.id ?? 'level').toBe(coolingOf(me, CATALOG) + by);
    }
  });

  test('a bomb is a blast: the sealed vault takes its fifteen in a hundred off it too', () => {
    const blast = (ground?: Ground): number => {
      let s = createBattle(DEMO_BUILD, [ENEMIES['bomb-crawler']], CATALOG, 3, ground ? { ground } : {});
      for (let i = 0; i < 40 && s.outcome === 'ongoing'; i++) {
        s = applyAction(s, { type: 'endTurn' }, CATALOG);
        const event = s.events.find((e) => e.type === 'blast');
        if (event && event.type === 'blast') return event.damage;
      }
      return -1;
    };
    expect(blast()).toBeGreaterThan(0);
    expect(blast(GROUNDS.sealed)).toBe(Math.round(blast() * 0.85));
  });

  test('the wardens of the Gauntlet are not all met on the same ground', () => {
    const names = Object.fromEntries(Object.values(ALL_ENEMIES).map((e) => [e.id, e.name]));
    const run = startRun(1, DEMO_BUILD);
    const grounds = [5, 10, 15, 20, 25].map((floor) => floorMission({ ...run, floor }, GAUNTLET_TEXT, names).battles[0].background);
    expect(new Set(grounds).size).toBe(5);
  });

  test('what is seen falling agrees with the rule: rain only where the rule is rain, dust only where it is dust', () => {
    for (const [place, weather] of Object.entries(WEATHER)) {
      const rule = groundFor(place)?.id;
      if (weather === 'rain') expect(rule, place).toBe('rain');
      if (weather === 'dust') expect(rule, place).toBe('dust');
    }
  });
});
