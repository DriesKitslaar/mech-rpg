import { ArtProxyError, editImage, generateImage } from '../../scripts/art/proxy';

const PNG = Buffer.from('fake-png-bytes');
const okBody = { ok: true, payload: { data: [{ b64_json: PNG.toString('base64') }] } };

function fakeFetch(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

beforeEach(() => {
  process.env.ART_PROXY_URL = 'https://proxy.test/functions/v1';
  delete process.env.ART_PROXY_KEY;
});

test('generateImage returns the decoded image bytes', async () => {
  const { fn } = fakeFetch(okBody);
  const out = await generateImage({ prompt: 'a mech', quality: 'low' }, { fetch: fn });
  expect(out.equals(PNG)).toBe(true);
});

test('generateImage posts the generate action to the openai-run function', async () => {
  const { fn, calls } = fakeFetch(okBody);
  await generateImage({ prompt: 'a mech', quality: 'medium' }, { fetch: fn });
  expect(calls[0].url).toBe('https://proxy.test/functions/v1/openai-run');
  expect(JSON.parse(calls[0].init.body as string)).toMatchObject({
    action: 'imageGenerate', model: 'gpt-image-2', size: '1024x1024', quality: 'medium', prompt: 'a mech',
  });
});

test('editImage posts one image entry per reference to the image-edit function', async () => {
  const { fn, calls } = fakeFetch(okBody);
  await editImage({ prompt: 'legs', quality: 'low', references: [PNG, PNG] }, { fetch: fn });
  expect(calls[0].url).toBe('https://proxy.test/functions/v1/openai-image-edit');
  const body = JSON.parse(calls[0].init.body as string);
  expect(body.action).toBe('imageEdit');
  expect(body.images).toHaveLength(2);
  expect(body.images[0]).toMatchObject({ base64: PNG.toString('base64'), mimeType: 'image/png' });
});

test('the key header is sent only when ART_PROXY_KEY is set', async () => {
  const a = fakeFetch(okBody);
  await generateImage({ prompt: 'x', quality: 'low' }, { fetch: a.fn });
  expect(new Headers(a.calls[0].init.headers).has('x-connector-vault-key')).toBe(false);
  process.env.ART_PROXY_KEY = 'k';
  const b = fakeFetch(okBody);
  await generateImage({ prompt: 'x', quality: 'low' }, { fetch: b.fn });
  expect(new Headers(b.calls[0].init.headers).get('x-connector-vault-key')).toBe('k');
});

test('a service error becomes an ArtProxyError with its status and message', async () => {
  const { fn } = fakeFetch({ ok: false, error: 'bad', status: 400 }, 400);
  const err = await generateImage({ prompt: 'x', quality: 'low' }, { fetch: fn }).catch((e) => e);
  expect(err).toBeInstanceOf(ArtProxyError);
  expect(err.status).toBe(400);
  expect(err.message).toContain('bad');
});

test('a missing ART_PROXY_URL fails without calling the network', async () => {
  delete process.env.ART_PROXY_URL;
  const { fn, calls } = fakeFetch(okBody);
  await expect(generateImage({ prompt: 'x', quality: 'low' }, { fetch: fn })).rejects.toBeInstanceOf(ArtProxyError);
  expect(calls).toHaveLength(0);
});

test('a response without image data is an ArtProxyError', async () => {
  const { fn } = fakeFetch({ ok: true, payload: { data: [] } });
  await expect(generateImage({ prompt: 'x', quality: 'low' }, { fetch: fn })).rejects.toBeInstanceOf(ArtProxyError);
});

test('a non-JSON response is an ArtProxyError', async () => {
  const fn = (async () => new Response('<html>gateway timeout</html>', { status: 504 })) as unknown as typeof fetch;
  const err = await generateImage({ prompt: 'x', quality: 'low' }, { fetch: fn }).catch((e) => e);
  expect(err).toBeInstanceOf(ArtProxyError);
  expect(err.status).toBe(504);
});
