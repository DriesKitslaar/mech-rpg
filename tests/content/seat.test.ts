import { chooseAutoPlayerAction, runBattle, stepBattle } from '../../src/core/ai';
import { ARCHETYPES, CLASS_AI, archetypeOf, type Archetype } from '../../src/core/archetype';
import { createBattle, type BattleState } from '../../src/core/battle';
import { computeBuildStats, validatePlayerBuild } from '../../src/core/build';
import { arrivedMessages, reached, stockFor } from '../../src/core/campaign';
import { newGame } from '../../src/core/game';
import { awardMedals, medalProgress } from '../../src/core/medals';
import { playMission } from '../../src/core/mission';
import { perkEffects } from '../../src/core/pilot';
import { SEAT_ID, keeperEnemy, seatMission, seatOpen } from '../../src/core/seat';
import type { Build, FramePart } from '../../src/core/types';
import { ALL_ENEMIES } from '../../src/content/arena';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { MANUAL } from '../../src/content/codex';
import { MASTERS } from '../../src/content/masters';
import { MEDALS } from '../../src/content/medals';
import { MESSAGES, MISSIONS } from '../../src/content/missions';
import { REFERENCE_NL } from '../../src/content/nl/reference';
import { STORY_NL } from '../../src/content/nl/story';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { STRINGS } from '../../src/content/strings';
import { CATALOG, DEMO_BUILD, SHOP_PARTS, SHOP_UNLOCKS, STARTER_BUILD } from '../../src/content/parts';
import { PERKS } from '../../src/content/perks';
import { KEEPER, SEAT_ENEMIES } from '../../src/content/seat';
import { TALK_CHARS } from '../../src/ui/battleScreen';
import { BRIEFING_CHARS } from '../../src/ui/briefingScreen';
import { LOGICAL_W } from '../../src/ui/display';
import { GarageFlow } from '../../src/ui/garageFlow';
import { CROWN_PAINTS, PAINTS, SEAT_PAINT, paintById, paintsFor, rampOf } from '../../src/ui/paint';
import { charsFor, wrap } from '../../src/ui/widgets';

/**
 * Touchstone, who keeps the eighth seat: the machine, the three ways it fights, what its pilot says,
 * and how hard the duel is.
 */

const game = newGame(CATALOG, STARTER_BUILD);
/** The machine as it is in each of its three ways of fighting: as the duel begins, and after each change. */
const SHAPES: Build[] = [KEEPER.build, ...KEEPER.phases.map((_, i) => KEEPER.phases.slice(0, i + 1).reduce<Build>((build, phase) => ({ ...build, ...phase.refit }), KEEPER.build))];

