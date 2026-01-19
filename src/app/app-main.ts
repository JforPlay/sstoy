/**
 * App Main Entry Point Module
 *
 * Main entry point for the character builder application. Orchestrates the loading
 * and initialization of all app modules in the correct sequence to ensure data
 * dependencies are satisfied.
 *
 * Key Features:
 * - Sequential module initialization with dependency management
 * - i18n system initialization
 * - Event-based communication between modules
 * - Global header navigation setup
 * - URL state restoration support
 *
 * @module app/app-main
 * @see {@link modules/app-char} Character builder module
 * @see {@link modules/app-disc} Disc system module
 * @see {@link i18n} Internationalization system
 */

// =============================================================================
// IMPORTS
// =============================================================================

// Import shared utilities first (auto-initializes)
import '../shared';
import { i18n } from '../i18n';
import { initGlobalHeader } from '../shared/ui-components';
import { initLanguageChangeListener } from '../shared/events';

// Import app modules
import * as appChar from '../modules/app-char';
import * as appDisc from '../modules/app-disc';
import * as appSummary from '../modules/app-summary';
import * as appPreset from '../modules/app-preset';
import * as appSaveLoad from '../modules/app-saveload';
import * as appDmgCalc from '../modules/dmgcalc';

// =============================================================================
// INITIALIZATION SEQUENCE
// =============================================================================

/**
 * Main initialization sequence
 *
 * Initializes all app modules in the correct order to satisfy dependencies:
 * 1. Wait for DOM ready
 * 2. Initialize i18n (load language files)
 * 3. Initialize language change listener (enables onLanguageChange handlers)
 * 4. Set up global navigation header
 * 5. Load core game data (Character, Item, GameEnums)
 * 6. Initialize dependent modules (disc, summary, preset, dmgcalc)
 * 7. Initialize save/load system (restore URL state if present)
 *
 * The initialization order is critical - later modules depend on earlier ones.
 * For example, disc system requires character data to be loaded first.
 *
 * @throws {Error} If any critical initialization step fails
 */
(async () => {
  try {
    // Ensure DOM is ready
    if (document.readyState === 'loading') {
      await new Promise<void>((resolve) => document.addEventListener('DOMContentLoaded', () => resolve()));
    }

    // 1. Initialize i18n
    await i18n.init();

    // 2. Initialize language change listener for centralized handler system
    initLanguageChangeListener();

    // 3. Initialize Global Header
    initGlobalHeader('app');

    // 4. Initialize Core Data (via app-char)
    // This loads GameData and ensures window.state is populated
    await appChar.init();

    // 5. Signal that Core Data is ready
    // This is for any legacy or external listeners
    const event = new CustomEvent('appDataLoaded');
    window.dispatchEvent(event);

    // 6. Initialize Dependent Modules
    // These modules might rely on GameData or window.state being ready
    await appDisc.init();
    appSummary.init();
    appPreset.init();
    appDmgCalc.init();

    // 7. Initialize Save/Load System
    // Now safe to check for URL params and restore data
    appSaveLoad.init();

    console.info('[AppMain] All modules loaded and initialized');
  } catch (error) {
    console.error('[AppMain] Critical initialization error:', error);
  }
})();
