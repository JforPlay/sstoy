/**
 * Resources UI Glance Module
 *
 * Provides "at-a-glance" matrix views showing material requirements across characters and discs.
 * Displays interactive matrices that help users quickly see which characters/discs need which materials.
 *
 * Key Features:
 * - Character material matrix (advancement vs skill materials)
 * - Character badge matrix (badges required by level milestone)
 * - Combined 5-star character + disc advancement matrix (organized by element and material type)
 * - Combined 4-star character + disc advancement matrix
 * - Interactive hover highlighting for rows/columns
 * - Lazy rendering (only renders once per session)
 *
 * @module modules/resources-ui-glance
 * @see {@link modules/resources-state} For shared state and material groups
 */

import { resourcesState, MATERIAL_GROUPS } from './resources-state';
import type { CharacterData, Disc } from './resources-types';
import { createResponsiveImage } from '../shared';

// =============================================================================
// STATE
// =============================================================================

/** Track whether glance tab has been rendered to avoid re-rendering */
let isGlanceTabRendered = false;

// =============================================================================
// MAIN RENDER FUNCTION
// =============================================================================

/**
 * Main function to render all content on the "Glance" tab
 *
 * Renders four matrices:
 * 1. Combined 5-star character + disc advancement matrix
 * 2. Combined 4-star character + disc advancement matrix
 * 3. Character material matrix (advance vs skill)
 * 4. Character badge matrix
 *
 * Only renders once per session (lazy loading).
 */
export function renderGlanceTabContent(): void {
  if (isGlanceTabRendered) {
    return;
  }

  const loader = document.getElementById('glance-loader');
  if (loader) loader.style.display = 'flex';

  try {
    renderCombinedAdvanceMatrix();
    renderCombinedAdvanceMatrix4Star();
    renderAtAGlanceMatrix();
    renderCharacterBadgeMatrix();

    isGlanceTabRendered = true;
  } catch (error) {
    console.error('[ResourcesGlance] Error rendering glance tab content:', error);
    const container = document.getElementById('glance-matrix-container');
    if (container) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      container.innerHTML = `<p>콘텐츠를 렌더링하는 중 오류가 발생했습니다: ${errorMsg}</p>`;
    }
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

// =============================================================================
// CHARACTER MATERIAL MATRIX
// =============================================================================

/**
 * Renders character material matrix (advancement vs skill materials)
 *
 * Creates a matrix showing which characters use which material combinations.
 * Rows: Advancement material groups
 * Columns: Skill material groups
 * Cells: Character portraits that use both materials
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
    console.error('[ResourcesGlance] Error rendering character material matrix:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    container.innerHTML = `<p>육성 재료 매트릭스 생성 중 오류: ${errorMsg}</p>`;
  }
}

/**
 * Maps character IDs to their required material group indices
 */
interface CharacterMaterialMap {
  [charId: string]: {
    advanceGroups: Set<number>;
    skillGroups: Set<number>;
  };
}

/**
 * Builds a map of characters to their required material groups
 *
 * Analyzes each character's advancement and skill upgrade data to determine
 * which material groups they require.
 *
 * @returns Map of character IDs to material group sets
 */
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

/**
 * Generates HTML for character material matrix table
 *
 * @param charMaterialMap - Map of characters to material groups
 * @returns HTML string for the matrix table
 */
function generateMatrixHtml(charMaterialMap: CharacterMaterialMap): string {
  const advanceGroups = MATERIAL_GROUPS.advance || [];
  const skillGroups = MATERIAL_GROUPS.skill || [];

  let headerHtml = '<thead><tr><th></th>';
  skillGroups.forEach((group, skillIndex) => {
    const item = resourcesState.items[group.items[0]!];
    const itemName = item?.Title ? resourcesState.itemNames[item.Title as string] || '' : '';
    const iconPath = item?.Icon ? `assets/items/${item.Icon.split('/').pop()}.png` : '';
    headerHtml += `<th data-col-index="${skillIndex}"><div class="material-icon-wrapper" title="${itemName}">
                   ${createResponsiveImage(iconPath, itemName, 'material-icon')}</div></th>`;
  });
  headerHtml += '</tr></thead>';

  let bodyHtml = '<tbody>';
  advanceGroups.forEach((advGroup, advIndex) => {
    const item = resourcesState.items[advGroup.items[0]!];
    const itemName = item?.Title ? resourcesState.itemNames[item.Title as string] || '' : '';
    const iconPath = item?.Icon ? `assets/items/${item.Icon.split('/').pop()}.png` : '';
    bodyHtml += `<tr data-row-index="${advIndex}">`;
    bodyHtml += `<th data-row-index="${advIndex}"><div class="material-icon-wrapper" title="${itemName}">
                 ${createResponsiveImage(iconPath, itemName, 'material-icon')}</div></th>`;

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
        bodyHtml += createResponsiveImage(`assets/char/avg1_${charId}_002.png`, charName, 'char-portrait');
      });
      bodyHtml += '</div></td>';
    });
    bodyHtml += '</tr>';
  });
  bodyHtml += '</tbody>';

  return `<table id="glance-matrix">${headerHtml}${bodyHtml}</table>`;
}

