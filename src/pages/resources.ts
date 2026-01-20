/**
 * Resources Page Module - Entry Point
 *
 * Material and stamina calculator for character and disc upgrades. Users select
 * characters/discs with target levels, and the calculator computes total required
 * resources, stamina costs, and provides acquisition recommendations.
 *
 * Key Features:
 * - Character resource calculation (level, limit break, skills, potentials, talents)
 * - Disc resource calculation (level, limit break, main skills)
 * - Aggregated resource summary with stamina cost estimates
 * - Owned materials tracking (localStorage persistence)
 * - Resource glance tab with visual insights
 * - Element-based filtering for characters and discs
 * - Search functionality with debouncing
 * - Modular architecture (separated state, data, calc, UI modules)
 *
 * Architecture:
 * - State management: resources-state.ts
 * - Data loading: resources-data.ts
 * - Calculation logic: resources-calc.ts
 * - UI rendering: resources-ui-*.ts (char, disc, glance, common)
 *
 * @module pages/resources
 * @see {@link modules/resources-state} For state management
 * @see {@link modules/resources-calc} For calculation algorithms
 */

// Import shared utilities (auto-initializes)
import '../shared';
import { i18n } from '../i18n';
import { initGlobalHeader, initInfoModal } from '../shared/ui-components';
import { debounce } from '../shared/index';

// Import modularized resources logic
import { resourcesState, loadResourcesStateFromStorage, saveResourcesState } from '../modules/resources-state';
import { loadResourcesData } from '../modules/resources-data';
import { buildItemUsageIndex, calculateCharacterResources, calculateDiscResources } from '../modules/resources-calc';
import {
  renderSelectedCharactersList,
  renderResourceSummary,
  renderCharacterResourceGrid,
  openCharacterResourceSelect,
  closeCharacterResourceSelect,
  clearAllResources,
  showResourceHelp,
  closeResourceHelp,
  filterResourceCharactersByElement
} from '../modules/resources-ui-char';
import {
  renderSelectedDiscsList,
  renderDiscResourceSummary,
  openDiscResourceSelect,
  closeDiscResourceSelect,
  clearAllDiscResources as clearDiscs, 
  showDiscResourceHelp as showDiscHelp, 
  closeDiscResourceHelp as closeDiscHelp,
  filterResourceDiscsByElement,
  renderDiscResourceGrid
} from '../modules/resources-ui-disc';
import { renderGlanceTabContent } from '../modules/resources-ui-glance';
import {
  switchResourceTab,
  showLoadingState,
  openMyMaterialsModal,
  closeMyMaterialsModal,
  updateOwnedMaterial
} from '../modules/resources-ui-common';

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initializes the resources page on DOM content loaded
 *
 * Flow:
 * 1. Initialize i18n and global header
 * 2. Load all resource data (characters, items, discs)
 * 3. Restore saved state from localStorage
 * 4. Recalculate resources for loaded characters/discs
 * 5. Render UI components
 * 6. Setup search input debouncing
 */
document.addEventListener('DOMContentLoaded', async () => {
  await i18n.init();
  initGlobalHeader('resources');
  initInfoModal();
  showLoadingState(true);

  try {
    await loadResourcesData();

    // Load saved state
    loadResourcesStateFromStorage((chars, discs) => {
      // Recalculate resources for all loaded characters
      chars.forEach(char => calculateCharacterResources(char.id));
      
      // Recalculate resources for all loaded discs
      discs.forEach(disc => calculateDiscResources(disc.id));

      buildItemUsageIndex();
      renderSelectedCharactersList();
      renderResourceSummary();
      renderSelectedDiscsList();
      renderDiscResourceSummary();
    });

    // Initial render if no state loaded (empty lists)
    if (resourcesState.selectedCharacters.length === 0 && resourcesState.selectedDiscs.length === 0) {
      renderSelectedCharactersList();
      renderResourceSummary();
      renderSelectedDiscsList();
      renderDiscResourceSummary();
    }

    // Setup search debounce
    const searchInput = document.getElementById('character-resource-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', debounce((e: Event) => {
        resourcesState.currentSearchFilter = (e.target as HTMLInputElement).value;
        renderCharacterResourceGrid();
      }, 300));
    }

    const discSearchInput = document.getElementById('disc-resource-search') as HTMLInputElement;
    if (discSearchInput) {
      discSearchInput.addEventListener('input', debounce((e: Event) => {
        resourcesState.currentSearchFilter = (e.target as HTMLInputElement).value;
        renderDiscResourceGrid();
      }, 300));
    }

  } catch (error) {
    console.error('[Resources] Failed to initialize resources page:', error);
    window.showToast?.('데이터 로드 중 오류가 발생했습니다.', 'error');
  } finally {
    showLoadingState(false);
  }
});

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * Handles language change events
 *
 * Reloads all resource data for new language, updates UI translations,
 * and re-renders all active components including open modals.
 */
