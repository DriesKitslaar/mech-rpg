import { ARCHETYPES, type Archetype } from '../../src/core/archetype';
import { ASK_BONUS, ASK_TIER, BOARD_SIZE, askSettlement, boardTier, generateBoard, swarmContract } from '../../src/core/board';
import type { Mission } from '../../src/core/campaign';
import type { Settlement } from '../../src/core/economy';
import { BOARD_TEXT } from '../../src/content/board';

/**
 * Work that asks for a class: one of the board's three contracts wants a kind of machine, and pays
 * a quarter more of its fee to a pilot who wins it as one.
 */

const board = (won: number, cycle = 0): Mission[] => generateBoard(won, cycle, BOARD_TEXT);
const asking = (won: number, cycle = 0): Mission[] => board(won, cycle).filter((mission) => mission.asks !== undefined);

test('a quarter more, from the third stage of the board on', () => {
  expect([ASK_TIER, ASK_BONUS]).toEqual([2, 0.25]);
});

test('whatever a contract asks for, the board is otherwise exactly the board it always was', () => {
  // Every contract of the first 160 battles won of three cycles, without what it asks for, hashed as it was before any asked.
  let hash = 0;
  let count = 0;
  for (let cycle = 0; cycle < 3; cycle++) {
    for (let won = 0; won < 160; won++) {
      for (const mission of board(won, cycle)) {
        const { asks: _asks, ...rest } = mission;
        const text = JSON.stringify(rest);
        for (let i = 0; i < text.length; i++) hash = (Math.imul(hash, 31) + text.charCodeAt(i)) | 0;
        count += 1;
      }
    }
  }
  expect([count, hash]).toEqual([1440, -2060616530]);
});

test('until the board has grown two stages nothing asks; from then on exactly one of the three does, on every board', () => {
  for (let won = 0; won < 200; won++) {
    const tier = boardTier(won, 0);
    expect(asking(won).length, `after ${won} wins`).toBe(tier >= ASK_TIER ? 1 : 0);
  }
  // Ten battles won is the third stage; nine is not.
  expect([asking(9).length, asking(10).length]).toEqual([0, 1]);
  // A later cycle starts two stages up: its first board asks.
  expect(asking(0, 1).length).toBe(1);
  // What is asked for is one of the seven classes.
  for (let won = 10; won < 200; won++) expect(ARCHETYPES).toContain(asking(won)[0].asks);
});

test('the same board asks the same thing every time it is looked at, and another board another', () => {
  expect(board(37)).toEqual(board(37));
  const wishes = Array.from({ length: 40 }, (_, i) => { const [m] = asking(10 + i); return `${m.id.slice(-1)}:${m.asks}`; });
  expect(new Set(wishes).size).toBeGreaterThan(10);
});

test('each of the three places asks in its turn, and each of the seven classes is asked for about as often as the others', () => {
  const places = [0, 0, 0];
  const classes = Object.fromEntries(ARCHETYPES.map((kind) => [kind, 0])) as Record<Archetype, number>;
  const boards = 700;
  for (let won = 10; won < 10 + boards; won++) {
    const posted = board(won);
    const at = posted.findIndex((mission) => mission.asks !== undefined);
    places[at] += 1;
    classes[posted[at].asks!] += 1;
  }
  expect(places).toHaveLength(BOARD_SIZE);
  // A third each, give or take; a seventh each, give or take.
  for (const n of places) { expect(n).toBeGreaterThan(boards / 3 - 50); expect(n).toBeLessThan(boards / 3 + 50); }
  for (const kind of ARCHETYPES) { expect(classes[kind], kind).toBeGreaterThan(boards / 7 - 35); expect(classes[kind], kind).toBeLessThan(boards / 7 + 35); }
});

test('the swarm beside the board never asks', () => {
  for (let won = 0; won < 120; won++) expect(swarmContract(won, 0, BOARD_TEXT).asks).toBeUndefined();
});

describe('what asking pays', () => {
  const won: Settlement = { won: true, reward: 2530, ammoCost: 100, repairCost: 50, net: 2380, lines: [] };
  const lost: Settlement = { won: false, reward: 0, ammoCost: 100, repairCost: 50, net: -150, lines: [] };

  test('won as the class asked for: a quarter of the fee as it was paid, on top, and the settlement says for what', () => {
    const paid = askSettlement(won, { asks: 'bastion' }, 'bastion');
    // A quarter of 2530 is 632.5: rounded to the credit.
    expect(paid.asked).toEqual({ kind: 'bastion', bonus: 633 });
    expect(paid.net).toBe(2380 + 633);
    expect(paid).toEqual({ ...won, asked: { kind: 'bastion', bonus: 633 }, net: 3013 });
    // What the rank added stays as it was, and is no part of what the quarter is taken of.
    const ranked = askSettlement({ ...won, rank: 'S', score: 97, bonus: 506, net: 2886 }, { asks: 'lancer' }, 'lancer');
    expect(ranked).toMatchObject({ rank: 'S', bonus: 506, asked: { kind: 'lancer', bonus: 633 }, net: 2886 + 633 });
    // The settlement it was given is as it was.
    expect(won).toEqual({ won: true, reward: 2530, ammoCost: 100, repairCost: 50, net: 2380, lines: [] });
  });

  test('won as anything else, in a lent mech, or on a contract that asks for nothing: what it says and no more', () => {
    expect(askSettlement(won, { asks: 'bastion' }, 'duellist')).toBe(won);
    expect(askSettlement(won, { asks: 'bastion' }, null)).toBe(won);
    expect(askSettlement(won, {}, 'bastion')).toBe(won);
    expect(askSettlement(won, {}, null)).toBe(won);
  });

  test('lost as the class asked for: nothing', () => {
    expect(askSettlement(lost, { asks: 'bastion' }, 'bastion')).toBe(lost);
  });
});
