import { ARCHETYPES, LANCER_WEAPONS, QUICK_LEGS, SLOW_LEGS, adviceFor, archetypeOf, type Archetype, type BuildAdvice } from '../../src/core/archetype';
import { arenaMission } from '../../src/core/arena';
import { lentPatrol } from '../../src/core/campaign';
import type { Settlement } from '../../src/core/economy';
import { BUILD_SLOTS, buy, equip, type BuildSlot, type GameState } from '../../src/core/game';
import type { Build } from '../../src/core/types';
import { ARENA } from '../../src/content/arena';
import { ARCHETYPE_BUILDS, STAGES, STAGE_BUDGET, type Stage } from '../../src/content/archetypeBuilds';
import { WORLD } from '../../src/content/codex';
import { setLanguage, type Language } from '../../src/content/language';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { STARTERS } from '../../src/content/starters';
import { STRINGS } from '../../src/content/strings';
import { LOGICAL_W } from '../../src/ui/display';
import { COLORS, LINE } from '../../src/ui/widgets';
import { accept, done, finishBattle, finishMission, fresh, ids, inHub, press, savedGame, select, snap, strong } from '../helpers/app';
import { overlap, record, type Drawn, type Written } from '../helpers/canvas';

/**
 * The kinds of machine as the pilot meets them: a page of the pilot's screen that says what makes
 * each, what was won as it and how to build one now; a line in the garage that says what the build
 * on the floor is; and a count that goes up when a contract is won in the pilot's own machine.
 */

afterEach(() => setLanguage('en'));

type AppOf = ReturnType<typeof inHub>['app'];
interface Page { flown: Archetype; kind: Archetype; advice: BuildAdvice }
const C = STRINGS.classes;
/** The texts as they are in English: the table holds the language that is set, and this file is read in English. */
const ENGLISH = { notes: { ...C.notes }, tags: { ...C.tags }, rules: { ...C.rules } };
/** What the page says of itself. */
const page = (app: AppOf): Page => snap(app).classes as Page;
const drawn = (app: AppOf): Drawn => record((ctx) => app.draw(ctx));
/** A game with nothing waiting to be read: no page of story, no new entries. */
const quiet = (base: GameState = fresh()): GameState => ({ ...base, codex: WORLD.map((entry) => entry.id), scenes: ['act-1'] });
/** The game with a build bought and fitted, whatever it costs, and the credits it had. */
function flying(base: GameState, build: Build): GameState {
  let game: GameState = { ...base, credits: 9_999_999 };
  for (const slot of BUILD_SLOTS) {
    const id = build[slot];
    if (id === undefined) { if (game.build[slot] !== undefined) game = equip(game, slot, null, CATALOG); continue; }
    while ((game.inventory[id] ?? 0) < Object.values(build).filter((other) => other === id).length) game = buy(game, id, CATALOG);
  }
  // Fitted in two passes: what a slot gives up may be what another is waiting for.
  for (let pass = 0; pass < 2; pass++) {
    for (const slot of BUILD_SLOTS) {
      const id = build[slot];
      if (id !== undefined && game.build[slot] !== id) { try { game = equip(game, slot, id, CATALOG); } catch { /* next pass */ } }
    }
  }
  expect(game.build).toEqual(build);
  return { ...game, credits: base.credits };
}
/** From the hub to the page of kinds, in the language given: set as the options set it, once the game is up. */
function onPage(saved: GameState = quiet(), language: Language = 'en'): AppOf {
  const { app } = inHub(saved);
  setLanguage(language);
  select(app, 'pilot');
  for (let i = 0; i < 6 && snap(app).page !== 'classes'; i++) press(app, 'next');
  expect(snap(app).page).toBe('classes');
  return app;
}
/** Puts the cursor on a kind. */
function onKind(app: AppOf, kind: Archetype): void {
  for (let i = 0; i < ARCHETYPES.length && page(app).kind !== kind; i++) press(app, 'down');
  expect(page(app).kind).toBe(kind);
}
const written = (shown: Drawn, text: string): Written => {
  const found = shown.texts.filter((t) => t.text === text);
  expect(found, text).toHaveLength(1);
  return found[0];
};
const price = (id: string): number => CATALOG[id].price;
/**
 * The story to the point where each stage's builds can be bought, by the Lumen road, with what a
 * pilot can have spent on a build by then in hand; and a pilot at the very start, with what a pilot starts with.
 */