window.addEventListener('languageChanged', async () => {
  try {
    showLoadingState(true);
    await loadResourcesData();
    window.i18n?.updatePage();
    
    // Re-render UI with new data
    renderSelectedCharactersList();
    renderResourceSummary();
    renderSelectedDiscsList();
    renderDiscResourceSummary();
    
    // Re-render selector grids if open
    const charModal = document.getElementById('character-resource-modal');
    if (charModal?.classList.contains('active')) {
      renderCharacterResourceGrid();
    }
    
    const discModal = document.getElementById('disc-resource-modal');
    if (discModal?.classList.contains('active')) {
      renderDiscResourceGrid();
    }
    
  } catch (error) {
    console.error('[Resources] Error handling language change:', error);
  } finally {
    showLoadingState(false);
  }
});

// =============================================================================
// GLOBAL EXPORTS (for HTML onclick handlers)
// =============================================================================

// Global exports for legacy HTML handlers
window.switchResourceTab = (tabName: string) => switchResourceTab(tabName, renderGlanceTabContent);
window.openCharacterResourceSelect = openCharacterResourceSelect;
window.closeCharacterResourceSelect = closeCharacterResourceSelect;
window.filterResourceCharactersByElement = filterResourceCharactersByElement;
window.openDiscResourceSelect = openDiscResourceSelect;
window.closeDiscResourceSelect = closeDiscResourceSelect;
window.filterResourceDiscsByElement = filterResourceDiscsByElement;
window.clearAllResources = clearAllResources;
window.clearAllDiscResources = clearDiscs;
window.showDiscResourceHelp = showDiscHelp;
window.closeDiscResourceHelp = closeDiscHelp;

window.showResourceHelp = showResourceHelp;
window.closeResourceHelp = closeResourceHelp;
window.openMyMaterialsModal = () => openMyMaterialsModal(() => {
    renderResourceSummary();
    renderDiscResourceSummary();
});
window.closeMyMaterialsModal = closeMyMaterialsModal;
window.updateOwnedMaterial = updateOwnedMaterial;

declare global {
  interface Window {
    switchResourceTab: (tabName: string) => void;
    openCharacterResourceSelect: typeof openCharacterResourceSelect;
    closeCharacterResourceSelect: typeof closeCharacterResourceSelect;
    filterResourceCharactersByElement: typeof filterResourceCharactersByElement;
    openDiscResourceSelect: typeof openDiscResourceSelect;
    closeDiscResourceSelect: typeof closeDiscResourceSelect;
    filterResourceDiscsByElement: typeof filterResourceDiscsByElement;
    clearAllResources: typeof clearAllResources;
    clearAllDiscResources: typeof clearDiscs;
    showResourceHelp: typeof showResourceHelp;
    closeResourceHelp: typeof closeResourceHelp;
    showDiscResourceHelp: typeof showDiscHelp;
    closeDiscResourceHelp: typeof closeDiscHelp;
    openMyMaterialsModal: () => void;
    closeMyMaterialsModal: typeof closeMyMaterialsModal;
    updateOwnedMaterial: typeof updateOwnedMaterial;
  }
}
