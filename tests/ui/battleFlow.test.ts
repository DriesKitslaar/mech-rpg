import { createBattle, previewShot, type BattleState } from '../../src/core/battle';
import type { Catalog, Weapon } from '../../src/core/types';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';
import { BattleFlow } from '../../src/ui/battleFlow';

const intro = (seed = 1): BattleState => createBattle(DEMO_BUILD, [ENEMIES['recon-drone'], ENEMIES['recon-drone']], CATALOG, seed);

/** Plays out queued messages and enemy turns until the player may act (or the battle is over). */
function settle(flow: BattleFlow): BattleFlow {
  let guard = 0;
  while (flow.phase === 'animating' && guard++ < 500) flow.advance();
  return flow;
}
const ready = (state: BattleState = intro()) => settle(new BattleFlow(state, CATALOG));
/** Moves the cursor to a menu item, giving up after one lap so a missing item fails instead of hanging. */
function toItem(flow: BattleFlow, id: string): void {
  for (let i = 0; i < 12 && flow.menu.items[flow.menu.cursor]?.id !== id; i++) flow.onInput('down');
  expect(flow.menu.items[flow.menu.cursor]?.id).toBe(id);
}
const press = (flow: BattleFlow, ...actions: Parameters<BattleFlow['onInput']>[0][]) => actions.forEach((a) => flow.onInput(a));

test('duplicate enemies get distinguishing names', () => {
  expect(intro().units.map((u) => u.name)).toEqual(['You', 'Recon Drone A', 'Recon Drone B']);
});

test('the player turn opens on the action menu', () => {
  const flow = ready();
  expect(flow.phase).toBe('action');
  expect(flow.menu.items.map((i) => i.id)).toEqual(['fire', 'boost', 'guard', 'cool', 'repair', 'endTurn', 'auto', 'retreat']);
  expect(flow.menu.items.map((i) => i.label)).toEqual(['Fire', 'Boost', 'Guard', 'Vent', 'Field Repair', 'End Turn', 'Auto Turn', 'Retreat']);
  expect(flow.menu.cursor).toBe(0);
});

test('field repair is disabled while nothing is damaged', () => {
  const menu = ready(createBattle(DEMO_BUILD, [ENEMIES['gun-turret']], CATALOG, 1)).menu;
  expect(menu.items.find((i) => i.id === 'repair')!.enabled).toBe(false);
  expect(menu.items.find((i) => i.id === 'fire')!.enabled).toBe(true);
});

test('fire leads through weapon choice to targeting with a preview', () => {
  const flow = ready();
  press(flow, 'confirm');
  expect(flow.phase).toBe('weapon');
  expect(flow.menu.items.map((i) => i.id)).toEqual(['rightHand', 'leftHand', 'shoulder']);
  expect(flow.menu.items[0].label).toContain('Rivet Rifle');
  press(flow, 'confirm');
  expect(flow.phase).toBe('target');
  expect(flow.targetId).toBe('enemy-0');
  expect(flow.targetPart).toBe('core');
  expect(flow.preview).toEqual(previewShot(flow.state, 'player', 'rightHand', 'enemy-0', 'core', CATALOG));
});

test('targeting cycles enemies and parts, and cancel steps back', () => {
  const flow = ready();
  press(flow, 'confirm', 'confirm', 'next');
  expect(flow.targetId).toBe('enemy-1');
  press(flow, 'down');
  expect(flow.targetPart).toBe('legs');
  expect(flow.preview).toEqual(previewShot(flow.state, 'player', 'rightHand', 'enemy-1', 'legs', CATALOG));
  press(flow, 'prev');
  expect(flow.targetId).toBe('enemy-0');
  expect(flow.targetPart).toBe('core');
  press(flow, 'cancel');
  expect(flow.phase).toBe('weapon');
  press(flow, 'cancel');
  expect(flow.phase).toBe('action');
});

test('menus wrap around', () => {
  const flow = ready();
  press(flow, 'up');
  expect(flow.menu.items[flow.menu.cursor].id).toBe('retreat');
  press(flow, 'down');
  expect(flow.menu.items[flow.menu.cursor].id).toBe('fire');
});