const FIRST_ACT = ['intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1'];
const TO_THE_WAR = [...FIRST_ACT, 'hadron-2', 'lumen-2', 'undertow-2', 'rival-1', 'choice-lumen'];
const AFTER: Record<Stage | 'start', GameState> = {
  start: quiet(),
  early: { ...quiet(done(...FIRST_ACT)), credits: STAGE_BUDGET.early },
  war: { ...quiet(done(...TO_THE_WAR)), credits: STAGE_BUDGET.war },
  late: { ...quiet(done(...TO_THE_WAR)), arenaRank: 10, credits: STAGE_BUDGET.late },
};

describe('the page of kinds', () => {
  test('is the fourth of the pilot\'s five pages, between the record and the Overdrives', () => {
    const { app } = inHub(quiet());
    select(app, 'pilot');
    const pages: string[] = [];
    for (let i = 0; i < 5; i++) { pages.push(String(snap(app).page)); press(app, 'next'); }
    expect(pages).toEqual(['perks', 'medals', 'record', 'classes', 'drive']);
    expect(snap(app).page).toBe('perks');
    // The tabs along the top name it, and it is the one underlined when it is open.
    expect(STRINGS.pilot.pages.classes).toBe('CLASS');
    const open = onPage();
    expect(written(drawn(open), 'CLASS').color).toBe(COLORS.accent);
    expect(written(drawn(open), 'RECORD').color).toBe(COLORS.dim);
  });

  test('lists the seven kinds in the order their rules are asked, each with what makes one and what was won as it', () => {
    const app = onPage({ ...quiet(), wonAs: { duellist: 12, bastion: 3 } });
    expect(ids(app)).toEqual([...ARCHETYPES]);
    expect(snap(app).menu.items.map((item) => item.label)).toEqual(['Duellist', 'Sharpshooter', 'Artillery', 'Lancer', 'Bastion', 'Skirmisher', 'All-rounder']);
    expect(snap(app).menu.items.map((item) => item.note)).toEqual(['12', '0', '0', '0', '3', '0', '0']);
    const shown = drawn(app);
    expect(written(shown, 'A MACHINE IS THE FIRST OF THESE IT FITS').y).toBeLessThan(written(shown, 'Duellist').y);
    expect(written(shown, 'WON').right).toBe(written(shown, '12').right);
    ARCHETYPES.forEach((kind, i) => {
      const name = written(shown, C.names[kind]);
      const rule = written(shown, C.rules[kind]);
      // One row a kind, eleven pixels apart: its name, what makes it, and its count at the right edge.
      expect([name.y, rule.y], kind).toEqual([34 + i * LINE, 34 + i * LINE]);
      expect(rule.left, kind).toBeGreaterThan(name.right);
      const count = shown.texts.filter((t) => t.y === name.y && t.align === 'right');
      expect(count.map((t) => t.text), kind).toEqual([String({ duellist: 12, bastion: 3 }[kind as string] ?? 0)]);
      expect(count[0].left, kind).toBeGreaterThan(rule.right);
    });
    // What was won as stands plain; what was never won as is dim, name and count.
    expect(written(shown, 'Bastion').color).toBe(COLORS.text);
    expect(written(shown, '3').color).toBe(COLORS.text);
    expect(written(shown, 'Lancer').color).toBe(COLORS.dim);
  });

  test('what makes each kind is said in the figures the rules go by', () => {
    expect(C.rules).toEqual({
      duellist: 'A blade in either hand', marksman: 'A weapon that has to charge', artillery: 'A salvo on the shoulder',
      lancer: 'Two weapons or more, all energy', bastion: `A shield, or legs of MOB ${SLOW_LEGS} or less`, skirmisher: `Legs of MOB ${QUICK_LEGS} or more`,
      allrounder: 'Anything else',
    });
    // And in Dutch: the same figures, and two weapons where the English says two.
    expect(STRINGS_NL.classes.rules).toEqual({
      duellist: 'Een kling in een hand', marksman: 'Een wapen dat moet laden', artillery: 'Een salvo op de schouder',
      lancer: 'Twee of meer wapens, alle energie', bastion: `Een schild, of benen tot MOB ${SLOW_LEGS}`, skirmisher: `Benen vanaf MOB ${QUICK_LEGS}`,
      allrounder: 'Al het andere',
    });
    expect(LANCER_WEAPONS).toBe(2);
    // MOB is what a pair of legs calls its own mobility, in both languages: the figure to look for is on the part.
    expect([STRINGS.partInfo.mobility, STRINGS_NL.partInfo.mobility]).toEqual(['MOB', 'MOB']);
  });

  test('marks the kind the pilot flies now: its name stands out in the list, and its own page says YOURS NOW', () => {
    const app = onPage(flying(quiet(), STARTERS[2].build));
    expect(page(app).flown).toBe('bastion');
    let shown = drawn(app);
    // The cursor starts on the first kind, which is not the pilot's.
    expect(page(app).kind).toBe('duellist');
    expect(written(shown, 'Bastion').color).toBe(COLORS.armor);
    expect(written(shown, 'Duellist').color).toBe(COLORS.accent);
    expect(shown.texts.some((t) => t.text === 'YOURS NOW')).toBe(false);
    expect(written(shown, 'DUELLIST').color).toBe(COLORS.accent);
    onKind(app, 'bastion');
    shown = drawn(app);
    expect(written(shown, 'YOURS NOW')).toMatchObject({ color: COLORS.armor, y: written(shown, 'BASTION').y });
    expect(written(shown, 'Bastion').color).toBe(COLORS.accent);
    // The kind it flies counts as known though nothing was won as it yet: its name is not dim when the cursor moves on.
    press(app, 'down');
    expect(written(drawn(app), 'Bastion').color).toBe(COLORS.armor);
  });

  test('says under the list what the kind under the cursor is good at, in no more than three lines', () => {
    const app = onPage();
    for (const kind of ARCHETYPES) {
      onKind(app, kind);
      const shown = drawn(app);
      const title = written(shown, C.names[kind].toUpperCase());
      const lines = shown.texts.filter((t) => t.y > title.y && t.y < written(shown, C.advice).y && t.size !== 10);
      expect(lines.length, kind).toBeGreaterThanOrEqual(2);
      expect(lines.length, kind).toBeLessThanOrEqual(3);
      expect(lines.map((t) => t.text).join(' '), kind).toBe(C.notes[kind]);
    }
  });

  test('B goes back to the hub, and the cursor stays inside the list', () => {
    const app = onPage();
    // The list goes round, as every list in the game does.
    press(app, 'up');
    expect(page(app).kind).toBe('allrounder');
    press(app, 'down');
    expect(page(app).kind).toBe('duellist');
    for (let i = 0; i < 4; i++) press(app, 'down');
    expect(page(app).kind).toBe('bastion');
    // There is nothing to confirm on this page: A does nothing.
    press(app, 'confirm');
    expect(page(app).kind).toBe('bastion');
    expect(snap(app).screen).toBe('pilot');
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
  });
});

