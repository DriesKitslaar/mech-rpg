import { activeUnit, applyAction, createBattle, type BattleEvent, type BattleState } from '../../src/core/battle';
import { NO_STATS, STAT_KEYS, addStats, contractStats, retreated, tallyBattle } from '../../src/core/stats';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';

const withEvents = (events: BattleEvent[], enemies = ['gun-turret'], edit: (s: BattleState) => void = () => {}): BattleState => {
  const s = structuredClone(createBattle(DEMO_BUILD, enemies.map((id) => ENEMIES[id]), CATALOG, 1));
  s.events = events;
  edit(s);
  return s;
};
const shot = (unit: string, target: string, hit: boolean, damage = 30): BattleEvent =>
  ({ type: 'shot', unit, weapon: 'rightHand', target, part: 'core', appliedTo: 'core', hit, damage: hit ? damage : 0 });

test('a record starts at nothing, with every counter there is', () => {
  expect(Object.keys(NO_STATS).sort()).toEqual([...STAT_KEYS].sort());
  for (const key of STAT_KEYS) expect(NO_STATS[key]).toBe(0);
});

test('shots, hits and damage are counted for the pilot, and what was taken for the other side', () => {
  const tally = tallyBattle(withEvents([
    shot('player', 'enemy-0', true, 30), shot('player', 'enemy-0', false), shot('player', 'enemy-0', true, 44),
    shot('enemy-0', 'player', true, 38), shot('enemy-0', 'player', false),
  ]));
  expect(tally).toMatchObject({ shots: 3, hits: 2, damage: 74, taken: 38 });
});

test('a blast counts as damage taken, and fire from an ally as nobody\'s shot', () => {
  const tally = tallyBattle(withEvents([
    { type: 'blast', unit: 'enemy-0', target: 'player', damage: 54 },
    { type: 'support', name: 'Ashfall', target: 'enemy-0', damage: 30 },
  ]));
  expect(tally).toMatchObject({ taken: 54, shots: 0, damage: 0 });
});

test('armour lost to a shock pulse is damage taken; what the pilot\'s own pulse takes off is damage done', () => {
  const tally = tallyBattle(withEvents([
    { type: 'module', unit: 'enemy-0', effect: 'shock', amount: 60, damage: 15 },
    { type: 'module', unit: 'player', effect: 'shock', amount: 60, damage: 22 },
    { type: 'module', unit: 'enemy-0', effect: 'chaff', amount: 30 },
    { type: 'module', unit: 'player', effect: 'coolant', amount: 40 },
  ]));
  expect(tally).toMatchObject({ taken: 15, damage: 22, shots: 0, hits: 0 });
});

test('a shock pulse says how much armour it took off those it struck', () => {
  let s = createBattle({ ...DEMO_BUILD, module: 'mod-shock' }, [ENEMIES['gun-turret'], ENEMIES['gun-turret']], CATALOG, 3);
  while (activeUnit(s).side !== 'player') s = applyAction(s, { type: 'endTurn' }, CATALOG);
  const before = s.units.filter((u) => u.side === 'enemy').map((u) => u.parts.core!.ap);
  s = applyAction(s, { type: 'module' }, CATALOG);
  const after = s.units.filter((u) => u.side === 'enemy').map((u) => u.parts.core!.ap);
  const lost = before.reduce((sum, ap, i) => sum + ap - after[i], 0);
  expect(lost).toBeGreaterThan(0);
  const event = s.events.find((e) => e.type === 'module');
  expect(event).toMatchObject({ effect: 'shock', damage: lost });
  expect(tallyBattle(s).damage).toBe(lost);
});

test('a contract won with only a shock pulse landed on the pilot is not a flawless one', () => {
  const battle = tallyBattle(withEvents([{ type: 'module', unit: 'enemy-0', effect: 'shock', amount: 60, damage: 15 }]));
  expect(contractStats(battle, { won: true, retreated: false, pay: 100 }).flawless).toBe(0);
});

test('kills, parts, staggers and overheats', () => {
  const tally = tallyBattle(withEvents([
    { type: 'partDestroyed', unit: 'enemy-0', part: 'legs' }, { type: 'partDestroyed', unit: 'enemy-0', part: 'core' },
    { type: 'unitDestroyed', unit: 'enemy-0' }, { type: 'partDestroyed', unit: 'player', part: 'arms' },
    { type: 'stagger', unit: 'enemy-1' }, { type: 'stagger', unit: 'player' },
    { type: 'overheat', unit: 'player' }, { type: 'overheat', unit: 'enemy-1' },
  ], ['gun-turret', 'gun-turret']));
  // The core going is the kill, not another part.
  expect(tally).toMatchObject({ kills: 1, parts: 1, staggers: 1, overheats: 1 });
});