test('confirming a shot applies it and reports the result', () => {
  // A turret takes a rifle's slug and stands: the weapon has fired and is not offered again this turn.
  const flow = ready(createBattle(DEMO_BUILD, [ENEMIES['gun-turret'], ENEMIES['recon-drone']], CATALOG, 1));
  press(flow, 'confirm', 'confirm', 'confirm');
  expect(flow.state.units[0].ammo.rightHand).toBe(29);
  expect(flow.message).toMatch(/Rivet Rifle (hits|misses) Gun Turret/);
  settle(flow);
  expect(flow.phase).toBe('action');
  press(flow, 'confirm');
  expect(flow.menu.items.filter((i) => i.enabled).map((i) => i.id)).toEqual(['leftHand', 'shoulder']);
});

test('a shot that goes through a light machine says so, and the weapon is offered again', () => {
  const flow = ready();
  expect(flow.preview).toBeNull();
  press(flow, 'confirm', 'confirm');
  // The aiming line knows before the trigger is pulled.
  expect(flow.preview).toMatchObject({ shatter: true, kills: true, damage: 50 });
  press(flow, 'confirm');
  expect(flow.state.units[0].ammo.rightHand).toBe(29);
  expect(flow.message).toBe('Rivet Rifle SHATTERS Recon Drone A');
  const said: string[] = [];
  for (let guard = 0; flow.phase === 'animating' && guard < 500; guard++) { flow.advance(); said.push(flow.message); }
  // What is said, in the order it happened: the machine goes, and then the weapon is back. Nothing waits for that
  // last line: it is said as the pilot is handed the turn again, and stands in the bar in place of the turn's own.
  expect(said.filter((line, i) => line !== said[i - 1])).toEqual(['Recon Drone A destroyed', 'Rivet Rifle ready again']);
  expect(said.filter((line) => line === 'Rivet Rifle ready again')).toHaveLength(1);
  expect(flow.phase).toBe('action');
  expect(flow.message).toBe('Rivet Rifle ready again');
  press(flow, 'confirm');
  // The round is spent and the rifle is ready all the same.
  expect(flow.menu.items.filter((i) => i.enabled).map((i) => i.id)).toEqual(['rightHand', 'leftHand', 'shoulder']);
  expect(flow.state.units[0].chain).toBe(1);
  // Aiming, the bar says what it always says there.
  press(flow, 'confirm');
  expect(flow.phase).toBe('target');
  expect(flow.message).toBe('Round 1 - your move');
});

test('after a kill with any weapon the weapon menu opens on that weapon, for as long as the run lasts', () => {
  const drone = ENEMIES['recon-drone'];
  // The pistol in the left hand takes a drone at a blow here; the rifle is the first weapon in the menu.
  const pistol = CATALOG[DEMO_BUILD.leftHand!] as Weapon;
  const heavy: Catalog = { ...CATALOG, [pistol.id]: { ...pistol, damage: 900 } };
  const cursor = (flow: BattleFlow): string => flow.menu.items[flow.menu.cursor].id;
  // Seed by seed the dice are the game's own: the first battle in which the pistol's first shot lands.
  let flow: BattleFlow | undefined;
  for (let seed = 1; seed <= 200 && !flow; seed++) {
    const tried = settle(new BattleFlow(createBattle(DEMO_BUILD, [drone, drone, drone], heavy, seed), heavy, { quiet: true }));
    press(tried, 'confirm');
    // Before any kill the menu opens on the first weapon that can fire.
    expect(cursor(tried)).toBe('rightHand');
    toItem(tried, 'leftHand');
    press(tried, 'confirm', 'confirm');
    settle(tried);
    if (tried.phase === 'action' && tried.state.units.filter((u) => u.destroyed).length === 1) flow = tried;
  }
  expect(flow).toBeDefined();
  expect(flow!.message).toBe(`${pistol.name} ready again`);
  press(flow!, 'confirm');
  expect(cursor(flow!)).toBe('leftHand');
  // A new turn forgets it: the run was that turn's.
  press(flow!, 'cancel');
  toItem(flow!, 'endTurn');
  press(flow!, 'confirm');
  for (let guard = 0; flow!.phase !== 'action' && flow!.phase !== 'result' && guard < 4000; guard++) flow!.advance();
  expect(flow!.phase).toBe('action');
  expect(flow!.state.units[0].chain).toBe(0);
  press(flow!, 'confirm');
  expect(cursor(flow!)).toBe('rightHand');
});

