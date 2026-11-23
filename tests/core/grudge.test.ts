import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { createBattle, type BattleEvent, type BattleState } from '../../src/core/battle';
import { ENEMY_COST, MECH_ENEMIES, POOL, SUPPORT_ENEMIES, boardTier, budgetFor, scaleFor, type BoardText } from '../../src/core/board';
import { startNewCycle, type Mission } from '../../src/core/campaign';
import { isValidState, newGame, type GameState } from '../../src/core/game';
import {
  GRUDGE, GRUDGE_MEETINGS, GRUDGE_NUMBERS, GRUDGE_TIER, GRUDGE_WAIT, NOTHING_FOUGHT, accountLine, accountsClosed, addDealt, bookGrudge, dealtBy, foughtIn,
  grudgeContract, grudgeDue, grudgeEnemy, grudgeOf, isGrudge, meetingsWon, stronger, witness,
  type Fought, type Grudge, type GrudgeOrigin, type GrudgeText, type Witness,
} from '../../src/core/grudge';
import { JOB_NUMBERS, MENDERS } from '../../src/core/jobs';
import { startMissionBattle } from '../../src/core/mission';
import { rangeId } from '../../src/core/range';
import { ALL_ENEMIES } from '../../src/content/arena';
import { BOARD_TEXT } from '../../src/content/board';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG, DEMO_BUILD, STARTER_BUILD } from '../../src/content/parts';

/**
 * The account: a pilot the player wrecked, drove off or lost to, who comes back three times as a
 * notice beside the board, in their own machine hardened against the weapon that hurt it most the
 * last time. Held here
 * with words of the test's own: what the game's words are is the content's business.
 */
const NAMES = ['Brakk', 'Tally', 'Docket', 'Lapse'];
const WORDS: GrudgeText['grudge'] = {
  names: NAMES,
  title: (name) => `Outstanding: ${name}`,
  first: {
    beat: (name, machine) => `beat ${name} ${machine}`, ran: (name, machine) => `ran ${name} ${machine}`, wrecked: (name, machine) => `wrecked ${name} ${machine}`,
  },
  again: [(name, machine) => `second ${name} ${machine}`, (name, machine) => `third ${name} ${machine}`],
  hardened: (weapon) => (weapon === null ? 'knows nothing' : `hardened ${weapon}`),
  opens: { first: { beat: 'opens beat', ran: 'opens ran', wrecked: 'opens wrecked' }, again: ['opens second', 'opens third'] },
  falls: ['falls first', 'falls second', 'falls third'],
  hurt: 'hurt',
  debrief: [(name) => `debrief 1 ${name}`, (name) => `debrief 2 ${name}`, (name) => `debrief 3 ${name}`],
};
const TEXT: BoardText & GrudgeText = { ...BOARD_TEXT, grudge: WORDS };
const CALLED = { machine: (kind: string) => ENEMIES[kind].name, weapon: (id: string) => CATALOG[id].name };
const MECHS = POOL.filter((id) => MECH_ENEMIES.includes(id));

/** A game far enough on for an account to begin, unless it is said otherwise. */
const game = (change: Partial<GameState> = {}): GameState => ({ ...newGame(CATALOG, STARTER_BUILD), battlesWon: 17, ...change });
const account = (change: Partial<Grudge> = {}): Grudge => ({ name: 'Brakk', kind: 'stalker', origin: 'wrecked', knows: 'wpn-rivet-rifle', met: 0, waited: 0, ...change });
/** The same with no weapon known. */
const blank = (change: Partial<Grudge> = {}): Grudge => { const { knows: _, ...rest } = account(change); return rest; };
const BOARD: Pick<Mission, 'id'> = { id: 'open-0-7-1' };
const NOTICE: Pick<Mission, 'id'> = { id: `open-0-7-${GRUDGE}` };
const NOTHING: Fought = NOTHING_FOUGHT;

/** A battle against these that has ended as `change` says. */
function ended(enemies: string[], change: (s: BattleState) => void): BattleState {
  const s = structuredClone(createBattle(DEMO_BUILD, enemies.map((id) => ENEMIES[id]), CATALOG, 1));
  s.outcome = 'victory';
  change(s);
  return s;
}
const fell = (s: BattleState, i: number): void => { s.units[i + 1].destroyed = true; s.events.push({ type: 'unitDestroyed', unit: `enemy-${i}` }); };
const left = (s: BattleState, i: number, fixed = false): void => {
  s.units[i + 1].destroyed = true;
  s.events.push({ type: 'rout', unit: `enemy-${i}`, ...(fixed ? { fixed: true as const } : {}) });
};
const lost = (s: BattleState): void => { s.outcome = 'defeat'; s.units[0].destroyed = true; };
const shot = (weapon: 'rightHand' | 'leftHand' | 'shoulder', target: string, damage: number, hit = true): BattleEvent =>
  ({ type: 'shot', unit: 'player', weapon, target, part: 'core', appliedTo: 'core', hit, damage });

