import { chooseAutoPlayerAction, chooseEnemyAction, runBattle } from '../../src/core/ai';
import { activeUnit, applyAction, createBattle, type BattleState } from '../../src/core/battle';
import type { AiProfile, EnemyDef } from '../../src/core/types';
import { ENCOUNTERS, ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';

const END = { type: 'endTurn' } as const;
const mechEnemy = (ai: AiProfile): EnemyDef => ({ id: 'test-mech', name: 'Test Mech', ai, sprite: 'none', build: STARTER_BUILD });

/** Ends turns until the first enemy is active. */
function toEnemy(s: BattleState): BattleState {
  let guard = 0;
  while (activeUnit(s).id !== 'enemy-0' && guard++ < 10) s = applyAction(s, END, CATALOG);
  return s;
}
function edit(s: BattleState, fn: (d: BattleState) => void): BattleState {
  const copy = structuredClone(s);
  fn(copy);
  return copy;
}

test('a gunner fires its weapon at the player core', () => {
  const s = toEnemy(createBattle(DEMO_BUILD, [ENEMIES['gun-turret']], CATALOG, 1));
  expect(chooseEnemyAction(s, CATALOG)).toEqual({ type: 'fire', weapon: 'shoulder', target: 'player', part: 'core' });
});

test('an enemy about to overheat cools first, then fires, then ends its turn', () => {
  let s = edit(toEnemy(createBattle(DEMO_BUILD, [ENEMIES['gun-turret']], CATALOG, 1)), (d) => { d.units[1].heat = 80; });
  expect(chooseEnemyAction(s, CATALOG)).toEqual({ type: 'cool' });
  s = applyAction(s, { type: 'cool' }, CATALOG);
  const second = chooseEnemyAction(s, CATALOG);
  expect(second).toMatchObject({ type: 'fire', weapon: 'shoulder' });
  s = applyAction(s, second, CATALOG, () => 0.999);
  expect(chooseEnemyAction(s, CATALOG)).toEqual(END);
});

test('an enemy that cannot cool does not fire itself into overheating', () => {
  const s = edit(toEnemy(createBattle(DEMO_BUILD, [ENEMIES['gun-turret']], CATALOG, 1)), (d) => {
    d.units[1].heat = 80;
    d.units[1].usedCool = true;
  });
  expect(chooseEnemyAction(s, CATALOG)).toEqual(END);
});

test('a skirmisher boosts first and aims for the head', () => {
  let s = toEnemy(createBattle(DEMO_BUILD, [mechEnemy('skirmisher')], CATALOG, 1));
  expect(chooseEnemyAction(s, CATALOG)).toEqual({ type: 'boost' });
  s = applyAction(s, { type: 'boost' }, CATALOG);
  expect(chooseEnemyAction(s, CATALOG)).toEqual({ type: 'fire', weapon: 'rightHand', target: 'player', part: 'head' });
});

test('a skirmisher switches to the core once the head is gone', () => {
  let s = edit(toEnemy(createBattle(DEMO_BUILD, [mechEnemy('skirmisher')], CATALOG, 1)), (d) => { d.units[0].parts.head!.ap = 0; });
  s = applyAction(s, { type: 'boost' }, CATALOG);
  expect(chooseEnemyAction(s, CATALOG)).toMatchObject({ type: 'fire', part: 'core' });
});

test('a bruiser goes for the most damaged part', () => {
  const s = edit(toEnemy(createBattle(DEMO_BUILD, [mechEnemy('bruiser')], CATALOG, 1)), (d) => { d.units[0].parts.arms!.ap = 10; });
  expect(chooseEnemyAction(s, CATALOG)).toMatchObject({ type: 'fire', part: 'arms' });
});

test('a bruiser breaks ties in favour of the core', () => {
  const s = toEnemy(createBattle(DEMO_BUILD, [mechEnemy('bruiser')], CATALOG, 1));
  expect(chooseEnemyAction(s, CATALOG)).toMatchObject({ type: 'fire', part: 'core' });
});

test('the auto-player shoots the enemy with the weakest core', () => {
  let s = createBattle(DEMO_BUILD, [ENEMIES['gun-turret'], ENEMIES['recon-drone']], CATALOG, 1);
  while (activeUnit(s).id !== 'player') s = applyAction(s, END, CATALOG);
  expect(chooseAutoPlayerAction(s, CATALOG)).toEqual({ type: 'fire', weapon: 'rightHand', target: 'enemy-1', part: 'core' });
});

test.each(Object.keys(ENCOUNTERS))('encounter %s always plays to an outcome with legal actions only', (name) => {
  for (let seed = 1; seed <= 30; seed++) {
    const start = createBattle(DEMO_BUILD, ENCOUNTERS[name].map((id) => ENEMIES[id]), CATALOG, seed);
    // applyAction throws on an illegal action, so finishing proves every choice was legal.
    const end = runBattle(start, CATALOG, chooseAutoPlayerAction);
    expect(end.outcome).not.toBe('ongoing');
  }
});