describe('one to fly now', () => {
  test.each(STAGES)('with the %s stage\'s parts sold and what that stage has to spend in hand, every kind is offered the build of that stage, and what is still to buy is priced', (stage) => {
    const app = onPage(AFTER[stage]);
    for (const kind of ARCHETYPES) {
      onKind(app, kind);
      const { advice } = page(app);
      expect(advice.build, kind).toEqual(ARCHETYPE_BUILDS[kind][stage]);
      expect(advice.unsold, kind).toEqual([]);
      // Everything this pilot does not own of it, at the shop's price. A pilot in a Hauler owns the Hauler and a rifle.
      const owned = new Set(Object.values(STARTER_BUILD));
      const missing = BUILD_SLOTS.filter((slot) => advice.build[slot] !== undefined && !owned.has(advice.build[slot]!));
      expect(advice.toBuy, kind).toEqual(missing);
      expect(advice.cost, kind).toBe(missing.reduce((sum, slot) => sum + price(advice.build[slot]!), 0));
      expect(written(drawn(app), `Still to buy: ${advice.cost} c`).color, kind).toBe(COLORS.dim);
    }
  });

  test('before any of it is sold, it is the first stage\'s build, with what no shop sells yet named and dim', () => {
    const app = onPage(AFTER.start);
    for (const kind of ARCHETYPES) {
      onKind(app, kind);
      const { advice } = page(app);
      expect(advice.build, kind).toEqual(ARCHETYPE_BUILDS[kind].early);
      expect(advice.unsold.length, kind).toBeGreaterThan(0);
      const shown = drawn(app);
      expect(written(shown, 'Not all of it is sold yet').color, kind).toBe(COLORS.dim);
      expect(shown.texts.some((t) => t.text.startsWith('Still to buy')), kind).toBe(false);
      for (const slot of advice.unsold) expect(nameOf(shown, slot).color, `${kind} ${slot}`).toBe(COLORS.dim);
    }
  });

  /** The name written beside a slot's tag in the build to try. */
  const nameOf = (shown: Drawn, slot: BuildSlot): Written => {
    const tag = shown.texts.filter((t) => t.text === STRINGS.garage.slotTags[slot] && t.y > written(shown, C.advice).y);
    expect(tag, slot).toHaveLength(1);
    const name = shown.texts.filter((t) => t.y === tag[0].y - 1 && t.left > tag[0].right && t.left < tag[0].left + 60);
    expect(name, slot).toHaveLength(1);
    return name[0];
  };

  test('is laid out in two columns under their slots: what the pilot owns is plain, what is to be bought stands out, an empty slot is a dash', () => {
    const app = onPage(AFTER.war);
    onKind(app, 'lancer');
    const { advice } = page(app);
    const shown = drawn(app);
    for (const slot of BUILD_SLOTS) {
      const name = nameOf(shown, slot);
      const id = advice.build[slot];
      expect(name.text, slot).toBe(id === undefined ? '-' : CATALOG[id].name);
      expect(name.color, slot).toBe(id === undefined ? COLORS.dim : advice.toBuy.includes(slot) ? COLORS.accent : COLORS.text);
    }
    // The lancer of the war keeps the Hauler's arms, its thrusters and its fire control: those three the pilot has.
    expect(BUILD_SLOTS.filter((slot) => advice.build[slot] !== undefined && !advice.toBuy.includes(slot))).toEqual(['arms', 'booster', 'fcs']);
    // Frame and what goes inside it on the left, fire control, module and weapons on the right.
    const column = (slot: BuildSlot) => (nameOf(shown, slot).left < LOGICAL_W / 2 ? 'left' : 'right');
    expect(BUILD_SLOTS.map(column)).toEqual(['left', 'left', 'left', 'left', 'left', 'left', 'right', 'right', 'right', 'right', 'right']);
  });

  test('a pilot who flies the build is told they own all of it, and one who owns a part once is asked to buy the second', () => {
    const lancer = ARCHETYPE_BUILDS.lancer.war;
    const app = onPage(flying(AFTER.war, lancer));
    onKind(app, 'lancer');
    expect(page(app).advice).toMatchObject({ build: lancer, toBuy: [], cost: 0, unsold: [] });
    const shown = drawn(app);
    expect(written(shown, 'You own all of it').color).toBe(COLORS.armor);
    expect(shown.texts.some((t) => t.text.startsWith('Still to buy'))).toBe(false);
    // The duellist of the war carries two different blades; a build of two of the same pistol asks for two of it.
    const twin: Build = { ...STARTER_BUILD, rightHand: 'wpn-arc-pistol', leftHand: 'wpn-arc-pistol' };
    const one = { ...quiet(), inventory: { ...quiet().inventory, 'wpn-arc-pistol': 1 } };
    expect(archetypeOf(twin, CATALOG)).toBe('lancer');
    const { app: other } = inHub(one);
    const stock = new Set(other.stock().map((part) => part.id));
    expect(adviceFor(other.game!, [twin], (id) => stock.has(id), CATALOG)).toMatchObject({ toBuy: ['leftHand'], cost: price('wpn-arc-pistol'), unsold: [] });
    expect(adviceFor({ ...other.game!, inventory: { ...other.game!.inventory, 'wpn-arc-pistol': 2 } }, [twin], (id) => stock.has(id), CATALOG)).toMatchObject({ toBuy: [], cost: 0 });
  });

  test('of the builds a kind has, it is the best one whose every part is owned or on the shelf: a later one with a part unsold is passed over', () => {
    const game = { ...quiet(), credits: 99_999 };
    const [early, war, late] = STAGES.map((stage) => ARCHETYPE_BUILDS.marksman[stage]);
    const all = (): boolean => true;
    expect(adviceFor(game, [early, war, late], all, CATALOG).build).toBe(late);
    expect(adviceFor(game, [early, war, late], (id) => id !== 'gen-tidal', CATALOG).build).toBe(war);
    expect(adviceFor(game, [early, war, late], (id) => id !== 'gen-tidal' && id !== 'wpn-longbow', CATALOG).build).toBe(early);
    // With nothing sold at all it is the first, and it says what is missing: everything but what the pilot has.
    const none = adviceFor(game, [early, war, late], () => false, CATALOG);
    expect(none.build).toBe(early);
    expect(none.unsold).toEqual(none.toBuy);
    expect(none.toBuy).toEqual(['head', 'generator', 'fcs', 'rightHand']);
    // A part that is owned does not have to be sold: the late build, unsold, is still the one for a pilot who has it all.
    expect(adviceFor(flying(game, late), [early, war, late], () => false, CATALOG)).toMatchObject({ build: late, toBuy: [], unsold: [] });
  });

  test('and of those, the best one the credits in hand will pay for; when they pay for none, the one that takes least to complete', () => {
    const [early, war, late] = STAGES.map((stage) => ARCHETYPE_BUILDS.marksman[stage]);
    const all = (): boolean => true;
    const cost = (build: Build): number => adviceFor(quiet(), [build], all, CATALOG).cost;
    // What a pilot in a Hauler would still have to buy of each: all but the Hauler's own parts and the rifle.
    expect([cost(early), cost(war), cost(late)]).toEqual([4000, 13300, 17200]);
    const holding = (credits: number): Build => adviceFor({ ...quiet(), credits }, [early, war, late], all, CATALOG).build;
    expect([17200, 17199, 13300, 13299, 4000].map(holding)).toEqual([late, war, war, early, early]);
    // Short of even the humblest: it is still the one offered, as the one nearest to hand.
    expect([3999, 0, -500].map(holding)).toEqual([early, early, early]);
    // "Least to complete" is by what is still to buy, not by the order they come in: a pilot who owns most of the war build is pointed at that.
    const owner = { ...flying(quiet(), war), credits: 0 };
    const stripped = { ...owner, inventory: { ...owner.inventory, 'wpn-sunlance': 0 } };
    expect(adviceFor(stripped, [early, war, late], all, CATALOG)).toMatchObject({ build: war, toBuy: ['shoulder'], cost: price('wpn-sunlance') });
  });
});