describe('who an account can begin with: what a finished battle saw', () => {
  test('a mech of the board standing when the pilot fell, or walked away: it beat them', () => {
    expect(witness(ended(['heavy-mech', 'tank'], lost))).toEqual({ kind: 'heavy-mech', origin: 'beat' });
    expect(witness(ended(['stalker', 'recon-drone'], (s) => { s.outcome = 'defeat'; s.retreated = true; }))).toEqual({ kind: 'stalker', origin: 'beat' });
  });

  test('one that broke off under its own power: it ran. One that shut down where it stood went nowhere', () => {
    expect(witness(ended(['stalker', 'tank', 'recon-drone'], (s) => { fell(s, 1); fell(s, 2); left(s, 0); }))).toEqual({ kind: 'stalker', origin: 'ran' });
    expect(witness(ended(['stalker', 'tank', 'recon-drone'], (s) => { fell(s, 1); fell(s, 2); left(s, 0, true); }))).toBeNull();
  });

  test('one the pilot destroyed: its pilot walked out of the wreck', () => {
    expect(witness(ended(['light-mech', 'gun-turret'], (s) => { fell(s, 0); fell(s, 1); }))).toEqual({ kind: 'light-mech', origin: 'wrecked' });
  });

  test('nothing else is anybody: a drone, a tank, a tower, a machine that belongs to the story', () => {
    expect(witness(ended(['tank', 'gun-turret', 'recon-drone'], (s) => { fell(s, 0); fell(s, 1); fell(s, 2); }))).toBeNull();
    expect(witness(ended(['tank', 'gunship'], lost))).toBeNull();
    for (const story of ['rival', 'sable', 'kiln', 'magpie']) {
      expect(MECH_ENEMIES).toContain(story);
      expect(witness(ended([story], (s) => fell(s, 0))), story).toBeNull();
      expect(witness(ended([story], lost)), story).toBeNull();
    }
  });

  test('of two it is the dearer, and the first where they cost the same', () => {
    expect(ENEMY_COST.juggernaut).toBeGreaterThan(ENEMY_COST['light-mech']);
    expect(witness(ended(['light-mech', 'juggernaut'], (s) => { fell(s, 0); fell(s, 1); }))).toEqual({ kind: 'juggernaut', origin: 'wrecked' });
    expect(ENEMY_COST.stalker).toBe(ENEMY_COST['heavy-mech']);
    expect(witness(ended(['stalker', 'heavy-mech'], (s) => { fell(s, 0); fell(s, 1); }))).toEqual({ kind: 'stalker', origin: 'wrecked' });
    expect(witness(ended(['heavy-mech', 'stalker'], lost))).toEqual({ kind: 'heavy-mech', origin: 'beat' });
  });

  test('the reason that counts most is the one that is kept: beaten by it, then that it ran, then that it was wrecked', () => {
    // A cheaper machine that ran is kept before a dearer one that was wrecked.
    expect(witness(ended(['juggernaut', 'light-mech'], (s) => { fell(s, 0); left(s, 1); }))).toEqual({ kind: 'light-mech', origin: 'ran' });
    // Lost with one standing and one wrecked: the one standing.
    expect(witness(ended(['juggernaut', 'light-mech'], (s) => { fell(s, 0); lost(s); }))).toEqual({ kind: 'light-mech', origin: 'beat' });
    // Lost with no mech standing: whoever walked out of a wreck before that.
    expect(witness(ended(['light-mech', 'tank'], (s) => { fell(s, 0); lost(s); }))).toEqual({ kind: 'light-mech', origin: 'wrecked' });
  });

  test('over the battles of a contract: `stronger` keeps the better of two', () => {
    const beat: Witness = { kind: 'light-mech', origin: 'beat' };
    const ran: Witness = { kind: 'stalker', origin: 'ran' };
    const wrecked: Witness = { kind: 'juggernaut', origin: 'wrecked' };
    expect(stronger(null, null)).toBeNull();
    expect(stronger(null, ran)).toBe(ran);
    expect(stronger(ran, null)).toBe(ran);
    expect(stronger(wrecked, ran)).toBe(ran);
    expect(stronger(ran, wrecked)).toBe(ran);
    expect(stronger(ran, beat)).toBe(beat);
    expect(stronger(beat, wrecked)).toBe(beat);
    const light: Witness = { kind: 'light-mech', origin: 'wrecked' };
    expect(stronger(light, wrecked)).toBe(wrecked);
    expect(stronger(wrecked, light)).toBe(wrecked);
    // Alike in both: the one that was there first.
    const first: Witness = { kind: 'stalker', origin: 'wrecked' };
    const second: Witness = { kind: 'heavy-mech', origin: 'wrecked' };
    expect(stronger(first, second)).toBe(first);
  });
});

