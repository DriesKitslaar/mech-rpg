import { chooseEnemyAction } from '../../src/core/ai';
import { HEAT_LIMIT, activeUnit, applyAction, createBattle, guardFactor, previewShot, type BattleState } from '../../src/core/battle';
import { computeBuildStats, weaponIn } from '../../src/core/build';
import { newGame } from '../../src/core/game';
import { ARENA, ARENA_ENEMIES } from '../../src/content/arena';
import { MANUAL, UNITS, WORLD } from '../../src/content/codex';
import { DRILLS } from '../../src/content/drills';
import { ENEMIES } from '../../src/content/enemies';
import { MEDALS } from '../../src/content/medals';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';
import { SCENES } from '../../src/content/scenes';
import { STRINGS } from '../../src/content/strings';

/** What the game tells the player about its rules, held against the rules themselves. */
const topic = (id: string): string => MANUAL.find((t) => t.id === id)!.text;
const note = (id: string): string => UNITS.find((u) => u.id === id)!.note;
const drill = (id: string) => DRILLS.find((d) => d.id === id)!;
/** Runs enemy turns until it is the player's, and returns the battle. */
const toPlayer = (s: BattleState): BattleState => {
  let state = s;
  for (let i = 0; i < 200 && state.outcome === 'ongoing' && activeUnit(state).side !== 'player'; i++) {
    state = applyAction(state, chooseEnemyAction(state, CATALOG), CATALOG);
  }
  return state;
};

describe('the action that sheds heat', () => {
  const name = STRINGS.actions.cool;

  test('has one name, the one on the menu, wherever the game explains it', () => {
    expect(name).toBe('Vent');
    expect(topic('turn')).toContain(name);
    expect(topic('heat')).toContain(`${name} sheds heat`);
    expect(drill('drill-heat').battle.talk!.map((line) => line.text).join(' ')).toContain(`${name} sheds heat`);
    // Nothing calls it by another name.
    for (const text of [...MANUAL.map((t) => t.text), ...DRILLS.flatMap((d) => [...d.briefing, d.debrief, ...(d.battle.talk ?? []).map((l) => l.text)])]) {
      expect(text).not.toMatch(/\bCool (sheds|down|off)\b/);
    }
  });
});