describe('the keeper', () => {
  test('is Touchstone, in the Sovereign from head to foot, and is the enemy the duel fields', () => {
    expect(KEEPER.name).toBe('Touchstone');
    for (const build of SHAPES) {
      expect([build.head, build.core, build.arms, build.legs]).toEqual(['head-sovereign', 'core-sovereign', 'arms-sovereign', 'legs-sovereign']);
    }
    expect(SEAT_ENEMIES).toEqual({ [SEAT_ID]: keeperEnemy(KEEPER) });
    expect(ALL_ENEMIES[SEAT_ID]).toEqual(keeperEnemy(KEEPER));
    expect(seatMission(game, KEEPER, { client: '', win: '' }).battles).toEqual([{ enemies: [SEAT_ID], background: 'bg-arena' }]);
    // No master is called so, and none flies that frame: it was built for the seat's keeper.
    expect(MASTERS.some((master) => master.name === KEEPER.name)).toBe(false);
    expect(MASTERS.some((master) => Object.values(master.build).some((id) => id!.endsWith('-sovereign')))).toBe(false);
  });

  test('the machine fights three ways, each a machine a pilot could put together: a marksman\'s, a lancer\'s and a duellist\'s', () => {
    expect(SHAPES).toHaveLength(3);
    expect(SHAPES.map((build) => archetypeOf(build, CATALOG))).toEqual(['marksman', 'lancer', 'duellist']);
    for (const build of SHAPES) {
      expect(validatePlayerBuild(build, CATALOG)).toEqual([]);
      const stats = computeBuildStats(build, CATALOG);
      expect(stats.weight).toBeLessThanOrEqual(stats.capacity);
      expect(stats.turnEnergy).toBeGreaterThanOrEqual(300);
    }
    // At range: a rail that charges, and a howler for whoever is charging their own. Then light, one beam of which drains. Then two blades.
    expect([SHAPES[0].rightHand, SHAPES[0].leftHand, SHAPES[0].shoulder]).toEqual(['wpn-longbow', undefined, 'wpn-howler']);
    expect([SHAPES[1].rightHand, SHAPES[1].leftHand, SHAPES[1].shoulder]).toEqual(['wpn-lance-emitter', 'wpn-pulse-carbine', 'wpn-null-beam']);
    expect([SHAPES[2].rightHand, SHAPES[2].leftHand, SHAPES[2].shoulder]).toEqual(['wpn-gavel', 'wpn-arc-blade', 'wpn-howler']);
    const weapon = (id: string) => CATALOG[id] as { charge?: boolean; melee?: boolean; trait?: string; damageType: string; impact?: number };
    expect(weapon('wpn-longbow').charge).toBe(true);
    expect(weapon('wpn-howler').impact).toBeGreaterThan(100);
    expect(['wpn-lance-emitter', 'wpn-pulse-carbine', 'wpn-null-beam'].map((id) => weapon(id).damageType)).toEqual(['energy', 'energy', 'energy']);
    expect(['wpn-lance-emitter', 'wpn-pulse-carbine', 'wpn-null-beam'].filter((id) => weapon(id).trait === 'drain')).toEqual(['wpn-null-beam']);
    expect([weapon('wpn-gavel').melee, weapon('wpn-arc-blade').melee]).toEqual([true, true]);
  });

  test('it changes twice, as a boss does: at two thirds of its core and at one third, each time flown another way and with a line of its pilot\'s', () => {
    expect(KEEPER.phases.map((phase) => phase.at)).toEqual([0.66, 0.33]);
    expect(KEEPER.phases.map((phase) => phase.ai)).toEqual(['skirmisher', 'bruiser']);
    expect(keeperEnemy(KEEPER).ai).toBe(CLASS_AI.marksman);
    // It moves more when it turns to light, and hits a little harder at the end; nothing else about it is changed.
    expect(KEEPER.phases.map(({ evasion, damage, aim, energy }) => ({ evasion, damage, aim, energy }))).toEqual([
      { evasion: 6, damage: undefined, aim: undefined, energy: undefined }, { evasion: undefined, damage: 1.1, aim: undefined, energy: undefined },
    ]);
    for (const phase of KEEPER.phases) {
      expect(phase.line!.length).toBeGreaterThan(20);
      // A line of talk on the field holds two rows.
      expect(wrap(phase.line!, TALK_CHARS).length).toBeLessThanOrEqual(2);
      // Every weapon changes with it, and the module: nothing of the last way is left in the hands.
      expect(Object.keys(phase.refit!).sort()).toEqual(['leftHand', 'module', 'rightHand', 'shoulder']);
    }
  });

  test('what is said of it and by it fits where a master\'s words stand', () => {
    expect(wrap(KEEPER.style, charsFor(LOGICAL_W - 28)).length).toBeLessThanOrEqual(3);
    expect(KEEPER.style.length).toBeGreaterThan(60);
    // It says what the three ways are, in the order they come.
    const at = ['charging rail', 'howler', 'light that drains', 'two blades'].map((word) => KEEPER.style.indexOf(word));
    expect(at.every((index) => index > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(wrap(`"${KEEPER.taunt}"`, BRIEFING_CHARS).length).toBeLessThanOrEqual(2);
    // On the bill the keeper's words stand with the arena's after them, in three rows, in both languages.
    expect(wrap(`"${KEEPER.concede}" ${STRINGS.arena.seat.win}`, charsFor(210)).length).toBeLessThanOrEqual(3);
    expect(wrap(`"${STORY_NL[KEEPER.concede]}" ${STRINGS_NL.arena.seat.win}`, charsFor(210)).length).toBeLessThanOrEqual(3);
    expect(KEEPER.taunt).toContain('Seven crowns');
  });

  test('its paint is the keeper\'s own: no scheme anyone may wear and no crown\'s, black with gold in it', () => {
    expect(KEEPER.paint).toBe('touchstone');
    expect(SEAT_PAINT).toMatchObject({ id: 'touchstone', name: 'Touchstone' });
    expect(paintById('touchstone')).toBe(SEAT_PAINT);
    expect([...PAINTS, ...CROWN_PAINTS].some((paint) => paint.id === SEAT_PAINT.id || paint.name === SEAT_PAINT.name)).toBe(false);
    // Black: its armour is darker, stop for stop, than any other scheme's, and next to grey.
    const luma = ([r, g, b]: number[]): number => 0.299 * r + 0.587 * g + 0.114 * b;
    const mine = rampOf(SEAT_PAINT).map(luma);
    for (const other of [...PAINTS, ...CROWN_PAINTS]) {
      const theirs = rampOf(other).map(luma);
      expect(mine.reduce((sum, value) => sum + value, 0), other.id).toBeLessThan(theirs.reduce((sum, value) => sum + value, 0));
    }
    expect(SEAT_PAINT.sat).toBeLessThanOrEqual(0.1);
    // With gold in it: its trim is a full yellow-gold.
    expect(SEAT_PAINT.accentHue).toBeGreaterThanOrEqual(40);
    expect(SEAT_PAINT.accentHue).toBeLessThanOrEqual(52);
    expect(SEAT_PAINT.accentSat).toBeGreaterThanOrEqual(0.85);
  });
});

describe('on the field', () => {
  /** A battle against the keeper with its core brought down to a share of what it had. */
  const hurt = (share: number): BattleState => {
    const state = createBattle(DEMO_BUILD, [keeperEnemy(KEEPER)], CATALOG, 11, { enemyScale: KEEPER.scale });
    const core = state.units[1].parts.core!;
    core.ap = Math.ceil(core.maxAp * share);
    return state;
  };
  const weapons = (state: BattleState): (string | undefined)[] => [state.units[1].build.rightHand, state.units[1].build.leftHand, state.units[1].build.shoulder];
  /** Fights on as the game's own automatic pilot would, a step at a time, until something has come about or the battle is over. */
  const until = (state: BattleState, done: (s: BattleState) => boolean): BattleState => {
    let s = state;
    for (let i = 0; i < 400 && s.outcome === 'ongoing' && !done(s); i++) s = stepBattle(s, CATALOG, chooseAutoPlayerAction);
    return s;
  };

  test('it stands with a field up and the first loadout, at the strength the duel sets', () => {
    const state = hurt(1);
    const keeper = state.units[1];
    expect(keeper).toMatchObject({ name: 'Touchstone', kind: SEAT_ID, phase: 0, ai: CLASS_AI.marksman, composed: true });
    expect(weapons(state)).toEqual(['wpn-longbow', undefined, 'wpn-howler']);
    const core = CATALOG['core-sovereign'] as FramePart;
    expect(keeper.parts.core!.maxAp).toBe(Math.round(core.ap * KEEPER.scale));
    expect(KEEPER.scale).toBe(0.8);
    expect(KEEPER.plating ?? 0).toBe(0);
  });

  test('hurt to two thirds it turns to light and is flown as a skirmisher; hurt to a third it draws its blades and comes in', () => {
    // Just above each line nothing has changed; a blow that takes it to the line or under changes it.
    const first = until(hurt(0.7), (s) => s.units[1].phase >= 1);
    expect(first.units[1].phase).toBeGreaterThanOrEqual(1);
    const changed = first.events.filter((event) => event.type === 'phase');
    expect(changed[0]).toMatchObject({ type: 'phase', unit: 'enemy-0', phase: 1 });
    if (first.units[1].phase === 1) {
      expect(weapons(first)).toEqual(['wpn-lance-emitter', 'wpn-pulse-carbine', 'wpn-null-beam']);
      expect(first.units[1].ai).toBe('skirmisher');
      expect(first.units[1].build.module).toBe('mod-cryo');
    }
    const second = until(hurt(0.36), (s) => s.units[1].phase >= 2);
    expect(second.units[1].phase).toBe(2);
    expect(weapons(second)).toEqual(['wpn-gavel', 'wpn-arc-blade', 'wpn-howler']);
    expect(second.units[1].ai).toBe('bruiser');
    expect(second.units[1].build.module).toBe('mod-overclock');
    // The frame is the frame throughout.
    expect(second.units[1].build.core).toBe('core-sovereign');
  });
});

describe('how hard the duel is', () => {
  const perks = (ranks: Record<string, number>): object => {
    const { aim, evasion, energy, cooling, repairs, armour } = perkEffects(ranks, PERKS);
    return { aim, evasion, energy, cooling, repairs, armour };
  };
  /** A pilot who has finished the story (six ranks of the usual perks), one who has learnt nothing, and one who has learnt everything that helps in a fight. */
  const VETERAN = perks({ marksman: 2, plating: 2, capacitor: 1, heatsinks: 1 });
  const NOVICE = {};
  const MASTERED = perks({ marksman: 3, reflexes: 3, capacitor: 3, heatsinks: 3, fieldTech: 2, plating: 3 });
  const FLIGHTS = 30;
  /** How the game's own automatic pilot does against the keeper in the late build of a class: wins in a hundred, and the rounds a win takes. */
  function flown(challenger: Archetype, mods: object): { won: number; rounds: number } {
    const mission = seatMission(game, KEEPER, { client: '', win: '' });
    let wins = 0;
    let rounds = 0;
    for (let flight = 1; flight <= FLIGHTS; flight++) {
      const seed = flight % 2 ? flight * 7919 : flight * 104729 + 13;
      const end = playMission(ARCHETYPE_BUILDS[challenger].late, mission, ALL_ENEMIES, CATALOG, seed, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction), { mods, enemyScale: mission.scale ?? 1 });
      if (end.outcome === 'victory') { wins += 1; rounds += end.round; }
    }
    return { won: Math.round((wins / FLIGHTS) * 100), rounds: wins ? rounds / wins : 0 };
  }
  const LONG = 120_000;

  test('a veteran in a build that suits the fight takes the seat between a fifth of the time and most of it, and a win is won in good time', () => {
    // The builds that shoot from afar or stand up to a blow: what was measured was 71, 44, 38 and 31 in a hundred (scripts/masters.ts).
    const suited: [Archetype, number, number][] = [['marksman', 50, 90], ['allrounder', 22, 68], ['artillery', 18, 60], ['bastion', 12, 52]];
    const all: number[] = [];
    for (const [kind, least, most] of suited) {
      const result = flown(kind, VETERAN);
      expect(result.won, kind).toBeGreaterThanOrEqual(least);
      expect(result.won, kind).toBeLessThanOrEqual(most);
      // Three ways of fighting are not got through in three rounds, and nobody takes the seat by outlasting a wall.
      expect(result.rounds, kind).toBeGreaterThanOrEqual(4);
      expect(result.rounds, kind).toBeLessThanOrEqual(22);
      all.push(result.won);
    }
    // Between them, about half the time.
    const mean = all.reduce((sum, won) => sum + won, 0) / all.length;
    expect(mean).toBeGreaterThanOrEqual(33);
    expect(mean).toBeLessThanOrEqual(62);
  }, LONG);

  test('a pilot with no perks seldom does, in the build that does best or any other; one with every perk usually does', () => {
    for (const kind of ['marksman', 'allrounder'] as Archetype[]) expect(flown(kind, NOVICE).won, kind).toBeLessThanOrEqual(34);
    for (const kind of ['allrounder', 'bastion'] as Archetype[]) expect(flown(kind, MASTERED).won, kind).toBeGreaterThanOrEqual(62);
  }, LONG);

  test('it is set no harder than a master is ever set, and its purse is the largest the arena pays', () => {
    expect(KEEPER.scale).toBeGreaterThanOrEqual(0.7);
    expect(KEEPER.scale).toBeLessThanOrEqual(Math.max(...MASTERS.map((master) => master.scale)));
    expect(seatMission(game, KEEPER, { client: '', win: '' }).reward).toBe(15000);
    expect(seatMission(game, KEEPER, { client: '', win: '' }).scale).toBe(KEEPER.scale);
  });
});

describe('what the seat gives', () => {
  const seated = { ...game, crowns: [...ARCHETYPES], masters: [...ARCHETYPES], seat: true as const };
  const crowned = { ...game, crowns: [...ARCHETYPES], masters: [...ARCHETYPES] };

  test('the keeper\'s paint is the holder\'s to wear, after the crowns\' paints, and nobody else\'s', () => {
    const free = ['factory', ...PAINTS.map((paint) => paint.id)];
    expect(paintsFor(game)).toEqual(free);
    expect(paintsFor(crowned)).toEqual([...free, ...CROWN_PAINTS.map((paint) => paint.id)]);
    expect(paintsFor(seated)).toEqual([...free, ...CROWN_PAINTS.map((paint) => paint.id), 'touchstone']);
    // It goes with the seat and not with the crowns: a seat held with fewer crowns kept still has it, and something odd in the seat's place has not.
    expect(paintsFor({ crowns: ['bastion'], seat: true })).toEqual([...free, 'basalt', 'touchstone']);
    expect(paintsFor({ crowns: [...ARCHETYPES], seat: 'yes' as unknown as true })).not.toContain('touchstone');
  });

  test('the garage steps to it and names it for the holder; worn by anyone else it is named, stepped away from and not come back to', () => {
    const held = new GarageFlow(seated, CATALOG);
    held.onInput('prev');
    expect(held.game.paint).toBe('touchstone');
    expect(held.paintName).toBe('Touchstone');
    held.onInput('prev');
    expect(held.game.paint).toBe(CROWN_PAINTS.at(-1)!.id);
    held.onInput('next');
    held.onInput('next');
    expect(held.game.paint).toBe('factory');
    const other = new GarageFlow({ ...crowned, paint: 'touchstone' }, CATALOG);
    expect(other.paintName).toBe('Touchstone');
    other.onInput('next');
    expect(other.game.paint).toBe(PAINTS[0].id);
    for (let i = 0; i < 40; i++) { other.onInput('next'); expect(other.game.paint).not.toBe('touchstone'); }
  });

  test('a medal of the highest kind, for taking it: the last of the arena\'s, and one the medal for all the others asks for', () => {
    const medal = MEDALS.find((entry) => entry.id === 'seat')!;
    expect(medal).toMatchObject({ name: 'True Metal', text: "Take the eighth seat at the masters' table.", tier: 3 });
    expect(medal.secret).toBeUndefined();
    expect([REFERENCE_NL[medal.name], REFERENCE_NL[medal.text]]).toEqual(['Echt metaal', 'Pak de achtste stoel aan de meestertafel.']);
    expect(medalProgress(medal, game)).toEqual({ have: 0, need: 1, earned: false });
    expect(medalProgress(medal, crowned)).toEqual({ have: 0, need: 1, earned: false });
    // What it takes is there with the seat; it is the pilot's once it has been awarded.
    expect(medalProgress(medal, seated)).toEqual({ have: 1, need: 1, earned: false });
    expect(medalProgress(medal, { ...seated, seat: 'yes' as unknown as true })).toEqual({ have: 0, need: 1, earned: false });
    // It stands after the two that count crowns.
    const ids = MEDALS.map((entry) => entry.id);
    expect(ids.indexOf('seat')).toBe(ids.indexOf('crown-all') + 1);
    expect(ids.at(-1)).toBe('all');
    // Awarded when the seat is held, once.
    const awarded = awardMedals(seated, MEDALS);
    expect(awarded.earned.map((entry) => entry.id)).toContain('seat');
    expect(medalProgress(medal, awarded.game)).toEqual({ have: 1, need: 1, earned: true });
    expect(awardMedals(awarded.game, MEDALS).earned.map((entry) => entry.id)).not.toContain('seat');
    expect(awardMedals(crowned, MEDALS).earned.map((entry) => entry.id)).not.toContain('seat');
    // The medal for all the others is not had without it.
    const all = MEDALS.find((entry) => entry.id === 'all')!;
    const others = MEDALS.filter((entry) => entry.id !== 'all').map((entry) => entry.id);
    expect(all.progress({ ...seated, medals: others })).toEqual({ have: others.length, need: others.length });
    expect(all.progress({ ...seated, medals: others.filter((id) => id !== 'seat') })).toEqual({ have: others.length - 1, need: others.length });
  });

  test('`crowns:N` is reached with that many crowns held: of classes there are, each counted once', () => {
    const with_ = (crowns: string[]) => ({ ...game, crowns });
    expect(reached(with_([]), 'crowns:1', MISSIONS)).toBe(false);
    expect(reached(with_(['bastion']), 'crowns:1', MISSIONS)).toBe(true);
    expect(reached(with_(['bastion', 'bastion', 'nobody']), 'crowns:2', MISSIONS)).toBe(false);
    expect(reached(with_(ARCHETYPES.slice(0, 6)), 'crowns:7', MISSIONS)).toBe(false);
    expect(reached(with_([...ARCHETYPES]), 'crowns:7', MISSIONS)).toBe(true);
    expect(reached(with_([...ARCHETYPES]), 'crowns:7&!seat', MISSIONS)).toBe(true);
    expect(reached(seated, 'crowns:7&!seat', MISSIONS)).toBe(false);
  });

  test('two letters from the arena office: one when the seventh crown is taken, one when the seat is, and each says what is so', () => {
    const ids = MESSAGES.map((message) => message.id);
    expect([ids.indexOf('seat-open'), ids.indexOf('seat-yard')]).toEqual([ids.indexOf('masters') + 1, ids.indexOf('masters') + 2]);
    const [invitation, yard] = [MESSAGES.find((m) => m.id === 'seat-open')!, MESSAGES.find((m) => m.id === 'seat-yard')!];
    expect([invitation.from, invitation.after, yard.from, yard.after]).toEqual(['Arena Office', 'crowns:7', 'Arena Office', 'seat']);
    const arrived = (state: typeof game): string[] => arrivedMessages(state, MESSAGES, MISSIONS).map((m) => m.id).filter((id) => id.startsWith('seat-'));
    expect(arrived(game)).toEqual([]);
    expect(arrived({ ...game, crowns: ARCHETYPES.slice(0, 6) })).toEqual([]);
    expect(arrived(crowned)).toEqual(['seat-open']);
    expect(arrived(seated)).toEqual(['seat-open', 'seat-yard']);
    // The invitation: who keeps the seat, whom they take, that no class is asked for, and where it is.
    const asked = invitation.body.join(' ');
    expect(asked).toContain(`a keeper, ${KEEPER.name}, who takes one challenge: from the pilot who holds all seven crowns`);
    expect(ARCHETYPES).toHaveLength(7);
    expect(asked).toContain('Bring any machine: no class is asked for.');
    expect(seatMission(game, KEEPER, { client: '', win: '' }).crown).toBeUndefined();
    expect(asked).toMatch(/on the masters' page, under the seven\.$/);
    // The yard's: that the Sovereign's four parts are in the shop, and the keeper's paint in the garage, for the one who has the letter.
    const sent = yard.body.join(' ');
    expect(sent).toContain('Its head, core, arms and legs are on the shop\'s list.');
    const shelf = stockFor(seated, SHOP_PARTS, SHOP_UNLOCKS, MISSIONS).map((part) => part.id).filter((id) => id.endsWith('-sovereign'));
    expect(shelf).toEqual(['head-sovereign', 'core-sovereign', 'arms-sovereign', 'legs-sovereign']);
    expect(sent).toContain("The keeper's paint is in your garage with the others.");
    expect(paintsFor(seated)).toContain(KEEPER.paint);
    expect(sent).toContain('nothing about it is cheap');
    // And the Dutch of both says the same: all seven, any machine, the four parts, the shop and the garage.
    const [gevraagd, gestuurd] = [invitation, yard].map((message) => message.body.map((paragraph) => STORY_NL[paragraph]).join(' '));
    expect(gevraagd).toContain(`een houder, ${KEEPER.name}, en die neemt een uitdaging aan: van wie alle zeven kronen heeft`);
    expect(gevraagd).toContain('Kom in welke machine ook: er wordt geen klasse gevraagd.');
    expect(gevraagd).toMatch(/bij de meesters, onder de zeven\.$/);
    expect(gestuurd).toContain('Hoofd, kern, armen en benen staan in de winkel.');
    expect(gestuurd).toContain('De lak van de houder staat in je garage bij de rest.');
    expect(gestuurd).toContain('niets eraan goedkoop');
    expect([STORY_NL[invitation.subject], STORY_NL[yard.subject]]).toEqual(['De achtste stoel', 'Een orderboek']);
    // Each fits the inbox: a subject of a line, a body of fourteen rows at most.
    for (const message of [invitation, yard]) {
      expect(message.subject.length).toBeLessThanOrEqual(30);
      const rows = message.body.reduce((sum, paragraph) => sum + wrap(paragraph, BRIEFING_CHARS).length, 0) + (message.body.length - 1) * 0.5;
      expect(rows, message.id).toBeLessThanOrEqual(14);
    }
  });

  test('the manual has a chapter for it that says what the rules are, in both languages', () => {
    const topic = MANUAL.find((entry) => entry.id === 'seat')!;
    expect(topic.title).toBe('THE EIGHTH SEAT');
    expect(MANUAL.findIndex((entry) => entry.id === 'seat')).toBe(MANUAL.findIndex((entry) => entry.id === 'masters') + 1);
    const count = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
    const aantal = ['geen', 'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven'];
    const text = topic.text;
    const dutch = REFERENCE_NL[text];
    // Whom the keeper takes: every crown there is, in any build.
    expect(text).toContain(`Under the ${count[ARCHETYPES.length]} masters is a seat that is no class's.`);
    expect(text).toContain(`from the pilot who holds all ${count[ARCHETYPES.length]} crowns, in any build.`);
    expect(dutch).toContain(`Onder de ${aantal[ARCHETYPES.length]} meesters`);
    expect(dutch).toContain(`van wie alle ${aantal[ARCHETYPES.length]} kronen heeft, in welke build ook.`);
    expect(seatOpen({ crowns: [...ARCHETYPES] })).toBe(true);
    expect(seatOpen({ crowns: ARCHETYPES.slice(1) })).toBe(false);
    // How its machine fights: as many ways as it has changes, and one.
    expect(text).toContain(`The keeper's machine fights ${count[KEEPER.phases.length + 1]} ways and changes as it is hurt.`);
    expect(dutch).toContain(`vecht op ${aantal[KEEPER.phases.length + 1]} manieren`);
    // What the seat brings: the frame on the shop's list, and the keeper's paint.
    expect(text).toMatch(/Take the seat and its frame, the Sovereign, is on the shop's list, and the keeper's paint is yours\.$/);
    expect(dutch).toMatch(/staat in de winkel, en de lak van de houder is van jou\.$/);
    expect(SHOP_UNLOCKS['core-sovereign']).toBe('seat');
    expect(paintsFor(seated).at(-1)).toBe(KEEPER.paint);
    expect(STRINGS_NL.arena.seat.row.toUpperCase()).toBe(REFERENCE_NL[topic.title]);
  });
});
