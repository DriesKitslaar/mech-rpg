/**
 * The image budget. Every request to the image service is written to a ledger, and the
 * generator refuses to run once the ledger total would pass the budget.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Quality } from './proxy';

/** Hard ceiling for everything in the ledger, in US dollars. The owner's limit is 20 euros in total. */
export const ART_BUDGET_USD = 14;
export const LEDGER_FILE = 'art/ledger.json';

/** Token counts as the image service reports them. */
export interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
}

export interface LedgerEntry {
  id: string;
  /** ISO date and time of the request. */
  at: string;
  method: 'generate' | 'edit' | 'estimate';
  quality?: Quality;
  usd: number;
  /** Present when the service reported token counts; `usd` is then computed from them. */
  usage?: Usage;
  /** True when the request failed: it is counted anyway, because a failed request may still be billed. */
  failed?: boolean;
  note?: string;
}

/** Dollars per million tokens. Deliberately the higher published rates, so the ledger never undercounts. */
const RATE = { textIn: 5, imageIn: 10, imageOut: 40 };
/** What a request is assumed to cost when the service reports no token counts. */
const FALLBACK: Record<Quality, { generate: number; edit: number }> = {
  low: { generate: 0.02, edit: 0.03 },
  medium: { generate: 0.08, edit: 0.1 },
  high: { generate: 0.25, edit: 0.3 },
};

/** What a request is expected to cost before it is made. */
export const estimateFor = (method: 'generate' | 'edit', quality: Quality): number => FALLBACK[quality][method];

/** What a request cost: from its token counts when there are any, else the estimate. */
export function costOf(method: 'generate' | 'edit', quality: Quality, usage?: Usage): number {
  const out = usage?.output_tokens;
  if (typeof out !== 'number' || out <= 0) return estimateFor(method, quality);
  const details = usage?.input_tokens_details;
  const imageIn = details?.image_tokens ?? 0;
  const textIn = details?.text_tokens ?? Math.max(0, (usage?.input_tokens ?? 0) - imageIn);
  const usd = (textIn * RATE.textIn + imageIn * RATE.imageIn + out * RATE.imageOut) / 1_000_000;
  return Math.round(usd * 10000) / 10000;
}

export const totalOf = (entries: LedgerEntry[]): number =>
  Math.round(entries.reduce((sum, entry) => sum + entry.usd, 0) * 10000) / 10000;

/** True when one more request of this kind would take the ledger past the budget. */
export const wouldExceed = (entries: LedgerEntry[], method: 'generate' | 'edit', quality: Quality, budget = ART_BUDGET_USD): boolean =>
  totalOf(entries) + estimateFor(method, quality) > budget;

export function readLedger(file = LEDGER_FILE): LedgerEntry[] {
  if (!existsSync(file)) return [];
  const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(value)) throw new Error(`${file} is not a list`);
  return value as LedgerEntry[];
}

export function appendLedger(entry: LedgerEntry, file = LEDGER_FILE): LedgerEntry[] {
  const entries = [...readLedger(file), entry];
  writeFileSync(file, JSON.stringify(entries, null, 1) + '\n');
  return entries;
}