describe('what the pilot\'s weapons did', () => {
  const s = ended(['stalker', 'tank'], (state) => {
    state.events.push(
      shot('rightHand', 'enemy-0', 30), shot('rightHand', 'enemy-1', 12), shot('leftHand', 'enemy-0', 25), shot('leftHand', 'enemy-0', 25),
      shot('shoulder', 'enemy-1', 0, false),
      // A shot of the other side is nobody's weapon here.
      { type: 'shot', unit: 'enemy-0', weapon: 'rightHand', target: 'player', part: 'core', appliedTo: 'core', hit: true, damage: 99 },
    );
  });

  test('`dealtBy`: the armour each took off the other side, by the weapon\'s id; a miss took none', () => {
    expect(dealtBy(s)).toEqual({ [DEMO_BUILD.rightHand!]: 42, [DEMO_BUILD.leftHand!]: 50 });
  });

  test('and off one machine alone', () => {
    expect(dealtBy(s, 'enemy-0')).toEqual({ [DEMO_BUILD.rightHand!]: 30, [DEMO_BUILD.leftHand!]: 50 });
    expect(dealtBy(s, 'enemy-1')).toEqual({ [DEMO_BUILD.rightHand!]: 12 });
  });

  test('`addDealt` adds two battles up', () => {
    expect(addDealt({ a: 3, b: 4 }, { b: 6, c: 1 })).toEqual({ a: 3, b: 10, c: 1 });
    expect(addDealt({}, {})).toEqual({});
  });
});

describe('what a contract\'s battles come to, one battle after another', () => {
  const first = ended(['stalker', 'tank'], (state) => {
    state.events.push(shot('rightHand', 'enemy-0', 30), shot('leftHand', 'enemy-1', 70));
    fell(state, 0);
  });
  const second = ended(['light-mech', 'tank'], (state) => {
    state.events.push(shot('rightHand', 'enemy-0', 5), shot('shoulder', 'enemy-1', 40));
    left(state, 0);
  });

  test('nothing, before any is fought', () => {
    expect(NOTHING_FOUGHT).toEqual({ seen: null, dealt: {}, named: {} });
  });

  test('who was seen is the better of what each battle saw, and what the weapons did is added up', () => {
    const after = foughtIn(foughtIn(NOTHING_FOUGHT, first, false), second, false);
    // The one that ran in the second battle before the dearer one wrecked in the first.
    expect(after.seen).toEqual({ kind: 'light-mech', origin: 'ran' });
    expect(after.dealt).toEqual({ [DEMO_BUILD.rightHand!]: 35, [DEMO_BUILD.leftHand!]: 70, [DEMO_BUILD.shoulder!]: 40 });
    expect(after.named).toEqual({});
    // The battles are read in the order they were fought, and what was given is not written to.
    expect(foughtIn(NOTHING_FOUGHT, first, false).seen).toEqual({ kind: 'stalker', origin: 'wrecked' });
    expect(NOTHING_FOUGHT).toEqual({ seen: null, dealt: {}, named: {} });
  });

  test('who was seen is the stronger of the two whichever battle saw them, and of two alike the one of the earlier battle', () => {
    const wreck = (kind: string): BattleState => ended([kind], (state) => fell(state, 0));
    const ran = ended(['light-mech'], (state) => left(state, 0));
    const after = (...battles: BattleState[]): Witness | null => battles.reduce((fought, battle) => foughtIn(fought, battle, false), NOTHING_FOUGHT).seen;
    // One that ran in the first battle is kept, though a dearer one was wrecked in the second.
    expect(after(ran, wreck('juggernaut'))).toEqual({ kind: 'light-mech', origin: 'ran' });
    expect(after(wreck('juggernaut'), ran)).toEqual({ kind: 'light-mech', origin: 'ran' });
    // Of two that were wrecked the dearer, though it fell first.
    expect(after(wreck('juggernaut'), wreck('light-mech'))).toEqual({ kind: 'juggernaut', origin: 'wrecked' });
    expect(after(wreck('light-mech'), wreck('juggernaut'))).toEqual({ kind: 'juggernaut', origin: 'wrecked' });
    // Two that cost the same and ended the same way: the earlier battle's.
    expect(ENEMY_COST.stalker).toBe(ENEMY_COST['heavy-mech']);
    expect(after(wreck('stalker'), wreck('heavy-mech'))).toEqual({ kind: 'stalker', origin: 'wrecked' });
    expect(after(wreck('heavy-mech'), wreck('stalker'))).toEqual({ kind: 'heavy-mech', origin: 'wrecked' });
    // And a battle that saw nobody leaves who was seen as they were.
    expect(after(ran, ended(['tank'], (state) => fell(state, 0)))).toEqual({ kind: 'light-mech', origin: 'ran' });
  });

  test('in a meeting, what was done to the machine that stands first is kept apart: the machines beside it are not it', () => {
    const met = foughtIn(NOTHING_FOUGHT, first, true);
    expect(met.named).toEqual({ [DEMO_BUILD.rightHand!]: 30 });
    expect(met.dealt).toEqual({ [DEMO_BUILD.rightHand!]: 30, [DEMO_BUILD.leftHand!]: 70 });
    expect(foughtIn(met, second, true).named).toEqual({ [DEMO_BUILD.rightHand!]: 35 });
    // In any other battle nothing is kept apart, whatever stood first.
    expect(foughtIn(met, second, false).named).toEqual({ [DEMO_BUILD.rightHand!]: 30 });
  });
});

