/**
 * Resources Module - Character Tab UI
 */

import { resourcesState, saveResourcesState, MATERIAL_GROUPS } from './resources-state';
import { calculateCharacterResources, buildItemUsageIndex, calculateNetResourcesWithMerging, calculateStaminaEstimate, calculateTotalOwnedExp, isGroupedMaterial } from './resources-calc';
import { createResourceItemElement } from './resources-ui-common';
import type { SelectedCharacter, TotalResources, CharacterData, CharacterAdvance } from './resources-types';

export function renderCharacterResourceGrid(): void {
  const grid = document.getElementById('character-resource-grid');
  if (!grid) return;

  grid.innerHTML = '';

  let availableCharacters = Object.entries(resourcesState.characters)
    .filter(([, char]) => char.Visible && char.Available)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

  // Apply element filter
  if (resourcesState.currentElementFilter !== 'all') {
    availableCharacters = availableCharacters.filter(
      ([, char]) => String(char.EET) === resourcesState.currentElementFilter
    );
  }

  // Apply search filter
  if (resourcesState.currentSearchFilter) {
    if (resourcesState.characterSelectorFuse) {
      // Use Fuse.js for fuzzy search
      const searchResults = resourcesState.characterSelectorFuse.search(resourcesState.currentSearchFilter);
      const matchedIds = new Set(searchResults.map((r: any) => r.item.id));
      availableCharacters = availableCharacters.filter(([id]) => matchedIds.has(id));
    } else {
      // Fallback to simple includes
      const lower = resourcesState.currentSearchFilter.toLowerCase();
      availableCharacters = availableCharacters.filter(([id, char]) => {
        const charName = resourcesState.characterNames[char.Name as string] || char.Name;
        return String(charName).toLowerCase().includes(lower);
      });
    }
  }

  const fragment = document.createDocumentFragment();

  availableCharacters.forEach(([id, char]) => {
    const isSelected = resourcesState.selectedCharacters.some((c) => c.id === id);

    const charItem = document.createElement('div');
    charItem.className = `character-selector-card ${isSelected ? 'disabled' : ''}`;
    charItem.dataset.characterId = id;

    const charName = resourcesState.characterNames[char.Name as string] || char.Name;

    // Get grade (rarity) as stars
    const gradeNum = Number(char.Grade) || 3;
    const gradeData = (resourcesState.gameEnums?.characterGrade as any)?.[gradeNum];
    const stars = gradeData?.stars ? '★'.repeat(gradeData.stars) : '★'.repeat(gradeNum);

    // Get element icon using EET (Element Enum Type)
    const elementId = char.EET;
    const elementIconPath = elementId ? `assets/icon_common_property_${elementId}.png` : '';

    charItem.innerHTML = `
      <div class="character-selector-img-wrapper">
        <img src="assets/char/avg1_${id}_002.png"
             alt="${charName}"
             class="character-selector-img"
             loading="lazy"
             onerror="this.style.display='none'">
        ${elementIconPath ? `<img src="${elementIconPath}" alt="Element" class="character-element-icon" loading="lazy" onerror="this.style.display='none'">` : ''}
      </div>
      <div class="character-selector-info">
        <div class="character-selector-name">${charName}</div>
        <div class="character-selector-grade">${stars}</div>
        ${isSelected ? `<div style="font-size: 0.65rem; color: var(--primary-color); font-weight: 600;">${window.i18n?.t('resources.selected') || 'Selected'}</div>` : ''}
      </div>
    `;

    if (!isSelected) {
        charItem.onclick = () => selectCharacterForResources(id);
    }

    fragment.appendChild(charItem);
  });

  grid.appendChild(fragment);
}

