/**
 * Resources UI Disc Module
 *
 * Handles disc (record) resource calculator UI including disc selection, level configuration,
 * and resource summary rendering. Calculates required materials for disc advancement and
 * displays stamina estimates for farming materials.
 *
 * Key Features:
 * - Disc selection with element filtering and search
 * - Level range configuration (1-90) for discs
 * - Real-time resource calculation with owned material deduction
 * - Stamina and day estimates for farming disc materials
 * - Disc-specific advancement material groups
 *
 * @module modules/resources-ui-disc
 * @see {@link modules/resources-calc} For calculation logic
 * @see {@link modules/resources-state} For shared state management
 */

import { resourcesState, saveResourcesState, MATERIAL_GROUPS } from './resources-state';
import { calculateDiscResources, buildItemUsageIndex, calculateNetResourcesWithMerging, calculateStaminaEstimate, calculateTotalOwnedExp, isGroupedMaterial } from './resources-calc';
import { createResourceItemElement } from './resources-ui-common';
import { getDiscRarityInfo } from '../shared/game-data';
import { Modal, createResponsiveImage } from '../shared/ui-components';
import type { SelectedDisc, DiscPromote, TotalResources } from './resources-types';

// =============================================================================
// STATE
// =============================================================================

/** Modal instance for disc selection */
let discModal: Modal | null = null;

// =============================================================================
// DISC SELECTION GRID
// =============================================================================

/**
 * Renders the disc selection grid with filtering
 *
 * Displays available discs in a grid layout, applying active element and search filters.
 * Already selected discs are shown as disabled.
 */
export function renderDiscResourceGrid(): void{
  const grid = document.getElementById('disc-resource-grid');
  if (!grid) return;

  grid.innerHTML = '';

  let availableDiscs = Object.entries(resourcesState.discs)
    .filter(([id, disc]) => {
      if (!disc.Visible || !disc.Available) return false;

      const discIPData = resourcesState.discIP[id];
      const discNameKey = discIPData?.StoryName;
      const discName = discNameKey
        ? resourcesState.discIPNames[discNameKey] || discNameKey
        : window.i18n?.t('resources.discN');

      // Name Required
      return !!discName;
    })
    .sort((a, b) => parseInt(b[0]) - parseInt(a[0]));

  // Apply element filter
  if (resourcesState.currentElementFilter !== 'all') {
    availableDiscs = availableDiscs.filter(
      ([, disc]) => String(disc.EET) === resourcesState.currentElementFilter
    );
  }

  // Apply search filter
  if (resourcesState.currentSearchFilter) {
    const lower = resourcesState.currentSearchFilter.toLowerCase();
    availableDiscs = availableDiscs.filter(([id]) => {
      const discIPData = resourcesState.discIP[id];
      const discNameKey = discIPData?.StoryName;
      const discName = discNameKey
        ? resourcesState.discIPNames[discNameKey] || discNameKey
        : (window.i18n?.t('resources.discN') || '레코드 ${id}').replace('${id}', id.toString());
      
      return String(discName).toLowerCase().includes(lower);
    });
  }

  const fragment = document.createDocumentFragment();

  availableDiscs.forEach(([id, disc]) => {
    const discIPData = resourcesState.discIP[id];
    const discNameKey = discIPData?.StoryName;
    const discName = discNameKey
      ? resourcesState.discIPNames[discNameKey] || discNameKey
      : (window.i18n?.t('resources.discN') || '레코드 ${id}').replace('${id}', id.toString());

    const elementInfo = resourcesState.gameEnums.elementType?.[disc.EET];
    const elementIcon = elementInfo?.icon || '';
    const rarityInfo = getDiscRarityInfo(disc);

    const isSelected = resourcesState.selectedDiscs.some((d) => d.id === id);

    const discItem = document.createElement('div');
    discItem.className = `disc-item ${isSelected ? 'disabled' : ''}`;
    discItem.dataset.discId = id;
    discItem.dataset.name = discName;

    let discIconPath = '';
    if (disc.DiscBg) {
      const fileId = disc.DiscBg.split('/').pop();
      discIconPath = `assets/disc_icons/outfit_${fileId}.png`;
    }

    discItem.innerHTML = `
      <div class="disc-item-image ${rarityInfo.borderClass}">
        ${createResponsiveImage(discIconPath, `Disc ${id}`, 'disc-item-img')}
      </div>
      <div class="disc-item-info">
        <div class="disc-item-name">
          ${discName}
          ${elementIcon ? createResponsiveImage(elementIcon, 'Element', 'element-icon-inline') : ''}
        </div>
        <div class="disc-item-id">ID: ${id}</div>
      </div>
    `;

    if (!isSelected) {
      discItem.onclick = () => selectDisc(id, discName as string);
    }

    fragment.appendChild(discItem);
  });

  grid.appendChild(fragment);
}

