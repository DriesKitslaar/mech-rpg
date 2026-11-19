import { chooseEnemyAction } from '../../src/core/ai';
import { ARCHETYPES, CLASS_AI, QUICK_LEGS, SLOW_LEGS, archetypeOf } from '../../src/core/archetype';
import {
  HEAT_LIMIT, MAX_ENEMIES, OVERKILL, SHATTER, activeUnit, applyAction, checkAction, createBattle, guardFactor, previewShot, type BattleState,
} from '../../src/core/battle';
import { ASK_BONUS, ASK_TIER, BOARD_SIZE, PAY_PER_HEAD, swarmContract } from '../../src/core/board';
import { applySettlement } from '../../src/core/economy';
import { FORECAST_PLAYS } from '../../src/core/forecast';
import { CHAMPION_RANK } from '../../src/core/arena';
import { CROWN_BONUS, MASTER_PURSE, askBonus, crownHeld, masterPurse, mastersOpen, recordMasterWin } from '../../src/core/masters';
import { RANGE_MAX, rangeLimit, sparEnemy } from '../../src/core/range';
import { MASTERS } from '../../src/content/masters';
import { computeBuildStats, weaponIn } from '../../src/core/build';
import { LOADOUT_SLOTS, newGame, saveLoadout } from '../../src/core/game';
import { JOB_KINDS, JOB_NUMBERS, JOB_TIER, jobContract, jobKind, makeJob } from '../../src/core/jobs';
import { NAME_AT, RENOWN, renownOf } from '../../src/core/renown';
import { tallyBattle } from '../../src/core/stats';
import { drillMission, drillSettlement, recordDrill } from '../../src/core/training';
import type { Catalog, Weapon } from '../../src/core/types';
import { ARENA, ARENA_ENEMIES } from '../../src/content/arena';
import { BOARD_TEXT } from '../../src/content/board';
import { MANUAL, UNITS, WORLD } from '../../src/content/codex';
import { DRILLS } from '../../src/content/drills';
import { ENEMIES } from '../../src/content/enemies';
import { MEDALS } from '../../src/content/medals';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, DEMO_BUILD, SHOP_PARTS, STARTER_BUILD } from '../../src/content/parts';
import { SCENES } from '../../src/content/scenes';
import { STRINGS } from '../../src/content/strings';
import { REFERENCE_NL } from '../../src/content/nl/reference';
import { BattleFlow } from '../../src/ui/battleFlow';
import { BattleScreen, FREIGHT_BURNS } from '../../src/ui/battleScreen';
import { GarageFlow } from '../../src/ui/garageFlow';
import { CROWN_PAINTS, paintsFor } from '../../src/ui/paint';
import { sprites } from '../helpers/app';
import { record } from '../helpers/canvas';

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

describe('the odds', () => {
  test('the manual says how many times the contract is flown, by whom, and with what', () => {
    const text = topic('odds');
    // The number of flights is the number the count flies.
    expect(text).toContain(`${STRINGS.actions.auto} flies it ${FORECAST_PLAYS} times`);
    // What the page calls the pilot is what the battle's own row calls it, and the page about the build says the same.
    expect(STRINGS.briefing.oddsNote).toContain(STRINGS.actions.auto);
    // Each thing it says is counted is a thing a fight is started from.
    expect(text).toContain('with your perks, bench work, Overdrive, wingman and difficulty');
    expect(text).toMatch(/Another build is another count\./);
    expect(text).toMatch(/flying it yourself, you can do better\.$/);
  });
});