export function openCharacterResourceSelect(): void {
  const modal = document.getElementById('character-resource-modal');

  if (!modal) return;

  // Reset filters when opening
  resourcesState.currentElementFilter = 'all';
  resourcesState.currentSearchFilter = '';

  document.querySelectorAll('.element-filter-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
  document.querySelector('.element-filter-btn[data-element="all"]')?.classList.add('active');

  renderCharacterResourceGrid();
  modal.classList.add('active');

  // Focus and clear search input
  const searchInput = document.getElementById('character-resource-search') as HTMLInputElement;
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
}

export function closeCharacterResourceSelect(): void {
  document.getElementById('character-resource-modal')?.classList.remove('active');
}

export function selectCharacterForResources(characterId: string): void {
  const character = resourcesState.characters[characterId];
  if (!character) return;

  const charName = resourcesState.characterNames[character.Name as string] || character.Name;

  const selectedChar: SelectedCharacter = {
    id: characterId,
    name: charName as string,
    currentLevel: 1,
    targetLevel: 90,
    skillLevels: {
      normal: { current: 1, target: 10 },
      main: { current: 1, target: 10 },
      assist: { current: 1, target: 10 },
      ultimate: { current: 1, target: 10 },
    },
  };

  resourcesState.selectedCharacters.push(selectedChar);
  calculateCharacterResources(characterId);
  buildItemUsageIndex();
  closeCharacterResourceSelect();
  renderSelectedCharactersList();
  renderResourceSummary();
  saveResourcesState();

  const addedTemplate = window.i18n?.t('resources.added') ?? '${name} has been added';
  const addedMessage = addedTemplate.replace('${name}', charName as string);
  window.showToast?.(addedMessage, 'success');
}

export function updateCharacterLevel(characterId: string, field: string, value: string): void {
  const selectedChar = resourcesState.selectedCharacters.find((c) => c.id === characterId);
  if (!selectedChar) return;

  const numValue = parseInt(value) || 1;
  const clampedValue = Math.max(1, Math.min(90, numValue));

  if (clampedValue !== numValue) {
    const adjustedTemplate = window.i18n?.t('resources.valueAdjustedTo') ?? 'Value adjusted to ${value}';
    const adjustedMessage = adjustedTemplate.replace('${value}', String(clampedValue));
    window.showToast?.(adjustedMessage, 'info');
  }

  (selectedChar as unknown as Record<string, unknown>)[field] = clampedValue;

  calculateCharacterResources(characterId);
  buildItemUsageIndex();
  renderResourceSummary();
  saveResourcesState();
}

export function updateCharacterSkillLevel(
  characterId: string,
  skillType: 'normal' | 'main' | 'assist' | 'ultimate',
  field: 'current' | 'target',
  value: string
): void {
  const selectedChar = resourcesState.selectedCharacters.find((c) => c.id === characterId);
  if (!selectedChar) return;

  const numValue = parseInt(value) || 1;
  const clampedValue = Math.max(1, Math.min(10, numValue));

  if (clampedValue !== numValue) {
    const adjustedTemplate = window.i18n?.t('resources.valueAdjustedTo') ?? 'Value adjusted to ${value}';
    const adjustedMessage = adjustedTemplate.replace('${value}', String(clampedValue));
    window.showToast?.(adjustedMessage, 'info');
  }

  selectedChar.skillLevels[skillType][field] = clampedValue;

  calculateCharacterResources(characterId);
  buildItemUsageIndex();
  renderResourceSummary();
  saveResourcesState();
}

export function removeCharacterFromResources(characterId: string): void {
  resourcesState.selectedCharacters = resourcesState.selectedCharacters.filter(
    (c) => c.id !== characterId
  );
  delete resourcesState.characterResources[characterId];

  buildItemUsageIndex();
  renderSelectedCharactersList();
  renderResourceSummary();
  saveResourcesState();

  window.showToast?.(window.i18n?.t('resources.characterRemoved') || '캐릭터가 제거되었습니다', 'info');
}

export function renderSelectedCharactersList(): void {
  const container = document.getElementById('selected-characters-list');
  if (!container) return;

  if (resourcesState.selectedCharacters.length === 0) {
    container.innerHTML = `
      <div class="empty-selection-state">
        <div class="empty-icon">${window.getIcon?.('emptyClipboard') || ''}</div>
        <p data-i18n="resources.selectCharacterEmpty">${window.i18n?.t('resources.selectCharacterEmpty')}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  resourcesState.selectedCharacters.forEach((char) => {
    // Look up name dynamically for i18n support
    const currentName = resourcesState.characterNames[resourcesState.characters[char.id]?.Name as string] || char.name;

    const card = document.createElement('div');
    card.className = 'character-resource-card';
    card.dataset.characterId = char.id;
    card.innerHTML = `
      <div class="character-resource-header">
        <img src="assets/char/avg1_${char.id}_002.png"
             alt="${currentName}"
             class="character-resource-avatar"
             loading="lazy"
             onerror="this.src='assets/char/${char.id}_icon.png'">
        <div class="character-resource-info">
          <div class="character-resource-name">${currentName}</div>
        </div>
        <div class="character-resource-actions">
          <button class="remove-resource-btn" type="button">
            ${window.getIcon?.('remove') || ''} ${window.i18n?.t('resources.remove') || 'Remove'}
          </button>
        </div>
      </div>

      <div class="character-level-controls">
        <div class="level-section">
          <div class="level-section-title">${window.i18n?.t('resources.characterLevel')}</div>
          <div class="level-input-row">
            <div class="level-input-group">
              <label class="level-input-label">${window.i18n?.t('resources.current')}</label>
              <input type="number"
                     class="level-input-field"
                     value="${char.currentLevel}"
                     min="1"
                     max="90"
                     data-level-type="character"
                     data-field="currentLevel">
            </div>
            <div class="level-input-group">
              <label class="level-input-label">${window.i18n?.t('resources.target')}</label>
              <input type="number"
                     class="level-input-field"
                     value="${char.targetLevel}"
                     min="1"
                     max="90"
                     data-level-type="character"
                     data-field="targetLevel">
            </div>
          </div>
        </div>

        <div class="level-section">
          <div class="level-section-title">${window.i18n?.t('resources.skillLevel')}</div>
          <div class="skill-level-grid">
            ${['normal', 'main', 'assist', 'ultimate']
              .map(
                (skillType) => `
              <div class="skill-level-item">
                <div class="skill-level-name">${(() => {
                  const key = `resources.skill${skillType.charAt(0).toUpperCase() + skillType.slice(1)}`;
                  const fallbacks: Record<string, string> = { normal: '일반', main: '메인', assist: '지원', ultimate: '필살기' };
                  const translated = window.i18n?.t(key);
                  return (translated && translated !== key) ? translated : fallbacks[skillType as keyof typeof fallbacks];
                })()}</div>
                <div class="skill-level-inputs">
                  <input type="number"
                         class="level-input-field compact"
                         value="${char.skillLevels[skillType as keyof typeof char.skillLevels].current}"
                         min="1"
                         max="10"
                         data-level-type="skill"
                         data-skill-type="${skillType}"
                         data-field="current">
                  <span>→</span>
                  <input type="number"
                         class="level-input-field compact"
                         value="${char.skillLevels[skillType as keyof typeof char.skillLevels].target}"
                         min="1"
                         max="10"
                         data-level-type="skill"
                         data-skill-type="${skillType}"
                         data-field="target">
                </div>
              </div>
            `
              )
              .join('')}
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
      if (card && card.dataset.characterId) {
        removeCharacterFromResources(card.dataset.characterId);
      }
    });
  });

  container.querySelectorAll('input[data-level-type="character"]').forEach((input) => {
    input.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const card = target.closest('.character-resource-card') as HTMLElement;
      if (card && card.dataset.characterId && target.dataset.field) {
        updateCharacterLevel(card.dataset.characterId, target.dataset.field, target.value);
      }
    });
  });

  container.querySelectorAll('input[data-level-type="skill"]').forEach((input) => {
    input.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const card = target.closest('.character-resource-card') as HTMLElement;
      if (card && card.dataset.characterId && target.dataset.skillType && target.dataset.field) {
        updateCharacterSkillLevel(
          card.dataset.characterId,
          target.dataset.skillType as 'normal' | 'main' | 'assist' | 'ultimate',
          target.dataset.field as 'current' | 'target',
          target.value
        );
      }
    });
  });
}

