/**
 * The image budget. Every request to the image service is written to a ledger before it is sent,
 * and the generator refuses to send one once the ledger total would pass the budget. Anything
 * wrong with the ledger itself stops the generator: a ledger that cannot be read must never count
 * as an empty one.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Quality } from './proxy';

/** Hard ceiling for everything in the ledger, in US dollars. The owner's limit is 20 euros in total. */
export const ART_BUDGET_USD = 14;
/** The ledger sits in the repository's art folder wherever the script is run from. */
export const LEDGER_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'art', 'ledger.json');

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
  /** True from the moment a request is sent until its answer is booked. Counted at the estimate meanwhile. */
  pending?: boolean;
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

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** What a request cost: from its token counts when they make sense, else the estimate. */
export function costOf(method: 'generate' | 'edit', quality: Quality, usage?: Usage): number {
  const estimate = estimateFor(method, quality);
  const out = usage?.output_tokens;
  if (!isCount(out) || out <= 0) return estimate;
  const details = usage?.input_tokens_details;
  const imageIn = details?.image_tokens ?? 0;
  const textIn = details?.text_tokens ?? (usage?.input_tokens ?? 0) - imageIn;
  if (!isCount(imageIn) || !isCount(textIn)) return estimate;
  const usd = (textIn * RATE.textIn + imageIn * RATE.imageIn + out * RATE.imageOut) / 1_000_000;
  return Number.isFinite(usd) ? Math.round(usd * 10000) / 10000 : estimate;
}

/** The sum of every entry. An entry without a proper amount is an error, not a zero. */
export function totalOf(entries: LedgerEntry[]): number {
  let sum = 0;
  for (const entry of entries) {
    if (!isCount(entry?.usd)) throw new Error(`ledger entry ${entry?.id ?? '?'}: its amount is not a number`);
    sum += entry.usd;
  }
  return Math.round(sum * 10000) / 10000;
}

/** True when one more request of this kind would take the ledger past the budget. */
export const wouldExceed = (entries: LedgerEntry[], method: 'generate' | 'edit', quality: Quality, budget = ART_BUDGET_USD): boolean =>
  totalOf(entries) + estimateFor(method, quality) > budget;

export function readLedger(file = LEDGER_FILE): LedgerEntry[] {
  if (!existsSync(file)) throw new Error(`ledger not found: ${file}`);
  const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(value)) throw new Error(`${file} is not a list`);
  totalOf(value as LedgerEntry[]); // refuses entries without a proper amount
  return value as LedgerEntry[];
}

function write(entries: LedgerEntry[], file: string): LedgerEntry[] {
  writeFileSync(file, JSON.stringify(entries, null, 1) + '\n');
  return entries;
}

export function appendLedger(entry: LedgerEntry, file = LEDGER_FILE): LedgerEntry[] {
  return write([...readLedger(file), entry], file);
}

/** Books a request at its estimate before it is sent, so an interrupted run still counts it. */
export function beginRequest(
  request: { id: string; at: string; method: 'generate' | 'edit'; quality: Quality }, file = LEDGER_FILE,
): LedgerEntry[] {
  return appendLedger({ ...request, usd: estimateFor(request.method, request.quality), pending: true }, file);
}

/** Replaces the estimate of a pending request with what it cost, or marks it failed and keeps the estimate. */
export function settleRequest(id: string, result: { usage?: Usage; failed?: boolean }, file = LEDGER_FILE): LedgerEntry[] {
  const entries = readLedger(file);
  // The newest pending entry with this id; an id can occur more than once when an image is made again.
  let index = -1;
  entries.forEach((entry, i) => { if (entry.id === id && entry.pending) index = i; });
  if (index < 0) throw new Error(`no pending request for ${id}`);
  const { pending: _pending, ...entry } = entries[index];
  const method = entry.method === 'edit' ? 'edit' : 'generate';
  entries[index] = result.failed
    ? { ...entry, failed: true }
    : { ...entry, usd: costOf(method, entry.quality ?? 'low', result.usage), ...(result.usage ? { usage: result.usage } : {}) };
  return write(entries, file);
}