describe('the page works its suggestion out once, not at every frame', () => {
  test('drawn again and again it asks the shop once; on another kind it asks once more; and a game that has changed is asked about afresh', () => {
    const app = onPage(AFTER.war);
    const asked = vi.spyOn(app, 'stock');
    for (let i = 0; i < 5; i++) { drawn(app); snap(app); }
    // Whatever was asked before the count began, nothing more is asked while the cursor stays where it is.
    expect(asked).toHaveBeenCalledTimes(0);
    press(app, 'down');
    for (let i = 0; i < 5; i++) { drawn(app); snap(app); }
    expect(asked).toHaveBeenCalledTimes(1);
    expect(page(app).advice.build).toEqual(ARCHETYPE_BUILDS.marksman.war);
    // Back on the first kind: it is the kind that is remembered, not a list of them.
    press(app, 'up');
    expect(page(app).advice.build).toEqual(ARCHETYPE_BUILDS.duellist.war);
    expect(asked).toHaveBeenCalledTimes(2);
    // The pilot comes into money while the page is open (a medal's pay, say): the suggestion is the one that money pays for.
    app.commit({ ...app.game!, credits: 0 });
    const poor = page(app).advice;
    expect(asked).toHaveBeenCalledTimes(3);
    app.commit({ ...app.game!, credits: STAGE_BUDGET.war });
    expect(page(app).advice.build).toEqual(ARCHETYPE_BUILDS.duellist.war);
    expect(asked).toHaveBeenCalledTimes(4);
    // With nothing in hand it was the one nearest to complete, which for a pilot in a Hauler is the first act's.
    expect(poor.build).toEqual(ARCHETYPE_BUILDS.duellist.early);
    asked.mockRestore();
  });
});

