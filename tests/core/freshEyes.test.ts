import {
  CUPS, MIRROR_ID, MIRROR_PURSE, arenaMission, arenaPurse, cupMission, cupPurse, mirrorMission, mirrorPurse, recordCupWin, recordMirrorWin, recordRematch,
  rematchPurse, rematchesWon,
} from '../../src/core/arena';
import { ARCHETYPES, adviceFor, archetypeOf, canFollow, followAdvice, keptAt, sameBuild } from '../../src/core/archetype';
import { validatePlayerBuild } from '../../src/core/build';
import {
  arrivedMessages, isUnread, markRead, markSceneSeen, noteArrivals, readBefore, skippable, startNewCycle, toldBefore, unreadMessages, type Message, type Scene,
} from '../../src/core/campaign';
import { heldAlready } from '../../src/core/codex';
import { applySettlement, type Settlement } from '../../src/core/economy';
import { BUILD_SLOTS, LOADOUT_SLOTS, buy, isValidState, loadoutsNeeding, newGame, ownedCount, saveLoadout, sell, type GameState } from '../../src/core/game';
import { groundedBuilds, sortieBuilds } from '../../src/core/sortie';
import { MASTER_PURSE, masterId, masterMission, masterPurse } from '../../src/core/masters';
import { SEAT_ID, SEAT_PURSE, seatMission, seatPurse } from '../../src/core/seat';
import { NO_STATS, contractStats } from '../../src/core/stats';
import { countsForClass, earnsStripes } from '../../src/core/stripes';
import { ARCHETYPE_BUILDS, STAGES } from '../../src/content/archetypeBuilds';
import { ARENA } from '../../src/content/arena';
import { MASTERS } from '../../src/content/masters';
import { MESSAGES, MISSIONS } from '../../src/content/missions';
import { SCENES } from '../../src/content/scenes';
import { KEEPER } from '../../src/content/seat';
import { done } from '../helpers/app';
import { FINDS } from '../../src/content/finds';
import { CATALOG, STARTER_BUILD } from '../../src/content/parts';

/** What four testers who had not seen the game found in its rules, held so that it stays mended. */
const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const ORDER = FINDS.find((find) => find.id === 'paper-order')!;

describe('an answer that hands over something the pilot already holds', () => {
  test('names it: the find the answer is good for, where it was held before the answer was given', () => {
    expect(ORDER.after).toBe('s:hadron-1&finale|chose:seam=stand');
    const before: GameState = { ...fresh(), codex: ['paper-order'] };
    const after: GameState = { ...before, choices: { seam: 'stand' } };
    expect(heldAlready(before, after, FINDS).map((find) => find.id)).toEqual(['paper-order']);
  });

  test('nothing where the find is new with the answer, where the answer is another, or where it was given before', () => {
    const empty = fresh();
    expect(heldAlready(empty, { ...empty, choices: { seam: 'stand' } }, FINDS)).toEqual([]);
    const holding: GameState = { ...fresh(), codex: ['paper-order'] };
    expect(heldAlready(holding, { ...holding, choices: { seam: 'clear' } }, FINDS)).toEqual([]);
    expect(heldAlready(holding, { ...holding, choices: { other: 'stand' } }, FINDS)).toEqual([]);
    const answered: GameState = { ...holding, choices: { seam: 'stand' } };
    expect(heldAlready(answered, answered, FINDS)).toEqual([]);
    expect(heldAlready(answered, { ...answered, battlesWon: 9 }, FINDS)).toEqual([]);
    // And nothing where there was no game before.
    expect(heldAlready(null, answered, FINDS)).toEqual([]);
  });

  test('an answer that is only part of what a find asks for is good for it all the same: it is what the answer hands over', () => {
    const both = FINDS.filter((find) => find.after.split('|').some((way) => way.split('&').length > 1 && way.includes('chose:')));
    expect(both.length).toBeGreaterThan(0);
    for (const find of both) {
      const way = find.after.split('|').find((w) => w.includes('chose:'))!;
      const [question, answer] = way.split('&').find((term) => term.startsWith('chose:'))!.slice('chose:'.length).split('=');
      const before: GameState = { ...fresh(), codex: [find.id] };
      expect(heldAlready(before, { ...before, choices: { [question]: answer } }, FINDS).map((f) => f.id), find.id).toContain(find.id);
    }
  });
});

