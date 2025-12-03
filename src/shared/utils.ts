/**
 * Shared Utilities Module
 * General helper functions and logging
 */

// =============================================================================
// DEBUG LOGGING
// =============================================================================

let debugEnabled = false;

export function setDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

export function log(...args: unknown[]): void {
  if (debugEnabled && typeof console !== 'undefined') {
    console.log(...args);
  }
}

// =============================================================================
// DEBOUNCE
// =============================================================================

/**
 * Debounce a function call
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait = 150
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>): void {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      fn(...args);
      timeout = null;
    }, wait);
  };
}
