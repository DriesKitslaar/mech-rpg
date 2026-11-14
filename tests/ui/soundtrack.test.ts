import type { Mission } from '../../src/core/campaign';
import { ALL_ENEMIES } from '../../src/content/arena';
import { MISSIONS } from '../../src/content/missions';
import { SONGS } from '../../src/content/songs';
import { battleTrack, isBossBattle, trackFor } from '../../src/ui/soundtrack';

const mission = (id: string): Mission => MISSIONS.find((m) => m.id === id)!;

test('every screen has a song, and every song it names exists', () => {
  const screens = ['title', 'hub', 'garage', 'shop', 'messages', 'pilot', 'options', 'arena', 'briefing', 'scene', 'ending'] as const;
  expect(screens.map((screen) => trackFor(screen))).toEqual([
    'title', 'hub', 'hub', 'hub', 'hub', 'hub', 'hub', 'hub', 'briefing', 'briefing', 'ending',
  ]);
  for (const screen of screens) expect(Object.keys(SONGS)).toContain(trackFor(screen));
});

test('the settlement plays the jingle of how it went', () => {
  expect(trackFor('settlement', { won: true })).toBe('victory');
  expect(trackFor('settlement', { won: false })).toBe('defeat');
  expect(SONGS.victory.loop).toBe(false);
  expect(SONGS.defeat.loop).toBe(false);
});

describe('in battle', () => {
  const track = (id: string, index = 0) => battleTrack(mission(id), index, ALL_ENEMIES);

  test('a battle with an enemy that has phases is a boss battle', () => {
    expect(isBossBattle(mission('hadron-3').battles[2], ALL_ENEMIES)).toBe(true);
    expect(isBossBattle(mission('hadron-3').battles[0], ALL_ENEMIES)).toBe(false);
    expect(track('hadron-3', 2)).toBe('boss');
    expect(track('lumen-3', 1)).toBe('boss');
    expect(track('verdict-default', 1)).toBe('boss');
    expect(track('finale-lumen', 2)).toBe('boss');
  });

  test('the first act fights to one song, the war and the audit to another', () => {
    expect(track('intro-1')).toBe('battle');
    expect(track('hadron-2')).toBe('battle');
    expect(track('rival-1', 1)).toBe('battle');
    expect(track('choice-lumen')).toBe('battle');
    expect(track('hadron-3', 0)).toBe('battle2');
    expect(track('finale-lumen', 0)).toBe('battle2');
    expect(track('audit-1')).toBe('battle2');
    expect(track('verdict-default', 0)).toBe('battle2');
  });

  test('the arena has its own, whoever is in it', () => {
    expect(battleTrack({ ...mission('patrol'), arenaRank: 3 }, 0, ALL_ENEMIES)).toBe('arena');
  });

  test('an unknown enemy or a battle that does not exist is no reason to fall silent', () => {
    const odd: Mission = { ...mission('patrol'), battles: [{ enemies: ['nobody'], background: 'bg' }] };
    expect(battleTrack(odd, 0, ALL_ENEMIES)).toBe('battle');
    expect(battleTrack(odd, 5, ALL_ENEMIES)).toBe('battle');
  });
});
