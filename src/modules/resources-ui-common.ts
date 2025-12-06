/**
 * Resources UI Common Module
 *
 * Provides shared UI utilities for the resource calculator feature. Handles common
 * UI operations like loading states, tab switching, resource item rendering, and
 * material inventory management modal.
 *
 * Key Features:
 * - Centralized loading state management
 * - Tab navigation for resource calculator
 * - Resource item card rendering with character/disc usage indicators
 * - Material inventory modal for tracking owned resources
 *
 * @module modules/resources-ui-common
 * @see {@link modules/resources-ui-char} For character resource UI
 * @see {@link modules/resources-ui-disc} For disc resource UI
 */

import { resourcesState, saveResourcesState, MATERIAL_GROUPS } from './resources-state';
import type { Item, MaterialGroup } from './resources-types';
import { getCharactersUsingItem, getDiscsUsingItem } from './resources-calc';
import { Modal, createResponsiveImage } from '../shared/ui-components';

// =============================================================================
// STATE
// =============================================================================

/** Modal instance for material inventory management */
let myMaterialsModal: Modal | null = null;

// =============================================================================
// LOADING STATE
// =============================================================================

/**
 * Shows or hides loading overlay for resource calculator
 *
 * Creates a loading spinner overlay on first use and toggles visibility.
 * Used during async data loading operations.
 *
 * @param show - True to show loading overlay, false to hide
 */