describe('a rematch in the arena', () => {
  const at = (arenaRank: number, more: Partial<GameState> = {}): GameState => ({ ...newGame(CATALOG, STARTER_BUILD), arenaRank, ...more });
  const TEXT = { client: 'Arena Office', win: 'Done.' };
  const MIRROR = { ...TEXT, title: 'Mirror Match', style: 'Your own build.', taunt: 'After you.' };
  const CUP = { ...TEXT, title: 'Cup', briefing: (names: string[]) => names };

  test('pays a quarter of the purse the first time, and each one after half of the one before: until it pays nothing', () => {
    const founder = ARENA[14];
    expect(founder.purse).toBe(22000);
    let game = at(15);
    const paid: number[] = [];
    for (let i = 0; i < 16; i++) {
      paid.push(arenaPurse(game, founder));
      game = recordRematch(game, 'arena-15');
    }
    expect(paid.slice(0, 6)).toEqual([5500, 2750, 1375, 688, 344, 172]);
    // It runs dry, and stays dry: no purse is ever less than nothing.
    expect(paid[15]).toBe(0);
    expect(paid.every((purse, i) => i === 0 || purse <= paid[i - 1])).toBe(true);
    expect(arenaPurse({ ...game, rematches: { 'arena-15': 1_000_000 } }, founder)).toBe(0);
    // Everything a rematch of the top of the ladder will ever pay is less than half of what the first win paid.
    expect(paid.reduce((sum, purse) => sum + purse, 0)).toBeLessThan(founder.purse / 2 + 16);
    // The next opponent in line is no rematch, however often the one before was fought again.
    expect(arenaPurse({ ...at(14), rematches: { 'arena-14': 9, 'arena-15': 9 } }, founder)).toBe(22000);
  });

  test('is counted bout by bout, and what the kept game says of it is read with care', () => {
    const game = recordRematch(recordRematch(at(5), 'arena-2'), 'arena-2');
    expect(game.rematches).toEqual({ 'arena-2': 2 });
    expect(rematchesWon(game, 'arena-2')).toBe(2);
    expect(rematchesWon(game, 'arena-3')).toBe(0);
    expect(rematchesWon(at(5), 'arena-2')).toBe(0);
    // A count that is no count reads as none; a name every object has is no bout.
    for (const bad of [-1, 1.5, Number.NaN, '3', null]) expect(rematchesWon({ rematches: { 'arena-2': bad as number } }, 'arena-2')).toBe(0);
    expect(rematchesWon({ rematches: {} }, 'constructor')).toBe(0);
    expect(rematchPurse({ rematches: {} }, 'toString', 4000)).toBe(1000);
    // Writing one down leaves the game it was given as it was.
    const before = at(5);
    recordRematch(before, 'arena-2');
    expect(before.rematches).toBeUndefined();
  });

  test('holds for every bout of the arena that can be won twice: a rank, the mirror, a cup, a master, the seat', () => {
    const mirrored = recordMirrorWin(at(5));
    expect([mirrorPurse(at(5)), mirrorPurse(mirrored), mirrorPurse(recordRematch(mirrored, MIRROR_ID))]).toEqual([MIRROR_PURSE, MIRROR_PURSE / 4, MIRROR_PURSE / 8]);
    const cup = CUPS[0];
    const cupped = recordCupWin(at(5), cup.id);
    expect([cupPurse(at(5), cup), cupPurse(cupped, cup), cupPurse(recordRematch(cupped, cup.id), cup)]).toEqual([2500, 625, 313]);
    const kind = MASTERS[0].kind;
    const beaten: Pick<GameState, 'masters' | 'rematches'> = { masters: [kind] };
    expect([masterPurse({}, kind), masterPurse(beaten, kind), masterPurse(recordRematch(beaten, masterId(kind)), kind)]).toEqual([MASTER_PURSE, MASTER_PURSE / 4, MASTER_PURSE / 8]);
    // Another master's rematches are another master's.
    expect(masterPurse(recordRematch(beaten, masterId(MASTERS[1].kind)), kind)).toBe(MASTER_PURSE / 4);
    const held: Pick<GameState, 'seat' | 'rematches'> = { seat: true };
    expect([seatPurse({}), seatPurse(held), seatPurse(recordRematch(held, SEAT_ID))]).toEqual([SEAT_PURSE, SEAT_PURSE / 4, SEAT_PURSE / 8]);
  });

  test('is marked as one on the fight itself, and a first fight is not', () => {
    expect(arenaMission(at(3), ARENA[2], TEXT)).toMatchObject({ id: 'arena-3', rematch: true, reward: 400 });
    expect(arenaMission(at(2), ARENA[2], TEXT).rematch).toBeUndefined();
    expect(mirrorMission(at(5), MIRROR).rematch).toBeUndefined();
    expect(mirrorMission(recordMirrorWin(at(5)), MIRROR).rematch).toBe(true);
    expect(cupMission(at(5), CUPS[0], ARENA, CUP).rematch).toBeUndefined();
    expect(cupMission(recordCupWin(at(5), CUPS[0].id), CUPS[0], ARENA, CUP).rematch).toBe(true);
    const master = MASTERS[0];
    expect(masterMission({}, master, TEXT).rematch).toBeUndefined();
    // A master beaten in another class's machine is a rematch too: the crown is all that is left to take.
    expect(masterMission({ masters: [master.kind] }, master, TEXT)).toMatchObject({ rematch: true, crown: master.kind });
    expect(seatMission({}, KEEPER, TEXT).rematch).toBeUndefined();
    expect(seatMission({ seat: true }, KEEPER, TEXT).rematch).toBe(true);
  });

  test('is flown as a class and is no win for it: a first fight is', () => {
    const first = arenaMission(at(2), ARENA[2], TEXT);
    const again = arenaMission(at(3), ARENA[2], TEXT);
    expect([countsForClass(first), earnsStripes(first)]).toEqual([true, true]);
    expect([countsForClass(again), earnsStripes(again)]).toEqual([true, false]);
    // What counted for no class before counts for none now.
    expect(earnsStripes({ id: 'drill-aim' })).toBe(false);
    expect(earnsStripes({ id: 'open-0-3-1', loaner: STARTER_BUILD })).toBe(false);
    expect(earnsStripes({ id: 'open-0-3-1' })).toBe(true);
  });

  test('is billed and is no contract: the count the board turns on stays, and the record counts none won, lost or walked away from', () => {
    const bill: Settlement = { won: true, reward: 400, ammoCost: 30, repairCost: 20, net: 350, lines: [] };
    const game = at(3);
    expect(applySettlement(game, bill)).toMatchObject({ battlesWon: game.battlesWon + 1, credits: game.credits + 350 });
    expect(applySettlement(game, bill, false)).toMatchObject({ battlesWon: game.battlesWon, credits: game.credits + 350 });
    expect(applySettlement(game, { ...bill, won: false, reward: 0, net: -50 }, false)).toMatchObject({ battlesWon: game.battlesWon, credits: game.credits - 50 });
    const fought = { ...NO_STATS, kills: 1, taken: 0 };
    expect(contractStats(fought, { won: true, retreated: false, pay: 400 })).toMatchObject({ contracts: 1, flawless: 1, earned: 400, kills: 1 });
    expect(contractStats(fought, { won: true, retreated: false, pay: 400, counted: false })).toMatchObject({ contracts: 0, flawless: 0, earned: 400, kills: 1 });
    expect(contractStats(fought, { won: false, retreated: false, pay: 0, counted: false })).toMatchObject({ lost: 0, retreats: 0 });
    expect(contractStats(fought, { won: false, retreated: true, pay: 0, counted: false })).toMatchObject({ lost: 0, retreats: 0 });
    expect(contractStats(fought, { won: false, retreated: true, pay: 0 })).toMatchObject({ lost: 0, retreats: 1 });
  });

  test('the count is kept with the game and through a new telling, and a kept game that says nonsense of it is not opened', () => {
    const game = recordRematch(at(15), 'arena-15');
    expect(isValidState(JSON.parse(JSON.stringify(game)), CATALOG)).toBe(true);
    expect(isValidState(JSON.parse(JSON.stringify(at(15))), CATALOG)).toBe(true);
    // The story with Lumen, told to its verdict: and then told again.
    const story = MISSIONS.filter((m) => m.phase !== 'side' && m.phase !== 'patrol' && (!m.faction || m.faction === 'lumen') && m.phase !== 'verdict').map((m) => m.id);
    const told = { ...done(...story, 'verdict-enforce'), rematches: game.rematches, endingSeen: true };
    expect(startNewCycle(told, MISSIONS)).toMatchObject({ cycle: 1, rematches: { 'arena-15': 1 } });
    const bad: unknown[] = [[], 'many', 3, { 'arena-15': -1 }, { 'arena-15': 1.5 }, { 'arena-15': '2' }, { 'ARENA 15': 1 }, { '': 1 }, { 'arena-15': 2_000_000 },
      Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`arena-${i}`, 1]))];
    for (const rematches of bad) expect(isValidState({ ...JSON.parse(JSON.stringify(game)), rematches }, CATALOG), JSON.stringify(rematches).slice(0, 40)).toBe(false);
  });
});

