/**
 * Shared utilities module - consolidates duplicate code across all modules
 * Re-exports functionality from focused sub-modules.
 */

// Re-export everything from sub-modules
export * from './utils';
export * from './events';
export * from './dom';
export * from './network';
export * from './ui';

// Re-export legacy bridge (initialization)
export { initShared } from './legacy-bridge';

// =============================================================================
// RE-EXPORT UTILITY MODULES (Existing re-exports)
// =============================================================================

// Spinner utilities
export { showSpinner, showOverlaySpinner, createSpinnerHTML, withSpinner } from './spinner';

// Virtual scrolling
export { VirtualScroller, VirtualGrid } from './virtual-scroll';
export type { VirtualScrollConfig } from './virtual-scroll';

// Performance tracking
export { measurePerformance, withPerformance, withPerformanceSync, getWebVitals, logMemoryUsage, initPerformanceMonitoring, observePerformance } from './performance';

// Data loading
export { loadCoreData, loadFeatureData, loadLanguageData, preloadFeatureData, isFeatureLoaded, getAvailableFeatures } from './data-loader';