describe('the page can be read', () => {
  const cases = (['en', 'nl'] as Language[]).flatMap((language) => (['start', ...STAGES] as (Stage | 'start')[]).map((stage) => [language, stage] as const));

  test.each(cases)('in %s, with the %s stage\'s builds on offer: nothing runs off the screen or into what stands beside it, for any kind', (language, stage) => {
    const app = onPage(AFTER[stage], language);
    for (const kind of ARCHETYPES) {
      onKind(app, kind);
      const texts = drawn(app).texts;
      for (const text of texts) {
        expect(text.left, `${kind}: ${text.text}`).toBeGreaterThanOrEqual(4);
        expect(text.right, `${kind}: ${text.text}`).toBeLessThanOrEqual(LOGICAL_W - 4);
      }
      for (const a of texts) for (const b of texts) if (a !== b) expect(overlap(a, b), `${kind}: "${a.text}" and "${b.text}"`).toBe(false);
      // The build to try ends above the foot of the screen: the hint, with the count of stripes and their next point either side of it.
      const hint = texts.find((t) => t.text === STRINGS.pilot.pageHint)!;
      const foot = texts.filter((t) => t.y >= hint.y);
      expect(foot, kind).toHaveLength(3);
      expect(texts.filter((t) => !foot.includes(t)).every((t) => t.y + LINE <= hint.y), kind).toBe(true);
    }
  });

  test('in Dutch every kind has its name, its rule, its line and its note, and the page its headings', () => {
    const app = onPage({ ...AFTER.early, wonAs: { skirmisher: 2 } }, 'nl');
    const N = STRINGS_NL.classes;
    expect(snap(app).menu.items.map((item) => item.label)).toEqual(['Duellist', 'Scherpschutter', 'Artillerie', 'Lansier', 'Bastion', 'Jager', 'Allrounder']);
    onKind(app, 'skirmisher');
    const shown = drawn(app);
    for (const text of ['KLASSE', 'DE EERSTE REGEL DIE PAST, TELT', 'ZEGES', 'JAGER', 'BOUW ER NU EEN', N.rules.skirmisher]) expect(written(shown, text), text).toBeTruthy();
    expect(shown.texts.some((t) => t.text.startsWith('Nog te kopen: '))).toBe(true);
    for (const kind of ARCHETYPES) {
      expect(N.names[kind], kind).not.toBe('');
      expect(N.notes[kind], kind).not.toBe(ENGLISH.notes[kind]);
      expect(N.tags[kind], kind).not.toBe(ENGLISH.tags[kind]);
      expect(N.rules[kind], kind).not.toBe(ENGLISH.rules[kind]);
    }
    expect([N.yours, N.owned, N.unsold]).toEqual(['NU DE JOUWE', 'Je hebt alles al', 'Nog niet alles is te koop']);
  });
});