describe('the manual', () => {
  test('a mech overheats past the limit, not at it, and the manual says so', () => {
    const fire = (heat: number) => {
      const s = structuredClone(toPlayer(createBattle(DEMO_BUILD, [ENEMIES['gun-turret']], CATALOG, 2)));
      const weapon = weaponIn(DEMO_BUILD, 'rightHand', CATALOG)!;
      s.units[0].heat = heat - weapon.heat;
      return applyAction(s, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' }, CATALOG).units[0];
    };
    expect(fire(HEAT_LIMIT)).toMatchObject({ heat: HEAT_LIMIT, overheated: false });
    expect(fire(HEAT_LIMIT + 1)).toMatchObject({ heat: HEAT_LIMIT + 1, overheated: true });
    expect(topic('heat')).toContain(`Pass ${HEAT_LIMIT} and you overheat`);
    expect(topic('heat')).not.toMatch(/Reach 100/);
  });

  test('energy is not spent on the module, and the manual does not say it is', () => {
    const spend = topic('turn').split('. ').find((sentence) => sentence.startsWith('Spend it on'))!;
    expect(spend).not.toMatch(/module/i);
    expect(topic('turn')).toMatch(/module costs no/i);
  });

  test('a shield still covers a mech that has lost its arms, and the manual does not say otherwise', () => {
    const build = { ...DEMO_BUILD, leftHand: 'shd-tower' };
    const s = structuredClone(createBattle(build, [ENEMIES['gun-turret']], CATALOG, 2));
    const whole = guardFactor(s.units[0], CATALOG);
    s.units[0].parts.arms!.ap = 0;
    expect(guardFactor(s.units[0], CATALOG)).toBe(whole);
    expect(whole).toBe(0.25);
    expect(topic('parts')).toMatch(/cannot fire what it holds/);
    expect(topic('parts')).toMatch(/shield/);
    expect(topic('parts')).not.toMatch(/cannot use what it holds/);
  });
});

describe('the pages on the enemy', () => {
  test('say a unit cannot dodge only when it cannot: nothing with any mobility is called that', () => {
    for (const unit of UNITS) {
      const sentences = unit.note.split('. ').filter((sentence) => /cannot dodge|never dodges/.test(sentence) && !sentence.startsWith('Staggered'));
      if (sentences.length === 0) continue;
      expect(computeBuildStats(ENEMIES[unit.id].build, CATALOG).mobility, unit.id).toBe(0);
    }
    expect(note('lance-tower')).toMatch(/cannot dodge/);
    expect(note('bulldozer')).not.toMatch(/never dodges/);
    expect(note('strip-miner')).not.toMatch(/cannot dodge/);
  });

  test('the stalker goes for the head, as its page says', () => {
    const s = createBattle(DEMO_BUILD, [ENEMIES.stalker], CATALOG, 4);
    // It is quicker and acts first.
    expect(activeUnit(s).kind).toBe('stalker');
    expect(chooseEnemyAction(s, CATALOG)).toMatchObject({ type: 'fire', part: 'head' });
    expect(note('stalker')).toMatch(/head/);
    expect(note('stalker')).not.toMatch(/limbs/);
  });
});

describe('the drills', () => {
  test('the damage types drill does not promise database pages the simulator does not write', () => {
    expect(drill('drill-types').debrief).not.toMatch(/you have met/);
  });

  test('the blade drill does not call the blade the hardest hit a hand can carry: a charged rail hits harder', () => {
    const blade = weaponIn(drill('drill-blade').build, 'rightHand', CATALOG)!;
    expect(blade.melee).toBe(true);
    const harder = Object.values(CATALOG).filter((part) => part.kind === 'weapon' && part.mount === 'hand' && part.vendor && part.damage > blade.damage);
    expect(harder.length).toBeGreaterThan(0);
    expect(drill('drill-blade').briefing.join(' ')).not.toMatch(/harder than anything/);
  });
});

describe('the arena', () => {
  test('Brother Rust strikes before he fires his howler, and his card does not say the howler comes first', () => {
    const rust = ARENA.find((o) => o.name === 'Brother Rust')!;
    let s = createBattle(DEMO_BUILD, [ARENA_ENEMIES[rust.enemy]], CATALOG, 6);
    const orders: string[][] = [];
    for (let round = 0; round < 6 && s.outcome === 'ongoing'; round++) {
      const from = s.events.length;
      s = toPlayer(s);
      if (s.outcome !== 'ongoing') break;
      s = applyAction(s, { type: 'endTurn' }, CATALOG);
      s = toPlayer(s);
      orders.push(s.events.slice(from).flatMap((e) => (e.type === 'shot' && e.unit === 'enemy-0' ? [e.weapon] : [])));
    }
    const mixed = orders.filter((order) => order.includes('shoulder') && order.some((slot) => slot !== 'shoulder'));
    expect(mixed.length).toBeGreaterThan(0);
    for (const order of mixed) expect(order.lastIndexOf('shoulder')).toBeGreaterThan(Math.max(order.lastIndexOf('rightHand'), order.lastIndexOf('leftHand')));
    expect(rust.style).not.toMatch(/first/);
  });
});

describe('the medals', () => {
  test('the medals for S ranks say which contracts count: the ones that keep a rank', () => {
    // Only contracts of the story keep their best rank; the patrol, open contracts and arena fights do not.
    expect(MISSIONS.find((m) => m.id === 'patrol')!.phase).toBe('patrol');
    for (const id of ['first-s', 's-10', 's-25']) expect(MEDALS.find((m) => m.id === id)!.text, id).toMatch(/story contract/);
  });
});

describe('field repairs', () => {
  test('a field repair ends the turn, and the manual and the battle menu both say so', () => {
    const s = structuredClone(toPlayer(createBattle(DEMO_BUILD, [ENEMIES['gun-turret']], CATALOG, 2)));
    s.units[0].parts.core!.ap -= 50;
    expect(activeUnit(s).side).toBe('player');
    const after = applyAction(s, { type: 'repair', part: 'core' }, CATALOG);
    expect(after.units[0].repairsLeft).toBe(s.units[0].repairsLeft - 1);
    expect(activeUnit(after).side).toBe('enemy');
    expect(topic('repairs')).toMatch(/ends your turn/);
    expect(STRINGS.actionNotes.repair).toBe('ends turn');
  });
});

describe('advice in the first contracts', () => {
  const mission = (id: string) => MISSIONS.find((m) => m.id === id)!;
  const said = (id: string): string => {
    const m = mission(id);
    return [...m.briefing, m.debrief, ...m.battles.flatMap((b) => (b.talk ?? []).map((line) => line.text))].join(' ');
  };

  test('nobody is told to shoot the legs off the Halo Guard first: its legs are harder to hit than its core', () => {
    const s = toPlayer(createBattle(DEMO_BUILD, [ENEMIES['light-mech']], CATALOG, 3));
    for (const slot of ['rightHand', 'leftHand', 'shoulder'] as const) {
      const core = previewShot(s, 'player', slot, 'enemy-0', 'core', CATALOG).hitChance;
      const legs = previewShot(s, 'player', slot, 'enemy-0', 'legs', CATALOG).hitChance;
      expect(legs, slot).toBeLessThan(core);
    }
    expect(said('undertow-1')).not.toMatch(/legs first/i);
    expect(note('light-mech')).not.toMatch(/shoot those out first/);
    // What does help against it is said instead.
    expect(said('undertow-1')).toContain(STRINGS.actions.boost);
  });

  test('what the menu calls Guard is called Guard: no contract tells the pilot to brace', () => {
    for (const m of MISSIONS) expect(said(m.id), m.id).not.toMatch(/\bbrace\b/i);
    expect(said('undertow-2')).toContain(STRINGS.actions.guard);
  });

  test('no contract says of a machine with any mobility that it cannot dodge', () => {
    expect(said('lumen-3')).not.toMatch(/cannot dodge/);
    expect(WORLD.find((e) => e.id === 'strip-miner')!.text).not.toMatch(/could not dodge|cannot dodge/);
    // The turret of the second contract really cannot: it has no mobility at all.
    expect(computeBuildStats(ENEMIES['gun-turret'].build, CATALOG).mobility).toBe(0);
  });

  test('the opening does not send a pilot with money in hand to start with a debt', () => {
    expect(newGame(CATALOG, STARTER_BUILD).credits).toBeGreaterThan(0);
    expect(SCENES.find((scene) => scene.id === 'act-1')!.lines.join(' ')).not.toMatch(/Start with the debt/);
  });
});

describe('the cards of the arena', () => {
  const card = (name: string) => ARENA.find((o) => o.name === name)!;
  /** What an opponent does in its first three turns against a pilot who only ends the turn. */
  function turns(name: string): string[][] {
    let s = createBattle(DEMO_BUILD, [ARENA_ENEMIES[card(name).enemy]], CATALOG, 6);
    const out: string[][] = [];
    for (let round = 0; round < 3 && s.outcome === 'ongoing'; round++) {
      const from = s.events.length;
      s = toPlayer(s);
      if (s.outcome !== 'ongoing') break;
      s = applyAction(s, { type: 'endTurn' }, CATALOG);
      s = toPlayer(s);
      out.push(s.events.slice(from).flatMap((e) => (e.type === 'boost' && e.unit === 'enemy-0' ? ['boost'] : e.type === 'shot' && e.unit === 'enemy-0' ? [e.weapon] : [])));
    }
    return out;
  }

  test('Rustjaw boosts in and strikes before he shoots, and his card says it that way round', () => {
    const first = turns('Rustjaw').find((turn) => turn.includes('leftHand') && turn.includes('rightHand'))!;
    expect(first).toBeDefined();
    expect(first.indexOf('boost')).toBeLessThan(first.indexOf('leftHand'));
    expect(first.indexOf('leftHand')).toBeLessThan(first.indexOf('rightHand'));
    expect(card('Rustjaw').style).not.toMatch(/Shoots for the core, then boosts in/);
    // The first fight of the ladder says what takes the sting out of his fist.
    expect(card('Rustjaw').style).toContain(STRINGS.actions.guard);
  });

  test('Phantom strikes with the blade from the first round, and the void rifle halves resistance, not armour', () => {
    expect(turns('Phantom')[0]).toContain('leftHand');
    expect(card('Phantom').style).not.toMatch(/ignores half your armour|for when you stagger/);
  });

  test('Anvil is not said to be unable to dodge while it has mobility, and Bastion is not said to end a pilot in one hit', () => {
    expect(computeBuildStats(ARENA_ENEMIES[card('Anvil').enemy].build, CATALOG).mobility).toBeGreaterThan(0);
    expect(card('Anvil').style).not.toMatch(/cannot dodge/);
    expect(card('Bastion').style).not.toMatch(/One hit can end you/);
  });
});

describe('the drill on aiming', () => {
  test('with the fire control it lends, every part is as easy to hit as the core, and the talk says that, not the opposite', () => {
    const d = drill('drill-aim');
    const s = toPlayer(createBattle(d.build, [ENEMIES['light-mech']], CATALOG, 2, { enemyScale: d.scale ?? 1 }));
    const chances = (['core', 'legs', 'arms', 'head'] as const).map((part) => previewShot(s, 'player', 'rightHand', 'enemy-0', part, CATALOG).hitChance);
    expect(new Set(chances).size).toBe(1);
    const talk = d.battle.talk!.map((line) => line.text).join(' ');
    expect(talk).not.toMatch(/watch the hit chance change/);
    expect(talk).toMatch(/the same/);
  });
});

describe('small words', () => {
  test('the hub counts what it says it counts: contracts won', () => {
    expect(STRINGS.hub.battlesWon).toBe('CONTRACTS WON');
  });

  test('the shop\'s hint says which button trades', () => {
    expect(STRINGS.shop.hint).toMatch(/^A /);
    expect(STRINGS.shop.hint.length * 4.8).toBeLessThanOrEqual(300);
  });
});