describe('how an account begins', () => {
  const seen: Witness = { kind: 'stalker', origin: 'wrecked' };
  const fought: Fought = { seen, dealt: { 'wpn-rivet-rifle': 40, 'wpn-arc-pistol': 90 }, named: {} };

  test('with nobody\'s open: the machine, how it began, a callsign, and the weapon that took most armour off them', () => {
    const next = bookGrudge(game(), BOARD, true, fought, NAMES);
    const begun = grudgeOf(next)!;
    expect(begun).toEqual({ name: begun.name, kind: 'stalker', origin: 'wrecked', knows: 'wpn-arc-pistol', met: 0, waited: 0 });
    expect(NAMES).toContain(begun.name);
    expect(accountsClosed(next)).toBe(0);
  });

  test('the same game begins the same account; the callsign goes by the pilot\'s progress', () => {
    const name = (battlesWon: number): string => grudgeOf(bookGrudge(game({ battlesWon }), BOARD, true, fought, NAMES))!.name;
    expect(name(17)).toBe(name(17));
    expect(new Set(Array.from({ length: 40 }, (_, i) => name(15 + i))).size).toBe(NAMES.length);
  });

  test('a pilot who hit nothing taught them nothing', () => {
    const begun = grudgeOf(bookGrudge(game(), BOARD, false, { seen: { kind: 'stalker', origin: 'beat' }, dealt: {}, named: {} }, NAMES))!;
    expect(begun.knows).toBeUndefined();
    expect('knows' in begun).toBe(false);
  });

  test('a contract lost begins one as a contract won does', () => {
    expect(grudgeOf(bookGrudge(game(), BOARD, false, { ...fought, seen: { kind: 'heavy-mech', origin: 'beat' } }, NAMES))).toMatchObject({ kind: 'heavy-mech', origin: 'beat', met: 0, waited: 0 });
  });

  test('nothing begins where nothing was seen, where one is open already, or in a fight that counts for nothing', () => {
    const fresh = game();
    expect(bookGrudge(fresh, BOARD, true, NOTHING, NAMES)).toBe(fresh);
    const open = game({ grudge: account() });
    expect(grudgeOf(bookGrudge(open, BOARD, false, { ...fought, seen: { kind: 'juggernaut', origin: 'beat' } }, NAMES))).toEqual(account());
    for (const mission of [{ id: rangeId('stalker', 1) }, { id: 'drill-basics' }, { id: 'gauntlet-3' }, { id: 'open-0-7-1', loaner: DEMO_BUILD }]) {
      expect(bookGrudge(fresh, mission, true, fought, NAMES), mission.id).toBe(fresh);
    }
  });

  test('nor with anything that is not a mech of the board, whatever is said to have been seen', () => {
    const fresh = game();
    for (const kind of [...SUPPORT_ENEMIES, 'tank', 'adjuster', 'rival', 'no-such-machine']) {
      expect(MECHS, kind).not.toContain(kind);
      for (const origin of ['beat', 'ran', 'wrecked'] as const) expect(bookGrudge(fresh, BOARD, true, { ...fought, seen: { kind, origin } }, NAMES), kind).toBe(fresh);
    }
  });

  test('none begins below the board\'s third tier: a pilot that new has one build and little to change it for', () => {
    expect(GRUDGE_TIER).toBe(3);
    for (let battlesWon = 0; battlesWon < 15; battlesWon++) {
      expect(boardTier(battlesWon, 0)).toBeLessThan(GRUDGE_TIER);
      const early = game({ battlesWon });
      expect(bookGrudge(early, BOARD, true, fought, NAMES), `${battlesWon} won`).toBe(early);
    }
    expect(grudgeOf(bookGrudge(game({ battlesWon: 15 }), BOARD, true, fought, NAMES))).not.toBeNull();
    // A later telling is past that tier after its first few contracts.
    expect(boardTier(5, 1)).toBe(GRUDGE_TIER);
    expect(grudgeOf(bookGrudge(game({ battlesWon: 5, cycle: 1 }), BOARD, true, fought, NAMES))).not.toBeNull();
    // One that is open is waited through and met whatever the tier.
    expect(grudgeOf(bookGrudge(game({ battlesWon: 3, grudge: account() }), BOARD, true, NOTHING, NAMES))!.waited).toBe(1);
  });

  test('a callsign that has been closed is not given again while another is left; with none left they come round again', () => {
    for (let battlesWon = 15; battlesWon < 45; battlesWon++) {
      const next = bookGrudge(game({ battlesWon, accounts: ['Brakk', 'Tally', 'Lapse'] }), BOARD, true, fought, NAMES);
      expect(grudgeOf(next)!.name).toBe('Docket');
    }
    expect(NAMES).toContain(grudgeOf(bookGrudge(game({ accounts: [...NAMES] }), BOARD, true, fought, NAMES))!.name);
  });
});