describe('the range', () => {
  test('the manual says where it is, what can be fielded and how many, that the fight is real, and that nothing of it is kept', () => {
    const text = topic('range');
    expect(text).toMatch(/^The simulator's second page \(L1\/R1\) is the range: your own build against any machine you have met/);
    // Three of a light machine, one of a mech or of anything that belongs to the story.
    expect(RANGE_MAX).toBe(3);
    expect(text).toContain('up to three of the lighter ones, one of a mech or anything of the story\'s');
    expect([rangeLimit('recon-drone'), rangeLimit('heavy-mech'), rangeLimit('leviathan')]).toEqual([3, 1, 1]);
    expect(text).toContain('A real fight: perks, bench work, Overdrive and difficulty all count.');
    expect(text).toMatch(/Nothing is billed, paid or counted; afterwards you see what it would have cost\.$/);
    // The page it names is on the simulator's own tabs, and the briefing says the same of the bill.
    expect(STRINGS.training.pages.range).toBe('TEST RANGE');
    expect(STRINGS.training.rangeFree).toContain('Nothing here is billed, paid or counted.');
  });
});

describe('sparring', () => {
  test('the manual says what is sparred with, how it is made and flown, and that nothing of it is kept', () => {
    const text = topic('spar');
    expect(text).toMatch(/^The range also lists your saved builds that can be flown\./);
    // The same parts, with the bench's work on them, in colours that are not the pilot's.
    const game = { ...newGame(CATALOG, STARTER_BUILD), loadouts: [STARTER_BUILD, null, null], tuning: { 'gen-kd1': 1 }, paint: 'obsidian' };
    const opponent = sparEnemy(game, 0, 'Saved Build 1', CATALOG);
    expect(text).toContain('the same parts, with the bench\'s work on them, in other colours, flown as its class is flown');
    expect(opponent).toMatchObject({ build: STARTER_BUILD, tune: { 'gen-kd1': 1 }, ai: CLASS_AI[archetypeOf(STARTER_BUILD, CATALOG)] });
    expect(opponent.paint).not.toBe(game.paint);
    expect(text).toMatch(/Nothing is billed, paid or counted\.$/);
  });
});

describe('the garage', () => {
  test('the manual says how many builds can be kept, that it is room for one of each class, and that each goes by its class, in both languages', () => {
    const text = topic('garage');
    const count = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][LOADOUT_SLOTS];
    const aantal = ['geen', 'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen'][LOADOUT_SLOTS];
    expect(LOADOUT_SLOTS).toBe(ARCHETYPES.length);
    expect(text).toMatch(new RegExp(` Left and right open your ${count} saved builds: room for one of each class, each listed by the class it is\\.$`));
    expect(REFERENCE_NL[text]).toMatch(new RegExp(` Links en rechts: je ${aantal} bewaarde builds, plek voor een van elke klasse, elk bij zijn klasse genoemd\\.$`));
    // As many rows as it says, and a build kept in one goes by the class it is.
    const flow = new GarageFlow(saveLoadout(newGame(CATALOG, STARTER_BUILD), LOADOUT_SLOTS - 1), CATALOG);
    flow.onInput('right');
    expect(flow.loadouts.items).toHaveLength(LOADOUT_SLOTS);
    expect(flow.loadouts.items[LOADOUT_SLOTS - 1].label).toBe(`${LOADOUT_SLOTS}  ${STRINGS.classes.names[archetypeOf(STARTER_BUILD, CATALOG)]}`);
  });
});

describe('what is guarded', () => {
  test('the manual says that freight stands on the field and how much is left of it when it burns, in both languages', () => {
    const text = topic('objectives');
    const fraction = ['', 'all', 'a half', 'a third', 'a quarter'];
    const deel = ['', 'alles', 'de helft', 'een derde', 'een kwart'];
    expect(text).toMatch(new RegExp(` Freight you guard stands on the field; if it burns, ${fraction[FREIGHT_BURNS]} or less is left\\.$`));
    expect(REFERENCE_NL[text]).toMatch(new RegExp(` Vracht die je bewaakt staat op het veld: brandt die, dan rest ${deel[FREIGHT_BURNS]} of minder\\.$`));
    // It stands there: every escort the board has names a picture for its freight, and the field shows it where the battle has it.
    for (let seed = 1; seed <= 40; seed++) {
      const [battle] = makeJob('escort', 1 + (seed % 8), seed, BOARD_TEXT).battles;
      const state = createBattle(STARTER_BUILD, battle.enemies.map((id) => ENEMIES[id]), CATALOG, seed, { objective: battle.objective });
      const screen = new BattleScreen(new BattleFlow(state, CATALOG, { quiet: true }), sprites, CATALOG, { fast: true, background: battle.background });
      expect(screen.freight, `escort ${seed}`).toMatchObject({ sprite: (battle.objective as { sprite: string }).sprite });
    }
    // The fraction is the screen's own: a flame is drawn on it from there down and not before, whatever it could take.
    const burning = (hp: number, max: number): boolean => {
      const state = createBattle(STARTER_BUILD, [ENEMIES['recon-drone']], CATALOG, 5, { objective: { type: 'protect', name: 'Convoy', hp: max, sprite: 'asset-convoy' } });
      state.asset!.hp = hp;
      const flow = new BattleFlow(state, CATALOG, { quiet: true });
      const screen = new BattleScreen(flow, sprites, CATALOG, { fast: false, background: 'bg-mine' });
      for (let i = 0; i < 4000 && (screen.banner || flow.phase !== 'action'); i++) screen.update(16);
      return record((ctx) => screen.draw(ctx)).rects.some((rect) => rect.color === '#ff8a3c' && rect.w === 3 && rect.h === 2);
    };
    for (const max of [9, 10, 11, 12, 20]) {
      const most = Math.floor(max / FREIGHT_BURNS);
      expect([burning(max, max), burning(most + 1, max), burning(most, max), burning(1, max)], `of ${max}`).toEqual([false, false, true, true]);
    }
  });
});

