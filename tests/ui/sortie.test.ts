import { archetypeOf, type Archetype } from '../../src/core/archetype';
import { computeBuildStats } from '../../src/core/build';
import { saveLoadout, type GameState } from '../../src/core/game';
import type { Build, FramePart } from '../../src/core/types';
import { ARCHETYPE_BUILDS } from '../../src/content/archetypeBuilds';
import { WORLD } from '../../src/content/codex';
import { setLanguage, type Language } from '../../src/content/language';
import '../../src/content/nl';
import { STRINGS_NL } from '../../src/content/nl/strings';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { STRINGS } from '../../src/content/strings';
import { LOGICAL_W } from '../../src/ui/display';
import { COLORS, LINE } from '../../src/ui/widgets';
import { done, fresh, ids, inHub, press, savedGame, select, snap } from '../helpers/app';
import { wearing } from '../helpers/builds';
import { overlap, record, type Drawn, type Written } from '../helpers/canvas';

/**
 * The build a contract is taken in, chosen at its briefing: the row that turns through the build on
 * the floor and the saved ones, the page it opens, the class in the header, and what accepting does.
 */

afterEach(() => setLanguage('en'));

type AppOf = ReturnType<typeof inHub>['app'];
interface Chosen { slot: number | null; kind: Archetype; choices: number }
const chosen = (app: AppOf): Chosen | null => (snap(app).briefing as unknown as { build: Chosen | null }).build;
const drawn = (app: AppOf): Drawn => record((ctx) => app.draw(ctx));
const B = STRINGS.briefing;
const C = STRINGS.classes;
const quiet = (base: GameState): GameState => ({ ...base, codex: WORLD.map((entry) => entry.id), scenes: ['act-1'] });
const armourOf = (build: Build): number => (['head', 'core', 'arms', 'legs'] as const).reduce((sum, slot) => sum + (CATALOG[build[slot]!] as FramePart).ap, 0);

const DUELLIST = ARCHETYPE_BUILDS.duellist.war;
const BASTION = ARCHETYPE_BUILDS.bastion.war;
const SHARP = ARCHETYPE_BUILDS.marksman.war;
/**
 * A pilot at the war who flies a duellist and has a bastion saved first and a sharpshooter second;
 * the third place is empty. Kite has been met and sent on, so a wingman is for hire.
 */