/**
 * Initializes interactions for the main character material matrix
 */
function initGlanceMatrixInteractions(): void {
  initMatrixInteractions(document.getElementById('glance-matrix'));
}

// =============================================================================
// MATRIX INTERACTION SYSTEM
// =============================================================================

/**
 * Initializes hover interactions for a matrix using event delegation
 *
 * Highlights entire rows/columns when hovering over header cells.
 * Uses event delegation for performance with large matrices.
 *
 * @param matrix - Matrix table element to attach interactions to
 */
function initMatrixInteractions(matrix: HTMLElement | null): void{
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

// =============================================================================
// CHARACTER BADGE MATRIX
// =============================================================================

/**
 * Renders character badge matrix
 *
 * Shows badges required for each character at level 70/80/90 milestones.
 * Rows: Level milestones (70, 80, 90)
 * Columns: Badge item types
 * Cells: Character portraits requiring that badge at that level
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
    console.error('[ResourcesGlance] Error rendering character badge matrix:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    container.innerHTML = `<p>캐릭터 뱃지 매트릭스 생성 중 오류: ${errorMsg}</p>`;
  }
}

/**
 * Badge matrix data structure
 */
interface BadgeMapData {
  matrix: {
    70: Map<number, CharacterData[]>;
    80: Map<number, CharacterData[]>;
    90: Map<number, CharacterData[]>;
  };
  badgeItems: number[];
}

/**
 * Builds a map of badge requirements by level milestone
 *
 * @returns Badge map data with matrices and item list
 */
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

/**
 * Generates HTML for character badge matrix table
 *
 * @param badgeMapData - Badge map data
 * @returns HTML string for the matrix table
 */
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
                   ${createResponsiveImage(iconPath, itemName, 'material-icon')}
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
          bodyHtml += createResponsiveImage(`assets/char/avg1_${char.Id}_002.png`, charName, 'char-portrait');
        });
      }
      bodyHtml += '</div></td>';
    });
    bodyHtml += '</tr>';
  });
  bodyHtml += '</tbody>';

  return `<table class="glance-sub-matrix" id="character-badge-matrix">${headerHtml}${bodyHtml}</table>`;
}

// =============================================================================
// COMBINED ADVANCEMENT MATRICES (5-STAR)
// =============================================================================

/**
 * Renders combined character (5-star) and disc advancement matrix
 *
 * Shows which 5-star characters and discs share the same advancement material groups,
 * organized by element type. Helps identify farming efficiency opportunities.
 *
 * Material pairing:
 * - Character advance materials (20071-73, 20081-83, 20091-93)
 * - Disc advance materials (21071-73, 21081-83, 21091-93)
 */
