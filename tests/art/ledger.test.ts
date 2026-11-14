import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ART_BUDGET_USD, appendLedger, costOf, estimateFor, readLedger, totalOf, wouldExceed, type LedgerEntry } from '../../scripts/art/ledger';

const entry = (usd: number): LedgerEntry => ({ id: 'x', at: '2026-11-14T10:00:00Z', method: 'generate', quality: 'low', usd });

test('the budget stays well under the owner\'s twenty euros', () => {
  expect(ART_BUDGET_USD).toBeLessThanOrEqual(15);
});

test('a request with token counts is charged from them, at the higher published rates', () => {
  const usage = { input_tokens: 1200, output_tokens: 272, input_tokens_details: { text_tokens: 200, image_tokens: 1000 } };
  expect(costOf('edit', 'low', usage)).toBeCloseTo((200 * 5 + 1000 * 10 + 272 * 40) / 1e6, 4);
  expect(costOf('generate', 'low', { input_tokens: 100, output_tokens: 272 })).toBeCloseTo((100 * 5 + 272 * 40) / 1e6, 4);
});

test('a request without token counts is charged the estimate, which is never the cheaper guess', () => {
  expect(costOf('generate', 'low')).toBe(0.02);
  expect(costOf('edit', 'low', {})).toBe(0.03);
  expect(costOf('generate', 'low', { output_tokens: 0 })).toBe(0.02);
  expect(estimateFor('edit', 'medium')).toBeGreaterThan(estimateFor('edit', 'low'));
});

test('the total adds up, and the generator is refused the request that would pass the budget', () => {
  const spent = [entry(2.5), entry(0.02), entry(0.03)];
  expect(totalOf(spent)).toBe(2.55);
  expect(wouldExceed(spent, 'generate', 'low')).toBe(false);
  expect(wouldExceed([entry(ART_BUDGET_USD - 0.01)], 'generate', 'low')).toBe(true);
  expect(wouldExceed([entry(ART_BUDGET_USD - 0.02)], 'generate', 'low')).toBe(false);
  expect(wouldExceed([], 'generate', 'low', 0.01)).toBe(true);
});

test('entries are appended to the file and read back; a missing file is an empty ledger', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'ledger-')), 'ledger.json');
  expect(readLedger(file)).toEqual([]);
  appendLedger(entry(0.02), file);
  expect(appendLedger({ ...entry(0.03), failed: true }, file)).toHaveLength(2);
  expect(totalOf(readLedger(file))).toBe(0.05);
  writeFileSync(file, '{}');
  expect(() => readLedger(file)).toThrow('is not a list');
});

test('the repository\'s own ledger is inside the budget', () => {
  expect(totalOf(readLedger())).toBeLessThanOrEqual(ART_BUDGET_USD);
});
