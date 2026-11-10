import { chooseAutoPlayerAction, runBattle } from '../../src/core/ai';
import { createBattle } from '../../src/core/battle';
import { ENCOUNTERS, ENEMIES } from '../../src/content/enemies';
import { CATALOG, DEMO_BUILD } from '../../src/content/parts';

function winRate(encounter: string, seeds: number): number {
  let wins = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const start = createBattle(DEMO_BUILD, ENCOUNTERS[encounter].map((id) => ENEMIES[id]), CATALOG, seed);
    if (runBattle(start, CATALOG, chooseAutoPlayerAction).outcome === 'victory') wins++;
  }
  return wins / seeds;
}

test('the intro encounter is nearly always won', () => {
  expect(winRate('intro', 300)).toBeGreaterThanOrEqual(0.95);
});

test('the outpost encounter is winnable but not free', () => {
  const rate = winRate('outpost', 300);
  expect(rate).toBeGreaterThanOrEqual(0.6);
  expect(rate).toBeLessThanOrEqual(0.98);
});
