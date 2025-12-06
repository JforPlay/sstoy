/**
 * @module shared/performance
 * @description Performance monitoring and tracking utilities for measuring and optimizing application performance.
 *
 * Key Features:
 * - PerformanceTimer class for measuring operation durations
 * - Async/sync operation wrappers with automatic timing
 * - Core Web Vitals collection (DNS, TCP, DOM, paint metrics)
 * - Resource timing analysis by type
 * - Memory usage tracking (Chrome only)
 * - Performance observer support
 *
 * @see {@link measurePerformance} - Create a performance timer
 * @see {@link withPerformance} - Wrap async operations with timing
 * @see {@link getWebVitals} - Collect comprehensive performance metrics
 * @see {@link logMemoryUsage} - Track memory consumption
 *
 * @example
 * ```typescript
 * // Basic timing
 * const timer = measurePerformance('Data Load');
 * await loadData();
 * timer.end(); // Logs: [Performance] Data Load: 245.32ms
 *
 * // Async wrapper
 * const result = await withPerformance('API Call', () => fetchData());
 *
 * // Web vitals
 * getWebVitals(); // Logs DNS, TCP, DOM, paint, resource timing
 * logMemoryUsage(); // Logs heap usage (Chrome)
 * ```
 */

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface PerformanceMark {
  label: string;
  start: number;
}

// =============================================================================
// PERFORMANCE TIMER CLASS
// =============================================================================

/**
 * Simple performance timer for measuring operation durations.
 *
 * @class PerformanceTimer
 * @example
 * ```typescript
 * const timer = new PerformanceTimer('Data Load');
 * // ... perform operation
 * const duration = timer.end(); // Logs and returns duration
 * ```
 */
class PerformanceTimer {
  private label: string;
  private start: number;

  constructor(label: string) {
    this.label = label;
    this.start = performance.now();
  }