test('a bomb destroyed before it went off is a bomb defused; one that went off is not', () => {
  const defused = tallyBattle(withEvents([{ type: 'unitDestroyed', unit: 'enemy-0' }], ['bomb-crawler']));
  expect(defused).toMatchObject({ bombs: 1, kills: 1 });
  const wentOff = tallyBattle(withEvents([
    { type: 'blast', unit: 'enemy-0', target: 'player', damage: 90 }, { type: 'unitDestroyed', unit: 'enemy-0' },
  ], ['bomb-crawler']));
  expect(wentOff).toMatchObject({ bombs: 0, kills: 0 });
});

test('rounds are the rounds the battle lasted, and a boss counts when the battle against it is won', () => {
  const won = tallyBattle(withEvents([], ['sable'], (s) => { s.round = 7; s.outcome = 'victory'; }));
  expect(won).toMatchObject({ rounds: 7, bosses: 1 });
  const lost = tallyBattle(withEvents([], ['sable'], (s) => { s.round = 4; s.outcome = 'defeat'; }));
  expect(lost).toMatchObject({ rounds: 4, bosses: 0 });
  expect(tallyBattle(withEvents([], ['gun-turret'], (s) => { s.outcome = 'victory'; })).bosses).toBe(0);
});

test('a real battle adds up', () => {
  let s = createBattle(DEMO_BUILD, [ENEMIES['recon-drone']], CATALOG, 3);
  // The drone is quicker and goes first; it passes.
  s = applyAction(s, { type: 'endTurn' }, CATALOG);
  s = applyAction(s, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' }, CATALOG, () => 0);
  s = applyAction(s, { type: 'fire', weapon: 'leftHand', target: 'enemy-0', part: 'core' }, CATALOG, () => 0);
  expect(s.outcome).toBe('victory');
  expect(tallyBattle(s)).toMatchObject({ shots: 2, hits: 2, kills: 1, rounds: 1 });
});

test('records add up counter by counter, and neither is changed', () => {
  const a = { ...NO_STATS, shots: 3, kills: 1 };
  const b = { ...NO_STATS, shots: 2, hits: 2 };
  expect(addStats(a, b)).toEqual({ ...NO_STATS, shots: 5, hits: 2, kills: 1 });
  expect(a.shots).toBe(3);
});

describe('a contract on the record', () => {
  const fought = { ...NO_STATS, shots: 9, hits: 6, kills: 2, taken: 40, rounds: 7 };

  test('won: one more contract, what it paid, and everything its battles added up to', () => {
    expect(contractStats(fought, { won: true, retreated: false, pay: 1250 })).toEqual({ ...fought, contracts: 1, earned: 1250 });
  });

  test('won without being hit once is also a flawless one', () => {
    expect(contractStats({ ...fought, taken: 0 }, { won: true, retreated: false, pay: 600 })).toMatchObject({ contracts: 1, flawless: 1 });
  });

  test('lost: a loss, no pay; walked away from: a retreat and not a loss', () => {
    expect(contractStats(fought, { won: false, retreated: false, pay: 900 })).toEqual({ ...fought, lost: 1 });
    expect(contractStats(fought, { won: false, retreated: true, pay: 900 })).toEqual({ ...fought, retreats: 1 });
    // Nothing is flawless about a contract that was not won.
    expect(contractStats({ ...fought, taken: 0 }, { won: false, retreated: true, pay: 0 }).flawless).toBe(0);
  });

  test('a battle the pilot walked away from says so', () => {
    let s = createBattle(DEMO_BUILD, [ENEMIES['gun-turret']], CATALOG, 3);
    expect(retreated(s)).toBe(false);
    while (activeUnit(s).id !== 'player') s = applyAction(s, { type: 'endTurn' }, CATALOG);
    s = applyAction(s, { type: 'retreat' }, CATALOG);
    expect(s.outcome).toBe('defeat');
    expect(retreated(s)).toBe(true);
  });

  test('the record counts time played and mirror matches won, and no longer what was spent', () => {
    expect(STAT_KEYS).toContain('seconds');
    expect(STAT_KEYS).toContain('mirrors');
    expect(STAT_KEYS).not.toContain('spent');
  });
});
