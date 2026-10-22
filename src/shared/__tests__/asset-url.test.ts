import { afterEach, describe, expect, it, vi } from 'vitest';
import { assetURL } from '../asset-url';

afterEach(() => vi.unstubAllEnvs());
describe('automatic deployment asset versions', () => {
  it('versions shared data, translations and model URLs', () => {
    vi.stubEnv('VITE_ASSET_VERSION', 'build-a');
    expect(assetURL('data/Character.json')).toBe('data/Character.json?v=build-a');
    expect(assetURL('/sstoy/lang/ko.json')).toBe('/sstoy/lang/ko.json?v=build-a');
    expect(assetURL('assets/housing/models/10301.glb')).toContain('?v=build-a');
  });
  it('preserves query strings and anchors', () => {
    vi.stubEnv('VITE_ASSET_VERSION', 'build-a');
    expect(assetURL('data/Character.json?x=1#part')).toBe('data/Character.json?x=1&v=build-a#part');
  });
  it('does not change development or external URLs', () => {
    vi.stubEnv('VITE_ASSET_VERSION', 'dev');
    expect(assetURL('data/Character.json')).toBe('data/Character.json');
    vi.stubEnv('VITE_ASSET_VERSION', 'build-a');
    expect(assetURL('https://external.test/data.json')).toBe('https://external.test/data.json');
    expect(assetURL('//external.test/data.json')).toBe('//external.test/data.json');
  });
});