describe('the garage says what the build is', () => {
  const inGarage = (saved: GameState, language: Language = 'en'): AppOf => {
    const { app } = inHub(saved);
    setLanguage(language);
    select(app, 'garage');
    expect(snap(app).screen).toBe('garage');
    return app;
  };
  const kindOf = (app: AppOf): Archetype => (snap(app).garage as { kind: Archetype }).kind;
  /** What is written between the heading and the way back, along the top. */
  const line = (app: AppOf): Written => {
    const top = drawn(app).texts.filter((t) => t.y === 1 && t.align === 'center');
    expect(top).toHaveLength(1);
    return top[0];
  };

  test.each(STARTERS.map((starter) => [starter.id, starter.build] as const))('the %s as it comes: the name of its kind and what that kind is good at, between the heading and the way back', (_id, build) => {
    const app = inGarage(flying(quiet(), build));
    const kind = archetypeOf(build, CATALOG);
    expect(kindOf(app)).toBe(kind);
    const said = line(app);
    expect(said.text).toBe(`${C.names[kind].toUpperCase()}: ${C.tags[kind]}`);
    expect(said.color).toBe(COLORS.text);
    const shown = drawn(app);
    expect(said.left).toBeGreaterThan(written(shown, STRINGS.garage.heading).right);
    expect(said.right).toBeLessThan(written(shown, STRINGS.garage.back).left);
  });

  test('what each kind is good at, in a few words', () => {
    expect(C.tags).toEqual({
      duellist: 'boosts in and strikes', marksman: 'one great shot at a time', artillery: 'fire on the whole field', lancer: 'beams that never run dry',
      bastion: 'takes it and stays standing', skirmisher: 'hard to hit, quick to act', allrounder: 'no weakness, no speciality',
    });
    expect(C.garage('Duellist', 'boosts in and strikes')).toBe('DUELLIST: boosts in and strikes');
  });

  test('with the cursor on a part that would make it another kind, the line says the kind it would be, lit; on one that would not, it stays as it is', () => {
    // A Hauler that owns a blade and a second rifle, and has neither fitted.
    let owner = flying(quiet(), STARTER_BUILD);
    owner = { ...owner, inventory: { ...owner.inventory, 'wpn-arc-blade': 1, 'wpn-scatter-gun': 1 } };
    const app = inGarage(owner);
    expect(line(app).text).toBe('ALL-ROUNDER: no weakness, no speciality');
    select(app, 'leftHand');
    const at = () => (snap(app).garage as { candidate: string | null }).candidate;
    const seen: Record<string, [Archetype, string]> = {};
    for (let i = 0; i < 6; i++) {
      seen[String(at())] = [kindOf(app), line(app).color];
      press(app, 'down');
    }
    expect(seen['wpn-arc-blade']).toEqual(['duellist', COLORS.armor]);
    expect(seen['wpn-scatter-gun']).toEqual(['allrounder', COLORS.text]);
    expect(seen.null).toEqual(['allrounder', COLORS.text]);
    // Fitted, it is what the machine is, and the line is plain again.
    for (let i = 0; i < 6 && at() !== 'wpn-arc-blade'; i++) press(app, 'down');
    press(app, 'confirm');
    expect(archetypeOf(app.game!.build, CATALOG)).toBe('duellist');
    expect([line(app).text, line(app).color]).toEqual(['DUELLIST: boosts in and strikes', COLORS.text]);
  });

  test('every kind\'s line fits between the heading and the way back, in both languages', () => {
    for (const language of ['en', 'nl'] as Language[]) {
      for (const kind of ARCHETYPES) {
        const app = inGarage(flying(quiet(), ARCHETYPE_BUILDS[kind].early), language);
        const S = language === 'nl' ? STRINGS_NL : STRINGS;
        const shown = drawn(app);
        const said = line(app);
        expect(said.text, `${language} ${kind}`).toBe(`${S.classes.names[kind].toUpperCase()}: ${S.classes.tags[kind]}`);
        expect(said.left, `${language} ${kind}`).toBeGreaterThan(written(shown, S.garage.heading).right + 4);
        expect(said.right, `${language} ${kind}`).toBeLessThan(written(shown, S.garage.back).left - 4);
        setLanguage('en');
      }
    }
  });
});