function renderCombinedAdvanceMatrix(): void {
  const container = document.getElementById('combined-advance-matrix-container');
  if (!container) return;

  try {
    if (!resourcesState.characters || !resourcesState.discs || 
        !resourcesState.characterAdvance || !resourcesState.discPromote || 
        !resourcesState.gameEnums) {
      throw new Error(window.i18n?.t('resources.dataLoadingFailed') || '데이터 로드 실패');
    }

    const combinedData = buildCombinedAdvanceMap();
    const matrixHtml = generateCombinedAdvanceMatrixHtml(combinedData);

    container.innerHTML = matrixHtml;
    initMatrixInteractions(document.getElementById('combined-advance-matrix'));
  } catch (error) {
    console.error('[ResourcesGlance] Error rendering combined advance matrix (5-star):', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    container.innerHTML = `<p>통합 승급 매트릭스 생성 중 오류: ${errorMsg}</p>`;
  }
}

/**
 * Combined advancement matrix data structure
 */
interface CombinedAdvanceData {
  characters: Map<number, Map<number, CharacterData[]>>;
  discs: Map<number, Map<number, Disc[]>>;
  materialGroups: Array<{ charGroup: number; discGroup: number }>;
}

/**
 * Builds combined advancement map for 5-star characters and discs
 *
 * Analyzes material requirements and groups characters/discs by element type
 * and material group. Only processes 5-star (Grade 1) characters.
 *
 * @returns Combined advance data with character/disc maps
 */
function buildCombinedAdvanceMap(): CombinedAdvanceData {
  const characterMap = new Map<number, Map<number, CharacterData[]>>();
  const discMap = new Map<number, Map<number, Disc[]>>();
  
  // Material group indices that will be paired together
  const materialGroups = [
    { charGroup: 0, discGroup: 0 }, // 20071-73 with 21071-73
    { charGroup: 1, discGroup: 1 }, // 20081-83 with 21081-83
    { charGroup: 2, discGroup: 2 }, // 20091-93 with 21091-93
  ];

  const charMaterialGroupMap = new Map(MATERIAL_GROUPS.advance?.map((g, i) => [i, g.items]) || []);
  const discMaterialGroupMap = new Map(MATERIAL_GROUPS.discAdvance?.map((g, i) => [i, g.items]) || []);

  const findGroupIndex = (itemMap: Map<number, number[]>, itemId: number): number => {
    for (const [index, items] of itemMap.entries()) {
      if (items.includes(itemId)) return index;
    }
    return -1;
  };

  // Build character map by element
  for (const character of Object.values(resourcesState.characters)) {
    if (!character.Visible || !character.Available || character.Grade !== 1) {
      continue; // Only 5-star (Grade 1)
    }

    const elementType = character.EET as number;
    if (!characterMap.has(elementType)) {
      characterMap.set(elementType, new Map());
    }
    const elementCharMap = characterMap.get(elementType)!;

    if (character.AdvanceGroup) {
      const advanceData = Object.values(resourcesState.characterAdvance).filter(
        (adv) => adv.Group === character.AdvanceGroup
      );
      
      for (const adv of advanceData) {
        for (let i = 1; i <= 4; i++) {
          const tid = adv[`Tid${i}`];
          if (tid) {
            const groupIndex = findGroupIndex(charMaterialGroupMap, tid as number);
            if (groupIndex !== -1) {
              if (!elementCharMap.has(groupIndex)) {
                elementCharMap.set(groupIndex, []);
              }
              const chars = elementCharMap.get(groupIndex)!;
              if (!chars.some((c) => c.Id === character.Id)) {
                chars.push(character);
              }
            }
          }
        }
      }
    }
  }

  // Build disc map by element
  for (const disc of Object.values(resourcesState.discs)) {
    if (!disc.Visible || !disc.Available || (disc.StrengthenGroupId as number) < 41) {
      continue; // Only 5-star discs
    }

    const promoteGroupId = disc.PromoteGroupId as number;
    if (!promoteGroupId) continue;

    const elementType = disc.EET as number;
    if (!discMap.has(elementType)) {
      discMap.set(elementType, new Map());
    }
    const elementDiscMap = discMap.get(elementType)!;

    for (let i = 1; i <= 8; i++) {
      const promoteId = `${promoteGroupId}${String(i).padStart(3, '0')}`;
      const promoteData = resourcesState.discPromote[promoteId];

      if (promoteData) {
        for (let j = 1; j <= 3; j++) {
          const itemId = promoteData[`ItemId${j}`];
          if (itemId) {
            const groupIndex = findGroupIndex(discMaterialGroupMap, parseInt(String(itemId)));
            if (groupIndex !== -1) {
              if (!elementDiscMap.has(groupIndex)) {
                elementDiscMap.set(groupIndex, []);
              }
              const discs = elementDiscMap.get(groupIndex)!;
              if (!discs.some((d) => d.Id === disc.Id)) {
                discs.push(disc);
              }
            }
          }
        }
      }
    }
  }

  return { characters: characterMap, discs: discMap, materialGroups };
}

/**
 * Generates HTML for combined advancement matrix table (5-star)
 *
 * @param data - Combined advancement data
 * @returns HTML string for the matrix table
 */
function generateCombinedAdvanceMatrixHtml(data: CombinedAdvanceData): string {
  const { characters, discs, materialGroups } = data;
  const gameEnums = resourcesState.gameEnums as unknown as {
    elementType: Record<string, { name: string; icon: string; id?: number }>;
  };
  const elementTypes = Object.entries(gameEnums.elementType)
    .map(([id, e]) => ({ ...e, id: parseInt(id) }))
    .filter((e) => e.id && e.id > 0 && e.id < 7)
    .sort((a, b) => a.id! - b.id!);

  // Header: Material pairs (character + disc materials side by side)
  let headerHtml = '<thead><tr><th></th>';
  materialGroups.forEach((groupPair, pairIndex) => {
    const charGroup = MATERIAL_GROUPS.advance?.[groupPair.charGroup];
    const discGroup = MATERIAL_GROUPS.discAdvance?.[groupPair.discGroup];
    
    const charItem = charGroup ? resourcesState.items[charGroup.items[0]!] : null;
    const discItem = discGroup ? resourcesState.items[discGroup.items[0]!] : null;
    
    const charName = charItem?.Title ? resourcesState.itemNames[charItem.Title as string] || '' : '';
    const discName = discItem?.Title ? resourcesState.itemNames[discItem.Title as string] || '' : '';
    
    const charIconPath = charItem?.Icon ? `assets/items/${charItem.Icon.split('/').pop()}.png` : '';
    const discIconPath = discItem?.Icon ? `assets/items/${discItem.Icon.split('/').pop()}.png` : '';
    
    headerHtml += `<th data-col-index="${pairIndex}">
      <div class="combined-material-header">
        <div class="material-icon-wrapper material-char" title="${charName}">
          ${createResponsiveImage(charIconPath, charName, 'material-icon')}
        </div>
        <div class="material-icon-wrapper material-disc" title="${discName}">
          ${createResponsiveImage(discIconPath, discName, 'material-icon')}
        </div>
      </div>
    </th>`;
  });
  headerHtml += '</tr></thead>';

  // Body: Rows by element
  let bodyHtml = '<tbody>';
  elementTypes.forEach((elementType, rowIndex) => {
    const elementId = elementType.id!;
    bodyHtml += `<tr data-row-index="${rowIndex}">`;
    bodyHtml += `<th data-row-index="${rowIndex}">
      ${createResponsiveImage(elementType.icon, elementType.name, 'element-icon')}
    </th>`;

    const elementCharMap = characters.get(elementId);
    const elementDiscMap = discs.get(elementId);

    materialGroups.forEach((groupPair, colIndex) => {
      bodyHtml += `<td data-col-index="${colIndex}">
        <div class="combined-portraits-container">`;
      
      // Characters section
      bodyHtml += '<div class="combined-section combined-characters">';
      const chars = elementCharMap?.get(groupPair.charGroup);
      if (chars && chars.length > 0) {
        chars.forEach((char) => {
          const charName = char.Name
            ? resourcesState.characterNames[char.Name as string] || ''
            : '';
          bodyHtml += createResponsiveImage(`assets/char/avg1_${char.Id}_002.png`, `[여행가] ${charName}`, 'char-portrait small');
        });
      }
      bodyHtml += '</div>';
      
      // Discs section
      bodyHtml += '<div class="combined-section combined-discs">';
      const discList = elementDiscMap?.get(groupPair.discGroup);
      if (discList && discList.length > 0) {
        discList.forEach((disc) => {
          const discIPData = resourcesState.discIP[disc.Id];
          const discNameKey = discIPData?.StoryName;
          const discName = discNameKey
            ? resourcesState.discIPNames[discNameKey as string] || `Disc ${disc.Id}`
            : `Disc ${disc.Id}`;
          const iconFile = disc.DiscBg ? String(disc.DiscBg).split('/').pop() : '';
          const iconPath = `assets/disc_icons/outfit_${iconFile}.png`;
          bodyHtml += createResponsiveImage(iconPath, `[레코드] ${discName}`, 'disc-portrait-square');
        });
      }
      bodyHtml += '</div>';
      
      bodyHtml += '</div></td>';
    });
    bodyHtml += '</tr>';
  });
  bodyHtml += '</tbody>';

  return `<table class="glance-sub-matrix combined-matrix" id="combined-advance-matrix">${headerHtml}${bodyHtml}</table>`;
}

// =============================================================================
// COMBINED ADVANCEMENT MATRICES (4-STAR)
// =============================================================================

/**
 * Renders combined character (4-star) and disc advancement matrix
 *
 * Shows which 4-star characters and discs share the same advancement material groups.
 * Similar to 5-star matrix but for Grade 2 (4-star) characters.
 */
function renderCombinedAdvanceMatrix4Star(): void {
  const container = document.getElementById('combined-advance-matrix-4star-container');
  if (!container) return;

  try {
    if (!resourcesState.characters || !resourcesState.discs || 
        !resourcesState.characterAdvance || !resourcesState.discPromote || 
        !resourcesState.gameEnums) {
      throw new Error(window.i18n?.t('resources.dataLoadingFailed') || '데이터 로드 실패');
    }

    const combinedData = buildCombinedAdvanceMap4Star();
    const matrixHtml = generateCombinedAdvanceMatrixHtml4Star(combinedData);

    container.innerHTML = matrixHtml;
    initMatrixInteractions(document.getElementById('combined-advance-matrix-4star'));
  } catch (error) {
    console.error('[ResourcesGlance] Error rendering combined advance matrix (4-star):', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    container.innerHTML = `<p>통합 승급 매트릭스 (4성) 생성 중 오류: ${errorMsg}</p>`;
  }
}

/**
 * Builds combined advancement map for 4-star characters and discs
 *
 * Similar to 5-star version but filters for Grade 2 (4-star) characters only.
 *
 * @returns Combined advance data with character/disc maps
 */
function buildCombinedAdvanceMap4Star(): CombinedAdvanceData {
  const characterMap = new Map<number, Map<number, CharacterData[]>>();
  const discMap = new Map<number, Map<number, Disc[]>>();
  
  const materialGroups = [
    { charGroup: 0, discGroup: 0 },
    { charGroup: 1, discGroup: 1 },
    { charGroup: 2, discGroup: 2 },
  ];

  const charMaterialGroupMap = new Map(MATERIAL_GROUPS.advance?.map((g, i) => [i, g.items]) || []);
  const discMaterialGroupMap = new Map(MATERIAL_GROUPS.discAdvance?.map((g, i) => [i, g.items]) || []);

  const findGroupIndex = (itemMap: Map<number, number[]>, itemId: number): number => {
    for (const [index, items] of itemMap.entries()) {
      if (items.includes(itemId)) return index;
    }
    return -1;
  };

  // Build character map by element - 4-star only (Grade 2)
  for (const character of Object.values(resourcesState.characters)) {
    if (!character.Visible || !character.Available || character.Grade !== 2) {
      continue; // Only 4-star (Grade 2)
    }

    const elementType = character.EET as number;
    if (!characterMap.has(elementType)) {
      characterMap.set(elementType, new Map());
    }
    const elementCharMap = characterMap.get(elementType)!;

    if (character.AdvanceGroup) {
      const advanceData = Object.values(resourcesState.characterAdvance).filter(
        (adv) => adv.Group === character.AdvanceGroup
      );
      
      for (const adv of advanceData) {
        for (let i = 1; i <= 4; i++) {
          const tid = adv[`Tid${i}`];
          if (tid) {
            const groupIndex = findGroupIndex(charMaterialGroupMap, tid as number);
            if (groupIndex !== -1) {
              if (!elementCharMap.has(groupIndex)) {
                elementCharMap.set(groupIndex, []);
              }
              const chars = elementCharMap.get(groupIndex)!;
              if (!chars.some((c) => c.Id === character.Id)) {
                chars.push(character);
              }
            }
          }
        }
      }
    }
  }

  // Build disc map by element - 5-star only (same as before)
  for (const disc of Object.values(resourcesState.discs)) {
    if (!disc.Visible || !disc.Available || (disc.StrengthenGroupId as number) < 41) {
      continue;
    }

    const promoteGroupId = disc.PromoteGroupId as number;
    if (!promoteGroupId) continue;

    const elementType = disc.EET as number;
    if (!discMap.has(elementType)) {
      discMap.set(elementType, new Map());
    }
    const elementDiscMap = discMap.get(elementType)!;

    for (let i = 1; i <= 8; i++) {
      const promoteId = `${promoteGroupId}${String(i).padStart(3, '0')}`;
      const promoteData = resourcesState.discPromote[promoteId];

      if (promoteData) {
        for (let j = 1; j <= 3; j++) {
          const itemId = promoteData[`ItemId${j}`];
          if (itemId) {
            const groupIndex = findGroupIndex(discMaterialGroupMap, parseInt(String(itemId)));
            if (groupIndex !== -1) {
              if (!elementDiscMap.has(groupIndex)) {
                elementDiscMap.set(groupIndex, []);
              }
              const discs = elementDiscMap.get(groupIndex)!;
              if (!discs.some((d) => d.Id === disc.Id)) {
                discs.push(disc);
              }
            }
          }
        }
      }
    }
  }

  return { characters: characterMap, discs: discMap, materialGroups };
}

/**
 * Generates HTML for combined advancement matrix table (4-star)
 *
 * @param data - Combined advancement data
 * @returns HTML string for the matrix table
 */
function generateCombinedAdvanceMatrixHtml4Star(data: CombinedAdvanceData): string {
  const { characters, discs, materialGroups } = data;
  const gameEnums = resourcesState.gameEnums as unknown as {
    elementType: Record<string, { name: string; icon: string; id?: number }>;  };
  const elementTypes = Object.entries(gameEnums.elementType)
    .map(([id, e]) => ({ ...e, id: parseInt(id) }))
    .filter((e) => e.id && e.id > 0 && e.id < 7)
    .sort((a, b) => a.id! - b.id!);

  let headerHtml = '<thead><tr><th></th>';
  materialGroups.forEach((groupPair, pairIndex) => {
    const charGroup = MATERIAL_GROUPS.advance?.[groupPair.charGroup];
    const discGroup = MATERIAL_GROUPS.discAdvance?.[groupPair.discGroup];
    
    const charItem = charGroup ? resourcesState.items[charGroup.items[0]!] : null;
    const discItem = discGroup ? resourcesState.items[discGroup.items[0]!] : null;
    
    const charName = charItem?.Title ? resourcesState.itemNames[charItem.Title as string] || '' : '';
    const discName = discItem?.Title ? resourcesState.itemNames[discItem.Title as string] || '' : '';
    
    const charIconPath = charItem?.Icon ? `assets/items/${charItem.Icon.split('/').pop()}.png` : '';
    const discIconPath = discItem?.Icon ? `assets/items/${discItem.Icon.split('/').pop()}.png` : '';
    
    headerHtml += `<th data-col-index="${pairIndex}">
      <div class="combined-material-header">
        <div class="material-icon-wrapper material-char" title="${charName}">
          ${createResponsiveImage(charIconPath, charName, 'material-icon')}
        </div>
        <div class="material-icon-wrapper material-disc" title="${discName}">
          ${createResponsiveImage(discIconPath, discName, 'material-icon')}
        </div>
      </div>
    </th>`;
  });
  headerHtml += '</tr></thead>';

  let bodyHtml = '<tbody>';
  elementTypes.forEach((elementType, rowIndex) => {
    const elementId = elementType.id!;
    bodyHtml += `<tr data-row-index="${rowIndex}">`;
    bodyHtml += `<th data-row-index="${rowIndex}">
      ${createResponsiveImage(elementType.icon, elementType.name, 'element-icon')}
    </th>`;

    const elementCharMap = characters.get(elementId);
    const elementDiscMap = discs.get(elementId);

    materialGroups.forEach((groupPair, colIndex) => {
      bodyHtml += `<td data-col-index="${colIndex}">
        <div class="combined-portraits-container">`;
      
      bodyHtml += '<div class="combined-section combined-characters">';
      const chars = elementCharMap?.get(groupPair.charGroup);
      if (chars && chars.length > 0) {
        chars.forEach((char) => {
          const charName = char.Name
            ? resourcesState.characterNames[char.Name as string] || ''
            : '';
          bodyHtml += createResponsiveImage(`assets/char/avg1_${char.Id}_002.png`, `[여행가 4★] ${charName}`, 'char-portrait small');
        });
      }
      bodyHtml += '</div>';
      
      bodyHtml += '<div class="combined-section combined-discs">';
      const discList = elementDiscMap?.get(groupPair.discGroup);
      if (discList && discList.length > 0) {
        discList.forEach((disc) => {
          const discIPData = resourcesState.discIP[disc.Id];
          const discNameKey = discIPData?.StoryName;
          const discName = discNameKey
            ? resourcesState.discIPNames[discNameKey as string] || `Disc ${disc.Id}`
            : `Disc ${disc.Id}`;
          const iconFile = disc.DiscBg ? String(disc.DiscBg).split('/').pop() : '';
          const iconPath = `assets/disc_icons/outfit_${iconFile}.png`;
          bodyHtml += createResponsiveImage(iconPath, `[레코드 5★] ${discName}`, 'disc-portrait-square');
        });
      }
      bodyHtml += '</div>';
      
      bodyHtml += '</div></td>';
    });
    bodyHtml += '</tr>';
  });
  bodyHtml += '</tbody>';

  return `<table class="glance-sub-matrix combined-matrix" id="combined-advance-matrix-4star">${headerHtml}${bodyHtml}</table>`;
}