describe('a build to try, followed from the page that names it', () => {
  const rich = (credits = 500_000): GameState => ({ ...newGame(CATALOG, STARTER_BUILD), credits });
  const every = (): boolean => true;
  const advised = (game: GameState, kind: (typeof ARCHETYPES)[number], inStock: (id: string) => boolean = every) =>
    adviceFor(game, STAGES.map((stage) => ARCHETYPE_BUILDS[kind][stage]), inStock, CATALOG);

  test('for every class: what is missing is bought at the shelf\'s price, the build is fitted, and it is one that may fly as that class', () => {
    for (const kind of ARCHETYPES) {
      const game = rich();
      const advice = advised(game, kind);
      expect(advice.toBuy.length, kind).toBeGreaterThan(0);
      expect(canFollow(game, advice), kind).toBe(true);
      const next = followAdvice(game, advice, CATALOG)!;
      expect(next.credits, kind).toBe(game.credits - advice.cost);
      expect(sameBuild(next.build, advice.build), kind).toBe(true);
      expect(archetypeOf(next.build, CATALOG), kind).toBe(kind);
      expect(validatePlayerBuild(next.build, CATALOG), kind).toEqual([]);
      // Every part of it is owned as often as the build takes it, and nothing that was owned is gone.
      for (const slot of BUILD_SLOTS) {
        const id = next.build[slot];
        if (id) expect(ownedCount(next, id), `${kind} ${slot}`).toBeGreaterThanOrEqual(BUILD_SLOTS.filter((other) => next.build[other] === id).length);
      }
      for (const id of Object.keys(game.inventory)) expect(ownedCount(next, id), id).toBeGreaterThanOrEqual(ownedCount(game, id));
      // It is kept in the first free place among the saved builds.
      expect(keptAt(next, advice.build), kind).toBe(0);
      // And then it is the build flown: there is nothing left to follow.
      const after = adviceFor(next, [advice.build], every, CATALOG);
      expect([after.toBuy, canFollow(next, after)], kind).toEqual([[], false]);
    }
  });

  test('what was owned already is not bought again: a build owned in full is fitted for nothing', () => {
    const game = rich();
    const advice = advised(game, 'lancer');
    const bought = followAdvice(game, advice, CATALOG)!;
    // Back in the starter, with the lancer's parts on the shelf.
    const back: GameState = { ...bought, build: { ...STARTER_BUILD }, loadouts: [] };
    const again = adviceFor(back, [advice.build], every, CATALOG);
    expect([again.toBuy, again.cost]).toEqual([[], 0]);
    const refitted = followAdvice(back, again, CATALOG)!;
    expect(refitted.credits).toBe(back.credits);
    expect(refitted.inventory).toEqual(back.inventory);
    expect(sameBuild(refitted.build, advice.build)).toBe(true);
  });

  test('it is not followed where it cannot be: too dear, not sold yet, or flown already; and the game is left as it was', () => {
    const poor = rich(100);
    const dear = advised(poor, 'bastion');
    expect(dear.cost).toBeGreaterThan(100);
    expect([canFollow(poor, dear), followAdvice(poor, dear, CATALOG)]).toEqual([false, null]);
    // One credit short is short.
    const nearly = rich(dear.cost - 1);
    const same = adviceFor(nearly, [dear.build], every, CATALOG);
    expect(followAdvice(nearly, same, CATALOG)).toBeNull();
    expect(followAdvice(rich(dear.cost), adviceFor(rich(dear.cost), [dear.build], every, CATALOG), CATALOG)!.credits).toBe(0);
    // Nothing on the shelf: every part still to buy is one that is not sold.
    const game = rich();
    const unsold = advised(game, 'marksman', () => false);
    expect(unsold.unsold.length).toBeGreaterThan(0);
    expect([canFollow(game, unsold), followAdvice(game, unsold, CATALOG)]).toEqual([false, null]);
    // The build on the floor is not followed onto itself.
    const flown = adviceFor(game, [game.build], every, CATALOG);
    expect([flown.toBuy, canFollow(game, flown), followAdvice(game, flown, CATALOG)]).toEqual([[], false, null]);
    // A part that is not for sale is not bought by this door either.
    const odd = { build: { ...game.build, head: 'no-such-part' }, toBuy: ['head' as const], cost: 0, unsold: [] };
    expect(followAdvice(game, odd, CATALOG)).toBeNull();
  });

  test('no saved build is written over: with every place taken it is fitted and not kept, and one kept already is not kept twice', () => {
    let full = rich();
    for (let i = 0; i < LOADOUT_SLOTS; i++) full = saveLoadout(full, i);
    const advice = advised(full, 'skirmisher');
    const next = followAdvice(full, advice, CATALOG)!;
    expect(next.loadouts).toEqual(full.loadouts);
    expect(keptAt(next, advice.build)).toBe(-1);
    expect(sameBuild(next.build, advice.build)).toBe(true);
    // The third place is free and the second holds the starter: it goes in the first one free, and only once.
    const some: GameState = { ...rich(), loadouts: [{ ...STARTER_BUILD }, { ...STARTER_BUILD }, null, null] };
    const kept = followAdvice(some, advised(some, 'skirmisher'), CATALOG)!;
    expect(keptAt(kept, kept.build)).toBe(2);
    expect(kept.loadouts.filter((saved) => saved !== null)).toHaveLength(3);
    const back: GameState = { ...kept, build: { ...STARTER_BUILD } };
    const twice = followAdvice(back, adviceFor(back, [kept.build], every, CATALOG), CATALOG)!;
    expect(twice.loadouts).toEqual(kept.loadouts);
  });
});