describe('when they come back', () => {
  test('the figures: three meetings, after three contracts won and then two and two', () => {
    expect(GRUDGE_MEETINGS).toBe(3);
    expect([...GRUDGE_WAIT]).toEqual([3, 2, 2]);
    // As they were set by measurement (scripts/grudge.ts; the figures are in the plan of the round).
    expect(GRUDGE_NUMBERS).toEqual({ plating: [0, 0.1, 0.15], pay: [1, 1.25, 1.5], par: 7 });
  });

  test('every other contract won is one waited through; one lost is not', () => {
    const open = game({ grudge: account() });
    const once = bookGrudge(open, BOARD, true, NOTHING, NAMES);
    expect(grudgeOf(once)).toEqual(account({ waited: 1 }));
    expect(bookGrudge(once, BOARD, false, NOTHING, NAMES)).toBe(once);
    // Whatever it was that was won: a fight that begins no account is still a contract won.
    expect(grudgeOf(bookGrudge(once, { id: 'arena-3' }, true, NOTHING, NAMES))).toEqual(account({ waited: 2 }));
  });

  test('due after as many as the meeting asks, and not before', () => {
    for (const [met, at] of [[0, 3], [1, 2], [2, 2]]) {
      expect(grudgeDue(game({ grudge: account({ met, waited: at - 1 }) })), `meeting ${met + 1}`).toBe(false);
      expect(grudgeDue(game({ grudge: account({ met, waited: at }) })), `meeting ${met + 1}`).toBe(true);
      expect(grudgeDue(game({ grudge: account({ met, waited: at + 5 }) })), `meeting ${met + 1}`).toBe(true);
    }
    expect(grudgeDue(game())).toBe(false);
  });

  test('there is no notice before it is due, or for a pilot with no account', () => {
    expect(grudgeContract(game(), TEXT, CALLED)).toBeNull();
    expect(grudgeContract(game({ grudge: account({ waited: 2 }) }), TEXT, CALLED)).toBeNull();
    expect(grudgeContract(game({ grudge: account({ waited: 3 }) }), TEXT, CALLED)).not.toBeNull();
  });
});

