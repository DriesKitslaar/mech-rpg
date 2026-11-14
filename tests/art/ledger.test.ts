import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ART_BUDGET_USD, appendLedger, beginRequest, costOf, estimateFor, readLedger, settleRequest, totalOf, wouldExceed,
  type LedgerEntry,
} from '../../scripts/art/ledger';

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

test('entries are appended to the file and read back', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'ledger-')), 'ledger.json');
  writeFileSync(file, '[]');
  appendLedger(entry(0.02), file);
  expect(appendLedger({ ...entry(0.03), failed: true }, file)).toHaveLength(2);
  expect(totalOf(readLedger(file))).toBe(0.05);
});

test('a ledger that is missing or damaged stops everything instead of counting as empty', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
  expect(() => readLedger(join(dir, 'none.json'))).toThrow('not found');
  const file = join(dir, 'ledger.json');
  for (const bad of ['{}', '[{"id":"x","at":"t","method":"generate"}]', '[{"id":"x","at":"t","method":"generate","usd":"2.5"}]',
    '[{"id":"x","at":"t","method":"generate","usd":-1}]', '[null]']) {
    writeFileSync(file, bad);
    expect(() => readLedger(file), bad).toThrow();
  }
  expect(() => totalOf([entry(1), { ...entry(1), usd: Number.NaN }])).toThrow('not a number');
  expect(() => wouldExceed([{ ...entry(1), usd: undefined as unknown as number }], 'generate', 'low')).toThrow();
});

test('token counts that make no sense fall back to the estimate rather than to nothing', () => {
  expect(costOf('edit', 'low', { output_tokens: 'many' as unknown as number })).toBe(0.03);
  expect(costOf('generate', 'low', { output_tokens: 200, input_tokens: Number.NaN })).toBe(0.02);
  expect(costOf('generate', 'low', { output_tokens: 200, input_tokens_details: { image_tokens: -5, text_tokens: 100 } })).toBe(0.02);
});

test('a request is booked before it is sent and settled when it returns', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'ledger-')), 'ledger.json');
  writeFileSync(file, '[]');
  beginRequest({ id: 'wpn-x', at: '2026-11-14T10:00:00Z', method: 'edit', quality: 'low' }, file);
  // Interrupted here, the request still counts, at the estimate.
  expect(readLedger(file)).toEqual([{ id: 'wpn-x', at: '2026-11-14T10:00:00Z', method: 'edit', quality: 'low', usd: 0.03, pending: true }]);
  settleRequest('wpn-x', { usage: { input_tokens: 1100, output_tokens: 196, input_tokens_details: { text_tokens: 100, image_tokens: 1000 } } }, file);
  const [done] = readLedger(file);
  expect(done.pending).toBeUndefined();
  expect(done.usd).toBeCloseTo((100 * 5 + 1000 * 10 + 196 * 40) / 1e6, 4);

  beginRequest({ id: 'wpn-y', at: '2026-11-14T10:01:00Z', method: 'generate', quality: 'low' }, file);
  settleRequest('wpn-y', { failed: true }, file);
  expect(readLedger(file)[1]).toMatchObject({ id: 'wpn-y', usd: 0.02, failed: true });
  expect(readLedger(file)[1].pending).toBeUndefined();
  expect(() => settleRequest('wpn-z', {}, file)).toThrow('no pending request');
});

test('the repository\'s own ledger is inside the budget', () => {
  expect(totalOf(readLedger())).toBeLessThanOrEqual(ART_BUDGET_USD);
});
