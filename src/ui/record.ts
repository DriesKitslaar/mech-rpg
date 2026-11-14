import { RANKS, type GameState, type Rank } from '../core/game';
import { STRINGS } from '../content/strings';

const R = STRINGS.record;

export interface RecordLine { label: string; value: string }
/** The record is shown in two columns of this many lines. */
export const RECORD_ROWS = 11;

/** Time played as hours and minutes. */
export function playTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

/** How many contracts the pilot holds each rank on, best rank first. */
export function rankTally(game: GameState): [Rank, number][] {
  const held = Object.values(game.ranks);
  return RANKS.map((rank) => [rank, held.filter((r) => r === rank).length]);
}

/** What the pilot has done, as lines for the pilot screen: the left column first, then the right. */
export function recordLines(game: GameState, medalCount: number): RecordLine[] {
  const s = game.stats;
  const n = (value: number): string => String(value);
  const lines: [string, string][] = [
    [R.contracts, n(s.contracts)], [R.lost, n(s.lost)], [R.retreats, n(s.retreats)], [R.flawless, n(s.flawless)],
    [R.kills, n(s.kills)], [R.parts, n(s.parts)], [R.staggers, n(s.staggers)], [R.bombs, n(s.bombs)], [R.bosses, n(s.bosses)],
    [R.sRanks, n(Object.values(game.ranks).filter((rank) => rank === 'S').length)],
    [R.arena, game.arenaRank > 0 ? n(game.arenaRank) : R.none],
    [R.shots, n(s.shots)], [R.hits, n(s.hits)], [R.accuracy, s.shots > 0 ? `${Math.round((100 * s.hits) / s.shots)}%` : R.none],
    [R.damage, n(s.damage)], [R.taken, n(s.taken)], [R.overheats, n(s.overheats)], [R.rounds, n(s.rounds)], [R.earned, n(s.earned)],
    [R.medals, `${game.medals.length}/${medalCount}`], [R.cycle, n(game.cycle + 1)], [R.time, playTime(s.seconds)],
  ];
  return lines.map(([label, value]) => ({ label, value }));
}