export function showLoadingState(show: boolean): void {
  let loader = document.getElementById('resources-loader');
  if (!loader && show) {
    loader = document.createElement('div');
    loader.id = 'resources-loader';
    loader.className = 'loading-overlay';
    loader.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner-icon">
          <i class="fa-solid fa-spinner fa-spin"></i>
        </div>
        <p class="spinner-text">${window.i18n?.t('resources.loadingData') || '데이터를 불러오는 중...'}</p>
      </div>
    `;
    document.body.appendChild(loader);
  }

  if (loader) {
    loader.style.display = show ? 'flex' : 'none';
  }
}

// =============================================================================
// TAB NAVIGATION
// =============================================================================

/**
 * Switches between resource calculator tabs
 *
 * Updates active tab state in UI and triggers glance tab callback if applicable.
 * Manages tab button and content visibility.
 *
 * @param tabName - Tab identifier ('char', 'disc', 'glance')
 * @param onGlanceTab - Optional callback executed when glance tab is activated
 */
export function switchResourceTab(tabName: string, onGlanceTab?: () => void): void {
  document.querySelectorAll('.resources-tab-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
  document.querySelector(`.resources-tab-btn[data-tab="${tabName}"]`)?.classList.add('active');

  document.querySelectorAll('.resources-tab-content').forEach((content) => {
    content.classList.remove('active');
  });
  document.getElementById(`resources-tab-${tabName}`)?.classList.add('active');

  if (tabName === 'glance' && onGlanceTab) {
    onGlanceTab();
  }
}

// =============================================================================
// RESOURCE ITEM RENDERING
// =============================================================================

/**
 * Creates a resource item card element with usage indicators
 *
 * Renders a material item card showing quantity needed, with visual completion state
 * and character/disc usage icons. Displays up to 3 usage icons with overflow indicator.
 *
 * @param item - Item data from resources state
 * @param netQty - Remaining quantity needed (after subtracting owned)
 * @param requiredQty - Total quantity required
 * @param ownedQty - Currently owned quantity
 * @param itemId - Item identifier for usage lookup
 * @returns HTMLElement representing the resource item card
 *
 * @example
 * ```typescript
 * const itemCard = createResourceItemElement(
 *   itemData,
 *   50,   // Need 50 more
 *   100,  // Total needed 100
 *   50,   // Own 50
 *   '20071'
 * );
 * ```
 */
export function createResourceItemElement(
  item: Item,
  netQty: number,
  requiredQty: number,
  ownedQty: number,
  itemId: string
): HTMLElement {
  const itemName = resourcesState.itemNames[item.Title || ''] || item.Title || '';
  const rarity = item.Rarity || 1;
  const bgImage = `assets/items/rare_item_a_${6 - rarity}.png`;

  let iconPath = '';
  if (item.Icon) {
    iconPath = `assets/items/${item.Icon.split('/').pop()}.png`;
  } else if (itemId) {
    iconPath = `assets/items/item_${itemId}.png`;
  }

  const charactersUsing = itemId ? getCharactersUsingItem(itemId) : [];
  const discsUsing = itemId ? getDiscsUsingItem(itemId) : [];

  const div = document.createElement('div');
  div.className = 'resource-item';
  if (netQty <= 0 && requiredQty > 0) {
    div.classList.add('completed');
    div.title = (window.i18n?.t('resources.tooltipComplete') || '완료!\n필요: ${required}\n보유: ${owned}')
      .replace('${required}', requiredQty.toLocaleString())
      .replace('${owned}', ownedQty.toLocaleString());
  } else {
    div.title = (window.i18n?.t('resources.tooltipRequired') || '필요: ${required}\n보유: ${owned}')
      .replace('${required}', requiredQty.toLocaleString())
      .replace('${owned}', ownedQty.toLocaleString());
  }

  let characterIconsHTML = '';
  const totalIcons = charactersUsing.length + discsUsing.length;

  if (totalIcons > 0) {
    const maxVisible = 3;
    const visibleCharacters = charactersUsing.slice(0, Math.min(maxVisible, charactersUsing.length));
    const visibleDiscs = discsUsing.slice(0, Math.max(0, maxVisible - charactersUsing.length));
    const remaining = totalIcons - visibleCharacters.length - visibleDiscs.length;

    characterIconsHTML = `
      <div class="character-icons-overlay">
        ${visibleCharacters
          .map(
            (char) => `
          ${createResponsiveImage(`assets/char/avg1_${char.id}_002.png`, char.name, 'character-icon-small')}
        `
          )
          .join('')}
        ${visibleDiscs
          .map((disc) => {
            let discIconPath = '';
            if (disc.data.DiscBg) {
              const fileId = disc.data.DiscBg.split('/').pop();
              discIconPath = `assets/disc_icons/outfit_${fileId}.png`;
            }
            return `
            ${createResponsiveImage(discIconPath, disc.name, 'character-icon-small')}
          `;
          })
          .join('')}
        ${remaining > 0 ? `<div class="character-icons-more" title="${remaining}개 더">+${remaining}</div>` : ''}
      </div>
    `;
  }

  div.innerHTML = `
    <div class="resource-item-icon-wrapper">
      ${createResponsiveImage(bgImage, '', 'resource-item-bg')}
      ${createResponsiveImage(iconPath, itemName, 'resource-item-icon')}
      ${characterIconsHTML}
    </div>
    <div class="resource-item-name">${itemName}</div>
    <div class="resource-item-qty">×${netQty.toLocaleString()}</div>
  `;

  if (netQty <= 0) {
    div.style.display = 'none';
  }

  return div;
}

// =============================================================================
// MATERIAL INVENTORY MODAL
// =============================================================================

/**
 * Opens the material inventory modal
 *
 * Displays a modal allowing users to input their currently owned materials.
 * Materials are organized by category (character advance, disc advance, skill).
 * Creates modal instance on first use.
 */
export function openMyMaterialsModal(onCloseCallback?: () => void): void {
  if (!myMaterialsModal) {
    myMaterialsModal = new Modal('my-materials-modal');

    // Register onClose callback to update UI when modal closes (including clicking outside)
    if (onCloseCallback) {
      myMaterialsModal.onClose(onCloseCallback);
    }
  }

  const content = document.getElementById('my-materials-content');
  if (!content) return;

  content.innerHTML = '';
  const fragment = document.createDocumentFragment();

  const createMaterialInput = (itemId: string): string => {
    const item = resourcesState.items[itemId];
    if (!item) return '';
    const ownedQty = resourcesState.ownedMaterials[itemId] || 0;
    const itemName = resourcesState.itemNames[item.Title as string] || item.Title;
    const iconFile = item.Icon ? (item.Icon as string).split('/').pop() : '';
    const iconPath = `assets/items/${iconFile}.png`;
    const bgImage = `assets/items/rare_item_a_${6 - (item.Rarity || 1)}.png`;

    return `<div class="owned-material-item">
      <div class="resource-item-icon-wrapper">
        <img src="${bgImage}" class="resource-item-bg" alt="" loading="lazy" onerror="this.style.display='none'">
        <img src="${iconPath}" class="resource-item-icon" alt="${itemName}" loading="lazy" onerror="this.style.display='none'">
      </div>
      <div class="resource-item-name">${itemName}</div>
      <input type="number" class="owned-material-input" value="${ownedQty}" min="0" oninput="window.updateOwnedMaterial('${itemId}', this.value)" placeholder="0"/>
    </div>`;
  };

  const sections: Record<string, MaterialGroup[]> = {
    [window.i18n?.t('resources.advanceItemsCharacter') || 'Advance Items (Character)']: MATERIAL_GROUPS.advance || [],
    [window.i18n?.t('resources.advanceItemsDisc') || 'Advance Items (Disc)']: MATERIAL_GROUPS.discAdvance || [],
    [window.i18n?.t('resources.skillEnhanceItems') || 'Skill Enhancement Items']: MATERIAL_GROUPS.skill || [],
  };

  for (const [title, groups] of Object.entries(sections)) {
    const section = document.createElement('div');
    section.className = 'owned-material-section';
    const heading = document.createElement('h3');
    heading.textContent = title;
    section.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'owned-material-grid';

    groups.forEach((group) => {
      const groupRow = document.createElement('div');
      groupRow.className = 'owned-material-group-row';
      group.items.forEach((itemId) => {
        const div = document.createElement('div');
        div.innerHTML = createMaterialInput(String(itemId));
        groupRow.appendChild(div.firstElementChild as HTMLElement);
      });
      grid.appendChild(groupRow);
    });

    section.appendChild(grid);
    fragment.appendChild(section);
  }

  content.appendChild(fragment);
  myMaterialsModal.open();
}

/**
 * Closes the material inventory modal
 *
 * The registered onClose callback will automatically trigger re-render when modal closes.
 */
export function closeMyMaterialsModal(): void {
  if (myMaterialsModal) {
    myMaterialsModal.close();
  }
}

/**
 * Updates owned material quantity in state
 *
 * Removes material entry if quantity is 0 or invalid, otherwise updates the quantity.
 * Automatically saves state to localStorage.
 *
 * @param itemId - Material item identifier
 * @param quantity - String representation of quantity (parsed to integer)
 */
export function updateOwnedMaterial(itemId: string, quantity: string): void {
  const numQty = parseInt(quantity);
  if (isNaN(numQty) || numQty <= 0) {
    delete resourcesState.ownedMaterials[itemId];
  } else {
    resourcesState.ownedMaterials[itemId] = numQty;
  }
  saveResourcesState();
}