function threeBuilds(): GameState {
  const story = done('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'hadron-2', 'lumen-2', 'undertow-2', 'rival-1', 'choice-lumen');
  let game = saveLoadout(wearing(story, BASTION), 0);
  game = saveLoadout(wearing(game, SHARP), 1);
  game = wearing(game, DUELLIST);
  return { ...quiet(game), scenes: ['act-1', 'act-2', 'talk-kite'], choices: { kite: 'pass' }, arenaRank: 3 };
}
function atBriefing(saved: GameState, contract = 'patrol', language: Language = 'en'): ReturnType<typeof inHub> {
  const made = inHub(saved);
  setLanguage(language);
  select(made.app, 'contracts');
  select(made.app, contract);
  expect(snap(made.app).screen).toBe('briefing');
  return made;
}
const toRow = (app: AppOf, id: string): void => {
  for (let i = 0; i < 8 && snap(app).menu.items[snap(app).menu.cursor]?.id !== id; i++) press(app, 'down');
  expect(snap(app).menu.items[snap(app).menu.cursor]?.id).toBe(id);
};
const written = (shown: Drawn, text: string): Written => {
  const found = shown.texts.filter((t) => t.text === text);
  expect(found, text).toHaveLength(1);
  return found[0];
};

describe('the build row', () => {
  test('is on the briefing of every contract flown in the pilot\'s own machine, under Accept', () => {
    const { app } = atBriefing(threeBuilds());
    expect(ids(app)).toEqual(['accept', 'build', 'wingman', 'back']);
    expect(snap(app).menu.items[1]).toMatchObject({ id: 'build', label: 'Build', enabled: true });
    // The cursor is where it always was: on Accept.
    expect(snap(app).menu.cursor).toBe(0);
    press(app, 'cancel');
    // A story contract, a contract off the board, and a fight in the arena.
    for (const id of ['lumen-3', ids(app).find((item) => item.startsWith('open-'))!]) {
      select(app, id);
      expect(ids(app), id).toContain('build');
      press(app, 'cancel');
    }
    press(app, 'cancel');
    select(app, 'arena');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('briefing');
    expect(ids(app)).toContain('build');
  });

  test('is not on a contract flown in a lent mech, nor on a drill: neither is flown in a build of the pilot\'s', () => {
    // A pilot whose own mech has no weapon is lent one for the patrol.
    const unarmed = { ...quiet(done('intro-1', 'intro-2')), build: { ...STARTER_BUILD, rightHand: undefined }, inventory: { ...fresh().inventory, 'wpn-rivet-rifle': 0 } };
    const lent = inHub(unarmed).app;
    select(lent, 'contracts');
    select(lent, 'patrol');
    if (snap(lent).briefing?.lent) {
      expect(ids(lent)).not.toContain('build');
      expect(chosen(lent)).toBeNull();
    }
    const { app } = inHub(threeBuilds());
    select(app, 'training');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('briefing');
    expect(ids(app)).not.toContain('build');
    expect(chosen(app)).toBeNull();
    expect(drawn(app).texts.some((t) => t.text === B.buildOnFloor)).toBe(false);
  });

  test('turns through the build on the floor and the saved builds that can be flown, round and round, with left, right or A', () => {
    const { app } = atBriefing(threeBuilds());
    expect(chosen(app)).toEqual({ slot: null, kind: 'duellist', choices: 3 });
    toRow(app, 'build');
    const turn = (key: 'left' | 'right' | 'confirm'): (number | null) => { press(app, key); return chosen(app)!.slot; };
    expect([turn('right'), turn('right'), turn('right')]).toEqual([0, 1, null]);
    expect([turn('left'), turn('left'), turn('left')]).toEqual([1, 0, null]);
    expect([turn('confirm'), turn('confirm')]).toEqual([0, 1]);
    expect(chosen(app)).toEqual({ slot: 1, kind: 'marksman', choices: 3 });
    // Turning starts nothing and fits nothing.
    expect(snap(app).screen).toBe('briefing');
    expect(app.game!.build).toEqual(DUELLIST);
  });

  test('with nothing saved the row is there all the same, turns to nothing, and its page says where builds are saved', () => {
    const { app } = atBriefing(quiet(done('intro-1', 'intro-2')));
    expect(ids(app)).toContain('build');
    expect(chosen(app)).toEqual({ slot: null, kind: 'allrounder', choices: 1 });
    toRow(app, 'build');
    press(app, 'right', 'left', 'confirm');
    expect(chosen(app)).toEqual({ slot: null, kind: 'allrounder', choices: 1 });
    const shown = drawn(app);
    expect(written(shown, 'Save builds in the Garage to choose one here.').color).toBe(COLORS.dim);
    expect(shown.texts.some((t) => t.text === B.buildHint)).toBe(false);
  });

  test('a saved build that cannot be flown is passed over: a part of it sold, or nothing saved there', () => {
    const base = threeBuilds();
    // The sharpshooter's longbow has been sold since it was saved.
    const sold = { ...base, inventory: { ...base.inventory, 'wpn-longbow': 0 } };
    const { app } = atBriefing(sold);
    expect(chosen(app)!.choices).toBe(2);
    toRow(app, 'build');
    press(app, 'right');
    expect(chosen(app)).toMatchObject({ slot: 0, kind: 'bastion' });
    press(app, 'right');
    expect(chosen(app)!.slot).toBeNull();
  });
});

describe('the header says what the contract will be taken in', () => {
  test('the build on the floor, plainly; a saved build that was turned to, by its number and lit', () => {
    const { app } = atBriefing(threeBuilds());
    let shown = drawn(app);
    const label = written(shown, 'CURRENT BUILD');
    const name = written(shown, 'DUELLIST');
    expect([label.color, name.color]).toEqual([COLORS.dim, COLORS.text]);
    // In the corner the title leaves free: right of the title, at the panel's right edge, above the line of the client's tag.
    const title = shown.texts.find((t) => t.size === 16 && t.y === 8)!;
    expect(label.left).toBeGreaterThan(title.right + 8);
    expect([label.right, name.right]).toEqual([LOGICAL_W - 12, LOGICAL_W - 12]);
    expect(name.y + LINE).toBeLessThanOrEqual(40);
    toRow(app, 'build');
    press(app, 'right');
    shown = drawn(app);
    expect(written(shown, 'BASTION').color).toBe(COLORS.accent);
    // The first saved build is build 1 to the pilot, as the garage numbers them.
    expect(shown.texts.filter((t) => t.text === 'SAVED BUILD 1').map((t) => t.y).sort((a, b) => a - b)).toEqual([9, 78]);
    press(app, 'right');
    expect(written(drawn(app), 'SHARPSHOOTER').color).toBe(COLORS.accent);
    // It stays in view when the cursor has moved on: the client talks, and the corner still says what was chosen.
    toRow(app, 'accept');
    shown = drawn(app);
    expect(written(shown, 'SAVED BUILD 2').y).toBe(9);
    expect(written(shown, 'SHARPSHOOTER').color).toBe(COLORS.accent);
  });

  test('the longest title a contract may have leaves the corner free, in both languages', () => {
    for (const language of ['en', 'nl'] as Language[]) {
      const { app } = atBriefing(threeBuilds(), 'patrol', language);
      const S = language === 'nl' ? STRINGS_NL : STRINGS;
      toRow(app, 'build');
      press(app, 'right', 'right');
      const shown = drawn(app);
      const label = shown.texts.find((t) => t.text === S.briefing.buildSaved(2) && t.y === 9)!;
      const name = written(shown, S.classes.names.marksman.toUpperCase());
      // Eighteen letters at the title's size, from where the title starts.
      const widest = 72 + 18 * (shown.texts.find((t) => t.size === 16 && t.y === 8)!.right - 72) / shown.texts.find((t) => t.size === 16 && t.y === 8)!.text.length;
      expect(Math.min(label.left, name.left), language).toBeGreaterThan(widest + 4);
      setLanguage('en');
    }
  });
});

describe('the page about the build', () => {
  test('while the cursor is on the row the client makes way for it: which build, what kind of machine, its figures and what it carries', () => {
    const { app } = atBriefing(threeBuilds());
    const talking = drawn(app).texts.map((t) => t.text);
    toRow(app, 'build');
    press(app, 'right');
    const shown = drawn(app);
    // The client's words are gone while the build is looked at, and back when the cursor moves on.
    const words = talking.filter((text) => text.length > 30);
    expect(words.length).toBeGreaterThan(0);
    for (const text of words) expect(shown.texts.some((t) => t.text === text), text).toBe(false);
    const stats = computeBuildStats(BASTION, CATALOG);
    const title = shown.texts.find((t) => t.text === 'SAVED BUILD 1' && t.y === 78)!;
    expect(title.color).toBe(COLORS.accent);
    expect(written(shown, 'BASTION: takes it and stays standing').y).toBe(93);
    expect(written(shown, `Armour ${armourOf(BASTION)}   Mobility ${stats.mobility}   Energy ${stats.turnEnergy}`)).toMatchObject({ y: 104, color: COLORS.dim });
    // What it fights with, and its module, each beside the name of its slot.
    const carried: [string, string][] = [['R.HAND', 'Rivet Rifle'], ['L.HAND', 'Pulse Carbine'], ['SHLDR', 'Mortar Pod'], ['MOD', 'Pulse Barrier']];
    carried.forEach(([tag, name], i) => {
      const at = shown.texts.filter((t) => t.text === tag);
      expect(at, tag).toHaveLength(1);
      expect(at[0].y, tag).toBe(120 + i * LINE);
      const beside = shown.texts.filter((t) => t.y === at[0].y - 1 && t.left > at[0].right);
      expect(beside.map((t) => t.text), tag).toEqual([name]);
    });
    expect(written(shown, 'LEFT/RIGHT: another build')).toMatchObject({ y: 180, color: COLORS.dim });
    toRow(app, 'accept');
    for (const text of words) expect(drawn(app).texts.some((t) => t.text === text), text).toBe(true);
  });

  test('an empty hand is a dash, and the figures are the build\'s own, with what the bench has done counted', () => {
    const base = threeBuilds();
    const { app } = atBriefing({ ...base, tuning: { 'gen-prism': 2 } });
    toRow(app, 'build');
    press(app, 'right', 'right');
    const shown = drawn(app);
    // The sharpshooter carries a longbow and a sunlance: nothing in the left hand, no module.
    const dashes = shown.texts.filter((t) => t.text === '-');
    expect(dashes).toHaveLength(2);
    expect(dashes.every((t) => t.color === COLORS.dim)).toBe(true);
    const plain = computeBuildStats(SHARP, CATALOG).turnEnergy;
    const line = shown.texts.find((t) => t.text.startsWith('Armour '))!.text;
    const energy = Number(/Energy (\d+)/.exec(line)![1]);
    // Two steps at the bench on its generator: a tenth more output, and the page says so.
    expect(energy).toBeGreaterThan(plain);
  });

  test.each(['en', 'nl'] as Language[])('in %s, for every build there is to turn to, nothing runs off the panel or into what stands beside it', (language) => {
    const { app } = atBriefing(threeBuilds(), 'lumen-3', language);
    toRow(app, 'build');
    for (let i = 0; i < 3; i++) {
      const texts = drawn(app).texts;
      for (const text of texts) {
        expect(text.left, text.text).toBeGreaterThanOrEqual(4);
        expect(text.right, text.text).toBeLessThanOrEqual(LOGICAL_W - 4);
      }
      for (const a of texts) for (const b of texts) if (a !== b) expect(overlap(a, b), `"${a.text}" and "${b.text}"`).toBe(false);
      // The page ends above the panel under it.
      const page = texts.filter((t) => t.y >= 78 && t.y < 198);
      expect(Math.max(...page.map((t) => t.y)) + LINE).toBeLessThanOrEqual(194);
      press(app, 'right');
    }
  });

  test('in Dutch the row, the two names a build goes by, and the two hints', () => {
    const { app } = atBriefing(threeBuilds(), 'patrol', 'nl');
    const N = STRINGS_NL.briefing;
    expect(snap(app).menu.items[1].label).toBe('Build');
    toRow(app, 'build');
    expect(written(drawn(app), 'LEFT/RIGHT: andere build')).toBeTruthy();
    expect(drawn(app).texts.filter((t) => t.text === 'HUIDIGE BUILD')).toHaveLength(2);
    press(app, 'right');
    expect(drawn(app).texts.filter((t) => t.text === 'MIJN BUILD 1')).toHaveLength(2);
    expect([N.buildOnFloor, N.buildSaved(3), N.buildNone]).toEqual(['HUIDIGE BUILD', 'MIJN BUILD 3', 'Bewaar builds in de Garage en kies er hier een.']);
  });
});

describe('accepting', () => {
  test('with a saved build chosen, fits it and starts the contract in it: the game is kept with that build on the floor, and the saved builds as they were', () => {
    const base = threeBuilds();
    const { app, store } = atBriefing(base);
    toRow(app, 'build');
    press(app, 'right');
    toRow(app, 'accept');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('battle');
    expect(snap(app).player!.maxAp).toBe(armourOf(BASTION));
    expect(app.game!.build).toEqual(BASTION);
    const kept = savedGame(store);
    expect(kept.build).toEqual(BASTION);
    expect(kept.loadouts).toEqual(base.loadouts);
    expect(kept.inventory).toEqual(base.inventory);
    expect(archetypeOf(kept.build, CATALOG)).toBe('bastion');
  });

  test('with the build on the floor chosen, changes nothing: whether it was never turned from, or turned to and back', () => {
    const base = threeBuilds();
    for (const presses of [[], ['right', 'right', 'right'], ['left', 'right']] as ('left' | 'right')[][]) {
      const { app, store } = atBriefing(base);
      toRow(app, 'build');
      press(app, ...presses);
      toRow(app, 'accept');
      press(app, 'confirm');
      expect(snap(app).screen).toBe('battle');
      expect(snap(app).player!.maxAp).toBe(armourOf(DUELLIST));
      expect(savedGame(store).build).toEqual(DUELLIST);
    }
  });

  test('a build that was turned to and not accepted is not fitted: B, and Back, leave the game as it was', () => {
    const base = threeBuilds();
    for (const leave of ['cancel', 'back'] as const) {
      const { app, store } = atBriefing(base);
      toRow(app, 'build');
      press(app, 'right');
      if (leave === 'cancel') press(app, 'cancel');
      else { toRow(app, 'back'); press(app, 'confirm'); }
      expect(snap(app).screen).toBe('hub');
      expect(app.game!.build).toEqual(DUELLIST);
      expect(savedGame(store).build).toEqual(DUELLIST);
      // Opened again, the briefing starts from the build on the floor.
      select(app, 'patrol');
      expect(chosen(app)!.slot).toBeNull();
    }
  });

  test('with a wingman hired as well, both hold: the saved build is flown and the wingman fires', () => {
    const { app } = atBriefing(threeBuilds());
    toRow(app, 'wingman');
    press(app, 'right');
    toRow(app, 'build');
    press(app, 'right', 'right');
    // Turning the build has not sent the wingman home, and hiring has not turned the build back.
    expect((snap(app).briefing as unknown as { wingman: { id: string | null } }).wingman.id).toBe('kite');
    expect(chosen(app)!.slot).toBe(1);
    toRow(app, 'accept');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('battle');
    expect((snap(app).battle as unknown as { support: string | null }).support).toBe('Kite');
    expect(snap(app).player!.maxAp).toBe(armourOf(SHARP));
  });

  test('a mirror match fought in a saved build is fought against that build: the mirror is of what is flown', () => {
    const { app } = inHub(threeBuilds());
    select(app, 'arena');
    select(app, 'mirror');
    expect(snap(app).screen).toBe('briefing');
    toRow(app, 'build');
    press(app, 'right');
    toRow(app, 'accept');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('battle');
    expect(app.game!.build).toEqual(BASTION);
    expect(app.enemies().mirror.build).toMatchObject({ core: BASTION.core, legs: BASTION.legs, rightHand: BASTION.rightHand });
  });
});

describe('what the app is asked to fit', () => {
  test('a slot that cannot be flown from starts nothing and changes nothing: nothing saved there, no such slot, a part sold', () => {
    const base = threeBuilds();
    const { app, store } = inHub(base);
    for (const slot of [2, 7, -1]) {
      app.startMission('patrol', false, null, false, slot);
      expect(snap(app).screen, String(slot)).toBe('hub');
      expect(app.game!.build).toEqual(DUELLIST);
    }
    app.commit({ ...app.game!, inventory: { ...app.game!.inventory, 'wpn-longbow': 0 } });
    app.startMission('patrol', false, null, false, 1);
    expect(snap(app).screen).toBe('hub');
    expect(savedGame(store).build).toEqual(DUELLIST);
    // A slot that can be flown from starts it, fitted.
    app.startMission('patrol', false, null, false, 0);
    expect(snap(app).screen).toBe('battle');
    expect(savedGame(store).build).toEqual(BASTION);
  });

  test('nothing is fitted for a contract that is not on offer: no such contract, or one that waits for the mech to be put right', () => {
    const { app, store } = inHub(threeBuilds());
    expect(app.missions().map((mission) => mission.id)).toContain('lumen-3');
    app.startMission('no-such-contract', false, null, false, 0);
    expect(snap(app).screen).toBe('hub');
    expect(app.game!.build).toEqual(DUELLIST);
    expect(savedGame(store).build).toEqual(DUELLIST);
    // A mech that may not deploy is offered the lent patrol only. A contract of the story is not started by
    // naming a saved build for it: the build would be fitted for work that was not on offer.
    const unarmed = { ...threeBuilds(), build: { ...DUELLIST, rightHand: undefined, leftHand: undefined, shoulder: undefined } };
    const stripped = inHub(unarmed);
    expect(stripped.app.buildErrors()).toEqual(['noWeapon']);
    expect(stripped.app.missions().map((mission) => mission.id)).toEqual(['patrol']);
    stripped.app.startMission('lumen-3', false, null, false, 0);
    expect(snap(stripped.app).screen).toBe('hub');
    expect(stripped.app.game!.build).toEqual(unarmed.build);
    expect(savedGame(stripped.store).build).toEqual(JSON.parse(JSON.stringify(unarmed.build)));
  });

  test('what may deploy is judged as the garage judges it, with the bench\'s work counted: a build only the bench makes fit to fly is offered, and fitted', () => {
    // A hungry frame on the starter's generator with one weapon, a sunlance: twenty of energy short of firing it as the parts are sold.
    const hungry: Build = { ...STARTER_BUILD, head: 'head-auditor', core: 'core-sterling', arms: 'arms-shrike', fcs: 'fcs-omni', rightHand: undefined, shoulder: 'wpn-sunlance' };
    const owner = wearing(wearing(quiet(done('intro-1', 'intro-2')), hungry), STARTER_BUILD);
    const base = { ...owner, loadouts: [hungry, null, null] };
    // As sold: not offered, and asked for all the same it starts nothing.
    const plain = inHub(base);
    expect(plain.app.sorties().map((sortie) => sortie.slot)).toEqual([null]);
    plain.app.startMission('patrol', false, null, false, 0);
    expect(snap(plain.app).screen).toBe('hub');
    expect(savedGame(plain.store).build).toEqual(STARTER_BUILD);
    // One step at the bench on the generator gives it those twenty: offered, and fitted when accepted.
    const tuned = inHub({ ...base, tuning: { 'gen-kd1': 1 } });
    expect(tuned.app.sorties().map((sortie) => sortie.slot)).toEqual([null, 0]);
    tuned.app.startMission('patrol', false, null, false, 0);
    expect(snap(tuned.app).screen).toBe('battle');
    expect(savedGame(tuned.store).build).toEqual(hungry);
  });

  test('what can be flown is what the row turns through, and a drill fits nothing whatever it is asked', () => {
    const { app } = inHub(threeBuilds());
    expect(app.sorties().map((sortie) => sortie.slot)).toEqual([null, 0, 1]);
    app.startMission('drill-aim', false, null, false, 0);
    // A drill is flown in the simulator's mech: asked to fit a build for it, the app does not start it and fits nothing.
    expect(app.game!.build).toEqual(DUELLIST);
  });
});