/**
 * Opens the disc selection modal
 *
 * Resets filters, creates modal instance if needed, and opens the selection UI.
 * Automatically focuses the search input.
 */
export function openDiscResourceSelect(): void {
  if (!discModal) {
    discModal = new Modal('disc-resource-modal');
  }

  // Reset filters
  resourcesState.currentElementFilter = 'all';
  resourcesState.currentSearchFilter = '';

  const modalContainer = document.getElementById('disc-resource-modal');
  if (modalContainer) {
    modalContainer.querySelectorAll('.element-filter-btn').forEach((btn) => {
      btn.classList.remove('active');
    });
    modalContainer.querySelector('.element-filter-btn[data-element="all"]')?.classList.add('active');

    const searchInput = modalContainer.querySelector('#disc-resource-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
  }

  renderDiscResourceGrid();
  discModal.open();
}

/**
 * Filters disc selection grid by element type
 *
 * @param element - Element filter value ('all', '1'-'7')
 */
export function filterResourceDiscsByElement(element: string): void{
  resourcesState.currentElementFilter = element;

  const modalContainer = document.getElementById('disc-resource-modal');
  if (modalContainer) {
    modalContainer.querySelectorAll('.element-filter-btn').forEach((btn) => {
      btn.classList.remove('active');
    });
    modalContainer
      .querySelector(`.element-filter-btn[data-element="${element}"]`)
      ?.classList.add('active');
  }

  renderDiscResourceGrid();
}

/**
 * Closes the disc selection modal
 */
export function closeDiscResourceSelect(): void {
  document.getElementById('disc-resource-modal')?.classList.remove('active');
}

// =============================================================================
// DISC MANAGEMENT
// =============================================================================

/**
 * Adds a disc to the resource calculator
 *
 * Creates a new disc entry with default values (level 1->90).
 * Triggers resource calculation, updates UI, and closes modal.
 *
 * @param discId - Disc ID to add
 * @param name - Disc display name
 */
export function selectDisc(discId: string, name: string): void {
  const disc = resourcesState.discs[discId];
  const rarityInfo = getDiscRarityInfo(disc || null);

  resourcesState.selectedDiscs.push({
    id: discId,
    name: name,
    rarity: rarityInfo.stars,
    currentLevel: 1,
    targetLevel: 90,
    data: disc!,
  });

  calculateDiscResources(discId);
  buildItemUsageIndex();
  renderSelectedDiscsList();
  renderDiscResourceSummary();
  saveResourcesState();
  closeDiscResourceSelect();
}

/**
 * Updates disc level field
 *
 * Validates and clamps input to 1-90 range. Ensures currentLevel <= targetLevel.
 * Recalculates resources and updates UI.
 *
 * @param discId - Disc ID to update
 * @param field - Field name ('currentLevel' or 'targetLevel')
 * @param value - New value as string
 */
export function updateDiscLevel(discId: string, field: string, value: string): void {
  const disc = resourcesState.selectedDiscs.find((d) => d.id === discId);
  if (!disc) return;

  const newValue = Math.max(1, Math.min(90, parseInt(value) || 1));

  if (newValue !== parseInt(value)) {
    const adjustedTemplate = window.i18n?.t('resources.valueAdjustedTo') ?? 'Value adjusted to ${value}';
    const adjustedMessage = adjustedTemplate.replace('${value}', String(newValue));
    window.showToast?.(adjustedMessage, 'info');
  }

  (disc as unknown as Record<string, unknown>)[field] = newValue;

  if (field === 'currentLevel' && disc.currentLevel > disc.targetLevel) {
    disc.targetLevel = disc.currentLevel;
  } else if (field === 'targetLevel' && disc.targetLevel < disc.currentLevel) {
    disc.currentLevel = disc.targetLevel;
  }

  calculateDiscResources(discId);
  buildItemUsageIndex();
  renderSelectedDiscsList();
  renderDiscResourceSummary();
  saveResourcesState();
}

/**
 * Removes a disc from the resource calculator
 *
 * @param discId - Disc ID to remove
 */
export function removeDiscFromResources(discId: string): void {
  resourcesState.selectedDiscs = resourcesState.selectedDiscs.filter((d) => d.id !== discId);
  delete resourcesState.discResources[discId];

  buildItemUsageIndex();
  renderSelectedDiscsList();
  renderDiscResourceSummary();
  saveResourcesState();

  window.showToast?.(window.i18n?.t('resources.discRemoved') || '레코드가 제거되었습니다', 'info');
}

// =============================================================================
// DISC LIST RENDERING
// =============================================================================

/**
 * Renders the list of selected discs with level controls
 *
 * Displays each selected disc as a card with portrait, name, element icon,
 * rarity stars, level inputs, and remove button.
 */
export function renderSelectedDiscsList(): void {
  const container = document.getElementById('selected-discs-list');
  if (!container) return;

  if (resourcesState.selectedDiscs.length === 0) {
    container.innerHTML = `
      <div class="empty-selection-state">
        <div class="empty-icon"><i class="fa-regular fa-clipboard"></i></div>
        <p data-i18n="resources.selectDiscEmpty">${window.i18n?.t('resources.selectDiscEmpty')}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  resourcesState.selectedDiscs.forEach((disc) => {
    // Dynamic name lookup
    const discIPData = resourcesState.discIP[disc.id];
    const discNameKey = discIPData?.StoryName;
    const currentName = discNameKey
      ? resourcesState.discIPNames[discNameKey] || disc.name
      : disc.name;

    let discIconPath = '';
    if (disc.data.DiscBg) {
      const fileId = disc.data.DiscBg.split('/').pop();
      discIconPath = `assets/disc_icons/outfit_${fileId}.png`;
    }

    const elementInfo = resourcesState.gameEnums.elementType?.[disc.data.EET];
    const elementIcon = elementInfo?.icon || '';
    const elementName = elementInfo?.name || '';

    const card = document.createElement('div');
    card.className = 'character-resource-card';
    card.dataset.discId = disc.id;

    card.innerHTML = `
      <div class="character-resource-header">
        ${createResponsiveImage(discIconPath, `Disc ${disc.id}`, 'character-resource-avatar')}
        <div class="character-resource-info">
          <div class="character-resource-name" style="display: flex; align-items: center; gap: 8px;">
            <span>${currentName}</span>
            ${elementIcon ? createResponsiveImage(elementIcon, elementName, 'element-icon-inline') : ''}
            <span style="color: #f0c419;">${'⭐'.repeat(disc.rarity)}</span>
          </div>
          <div class="character-resource-levels">
            ID: ${disc.id}
          </div>
        </div>
        <div class="character-resource-actions">
          <button class="remove-resource-btn" type="button">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="character-level-controls">
        <div class="level-section">
          <div class="level-section-title">${(() => { const t = window.i18n?.t('resources.level'); return (t && t !== 'resources.level') ? t : '레벨'; })()}</div>
          <div class="level-input-row">
            <div class="level-input-group">
              <label class="level-input-label">${window.i18n?.t('resources.currentLevel')}</label>
              <input type="number"
                     class="level-input-field"
                     value="${disc.currentLevel}"
                     min="1"
                     max="90"
                     data-field="currentLevel">
            </div>
            <div class="level-input-group">
              <label class="level-input-label">${window.i18n?.t('resources.targetLevel')}</label>
              <input type="number"
                     class="level-input-field"
                     value="${disc.targetLevel}"
                     min="1"
                     max="90"
                     data-field="targetLevel">
            </div>
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
  });

  // Add event listeners
  container.querySelectorAll('.remove-resource-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest('.character-resource-card') as HTMLElement;
      if (card && card.dataset.discId) {
        removeDiscFromResources(card.dataset.discId);
      }
    });
  });

  container.querySelectorAll('input.level-input-field').forEach((input) => {
    input.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const card = target.closest('.character-resource-card') as HTMLElement;
      if (card && card.dataset.discId && target.dataset.field) {
        updateDiscLevel(card.dataset.discId, target.dataset.field, target.value);
      }
    });
  });
}

