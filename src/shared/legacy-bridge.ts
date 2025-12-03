/**
 * Legacy Bridge Module
 * Exposes shared utilities to the global window object for backward compatibility
 */

import {
  fetchJSON,
  clearJSONCache
} from './network';

import {
  log,
  debounce
} from './utils';

import {
  showToast,
  showError,
  showWarning,
  showSuccess,
  showInfo,
  getIcon,
  toggleTheme,
  ICONS,
  createIconElement,
  createEmptyState,
  createLoadingState,
  initScrollToTop,
} from './ui';

import {
  parseElementTags,
  processDescriptionText,
  handleImageError,
  createOptimizedImage,
  createResponsiveImage,
  preloadImage,
  enableLazyLoadingInContainer
} from './dom';

import {
  initLanguageChangeListener
} from './events';

/**
 * Initialize shared utilities and expose to window for legacy compatibility
 */
export function initShared(): void {
  // Initialize language change listener
  initLanguageChangeListener();

  // Initialize scroll-to-top button
  initScrollToTop();

  // Expose to window for modules not yet migrated
  window.appUtils = {
    fetchJSONCached: fetchJSON,
    clearJSONCache,
    log,
    debounce: debounce as <T extends (...args: unknown[]) => unknown>(fn: T, wait?: number) => T,
  };

  // Expose functions for HTML onclick handlers and legacy code
  window.showToast = showToast;
  window.showError = showError;
  window.showWarning = showWarning;
  window.showSuccess = showSuccess;
  window.showInfo = showInfo;
  window.getIcon = getIcon;
  window.toggleTheme = toggleTheme;
  window.ICONS = ICONS;
  window.createIconElement = createIconElement;
  // window.generatePotentialIconHTML moved to ui-components
  window.parseElementTags = parseElementTags;
  window.processDescriptionText = processDescriptionText;
  window.handleImageError = handleImageError;
  window.createEmptyState = createEmptyState;
  window.createLoadingState = createLoadingState;
  window.createOptimizedImage = createOptimizedImage;
  window.createResponsiveImage = createResponsiveImage;
  window.preloadImage = preloadImage;
  window.enableLazyLoadingInContainer = enableLazyLoadingInContainer;

  log('[Shared] Utilities initialized');
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShared);
  } else {
    initShared();
  }
}
