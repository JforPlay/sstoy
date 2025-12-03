/**
 * App Main Entry Point
 * Loads all modules for the character builder application
 */

// Import shared utilities first (auto-initializes)
import '../shared';
import { i18n } from '../i18n';
import { initGlobalHeader } from '../shared/ui-components';

// Import app modules
import * as appChar from '../modules/app-char';
import * as appDisc from '../modules/app-disc';
import * as appSummary from '../modules/app-summary';
import * as appPreset from '../modules/app-preset';
import * as appSaveLoad from '../modules/app-saveload';
import * as appDmgCalc from '../modules/app-dmgcalc';

// Initialize i18n and load modules
(async () => {
  try {
    // Ensure DOM is ready
    if (document.readyState === 'loading') {
      await new Promise<void>((resolve) => document.addEventListener('DOMContentLoaded', () => resolve()));
    }

    // 1. Initialize i18n
    await i18n.init();

    // 2. Initialize Global Header
    initGlobalHeader('app');

    // 3. Initialize Core Data (via app-char)
    // This loads GameData and ensures window.state is populated
    await appChar.init();

    // 4. Signal that Core Data is ready
    // This is for any legacy or external listeners
    const event = new CustomEvent('appDataLoaded');
    window.dispatchEvent(event);

    // 5. Initialize Dependent Modules
    // These modules might rely on GameData or window.state being ready
    appDisc.init();
    appSummary.init();
    appPreset.init();
    appDmgCalc.init();

    // 6. Initialize Save/Load System
    // Now safe to check for URL params and restore data
    appSaveLoad.init();

    console.log('[App] All modules loaded and initialized');
  } catch (error) {
    console.error('[App] Critical initialization error:', error);
  }
})();