// =============================================================================
// DISC RESOURCE SUMMARY
// =============================================================================

/**
 * Renders the disc resource summary showing all required materials
 *
 * Displays disc advancement materials, experience books, and gold requirements.
 * Includes stamina and farming day estimates.
 */
export function renderDiscResourceSummary(): void {
  const container = document.getElementById('disc-resource-summary-content');
  if (!container) return;

  if (resourcesState.selectedDiscs.length === 0) {
    container.innerHTML = `
      <div class="empty-summary-state">
        <div class="empty-icon"><i class="fa-solid fa-chart-simple"></i></div>
        <p data-i18n="resources.noDiscSelected">선택된 레코드가 없습니다</p>
      </div>
    `;
    return;
  }

  const totalResources: TotalResources = {
    exp: 0,
    advanceItems: {},
    skillItems: {},
    discAdvanceItems: {},
    gold: 0,
    levelupGold: 0,
  };

  Object.values(resourcesState.discResources).forEach((resources) => {
    totalResources.exp += resources.exp;
    totalResources.gold += resources.gold;
    totalResources.levelupGold += resources.levelupGold || 0;

    Object.entries(resources.advanceItems || {}).forEach(([itemId, qty]) => {
      const numId = parseInt(itemId);
      if (!totalResources.discAdvanceItems) {
        totalResources.discAdvanceItems = {};
      }
      if (!totalResources.discAdvanceItems[numId]) {
        totalResources.discAdvanceItems[numId] = 0;
      }
      totalResources.discAdvanceItems[numId]! += qty;
    });
  });

  const netResources = calculateNetResourcesWithMerging(totalResources, resourcesState.ownedMaterials);

  container.innerHTML = '';

  if (Object.keys(netResources.discAdvanceItems || {}).length > 0) {
    const advanceEstimate = calculateStaminaEstimate(netResources.discAdvanceItems!, 'discAdvance');
    const advanceSection = document.createElement('div');
    advanceSection.className = 'resource-category';

    let estimateHTML = '';
    if (advanceEstimate) {
      estimateHTML = `
        <div class="stamina-estimate" title="남은 재료 기준">
          <span class="estimate-item"><i class="fa-solid fa-bolt"></i> ${advanceEstimate.estimatedStamina.toLocaleString()} ${(() => { const t = window.i18n?.t('resources.stamina'); return (t && t !== 'resources.stamina') ? t : '스태미나'; })()}</span>
          <span class="estimate-separator">|</span>
          <span class="estimate-item"><i class="fa-regular fa-calendar"></i> ${advanceEstimate.estimatedDays}${(() => { const t = window.i18n?.t('resources.day'); return (t && t !== 'resources.day') ? t : '일'; })()}</span>
        </div>
      `;
    }

    advanceSection.innerHTML = `
      <div class="resource-category-header">
        <div class="resource-category-title">${window.i18n?.t('resources.advanceItemsDisc')}</div>
        ${estimateHTML}
      </div>
      <div class="resource-items-container" id="disc-advance-items-container"></div>
    `;
    container.appendChild(advanceSection);
    renderDiscAdvanceItems(netResources.discAdvanceItems!, totalResources.discAdvanceItems!);
  }

  const totalRequiredGold = totalResources.gold + totalResources.levelupGold;
  const netGold = Math.max(0, totalRequiredGold - (resourcesState.ownedMaterials['1'] || 0));

  const grossExp = totalResources.exp;
  const totalOwnedExp = calculateTotalOwnedExp('disc');
  const netExp = Math.max(0, grossExp - totalOwnedExp);

  if (grossExp > 0 || netGold > 0) {
    const bottomSection = document.createElement('div');
    bottomSection.className = 'resource-bottom-section';
    container.appendChild(bottomSection);

    const bottomGrid = document.createElement('div');
    bottomGrid.className = 'resource-bottom-grid';
    bottomSection.appendChild(bottomGrid);

    if (grossExp > 0) {
      const expCard = document.createElement('div');
      expCard.className = 'resource-bottom-card';

      const getTrans = (key: string, fallback: string) => {
        const t = window.i18n?.t(key);
        return (t && t !== key) ? t : fallback;
      };
      const expSummaryContent = `
        <div>${getTrans('resources.totalRequired', '총 요구량')}: ${grossExp.toLocaleString()}</div>
        <div>${getTrans('resources.owned', '보유')}: ${totalOwnedExp.toLocaleString()}</div>
        <div class="net-exp">${getTrans('resources.netRequired', '남은 요구량')}: ${netExp.toLocaleString()}</div>
      `;

      const experienceTitle = getTrans('resources.experience', '경험치');
      expCard.innerHTML = `
        <div class="resource-category-title">${experienceTitle}</div>
        <div class="exp-content-row">
          <div class="resource-items-grid" id="disc-exp-items-grid"></div>
          <div class="exp-summary">${expSummaryContent}</div>
        </div>
      `;
      bottomGrid.appendChild(expCard);

      if (netExp > 0) {
        renderDiscExpItems(netExp);
      }
    }

    if (netGold > 0) {
      const goldCard = document.createElement('div');
      goldCard.className = 'resource-bottom-card';

      const title = document.createElement('div');
      title.className = 'resource-category-title';
      title.textContent = window.i18n?.t('resources.doraTotal') || '도라 (총합)';

      const grid = document.createElement('div');
      grid.className = 'resource-items-grid';

      const goldItem = resourcesState.items['1'];
      if (goldItem) {
        const goldElement = createResourceItemElement(
          goldItem,
          netGold,
          totalRequiredGold,
          resourcesState.ownedMaterials['1'] || 0,
          '1'
        );
        grid.appendChild(goldElement);
      }

      goldCard.appendChild(title);
      goldCard.appendChild(grid);
      bottomGrid.appendChild(goldCard);
    }
  }
}