test('what a kill gave back is the line of the step that hands the turn back, and of no later one: Auto Turn does not bring it up a turn late', () => {
  const drone = ENEMIES['recon-drone'];
  const heavy: Catalog = { ...CATALOG, 'wpn-rivet-rifle': { ...(CATALOG['wpn-rivet-rifle'] as Weapon), damage: 900 } };
  // Three drones with more behind them: the automatic player takes some in its turn, and the battle goes on.
  let flow: BattleFlow | undefined;
  const said: string[] = [];
  for (let seed = 1; seed <= 200 && !flow; seed++) {
    const tried = settle(new BattleFlow(createBattle(DEMO_BUILD, [drone, drone, drone], heavy, seed, { reserve: [drone, drone, drone, drone] }), heavy, { quiet: true }));
    said.length = 0;
    toItem(tried, 'auto');
    press(tried, 'confirm');
    for (let guard = 0; tried.phase !== 'action' && tried.phase !== 'result' && guard < 4000; guard++) { tried.advance(); said.push(tried.message); }
    const kills = tried.state.events.filter((e) => e.type === 'momentum').length;
    if (tried.phase === 'action' && kills > 0 && tried.state.round > 1) flow = tried;
  }
  expect(flow).toBeDefined();
  // The turn it has now is a new one: nothing was readied in it, and the bar says whose move it is.
  expect(flow!.state.units[0].chain).toBe(0);
  expect(flow!.message).toBe(`Round ${flow!.state.round} - your move`);
  // And while the automatic player was at it, the line never stood in the bar over a menu that was not there.
  expect(said.filter((line) => /ready again|Field clear|is empty/.test(line))).toEqual([]);
});

test('whether a kill readied a weapon for nothing is settled as it is said, not by what was done with the weapon afterwards', () => {
  const drone = ENEMIES['recon-drone'];
  const heavy: Catalog = { ...CATALOG, 'wpn-rivet-rifle': { ...(CATALOG['wpn-rivet-rifle'] as Weapon), damage: 900 } };
  // The first battle, by seed, in which the rifle takes a drone and then misses the next: it has fired, and is no longer ready.
  let found: { flow: BattleFlow; at: number } | undefined;
  for (let seed = 1; seed <= 400 && !found; seed++) {
    const flow = settle(new BattleFlow(createBattle(DEMO_BUILD, [drone, drone, drone], heavy, seed), heavy, { quiet: true }));
    press(flow, 'confirm', 'confirm', 'confirm');
    settle(flow);
    const at = flow.state.events.findIndex((e) => e.type === 'momentum');
    if (flow.phase !== 'action' || at < 0) continue;
    expect(flow.readied('rightHand')).toBe('ready');
    expect(flow.readiedForNothing(at)).toBe(false);
    press(flow, 'confirm', 'confirm', 'confirm');
    settle(flow);
    if (flow.phase === 'action' && flow.state.units.filter((u) => u.destroyed).length === 1 && flow.state.units[0].fired.includes('rightHand')) found = { flow, at };
  }
  expect(found).toBeDefined();
  expect(found!.flow.readied('rightHand')).toBe('none');
  expect(found!.flow.readiedForNothing(found!.at)).toBe(false);
  // And one that was readied for nothing stays so: the last round went with the kill.
  for (let seed = 1; seed <= 400; seed++) {
    const state = createBattle(DEMO_BUILD, [drone, drone, drone], heavy, seed);
    state.units[0].ammo.rightHand = 1;
    const flow = settle(new BattleFlow(state, heavy, { quiet: true }));
    press(flow, 'confirm', 'confirm', 'confirm');
    settle(flow);
    const at = flow.state.events.findIndex((e) => e.type === 'momentum');
    if (at < 0) continue;
    expect(flow.readied('rightHand')).toBe('empty');
    expect(flow.readiedForNothing(at)).toBe(true);
    expect(flow.readiedForNothing(at - 1)).toBe(false);
    return;
  }
  throw new Error('no seed gave the kill');
});

test('a disabled menu item does nothing and ending the turn passes play', () => {
  const state = ready().state;
  const drained = structuredClone(state);
  drained.units[0].energy = 0;
  drained.units[0].repairsLeft = 0;
  const flow = ready(drained);
  expect(flow.menu.items.find((i) => i.id === 'fire')!.enabled).toBe(false);
  expect(flow.menu.items[flow.menu.cursor].id).toBe('endTurn');
  while (flow.menu.items[flow.menu.cursor].id !== 'fire') press(flow, 'down');
  press(flow, 'confirm');
  expect(flow.phase).toBe('action');
  while (flow.menu.items[flow.menu.cursor].id !== 'endTurn') press(flow, 'down');
  const round = flow.state.round;
  press(flow, 'confirm');
  settle(flow);
  expect(flow.state.round).toBe(round + 1);
});