describe('the notice', () => {
  const due = (change: Partial<Grudge> = {}, battlesWon = 12, cycle = 0): GameState => game({ battlesWon, cycle, grudge: account({ waited: 3, ...change }) });
  const notice = (state: GameState): Mission => grudgeContract(state, TEXT, CALLED)!;

  test('is an open contract with an id of its own, and says which meeting it is', () => {
    const made = notice(due());
    expect(made.id).toBe(`open-0-12-${GRUDGE}`);
    expect(isGrudge(made)).toBe(true);
    expect(isGrudge({ id: 'open-0-12-2' })).toBe(false);
    expect(isGrudge({ id: 'open-0-12-job' })).toBe(false);
    expect(isGrudge({ id: `story-${GRUDGE}` })).toBe(false);
    expect(made.grudge).toBe(1);
    expect(notice(due({ met: 2 })).grudge).toBe(3);
    expect(made.title).toBe('Outstanding: Brakk');
    // Their machine goes by their callsign wherever the contract's machines are named.
    expect(made.names).toEqual({ [GRUDGE]: 'Brakk' });
    expect(made.client).toBe('Dispatch');
    expect(made.portrait).toBe(BOARD_TEXT.faces!.Dispatch);
    expect(made.phase).toBe('patrol');
  });

  test('is the same for the same game, and made again with every contract won', () => {
    expect(notice(due())).toEqual(notice(due()));
    const places = new Set(Array.from({ length: 30 }, (_, i) => notice(due({}, 10 + i)).battles[0].background));
    expect(places.size).toBeGreaterThan(1);
    expect(notice(due({}, 12, 1)).id).toBe(`open-1-12-${GRUDGE}`);
  });

  test('each meeting rolls dice of its own: at one and the same progress the three are not the same fight in the same place', () => {
    const fight = (battlesWon: number, met: number): string => {
      const { background, enemies } = notice(due({ met, waited: 9 }, battlesWon)).battles[0];
      return `${background} ${enemies.join(' ')}`;
    };
    // (So that what is measured of a third meeting is not measured over again on the fights of the first.)
    const progresses = Array.from({ length: 30 }, (_, i) => 15 + i);
    expect(progresses.filter((won) => fight(won, 0) !== fight(won, 1)).length).toBeGreaterThan(20);
    expect(progresses.filter((won) => fight(won, 1) !== fight(won, 2)).length).toBeGreaterThan(20);
    expect(progresses.filter((won) => fight(won, 0) !== fight(won, 2)).length).toBeGreaterThan(20);
  });

  test('one battle about one machine: theirs first, named by the objective, with the company the budget leaves', () => {
    for (let battlesWon = 5; battlesWon < 45; battlesWon++) {
      for (const kind of MECHS) {
        const made = notice(due({ kind }, battlesWon));
        expect(made.battles).toHaveLength(1);
        const [battle] = made.battles;
        expect(battle.enemies[0]).toBe(GRUDGE);
        expect(battle.objective).toEqual({ type: 'leader', target: 0 });
        expect(TEXT.backgrounds).toContain(battle.background);
        const company = battle.enemies.slice(1);
        expect(company.length).toBeLessThanOrEqual(2);
        const room = budgetFor(boardTier(battlesWon, 0)) - ENEMY_COST[kind];
        expect(company.reduce((sum, id) => sum + ENEMY_COST[id], 0), `${kind} at ${battlesWon}`).toBeLessThanOrEqual(Math.max(0, room));
        for (const id of company) {
          expect(POOL).toContain(id);
          expect(MECH_ENEMIES).not.toContain(id);
          expect(MENDERS).not.toContain(id);
        }
        expect(company.filter((id) => SUPPORT_ENEMIES.includes(id)).length).toBeLessThanOrEqual(1);
      }
    }
    // Where the budget leaves something there is company, and where it leaves nothing they came alone.
    expect(notice(due({ kind: 'light-mech' }, 40)).battles[0].enemies.length).toBeGreaterThan(1);
    expect(notice(due({ kind: 'juggernaut' }, 20)).battles[0].enemies).toEqual([GRUDGE]);
  });

  test('scale and fee: the board\'s own scale for the tier, and a hit\'s fee for the machine times the meeting\'s factor', () => {
    for (const met of [0, 1, 2]) {
      for (const kind of ['light-mech', 'bulldozer']) {
        const made = notice(due({ met, kind }, 30));
        expect(made.scale).toBe(scaleFor(boardTier(30, 0)));
        const hit = JOB_NUMBERS.hitPay * ENEMY_COST[kind] + 200;
        expect(made.reward).toBe(Math.round((hit * GRUDGE_NUMBERS.pay[met]) / 50) * 50);
        expect(made.battles[0].par).toBe(GRUDGE_NUMBERS.par);
      }
    }
  });

  test('the briefing: the place, who this is (by how it began, the first time; by the meeting after that), and what the machine is hardened against', () => {
    const stalker = ENEMIES.stalker.name;
    for (const origin of ['beat', 'ran', 'wrecked'] as const) {
      const made = notice(due({ origin }));
      expect(made.briefing).toHaveLength(3);
      expect(TEXT.places).toContain(made.briefing[0]);
      expect(made.briefing[1]).toBe(`${origin} Brakk ${stalker}`);
    }
    expect(notice(due({ met: 1, origin: 'ran' })).briefing[1]).toBe(`second Brakk ${stalker}`);
    expect(notice(due({ met: 2, origin: 'ran' })).briefing[1]).toBe(`third Brakk ${stalker}`);
    expect(notice(due()).briefing[2]).toBe(`hardened ${CATALOG['wpn-rivet-rifle'].name}`);
    expect(notice(due({ knows: 'wpn-arc-pistol' })).briefing[2]).toBe(`hardened ${CATALOG['wpn-arc-pistol'].name}`);
    expect(notice(game({ grudge: blank({ waited: 3 }) })).briefing[2]).toBe('knows nothing');
    expect(notice(due()).debrief).toBe('debrief 1 Brakk');
    expect(notice(due({ met: 2 })).debrief).toBe('debrief 3 Brakk');
  });

  test('what is said over it: the pilot as it opens and as their machine falls, Dispatch when the player is hurt', () => {
    const talk = (change: Partial<Grudge>) => notice(due(change)).battles[0].talk!.map((line) => [line.at, line.who, line.text, line.portrait]);
    expect(talk({ origin: 'ran' })).toEqual([['start', 'Brakk', 'opens ran', undefined], ['hurt', 'Dispatch', 'hurt', BOARD_TEXT.faces!.Dispatch], ['win', 'Brakk', 'falls first', undefined]]);
    expect(talk({ origin: 'beat' })[0][2]).toBe('opens beat');
    expect(talk({ met: 1, origin: 'ran' }).map((line) => line[2])).toEqual(['opens second', 'hurt', 'falls second']);
    expect(talk({ met: 2, origin: 'beat' }).map((line) => line[2])).toEqual(['opens third', 'hurt', 'falls third']);
  });

  test('its machine: the kind\'s own, under their callsign, hardened against the weapon they know', () => {
    const state = due({ knows: 'wpn-arc-pistol' });
    const def = grudgeEnemy(state, ALL_ENEMIES)!;
    expect(def).toEqual({ ...ENEMIES.stalker, name: 'Brakk', hardened: ['wpn-arc-pistol'] });
    expect(grudgeEnemy(game({ grudge: blank() }), ALL_ENEMIES)).toEqual({ ...ENEMIES.stalker, name: 'Brakk' });
    // Rebuilt thicker for the second meeting and thicker again for the third: thicker, and no stronger.
    expect(ENEMIES.stalker.plating).toBeUndefined();
    expect(grudgeEnemy(due({ met: 1 }), ALL_ENEMIES)!.plating).toBe(GRUDGE_NUMBERS.plating[1]);
    expect(grudgeEnemy(due({ met: 2 }), ALL_ENEMIES)!.plating).toBe(GRUDGE_NUMBERS.plating[2]);
    expect(GRUDGE_NUMBERS.plating[2]).toBeGreaterThan(GRUDGE_NUMBERS.plating[1]);
    // On top of what the kind comes with, where it comes with any; and by the numbers it is given.
    const plated = { ...ALL_ENEMIES, stalker: { ...ENEMIES.stalker, plating: 0.5 } };
    expect(grudgeEnemy(due({ met: 1 }), plated)!.plating).toBeCloseTo(0.5 + GRUDGE_NUMBERS.plating[1], 10);
    expect(grudgeEnemy(due({ met: 2 }), ALL_ENEMIES, { ...GRUDGE_NUMBERS, plating: [0, 0.4, 0.9] })!.plating).toBe(0.9);
    expect(grudgeEnemy(game(), ALL_ENEMIES)).toBeNull();
    // There before it is due as well: whatever asks for it finds it.
    expect(grudgeEnemy(game({ grudge: account() }), ALL_ENEMIES)).not.toBeNull();
    // And none where the machines that can be fielded do not have theirs among them.
    expect(grudgeEnemy(game({ grudge: account() }), {})).toBeNull();
    expect(grudgeEnemy(game({ grudge: account() }), { 'heavy-mech': ENEMIES['heavy-mech'] })).toBeNull();
  });

  test('is fought as a fight about one machine, to an end, by the game\'s own pilot', () => {
    const state = due({ knows: DEMO_BUILD.rightHand! }, 16);
    const made = notice(state);
    const enemies = { ...ALL_ENEMIES, [GRUDGE]: grudgeEnemy(state, ALL_ENEMIES)! };
    const battle = startMissionBattle(DEMO_BUILD, made, 0, enemies, CATALOG, 5, undefined, { enemyScale: made.scale });
    expect(battle.open).toBe(false);
    expect(battle.units[1]).toMatchObject({ name: 'Brakk', kind: 'stalker', hardened: [DEMO_BUILD.rightHand] });
    for (const other of battle.units.slice(2)) expect(other.hardened).toBeUndefined();
    const done = runBattle(battle, CATALOG, chooseAutoPlayerAction);
    expect(done.outcome).not.toBe('ongoing');
    // Over when their machine falls, whatever else stands.
    if (done.outcome === 'victory') expect(done.units[1].destroyed).toBe(true);
  });
});

