import { arrivedMessages, availableMissions, completeMission, decide, forCycle, otherOffer, sideMissions, type Mission } from '../../src/core/campaign';
import { openEntries } from '../../src/core/codex';
import { newGame, type GameState } from '../../src/core/game';
import { feeAfter, takesWingman } from '../../src/core/wingman';
import { ALL_ENEMIES } from '../../src/content/arena';
import { MANUAL } from '../../src/content/codex';
import { FINDS } from '../../src/content/finds';
import { setLanguage } from '../../src/content/language';
import '../../src/content/nl';
import { MESSAGES, MISSIONS } from '../../src/content/missions';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';
import { SCENES } from '../../src/content/scenes';
import SPRITES from '../../src/content/sprites.json';
import { STRINGS } from '../../src/content/strings';
import { AFTERMATH, REMEMBERED } from '../../src/content/talks';
import { WINGMEN } from '../../src/content/wingmen';
import { TALK_CHARS, TALK_LINES } from '../../src/ui/battleScreen';
import { BRIEFING_CHARS, briefingRows, groundLines, objectiveLines } from '../../src/ui/briefingScreen';
import { LOGICAL_W } from '../../src/ui/display';
import { charsFor, wrap } from '../../src/ui/widgets';
import { autoBattle, finishMission, inHub, press, retreat, savedGame, select, snap, strong } from '../helpers/app';
import { record } from '../helpers/canvas';
import { unknownTerms } from '../helpers/conditions';