describe('the jobs', () => {
  test('the manual says when there is one, how many kinds there are, what each is called and asks, and when they turn, in both languages', () => {
    const text = topic('jobs');
    // Beside the board's three, once the board has grown: from its first tier, which is five contracts won.
    expect(text).toMatch(/^Once the board has grown a little, a job stands beside its three\./);
    expect([BOARD_SIZE, JOB_TIER]).toEqual([3, 1]);
    expect([4, 5].map((wins) => jobContract(wins, 0, BOARD_TEXT) !== null)).toEqual([false, true]);
    const count = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
    const aantal = ['geen', 'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven'];
    expect(text).toContain(`Its title says which of ${count[JOB_KINDS.length]} it is.`);
    // Each kind by the word its titles begin with, in the order they turn in.
    const words = { hit: 'Hit', repo: 'Repo', escort: 'Escort', hold: 'Hold' } as const;
    const woorden = { hit: 'Doelwit', repo: 'Beslag', escort: 'Escorte', hold: 'Stand' } as const;
    const dutch = REFERENCE_NL[text];
    let at = -1;
    let op = -1;
    for (const kind of JOB_KINDS) {
      for (const title of BOARD_TEXT.jobs[kind].titles) expect(title.startsWith(`${words[kind]}: `), title).toBe(true);
      expect(text.indexOf(`${words[kind]}: `)).toBeGreaterThan(at);
      at = text.indexOf(`${words[kind]}: `);
      expect(dutch.indexOf(`${woorden[kind]}: `)).toBeGreaterThan(op);
      op = dutch.indexOf(`${woorden[kind]}: `);
    }
    expect(text).toContain('Hit: paid for one machine, over when it falls.');
    expect(text).toContain("Repo: take that machine's arms and legs and leave its core.");
    expect(text).toContain('Escort: whatever stands wears the freight down each round.');
    expect(text).toContain(`Hold: last ${count[JOB_NUMBERS.holdRounds]} rounds.`);
    expect(dutch).toContain(`welke van de ${aantal[JOB_KINDS.length]}.`);
    expect(dutch).toContain(`Stand: houd ${aantal[JOB_NUMBERS.holdRounds]} rondes vol.`);
    // They turn with every contract won: that is what the board counts, one for each bill that says won.
    expect(text).toMatch(/They turn with every contract won\.$/);
    expect(REFERENCE_NL[text]).toMatch(/Ze wisselen na elk gewonnen contract\.$/);
    const before = newGame(CATALOG, STARTER_BUILD);
    expect(applySettlement(before, { won: true, reward: 100, ammoCost: 0, repairCost: 0, net: 100, lines: [] }).battlesWon).toBe(before.battlesWon + 1);
    expect(applySettlement(before, { won: false, reward: 0, ammoCost: 0, repairCost: 0, net: 0, lines: [] }).battlesWon).toBe(before.battlesWon);
    for (let wins = 5; wins < 40; wins++) expect(jobKind(wins + 1, 0)).toBe(JOB_KINDS[(JOB_KINDS.indexOf(jobKind(wins, 0)) + 1) % JOB_KINDS.length]);
  });

  test('the chapter on a class wanted still says true: it is one of the board\'s three that asks, never the job', () => {
    expect(topic('asks')).toContain('one of its three open contracts wants a class');
    for (let wins = 5; wins < 120; wins++) expect(jobContract(wins, 0, BOARD_TEXT)!.asks).toBeUndefined();
  });
});

