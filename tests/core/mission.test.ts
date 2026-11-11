import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import type { BattleState } from '../../src/core/battle';
import type { Mission } from '../../src/core/campaign';
import { FIELD_SERVICE, playMission, startMissionBattle } from '../../src/core/mission';
import { ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';

const mission: Mission = {
  id: 't', title: 't', phase: 'faction', client: 'c', briefing: ['b'], debrief: 'd', reward: 100,
  battles: [
    { enemies: ['recon-drone'], background: 'bg' },
    { enemies: ['recon-drone', 'recon-drone'], background: 'bg' },
  ],
};
const first = () => startMissionBattle(DEMO_BUILD, mission, 0, ENEMIES, CATALOG, 1);
function worn(): BattleState {
  const s = structuredClone(first());
  const p = s.units[0];
  p.parts.core!.ap = 100; p.parts.arms!.ap = 0; p.parts.legs!.ap = 140; p.heat = 60; p.ammo.rightHand = 20; p.repairsLeft = 1;
  s.outcome = 'victory';
  return s;
}

test('the first battle starts fresh with that battle\'s enemies', () => {
  const s = first();
  expect(s.units.map((u) => u.id)).toEqual(['player', 'enemy-0']);
  expect(s.units[0].parts.core!.ap).toBe(220);
});

test('between battles the mech gets a field service: heat gone, 40% of each part\'s armour back', () => {
  expect(FIELD_SERVICE).toBe(0.4);
  const next = startMissionBattle(DEMO_BUILD, mission, 1, ENEMIES, CATALOG, 1, worn());
  const p = next.units[0];
  expect(next.units).toHaveLength(3);
  expect(p.heat).toBe(0);
  expect(p.parts.core!.ap).toBe(188);        // 100 + 40% of 220
  expect(p.parts.legs!.ap).toBe(150);        // capped at the maximum
  expect(p.parts.arms!.ap).toBe(44);         // a destroyed part is patched back into use
  expect(p.ammo.rightHand).toBe(20);         // ammunition is not restocked
  expect(p.repairsLeft).toBe(1);
});

test('each battle of a mission uses its own seed', () => {
  expect(startMissionBattle(DEMO_BUILD, mission, 1, ENEMIES, CATALOG, 1, worn()).rng).not.toBe(first().rng);
});

test('a battle that does not exist and an unknown enemy are refused', () => {
  expect(() => startMissionBattle(DEMO_BUILD, mission, 2, ENEMIES, CATALOG, 1)).toThrow('mission t has no battle 2');
  const bad = { ...mission, battles: [{ enemies: ['constructor'], background: 'bg' }] };
  expect(() => startMissionBattle(DEMO_BUILD, bad, 0, ENEMIES, CATALOG, 1)).toThrow('unknown enemy: constructor');
});

test('a mission is played battle by battle and stops at a defeat', () => {
  let battles = 0;
  const won = playMission(DEMO_BUILD, mission, ENEMIES, CATALOG, 3, (s) => { battles++; return runBattle(s, CATALOG, chooseAutoPlayerAction); });
  expect(won.outcome).toBe('victory');
  expect(battles).toBe(2);
  expect(won.units).toHaveLength(3);

  battles = 0;
  const lost = playMission(DEMO_BUILD, mission, ENEMIES, CATALOG, 3, (s) => { battles++; return { ...s, outcome: 'defeat' as const }; });
  expect(lost.outcome).toBe('defeat');
  expect(battles).toBe(1);
});
