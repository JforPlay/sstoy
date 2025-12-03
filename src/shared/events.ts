/**
 * Event Utilities Module
 * Global event handling (Language changes, etc.)
 */

import { log } from './utils';

// =============================================================================
// LANGUAGE CHANGE HANDLERS
// =============================================================================

type LanguageChangeHandler = () => void | Promise<void>;
const languageChangeHandlers: LanguageChangeHandler[] = [];

/**
 * Register a handler to be called when language changes
 * This consolidates the duplicate language change listeners across modules
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
 * Initialize language change listener (call once at app startup)
 */
export function initLanguageChangeListener(): void {
  window.addEventListener('languageChanged', async () => {
    log('[Shared] Language changed, notifying handlers');
    await Promise.all(languageChangeHandlers.map((handler) => handler()));
  });
}
