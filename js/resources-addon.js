// ============================================================================
// RESOURCES PAGE - "VIEW AT A GLANCE" TAB
// ============================================================================

let isGlanceTabRendered = false;

/**
 * Main function to render all content on the "Glance" tab.
 * This function calls individual renderers for each matrix.
 */
async function renderGlanceTabContent() {
    if (isGlanceTabRendered) {
        return;
    }

    const loader = document.getElementById('glance-loader');
    if (loader) loader.style.display = 'flex';

    try {
        await renderAtAGlanceMatrix();
        await renderCharacterBadgeMatrix();
        await renderDiscAdvanceMatrix();
        
        isGlanceTabRendered = true;
    } catch (error) {
        console.error('Error rendering glance tab content:', error);
        const container = document.getElementById('glance-matrix-container');
        if (container) {
            container.innerHTML = `<p>콘텐츠를 렌더링하는 중 오류가 발생했습니다: ${error.message}</p>`;
        }
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

// ============================================================================
// 1. Character Material Matrix (Existing)
// ============================================================================

async function renderAtAGlanceMatrix() {
    const container = document.getElementById('glance-matrix-container');
    if (!container) return;

    try {
        if (!resourcesState.characters || !resourcesState.characterAdvance || !resourcesState.characterSkillUpgrade) {
            throw new Error('필요한 캐릭터 데이터가 로드되지 않았습니다.');
        }

        const charMaterialMap = buildCharacterMaterialMap();
        const matrixHtml = generateMatrixHtml(charMaterialMap);
        container.innerHTML = matrixHtml;
        initGlanceMatrixInteractions();

    } catch (error) {
        console.error('Error rendering glance matrix:', error);
        container.innerHTML = `<p>육성 재료 매트릭스 생성 중 오류: ${error.message}</p>`;
    }
}

function buildCharacterMaterialMap() {
    const charMap = {};
    const advanceGroupMap = new Map(MATERIAL_GROUPS.advance.map((g, i) => [i, g.items]));
    const skillGroupMap = new Map(MATERIAL_GROUPS.skill.map((g, i) => [i, g.items]));

    const findGroupIndex = (itemMap, itemId) => {
        for (const [index, items] of itemMap.entries()) {
            if (items.includes(itemId)) return index;
        }
        return -1;
    };

    for (const charId in resourcesState.characters) {
        const character = resourcesState.characters[charId];
        if (!character.Visible || !character.Available) continue;

        charMap[charId] = { advanceGroups: new Set(), skillGroups: new Set() };

        if (character.AdvanceGroup) {
            const advanceData = Object.values(resourcesState.characterAdvance).filter(adv => adv.Group === character.AdvanceGroup);
            for (const adv of advanceData) {
                for (let i = 1; i <= 4; i++) {
                    if (adv[`Tid${i}`]) {
                        const groupIndex = findGroupIndex(advanceGroupMap, adv[`Tid${i}`]);
                        if (groupIndex !== -1) charMap[charId].advanceGroups.add(groupIndex);
                    }
                }
            }
        }

        if (character.SkillsUpgradeGroup && character.SkillsUpgradeGroup.length > 0) {
            const skillUpgradeGroup = character.SkillsUpgradeGroup[0];
            const skillData = Object.values(resourcesState.characterSkillUpgrade).filter(upg => upg.Group === skillUpgradeGroup);
            for (const upg of skillData) {
                 for (let i = 1; i <= 4; i++) {
                    if (upg[`Tid${i}`]) {
                        const groupIndex = findGroupIndex(skillGroupMap, upg[`Tid${i}`]);
                        if (groupIndex !== -1) charMap[charId].skillGroups.add(groupIndex);
                    }
                }
            }
        }
    }
    return charMap;
}

function generateMatrixHtml(charMaterialMap) {
    const advanceGroups = MATERIAL_GROUPS.advance;
    const skillGroups = MATERIAL_GROUPS.skill;

    let headerHtml = '<thead><tr><th></th>';
    skillGroups.forEach((group, skillIndex) => {
        const item = resourcesState.items[group.items[0]];
        const itemName = resourcesState.itemNames[item.Title] || '';
        headerHtml += `<th data-col-index="${skillIndex}"><div class="material-icon-wrapper" title="${itemName}">
                       <img src="assets/items/${item.Icon.split('/').pop()}.png" class="material-icon" loading="lazy" alt="${itemName}"></div></th>`;
    });
    headerHtml += '</tr></thead>';

    let bodyHtml = '<tbody>';
    advanceGroups.forEach((advGroup, advIndex) => {
        const item = resourcesState.items[advGroup.items[0]];
        const itemName = resourcesState.itemNames[item.Title] || '';
        bodyHtml += `<tr data-row-index="${advIndex}">`;
        bodyHtml += `<th data-row-index="${advIndex}"><div class="material-icon-wrapper" title="${itemName}">
                     <img src="assets/items/${item.Icon.split('/').pop()}.png" class="material-icon" loading="lazy" alt="${itemName}"></div></th>`;

        skillGroups.forEach((_, skillIndex) => {
            const matchingChars = Object.keys(charMaterialMap).filter(charId => 
                charMaterialMap[charId].advanceGroups.has(advIndex) && charMaterialMap[charId].skillGroups.has(skillIndex)
            );
            bodyHtml += `<td data-col-index="${skillIndex}"><div class="char-portraits-grid">`;
            matchingChars.forEach(charId => {
                const charName = resourcesState.characterNames[resourcesState.characters[charId].Name] || '';
                bodyHtml += `<img src="assets/char/avg1_${charId}_002.png" class="char-portrait" loading="lazy" title="${charName}" onerror="this.src='assets/char/${charId}_icon.png'">`;
            });
            bodyHtml += '</div></td>';
        });
        bodyHtml += '</tr>';
    });
    bodyHtml += '</tbody>';

    return `<table id="glance-matrix">${headerHtml}${bodyHtml}</table>`;
}

function initGlanceMatrixInteractions() {
    initMatrixInteractions(document.getElementById('glance-matrix'));
}

/**
 * Initializes hover interactions for a given matrix using event delegation.
 * @param {HTMLElement} matrix - The table element of the matrix.
 */
function initMatrixInteractions(matrix) {
    if (!matrix) return;

    // Track currently highlighted cells for efficient cleanup
    let highlightedCells = [];

    const clearHighlights = () => {
        highlightedCells.forEach(cell => {
            cell.classList.remove('highlight-col', 'highlight-row');
        });
        highlightedCells = [];
    };

    // Use event delegation - single listener on the table
    matrix.addEventListener('mouseover', (e) => {
        const header = e.target.closest('th[data-col-index], th[data-row-index]');
        if (!header) return;

        clearHighlights();

        const colIndex = header.dataset.colIndex;
        const rowIndex = header.dataset.rowIndex;

        if (colIndex !== undefined) {
            const cells = matrix.querySelectorAll(`[data-col-index="${colIndex}"]`);
            cells.forEach(cell => {
                cell.classList.add('highlight-col');
                highlightedCells.push(cell);
            });
        }
        if (rowIndex !== undefined) {
            const row = matrix.querySelector(`tr[data-row-index="${rowIndex}"]`);
            if (row) {
                const cells = row.querySelectorAll('td, th');
                cells.forEach(cell => {
                    cell.classList.add('highlight-row');
                    highlightedCells.push(cell);
                });
            }
        }
    });

    matrix.addEventListener('mouseleave', clearHighlights);
}

// ============================================================================
// 2. Character Badge Matrix
// ============================================================================
async function renderCharacterBadgeMatrix() {
    const container = document.getElementById('character-badge-matrix-container');
    if (!container) return;

    try {
        if (!resourcesState.characters || !resourcesState.charGem) {
            throw new Error('필요한 캐릭터 뱃지 데이터가 로드되지 않았습니다.');
        }

        const badgeMap = buildCharacterBadgeMap();
        const matrixHtml = generateCharacterBadgeMatrixHtml(badgeMap);

        container.innerHTML = matrixHtml;
        initMatrixInteractions(document.getElementById('character-badge-matrix'));

    } catch (error) {
        console.error('Error rendering character badge matrix:', error);
        container.innerHTML = `<p>캐릭터 뱃지 매트릭스 생성 중 오류: ${error.message}</p>`;
    }
}

function buildCharacterBadgeMap() {
    const badgeMap = {
        70: new Map(),
        80: new Map(),
        90: new Map()
    };
    const allBadgeItems = new Set();

    Object.values(resourcesState.characters).forEach(character => {
        if (!character.Visible || !character.Available || !character.GemSlots || character.GemSlots.length !== 3) {
            return;
        }

        const levels = [70, 80, 90];
        levels.forEach((level, index) => {
            const gemSlotId = character.GemSlots[index];
            const charGemData = resourcesState.charGem[gemSlotId];

            if (charGemData && charGemData.GenerateCostTid) {
                const itemId = charGemData.GenerateCostTid;
                allBadgeItems.add(itemId);

                if (!badgeMap[level].has(itemId)) {
                    badgeMap[level].set(itemId, []);
                }
                badgeMap[level].get(itemId).push(character);
            }
        });
    });

    return {
        matrix: badgeMap,
        badgeItems: Array.from(allBadgeItems).sort((a, b) => a - b)
    };
}

function generateCharacterBadgeMatrixHtml(badgeMapData) {
    const { matrix, badgeItems } = badgeMapData;
    const levels = [70, 80, 90];

    // Header
    let headerHtml = '<thead><tr><th></th>';
    badgeItems.forEach((itemId, index) => {
        const item = resourcesState.items[itemId];
        const itemName = item ? resourcesState.itemNames[item.Title] || '' : `Item ${itemId}`;
        const iconPath = item ? `assets/items/item_${itemId}.png` : '';
        headerHtml += `<th data-col-index="${index}"><div class="material-icon-wrapper" title="${itemName}">
                       <img src="${iconPath}" class="material-icon" loading="lazy" alt="${itemName}" onerror="this.style.display='none'">
                     </div></th>`;
    });
    headerHtml += '</tr></thead>';

    // Body
    let bodyHtml = '<tbody>';
    levels.forEach((level, index) => {
        bodyHtml += `<tr data-row-index="${index}">`;
        bodyHtml += `<th data-row-index="${index}">${level} Lv</th>`;
        badgeItems.forEach((itemId, colIndex) => {
            bodyHtml += `<td data-col-index="${colIndex}"><div class="char-portraits-grid">`;
            const characters = matrix[level].get(itemId);
            if (characters) {
                characters.forEach(char => {
                    const charName = resourcesState.characterNames[char.Name] || '';
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


// ============================================================================
// 3. Disc Advance Matrix
// ============================================================================
async function renderDiscAdvanceMatrix() {
    const container = document.getElementById('disc-advance-matrix-container');
    if (!container) return;

    try {
        if (!resourcesState.discs || !resourcesState.discPromote || !resourcesState.gameEnums) {
            throw new Error('필요한 레코드 데이터가 로드되지 않았습니다.');
        }

        const discMap = buildDiscAdvanceMap();
        const matrixHtml = generateDiscAdvanceMatrixHtml(discMap);

        container.innerHTML = matrixHtml;
        initMatrixInteractions(document.getElementById('disc-advance-matrix'));
    } catch (error) {
        console.error('Error rendering disc advance matrix:', error);
        container.innerHTML = `<p>레코드 승급 매트릭스 생성 중 오류: ${error.message}</p>`;
    }
}

function buildDiscAdvanceMap() {
    const discMap = new Map();
    const materialGroupMap = new Map(MATERIAL_GROUPS.discAdvance.map((g, i) => [i, g.items]));

    const findGroupIndex = (itemId) => {
        for (const [index, items] of materialGroupMap.entries()) {
            if (items.includes(itemId)) return index;
        }
        return -1;
    };

    for (const disc of Object.values(resourcesState.discs)) {
        if (!disc.Visible || !disc.Available || disc.StrengthenGroupId < 41) {
            continue;
        }

        const promoteGroupId = disc.PromoteGroupId;
        if (!promoteGroupId) {
            continue;
        }

        const eet = disc.EET;
        if (!discMap.has(eet)) {
            discMap.set(eet, new Map());
        }
        const elementMap = discMap.get(eet);

        for (let i = 1; i <= 8; i++) {
            const promoteId = `${promoteGroupId}${String(i).padStart(3, '0')}`;
            const promoteData = resourcesState.discPromote[promoteId];

            if (promoteData) {
                for (let j = 1; j <= 3; j++) {
                    const itemId = promoteData[`ItemId${j}`];
                    if (itemId) {
                        const groupIndex = findGroupIndex(parseInt(itemId));
                        if (groupIndex !== -1) {
                            if (!elementMap.has(groupIndex)) {
                                elementMap.set(groupIndex, []);
                            }
                            const discsInGroup = elementMap.get(groupIndex);
                            if (!discsInGroup.some(d => d.Id === disc.Id)) {
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

function generateDiscAdvanceMatrixHtml(discMap) {
    const materialGroups = MATERIAL_GROUPS.discAdvance;
    // Convert elementType entries to array with id property (keys are string IDs)
    const elementTypes = Object.entries(resourcesState.gameEnums.elementType)
        .map(([id, e]) => ({ ...e, id: parseInt(id) }))
        .filter(e => e.id > 0 && e.id < 7); // Filter to actual elements (1-6), exclude NONE(7) and INHERIT(0)

    // Check if discMap is empty
    if (discMap.size === 0) {
        return `<div class="matrix-empty-state">
            <i class="fa-solid fa-compact-disc"></i>
            <p>5성 레코드 데이터를 불러올 수 없습니다.</p>
        </div>`;
    }

    // Header
    let headerHtml = '<thead><tr><th></th>';
    materialGroups.forEach((group, index) => {
        const item = resourcesState.items[group.items[0]];
        const itemName = item ? resourcesState.itemNames[item.Title] || '' : '';
        const iconPath = item ? `assets/items/${item.Icon.split('/').pop()}.png` : '';
        headerHtml += `<th data-col-index="${index}"><div class="material-icon-wrapper" title="${itemName}">
                       <img src="${iconPath}" class="material-icon" loading="lazy" alt="${itemName}" onerror="this.style.display='none'">
                     </div></th>`;
    });
    headerHtml += '</tr></thead>';

    // Body
    let bodyHtml = '<tbody>';
    let rowCount = 0;
    elementTypes.forEach((elementType, index) => {
        if (!discMap.has(elementType.id)) return; // Skip elements with no 5* discs

        rowCount++;
        bodyHtml += `<tr data-row-index="${index}">`;
        bodyHtml += `<th data-row-index="${index}"><img src="${elementType.icon}" class="element-icon" loading="lazy" title="${elementType.name}"></th>`;

        const elementDiscMap = discMap.get(elementType.id);

        materialGroups.forEach((_, groupIndex) => {
            bodyHtml += `<td data-col-index="${groupIndex}"><div class="char-portraits-grid">`;
            const discs = elementDiscMap ? elementDiscMap.get(groupIndex) : null;
            if (discs && discs.length > 0) {
                discs.forEach(disc => {
                    const discIPData = resourcesState.discIP[disc.Id];
                    const discNameKey = discIPData?.StoryName;
                    const discName = discNameKey ? (resourcesState.discIPNames[discNameKey] || `Disc ${disc.Id}`) : `Disc ${disc.Id}`;
                    const iconFile = disc.DiscBg ? disc.DiscBg.split('/').pop() : '';
                    const iconPath = `assets/disc_icons/outfit_${iconFile}.png`;
                    bodyHtml += `<img src="${iconPath}" class="char-portrait" loading="lazy" title="${discName}" onerror="this.style.display='none'">`;
                });
            }
            bodyHtml += '</div></td>';
        });
        bodyHtml += '</tr>';
    });
    bodyHtml += '</tbody>';

    // If no rows were generated, show empty state
    if (rowCount === 0) {
        return `<div class="matrix-empty-state">
            <i class="fa-solid fa-compact-disc"></i>
            <p>표시할 5성 레코드가 없습니다.</p>
        </div>`;
    }

    return `<table class="glance-sub-matrix" id="disc-advance-matrix">${headerHtml}${bodyHtml}</table>`;
}


// ============================================================================
// "MY MATERIALS" MODAL (Existing)
// ============================================================================
function openMyMaterialsModal() {
    const modal = document.getElementById('my-materials-modal');
    const content = document.getElementById('my-materials-content');
    if (!modal || !content) return;

    content.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const createMaterialInput = (itemId) => {
        const item = resourcesState.items[itemId];
        if (!item) return '';
        const ownedQty = resourcesState.ownedMaterials[itemId] || 0;
        const itemName = resourcesState.itemNames[item.Title] || item.Title;
        const iconFile = item.Icon ? item.Icon.split('/').pop() : '';
        const iconPath = `assets/items/${iconFile}.png`;
        const bgImage = `assets/items/rare_item_a_${6 - (item.Rarity || 1)}.png`;
        return `<div class="owned-material-item">
                    <div class="resource-item-icon-wrapper">
                        <img src="${bgImage}" class="resource-item-bg" alt="" loading="lazy" onerror="this.style.display='none'">
                        <img src="${iconPath}" class="resource-item-icon" loading="lazy" alt="${itemName}" onerror="this.style.display='none'">
                    </div>
                    <div class="resource-item-name">${itemName}</div>
                    <input type="number" class="owned-material-input" value="${ownedQty}" min="0" oninput="updateOwnedMaterial('${itemId}', this.value)" placeholder="0"/>
                </div>`;
    };
    
    // Sections for different material types
    const sections = {
        '승급 아이템 (캐릭터)': MATERIAL_GROUPS.advance,
        '승급 아이템 (레코드)': MATERIAL_GROUPS.discAdvance,
        '스킬 강화 아이템': MATERIAL_GROUPS.skill
    };

    for (const [title, groups] of Object.entries(sections)) {
        const section = document.createElement('div');
        section.className = 'owned-material-section';
        section.innerHTML = `<h3>${title}</h3>`;
        const grid = document.createElement('div');
        grid.className = 'owned-material-grid';
        groups.forEach(group => {
            const groupRow = document.createElement('div');
            groupRow.className = 'owned-material-group-row';
            group.items.forEach(itemId => {
                groupRow.innerHTML += createMaterialInput(String(itemId));
            });
            grid.appendChild(groupRow);
        });
        section.appendChild(grid);
        fragment.appendChild(section);
    }
    
    // Other specific items (EXP, Gold, etc.) can be added similarly

    content.appendChild(fragment);
    modal.classList.add('active');
}

function closeMyMaterialsModal() {
    document.getElementById('my-materials-modal')?.classList.remove('active');
    renderResourceSummary();
    renderDiscResourceSummary();
}

function updateOwnedMaterial(itemId, quantity) {
    const numQty = parseInt(quantity);
    if (isNaN(numQty) || numQty <= 0) {
        delete resourcesState.ownedMaterials[itemId];
    } else {
        resourcesState.ownedMaterials[itemId] = numQty;
    }
    saveResourcesState();
}