const fresh = (cycle = 1): GameState => ({ ...newGame(CATALOG, STARTER_BUILD), cycle });
const did = (game: GameState, ...ids: string[]): GameState => ids.reduce((g, id) => completeMission(g, id, MISSIONS), game);
const mission = (id: string): Mission => MISSIONS.find((m) => m.id === id)!;
const offered = MISSIONS.filter((m) => m.other);
const offer = (id: string, game = fresh()): Mission => otherOffer(game, mission(id), MISSIONS)!;
const found = (game: GameState): string[] => openEntries(game, FINDS, MISSIONS).opened.map((f) => f.id);
const letters = (game: GameState): string[] => arrivedMessages(game, MESSAGES, MISSIONS).map((m) => m.id);
const ACT_ONE = ['intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'lumen-1', 'lumen-2', 'undertow-1', 'undertow-2', 'rival-1'];

describe('the other offer', () => {
  test('is not made in a first telling, is made in a later one, and stands until the contract is done', () => {
    expect(otherOffer(fresh(0), mission('hadron-1'), MISSIONS)).toBeNull();
    expect(otherOffer(fresh(1), mission('hadron-1'), MISSIONS)).not.toBeNull();
    expect(otherOffer(fresh(4), mission('hadron-1'), MISSIONS)).not.toBeNull();
    expect(otherOffer(did(fresh(1), 'hadron-1'), mission('hadron-1'), MISSIONS)).toBeNull();
    // A contract that has none has none, in any telling.
    expect(otherOffer(fresh(3), mission('lumen-1'), MISSIONS)).toBeNull();
  });

  test('is the same contract with the other side\'s client, words, pay and fight, marked with what winning it is remembered as', () => {
    const first = mission('hadron-1');
    const other = offer('hadron-1');
    expect(other).toMatchObject({
      id: 'hadron-1', phase: 'faction', title: first.title, faction: 'hadron',
      client: 'Tamsin, The Undertow', portrait: 'portrait-undertow', reward: 900, scale: 1, turned: { question: 'seam', answer: 'stand' },
    });
    expect(other.briefing).toBe(first.other!.briefing);
    expect(other.debrief).toBe(first.other!.debrief);
    expect(other.battles).toBe(first.other!.battles);
    expect(other.battles).not.toEqual(first.battles);
    // It is one offer, not a contract that has another behind it; and the contract it was made from is as it was.
    expect('other' in other).toBe(false);
    expect('when' in other).toBe(false);
    expect(first.turned).toBeUndefined();
    expect(first.client).toBe('Director Brenn, Hadron Mining');
  });

  test('grows with the cycle as the contract itself does: its pay, its strength, and what it has to keep alive', () => {
    for (const first of offered) {
      for (const cycle of [1, 2, 5]) {
        const grown = forCycle(first, cycle);
        const other = otherOffer(fresh(cycle), grown, MISSIONS)!;
        expect(other.reward, `${first.id} in cycle ${cycle}`).toBe(Math.round(first.other!.reward * Math.min(1 + 0.5 * cycle, 2)));
        expect(other.scale, `${first.id} in cycle ${cycle}`).toBeCloseTo((first.other!.scale ?? 1) * Math.min(1 + 0.25 * cycle, 1.5), 5);
        // What the contract itself asks is untouched by what the other side asks.
        expect(grown.reward).toBe(forCycle({ ...first, other: undefined }, cycle).reward);
      }
    }
    const guarded: Mission = { ...mission('hadron-1'), other: { ...mission('hadron-1').other!, battles: [{ enemies: ['recon-drone'], background: 'bg', objective: { type: 'protect', name: 'Dial', hp: 10 } }] } };
    expect(forCycle(guarded, 1).other!.battles[0].objective).toEqual({ type: 'protect', name: 'Dial', hp: 13 });
    expect(guarded.other!.battles[0].objective).toEqual({ type: 'protect', name: 'Dial', hp: 10 });
  });

  test('is not made for a contract played again from the archive: what was flown there was the first offer', () => {
    expect(otherOffer(fresh(1), { ...mission('hadron-1'), replay: true }, MISSIONS)).toBeNull();
  });
});

describe('the three offers', () => {
  test('are for three contracts of the first act, each from the side the first offer is against', () => {
    expect(offered.map((m) => [m.id, m.other!.client, m.other!.question, m.other!.answer, m.other!.when])).toEqual([
      ['hadron-1', 'Tamsin, The Undertow', 'seam', 'stand', 'cycle:1'],
      ['hadron-2', 'Tamsin, The Undertow', 'train', 'weigh', 'cycle:1'],
      ['undertow-1', 'Analyst Varga, Lumen Systems', 'lights', 'dark', 'cycle:1'],
    ]);
    for (const m of offered) {
      expect(m.phase, m.id).toBe('faction');
      expect(m.other!.client, m.id).not.toBe(m.client);
      expect(unknownTerms(m.other!.when), m.id).toEqual([]);
      // What it is remembered under is its own: no conversation asks the same question.
      expect(SCENES.some((scene) => scene.choice?.id === m.other!.question), m.id).toBe(false);
      expect(Object.keys(REMEMBERED[m.other!.question]), m.id).toEqual([m.other!.answer]);
    }
    expect(new Set(offered.map((m) => m.other!.question)).size).toBe(3);
  });

  test('field machines and places the game has, with a face for whoever speaks', () => {
    for (const m of offered) {
      const other = m.other!;
      expect(other.portrait! in SPRITES, m.id).toBe(true);
      expect(other.battles.length, m.id).toBeGreaterThanOrEqual(1);
      for (const battle of other.battles) {
        for (const id of battle.enemies) expect(Object.hasOwn(ALL_ENEMIES, id), `${m.id}: ${id}`).toBe(true);
        expect(battle.background in SPRITES, `${m.id}: ${battle.background}`).toBe(true);
        for (const line of battle.talk ?? []) expect(line.portrait! in SPRITES, `${m.id}: ${line.who}`).toBe(true);
        expect((battle.talk ?? []).length, m.id).toBeGreaterThan(0);
      }
    }
    // Where the tank of Seam Nine fires for the pilot there is no room for a second gun for hire.
    expect(offer('hadron-1').battles.map((b) => b.support)).toEqual([{ name: 'The tank', damage: 30 }, { name: 'The tank', damage: 30 }]);
    expect(takesWingman(offer('hadron-1'))).toBe(false);
    // The train's guard is not there to be broken: it is held for five rounds, and it is twice the guard the yard admits to.
    expect(offer('hadron-2').battles.map((b) => [b.enemies, b.objective])).toEqual([[['heavy-mech', 'tank', 'gun-turret'], { type: 'survive', rounds: 5 }]]);
    expect(offer('hadron-2').scale).toBe(2);
    expect(offer('hadron-2').briefing.join(' ')).toMatch(/Hold it five rounds/);
    // Tamsin's word that it is done comes as the last of the five begins.
    expect(offer('hadron-2').battles[0].talk!.map((line) => line.at)).toEqual(['start', 5, 'win']);
    // The other two are fought to the end, at the strength the cycle gives them.
    for (const id of ['hadron-1', 'undertow-1']) {
      expect(offer(id).scale, id).toBe(1);
      expect(offer(id).battles.every((b) => b.objective === undefined), id).toBe(true);
    }
  });

  test.each(['en', 'nl'] as const)('each briefing fits its panel and each line said in battle its box (%s)', (language) => {
    setLanguage(language);
    try {
      for (const m of offered) {
        const other = offer(m.id);
        // As the screen lays it out: a line every eleven dots, four more between paragraphs, and no line below the last row.
        let y = 0;
        for (const paragraph of other.briefing) {
          for (const _line of wrap(paragraph, BRIEFING_CHARS)) {
            expect(y, `briefing of the other offer for ${m.id} is too long`).toBeLessThanOrEqual((briefingRows(other) - 1) * 11);
            y += 11;
          }
          y += 4;
        }
        for (const line of [...objectiveLines(other), ...groundLines(other)]) expect(line.length, `${m.id}: ${line}`).toBeLessThanOrEqual(BRIEFING_CHARS);
        expect(wrap(other.debrief, 43).length, m.id).toBeLessThanOrEqual(3);
        for (const battle of other.battles) {
          for (const line of battle.talk ?? []) expect(wrap(line.text, TALK_CHARS).length, line.text).toBeLessThanOrEqual(TALK_LINES);
        }
      }
    } finally {
      setLanguage('en');
    }
  });

  test('are not the same contract with a better prize: those who cannot pay as much pay less, and the one who can pays three times as much', () => {
    expect(offer('hadron-1').reward).toBeLessThan(mission('hadron-1').reward);
    expect(offer('hadron-2').reward).toBeLessThan(mission('hadron-2').reward);
    expect(offer('undertow-1').reward).toBe(3 * mission('undertow-1').reward);
    expect(offer('undertow-1').briefing.join(' ')).toMatch(/three times the other offer/);
  });
});

describe('what comes of the other offer', () => {
  const war = [...ACT_ONE, 'choice-lumen', 'lumen-3', 'lumen-4', 'lumen-5', 'finale-lumen'];

  test('standing with Seam Nine finds what is under the tank\'s seat at once, and Brenn writes another letter than his thanks', () => {
    const first = did(fresh(1), 'intro-1', 'intro-2', 'hadron-1');
    const stood = decide(first, 'seam', 'stand');
    expect(found(first)).not.toContain('paper-order');
    expect(found(stood)).toContain('paper-order');
    expect(letters(first)).toContain('hadron-thanks');
    expect(letters(first)).not.toContain('brenn-seam');
    expect(letters(stood)).toContain('brenn-seam');
    expect(letters(stood)).not.toContain('hadron-thanks');
    // The story goes on as it would: the next contract of his is on offer, as his letter says.
    expect(availableMissions(stood, MISSIONS).map((m) => m.id)).toContain('hadron-2');
    expect(MESSAGES.find((m) => m.id === 'brenn-seam')!.body.join(' ')).toMatch(/My next contract is waiting/);
  });

  test('weighing the train finds the ticket at once, and Brenn has the dial replaced', () => {
    const first = did(fresh(1), 'intro-1', 'intro-2', 'hadron-1', 'hadron-2');
    const weighed = decide(first, 'train', 'weigh');
    expect(found(first)).not.toContain('paper-ticket');
    expect(found(weighed)).toContain('paper-ticket');
    expect(letters(first)).toContain('hadron-second');
    expect(letters(weighed)).toContain('brenn-train');
    expect(letters(weighed)).not.toContain('hadron-second');
  });

  test('leaving the relay dark for Lumen\'s money costs Tamsin\'s thanks and her favour, and the third offer in this telling', () => {
    const first = did(fresh(1), 'intro-1', 'intro-2', 'undertow-1');
    const dark = decide(first, 'lights', 'dark');
    // Not the rhyme: nobody is made this offer who does not hold it already, so nothing is said to be withheld that cannot be.
    expect(found(first)).toContain('paper-rhyme');
    expect(found(dark)).toContain('paper-rhyme');
    expect(letters(first)).toContain('undertow-thanks');
    expect(letters(dark)).not.toContain('undertow-thanks');
    expect(letters(dark)).toContain('undertow-dark');
    expect(MESSAGES.find((m) => m.id === 'undertow-dark')!.body.join(' ')).toMatch(/I will still hire you\..*Not this year\.$/);
    // Her letter counts what she sent that night: the machines the pilot was paid to remove, not nobody.
    expect(offer('undertow-1').battles.flatMap((b) => b.enemies)).toHaveLength(5);
    expect(MESSAGES.find((m) => m.id === 'undertow-dark')!.body[0]).toMatch(/five machines/);
    expect(MESSAGES.find((m) => m.id === 'undertow-dark')!.body.join(' ')).not.toMatch(/Nobody came/);
    // She still hires: the next contract of hers is on offer. But her favour is not asked of this pilot.
    expect(availableMissions(dark, MISSIONS).map((m) => m.id)).toContain('undertow-2');
    const kept = decide(first, 'logs', 'keep');
    expect(sideMissions(kept, MISSIONS).map((m) => m.id)).toContain('favour-undertow');
    expect(sideMissions(decide(kept, 'lights', 'dark'), MISSIONS).map((m) => m.id)).not.toContain('favour-undertow');
    // The box brought home and nine checks held: the third verdict is hers to offer, and she does not.
    const checks = FINDS.filter((f) => f.kind === 'check').slice(0, 9).map((f) => f.id);
    const audited = { ...decide(did(fresh(1), ...war, 'quest-1', 'quest-2', 'quest-3', 'audit-1', 'audit-2', 'audit-3'), 'logs', 'keep'), codex: checks };
    const verdicts = (game: GameState): string[] => availableMissions(game, MISSIONS).map((m) => m.id).filter((id) => id.startsWith('verdict-'));
    expect(verdicts(audited)).toEqual(['verdict-enforce', 'verdict-default', 'verdict-quorum']);
    expect(verdicts(decide(audited, 'lights', 'dark'))).toEqual(['verdict-enforce', 'verdict-default']);
    expect(letters(audited)).toContain('third-offer');
    expect(letters(decide(audited, 'lights', 'dark')).filter((id) => ['third-offer', 'short-of-nine'].includes(id))).toEqual([]);
    expect(letters({ ...decide(audited, 'lights', 'dark'), codex: checks.slice(0, 8) }).filter((id) => ['third-offer', 'short-of-nine'].includes(id))).toEqual([]);
    // It is this telling's doing only: the next one starts clean.
    expect(verdicts({ ...audited, choices: { logs: 'keep' } })).toContain('verdict-quorum');
  });

  test('is told at the end, on a page of its own, to a pilot who took any of them', () => {
    const page = AFTERMATH.find((scene) => scene.id === 'left-3')!;
    expect(page.linesFor!({})).toEqual([]);
    expect(page.linesFor!({ kite: 'vouch', logs: 'keep' })).toEqual([]);
    expect(page.linesFor!({ seam: 'stand', lights: 'dark' })).toEqual([REMEMBERED.seam.stand, REMEMBERED.lights.dark]);
  });

  test('what is told is what was done that night, and holds whatever road the pilot took afterwards', () => {
    // A pilot who stood with Seam Nine may go on to burn it out for Hadron: the page cannot say the tank is still there.
    expect(mission('choice-hadron').briefing.join(' ')).toMatch(/Seam Nine.*Burn both out/);
    expect(REMEMBERED.seam.stand).toMatch(/^One night /);
    expect(REMEMBERED.seam.stand).not.toMatch(/still/);
    // Nor does Tamsin's offer tell the pilot what they know: who paid for the tank is what taking it finds out.
    expect(offer('hadron-1').briefing.join(' ')).not.toMatch(/You know/);
    expect(offer('hadron-1').briefing[0]).toMatch(/You have seen what is parked in Seam Nine\. Ask who paid for it\.$/);
  });

  test('every pilot who can be made Lumen\'s offer holds the rhyme already: a first telling cannot be finished without it', () => {
    for (const faction of ['hadron', 'lumen', 'undertow'] as const) {
      const told = MISSIONS.filter((m) => ['intro', 'faction', 'rival', 'audit'].includes(m.phase) || (['choice', 'path', 'finale'].includes(m.phase) && m.faction === faction) || m.id === 'verdict-default');
      expect(told.map((m) => m.id), faction).toContain('undertow-1');
      expect(found(did(fresh(0), ...told.map((m) => m.id))), faction).toContain('paper-rhyme');
    }
    expect(FINDS.find((f) => f.id === 'paper-rhyme')!.after).toBe('undertow-1');
  });

  test('the first offer flown in a later telling is as it always was: nothing is remembered, and the thanks come', () => {
    const flown = did(fresh(1), 'intro-1', 'intro-2', 'hadron-1', 'hadron-2', 'undertow-1');
    expect(flown.choices ?? {}).toEqual({});
    expect(letters(flown)).toEqual(expect.arrayContaining(['hadron-thanks', 'hadron-second', 'undertow-thanks']));
    expect(letters(flown).filter((id) => ['brenn-seam', 'brenn-train', 'undertow-dark'].includes(id))).toEqual([]);
    expect(found(flown)).toContain('paper-rhyme');
  });
});

describe('the other offer in the game', () => {
  type Briefing = { mission: string; reward: number; offers: number; client: string; turned: boolean; wingman: { id: string | null; open: number } | null };
  const briefing = (app: Parameters<typeof snap>[0]) => snap(app).briefing as unknown as Briefing;
  const later = (cycle = 1): GameState => ({ ...strong(did(fresh(cycle), 'intro-1', 'intro-2')), scenes: SCENES.filter((s) => !s.ending).map((s) => s.id) });
  /** The same game with the language the pilot chose: the game sets it when it loads. */
  const told = (game: GameState, language: 'en' | 'nl'): GameState => ({ ...game, settings: { ...game.settings, language } });
  function open(game: GameState, id: string) {
    const made = inHub(game);
    select(made.app, 'contracts');
    select(made.app, id);
    expect(snap(made.app).screen).toBe('briefing');
    return made;
  }

  test('a first telling has one offer for every contract', () => {
    const { app } = open(later(0), 'hadron-1');
    expect(briefing(app)).toMatchObject({ offers: 1, turned: false, client: 'Director Brenn, Hadron Mining' });
    expect(snap(app).menu.items.map((item) => item.id)).not.toContain('other');
  });

  test('in a later telling the briefing has a row that turns the page to the other side\'s offer, and back', () => {
    const { app } = open(later(), 'hadron-1');
    expect(briefing(app)).toMatchObject({ mission: 'hadron-1', offers: 2, turned: false, client: 'Director Brenn, Hadron Mining', reward: 2400 });
    expect(snap(app).menu.items.find((item) => item.id === 'other')).toEqual({ id: 'other', label: 'Other offer', enabled: true });
    // The cursor opens on Accept, as on any briefing: nobody takes the other offer by habit.
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('accept');
    select(app, 'other');
    expect(briefing(app)).toMatchObject({ mission: 'hadron-1', offers: 2, turned: true, client: 'Tamsin, The Undertow', reward: 1350 });
    expect(snap(app).menu.items.find((item) => item.id === 'other')!.label).toBe('First offer');
    // The cursor stays on the row that turns the page, so the two can be read one after the other.
    expect(snap(app).menu.items[snap(app).menu.cursor].id).toBe('other');
    press(app, 'confirm');
    expect(briefing(app)).toMatchObject({ turned: false, client: 'Director Brenn, Hadron Mining', reward: 2400 });
    // Back leaves to the list either way.
    select(app, 'other');
    press(app, 'cancel');
    expect(snap(app).screen).toBe('hub');
  });

  test.each(['en', 'nl'] as const)('the header says which offer is showing: that there are two, and on the other that taking it is remembered (%s)', (language) => {
    try {
      const { app } = open(told(later(), language), 'hadron-1');
      const B = STRINGS.briefing;
      expect(B.otherOffer).toBe(language === 'nl' ? 'Ander bod' : 'Other offer');
      const tag = (text: string): string[] => wrap(text, charsFor(LOGICAL_W - 84));
      // Two lines is the room there is under the client's name.
      for (const text of [B.twoOffers, B.otherTag]) expect(tag(text).length, text).toBeLessThanOrEqual(2);
      const first = mission('hadron-1');
      const drawn = (): string[] => record((ctx) => app.draw(ctx)).texts.map((t) => t.text);
      expect(drawn()).toEqual(expect.arrayContaining([...tag(B.twoOffers), first.client, B.otherOffer, `${B.reward} 2400`]));
      expect(drawn()).not.toContain(B.firstOffer);
      for (const line of tag(B.otherTag)) expect(drawn()).not.toContain(line);
      select(app, 'other');
      expect(drawn()).toEqual(expect.arrayContaining([...tag(B.otherTag), first.other!.client, B.firstOffer, `${B.reward} 1350`]));
      expect(drawn()).not.toContain(B.otherOffer);
      expect(drawn()).not.toContain(first.client);
      for (const line of tag(B.twoOffers)) expect(drawn()).not.toContain(line);
      // Under their words: who fires beside the pilot there, battle by battle.
      const tank = first.other!.battles[0].support!.name;
      expect(tank).toBe(language === 'nl' ? 'De tank' : 'The tank');
      expect(drawn()).toEqual(expect.arrayContaining([`1: ${B.support(tank)}`, `2: ${B.support(tank)}`]));
    } finally {
      setLanguage('en');
    }
  });

  test('a contract with nobody for hire and one offer has three rows, and one with somebody for hire and two offers has five: all of them inside the footer', () => {
    const rowsOf = (app: Parameters<typeof snap>[0]) => {
      const labels = snap(app).menu.items.map((item) => item.label);
      const texts = record((ctx) => app.draw(ctx)).texts.filter((t) => labels.includes(t.text) && t.x >= 240);
      expect(texts.map((t) => t.text)).toEqual(labels);
      for (const t of texts) {
        expect(t.y, t.text).toBeGreaterThanOrEqual(200);
        expect(t.y + 11, t.text).toBeLessThanOrEqual(264);
        expect(t.right, t.text).toBeLessThanOrEqual(LOGICAL_W - 6);
      }
      // The block of rows stays in the middle of the footer: each row more starts it half a line higher, until five
      // rows, which start as high as the footer has room for.
      expect(texts[0].y).toBe([216, 210, 204, 202][labels.length - 2]);
      texts.forEach((t, i) => expect(t.y, t.text).toBe(texts[0].y + i * 11));
      return labels;
    };
    for (const language of ['en', 'nl'] as const) {
      try {
        // Kite is for hire from the second contract on; where the tank of Seam Nine fires there is no room for them.
        const { app } = open(told(later(), language), 'hadron-1');
        const B = STRINGS.briefing;
        expect(B.firstOffer).toBe(language === 'nl' ? 'Eerste bod' : 'First offer');
        expect(rowsOf(app)).toEqual([B.accept, B.build, B.wingman, B.otherOffer, B.back]);
        select(app, 'other');
        expect(rowsOf(app)).toEqual([B.accept, B.build, B.firstOffer, B.back]);
        const second = open(told(did(later(), 'hadron-1'), language), 'hadron-2').app;
        select(second, 'other');
        expect(rowsOf(second)).toEqual([B.accept, B.build, B.wingman, B.firstOffer, B.back]);
        // The cursor is on the row that turned the page, whichever row of the menu that is.
        expect(snap(second).menu.cursor).toBe(3);
        const plain = open(told(later(0), language), 'hadron-1').app;
        expect(rowsOf(plain)).toEqual([B.accept, B.build, B.wingman, B.back]);
        // The first contract of all: nobody is for hire yet, nobody else is offering, and a pilot still in the
        // introductions is not shown a row for the build either.
        const bare = open(told(fresh(0), language), 'intro-1').app;
        expect(rowsOf(bare)).toEqual([B.accept, B.back]);
      } finally {
        setLanguage('en');
      }
    }
  });

  test('a wingman can be hired for the other side\'s fight where there is room for one, and their share comes off the other side\'s pay', () => {
    const kite = WINGMEN.find((w) => w.id === 'kite')!;
    const { app, store } = open(did(later(), 'hadron-1'), 'hadron-2');
    // Whoever was chosen on the first offer is not carried over: the page turns with nobody hired.
    select(app, 'wingman');
    expect(briefing(app)).toMatchObject({ turned: false, wingman: { id: 'kite' }, reward: feeAfter(mission('hadron-2').reward * 1.5, kite) });
    select(app, 'other');
    expect(briefing(app)).toMatchObject({ turned: true, wingman: { id: null, open: 1 }, reward: 1650 });
    select(app, 'wingman');
    expect(briefing(app)).toMatchObject({ turned: true, wingman: { id: 'kite' }, reward: feeAfter(1650, kite) });
    select(app, 'accept');
    expect(snap(app).battle).toMatchObject({ mission: 'hadron-2', index: 0, of: 1, enemies: ['heavy-mech', 'tank', 'gun-turret'] });
    // Held, not broken: a pilot who only fires does not last the five rounds. Auto Turn knows when to keep its guard up.
    autoBattle(app);
    press(app, 'confirm');
    expect(snap(app).settlement).toMatchObject({ won: true, reward: feeAfter(1650, kite) });
    expect(savedGame(store).choices).toMatchObject({ train: 'weigh' });
    expect(savedGame(store).completed).toContain('hadron-2');
  });

  test('each offer is read to its own client\'s song: turning the page changes it, and turning back changes it back', () => {
    const songs = (game: GameState, id: string): string[] => {
      const played: string[] = [];
      const { app } = inHub(game, undefined, { music: { enabled: true, play: (track) => { if (track && played.at(-1) !== track) played.push(track); } } });
      select(app, 'contracts');
      select(app, id);
      select(app, 'other');
      press(app, 'confirm');
      return played.slice(-3);
    };
    expect(songs(later(), 'hadron-1')).toEqual(['hadron', 'undertow', 'hadron']);
    expect(songs(did(later(), 'hadron-1'), 'hadron-2')).toEqual(['hadron', 'undertow', 'hadron']);
    expect(songs(later(), 'undertow-1')).toEqual(['undertow', 'lumen', 'undertow']);
    // The offers say whose they are; the contract stays the first client's in everything else.
    expect(offered.map((m) => [m.faction, m.other!.side])).toEqual([['hadron', 'undertow'], ['hadron', 'undertow'], ['undertow', 'lumen']]);
    expect(offer('undertow-1')).toMatchObject({ faction: 'undertow', turned: { side: 'lumen' } });
  });

  test('accepting it flies the other side\'s fight; winning it finishes the contract, is remembered, and brings what comes of it', () => {
    const { app, store } = open(later(), 'hadron-1');
    select(app, 'other');
    select(app, 'accept');
    expect(snap(app).battle).toMatchObject({ mission: 'hadron-1', index: 0, of: 2, enemies: ['gun-turret', 'recon-drone', 'recon-drone'] });
    finishMission(app);
    expect(snap(app).settlement).toMatchObject({ won: true, reward: 1350 });
    const saved = savedGame(store);
    expect(saved.completed).toContain('hadron-1');
    expect(saved.choices).toMatchObject({ seam: 'stand' });
    expect(saved.ranks['hadron-1']).toBeDefined();
    press(app, 'confirm');
    // What was under the seat is found, and Brenn has written; the contract is in the archive as it was first offered.
    expect(savedGame(store).codex).toContain('paper-order');
    expect(arrivedMessages(savedGame(store), MESSAGES, MISSIONS).map((m) => m.id)).toContain('brenn-seam');
    select(app, 'contracts');
    expect(snap(app).menu.items.map((item) => item.id)).toContain('hadron-2');
    expect(snap(app).menu.items.map((item) => item.id)).not.toContain('hadron-1');
    expect(app.archive().find((m) => m.id === 'hadron-1')).toMatchObject({ client: 'Director Brenn, Hadron Mining', replay: true });
    // The manual says so, where it speaks of the archive: the rank won on the other side's fight is the contract's.
    expect(MANUAL.find((topic) => topic.id === 'ranks')!.text).toMatch(/A contract won for the other side is kept there as it was first offered\.$/);
    expect(app.archive().find((m) => m.id === 'hadron-1')!.battles.map((b) => b.enemies)).toEqual(mission('hadron-1').battles.map((b) => b.enemies));
    expect(app.otherOffer(app.archive().find((m) => m.id === 'hadron-1')!)).toBeNull();
  });

  test('winning the first offer remembers nothing, and the other is then no longer made', () => {
    const { app, store } = open(later(), 'hadron-1');
    select(app, 'accept');
    expect(snap(app).battle).toMatchObject({ enemies: ['recon-drone', 'recon-drone', 'recon-drone'] });
    finishMission(app);
    expect(savedGame(store).completed).toContain('hadron-1');
    expect(savedGame(store).choices ?? {}).toEqual({});
    expect(app.otherOffer(mission('hadron-1'))).toBeNull();
  });

  test('walking away from it remembers nothing, and both offers still stand', () => {
    const { app, store } = open(later(), 'hadron-1');
    select(app, 'other');
    select(app, 'accept');
    retreat(app);
    expect(savedGame(store).completed).not.toContain('hadron-1');
    expect(savedGame(store).choices ?? {}).toEqual({});
    while (snap(app).screen !== 'hub') press(app, 'confirm');
    select(app, 'contracts');
    select(app, 'hadron-1');
    expect(briefing(app)).toMatchObject({ offers: 2, turned: false });
  });

  test('losing it remembers nothing either: the contract is not done, nothing was found, and both offers still stand', () => {
    const { app, store } = open(did(later(), 'hadron-1'), 'hadron-2');
    select(app, 'other');
    select(app, 'accept');
    // The guard of the weighbridge is not to be broken: a pilot who only fires is down before the five rounds are out.
    finishMission(app);
    expect(snap(app).settlement).toMatchObject({ won: false, reward: 0 });
    const saved = savedGame(store);
    expect(saved.completed).not.toContain('hadron-2');
    expect(saved.choices ?? {}).toEqual({});
    while (snap(app).screen !== 'hub') press(app, 'confirm');
    expect(savedGame(store).codex ?? []).not.toContain('paper-ticket');
    expect(arrivedMessages(savedGame(store), MESSAGES, MISSIONS).map((m) => m.id)).not.toContain('brenn-train');
    select(app, 'contracts');
    select(app, 'hadron-2');
    expect(briefing(app)).toMatchObject({ offers: 2, turned: false, client: 'Director Brenn, Hadron Mining' });
  });

  test('cannot be started for a contract that has none, or in a first telling, by asking for it', () => {
    const { app } = inHub(later(0));
    app.startMission('hadron-1', false, null, true);
    expect(snap(app).screen).toBe('hub');
    const second = inHub(later()).app;
    second.startMission('lumen-1', false, null, true);
    expect(snap(second).screen).toBe('hub');
    second.startMission('hadron-1', false, null, true);
    expect(snap(second).battle).toMatchObject({ mission: 'hadron-1', enemies: ['gun-turret', 'recon-drone', 'recon-drone'] });
  });
});
