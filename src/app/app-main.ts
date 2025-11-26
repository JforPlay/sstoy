/**
 * App Main Entry Point
 * Loads all modules for the character builder application
 */

// Import shared utilities first (auto-initializes)
import '@/shared';
import { i18n } from '@/i18n';

// Initialize i18n and load modules
(async () => {
  // Initialize i18n before loading modules
  await i18n.init();

  // Import app modules in order
  await import('@/modules/app-char');
  await import('@/modules/app-disc');
  await import('@/modules/app-summary');
  await import('@/modules/app-preset');
  await import('@/modules/app-saveload');
  await import('@/modules/app-dmgcalc');

  console.log('[App] All modules loaded');
})();
