import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { settle } from '../../src/core/economy';
import { playMission } from '../../src/core/mission';
import { ENEMIES } from '../../src/content/enemies';
import { MISSIONS } from '../../src/content/missions';
import { CATALOG } from '../../src/content/parts';
import { REFERENCE_BUILDS } from '../../src/content/referenceBuilds';

export const SEEDS = 120;
const played = new Map<string, { winRate: number; meanNet: number }>();

/**
 * Win rate and mean net pay of a contract played by the automatic player with a reference build.
 * Each pair is played once per test file, however many tests ask about it.
 */
export function play(missionId: string, buildName: string): { winRate: number; meanNet: number } {
  const key = `${missionId}|${buildName}`;
  const known = played.get(key);
  if (known) return known;
  const mission = MISSIONS.find((m) => m.id === missionId)!;
  let wins = 0;
  let net = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    // Two unrelated seed families, alternated, so a threshold is not met by one lucky sequence.
    const start = seed % 2 ? seed * 7919 : seed * 104729 + 13;
    const end = playMission(REFERENCE_BUILDS[buildName], mission, ENEMIES, CATALOG, start, (s) => runBattle(s, CATALOG, chooseAutoPlayerAction),
      { enemyScale: mission.scale ?? 1 });
    if (end.outcome === 'victory') wins++;
    net += settle(end, mission.reward, CATALOG).net;
  }
  const result = { winRate: wins / SEEDS, meanNet: net / SEEDS };
  played.set(key, result);
  return result;
}

export const ids = (phase: string): string[] => MISSIONS.filter((m) => m.phase === phase).map((m) => m.id);
