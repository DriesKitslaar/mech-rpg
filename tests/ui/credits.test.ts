import { NO_STATS } from '../../src/core/stats';
import { xpForLevel } from '../../src/core/pilot';
import { CAST, creditLines, creditsHeight } from '../../src/ui/creditsScreen';
import { done, fresh, ids, inHub, makeApp, press, savedGame, select, snap } from '../helpers/app';

const texts = (game = fresh()) => creditLines(game, 45).map((line) => line.text);

describe('the end roll', () => {
  test('opens with the game\'s name, then who flew, their record, the people of Varn, and a goodbye', () => {
    const game = {
      ...fresh(), callsign: 'VANTA', xp: xpForLevel(11), arenaRank: 6, medals: ['a', 'b'], ranks: { x: 'S' as const, y: 'A' as const },
      stats: { ...NO_STATS, contracts: 41, kills: 120, seconds: 5 * 3600 + 7 * 60 },
    };
    const lines = texts(game);
    expect(lines[0]).toBe('IRONWAGE');
    expect(lines).toEqual(expect.arrayContaining([
      'FLOWN BY', 'VANTA', 'PILOT LEVEL 11', 'CONTRACTS WON  41', 'ENEMIES DESTROYED  120', 'S RANKS  1', 'ARENA RANK  6',
      'MEDALS  2/45', 'TIME PLAYED  5:07', 'IN VARN', 'THANK YOU FOR FLYING',
    ]));
    expect(lines.indexOf('FLOWN BY')).toBeLessThan(lines.indexOf('IN VARN'));
    expect(lines[lines.length - 1]).toBe('THANK YOU FOR FLYING');
  });

  test('names the people the pilot has met, and leaves a blank for those on roads not taken', () => {
    expect(CAST.map((member) => member.name)).toEqual(['Dispatch', 'Director Brenn', 'Analyst Varga', 'Tamsin', 'Ashfall', 'Sable', 'Rook', 'Krell', 'The Actuary']);
    // The Hadron road: Sable was in the way; Rook and Krell were somebody else's problem.
    const hadron = { ...done('intro-1', 'intro-2', 'hadron-1', 'lumen-1', 'undertow-1', 'rival-1', 'audit-1'), met: ['rival', 'sable'] };
    const lines = texts(hadron);
    expect(lines).toEqual(expect.arrayContaining(['Dispatch', 'Director Brenn', 'Analyst Varga', 'Tamsin', 'Ashfall', 'Sable', 'The Actuary']));
    expect(lines).not.toContain('Rook');
    expect(lines).not.toContain('Krell');
    expect(lines.filter((text) => text === '? ? ?')).toHaveLength(2);
    expect(lines).toContain('on a road not taken');
  });

  test('every line fits the width of the screen, and the roll has a height', () => {
    const lines = creditLines({ ...fresh(), callsign: 'WWWWWWWW' }, 45);
    for (const line of lines) expect(line.text.length * (line.size ?? 12) * 0.4, line.text).toBeLessThanOrEqual(300);
    expect(creditsHeight(lines)).toBeGreaterThan(300);
  });
});

describe('the end roll in the game', () => {
  const judged = () => ({ ...done('intro-1', 'intro-2', 'rival-1', 'choice-lumen', 'finale-lumen', 'audit-1', 'audit-2', 'audit-3', 'verdict-default'),
    scenes: ['act-1', 'act-2', 'act-3', 'war-won-lumen'] });

  test('follows the epilogue, once, and then the hub', () => {
    const { app, store } = makeApp(judged());
    press(app, 'confirm');
    expect(snap(app)).toMatchObject({ screen: 'ending', scene: 'ending-default-lumen' });
    press(app, 'confirm');
    expect(snap(app).screen).toBe('credits');
    expect(savedGame(store).endingSeen).toBe(true);
    // Other buttons do nothing; confirm leaves.
    press(app, 'down', 'left');
    expect(snap(app).screen).toBe('credits');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('hub');
    // It does not come back by itself.
    const again = makeApp(savedGame(store)).app;
    press(again, 'confirm');
    expect(snap(again).screen).toBe('hub');
  });

  test('can be watched again from the options once an ending has been seen, and not before', () => {
    const before = inHub({ ...fresh(), scenes: ['act-1'] }).app;
    select(before, 'options');
    expect(ids(before)).not.toContain('credits');

    const { app } = inHub({ ...judged(), endingSeen: true, scenes: [...judged().scenes, 'ending-default-lumen'] });
    select(app, 'options');
    expect(ids(app)).toContain('credits');
    select(app, 'credits');
    expect(snap(app).screen).toBe('credits');
    press(app, 'confirm');
    expect(snap(app).screen).toBe('hub');
  });

  test('a pilot in a later cycle can still watch it', () => {
    const { app } = inHub({ ...fresh(), cycle: 1, scenes: ['act-1'] });
    select(app, 'options');
    expect(ids(app)).toContain('credits');
  });
});