describe('the masters', () => {
  test('the manual says how many there are, who may challenge them, what the purse is, and what takes the crown', () => {
    const text = topic('masters');
    expect(text).toMatch(/^The arena's second page \(L1\/R1\): seven masters, one of each class, who take challenges from the champion\./);
    expect(MASTERS).toHaveLength(7);
    expect(MASTERS.map((master) => master.kind)).toEqual([...ARCHETYPES]);
    const game = newGame(CATALOG, STARTER_BUILD);
    expect([mastersOpen({ arenaRank: CHAMPION_RANK - 1 }), mastersOpen({ arenaRank: CHAMPION_RANK })]).toEqual([false, true]);
    // Any build may fight one, for a purse: in full the first time, a quarter after.
    expect(text).toContain('Any build may fight one, for a purse: in full the first time, a quarter after.');
    const beaten = recordMasterWin(game, 'bastion', 'lancer');
    expect([masterPurse(game, 'bastion'), masterPurse(beaten, 'bastion')]).toEqual([MASTER_PURSE, MASTER_PURSE / 4]);
    expect(crownHeld(beaten, 'bastion')).toBe(false);
    // In a build of their own class, the crown.
    expect(text).toContain('Beat a master in a build of their own class and the crown of that class is yours.');
    expect(crownHeld(recordMasterWin(game, 'bastion', 'bastion'), 'bastion')).toBe(true);
    expect(text).toMatch(/The briefing says which build that is\.$/);
    expect(STRINGS.arena.pages.masters).toBe('MASTERS');
  });
});

describe('crowns', () => {
  test('the manual says what a crown gives: it is kept, it is marked, its paint is the holder\'s, and the board pays the holder more', () => {
    const text = topic('crowns');
    expect(text).toMatch(/^A crown is kept for good, through every telling\./);
    const game = newGame(CATALOG, STARTER_BUILD);
    const holder = recordMasterWin(game, 'bastion', 'bastion');
    // The garage offers the holder the master's own paint, and nobody else.
    expect(text).toContain("The garage offers the holder the master's own paint.");
    const paint = CROWN_PAINTS.find((scheme) => scheme.crown === 'bastion')!.id;
    expect(MASTERS.find((master) => master.kind === 'bastion')!.paint).toBe(paint);
    expect(paintsFor(holder)).toContain(paint);
    expect(paintsFor(game)).not.toContain(paint);
    // Half as much again, where anyone else is paid a quarter more.
    expect(text).toMatch(/pays the holder half as much again, where it pays anyone else a quarter more\.$/);
    expect([askBonus(holder, 'bastion'), askBonus(game, 'bastion'), askBonus(holder, 'lancer')]).toEqual([0.5, 0.25, 0.25]);
    expect([CROWN_BONUS, ASK_BONUS]).toEqual([0.5, 0.25]);
  });
});

describe('the class wanted', () => {
  test('the manual says how many contracts ask, how the list and the briefing say so, and what it pays', () => {
    const text = topic('asks');
    // Not on the first boards; from then on one of the board's three.
    expect(ASK_TIER).toBeGreaterThan(0);
    expect(text).toMatch(/^Once the board has grown a little, one of its three open contracts wants a class/);
    expect(BOARD_SIZE).toBe(3);
    // A plus on the list, the class in the briefing.
    expect(text).toContain('its pay on the list ends in a plus, and its briefing says which');
    // Anything wins it; the class it wants is paid a quarter more.
    expect(text).toContain('It can be won as anything; won in a build of that class it pays a quarter more');
    expect(ASK_BONUS).toBe(0.25);
    // The row it sends the pilot to goes by the row's own name.
    expect(text).toContain(`on the ${STRINGS.briefing.build} row`);
  });
});

describe('the classes', () => {
  test('the manual names all seven in the order they are asked about, with the figures the rules go by, and each is what it says of a build that fits it', () => {
    const text = topic('classes');
    expect(ARCHETYPES).toHaveLength(7);
    expect(text).toContain('one of seven classes, the first it fits');
    // Named in the order of the rules, each by the name the game gives it.
    const names = ARCHETYPES.map((kind) => STRINGS.classes.names[kind]);
    expect(names).toEqual(['Duellist', 'Sharpshooter', 'Artillery', 'Lancer', 'Bastion', 'Skirmisher', 'All-rounder']);
    const at = names.map((name) => text.indexOf(name));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(text).toContain(`legs of MOB ${SLOW_LEGS} or less a Bastion`);
    expect(text).toContain(`legs of MOB ${QUICK_LEGS} or more a Skirmisher`);
    // And each clause is true of the plainest build that fits it.
    const hauler = (extra: object) => archetypeOf({ ...STARTER_BUILD, rightHand: undefined, ...extra }, CATALOG);
    expect(hauler({ rightHand: 'wpn-arc-blade' })).toBe('duellist');
    expect(hauler({ rightHand: 'wpn-coil-pistol' })).toBe('marksman');
    expect(hauler({ rightHand: 'wpn-rivet-rifle', shoulder: 'wpn-micro-salvo' })).toBe('artillery');
    expect(hauler({ rightHand: 'wpn-arc-pistol', leftHand: 'wpn-pulse-carbine' })).toBe('lancer');
    expect(hauler({ rightHand: 'wpn-rivet-rifle', leftHand: 'shd-plate' })).toBe('bastion');
    expect(hauler({ rightHand: 'wpn-rivet-rifle', legs: 'legs-dozer' })).toBe('bastion');
    expect(hauler({ rightHand: 'wpn-rivet-rifle', legs: 'legs-courier' })).toBe('skirmisher');
    expect(hauler({ rightHand: 'wpn-rivet-rifle' })).toBe('allrounder');
  });

  test('what the page says each class is good at is true of the parts that make one', () => {
    const N = STRINGS.classes.notes;
    const weapons = SHOP_PARTS.filter((part): part is Weapon => part.kind === 'weapon');
    // A blade never runs dry, and no blade strikes without a boost.
    expect(N.duellist).toContain('it never runs dry');
    expect(N.duellist).toContain('Every strike needs a boost first');
    const blades = weapons.filter((weapon) => weapon.melee);
    expect(blades.length).toBeGreaterThan(0);
    expect(blades.every((weapon) => weapon.ammo === null)).toBe(true);
    for (const blade of blades) {
      const s = toPlayer(createBattle({ ...STARTER_BUILD, rightHand: blade.id }, [ENEMIES['gun-turret']], CATALOG, 3));
      expect(checkAction(s, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' }, CATALOG), blade.id).toBe('needsBoost');
    }
    // No energy weapon has anything to reload or bills anything for a shot; and energy weapons are the hot ones.
    expect(N.lancer).toContain('Nothing to reload and no bill for a shot');
    const energy = weapons.filter((weapon) => weapon.damageType === 'energy');
    expect(energy.every((weapon) => weapon.ammo === null && weapon.costPerShot === 0)).toBe(true);
    const guns = weapons.filter((weapon) => weapon.mount === 'hand' && !weapon.melee && !weapon.charge);
    const mean = (list: Weapon[], of: (weapon: Weapon) => number): number => list.reduce((sum, weapon) => sum + of(weapon), 0) / list.length;
    const hot = (weapon: Weapon): number => weapon.heat / weapon.damage;
    const hungry = (weapon: Weapon): number => weapon.energy / weapon.damage;
    expect(mean(guns.filter((w) => w.damageType === 'energy'), hot)).toBeGreaterThan(mean(guns.filter((w) => w.damageType !== 'energy'), hot));
    expect(mean(guns.filter((w) => w.damageType === 'energy'), hungry)).toBeGreaterThan(mean(guns.filter((w) => w.damageType !== 'energy'), hungry));
    // There are energy weapons that heat the other machine and energy weapons that drain it.
    expect(N.lancer).toContain('Thermal and drain weapons');
    expect(energy.some((weapon) => weapon.trait === 'thermal') && energy.some((weapon) => weapon.trait === 'drain')).toBe(true);
    // A weapon that charges fires in the turn after; a salvo is one shot at every machine.
    expect(N.marksman).toContain('Charges in one turn and fires in the next');
    expect(STRINGS.partInfo.charge).toBe('CHARGE: fires a turn later');
    expect(N.artillery).toContain('One salvo is fired at every machine on the field');
    expect(STRINGS.partInfo.traits.salvo()).toBe('SALVO: hits every enemy');
    // The legs that make a bastion are the ones that carry the most; the ones that make a skirmisher carry the least.
    expect(N.bastion).toContain('legs that carry the heaviest plate');
    const legs = SHOP_PARTS.filter((part) => part.kind === 'legs') as (typeof SHOP_PARTS[number] & { mobility: number; capacity: number })[];
    const byLoad = [...legs].sort((a, b) => b.capacity - a.capacity);
    expect(byLoad.slice(0, 2).every((part) => part.mobility <= SLOW_LEGS)).toBe(true);
    const slow = legs.filter((part) => part.mobility <= SLOW_LEGS);
    const quick = legs.filter((part) => part.mobility >= QUICK_LEGS);
    expect(Math.min(...slow.map((part) => part.capacity))).toBeGreaterThan(Math.max(...quick.map((part) => part.capacity)));
    // And the quick ones act first: the round goes by mobility.
    expect(N.skirmisher).toContain('first to act');
    expect(topic('turn')).toContain('The more mobile unit acts first each round');
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

describe('the manual on a pilot who outguns the field', () => {
  /** The words the manual writes its small numbers in. */
  const WORD: Record<number, string> = { 0.5: 'half', 1: 'one', 1.5: 'one and a half', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 8: 'eight', 40: 'forty' };
  const word = (n: number): string => { expect(WORD[n], String(n)).toBeDefined(); return WORD[n]; };
  const rifle = CATALOG['wpn-rivet-rifle'] as Weapon;
  const doing = (damage: number): Catalog => ({ ...CATALOG, 'wpn-rivet-rifle': { ...rifle, damage } });
  const HEAVY = doing(900);
  const drone = ENEMIES['recon-drone'];
  const turret = ENEMIES['gun-turret'];
  const shoot = (s: BattleState, target: string, catalog: Catalog): BattleState =>
    applyAction(s, { type: 'fire', weapon: 'rightHand', target, part: 'core' }, catalog, () => 0);
  const felled = (s: BattleState): unknown[] => s.events.filter((e) => e.type === 'unitDestroyed');
  const said = (s: BattleState, type: string): number => s.events.filter((e) => e.type === type).length;

  describe('Momentum', () => {
    test('holds where the banner says so: two or more machines, none of which a fight is about', () => {
      expect(topic('momentum')).toMatch(new RegExp(`^Where the banner says ${STRINGS.battleIntro.open} \\(two or more machines, none of them a boss, a named pilot, an elite, a Bailiff or an objective's target\\)`));
      const open = (enemies: string[], opts: Parameters<typeof createBattle>[4] = {}): boolean => createBattle(DEMO_BUILD, enemies.map((id) => ENEMIES[id]), CATALOG, 2, opts).open;
      expect(open(['recon-drone', 'gun-turret'])).toBe(true);
      // Not against one machine; with more to come behind it, it is not one machine.
      expect(open(['gun-turret'])).toBe(false);
      expect(open(['gun-turret'], { reserve: [drone] })).toBe(true);
      // A boss, a named pilot, an elite, a Bailiff, an objective's target: each beside a drone.
      expect(open(['strip-miner', 'recon-drone'])).toBe(false);
      expect(open(['magpie', 'recon-drone'])).toBe(false);
      expect(open(['gun-turret', 'recon-drone'], { marks: { 0: 'swift' } })).toBe(false);
      expect(open(['bailiff', 'recon-drone'])).toBe(false);
      for (const objective of [{ type: 'leader', target: 0 }, { type: 'disable', target: 0 }, { type: 'driveOff', target: 0, share: 0.4 }] as const) {
        expect(open(['light-mech', 'recon-drone'], { objective }), objective.type).toBe(false);
      }
    });

    test('a volley that destroys one pays for itself: the weapon is ready again and its energy comes back; heat and rounds stay spent', () => {
      expect(topic('momentum')).toContain('a volley that destroys one pays for itself: the weapon is ready again, its energy comes back, and the run is counted');
      expect(topic('momentum')).toContain('Heat and rounds stay spent');
      const before = toPlayer(createBattle(DEMO_BUILD, [drone, drone, turret], HEAVY, 2));
      const had = before.units[0];
      const after = shoot(before, 'enemy-0', HEAVY);
      const have = after.units[0];
      expect(after.units[1].destroyed).toBe(true);
      expect(have.fired).not.toContain('rightHand');
      expect(have.energy).toBe(had.energy);
      expect(have.heat).toBe(had.heat + rifle.heat);
      expect(have.ammo.rightHand).toBe(had.ammo.rightHand! - 1);
      // A volley that destroys nothing pays for nothing.
      const missed = applyAction(before, { type: 'fire', weapon: 'rightHand', target: 'enemy-0', part: 'core' }, HEAVY, () => 0.999);
      expect(missed.units[0].fired).toContain('rightHand');
      expect(missed.units[0].energy).toBe(had.energy - rifle.energy);
    });

    test('the run is counted as the screen counts it, from the second machine of a turn', () => {
      expect(topic('momentum')).toContain(`the run is counted (${STRINGS.fx.chain(2)})`);
      let s = toPlayer(createBattle(DEMO_BUILD, [drone, drone, turret], HEAVY, 2));
      s = shoot(s, 'enemy-0', HEAVY);
      expect(s.units[0].chain).toBe(1);
      s = shoot(s, 'enemy-1', HEAVY);
      expect(s.units[0].chain).toBe(2);
      expect(s.events.filter((e) => e.type === 'momentum').map((e) => (e.type === 'momentum' ? e.chain : 0))).toEqual([1, 2]);
    });

    test('a charged weapon must charge again: the kill gives back the firing of it, not the charge', () => {
      expect(topic('momentum')).toMatch(/a charged weapon must charge again\.$/);
      const gauss = CATALOG['wpn-gauss'] as Weapon;
      expect(gauss.charge).toBe(true);
      const catalog: Catalog = { ...CATALOG, 'wpn-gauss': { ...gauss, damage: 900 } };
      const state = structuredClone(toPlayer(createBattle({ ...DEMO_BUILD, shoulder: 'wpn-gauss' }, [drone, drone, turret], catalog, 2)));
      state.units[0].charged = ['shoulder'];
      const after = applyAction(state, { type: 'fire', weapon: 'shoulder', target: 'enemy-0', part: 'core' }, catalog, () => 0);
      expect(after.units[1].destroyed).toBe(true);
      expect(after.units[0].charged).toEqual([]);
      expect(checkAction(after, { type: 'fire', weapon: 'shoulder', target: 'enemy-1', part: 'core' }, catalog)).toBe('notCharged');
      expect(checkAction(after, { type: 'charge', weapon: 'shoulder' }, catalog)).toBeNull();
    });
  });

  describe('Shatter', () => {
    test('one hit of the pilot\'s that takes half of a core finishes the machine, and the manual says half', () => {
      expect(topic('shatter')).toContain(`one hit of yours that takes ${word(SHATTER)} of a machine's core, as it stood at full strength, finishes it`);
      // A drone's shell is fifty: twenty-five goes through it, twenty-four does not.
      const through = toPlayer(createBattle(DEMO_BUILD, [drone, turret], doing(25), 2));
      expect(previewShot(through, 'player', 'rightHand', 'enemy-0', 'core', doing(25))).toMatchObject({ shatter: true, kills: true });
      expect(previewShot(through, 'player', 'rightHand', 'enemy-0', 'core', doing(24))).toMatchObject({ shatter: false, kills: false });
      // "As it stood at full strength": of a drone with ten left, twenty-four is enough, and is no shattering.
      const worn = structuredClone(through);
      worn.units[1].parts.core!.ap = 10;
      expect(previewShot(worn, 'player', 'rightHand', 'enemy-0', 'core', doing(24))).toMatchObject({ shatter: false, kills: true });
      expect(topic('shatter')).toContain(`The aiming line says ${STRINGS.preview.kills}`);
    });

    test('it is never done to the pilot, and a wingman\'s fire does not do it', () => {
      expect(topic('shatter')).toMatch(/It is never done to you, and a wingman's fire does not do it\.$/);
      const gun = weaponIn(turret.build, 'rightHand', CATALOG) ?? weaponIn(turret.build, 'shoulder', CATALOG)!;
      const cruel: Catalog = { ...CATALOG, [gun.id]: { ...gun, damage: 5000 } };
      const mine = createBattle(DEMO_BUILD, [turret, turret], cruel, 2);
      const slot = Object.entries(turret.build).find(([, id]) => id === gun.id)![0] as 'rightHand';
      expect(previewShot(mine, 'enemy-0', slot, 'player', 'core', cruel).shatter).toBe(false);
      // The ally fires as a round begins, from the second: forty of a drone's fifty is four fifths of it, and the drone stands.
      let s = toPlayer(createBattle(DEMO_BUILD, [drone, drone], doing(1), 2, { support: { name: 'Old Sixty', damage: 40 } }));
      s = toPlayer(applyAction(s, { type: 'endTurn' }, doing(1)));
      const struck = s.events.filter((e) => e.type === 'support');
      expect(struck).toHaveLength(1);
      expect(s.units.filter((u) => u.side === 'enemy').map((u) => [u.destroyed, u.parts.core!.ap]).sort((x, y) => Number(x[1]) - Number(y[1]))).toEqual([[false, 10], [false, 50]]);
    });
  });

  describe('Overkill', () => {
    test('one and a half times the whole core in one hit, in any fight, and the manual says so', () => {
      expect(topic('overkill')).toContain(`does at least ${word(OVERKILL)} times its whole core, as it stood at full strength, is an ${STRINGS.fx.overkill}:`);
      const open = toPlayer(createBattle(DEMO_BUILD, [drone, turret], doing(75), 2));
      expect(felled(shoot(open, 'enemy-0', doing(75)))).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0', overkill: true }]);
      expect(felled(shoot(open, 'enemy-0', doing(74)))).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0' }]);
      // "It is said in any fight": of one machine too, where nothing else of this holds.
      expect(topic('overkill')).toContain('It is said in any fight and changes nothing.');
      const duel = toPlayer(createBattle(DEMO_BUILD, [drone], doing(75), 2));
      expect(duel.open).toBe(false);
      expect(felled(shoot(duel, 'enemy-0', doing(75)))).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0', overkill: true }]);
    });

    test('how worn the machine already was makes no difference, either way', () => {
      expect(topic('overkill')).toMatch(/How worn the machine already was makes no difference\.$/);
      const open = toPlayer(createBattle(DEMO_BUILD, [drone, turret], doing(75), 2));
      for (const left of [50, 20, 1]) {
        const worn = structuredClone(open);
        worn.units[1].parts.core!.ap = left;
        // Seventy-five is a drone and a half whatever is left of the drone; seventy-four is not, whatever is left of it.
        expect(felled(shoot(worn, 'enemy-0', doing(75))), `75 on ${left}`).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0', overkill: true }]);
        expect(felled(shoot(worn, 'enemy-0', doing(74))), `74 on ${left}`).toEqual([{ type: 'unitDestroyed', unit: 'enemy-0' }]);
      }
    });
  });

  describe('They Break', () => {
    test('what still stands loses its nerve at the second machine destroyed with the pilot\'s weapons in a turn, not the first', () => {
      expect(topic('rout')).toMatch(new RegExp(`^Destroy ${word(2)} machines with your weapons in one turn of the same fights`));
      let s = toPlayer(createBattle(DEMO_BUILD, [drone, drone, turret], HEAVY, 2));
      s = shoot(s, 'enemy-0', HEAVY);
      expect(s.units.some((u) => u.shaken)).toBe(false);
      s = shoot(s, 'enemy-1', HEAVY);
      expect(s.units.filter((u) => u.shaken).map((u) => u.id)).toEqual(['enemy-2']);
      expect(topic('rout')).toContain(`It is marked ${STRINGS.tags.shaken}`);
    });

    test('"with your weapons": what a module destroys, however many, shakes nobody and readies nothing', () => {
      // A Shock Pulse over three machines, two of which have a point of core left.
      const start = structuredClone(toPlayer(createBattle({ ...DEMO_BUILD, module: 'mod-shock' }, [drone, drone, turret], CATALOG, 2)));
      start.units[1].parts.core!.ap = 1;
      start.units[2].parts.core!.ap = 1;
      const after = applyAction(start, { type: 'module' }, CATALOG);
      expect(after.units.filter((u) => u.side === 'enemy').map((u) => u.destroyed)).toEqual([true, true, false]);
      expect(after.units[0].chain).toBe(0);
      expect(said(after, 'momentum') + said(after, 'shaken')).toBe(0);
      // One by the pulse and then one by the rifle is one with a weapon: nobody loses their nerve.
      const mixed = structuredClone(toPlayer(createBattle({ ...DEMO_BUILD, module: 'mod-shock' }, [drone, drone, turret], HEAVY, 2)));
      mixed.units[1].parts.core!.ap = 1;
      const one = shoot(applyAction(mixed, { type: 'module' }, HEAVY), 'enemy-1', HEAVY);
      expect(one.units.filter((u) => u.side === 'enemy').map((u) => u.destroyed)).toEqual([true, true, false]);
      expect(one.units[0].chain).toBe(1);
      expect(said(one, 'shaken')).toBe(0);
    });

    test('it is out of the fight when its turn comes, without firing: it leaves, or shuts down if it cannot move, under the words the manual gives', () => {
      expect(topic('rout')).toContain(`is out of the fight when its turn comes, without firing: it leaves (${STRINGS.fx.rout}), or shuts down if it cannot move (${STRINGS.fx.offline})`);
      const shots = (s: BattleState): number => s.events.filter((e) => e.type === 'shot' && e.unit === 'enemy-2').length;
      for (const [third, fixed] of [['light-mech', false], ['gun-turret', true]] as const) {
        const shaken = shoot(shoot(toPlayer(createBattle(DEMO_BUILD, [drone, drone, ENEMIES[third]], HEAVY, 2)), 'enemy-0', HEAVY), 'enemy-1', HEAVY);
        const s = applyAction(shaken, { type: 'endTurn' }, HEAVY);
        expect(s.units.find((u) => u.id === 'enemy-2')).toMatchObject({ destroyed: true });
        expect(s.events.filter((e) => e.type === 'rout')).toEqual([{ type: 'rout', unit: 'enemy-2', ...(fixed ? { fixed: true } : {}) }]);
        // Whatever it fired before it lost its nerve, it fires nothing after.
        expect(shots(s), third).toBe(shots(shaken));
      }
    });

    test('"that is not a kill": the record counts what was destroyed, and a machine that left is not among it', () => {
      expect(topic('rout')).toMatch(/That is not a kill: destroy it first if you want it counted\.$/);
      let s = toPlayer(createBattle(DEMO_BUILD, [drone, drone, turret], HEAVY, 2));
      s = shoot(shoot(s, 'enemy-0', HEAVY), 'enemy-1', HEAVY);
      const left = applyAction(s, { type: 'endTurn' }, HEAVY);
      expect(left.outcome).toBe('victory');
      expect(tallyBattle(left).kills).toBe(2);
      // Destroyed first, it is counted.
      const taken = shoot(s, 'enemy-2', HEAVY);
      expect(taken.outcome).toBe('victory');
      expect(tallyBattle(taken).kills).toBe(3);
    });
  });

  describe('Swarms', () => {
    const swarm = (more: number): BattleState => toPlayer(createBattle(DEMO_BUILD, [drone, drone, drone], HEAVY, 2, { reserve: Array.from({ length: more }, () => drone) }));
    const standing = (s: BattleState): number => s.units.filter((u) => u.side === 'enemy' && !u.destroyed).length;

    test('a field holds three, and the manual says three stand at a time', () => {
      expect(topic('swarm')).toContain(`${word(MAX_ENEMIES)[0].toUpperCase()}${word(MAX_ENEMIES).slice(1)} stand at a time`);
      expect(standing(swarm(4))).toBe(MAX_ENEMIES);
    });

    test('the next come on as a round begins, and not before', () => {
      expect(topic('swarm')).toContain('as a round begins the next come on where others fell or left');
      let s = swarm(4);
      const round = s.round;
      s = shoot(s, 'enemy-0', HEAVY);
      // The pilot's turn goes on with two standing and four behind them.
      expect([s.round, standing(s), s.reserve.length, said(s, 'arrive')]).toEqual([round, 2, 4, 0]);
      s = toPlayer(applyAction(s, { type: 'endTurn' }, HEAVY));
      expect([s.round, standing(s), s.reserve.length, said(s, 'arrive')]).toEqual([round + 1, 3, 3, 1]);
    });

    test('the battle is not won until none are still to come', () => {
      expect(topic('swarm')).toContain('the battle is not won until that is none');
      let s = swarm(1);
      for (const id of ['enemy-0', 'enemy-1', 'enemy-2']) s = shoot(s, id, HEAVY);
      expect([standing(s), s.reserve.length, s.outcome]).toEqual([0, 1, 'ongoing']);
      s = toPlayer(applyAction(s, { type: 'endTurn' }, HEAVY));
      expect([standing(s), s.reserve.length, s.outcome]).toEqual([1, 0, 'ongoing']);
      expect(shoot(s, 'enemy-3', HEAVY).outcome).toBe('victory');
    });

    test('the swarm on the open board pays by the head', () => {
      expect(topic('swarm')).toMatch(/The swarm on the open board pays by the head\.$/);
      const pays = new Set<number>();
      for (let wins = 0; wins < 40; wins++) {
        const mission = swarmContract(wins, 0, BOARD_TEXT);
        const heads = mission.battles[0].enemies.length + mission.battles[0].reserve!.length;
        expect(mission.reward).toBe(PAY_PER_HEAD * heads);
        pays.add(mission.reward);
      }
      // Six heads and nine heads do not pay the same.
      expect(pays.size).toBeGreaterThan(2);
    });
  });

  describe('A Name', () => {
    test('a name is earned at the rates the manual gives, and there are as many names as it says', () => {
      expect(topic('renown')).toContain(
        `Every machine counts ${word(RENOWN.kill)}, a boss ${word(RENOWN.boss)}, a rank of the arena ${word(RENOWN.arena)}, a telling of the story ${word(RENOWN.cycle)}.`,
      );
      expect(topic('renown')).toContain(`There are ${word(NAME_AT.length)} names`);
      expect(STRINGS.renown.names).toHaveLength(NAME_AT.length);
      const game = newGame(CATALOG, STARTER_BUILD, 'VANTA');
      const with_ = (change: Partial<typeof game.stats>, more: Partial<typeof game> = {}) => renownOf({ ...game, ...more, stats: { ...game.stats, ...change } });
      expect(renownOf(game)).toBe(0);
      expect(with_({ kills: 7 })).toBe(7 * RENOWN.kill);
      expect(with_({ bosses: 2 })).toBe(2 * RENOWN.boss);
      expect(with_({}, { arenaRank: 3 })).toBe(3 * RENOWN.arena);
      expect(with_({}, { cycle: 2 })).toBe(2 * RENOWN.cycle);
    });

    test('"on contracts": it is the record of contract work that is read, which the simulator and the Gauntlet do not write in', () => {
      expect(topic('renown')).toMatch(/^What you destroy on contracts earns you a name\./);
      // A drill passed changes the drills passed and what was paid for it, and nothing of the record.
      const game = newGame(CATALOG, STARTER_BUILD, 'VANTA');
      const drill = drillMission(game, DRILLS[0], 'Simulator');
      const passed = recordDrill(game, drillSettlement(true, drill), drill);
      expect(passed.stats).toEqual(game.stats);
      expect(renownOf(passed)).toBe(renownOf(game));
    });
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
