/**
 * Network Utilities Module
 * Caching and JSON fetching
 */

// =============================================================================
// JSON CACHING WITH MEMORY LIMITS
// =============================================================================

const jsonCache = new Map<string, unknown>();
const inFlight = new Map<string, Promise<unknown>>();

// Cache size tracking
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB limit
let currentCacheSize = 0;

/**
 * Estimate size of data in bytes
 */
function estimateSize(data: unknown): number {
  try {
    return JSON.stringify(data).length * 2; // Rough estimate (UTF-16)
  } catch {
    return 1024; // Default estimate if stringify fails
  }
}

/**
 * Evict oldest cache entries if needed
 */
function evictIfNeeded(newDataSize: number): void {
  if (currentCacheSize + newDataSize <= MAX_CACHE_SIZE) {
    return;
  }

  // Evict oldest entries until we have enough space
  const entriesToEvict: string[] = [];
  let freedSpace = 0;

  for (const key of jsonCache.keys()) {
    const data = jsonCache.get(key);
    const size = estimateSize(data);
    entriesToEvict.push(key);
    freedSpace += size;

    if (currentCacheSize - freedSpace + newDataSize <= MAX_CACHE_SIZE) {
      break;
    }
  }

  // Remove evicted entries
  entriesToEvict.forEach((key) => {
    const data = jsonCache.get(key);
    const size = estimateSize(data);
    jsonCache.delete(key);
    currentCacheSize -= size;
  });

  if (entriesToEvict.length > 0) {
    console.log(`[Cache] Evicted ${entriesToEvict.length} entries, freed ${(freedSpace / 1024 / 1024).toFixed(2)}MB`);
  }
}

/**
 * Fetch JSON with caching to prevent duplicate requests
 * Includes memory limit management
 */
export async function fetchJSON<T = unknown>(path: string): Promise<T> {
  if (jsonCache.has(path)) {
    return jsonCache.get(path) as T;
  }

  if (inFlight.has(path)) {
    return inFlight.get(path) as Promise<T>;
  }

  const promise = fetch(path)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();

      // Estimate size and evict if needed
      const dataSize = estimateSize(data);
      evictIfNeeded(dataSize);

      jsonCache.set(path, data);
      currentCacheSize += dataSize;
      inFlight.delete(path);
      return data as T;
    })
    .catch((err) => {
      inFlight.delete(path);
      throw err;
    });

  inFlight.set(path, promise);
  return promise;
}

/**
 * Clear JSON cache, optionally by prefix
 */
export function clearJSONCache(prefix = ''): void {
  if (!prefix) {
    jsonCache.clear();
    currentCacheSize = 0;
    return;
  }

  for (const key of jsonCache.keys()) {
    if (key.startsWith(prefix)) {
      const data = jsonCache.get(key);
      const size = estimateSize(data);
      jsonCache.delete(key);
      currentCacheSize -= size;
    }
  }
}

/**
 * Get current cache stats
 */
export function getCacheStats(): { size: number; entries: number; sizeMB: number } {
  return {
    size: currentCacheSize,
    entries: jsonCache.size,
    sizeMB: currentCacheSize / 1024 / 1024,
  };
}

// =============================================================================
// LRU CACHE
// =============================================================================

/**
 * Simple LRU Cache implementation
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    // Delete if exists (to update order)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
