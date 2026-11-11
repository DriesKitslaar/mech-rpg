import {
  availableMissions, campaignComplete, chosenFaction, completeMission, loyalty, markRead, stockFor, unreadMessages,
  type Message, type Mission,
} from '../../src/core/campaign';
import { newGame, type GameState } from '../../src/core/game';
import { CATALOG, SHOP_PARTS, STARTER_BUILD } from '../../src/content/parts';

const m = (id: string, phase: Mission['phase'], faction?: Mission['faction']): Mission => ({
  id, phase, faction, title: id, client: 'c', briefing: ['b'], debrief: 'd', reward: 100,
  battles: [{ enemies: ['recon-drone'], background: 'bg' }],
});
const MISSIONS: Mission[] = [
  m('patrol', 'patrol'), m('intro-1', 'intro'), m('intro-2', 'intro'),
  m('hadron-1', 'faction', 'hadron'), m('lumen-1', 'faction', 'lumen'), m('undertow-1', 'faction', 'undertow'),
  m('choice-hadron', 'choice', 'hadron'), m('choice-lumen', 'choice', 'lumen'), m('choice-undertow', 'choice', 'undertow'),
  m('finale-hadron', 'finale', 'hadron'), m('finale-lumen', 'finale', 'lumen'), m('finale-undertow', 'finale', 'undertow'),
];
const fresh = (): GameState => newGame(CATALOG, STARTER_BUILD);
const after = (...ids: string[]): GameState => ids.reduce((g, id) => completeMission(g, id, MISSIONS), fresh());
const offered = (g: GameState) => availableMissions(g, MISSIONS).map((x) => x.id);

describe('which contracts are on offer', () => {
  test('a new pilot gets the patrol and the first introduction only', () => {
    expect(offered(fresh())).toEqual(['patrol', 'intro-1']);
  });

  test('the introductions come one at a time, in order', () => {
    expect(offered(after('intro-1'))).toEqual(['patrol', 'intro-2']);
  });

  test('then all three clients offer work, in any order', () => {
    expect(offered(after('intro-1', 'intro-2'))).toEqual(['patrol', 'hadron-1', 'lumen-1', 'undertow-1']);
    expect(offered(after('intro-1', 'intro-2', 'lumen-1'))).toEqual(['patrol', 'hadron-1', 'undertow-1']);
  });

  test('after all three, each client offers one exclusive contract', () => {
    expect(offered(after('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1')))
      .toEqual(['patrol', 'choice-hadron', 'choice-lumen', 'choice-undertow']);
  });

  test('taking one withdraws the other two and leads to that client\'s finale', () => {
    const g = after('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'choice-lumen');
    expect(offered(g)).toEqual(['patrol', 'finale-lumen']);
    expect(chosenFaction(g, MISSIONS)).toBe('lumen');
  });

  test('after the finale only the patrol remains and the campaign is complete', () => {
    const g = after('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'choice-lumen', 'finale-lumen');
    expect(offered(g)).toEqual(['patrol']);
    expect(campaignComplete(g, MISSIONS)).toBe(true);
    expect(campaignComplete(after('intro-1'), MISSIONS)).toBe(false);
  });

  test('the patrol is always there, whatever has been done', () => {
    for (const g of [fresh(), after('intro-1'), after('intro-1', 'intro-2', 'hadron-1')]) expect(offered(g)[0]).toBe('patrol');
  });
});

describe('completing contracts', () => {
  test('the patrol can be repeated and is not recorded', () => {
    expect(after('patrol', 'patrol').completed).toEqual([]);
  });

  test('a contract is recorded once', () => {
    expect(after('intro-1', 'intro-1').completed).toEqual(['intro-1']);
  });

  test('an unknown contract is refused', () => {
    expect(() => completeMission(fresh(), 'nope', MISSIONS)).toThrow('unknown mission: nope');
  });

  test('the given state is not changed', () => {
    const g = fresh();
    completeMission(g, 'intro-1', MISSIONS);
    expect(g.completed).toEqual([]);
  });

  test('loyalty counts one for a client\'s first job and two for the exclusive one', () => {
    const g = after('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'choice-hadron');
    expect(loyalty(g, MISSIONS)).toEqual({ hadron: 3, lumen: 1, undertow: 1 });
    expect(chosenFaction(fresh(), MISSIONS)).toBeNull();
  });
});

describe('shop stock', () => {
  const unlocks = { 'head-halo': 'lumen-1', 'core-ronin': 'choice' };
  const ids = (g: GameState) => stockFor(g, SHOP_PARTS, unlocks, MISSIONS).map((p) => p.id);

  test('parts without a condition are always in stock', () => {
    expect(ids(fresh())).toContain('wpn-rivet-rifle');
    expect(ids(fresh())).toHaveLength(SHOP_PARTS.length - 2);
  });

  test('a part appears once its contract is done', () => {
    expect(ids(fresh())).not.toContain('head-halo');
    expect(ids(after('lumen-1'))).toContain('head-halo');
  });

  test('"choice" unlocks with any exclusive contract', () => {
    expect(ids(after('choice-undertow'))).toContain('core-ronin');
    expect(ids(after('lumen-1'))).not.toContain('core-ronin');
  });
});

describe('messages', () => {
  const MESSAGES: Message[] = [
    { id: 'welcome', from: 'Dispatch', subject: 's', body: ['b'], after: 'start' },
    { id: 'thanks', from: 'Lumen', subject: 's', body: ['b'], after: 'lumen-1' },
    { id: 'picked', from: 'Rival', subject: 's', body: ['b'], after: 'choice' },
  ];
  test('messages arrive with the event they follow', () => {
    expect(unreadMessages(fresh(), MESSAGES, MISSIONS).map((x) => x.id)).toEqual(['welcome']);
    expect(unreadMessages(after('lumen-1', 'choice-hadron'), MESSAGES, MISSIONS).map((x) => x.id)).toEqual(['welcome', 'thanks', 'picked']);
  });

  test('a read message is no longer unread, and reading twice changes nothing', () => {
    const g = markRead(markRead(fresh(), 'welcome'), 'welcome');
    expect(g.read).toEqual(['welcome']);
    expect(unreadMessages(g, MESSAGES, MISSIONS)).toEqual([]);
  });
});
