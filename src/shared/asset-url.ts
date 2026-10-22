/** A build's data and models must not reuse a previous build's HTTP cache key. */
export function assetURL(path: string): string {
  const version = import.meta.env.VITE_ASSET_VERSION;
  if (!version || version === 'dev' || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(path)) return path;
  const hashIndex = path.indexOf('#');
  const base = hashIndex < 0 ? path : path.slice(0, hashIndex);
  const hash = hashIndex < 0 ? '' : path.slice(hashIndex);
  return `${base}${base.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}${hash}`;
}