describe('a meeting won', () => {
  const at = (change: Partial<Grudge> = {}, battlesWon = 30): GameState => game({ battlesWon, grudge: account({ waited: 3, ...change }) });
  const named = { 'wpn-arc-pistol': 80, 'wpn-rivet-rifle': 120, 'wpn-mortar-pod': 10 };
  const won = (state: GameState, dealt: Record<string, number> = named): GameState => bookGrudge(state, NOTICE, true, { seen: null, dealt, named: dealt }, NAMES);

  test('is one more met and the waiting begun again, in the same machine under the same callsign', () => {
    for (const kind of MECHS) {
      expect(grudgeOf(won(at({ kind, origin: 'ran' }))), kind).toMatchObject({ name: 'Brakk', kind, origin: 'ran', met: 1, waited: 0 });
    }
    expect(grudgeOf(won(at({ met: 1, waited: 2 })))).toMatchObject({ met: 2, waited: 0 });
  });

  test('what they know now is the weapon that did most to their machine this time: that one and no other', () => {
    expect(grudgeOf(won(at({ knows: 'wpn-arc-pistol' })))!.knows).toBe('wpn-rivet-rifle');
    // The one they knew already, where it still did most.
    expect(grudgeOf(won(at({ knows: 'wpn-rivet-rifle' })))!.knows).toBe('wpn-rivet-rifle');
    // With nothing known before, the one that did most; the first of two that did the same.
    expect(grudgeOf(won(game({ battlesWon: 30, grudge: blank({ waited: 3 }) })))!.knows).toBe('wpn-rivet-rifle');
    expect(grudgeOf(won(at(), { 'wpn-arc-pistol': 50, 'wpn-rivet-rifle': 50 }))!.knows).toBe('wpn-arc-pistol');
    // What was done to the machines beside it teaches them nothing.
    expect(grudgeOf(bookGrudge(at({ knows: 'wpn-arc-pistol' }), NOTICE, true, { seen: null, dealt: { 'wpn-mortar-pod': 900 }, named }, NAMES))!.knows).toBe('wpn-rivet-rifle');
  });

  test('a machine that fell to nothing the pilot fired knows what it knew', () => {
    expect(grudgeOf(won(at({ knows: 'wpn-arc-pistol' }), {}))!.knows).toBe('wpn-arc-pistol');
    expect(grudgeOf(won(at({ knows: 'wpn-arc-pistol' }), { 'wpn-rivet-rifle': 0 }))!.knows).toBe('wpn-arc-pistol');
    expect('knows' in grudgeOf(won(game({ battlesWon: 30, grudge: blank({ waited: 3 }) }), {}))!).toBe(false);
  });

  test('the third closes the account: it is gone, and the callsign is written down', () => {
    const closed = won(game({ battlesWon: 30, accounts: ['Tally'], grudge: account({ met: 2, waited: 2 }) }));
    expect(grudgeOf(closed)).toBeNull();
    expect('grudge' in closed).toBe(false);
    expect(closed.accounts).toEqual(['Tally', 'Brakk']);
    expect(accountsClosed(closed)).toBe(2);
    // And the first two write nothing down.
    expect(won(at()).accounts).toBeUndefined();
  });

  test('a meeting lost changes nothing: the notice stays as it was', () => {
    const state = at();
    expect(bookGrudge(state, NOTICE, false, { seen: { kind: 'stalker', origin: 'beat' }, dealt: named, named }, NAMES)).toBe(state);
  });

  test('what the bill of a meeting says: whose, which of the three, and whether it closed the account', () => {
    expect(accountLine(at(), NOTICE)).toEqual({ name: 'Brakk', meeting: 1, closed: false });
    expect(accountLine(at({ met: 1 }), NOTICE)).toEqual({ name: 'Brakk', meeting: 2, closed: false });
    expect(accountLine(at({ met: 2 }), NOTICE)).toEqual({ name: 'Brakk', meeting: 3, closed: true });
    expect(accountLine(at(), BOARD)).toBeNull();
    expect(accountLine(game(), NOTICE)).toBeNull();
  });
});