// =============================================================================
// INTERNAL RENDERING HELPERS
// =============================================================================

/**
 * Renders disc advancement items organized by material groups
 *
 * @param netItems - Net quantity needed after subtracting owned materials
 * @param totalItems - Total quantity required
 */
function renderDiscAdvanceItems(
  netItems: Record<number, number>,
  totalItems: Record<number, number>
): void {
  const container = document.getElementById('disc-advance-items-container');
  if (!container) return;
  container.innerHTML = '';

  const discAdvanceGroups = MATERIAL_GROUPS.discAdvance || [];
  discAdvanceGroups.forEach((group) => {
    const hasItemInGroup = group.items.some((id) => (netItems[id] ?? 0) > 0);
    if (hasItemInGroup) {
      const groupRow = document.createElement('div');
      groupRow.className = 'resource-group-row';

      group.items.forEach((itemId) => {
        const item = resourcesState.items[itemId!];
        if (!item) return;

        const requiredQty = totalItems[itemId] || 0;
        if (requiredQty > 0) {
          const netQty = netItems[itemId] || 0;
          const ownedQty = resourcesState.ownedMaterials[itemId] || 0;
          const itemElement = createResourceItemElement(
            item,
            netQty,
            requiredQty,
            ownedQty,
            String(itemId)
          );
          groupRow.appendChild(itemElement);
        }
      });
      container.appendChild(groupRow);
    }
  });

  const ungroupedNetItems = Object.keys(netItems).filter(
    (id) => !isGroupedMaterial(id, 'discAdvance')
  );
  if (ungroupedNetItems.length > 0) {
    const ungroupedGrid = document.createElement('div');
    ungroupedGrid.className = 'resource-items-grid';
    ungroupedNetItems.forEach((itemId) => {
      const item = resourcesState.items[itemId];
      if (!item) return;

      const netQty = netItems[parseInt(itemId)] || 0;
      const requiredQty = totalItems[parseInt(itemId)] || 0;
      const ownedQty = resourcesState.ownedMaterials[itemId] || 0;
      const itemElement = createResourceItemElement(item, netQty, requiredQty, ownedQty, itemId);
      ungroupedGrid.appendChild(itemElement);
    });
    container.appendChild(ungroupedGrid);
  }
}

