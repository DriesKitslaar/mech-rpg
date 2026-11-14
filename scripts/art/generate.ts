/**
 * Generates raw images for the jobs in jobs.ts.
 * Usage: tsx scripts/art/generate.ts [--only id,id] [--force] [--max 20]
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { EnvHttpProxyAgent, fetch as undiciFetch } from 'undici';
import { JOBS, qualityFor } from './jobs';
import { ART_BUDGET_USD, appendLedger, costOf, estimateFor, readLedger, totalOf, wouldExceed } from './ledger';
import { ArtProxyError, editImage, generateImage, type ProxyDeps } from './proxy';

const RAW = 'art/raw';
const TMP = 'art/raw-tmp';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const only = arg('--only')?.split(',');
  const force = process.argv.includes('--force');
  const max = Number(arg('--max') ?? 20);

  const unknown = (only ?? []).filter((id) => !JOBS.some((j) => j.id === id));
  if (unknown.length) throw new Error(`unknown job id: ${unknown.join(', ')}`);

  // Jobs with a `source` reuse another raw image and are never generated.
  const todo = JOBS.filter((j) => !j.source && (!only || only.includes(j.id)) && (force || !existsSync(`${RAW}/${j.id}.png`)));
  if (todo.length > max) throw new Error(`${todo.length} images to generate exceeds --max ${max}`);
  if (todo.length === 0) { console.log('nothing to generate'); return; }

  // Node's built-in fetch ignores HTTPS_PROXY; undici's agent honours it.
  const dispatcher = new EnvHttpProxyAgent();
  const deps: ProxyDeps = {
    fetch: ((url: string, init: any) => undiciFetch(url, { ...init, dispatcher })) as unknown as typeof fetch,
  };
  mkdirSync(RAW, { recursive: true });
  mkdirSync(TMP, { recursive: true });

  let done = 0;
  let failed = 0;
  for (const job of todo) {
    const { prompt } = job;
    const references = job.references ?? [];
    const viaEdit = references.length > 0;
    const quality = qualityFor(job);
    const method = viaEdit ? 'edit' : 'generate';
    // The budget is checked before every single request: nothing is sent that could pass it.
    if (wouldExceed(readLedger(), method, quality)) {
      failed++;
      console.error(`STOP ${job.id}: the image budget of $${ART_BUDGET_USD} would be passed (spent so far: $${totalOf(readLedger())})`);
      break;
    }
    const missing = references.filter((file) => !existsSync(file));
    if (missing.length) {
      failed++;
      console.error(`FAIL ${job.id} missing reference image: ${missing.join(', ')}`);
      continue;
    }
    try {
      const request = () => viaEdit
        ? editImage({ prompt, quality, references: references.map((file) => readFileSync(file)) }, deps)
        : generateImage({ prompt, quality }, deps);
      // No automatic retry: a request that times out at a gateway may still be billed.
      const { png, usage } = await request();
      appendLedger({ id: job.id, at: new Date().toISOString(), method, quality, usd: costOf(method, quality, usage), ...(usage ? { usage } : {}) });
      const tmp = `${TMP}/${job.id}.png`;
      writeFileSync(tmp, png);
      renameSync(tmp, `${RAW}/${job.id}.png`);
      writeFileSync(`${RAW}/${job.id}.json`, JSON.stringify({
        id: job.id, model: 'gpt-image-2', size: '1024x1024', quality,
        method, references, prompt,
      }, null, 2) + '\n');
      done++;
      console.log(`ok   ${job.id}`);
    } catch (e) {
      failed++;
      // Counted at the estimate: the request may have been billed even though nothing came back.
      appendLedger({ id: job.id, at: new Date().toISOString(), method, quality, usd: estimateFor(method, quality), failed: true });
      const status = e instanceof ArtProxyError ? e.status : '-';
      console.error(`FAIL ${job.id} [${status}] ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  rmSync(TMP, { recursive: true, force: true });
  console.log(`generated ${done} image(s), ${failed} failed; ledger total $${totalOf(readLedger())} of $${ART_BUDGET_USD}`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
