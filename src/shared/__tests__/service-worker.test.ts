import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../../../public/sw.js', import.meta.url), 'utf8');
const base = 'https://example.test/sstoy/';

function worker(scope = base) {
  const stores = new Map<string, Map<string, Response>>();
  const handlers = new Map<string, (event: any) => void>();
  const fetch = vi.fn(async (_request: Request, _options?: RequestInit) => new Response('latest', { status: 200 }));
  const claim = vi.fn(async () => undefined);
  let storageError = false;
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    async open(name: string) {
      if (storageError) throw new Error('Storage unavailable');
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        keys: async () => [...store.keys()].map(url => new Request(url)),
        delete: async (request: Request) => store.delete(request.url),
        match: async (request: Request) => store.get(request.url)?.clone(),
        put: async (request: Request, response: Response) => { store.set(request.url, response.clone()); },
      };
    },
  };
  vm.runInNewContext(source, {
    self: { registration: { scope }, clients: { claim }, skipWaiting: async () => undefined, addEventListener: (name: string, callback: any) => handlers.set(name, callback) },
    caches, fetch, URL, console: { warn() {} },
  });
  return {
    stores, fetch, claim,
    failStorage() { storageError = true; },
    async activate() {
      let pending: Promise<unknown> | undefined;
      handlers.get('activate')!({ waitUntil(value: Promise<unknown>) { pending = value; } });
      await pending;
    },
    async request(path: string) {
      let response: Promise<Response> | undefined;
      const pending: Promise<unknown>[] = [];
      handlers.get('fetch')!({ request: new Request(new URL(path, scope)), respondWith(value: Promise<Response>) { response = value; }, waitUntil(value: Promise<unknown>) { pending.push(value); } });
      const result = await response;
      await Promise.all(pending);
      return result;
    },
    seed(cache: string, path: string, body = 'stale') {
      if (!stores.has(cache)) stores.set(cache, new Map());
      stores.get(cache)!.set(new URL(path, scope).href, new Response(body));
    },
  };
}

describe('site-wide service worker cache policy', () => {
  it.each(['lang/ko.json', 'data/Character.json', 'assets/housing/models/characters.json', 'assets/housing/models/16201.glb', 'assets/char/head_16201_S.png'])(
    'refreshes mutable %s on every ordinary reload', async path => {
      const app = worker();
      const name = path.endsWith('.json') ? 'sstoy-network-first-v3-data' : 'sstoy-network-first-v3-assets';
      app.seed(name, path);
      expect(await (await app.request(path))!.text()).toBe('latest');
      expect(await (await app.request(path))!.text()).toBe('latest');
      expect(app.fetch).toHaveBeenCalledTimes(2);
      expect(app.fetch.mock.calls[0]![1]).toEqual({ cache: 'no-cache' });
    },
  );
  it('keeps immutable hashed bundles cached', async () => {
    const app = worker();
    app.seed('sstoy-network-first-v3-static', 'assets/js/housing-abcdefgh.js', 'hashed');
    expect(await (await app.request('assets/js/housing-abcdefgh.js'))!.text()).toBe('hashed');
    expect(app.fetch).not.toHaveBeenCalled();
  });
  it('removes old app caches without touching unrelated storage', async () => {
    const app = worker();
    for (const name of ['data-v2.0.0', 'images-v2.0.0', 'static-v2.0.0', 'sstoy-network-first-v3-previous-data', 'other-app-cache']) app.seed(name, 'index.html');
    await app.activate();
    expect([...app.stores.keys()]).toEqual(['other-app-cache']);
    expect(app.claim).toHaveBeenCalled();
  });
  it('serves cached data only when offline', async () => {
    const app = worker(); app.seed('sstoy-network-first-v3-data', 'data/Character.json');
    app.fetch.mockRejectedValueOnce(new Error('offline'));
    expect(await (await app.request('data/Character.json'))!.text()).toBe('stale');
  });
  it('preserves another project in a legacy cache with a generic name', async () => {
    const app = worker();
    app.seed('data-v2.0.0', 'lang/ko.json');
    app.seed('data-v2.0.0', '/neighbor/data/example.json', 'unrelated');
    await app.activate();
    expect([...app.stores.get('data-v2.0.0')!.keys()]).toEqual(['https://example.test/neighbor/data/example.json']);
  });
  it('does not fail a network response when CacheStorage is unavailable', async () => {
    const app = worker(); app.failStorage();
    expect(await (await app.request('data/Character.json'))!.text()).toBe('latest');
  });
  it('does not replace a current 404 with stale data', async () => {
    const app = worker(); app.seed('sstoy-network-first-v3-data', 'data/Character.json');
    app.fetch.mockResolvedValueOnce(new Response('not found', { status: 404 }));
    expect((await app.request('data/Character.json'))!.status).toBe(404);
  });
  it('does not intercept localhost, external hosts or neighboring projects', async () => {
    expect(await worker('http://localhost:3000/').request('data/Character.json')).toBeUndefined();
    const app = worker();
    expect(await app.request('https://external.test/data/Character.json')).toBeUndefined();
    expect(await app.request('/other/data/Character.json')).toBeUndefined();
  });
});
