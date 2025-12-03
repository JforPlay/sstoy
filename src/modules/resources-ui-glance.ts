/**
 * Resources Module - Glance Tab UI
 */

import { resourcesState, MATERIAL_GROUPS } from './resources-state';
import type { CharacterData, Disc } from './resources-types';

let isGlanceTabRendered = false;

/**
 * Main function to render all content on the "Glance" tab
 * This function calls individual renderers for each matrix
 */
export function renderGlanceTabContent(): void {
  if (isGlanceTabRendered) {
    return;
  }

  const loader = document.getElementById('glance-loader');
  if (loader) loader.style.display = 'flex';

  try {
    renderAtAGlanceMatrix();
    renderCharacterBadgeMatrix();
    renderDiscAdvanceMatrix();

    isGlanceTabRendered = true;
  } catch (error) {
    console.error('Error rendering glance tab content:', error);
    const container = document.getElementById('glance-matrix-container');
    if (container) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      container.innerHTML = `<p>콘텐츠를 렌더링하는 중 오류가 발생했습니다: ${errorMsg}</p>`;
    }
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

/**
 * Render character material matrix (advancement vs skill materials)
 */
function renderAtAGlanceMatrix(): void {
  const container = document.getElementById('glance-matrix-container');
  if (!container) return;

  try {
    if (
      !resourcesState.characters ||
      !resourcesState.characterAdvance ||
      !resourcesState.characterSkillUpgrade
    ) {
      throw new Error(window.i18n?.t('resources.characterDataNotLoaded') || '필요한 캐릭터 데이터가 로드되지 않았습니다.');
    }

    const charMaterialMap = buildCharacterMaterialMap();
    const matrixHtml = generateMatrixHtml(charMaterialMap);
    container.innerHTML = matrixHtml;
    initGlanceMatrixInteractions();
  } catch (error) {
    console.error('Error rendering glance matrix:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    container.innerHTML = `<p>육성 재료 매트릭스 생성 중 오류: ${errorMsg}</p>`;
  }
}

interface CharacterMaterialMap {
  [charId: string]: {
    advanceGroups: Set<number>;
    skillGroups: Set<number>;
  };
}

function buildCharacterMaterialMap(): CharacterMaterialMap {
  const charMap: CharacterMaterialMap = {};
  const advanceGroupMap = new Map(MATERIAL_GROUPS.advance?.map((g, i) => [i, g.items]) || []);
  const skillGroupMap = new Map(MATERIAL_GROUPS.skill?.map((g, i) => [i, g.items]) || []);

  const findGroupIndex = (itemMap: Map<number, number[]>, itemId: number): number => {
    for (const [index, items] of itemMap.entries()) {
      if (items.includes(itemId)) return index;
    }
    return -1;
  };

  for (const charId in resourcesState.characters) {
    const character = resourcesState.characters[charId];
    if (!character || !character.Visible || !character.Available) continue;

    charMap[charId] = { advanceGroups: new Set(), skillGroups: new Set() };

    if (character.AdvanceGroup) {
      const advanceData = Object.values(resourcesState.characterAdvance).filter(
        (adv) => adv.Group === character.AdvanceGroup
      );
      for (const adv of advanceData) {
        for (let i = 1; i <= 4; i++) {
          const tid = adv[`Tid${i}`];
          if (tid) {
            const groupIndex = findGroupIndex(advanceGroupMap, tid as number);
            if (groupIndex !== -1) charMap[charId]!.advanceGroups.add(groupIndex);
          }
        }
      }
    }

    if (character.SkillsUpgradeGroup && character.SkillsUpgradeGroup.length > 0) {
      const skillUpgradeGroup = character.SkillsUpgradeGroup[0];
      const skillData = Object.values(resourcesState.characterSkillUpgrade).filter(
        (upg) => upg.Group === skillUpgradeGroup
      );
      for (const upg of skillData) {
        for (let i = 1; i <= 4; i++) {
          const tid = upg[`Tid${i}`];
          if (tid) {
            const groupIndex = findGroupIndex(skillGroupMap, tid as number);
            if (groupIndex !== -1) charMap[charId]!.skillGroups.add(groupIndex);
          }
        }
      }
    }
  }
  return charMap;
}

function generateMatrixHtml(charMaterialMap: CharacterMaterialMap): string {
  const advanceGroups = MATERIAL_GROUPS.advance || [];
  const skillGroups = MATERIAL_GROUPS.skill || [];

  let headerHtml = '<thead><tr><th></th>';
  skillGroups.forEach((group, skillIndex) => {
    const item = resourcesState.items[group.items[0]!];
    const itemName = item?.Title ? resourcesState.itemNames[item.Title as string] || '' : '';
    const iconPath = item?.Icon ? `assets/items/${item.Icon.split('/').pop()}.png` : '';
    headerHtml += `<th data-col-index="${skillIndex}"><div class="material-icon-wrapper" title="${itemName}">
                   <img src="${iconPath}" class="material-icon" loading="lazy" alt="${itemName}"></div></th>`;
  });
  headerHtml += '</tr></thead>';

  let bodyHtml = '<tbody>';
  advanceGroups.forEach((advGroup, advIndex) => {
    const item = resourcesState.items[advGroup.items[0]!];
    const itemName = item?.Title ? resourcesState.itemNames[item.Title as string] || '' : '';
    const iconPath = item?.Icon ? `assets/items/${item.Icon.split('/').pop()}.png` : '';
    bodyHtml += `<tr data-row-index="${advIndex}">`;
    bodyHtml += `<th data-row-index="${advIndex}"><div class="material-icon-wrapper" title="${itemName}">
                 <img src="${iconPath}" class="material-icon" loading="lazy" alt="${itemName}"></div></th>`;

    skillGroups.forEach((_, skillIndex) => {
      const matchingChars = Object.keys(charMaterialMap).filter(
        (charId) =>
          charMaterialMap[charId]!.advanceGroups.has(advIndex) &&
          charMaterialMap[charId]!.skillGroups.has(skillIndex)
      );
      bodyHtml += `<td data-col-index="${skillIndex}"><div class="char-portraits-grid">`;
      matchingChars.forEach((charId) => {
        const char = resourcesState.characters[charId];
        const charName = char?.Name
          ? resourcesState.characterNames[char.Name as string] || ''
          : '';
        bodyHtml += `<img src="assets/char/avg1_${charId}_002.png" class="char-portrait" loading="lazy" title="${charName}" onerror="this.src='assets/char/${charId}_icon.png'">`;
      });
      bodyHtml += '</div></td>';
    });
    bodyHtml += '</tr>';
  });
  bodyHtml += '</tbody>';

  return `<table id="glance-matrix">${headerHtml}${bodyHtml}</table>`;
}

function initGlanceMatrixInteractions(): void {
  initMatrixInteractions(document.getElementById('glance-matrix'));
}

/**
 * Initialize hover interactions for a matrix using event delegation
 */
function initMatrixInteractions(matrix: HTMLElement | null): void {
  if (!matrix) return;

  let highlightedCells: HTMLElement[] = [];

  const clearHighlights = (): void => {
    highlightedCells.forEach((cell) => {
      cell.classList.remove('highlight-col', 'highlight-row');
    });
    highlightedCells = [];
  };

  matrix.addEventListener('mouseover', (e) => {
    const target = e.target as HTMLElement;
    const header = target.closest('th[data-col-index], th[data-row-index]') as HTMLElement;
    if (!header) return;

    clearHighlights();

    const colIndex = header.dataset.colIndex;
    const rowIndex = header.dataset.rowIndex;

    if (colIndex !== undefined) {
      const cells = matrix.querySelectorAll(`[data-col-index="${colIndex}"]`);
      cells.forEach((cell) => {
        (cell as HTMLElement).classList.add('highlight-col');
        highlightedCells.push(cell as HTMLElement);
      });
    }
    if (rowIndex !== undefined) {
      const row = matrix.querySelector(`tr[data-row-index="${rowIndex}"]`);
      if (row) {
        const cells = row.querySelectorAll('td, th');
        cells.forEach((cell) => {
          (cell as HTMLElement).classList.add('highlight-row');
          highlightedCells.push(cell as HTMLElement);
        });
      }
    }
  });

  matrix.addEventListener('mouseleave', clearHighlights);
}

/**
 * Render character badge matrix
 */
function renderCharacterBadgeMatrix(): void {
  const container = document.getElementById('character-badge-matrix-container');
  if (!container) return;

  try {
    if (!resourcesState.characters || !resourcesState.charGem) {
      throw new Error(window.i18n?.t('resources.badgeDataNotLoaded') || '필요한 캐릭터 뱃지 데이터가 로드되지 않았습니다.');
    }

    const badgeMap = buildCharacterBadgeMap();
    const matrixHtml = generateCharacterBadgeMatrixHtml(badgeMap);

    container.innerHTML = matrixHtml;
    initMatrixInteractions(document.getElementById('character-badge-matrix'));
  } catch (error) {
    console.error('Error rendering character badge matrix:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    container.innerHTML = `<p>캐릭터 뱃지 매트릭스 생성 중 오류: ${errorMsg}</p>`;
  }
}

interface BadgeMapData {
  matrix: {
    70: Map<number, CharacterData[]>;
    80: Map<number, CharacterData[]>;
    90: Map<number, CharacterData[]>;
  };
  badgeItems: number[];
}

function buildCharacterBadgeMap(): BadgeMapData {
  const badgeMap = {
    70: new Map<number, CharacterData[]>(),
    80: new Map<number, CharacterData[]>(),
    90: new Map<number, CharacterData[]>(),
  };
  const allBadgeItems = new Set<number>();

  Object.values(resourcesState.characters).forEach((character) => {
    if (
      !character.Visible ||
      !character.Available ||
      !character.GemSlots ||
      character.GemSlots.length !== 3
    ) {
      return;
    }

    const levels = [70, 80, 90] as const;
    levels.forEach((level, index) => {
      const gemSlotId = character.GemSlots![index];
      const charGemData = resourcesState.charGem[gemSlotId!];

      if (charGemData && charGemData.GenerateCostTid) {
        const itemId = charGemData.GenerateCostTid as number;
        allBadgeItems.add(itemId);

        if (!badgeMap[level].has(itemId)) {
          badgeMap[level].set(itemId, []);
        }
        badgeMap[level].get(itemId)!.push(character);
      }
    });
  });

  return {
    matrix: badgeMap,
    badgeItems: Array.from(allBadgeItems).sort((a, b) => a - b),
  };
}

function generateCharacterBadgeMatrixHtml(badgeMapData: BadgeMapData): string {
  const { matrix, badgeItems } = badgeMapData;
  const levels = [70, 80, 90] as const;

  let headerHtml = '<thead><tr><th></th>';
  badgeItems.forEach((itemId, index) => {
    const item = resourcesState.items[itemId];
    const itemName = item?.Title
      ? resourcesState.itemNames[item.Title as string] || ''
      : `Item ${itemId}`;
    const iconPath = `assets/items/item_${itemId}.png`;
    headerHtml += `<th data-col-index="${index}"><div class="material-icon-wrapper" title="${itemName}">
                   <img src="${iconPath}" class="material-icon" loading="lazy" alt="${itemName}" onerror="this.style.display='none'">
                 </div></th>`;
  });
  headerHtml += '</tr></thead>';

  let bodyHtml = '<tbody>';
  levels.forEach((level, index) => {
    bodyHtml += `<tr data-row-index="${index}">`;
    bodyHtml += `<th data-row-index="${index}">${level} Lv</th>`;
    badgeItems.forEach((itemId, colIndex) => {
      bodyHtml += `<td data-col-index="${colIndex}"><div class="char-portraits-grid">`;
      const characters = matrix[level].get(itemId);
      if (characters) {
        characters.forEach((char) => {
          const charName = char.Name
            ? resourcesState.characterNames[char.Name as string] || ''
            : '';
          bodyHtml += `<img src="assets/char/avg1_${char.Id}_002.png" class="char-portrait" loading="lazy" title="${charName}" onerror="this.src='assets/char/${char.Id}_icon.png'">`;
        });
      }
      bodyHtml += '</div></td>';
    });
    bodyHtml += '</tr>';
  });
  bodyHtml += '</tbody>';

  return `<table class="glance-sub-matrix" id="character-badge-matrix">${headerHtml}${bodyHtml}</table>`;
}

/**
 * Render disc advancement matrix
 */
function renderDiscAdvanceMatrix(): void {
  const container = document.getElementById('disc-advance-matrix-container');
  if (!container) return;

  try {
    if (!resourcesState.discs || !resourcesState.discPromote || !resourcesState.gameEnums) {
      throw new Error(window.i18n?.t('resources.discDataNotLoaded') || '필요한 레코드 데이터가 로드되지 않았습니다.');
    }

    const discMap = buildDiscAdvanceMap();
    const matrixHtml = generateDiscAdvanceMatrixHtml(discMap);

    container.innerHTML = matrixHtml;
    initMatrixInteractions(document.getElementById('disc-advance-matrix'));
  } catch (error) {
    console.error('Error rendering disc advance matrix:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    container.innerHTML = `<p>레코드 승급 매트릭스 생성 중 오류: ${errorMsg}</p>`;
  }
}

function buildDiscAdvanceMap(): Map<number, Map<number, Disc[]>> {
  const discMap = new Map<number, Map<number, Disc[]>>();
  const materialGroupMap = new Map(MATERIAL_GROUPS.discAdvance?.map((g, i) => [i, g.items]) || []);

  const findGroupIndex = (itemId: number): number => {
    for (const [index, items] of materialGroupMap.entries()) {
      if (items.includes(itemId)) return index;
    }
    return -1;
  };

  for (const disc of Object.values(resourcesState.discs)) {
    if (!disc.Visible || !disc.Available || (disc.StrengthenGroupId as number) < 41) {
      continue;
    }

    const promoteGroupId = disc.PromoteGroupId as number;
    if (!promoteGroupId) {
      continue;
    }

    const eet = disc.EET as number;
    if (!discMap.has(eet)) {
      discMap.set(eet, new Map());
    }
    const elementMap = discMap.get(eet)!;

    for (let i = 1; i <= 8; i++) {
      const promoteId = `${promoteGroupId}${String(i).padStart(3, '0')}`;
      const promoteData = resourcesState.discPromote[promoteId];

      if (promoteData) {
        for (let j = 1; j <= 3; j++) {
          const itemId = promoteData[`ItemId${j}`];
          if (itemId) {
            const groupIndex = findGroupIndex(parseInt(String(itemId)));
            if (groupIndex !== -1) {
              if (!elementMap.has(groupIndex)) {
                elementMap.set(groupIndex, []);
              }
              const discsInGroup = elementMap.get(groupIndex)!;
              if (!discsInGroup.some((d) => d.Id === disc.Id)) {
                discsInGroup.push(disc);
              }
            }
          }
        }
      }
    }
  }

  return discMap;
}

function generateDiscAdvanceMatrixHtml(discMap: Map<number, Map<number, Disc[]>>): string {
  const materialGroups = MATERIAL_GROUPS.discAdvance || [];
  const gameEnums = resourcesState.gameEnums as unknown as {
    elementType: Record<string, { name: string; icon: string; id?: number }>;
  };
  const elementTypes = Object.entries(gameEnums.elementType)
    .map(([id, e]) => ({ ...e, id: parseInt(id) }))
    .filter((e) => e.id && e.id > 0 && e.id < 7);

  if (discMap.size === 0) {
    return `<div class="matrix-empty-state">
        <i class="fa-solid fa-compact-disc"></i>
        <p>5성 레코드 데이터를 불러올 수 없습니다.</p>
    </div>`;
  }

  let headerHtml = '<thead><tr><th></th>';
  materialGroups.forEach((group, index) => {
    const item = resourcesState.items[group.items[0]!];
    const itemName = item?.Title ? resourcesState.itemNames[item.Title as string] || '' : '';
    const iconPath = item?.Icon ? `assets/items/${item.Icon.split('/').pop()}.png` : '';
    headerHtml += `<th data-col-index="${index}"><div class="material-icon-wrapper" title="${itemName}">
                   <img src="${iconPath}" class="material-icon" loading="lazy" alt="${itemName}" onerror="this.style.display='none'">
                 </div></th>`;
  });
  headerHtml += '</tr></thead>';

  let bodyHtml = '<tbody>';
  let rowCount = 0;
  elementTypes.forEach((elementType, index) => {
    if (!discMap.has(elementType.id!)) return;

    rowCount++;
    bodyHtml += `<tr data-row-index="${index}">`;
    bodyHtml += `<th data-row-index="${index}"><img src="${elementType.icon}" class="element-icon" loading="lazy" title="${elementType.name}"></th>`;

    const elementDiscMap = discMap.get(elementType.id!);

    materialGroups.forEach((_, groupIndex) => {
      bodyHtml += `<td data-col-index="${groupIndex}"><div class="char-portraits-grid">`;
      const discs = elementDiscMap ? elementDiscMap.get(groupIndex) : null;
      if (discs && discs.length > 0) {
        discs.forEach((disc) => {
          const discIPData = resourcesState.discIP[disc.Id];
          const discNameKey = discIPData?.StoryName;
          const discName = discNameKey
            ? resourcesState.discIPNames[discNameKey as string] || `Disc ${disc.Id}`
            : `Disc ${disc.Id}`;
          const iconFile = disc.DiscBg ? String(disc.DiscBg).split('/').pop() : '';
          const iconPath = `assets/disc_icons/outfit_${iconFile}.png`;
          bodyHtml += `<img src="${iconPath}" class="char-portrait" loading="lazy" title="${discName}" onerror="this.style.display='none'">`;
        });
      }
      bodyHtml += '</div></td>';
    });
    bodyHtml += '</tr>';
  });
  bodyHtml += '</tbody>';

  if (rowCount === 0) {
    return `<div class="matrix-empty-state">
        <i class="fa-solid fa-compact-disc"></i>
        <p>표시할 5성 레코드가 없습니다.</p>
    </div>`;
  }

  return `<table class="glance-sub-matrix" id="disc-advance-matrix">${headerHtml}${bodyHtml}</table>`;
}
