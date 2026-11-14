import { createBattle, type BattleEvent } from '../../src/core/battle';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { ApDisplay } from '../../src/ui/apDisplay';

const battle = () => createBattle(DEMO_BUILD, [ENEMIES['recon-drone']], CATALOG, 1);
const hit = (damage: number, appliedTo: 'core' | 'legs' = 'core'): BattleEvent => ({
  type: 'shot', unit: 'player', weapon: 'rightHand', target: 'enemy-0', part: appliedTo, appliedTo, hit: true, damage,
});

test('it starts from the armour the units have', () => {
  const shown = new ApDisplay(battle().units);
  expect(shown.ap('enemy-0', 'core')).toBe(50);
  expect(shown.ap('player', 'core')).toBe(220);
});

test('a hit lowers the shown armour only once its delay has passed', () => {
  const shown = new ApDisplay(battle().units);
  shown.schedule(hit(38), 160);
  shown.update(100);
  expect(shown.ap('enemy-0', 'core')).toBe(50);
  shown.update(60);
  expect(shown.ap('enemy-0', 'core')).toBe(12);
});

test('a miss changes nothing', () => {
  const shown = new ApDisplay(battle().units);
  shown.schedule({ ...hit(0), hit: false } as BattleEvent, 0);
  shown.update(1);
  expect(shown.ap('enemy-0', 'core')).toBe(50);
});

test('shown armour never goes below zero or above the maximum', () => {
  const shown = new ApDisplay(battle().units);
  shown.schedule(hit(38, 'legs'), 0);
  shown.update(1);
  expect(shown.ap('enemy-0', 'legs')).toBe(0);
  shown.schedule({ type: 'repair', unit: 'player', part: 'core', amount: 88 }, 0);
  shown.update(1);
  expect(shown.ap('player', 'core')).toBe(220);
});

test('a repair raises the shown armour', () => {
  const units = battle().units;
  units[0].parts.core!.ap = 100;
  const shown = new ApDisplay(units);
  shown.schedule({ type: 'repair', unit: 'player', part: 'core', amount: 88 }, 0);
  shown.update(1);
  expect(shown.ap('player', 'core')).toBe(188);
});

test('other events are ignored', () => {
  const shown = new ApDisplay(battle().units);
  shown.schedule({ type: 'boost', unit: 'player' }, 0);
  shown.schedule({ type: 'unitDestroyed', unit: 'enemy-0' }, 0);
  shown.update(1);
  expect(shown.ap('enemy-0', 'core')).toBe(50);
});

test('syncing snaps to the real state when nothing is pending, and waits when something is', () => {
  const state = battle();
  const shown = new ApDisplay(state.units);
  state.units[1].parts.core!.ap = 7;
  shown.schedule(hit(10), 100);
  shown.sync(state.units);
  expect(shown.ap('enemy-0', 'core')).toBe(50);
  shown.update(100);
  shown.sync(state.units);
  expect(shown.ap('enemy-0', 'core')).toBe(7);
});

test('an unknown unit or part reads as zero', () => {
  const shown = new ApDisplay(battle().units);
  expect(shown.ap('nobody', 'core')).toBe(0);
  expect(shown.ap('enemy-0', 'head')).toBe(0);
});

test('refreshing adopts the real armour at once and drops what was still on its way', () => {
  const state = battle();
  const shown = new ApDisplay(state.units);
  shown.schedule(hit(38), 500);
  state.units[1].parts.core!.ap = 35; // a shock pulse took 15: no shot event says so
  shown.refresh(state.units);
  expect(shown.ap('enemy-0', 'core')).toBe(35);
  shown.update(600);
  expect(shown.ap('enemy-0', 'core')).toBe(35);
});