  /**
   * End the timer and log the duration.
   * @returns {number} Duration in milliseconds
   */
  public end(): number {
    const duration = performance.now() - this.start;
    console.info(`[Performance] ${this.label}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  /**
   * Get current elapsed time without ending the timer.
   * @returns {number} Elapsed time in milliseconds
   */
  public elapsed(): number {
    return performance.now() - this.start;
  }
}

// =============================================================================
// PERFORMANCE MEASUREMENT
// =============================================================================

/**
 * Measure performance of an operation.
 *
 * @param {string} label - Label for the operation
 * @returns {PerformanceTimer} Timer object with end() and elapsed() methods
 *
 * @example
 * ```typescript
 * const timer = measurePerformance('Complex Calculation');
 * // ... perform work
 * timer.end(); // Logs: [Performance] Complex Calculation: 123.45ms
 * ```
 */
export function measurePerformance(label: string): PerformanceTimer {
  if (typeof performance === 'undefined') {
    // Fallback for environments without performance API
    return {
      end: () => 0,
      elapsed: () => 0,
    } as PerformanceTimer;
  }

  return new PerformanceTimer(label);
}

/**
 * Wrap an async operation with automatic performance measurement.
 *
 * @template T - Return type of the operation
 * @param {string} label - Label for the operation
 * @param {() => Promise<T>} operation - Async operation to measure
 * @returns {Promise<T>} Result of the operation
 *
 * @example
 * ```typescript
 * const data = await withPerformance('Fetch API Data', async () => {
 *   const response = await fetch('/api/data');
 *   return response.json();
 * });
 * // Automatically logs timing when complete
 * ```
 */
export async function withPerformance<T>(
  label: string,
  operation: () => Promise<T>
): Promise<T> {
  const timer = measurePerformance(label);
  try {
    return await operation();
  } finally {
    timer.end();
  }
}

/**
 * Wrap a synchronous operation with automatic performance measurement.
 *
 * @template T - Return type of the operation
 * @param {string} label - Label for the operation
 * @param {() => T} operation - Sync operation to measure
 * @returns {T} Result of the operation
 *
 * @example
 * ```typescript
 * const result = withPerformanceSync('Heavy Calculation', () => {
 *   return complexMathOperation();
 * });
 * // Automatically logs timing when complete
 * ```
 */
export function withPerformanceSync<T>(label: string, operation: () => T): T {
  const timer = measurePerformance(label);
  try {
    return operation();
  } finally {
    timer.end();
  }
}

// =============================================================================
// WEB VITALS & METRICS
// =============================================================================

/**
 * Collect and log Core Web Vitals metrics.
 *
 * Logs comprehensive performance data including:
 * - Navigation timing (DNS, TCP, request/response, DOM processing)
 * - Resource timing summary grouped by type (scripts, stylesheets, images, etc.)
 * - Paint timing (first-paint, first-contentful-paint)
 *
 * @example
 * ```typescript
 * // Call after page load to see performance metrics
 * window.addEventListener('load', () => {
 *   setTimeout(getWebVitals, 0);
 * });
 * ```
 */
export function getWebVitals(): void {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) {
    console.warn('[Performance] Performance API not available');
    return;
  }

  // Log navigation timing
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (navigation) {
    console.group('[Performance] Navigation Timing');
    console.info(`DNS Lookup: ${(navigation.domainLookupEnd - navigation.domainLookupStart).toFixed(2)}ms`);
    console.info(`TCP Connection: ${(navigation.connectEnd - navigation.connectStart).toFixed(2)}ms`);
    console.info(`Request Time: ${(navigation.responseStart - navigation.requestStart).toFixed(2)}ms`);
    console.info(`Response Time: ${(navigation.responseEnd - navigation.responseStart).toFixed(2)}ms`);
    console.info(`DOM Processing: ${(navigation.domComplete - navigation.domInteractive).toFixed(2)}ms`);
    console.info(`DOM Content Loaded: ${(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart).toFixed(2)}ms`);
    console.info(`Total Load Time: ${(navigation.loadEventEnd - navigation.fetchStart).toFixed(2)}ms`);
    console.groupEnd();
  }

  // Log resource timing
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  if (resources.length > 0) {
    console.group('[Performance] Resource Timing Summary');

    const byType: Record<string, { count: number; totalSize: number; totalDuration: number }> = {};

    resources.forEach((resource) => {
      const type = resource.initiatorType || 'other';
      if (!byType[type]) {
        byType[type] = { count: 0, totalSize: 0, totalDuration: 0 };
      }

      byType[type].count++;
      byType[type].totalSize += resource.transferSize || 0;
      byType[type].totalDuration += resource.duration;
    });

    Object.entries(byType).forEach(([type, stats]) => {
      const avgDuration = stats.totalDuration / stats.count;
      const totalSizeKB = (stats.totalSize / 1024).toFixed(2);
      console.info(`${type}: ${stats.count} resources, ${totalSizeKB}KB, avg ${avgDuration.toFixed(2)}ms`);
    });

    console.groupEnd();
  }

  // Log paint timing
  const paint = performance.getEntriesByType('paint');
  if (paint.length > 0) {
    console.group('[Performance] Paint Timing');
    paint.forEach((entry) => {
      console.info(`${entry.name}: ${entry.startTime.toFixed(2)}ms`);
    });
    console.groupEnd();
  }
}

/**
 * Log current memory usage (Chrome only).
 *
 * Note: The memory API is non-standard and only available in Chrome/Chromium browsers.
 *
 * @example
 * ```typescript
 * logMemoryUsage();
 * // Logs:
 * // [Performance] Memory Usage
 * //   Used: 45.23 MB
 * //   Total: 60.00 MB
 * //   Limit: 2048.00 MB
 * ```
 */
export function logMemoryUsage(): void {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    console.group('[Performance] Memory Usage');
    console.info(`Used: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
    console.info(`Total: ${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
    console.info(`Limit: ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`);
    console.groupEnd();
  }
}

// =============================================================================
// INITIALIZATION & OBSERVERS
// =============================================================================

/**
 * Initialize performance monitoring on page load.
 *
 * Automatically logs web vitals and memory usage after the page finishes loading.
 * Call this function early in your application startup.
 *
 * @example
 * ```typescript
 * // In main entry point
 * initPerformanceMonitoring();
 * ```
 */
export function initPerformanceMonitoring(): void {
  if (typeof window === 'undefined') return;

  // Log web vitals after page load
  window.addEventListener('load', () => {
    // Use setTimeout to ensure all metrics are available
    setTimeout(() => {
      getWebVitals();
      logMemoryUsage();
    }, 0);
  });
}

/**
 * Create a performance observer for specific entry types.
 *
 * @param {string[]} entryTypes - Types to observe ('navigation', 'resource', 'paint', 'measure', etc.)
 * @param {(entries: PerformanceEntry[]) => void} callback - Called when entries are observed
 * @returns {PerformanceObserver | null} Observer instance or null if not supported
 *
 * @example
 * ```typescript
 * const observer = observePerformance(['measure'], (entries) => {
 *   entries.forEach(entry => {
 *     console.info(`${entry.name}: ${entry.duration}ms`);
 *   });
 * });
 * ```
 */
export function observePerformance(
  entryTypes: string[],
  callback: (entries: PerformanceEntry[]) => void
): PerformanceObserver | null {
  if (typeof PerformanceObserver === 'undefined') {
    return null;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      callback(list.getEntries());
    });

    observer.observe({ entryTypes });
    return observer;
  } catch (err) {
    console.warn('[Performance] Failed to create PerformanceObserver:', err);
    return null;
  }
}