describe('a telling that knows the pilot has been here', () => {
  /** The story with Lumen, told to its verdict. */
  const STORY = MISSIONS.filter((m) => m.phase !== 'side' && m.phase !== 'patrol' && (!m.faction || m.faction === 'lumen') && m.phase !== 'verdict').map((m) => m.id);
  const told = (): GameState => ({ ...done(...STORY, 'verdict-enforce'), endingSeen: true });
  const ids = (list: Message[]): string[] => list.map((m) => m.id);

  test('what was shown and what was read are remembered as told before when the story starts over, and from one telling to the next', () => {
    const first = { ...told(), scenes: ['act-1', 'act-2'], read: ['welcome', 'clients'] };
    const second = startNewCycle(first, MISSIONS);
    expect(second).toMatchObject({ cycle: 1, scenes: [], read: [], told: { scenes: ['act-1', 'act-2'], read: ['welcome', 'clients'] } });
    expect([toldBefore(second, 'act-1'), toldBefore(second, 'act-3'), readBefore(second, 'clients'), readBefore(second, 'ranks')]).toEqual([true, false, true, false]);
    // A third telling keeps what the first left, adds what the second showed, and names nothing twice.
    const third = startNewCycle({ ...second, completed: first.completed, scenes: ['act-1', 'act-3'], read: ['ranks', 'welcome'], endingSeen: true }, MISSIONS);
    expect(third.told).toEqual({ scenes: ['act-1', 'act-2', 'act-3'], read: ['welcome', 'clients', 'ranks'] });
    // Nothing was told before in a first telling, and a kept game that says nonsense there is read as saying nothing.
    expect([toldBefore(newGame(CATALOG, STARTER_BUILD), 'act-1'), readBefore(newGame(CATALOG, STARTER_BUILD), 'welcome')]).toEqual([false, false]);
    expect(toldBefore({ told: { scenes: 'act-1' as unknown as string[], read: [] } }, 'act-1')).toBe(false);
    // The game that was given is left as it was.
    expect(first.told).toBeUndefined();
  });

  test('a scene told before may be skipped: but no ending, and no page written from what the pilot decided', () => {
    const game = { told: { scenes: SCENES.map((scene) => scene.id), read: [] } };
    const plain = SCENES.find((scene) => !scene.ending && scene.linesFor === undefined && !scene.talk)!;
    const talk = SCENES.find((scene) => scene.talk && !scene.ending && scene.linesFor === undefined)!;
    const ending = SCENES.find((scene) => scene.ending)!;
    const decided = SCENES.find((scene) => scene.linesFor !== undefined)!;
    expect([plain, talk, ending, decided].every(Boolean)).toBe(true);
    expect([skippable(game, plain), skippable(game, talk), skippable(game, ending), skippable(game, decided)]).toEqual([true, true, false, false]);
    // Not told before: not skipped, whatever kind of page it is.
    expect(SCENES.some((scene: Scene) => skippable({}, scene))).toBe(false);
    expect(SCENES.some((scene: Scene) => skippable({ told: { scenes: [], read: [] } }, scene))).toBe(false);
    // A scene is marked seen in this telling as it always was: skipping changes nothing about that.
    expect(markSceneSeen(newGame(CATALOG, STARTER_BUILD), plain).scenes).toEqual([plain.id]);
  });

  test('a letter read in an earlier telling comes again with the story and is not new: one that was never read is', () => {
    const second = startNewCycle({ ...told(), read: ['welcome'] }, MISSIONS);
    // The licence is active again as the telling opens: it arrives, and it is not unread.
    const arrived = ids(arrivedMessages(second, MESSAGES, MISSIONS));
    expect(arrived).toContain('welcome');
    expect(isUnread(second, 'welcome')).toBe(false);
    expect(ids(unreadMessages(second, MESSAGES, MISSIONS))).not.toContain('welcome');
    // Whatever else has arrived and was never read is new, as it would be in a first telling.
    const unread = ids(unreadMessages(second, MESSAGES, MISSIONS));
    expect(unread).toEqual(arrived.filter((id) => id !== 'welcome'));
    // In a first telling nothing has changed: a letter is new until it is read.
    const fresh = newGame(CATALOG, STARTER_BUILD);
    expect(ids(unreadMessages(fresh, MESSAGES, MISSIONS))).toEqual(['welcome']);
    expect(unreadMessages(markRead(fresh, 'welcome'), MESSAGES, MISSIONS)).toEqual([]);
  });

  test('the inbox is in the order the letters came, once that is written down; what came before it was is in the order of the list', () => {
    // An old game: three letters have come, nothing is written down. They stand as the list has them.
    const old = done('intro-1', 'intro-2');
    const listed = ids(arrivedMessages(old, MESSAGES, MISSIONS));
    expect(listed.slice(0, 2)).toEqual(['welcome', 'after-intro-1']);
    expect(old.mail).toBeUndefined();
    // Written down: the same order, and nothing is written twice.
    const noted = noteArrivals(old, MESSAGES, MISSIONS);
    expect(noted.mail).toEqual(listed);
    expect(noteArrivals(noted, MESSAGES, MISSIONS)).toBe(noted);
    // A letter of the arena comes late in the list; one that arrives now, early in the list, is the newest all the same.
    const early = MESSAGES.findIndex((m) => m.id === 'rival-hello');
    const late = MESSAGES.findIndex((m) => m.id === 'mirror-match');
    expect(early).toBeLessThan(late);
    const champion = noteArrivals({ ...noted, arenaRank: 3 }, MESSAGES, MISSIONS);
    expect(champion.mail!.at(-1)).toBe('mirror-match');
    const more = noteArrivals(MISSIONS.filter((m) => m.phase === 'choice').slice(0, 1).reduce((g, m) => ({ ...g, completed: [...g.completed, m.id] }), champion), MESSAGES, MISSIONS);
    const order = ids(arrivedMessages(more, MESSAGES, MISSIONS));
    expect(order.length).toBeGreaterThan(champion.mail!.length);
    expect(order.indexOf('mirror-match')).toBeLessThan(order.length - 1);
    expect(order.slice(0, champion.mail!.length)).toEqual(champion.mail);
    // The list alone would have put the arena's letter last.
    expect(ids(arrivedMessages({ ...more, mail: undefined }, MESSAGES, MISSIONS)).at(-1)).toBe('mirror-match');
    // A new telling begins with an empty inbox, which fills again as its letters come.
    expect(startNewCycle({ ...told(), mail: ['welcome', 'clients'] }, MISSIONS).mail).toEqual([]);
  });

  test('what a kept game says of earlier tellings and of its mail is read with care', () => {
    const game = { ...newGame(CATALOG, STARTER_BUILD), told: { scenes: ['act-1'], read: ['welcome'] }, mail: ['welcome'] };
    expect(isValidState(JSON.parse(JSON.stringify(game)), CATALOG)).toBe(true);
    const bad: Partial<Record<'told' | 'mail', unknown>>[] = [
      { told: [] }, { told: { scenes: ['act-1'] } }, { told: { scenes: 'act-1', read: [] } }, { told: { scenes: [3], read: [] } }, { told: { scenes: ['Act 1'], read: [] } },
      { told: { scenes: [], read: Array.from({ length: 1001 }, (_, i) => `m-${i}`) } }, { mail: 'welcome' }, { mail: [1] }, { mail: ['WELCOME'] }, { mail: [''] },
    ];
    for (const fault of bad) expect(isValidState({ ...JSON.parse(JSON.stringify(game)), ...fault }, CATALOG), JSON.stringify(fault).slice(0, 50)).toBe(false);
  });
});

