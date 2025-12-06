/**
 * @module shared/utils
 * @description Core utility functions for debugging, timing, and formatting.
 *
 * Key Features:
 * - Debug logging with conditional output
 * - Debounce function for rate limiting
 * - Throttle function for performance optimization
 * - String formatting utilities
 * - Type guards and validation helpers
 *
 * @see {@link debounce} - Delay function execution until after wait period
 * @see {@link setDebug} - Enable/disable debug logging
 * @see {@link log} - Conditional debug logging
 *
 * @example
 * ```typescript
 * // Enable debug mode
 * setDebug(true);
 * log('Debug info:', { data: 123 }); // Logs only if debug enabled
 *
 * // Debounce search input
 * const debouncedSearch = debounce((query: string) => {
 *   performSearch(query);
 * }, 300);
 * ```
 */

// =============================================================================
// DEBUG LOGGING
// =============================================================================

let debugEnabled = false;

/**
 * Enable or disable debug logging.
 *
 * @param {boolean} enabled - Whether to enable debug logging
 *
 * @example
 * ```typescript
 * setDebug(true); // Enable debug mode
 * log('This will now appear'); // Logs
 *
 * setDebug(false); // Disable debug mode
 * log('This will not appear'); // No output
 * ```
 */
export function setDebug(enabled: boolean): void {
  debugEnabled = enabled;
  if (enabled) {
    console.info('[Utils] Debug mode enabled');
  }
}

/**
 * Conditional debug logging.
 *
 * Only logs if debug mode is enabled via setDebug(true).
 *
 * @param {...unknown[]} args - Arguments to log
 *
 * @example
 * ```typescript
 * setDebug(true);
 * log('User action:', action, data); // Only logs when debug enabled
 * ```
 */
export function log(...args: unknown[]): void {
  if (debugEnabled && typeof console !== 'undefined') {
    console.info('[Utils]', ...args);
  }
}

// =============================================================================
// TIMING UTILITIES
// =============================================================================

/**
 * Debounce a function call to delay execution until after wait period.
 *
 * Useful for expensive operations triggered by rapid events (e.g., search input, window resize).
 * The function will only execute after the specified wait time has passed with no new calls.
 *
 * @template T - Function type
 * @param {T} fn - Function to debounce
 * @param {number} [wait=150] - Milliseconds to wait before executing
 * @returns {(...args: Parameters<T>) => void} Debounced function
 *
 * @example
 * ```typescript
 * // Search input debouncing
 * const handleSearch = debounce((query: string) => {
 *   fetchSearchResults(query);
 * }, 300);
 *
 * input.addEventListener('input', (e) => {
 *   handleSearch(e.target.value); // Only fires 300ms after user stops typing
 * });
 * ```
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
