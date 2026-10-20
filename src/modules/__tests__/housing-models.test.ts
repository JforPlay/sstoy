import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { loadHousingModel } from '../housing-models';

function model(textures: Array<THREE.Texture | null> = []): GLTF {
  return { scene: new THREE.Group(), parser: { getDependencies: vi.fn().mockResolvedValue(textures) } } as unknown as GLTF;
}
function texture(): THREE.DataTexture { return new THREE.DataTexture(new Uint8Array([100, 150, 80, 255]), 1, 1); }

describe('housing model texture loading', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { baseURI: 'https://example.test/sstoy/housing.html' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('retries a silently missing texture instead of caching a white model', async () => {
    const complete = model([texture()]);
    const parse = vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockResolvedValueOnce(model([null])).mockResolvedValueOnce(complete);
    expect(await loadHousingModel('test-texture-retry')).toBe(complete.scene);
    expect(parse).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await loadHousingModel('test-texture-retry')).toBe(complete.scene);
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it('rejects an undecoded image', async () => {
    vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockResolvedValue(model([new THREE.Texture()]));
    await expect(loadHousingModel('test-undecoded')).rejects.toThrow('Incomplete housing texture');
  });

  it('evicts a failed model so another attempt can succeed', async () => {
    const parse = vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockResolvedValue(model([null]));
    await expect(loadHousingModel('test-failed-cache')).rejects.toThrow();
    const complete = model([texture()]);
    parse.mockResolvedValue(complete);
    expect(await loadHousingModel('test-failed-cache')).toBe(complete.scene);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent model requests', async () => {
    vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockResolvedValue(model([texture()]));
    const first = loadHousingModel('test-deduplicate');
    expect(loadHousingModel('test-deduplicate')).toBe(first);
    await first;
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects outdoor ground without its baked texture even if no texture is declared', async () => {
    const incomplete = model();
    const terrain = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial());
    terrain.name = 'DormLevel_001_Out_01_Terrain01';
    incomplete.scene.add(terrain);
    vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockResolvedValue(incomplete);
    await expect(loadHousingModel('outdoor')).rejects.toThrow('ground texture');
  });

  it('accepts an outdoor scene with decoded ground texture', async () => {
    const map = texture(), complete = model([map]);
    const terrain = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map }));
    terrain.name = 'DormLevel_001_Out_01_Terrain01';
    complete.scene.add(terrain);
    vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockResolvedValue(complete);
    expect(await loadHousingModel('outdoor')).toBe(complete.scene);
  });
});
