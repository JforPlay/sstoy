/**
 * Performance monitoring and tracking utilities
 * Helps measure and optimize page performance
 */

interface PerformanceMark {
  label: string;
  start: number;
}

/**
 * Simple performance timer
 */
class PerformanceTimer {
  private label: string;
  private start: number;

  constructor(label: string) {
    this.label = label;
    this.start = performance.now();
  }

  /**
   * End the timer and log the duration
   */
  public end(): number {
    const duration = performance.now() - this.start;
    console.log(`[Perf] ${this.label}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  /**
   * Get current elapsed time without ending the timer
   */
  public elapsed(): number {
    return performance.now() - this.start;
  }
}

/**
 * Measure performance of an operation
 * @param label - Label for the operation
 * @returns Object with end() method to stop timing
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
 * Wrap an async operation with performance measurement
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
 * Wrap a sync operation with performance measurement
 */
export function withPerformanceSync<T>(label: string, operation: () => T): T {
  const timer = measurePerformance(label);
  try {
    return operation();
  } finally {
    timer.end();
  }
}

/**
 * Get Core Web Vitals metrics
 */
export function getWebVitals(): void {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) {
    console.warn('[Perf] Performance API not available');
    return;
  }

  // Log navigation timing
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (navigation) {
    console.group('[Perf] Navigation Timing');
    console.log(`DNS Lookup: ${(navigation.domainLookupEnd - navigation.domainLookupStart).toFixed(2)}ms`);
    console.log(`TCP Connection: ${(navigation.connectEnd - navigation.connectStart).toFixed(2)}ms`);
    console.log(`Request Time: ${(navigation.responseStart - navigation.requestStart).toFixed(2)}ms`);
    console.log(`Response Time: ${(navigation.responseEnd - navigation.responseStart).toFixed(2)}ms`);
    console.log(`DOM Processing: ${(navigation.domComplete - navigation.domInteractive).toFixed(2)}ms`);
    console.log(`DOM Content Loaded: ${(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart).toFixed(2)}ms`);
    console.log(`Total Load Time: ${(navigation.loadEventEnd - navigation.fetchStart).toFixed(2)}ms`);
    console.groupEnd();
  }

  // Log resource timing
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  if (resources.length > 0) {
    console.group('[Perf] Resource Timing Summary');

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
      console.log(`${type}: ${stats.count} resources, ${totalSizeKB}KB, avg ${avgDuration.toFixed(2)}ms`);
    });

    console.groupEnd();
  }

  // Log paint timing
  const paint = performance.getEntriesByType('paint');
  if (paint.length > 0) {
    console.group('[Perf] Paint Timing');
    paint.forEach((entry) => {
      console.log(`${entry.name}: ${entry.startTime.toFixed(2)}ms`);
    });
    console.groupEnd();
  }
}

/**
 * Log current memory usage (Chrome only)
 */
export function logMemoryUsage(): void {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    console.group('[Perf] Memory Usage');
    console.log(`Used: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total: ${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Limit: ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`);
    console.groupEnd();
  }
}

/**
 * Initialize performance monitoring
 * Call on page load to track key metrics
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
 * Create a performance observer for specific entry types
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
    console.warn('[Perf] Failed to create PerformanceObserver:', err);
    return null;
  }
}
