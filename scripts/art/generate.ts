/**
 * Generates raw images for the jobs in jobs.ts.
 * Usage: tsx scripts/art/generate.ts [--only id,id] [--force] [--max 20]
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { EnvHttpProxyAgent, fetch as undiciFetch } from 'undici';
import { JOBS, QUALITY, promptFor } from './jobs';
import { ArtProxyError, editImage, generateImage, type ProxyDeps } from './proxy';

const RAW = 'art/raw';
const TMP = 'art/raw-tmp';
const REFERENCE = 'art/reference/style-ref.png';

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

  const todo = JOBS.filter((j) => (!only || only.includes(j.id)) && (force || !existsSync(`${RAW}/${j.id}.png`)));
  if (todo.length > max) throw new Error(`${todo.length} images to generate exceeds --max ${max}`);
  if (todo.length === 0) { console.log('nothing to generate'); return; }

  // Node's built-in fetch ignores HTTPS_PROXY; undici's agent honours it.
  const dispatcher = new EnvHttpProxyAgent();
  const deps: ProxyDeps = {
    fetch: ((url: string, init: any) => undiciFetch(url, { ...init, dispatcher })) as unknown as typeof fetch,
  };
  mkdirSync(RAW, { recursive: true });
  mkdirSync(TMP, { recursive: true });
  const reference = readFileSync(REFERENCE);

  let done = 0;
  let failed = 0;
  for (const job of todo) {
    const prompt = promptFor(job);
    const viaEdit = job.kind !== 'background';
    try {
      const request = () => viaEdit
        ? editImage({ prompt, quality: QUALITY, references: [reference] }, deps)
        : generateImage({ prompt, quality: QUALITY }, deps);
      // One retry for gateway hiccups and network errors; request errors (4xx) are not retried.
      const png = await request().catch((e) => {
        if (e instanceof ArtProxyError && (e.status === 0 || e.status >= 500)) return request();
        throw e;
      });
      const tmp = `${TMP}/${job.id}.png`;
      writeFileSync(tmp, png);
      renameSync(tmp, `${RAW}/${job.id}.png`);
      writeFileSync(`${RAW}/${job.id}.json`, JSON.stringify({
        id: job.id, model: 'gpt-image-2', size: '1024x1024', quality: QUALITY,
        method: viaEdit ? 'edit' : 'generate', reference: viaEdit ? REFERENCE : null, prompt,
      }, null, 2) + '\n');
      done++;
      console.log(`ok   ${job.id}`);
    } catch (e) {
      failed++;
      const status = e instanceof ArtProxyError ? e.status : '-';
      console.error(`FAIL ${job.id} [${status}] ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  rmSync(TMP, { recursive: true, force: true });
  console.log(`generated ${done} image(s), ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
