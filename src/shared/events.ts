/**
 * @module shared/events
 * @description Event delegation and global event management utilities.
 *
 * Key Features:
 * - Centralized language change event handling
 * - Handler registration/unregistration system
 * - Consolidates duplicate event listeners across modules
 *
 * @see {@link onLanguageChange} - Register language change handler
 * @see {@link initLanguageChangeListener} - Initialize global listener
 *
 * @example
 * ```typescript
 * // Register a module to reload on language change
 * const unsubscribe = onLanguageChange(() => {
 *   console.info('[MyModule] Language changed, reloading...');
 *   await reloadModuleData();
 * });
 *
 * // Cleanup when module unmounts
 * unsubscribe();
 *
 * // Initialize once in main app
 * initLanguageChangeListener();
 * ```
 */

import { log } from './utils';

// =============================================================================
// LANGUAGE CHANGE HANDLERS
// =============================================================================

type LanguageChangeHandler = () => void | Promise<void>;
const languageChangeHandlers: LanguageChangeHandler[] = [];

/**
 * Register a handler to be called when language changes.
 *
 * Consolidates duplicate language change listeners across modules.
 * Returns an unsubscribe function for cleanup.
 *
 * @param {LanguageChangeHandler} handler - Function to call on language change
 * @returns {() => void} Unsubscribe function
 *
 * @example
 * ```typescript
 * // In a module
 * const unsubscribe = onLanguageChange(async () => {
 *   await loadLanguageSpecificData();
 *   render();
 * });
 *
 * // Cleanup
 * window.addEventListener('unload', unsubscribe);
 * ```
 */
export function onLanguageChange(handler: LanguageChangeHandler): () => void {
  languageChangeHandlers.push(handler);

  // Return unsubscribe function
  return () => {
    const index = languageChangeHandlers.indexOf(handler);
    if (index > -1) {
      languageChangeHandlers.splice(index, 1);
    }
  };
}

/**
 * Initialize global language change listener.
 *
 * Call once at app startup to enable language change events.
 * Notifies all registered handlers when 'languageChanged' event fires.
 *
 * @example
 * ```typescript
 * // In main app entry point
 * initLanguageChangeListener();
 * ```
 */
export function initLanguageChangeListener(): void {
  window.addEventListener('languageChanged', async () => {
    log('[Events] Language changed, notifying', languageChangeHandlers.length, 'handlers');
    await Promise.all(languageChangeHandlers.map((handler) => handler()));
  });
}
