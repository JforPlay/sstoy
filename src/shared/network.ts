/**
 * Network Utilities Module
 *
 * Provides efficient JSON fetching with automatic caching, request deduplication,
 * and memory management. Includes LRU cache implementation for parsed data.
 *
 * Key Features:
 * - Automatic request deduplication (prevents duplicate network calls)
 * - 50MB memory-aware cache with automatic eviction
 * - In-flight request tracking
 * - LRU cache for application-level caching
 *
 * @module shared/network
 * @see {@link shared/data-loader} For progressive data loading
 */

// =============================================================================
// JSON CACHING WITH MEMORY LIMITS
// =============================================================================

/** Cache storage for parsed JSON data */
const jsonCache = new Map<string, unknown>();

/** Tracking map for in-flight requests to prevent duplicates */
const inFlight = new Map<string, Promise<unknown>>();

/** Maximum cache size in bytes (50MB) */
const MAX_CACHE_SIZE = 50 * 1024 * 1024;

/** Current total size of cached data in bytes */
let currentCacheSize = 0;

/**
 * Estimates the memory size of data in bytes
 *
 * Uses JSON string length × 2 as approximation (UTF-16 characters are 2 bytes).
 * Falls back to 1KB estimate if serialization fails.
 *
 * @param data - Data to estimate size of
 * @returns Estimated size in bytes
 */
function estimateSize(data: unknown): number {
  try {
    return JSON.stringify(data).length * 2;
  } catch {
    return 1024;
  }
}

/**
 * Evicts oldest cache entries to make room for new data
 *
 * Implements FIFO eviction strategy, removing entries in insertion order
 * until enough space is available for the new data.
 *
 * @param newDataSize - Size in bytes of data to be cached
 */
function evictIfNeeded(newDataSize: number): void {
  if (currentCacheSize + newDataSize <= MAX_CACHE_SIZE) {
    return;
  }

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

  entriesToEvict.forEach((key) => {
    const data = jsonCache.get(key);
    const size = estimateSize(data);
    jsonCache.delete(key);
    currentCacheSize -= size;
  });

  if (entriesToEvict.length > 0) {
    console.info(`[Network] Evicted ${entriesToEvict.length} cache entries, freed ${(freedSpace / 1024 / 1024).toFixed(2)}MB`);
  }
}

/**
 * Fetches JSON data with automatic caching and request deduplication
 *
 * Features:
 * - Returns cached data if available (instant)
 * - Deduplicates concurrent requests to same URL
 * - Automatically manages cache memory (evicts when >50MB)
 * - Type-safe with generics
 *
 * @template T - Expected type of JSON data
 * @param path - URL or path to JSON file
 * @returns Promise resolving to parsed JSON data
 * @throws {Error} If fetch fails or response is not OK
 *
 * @example
 * ```typescript
 * const characters = await fetchJSON<CharacterData[]>('data/Character.json');
 * ```
 */
export async function fetchJSON<T = unknown>(path: string): Promise<T> {
  // Return cached data immediately
  if (jsonCache.has(path)) {
    return jsonCache.get(path) as T;
  }

  // Return existing promise if request already in flight
  if (inFlight.has(path)) {
    return inFlight.get(path) as Promise<T>;
  }

  const promise = fetch(path)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`[Network] Failed to fetch ${path}: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();

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
 * Clears JSON cache entries, optionally filtered by path prefix
 *
 * @param prefix - Optional path prefix to filter which entries to clear.
 *                 If empty, clears entire cache.
 *
 * @example
 * ```typescript
 * // Clear all cache
 * clearJSONCache();
 *
 * // Clear only data files
 * clearJSONCache('data/');
 * ```
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
 * Gets current cache statistics for debugging and monitoring
 *
 * @returns Object containing cache size, entry count, and size in MB
 *
 * @example
 * ```typescript
 * const stats = getCacheStats();
 * console.log(`Cache: ${stats.entries} entries, ${stats.sizeMB.toFixed(2)}MB`);
 * ```
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
 * Least Recently Used (LRU) Cache with automatic eviction
 *
 * Optimized implementation using Map's insertion order property.
 * Only updates entry position when necessary (not already most recent).
 *
 * Use Cases:
 * - Parsed description caching (param-parser)
 * - Frequently accessed computed values
 * - Session-specific data
 *
 * @template K - Key type
 * @template V - Value type
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<string, ParsedData>(500);
 * cache.set('key1', data);
 * const value = cache.get('key1'); // Returns data, marks as recently used
 * ```
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly maxSize: number;

  /**
   * Creates a new LRU cache with specified capacity
   *
   * @param maxSize - Maximum number of entries to store (default: 500)
   */
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.cache = new Map<K, V>();
  }

  /**
   * Retrieves value from cache and marks it as recently used
   *
   * Optimization: Only updates position if not already most recent entry.
   * This avoids unnecessary delete+reinsert operations.
   *
   * @param key - Cache key to retrieve
   * @returns Cached value or undefined if not found
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    const value = this.cache.get(key)!;

    // Only update position if not already most recent
    const keys = Array.from(this.cache.keys());
    if (keys[keys.length - 1] !== key) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }

    return value;
  }

  /**
   * Adds or updates cache entry
   *
   * Automatically evicts least recently used entry if cache is at capacity.
   *
   * @param key - Cache key
   * @param value - Value to cache
   */
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict least recently used (first entry)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, value);
  }

  /**
   * Checks if key exists in cache without updating access time
   *
   * @param key - Key to check
   * @returns True if key exists in cache
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Removes all entries from cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Gets current number of cached entries
   *
   * @returns Number of entries in cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Gets cache statistics for debugging and monitoring
   *
   * @returns Object with size, max size, and usage percentage
   *
   * @example
   * ```typescript
   * const stats = cache.getStats();
   * console.log(`Cache usage: ${stats.usage} (${stats.size}/${stats.maxSize})`);
   * ```
   */
  getStats(): { size: number; maxSize: number; usage: string } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      usage: `${((this.cache.size / this.maxSize) * 100).toFixed(1)}%`
    };
  }
}
