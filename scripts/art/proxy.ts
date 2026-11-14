/** Client for the external image proxy. The address comes from ART_PROXY_URL; nothing is hard-coded. */
import type { Usage } from './ledger';

export type Quality = 'low' | 'medium' | 'high';
export type ProxyDeps = { fetch: typeof fetch };

const MODEL = 'gpt-image-2';
const SIZE = '1024x1024';
const TIMEOUT_MS = 240_000;

export class ArtProxyError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ArtProxyError';
  }
}

/** An image, with the token counts the service reported for it, if it reported any. */
export interface ImageResult { png: Buffer; usage?: Usage }

async function call(path: string, body: Record<string, unknown>, deps?: ProxyDeps): Promise<ImageResult> {
  const base = process.env.ART_PROXY_URL;
  if (!base) throw new ArtProxyError(0, 'ART_PROXY_URL is not set');
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (process.env.ART_PROXY_KEY) headers['x-connector-vault-key'] = process.env.ART_PROXY_KEY;

  let response: Response;
  try {
    response = await (deps?.fetch ?? fetch)(`${base.replace(/\/$/, '')}/${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new ArtProxyError(0, `request failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  const text = await response.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ArtProxyError(response.status, `unexpected response: ${text.slice(0, 200)}`);
  }
  if (!response.ok || !json?.ok) {
    throw new ArtProxyError(json?.status ?? response.status, String(json?.error ?? `request failed (${response.status})`));
  }
  const b64 = json.payload?.data?.[0]?.b64_json;
  if (!b64) throw new ArtProxyError(response.status, 'response contained no image data');
  const usage = json.payload?.usage;
  return { png: Buffer.from(b64, 'base64'), ...(usage && typeof usage === 'object' ? { usage: usage as Usage } : {}) };
}

export function generateImage(req: { prompt: string; quality: Quality }, deps?: ProxyDeps): Promise<ImageResult> {
  return call('openai-run', {
    action: 'imageGenerate', model: MODEL, prompt: req.prompt, size: SIZE, quality: req.quality, n: 1,
  }, deps);
}

export function editImage(
  req: { prompt: string; quality: Quality; references: Buffer[] },
  deps?: ProxyDeps,
): Promise<ImageResult> {
  return call('openai-image-edit', {
    action: 'imageEdit', model: MODEL, prompt: req.prompt, size: SIZE, quality: req.quality,
    images: req.references.map((buf, i) => ({
      base64: buf.toString('base64'), filename: `reference-${i + 1}.png`, mimeType: 'image/png',
    })),
  }, deps);
}
