/**
 * Plays whole careers and prints how each went.
 * Usage: npm run career                      one career: Hadron, default, standard
 *        npm run career -- --all             every road (three clients, two verdicts) on every difficulty
 *        npm run career -- --faction lumen --verdict enforce --difficulty veteran --seed 3 --cycles 2
 */
import type { Faction, Verdict } from '../src/core/campaign';
import type { Difficulty } from '../src/core/game';
import { careerLine, playCareer } from './careerBot';

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const seed = Number(arg('--seed', '1'));
const cycles = Number(arg('--cycles', '1'));

if (process.argv.includes('--all')) {
  let stopped = 0;
  for (const difficulty of ['story', 'standard', 'veteran'] as Difficulty[]) {
    for (const faction of ['hadron', 'lumen', 'undertow'] as Faction[]) {
      for (const verdict of ['enforce', 'default'] as Verdict[]) {
        const report = playCareer({ faction, verdict, difficulty, seed, cycles });
        if (!report.finished) stopped += 1;
        console.log(careerLine(report));
      }
    }
  }
  console.log(stopped === 0 ? 'Every career finished.' : `${stopped} careers did not finish.`);
  process.exitCode = stopped === 0 ? 0 : 1;
} else {
  const report = playCareer({
    faction: arg('--faction', 'hadron') as Faction, verdict: arg('--verdict', 'default') as Verdict,
    difficulty: arg('--difficulty', 'standard') as Difficulty, seed, cycles,
  });
  console.log(careerLine(report));
  process.exitCode = report.finished ? 0 : 1;
}