/**
 * Renders disc experience items breakdown
 *
 * Calculates optimal distribution of disc experience items.
 *
 * @param netExp - Net experience points needed
 */
function renderDiscExpItems(netExp: number): void {
  const grid = document.getElementById('disc-exp-items-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const expItems = Object.values(resourcesState.discItemExp).sort((a, b) => b.Exp - a.Exp);

  const requiredCounts: Record<number, number> = {};
  let remainingRequired = netExp;
  expItems.forEach((expItem) => {
    if (expItem && expItem.Exp > 0) {
      const count = Math.floor(remainingRequired / expItem.Exp);
      if (count > 0) {
        requiredCounts[expItem.ItemId] = (requiredCounts[expItem.ItemId] || 0) + count;
        remainingRequired -= count * expItem.Exp;
      }
    }
  });

  if (remainingRequired > 0 && expItems.length > 0) {
    const smallestBook = expItems[expItems.length - 1];
    if (smallestBook) {
      requiredCounts[smallestBook.ItemId] = (requiredCounts[smallestBook.ItemId] || 0) + 1;
    }
  }

  Object.keys(requiredCounts).forEach((itemId) => {
    const item = resourcesState.items[itemId];
    if (!item) return;

    const requiredCount = requiredCounts[parseInt(itemId)] || 0;

    const itemElement = createResourceItemElement(item, requiredCount, requiredCount, 0, itemId);
    grid.appendChild(itemElement);
  });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Clears all selected discs and resource data
 *
 * Prompts for confirmation, then resets all disc selections and calculated resources.
 */
export function clearAllDiscResources(): void {
  if (resourcesState.selectedDiscs.length === 0) {
    window.showToast?.(window.i18n?.t('resources.noDataToReset') || '초기화할 데이터가 없습니다', 'info');
    return;
  }

  if (confirm(window.i18n?.t('resources.confirmResetDiscs') || '모든 선택된 레코드와 계산된 자원을 초기화하시겠습니까?')) {
    resourcesState.selectedDiscs = [];
    resourcesState.discResources = {};

    buildItemUsageIndex();
    renderSelectedDiscsList();
    renderDiscResourceSummary();
    saveResourcesState();

    window.showToast?.(window.i18n?.t('resources.allDataReset') || '모든 데이터가 초기화되었습니다', 'success');
  }
}

/**
 * Opens the disc resource calculator help modal
 */
export function showDiscResourceHelp(): void {
  const modal = document.getElementById('disc-resource-help-modal');
  modal?.classList.add('active');
}

/**
 * Closes the disc resource calculator help modal
 */
export function closeDiscResourceHelp(): void {
  const modal = document.getElementById('disc-resource-help-modal');
  modal?.classList.remove('active');
}