describe('what a saved game may hold', () => {
  const kept = (grudge: unknown, accounts?: unknown): unknown => ({ ...game(), grudge, ...(accounts === undefined ? {} : { accounts }) });

  test('a game from before has neither, and is a game', () => {
    const before = game();
    expect('grudge' in before).toBe(false);
    expect('accounts' in before).toBe(false);
    expect(isValidState(before, CATALOG)).toBe(true);
    expect(grudgeOf(before)).toBeNull();
    expect(accountsClosed(before)).toBe(0);
  });

  test('an account as the game writes one, and the callsigns closed, are kept', () => {
    expect(isValidState(kept(account(), ['Tally', 'Docket']), CATALOG)).toBe(true);
    expect(isValidState(kept(blank({ met: 2, waited: 40 })), CATALOG)).toBe(true);
  });

  test('a pilot who tells the story again takes both along: the account that is open, as it stands, and the callsigns closed', () => {
    const told = game({ completed: MISSIONS.map((mission) => mission.id), endingSeen: true, grudge: account({ met: 1, waited: 1 }), accounts: ['Tally', 'Docket'] });
    const again = startNewCycle(told, MISSIONS);
    expect(again.cycle).toBe(told.cycle + 1);
    expect(grudgeOf(again)).toEqual(account({ met: 1, waited: 1 }));
    expect(again.accounts).toEqual(['Tally', 'Docket']);
    expect(meetingsWon(again)).toBe(meetingsWon(told));
    expect(isValidState(again, CATALOG)).toBe(true);
  });

  test('one that is not the shape of an account is not a saved game', () => {
    const bad: unknown[] = [
      'Brakk', 7, null, [], { ...account(), name: 7 }, { ...account(), name: '' }, { ...account(), name: 'x'.repeat(40) }, { ...account(), kind: 7 },
      { ...account(), origin: 7 }, { ...account(), origin: 'Not A Word' }, { ...account(), knows: 7 }, { ...account(), knows: ['wpn-rivet-rifle'] }, { ...account(), knows: 'Not An Id' }, { ...account(), knows: '' },
      { ...account(), met: 3 }, { ...account(), met: -1 }, { ...account(), met: 0.5 }, { ...account(), waited: -1 }, { ...account(), waited: 'soon' },
    ];
    for (const grudge of bad) expect(isValidState(kept(grudge), CATALOG), JSON.stringify(grudge)).toBe(false);
    for (const accounts of ['Brakk', [7], [''], Array.from({ length: 2000 }, () => 'Brakk')]) expect(isValidState(kept(account(), accounts), CATALOG), JSON.stringify(accounts).slice(0, 40)).toBe(false);
  });

  test('one met as often as an account is met is closed, however it came to be kept: nothing reads it as open', () => {
    const over = game({ grudge: account({ met: GRUDGE_MEETINGS, waited: 9 }), accounts: ['Tally'] });
    expect(isValidState(over, CATALOG)).toBe(false);
    expect(grudgeOf(over)).toBeNull();
    expect(grudgeDue(over)).toBe(false);
    expect(grudgeContract(over, TEXT, CALLED)).toBeNull();
    expect(grudgeEnemy(over, ALL_ENEMIES)).toBeNull();
    expect(accountLine(over, NOTICE)).toBeNull();
    // Only the account that was closed is counted: three meetings, and none of this one's.
    expect(meetingsWon(over)).toBe(GRUDGE_MEETINGS);
    expect(meetingsWon(game({ grudge: account({ met: 2 }), accounts: ['Tally'] }))).toBe(GRUDGE_MEETINGS + 2);
  });

  test('one of the right shape about a machine no account is about reads as none: there is no notice, and one may begin', () => {
    for (const kind of ['rival', 'recon-drone', 'gun-turret', 'no-such-machine']) {
      const odd = game({ grudge: account({ kind, waited: 9 }) });
      expect(isValidState(odd, CATALOG), kind).toBe(true);
      expect(grudgeOf(odd), kind).toBeNull();
      expect(grudgeDue(odd), kind).toBe(false);
      expect(grudgeContract(odd, TEXT, CALLED), kind).toBeNull();
      expect(grudgeEnemy(odd, ALL_ENEMIES), kind).toBeNull();
      const begun = bookGrudge(odd, BOARD, true, { seen: { kind: 'stalker', origin: 'ran' }, dealt: {}, named: {} }, NAMES);
      expect(grudgeOf(begun), kind).toMatchObject({ kind: 'stalker', origin: 'ran', met: 0, waited: 0 });
    }
    // And one that began in a way this game does not know of.
    const odd = game({ grudge: { ...account({ waited: 9 }), origin: 'met' as GrudgeOrigin } });
    expect(isValidState(odd, CATALOG)).toBe(true);
    expect(grudgeOf(odd)).toBeNull();
    expect(grudgeContract(odd, TEXT, CALLED)).toBeNull();
  });
});