describe('a contract won is won as the kind of machine it was won in', () => {
  const WON: Settlement = { won: true, reward: 500, ammoCost: 0, repairCost: 0, net: 500, lines: [] };
  const LOST: Settlement = { won: false, reward: 0, ammoCost: 0, repairCost: 0, net: 0, lines: [] };
  const patrol = MISSIONS.find((m) => m.id === 'patrol')!;

  test('the patrol in the pilot\'s own Hauler is one for the all-rounders; flown through to its settlement, it is kept with the game', () => {
    const { app, store } = inHub(quiet());
    expect(app.game!.wonAs).toBeUndefined();
    accept(app, 'patrol');
    finishMission(app);
    expect(snap(app).settlement).toMatchObject({ won: true });
    expect(savedGame(store).wonAs).toEqual({ allrounder: 1 });
  });

  test('it is the build on the floor that counts, each time: the same pilot in a Courier wins as a skirmisher, behind a plate as a bastion', () => {
    const { app, store } = inHub(quiet());
    app.bookSettlement(WON, patrol);
    for (const starter of STARTERS.slice(1)) {
      app.commit(flying(app.game!, starter.build));
      app.bookSettlement(WON, patrol);
      app.bookSettlement(WON, patrol);
    }
    expect(savedGame(store).wonAs).toEqual({ allrounder: 1, skirmisher: 2, bastion: 2 });
    expect(savedGame(store).stats.contracts).toBe(5);
  });

  test('a contract lost is nobody\'s, and so is one won in a mech that was lent', () => {
    const { app, store } = inHub(quiet());
    app.bookSettlement(LOST, patrol);
    expect(savedGame(store).wonAs).toBeUndefined();
    app.bookSettlement(WON, lentPatrol(patrol, STARTER_BUILD, 'A mech of the company\'s.'));
    expect(savedGame(store).wonAs).toBeUndefined();
    expect(savedGame(store).stats.contracts).toBe(1);
  });

  test('a story contract, a contract beside the story and a fight in the arena all count, as the pilot\'s own machine', () => {
    const { app, store } = inHub(flying(quiet(done('intro-1', 'intro-2')), ARCHETYPE_BUILDS.duellist.early));
    app.bookSettlement({ ...WON, rank: 'A' }, MISSIONS.find((m) => m.id === 'hadron-1')!);
    app.bookSettlement({ ...WON, rank: 'B' }, MISSIONS.find((m) => m.id === 'bounty-1')!);
    app.bookSettlement(WON, arenaMission(app.game!, ARENA[0], { client: 'Arena Office', win: '' }));
    expect(savedGame(store).wonAs).toEqual({ duellist: 3 });
    expect(savedGame(store).arenaRank).toBe(1);
  });

  test('a floor of the Gauntlet is fought in the run\'s own mech and is no contract: it counts for no kind', () => {
    const { app, store } = inHub(strong(quiet(done('intro-1', 'intro-2'))));
    select(app, 'gauntlet');
    select(app, 'start');
    select(app, ids(app).includes('descend') ? 'descend' : 'door-0');
    expect(snap(app).screen).toBe('battle');
    finishBattle(app);
    expect(snap(app).battle?.outcome).toBe('victory');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('gauntlet');
    expect(savedGame(store).wonAs).toBeUndefined();
  });
});