describe('a saved build and the parts it is made of', () => {
  const rich = (): GameState => ({ ...newGame(CATALOG, STARTER_BUILD), credits: 200_000 });

  test('selling the one copy of a part a saved build holds leaves that build a part short: which builds, the shop is told', () => {
    // Build 2 is the starter with another head; the pilot flies the starter and owns that head once.
    let game = buy(rich(), 'head-halo', CATALOG);
    game = { ...game, loadouts: [null, { ...STARTER_BUILD, head: 'head-halo' }, null] };
    expect(loadoutsNeeding(game, 'head-halo')).toEqual([1]);
    // With a second copy owned, one can go.
    expect(loadoutsNeeding(buy(game, 'head-halo', CATALOG), 'head-halo')).toEqual([]);
    // A part no saved build holds is nobody's.
    expect(loadoutsNeeding(buy(game, 'head-ronin', CATALOG), 'head-ronin')).toEqual([]);
    // A build that takes a part twice needs both: with two owned, selling one leaves it short.
    const twin = { ...buy(buy(rich(), 'wpn-arc-pistol', CATALOG), 'wpn-arc-pistol', CATALOG) };
    const kept = { ...twin, loadouts: [{ ...STARTER_BUILD, rightHand: 'wpn-arc-pistol', leftHand: 'wpn-arc-pistol' }, { ...STARTER_BUILD, head: 'head-halo' }] };
    expect(loadoutsNeeding(kept, 'wpn-arc-pistol')).toEqual([0]);
    expect(loadoutsNeeding(buy(kept, 'wpn-arc-pistol', CATALOG), 'wpn-arc-pistol')).toEqual([]);
  });

  test('a saved build that cannot be flown is named with the part it is short of, and one that can is not named', () => {
    let game = buy(rich(), 'head-halo', CATALOG);
    game = { ...game, loadouts: [{ ...STARTER_BUILD }, { ...STARTER_BUILD, head: 'head-halo' }, null] };
    expect(sortieBuilds(game, CATALOG).map((sortie) => sortie.slot)).toEqual([null, 1]);
    expect(groundedBuilds(game, CATALOG)).toEqual([]);
    const sold = sell(game, 'head-halo', CATALOG);
    expect(sortieBuilds(sold, CATALOG).map((sortie) => sortie.slot)).toEqual([null]);
    expect(groundedBuilds(sold, CATALOG)).toEqual([{ slot: 1, part: 'head-halo' }]);
    // A build that is whole and may not deploy is named too, with no part to its name: here, one with no weapon.
    const { rightHand: _gun, ...unarmed } = { ...STARTER_BUILD, head: 'head-halo' };
    const bare = { ...game, loadouts: [null, null, unarmed] };
    expect(groundedBuilds(bare, CATALOG)).toEqual([{ slot: 2 }]);
    // The build on the floor, saved, is neither: it is listed as itself.
    expect(groundedBuilds({ ...game, loadouts: [{ ...game.build }] }, CATALOG)).toEqual([]);
  });
});
