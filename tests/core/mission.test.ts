import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import type { BattleState } from '../../src/core/battle';
import type { Mission } from '../../src/core/campaign';
import { settle } from '../../src/core/economy';
import { FIELD_RESUPPLY, FIELD_SERVICE, playMission, startMissionBattle } from '../../src/core/mission';
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
  expect(p.repairsLeft).toBe(1);
});

test('between battles half of every magazine is refilled, never past full, and every round handed out is billed', () => {
  expect(FIELD_RESUPPLY).toBe(0.5);
  const before = worn();
  before.units[0].ammo.shoulder = 1;         // mortar pod: 8 a magazine, 7 fired
  const next = startMissionBattle(DEMO_BUILD, mission, 1, ENEMIES, CATALOG, 1, before);
  const p = next.units[0];
  expect(p.ammo.rightHand).toBe(30);         // rifle: 20 of 30 left, 10 fit
  expect(p.ammo.shoulder).toBe(5);           // 1 + half of 8
  expect(p.ammo.leftHand).toBeNull();        // an energy weapon has no magazine
  expect(p.restocked).toEqual({ rightHand: 10, shoulder: 4 });

  // The bill at the end counts what was fired, not what is missing from the magazine.
  const end = { ...structuredClone(next), outcome: 'victory' as const };
  end.units[0].ammo.rightHand = 28;
  expect(settle(end, 100, CATALOG).ammoCost).toBe((10 + 2) * 15 + (4 + 3) * 60);
});

test('refilled rounds stay on the bill through a third battle', () => {
  const three: Mission = { ...mission, battles: [...mission.battles, { enemies: ['recon-drone'], background: 'bg' }] };
  const second = startMissionBattle(DEMO_BUILD, three, 1, ENEMIES, CATALOG, 1, worn());
  const done = { ...structuredClone(second), outcome: 'victory' as const };
  done.units[0].ammo.rightHand = 25;
  const third = startMissionBattle(DEMO_BUILD, three, 2, ENEMIES, CATALOG, 1, done);
  expect(third.units[0].ammo.rightHand).toBe(30);
  expect(third.units[0].restocked.rightHand).toBe(15);
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