export function renderResourceSummary(): void {
  const container = document.getElementById('resource-summary-content');
  if (!container) return;

  if (resourcesState.selectedCharacters.length === 0) {
    container.innerHTML = `
      <div class="empty-summary-state">
        <div class="empty-icon"><i class="fa-solid fa-chart-simple"></i></div>
        <p data-i18n="resources.noCharacterSelected">선택된 여행가가 없습니다</p>
      </div>
    `;
    return;
  }

  const totalResources: TotalResources = {
    exp: 0,
    advanceItems: {},
    skillItems: {},
    gold: 0,
    levelupGold: 0,
  };

  Object.values(resourcesState.characterResources).forEach((resources) => {
    totalResources.exp += resources.exp;
    totalResources.gold += resources.gold;
    totalResources.levelupGold += resources.levelupGold || 0;

    Object.entries(resources.advanceItems || {}).forEach(([itemId, qty]) => {
      const numId = parseInt(itemId);
      if (!totalResources.advanceItems[numId]) {
        totalResources.advanceItems[numId] = 0;
      }
      totalResources.advanceItems[numId]! += qty;
    });

    Object.entries(resources.skillItems).forEach(([itemId, qty]) => {
      const numId = parseInt(itemId);
      if (!totalResources.skillItems[numId]) {
        totalResources.skillItems[numId] = 0;
      }
      totalResources.skillItems[numId]! += qty;
    });
  });

  const netResources = calculateNetResourcesWithMerging(totalResources, resourcesState.ownedMaterials);

  container.innerHTML = '';

  if (Object.keys(netResources.advanceItems).length > 0) {
    const advanceEstimate = calculateStaminaEstimate(netResources.advanceItems, 'advance');
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
        <div class="resource-category-title">${window.i18n?.t('resources.advanceItemsCharacter')}</div>
        ${estimateHTML}
      </div>
      <div class="resource-items-container" id="advance-items-container"></div>
    `;
    container.appendChild(advanceSection);
    renderAdvanceItems(netResources.advanceItems, totalResources.advanceItems);
  }

  if (Object.keys(netResources.skillItems).length > 0) {
    const skillEstimate = calculateStaminaEstimate(netResources.skillItems, 'skill');
    const skillSection = document.createElement('div');
    skillSection.className = 'resource-category';

    let estimateHTML = '';
    if (skillEstimate) {
      estimateHTML = `
        <div class="stamina-estimate" title="남은 재료 기준">
          <span class="estimate-item"><i class="fa-solid fa-bolt"></i> ${skillEstimate.estimatedStamina.toLocaleString()} ${(() => { const t = window.i18n?.t('resources.stamina'); return (t && t !== 'resources.stamina') ? t : '스태미나'; })()}</span>
          <span class="estimate-separator">|</span>
          <span class="estimate-item"><i class="fa-regular fa-calendar"></i> ${skillEstimate.estimatedDays}${(() => { const t = window.i18n?.t('resources.day'); return (t && t !== 'resources.day') ? t : '일'; })()}</span>
        </div>
      `;
    }

    skillSection.innerHTML = `
      <div class="resource-category-header">
        <div class="resource-category-title">${window.i18n?.t('resources.skillEnhanceItems')}</div>
        ${estimateHTML}
      </div>
      <div class="resource-items-container" id="skill-items-container"></div>
    `;
    container.appendChild(skillSection);
    renderSkillItems(netResources.skillItems, totalResources.skillItems);
  }

  const totalRequiredGold = totalResources.gold + totalResources.levelupGold;
  const netGold = Math.max(0, totalRequiredGold - (resourcesState.ownedMaterials['1'] || 0));

  const grossExp = totalResources.exp;
  const totalOwnedExp = calculateTotalOwnedExp('character');
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

      expCard.innerHTML = `
        <div class="resource-category-title">${window.i18n?.t('resources.experience')}</div>
        <div class="exp-content-row">
          <div class="resource-items-grid" id="exp-items-grid"></div>
          <div class="exp-summary">${expSummaryContent}</div>
        </div>
      `;
      bottomGrid.appendChild(expCard);

      if (netExp > 0) {
        renderExpItems(netExp);
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

  renderBadgeRequirements();
}

function renderAdvanceItems(
  netItems: Record<number, number>,
  totalItems: Record<number, number>
): void {
  const container = document.getElementById('advance-items-container');
  if (!container) return;
  container.innerHTML = '';

  const advanceGroups = MATERIAL_GROUPS.advance || [];
  advanceGroups.forEach((group) => {
    const hasItemInGroup = group.items.some((id) => (netItems[id] ?? 0) > 0);
    if (hasItemInGroup) {
      const groupRow = document.createElement('div');
      groupRow.className = 'resource-group-row';

      group.items.forEach((itemId) => {
        const item = resourcesState.items[itemId!];
        if (!item) return;

        const netQty = netItems[itemId] || 0;
        const requiredQty = totalItems[itemId] || 0;
        const ownedQty = resourcesState.ownedMaterials[itemId] || 0;

        if (requiredQty > 0) {
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
    (id) => !isGroupedMaterial(id, 'advance')
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

function renderSkillItems(
  netItems: Record<number, number>,
  totalItems: Record<number, number>
): void {
  const container = document.getElementById('skill-items-container');
  if (!container) return;
  container.innerHTML = '';

  const skillGroups = MATERIAL_GROUPS.skill || [];
  skillGroups.forEach((group) => {
    const hasItemInGroup = group.items.some((id) => (netItems[id] ?? 0) > 0);
    if (hasItemInGroup) {
      const groupRow = document.createElement('div');
      groupRow.className = 'resource-group-row';
      group.items.forEach((itemId) => {
        const item = resourcesState.items[itemId];
        if (!item) return;

        const netQty = netItems[itemId] || 0;
        const requiredQty = totalItems[itemId] || 0;
        const ownedQty = resourcesState.ownedMaterials[itemId] || 0;

        if (requiredQty > 0) {
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

  const ungroupedNetItems = Object.keys(netItems).filter((id) => !isGroupedMaterial(id, 'skill'));
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

function renderExpItems(netExp: number): void {
  const grid = document.getElementById('exp-items-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const expItems = Object.values(resourcesState.charItemExp).sort(
    (a, b) => b.ExpValue - a.ExpValue
  );

  const requiredCounts: Record<number, number> = {};
  let remainingRequired = netExp;
  expItems.forEach((expItem) => {
    const count = Math.floor(remainingRequired / expItem.ExpValue);
    if (count > 0) {
      requiredCounts[expItem.ItemId] = (requiredCounts[expItem.ItemId] || 0) + count;
      remainingRequired -= count * expItem.ExpValue;
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

function renderBadgeRequirements(): void {
  const container = document.getElementById('resource-summary-content');
  if (!container || resourcesState.selectedCharacters.length === 0) return;

  const badgesByLevel: Record<number, Array<{ itemId: number; characters: CharacterData[] }>> = {
    70: [],
    80: [],
    90: [],
  };

  resourcesState.selectedCharacters.forEach((charData) => {
    const character = resourcesState.characters[charData.id];

    if (!character || !character.GemSlots || character.GemSlots.length !== 3) {
      return;
    }

    const targetLevel = charData.targetLevel;
    const levels = [70, 80, 90];

    levels.forEach((level, index) => {
      if (targetLevel >= level) {
        const gemSlots = character.GemSlots;
        if (!gemSlots || !gemSlots[index]) return;
        const gemSlotId = gemSlots[index]!;
        const charGemData = resourcesState.charGem[gemSlotId];

        if (charGemData && charGemData.GenerateCostTid) {
          const itemId = charGemData.GenerateCostTid;
          if (!badgesByLevel[level]) {
            badgesByLevel[level] = [];
          }
          let badgeEntry = badgesByLevel[level]!.find((b) => b.itemId === itemId);

          if (!badgeEntry) {
            badgeEntry = {
              itemId: itemId,
              characters: [],
            };
            badgesByLevel[level]!.push(badgeEntry);
          }
          if (!badgeEntry.characters.some((c) => c.Id === character.Id)) {
            badgeEntry.characters.push(character as CharacterData);
          }
        }
      }
    });
  });

  const hasBadges = Object.values(badgesByLevel).some((badges) => badges.length > 0);
  if (!hasBadges) return;

  const badgeSection = document.createElement('div');
  badgeSection.className = 'resource-category badge-requirements-section';
  const badgeTitle = (() => { const t = window.i18n?.t('resources.badgeRequirements'); return (t && t !== 'resources.badgeRequirements') ? t : '뱃지 요구사항'; })();
  badgeSection.innerHTML = `
    <div class="resource-category-header">
      <div class="resource-category-title">${badgeTitle}</div>
    </div>
    <div class="badge-requirements-container">
      <div class="badge-columns">
        <div class="badge-column">
          <div class="badge-column-title">70 Lv</div>
          <div class="badge-items" id="badge-70"></div>
        </div>
        <div class="badge-column">
          <div class="badge-column-title">80 Lv</div>
          <div class="badge-items" id="badge-80"></div>
        </div>
        <div class="badge-column">
          <div class="badge-column-title">90 Lv</div>
          <div class="badge-items" id="badge-90"></div>
        </div>
      </div>
    </div>
  `;
  container.appendChild(badgeSection);

  [70, 80, 90].forEach((level) => {
    const badgeContainer = document.getElementById(`badge-${level}`);
    if (!badgeContainer) return;

    badgesByLevel[level]?.forEach((badgeData) => {
      const badgeElement = document.createElement('div');
      badgeElement.className = 'badge-item';

      const characterIconsHTML = badgeData.characters
        .map(
          (character) => `
        <div class="badge-character-icon">
          <img src="assets/char/avg1_${character.Id}_002.png" alt="${resourcesState.characterNames[character.Name as string] || character.Name}" loading="lazy" onerror="this.style.display='none'">
        </div>
      `
        )
        .join('');

      badgeElement.innerHTML = `
        <div class="badge-item-background">
          <img src="assets/items/rare_item_a_3.png" alt="Badge Background" loading="lazy" onerror="this.style.display='none'">
        </div>
        <div class="badge-item-icon">
          <img src="assets/items/item_${badgeData.itemId}.png" alt="Badge Item" loading="lazy" onerror="this.style.display='none'">
        </div>
        <div class="badge-character-icons-container">
          ${characterIconsHTML}
        </div>
      `;
      badgeContainer.appendChild(badgeElement);
    });
  });
}

export function filterResourceCharactersByElement(element: string): void {
  resourcesState.currentElementFilter = element;

  // Update button states
  document.querySelectorAll('.element-filter-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
  document
    .querySelector(`.element-filter-btn[data-element="${element}"]`)
    ?.classList.add('active');

  // Re-render the grid
  renderCharacterResourceGrid();
}

export function clearAllResources(): void {
  if (resourcesState.selectedCharacters.length === 0) {
    window.showToast?.(window.i18n?.t('resources.noDataToReset') || '초기화할 데이터가 없습니다', 'info');
    return;
  }

  if (confirm(window.i18n?.t('resources.confirmResetCharacters') || '모든 선택된 여행가와 계산된 자원을 초기화하시겠습니까?')) {
    resourcesState.selectedCharacters = [];
    resourcesState.characterResources = {};

    buildItemUsageIndex();
    renderSelectedCharactersList();
    renderResourceSummary();
    saveResourcesState();

    window.showToast?.(window.i18n?.t('resources.allDataReset') || '모든 데이터가 초기화되었습니다', 'success');
  }
}

export function showResourceHelp(): void {
  const modal = document.getElementById('resource-help-modal');
  modal?.classList.add('active');
}

export function closeResourceHelp(): void {
  const modal = document.getElementById('resource-help-modal');
  modal?.classList.remove('active');
}
