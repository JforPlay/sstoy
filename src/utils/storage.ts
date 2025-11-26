/**
 * LocalStorage Utilities
 * Provides type-safe localStorage operations with error handling
 */

/**
 * Save data to localStorage with automatic JSON serialization
 */
export function saveToLocalStorage<T>(key: string, data: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`[Storage] Error saving ${key}:`, error);
    return false;
  }
}

/**
 * Load data from localStorage with automatic JSON parsing
 */
export function loadFromLocalStorage<T>(key: string): T | null {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error(`[Storage] Error loading ${key}:`, error);
    return null;
  }
}

/**
 * Remove data from localStorage
 */
export function removeFromLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`[Storage] Error removing ${key}:`, error);
  }
}

/**
 * Check if a key exists in localStorage
 */
export function hasInLocalStorage(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch (error) {
    console.error(`[Storage] Error checking ${key}:`, error);
    return false;
  }
}