test('field repair lists damaged parts and repairs the chosen one', () => {
  const state = structuredClone(ready(createBattle(DEMO_BUILD, [ENEMIES['gun-turret']], CATALOG, 1)).state);
  state.units[0].parts.legs!.ap = 50;
  const flow = ready(state);
  while (flow.menu.items[flow.menu.cursor].id !== 'repair') press(flow, 'down');
  press(flow, 'confirm');
  expect(flow.phase).toBe('repairPart');
  expect(flow.menu.items.map((i) => i.id)).toEqual(['legs']);
  press(flow, 'confirm');
  expect(flow.state.units[0].parts.legs!.ap).toBe(110);
  expect(flow.message).toContain('repair');
});

test('a battle played through the menus reaches a result that matches the outcome', () => {
  const flow = new BattleFlow(intro(3), CATALOG);
  let steps = 0;
  while (flow.phase !== 'result' && steps++ < 5000) {
    if (flow.phase === 'animating') { flow.advance(); continue; }
    if (flow.menu.items[0].enabled) { press(flow, 'confirm', 'confirm', 'confirm'); continue; }
    while (flow.menu.items[flow.menu.cursor].id !== 'endTurn') press(flow, 'down');
    press(flow, 'confirm');
  }
  expect(flow.phase).toBe('result');
  expect(flow.state.outcome).not.toBe('ongoing');
  expect(flow.message).toBe(flow.state.outcome === 'victory' ? 'VICTORY' : 'DEFEAT');
});

test('input during enemy turns is ignored', () => {
  const flow = new BattleFlow(intro(), CATALOG);
  expect(flow.phase).toBe('animating');
  const before = structuredClone(flow.state);
  press(flow, 'confirm', 'down', 'cancel');
  expect(flow.state).toEqual(before);
});

test('the line under a weapon shows the energy and the heat each shot takes', () => {
  const flow = ready();
  press(flow, 'confirm');
  expect(flow.menu.items[0]).toMatchObject({ label: 'Rivet Rifle x30', note: 'EN 60  HEAT 12' });
});

test('targeting warns when the shot would overheat the mech', () => {
  const cool = ready();
  press(cool, 'confirm', 'confirm');
  expect(cool.overheatWarning).toBe(false);

  const hotState = structuredClone(ready().state);
  hotState.units[0].heat = 95;
  const hot = ready(hotState);
  press(hot, 'confirm', 'confirm');
  expect(hot.phase).toBe('target');
  expect(hot.overheatWarning).toBe(true);
  expect(hot.message).toBe('Warning: this shot will overheat');
  press(hot, 'cancel');
  expect(hot.overheatWarning).toBe(false);
});

test('a hit on a destroyed part is reported as core damage', () => {
  const state = structuredClone(ready().state);
  state.units[1].parts.legs!.ap = 0;
  const flow = ready(state);
  press(flow, 'confirm', 'confirm', 'down');
  expect(flow.targetPart).toBe('legs');
  expect(flow.preview!.damage).toBe(19);
});

test('retreat asks first, with no selected, and then ends the battle in defeat', () => {
  const flow = ready();
  toItem(flow, 'retreat');
  press(flow, 'confirm');
  expect(flow.phase).toBe('confirmRetreat');
  expect(flow.menu.items.map((i) => i.id)).toEqual(['no', 'yes']);
  expect(flow.menu.cursor).toBe(0);
  press(flow, 'confirm');
  expect(flow.phase).toBe('action');
  expect(flow.state.outcome).toBe('ongoing');

  toItem(flow, 'retreat');
  press(flow, 'confirm', 'down', 'confirm');
  settle(flow);
  expect(flow.state.outcome).toBe('defeat');
  expect(flow.phase).toBe('result');
  expect(flow.message).toBe('DEFEAT');
});

test('cancel backs out of the retreat question', () => {
  const flow = ready();
  toItem(flow, 'retreat');
  press(flow, 'confirm', 'cancel');
  expect(flow.phase).toBe('action');
});
