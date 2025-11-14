// ============================================================================
// RESOURCES PAGE - Resource Manager
// ============================================================================

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

// Material merge ratios (3 lower tier = 1 higher tier)
const MATERIAL_GROUPS = {
    advance: [
        { items: [20071, 20072, 20073], mergeRatio: 3 },
        { items: [20081, 20082, 20083], mergeRatio: 3 },
        { items: [20091, 20092, 20093], mergeRatio: 3 }
    ],
    skill: [
        { items: [32001, 32002, 32003], mergeRatio: 3 },
        { items: [32011, 32012, 32013], mergeRatio: 3 },
        { items: [32021, 32022, 32023], mergeRatio: 3 }
    ],
    discAdvance: [
        { items: [21071, 21072, 21073], mergeRatio: 3 },
        { items: [21081, 21082, 21083], mergeRatio: 3 },
        { items: [21091, 21092, 21093], mergeRatio: 3 }
    ]
};

// Stamina and drop calculations
const STAMINA_CONFIG = {
    advance: {
        dailyTaskReward: Math.ceil(85 + 17 * 0.5), // = 94
        dungeonDrop: Math.ceil(0.5 * 3 * 3 + 0.5 * 3 + 10), // = 16
        dungeonStamina: 30
    },
    skill: {
        dailyTaskReward: Math.ceil(29.5 + 7.5 * 0.5), // = 34
        dungeonDrop: Math.ceil(0.5 * 3 * 3 + 1.5 * 3 + 10), // = 19
        dungeonStamina: 30
    },
    discAdvance: {
        dailyTaskReward: Math.ceil(17 + 3.5 * 0.5), // = 19
        dungeonDrop: Math.ceil(0.5 * 3 * 3 + 0.5 * 3 + 10), // = 16
        dungeonStamina: 30
    }
};

// Global state for resources page
let resourcesState = {
    characters: {},
    characterNames: {},
    characterUpgrade: {},
    characterSkillUpgrade: {},
    characterAdvance: {},
    charItemExp: {},
    charGem: {},
    discs: {},
    discStrengthen: {},
    discPromote: {},
    discItemExp: {},
    discIP: {},
    discIPNames: {},
    gameEnums: {},
    items: {},
    itemNames: {},
    selectedCharacters: [],
    selectedDiscs: [],
    characterResources: {}, // Store each character's resource requirements
    discResources: {}, // Store each disc's resource requirements
    itemUsageIndex: {} // Cache of which characters/discs use which items
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Show/hide loading state
function showLoadingState(show) {
    let loader = document.getElementById('resources-loader');
    if (!loader && show) {
        loader = document.createElement('div');
        loader.id = 'resources-loader';
        loader.className = 'loading-overlay';
        loader.innerHTML = `
            <div class="loading-spinner">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <p>데이터를 불러오는 중...</p>
            </div>
        `;
        document.body.appendChild(loader);
    }
    
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

// Save resources state to localStorage
function saveResourcesState() {
    try {
        const stateToSave = {
            selectedCharacters: resourcesState.selectedCharacters,
            selectedDiscs: resourcesState.selectedDiscs,
            timestamp: Date.now()
        };
        localStorage.setItem('resourcesPageState', JSON.stringify(stateToSave));
    } catch (error) {
        console.error('Error saving state:', error);
    }
}

// Load resources state from localStorage
function loadResourcesState() {
    try {
        const saved = localStorage.getItem('resourcesPageState');
        if (!saved) return;
        
        const data = JSON.parse(saved);
        
        // Check if data is less than 7 days old
        const daysSinceUpdate = (Date.now() - (data.timestamp || 0)) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate > 7) {
            localStorage.removeItem('resourcesPageState');
            return;
        }
        
        // Restore selected characters
        if (data.selectedCharacters && data.selectedCharacters.length > 0) {
            resourcesState.selectedCharacters = data.selectedCharacters;
            data.selectedCharacters.forEach(char => {
                calculateCharacterResources(char.id);
            });
        }
        
        // Restore selected discs
        if (data.selectedDiscs && data.selectedDiscs.length > 0) {
            resourcesState.selectedDiscs = data.selectedDiscs;
            data.selectedDiscs.forEach(disc => {
                calculateDiscResources(disc.id);
            });
        }
        
        if (resourcesState.selectedCharacters.length > 0 || resourcesState.selectedDiscs.length > 0) {
            showToast('이전 선택 항목을 불러왔습니다', 'success');
        }
    } catch (error) {
        console.error('Error loading state:', error);
        localStorage.removeItem('resourcesPageState');
    }
}

// Initialize event delegation for all click handlers
function initEventDelegation() {
    // Character list event delegation
    const charList = document.getElementById('selected-characters-list');
    if (charList) {
        charList.addEventListener('click', handleCharacterListClick);
        charList.addEventListener('input', handleCharacterInputChange);
    }
    
    // Disc list event delegation
    const discList = document.getElementById('selected-discs-list');
    if (discList) {
        discList.addEventListener('click', handleDiscListClick);
        discList.addEventListener('input', handleDiscInputChange);
    }
    
    // Character grid modal delegation
    const charGrid = document.getElementById('character-resource-grid');
    if (charGrid) {
        charGrid.addEventListener('click', handleCharacterGridClick);
    }
    
    // Disc grid modal delegation
    const discGrid = document.getElementById('disc-resource-grid');
    if (discGrid) {
        discGrid.addEventListener('click', handleDiscGridClick);
    }
}

// Handle character list clicks
function handleCharacterListClick(event) {
    const removeBtn = event.target.closest('.remove-resource-btn');
    if (removeBtn) {
        const card = removeBtn.closest('.character-resource-card');
        const characterId = card?.dataset.characterId;
        if (characterId) {
            removeCharacterFromResources(characterId);
        }
        return;
    }
}

// Handle character input changes
function handleCharacterInputChange(event) {
    const input = event.target;
    if (!input.matches('input[type="number"]')) return;
    
    const card = input.closest('.character-resource-card');
    const characterId = card?.dataset.characterId;
    if (!characterId) return;
    
    if (input.dataset.levelType === 'character') {
        const field = input.dataset.field;
        updateCharacterLevel(characterId, field, input.value);
    } else if (input.dataset.levelType === 'skill') {
        const skillType = input.dataset.skillType;
        const field = input.dataset.field;
        updateCharacterSkillLevel(characterId, skillType, field, input.value);
    }
}

// Handle disc list clicks
function handleDiscListClick(event) {
    const removeBtn = event.target.closest('.remove-resource-btn');
    if (removeBtn) {
        const card = removeBtn.closest('.character-resource-card');
        const discId = card?.dataset.discId;
        if (discId) {
            removeDiscFromResources(discId);
        }
        return;
    }
}

// Handle disc input changes
function handleDiscInputChange(event) {
    const input = event.target;
    if (!input.matches('input[type="number"]')) return;
    
    const card = input.closest('.character-resource-card');
    const discId = card?.dataset.discId;
    if (!discId) return;
    
    const field = input.dataset.field;
    if (field) {
        updateDiscLevel(discId, field, input.value);
    }
}

// Handle character grid clicks
function handleCharacterGridClick(event) {
    const charItem = event.target.closest('.character-item:not(.disabled)');
    if (charItem) {
        const characterId = charItem.dataset.characterId;
        if (characterId) {
            selectCharacterForResources(characterId);
        }
    }
}

// Handle disc grid clicks
function handleDiscGridClick(event) {
    const discItem = event.target.closest('.disc-item:not(.disabled)');
    if (discItem) {
        const discId = discItem.dataset.discId;
        const rarity = parseInt(discItem.dataset.rarity);
        const name = discItem.dataset.name;
        if (discId) {
            selectDisc(discId, rarity, name);
        }
    }
}

// Initialize keyboard navigation
function initKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        // ESC to close modals
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                modal.classList.remove('active');
            });
        }
    });
}

// Build item usage index for performance
function buildItemUsageIndex() {
    resourcesState.itemUsageIndex = {};
    
    // Index character items
    Object.entries(resourcesState.characterResources).forEach(([charId, resources]) => {
        const allItems = {
            ...resources.advanceItems,
            ...resources.skillItems
        };
        
        Object.keys(allItems).forEach(itemId => {
            if (!resourcesState.itemUsageIndex[itemId]) {
                resourcesState.itemUsageIndex[itemId] = { characters: [], discs: [] };
            }
            resourcesState.itemUsageIndex[itemId].characters.push(charId);
        });
    });
    
    // Index disc items
    Object.entries(resourcesState.discResources).forEach(([discId, resources]) => {
        Object.keys(resources.advanceItems || {}).forEach(itemId => {
            if (!resourcesState.itemUsageIndex[itemId]) {
                resourcesState.itemUsageIndex[itemId] = { characters: [], discs: [] };
            }
            resourcesState.itemUsageIndex[itemId].discs.push(discId);
        });
    });
}

// Initialize the resources page
async function initResourcesPage() {
    try {
        showLoadingState(true);
        
        // Load all required data
        await loadResourcesData();

        // Load saved state from localStorage
        loadResourcesState();

        // Build item usage index after loading state
        buildItemUsageIndex();

        // Initialize event delegation
        initEventDelegation();

        // Initialize keyboard navigation
        initKeyboardNavigation();

        // Initialize UI
        renderSelectedCharactersList();
        renderResourceSummary();
        renderSelectedDiscsList();
        renderDiscResourceSummary();
        
    } catch (error) {
        console.error('Error initializing resources page:', error);
        showToast('데이터 로딩 실패', 'error');
    } finally {
        showLoadingState(false);
    }
}

// Load all required data files
async function loadResourcesData() {
    try {
        const [
            charactersData,
            characterNamesData,
            characterUpgradeData,
            characterSkillUpgradeData,
            characterAdvanceData,
            charItemExpData,
            charGemData,
            discsData,
            discStrengthenData,
            discPromoteData,
            discItemExpData,
            discIPData,
            discIPNamesData,
            gameEnumsData,
            itemsData,
            itemNamesData
        ] = await Promise.all([
            fetch('data/Character.json').then(r => r.json()),
            fetch('data/kr/Character.json').then(r => r.json()),
            fetch('data/CharacterUpgrade.json').then(r => r.json()),
            fetch('data/CharacterSkillUpgrade.json').then(r => r.json()),
            fetch('data/CharacterAdvance.json').then(r => r.json()),
            fetch('data/CharItemExp.json').then(r => r.json()),
            fetch('data/CharGem.json').then(r => r.json()),
            fetch('data/Disc.json').then(r => r.json()),
            fetch('data/DiscStrengthen.json').then(r => r.json()),
            fetch('data/DiscPromote.json').then(r => r.json()),
            fetch('data/DiscItemExp.json').then(r => r.json()),
            fetch('data/DiscIP.json').then(r => r.json()),
            fetch('data/kr/DiscIP.json').then(r => r.json()),
            fetch('data/GameEnums.json').then(r => r.json()),
            fetch('data/Item.json').then(r => r.json()),
            fetch('data/kr/Item.json').then(r => r.json())
        ]);

        resourcesState.characters = charactersData;
        resourcesState.characterNames = characterNamesData;
        resourcesState.characterUpgrade = characterUpgradeData;
        resourcesState.characterSkillUpgrade = characterSkillUpgradeData;
        resourcesState.characterAdvance = characterAdvanceData;
        resourcesState.charItemExp = charItemExpData;
        resourcesState.charGem = charGemData;
        resourcesState.discs = discsData;
        resourcesState.discStrengthen = discStrengthenData;
        resourcesState.discPromote = discPromoteData;
        resourcesState.discItemExp = discItemExpData;
        resourcesState.discIP = discIPData;
        resourcesState.discIPNames = discIPNamesData;
        resourcesState.gameEnums = gameEnumsData;
        resourcesState.items = itemsData;
        resourcesState.itemNames = itemNamesData;

    } catch (error) {
        console.error('Error loading resources data:', error);
        throw error;
    }
}

// Switch between main tabs (characters/discs)
function switchResourceTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.resources-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.resources-tab-btn[data-tab="${tabName}"]`)?.classList.add('active');
    
    // Show/hide tab content
    document.querySelectorAll('.resources-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`resources-tab-${tabName}`)?.classList.add('active');
}

// Open character selection modal
function openCharacterResourceSelect() {
    const modal = document.getElementById('character-resource-modal');
    const grid = document.getElementById('character-resource-grid');
    
    // Clear existing content
    grid.innerHTML = '';
    
    // Filter only visible and available characters
    const availableCharacters = Object.entries(resourcesState.characters)
        .filter(([id, char]) => char.Visible && char.Available)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    
    // Create character grid
    const fragment = document.createDocumentFragment();
    
    availableCharacters.forEach(([id, char]) => {
        const isSelected = resourcesState.selectedCharacters.some(c => c.id === id);
        
        const charItem = document.createElement('div');
        charItem.className = `character-item ${isSelected ? 'disabled' : ''}`;
        charItem.dataset.characterId = id;
        
        const charName = resourcesState.characterNames[char.Name] || char.Name;
        
        charItem.innerHTML = `
            <div class="character-item-header">
                <img src="assets/char/avg1_${id}_002.png" 
                     alt="${charName}" 
                     class="character-item-image"
                     loading="lazy"
                     onerror="this.style.display='none'">
            </div>
            <div class="character-item-info">
                <div class="character-item-name">${charName}</div>
                ${isSelected ? '<div class="character-item-id" style="color: var(--primary-color);">선택됨</div>' : ''}
            </div>
        `;
        
        fragment.appendChild(charItem);
    });
    
    grid.appendChild(fragment);
    modal.classList.add('active');
}

// Close character selection modal
function closeCharacterResourceSelect() {
    document.getElementById('character-resource-modal').classList.remove('active');
}

// Select a character for resource calculation
function selectCharacterForResources(characterId) {
    const character = resourcesState.characters[characterId];
    if (!character) return;
    
    const charName = resourcesState.characterNames[character.Name] || character.Name;
    
    // Add to selected characters with default levels
    const selectedChar = {
        id: characterId,
        name: charName,
        currentLevel: 1,
        targetLevel: 90,
        skillLevels: {
            normal: { current: 1, target: 10 },
            main: { current: 1, target: 10 },
            assist: { current: 1, target: 10 },
            ultimate: { current: 1, target: 10 }
        }
    };
    
    resourcesState.selectedCharacters.push(selectedChar);
    
    // Calculate resources immediately
    calculateCharacterResources(characterId);
    
    // Rebuild item usage index
    buildItemUsageIndex();
    
    // Close modal
    closeCharacterResourceSelect();
    
    // Update UI
    renderSelectedCharactersList();
    renderResourceSummary();
    
    // Save state
    saveResourcesState();
    
    showToast(`${charName}이(가) 추가되었습니다`, 'success');
}

// Update character level
function updateCharacterLevel(characterId, field, value) {
    const selectedChar = resourcesState.selectedCharacters.find(c => c.id === characterId);
    if (!selectedChar) return;
    
    const numValue = parseInt(value) || 1;
    const clampedValue = Math.max(1, Math.min(90, numValue));
    
    // Show feedback if value was clamped
    if (clampedValue !== numValue) {
        showToast(`값이 ${clampedValue}(으)로 조정되었습니다`, 'info');
    }
    
    selectedChar[field] = clampedValue;
    
    // Recalculate resources
    calculateCharacterResources(characterId);
    buildItemUsageIndex();
    renderResourceSummary();
    saveResourcesState();
}

// Update character skill level
function updateCharacterSkillLevel(characterId, skillType, field, value) {
    const selectedChar = resourcesState.selectedCharacters.find(c => c.id === characterId);
    if (!selectedChar) return;
    
    const numValue = parseInt(value) || 1;
    const clampedValue = Math.max(1, Math.min(10, numValue));
    
    // Show feedback if value was clamped
    if (clampedValue !== numValue) {
        showToast(`값이 ${clampedValue}(으)로 조정되었습니다`, 'info');
    }
    
    selectedChar.skillLevels[skillType][field] = clampedValue;
    
    // Recalculate resources
    calculateCharacterResources(characterId);
    buildItemUsageIndex();
    renderResourceSummary();
    saveResourcesState();
}

// Calculate required resources for a character
function calculateCharacterResources(characterId) {
    const selectedChar = resourcesState.selectedCharacters.find(c => c.id === characterId);
    const character = resourcesState.characters[characterId];
    
    if (!selectedChar || !character) return;
    
    const resources = {
        exp: 0,
        expItems: {},
        skillItems: {},
        advanceItems: {},
        gold: 0,
        levelupGold: 0 // Gold for levelup (150 per 1000 EXP)
    };

    // Calculate EXP required for leveling
    const currentLevel = selectedChar.currentLevel;
    const targetLevel = selectedChar.targetLevel;

    for (let level = currentLevel + 1; level <= targetLevel; level++) {
        const levelId = 10000 + level;
        const levelData = resourcesState.characterUpgrade[levelId];
        if (levelData && levelData.Exp) {
            resources.exp += levelData.Exp;
        }
    }

    // Calculate gold for levelup (150 gold per 1000 EXP)
    resources.levelupGold = Math.round((resources.exp / 1000) * 150);
    
    // Calculate advance materials needed
    // Advance happens at levels 10, 20, 30, 40, 50, 60, 70, 80
    const advanceLevels = [10, 20, 30, 40, 50, 60, 70, 80];
    const advanceGroup = character.AdvanceGroup;
    
    if (advanceGroup) {
        advanceLevels.forEach(advLevel => {
            // Check if we need this advance (target >= advLevel and current < advLevel)
            if (targetLevel >= advLevel && currentLevel < advLevel) {
                const advanceLvl = advLevel / 10; // Convert 10->1, 20->2, etc.
                
                // Find the advance data for this character and level
                const advanceData = Object.values(resourcesState.characterAdvance)
                    .find(adv => adv.Group === advanceGroup && adv.AdvanceLvl === advanceLvl);
                
                if (advanceData) {
                    // Add gold cost
                    if (advanceData.GoldQty) {
                        resources.gold += advanceData.GoldQty;
                    }
                    
                    // Add item costs (Tid1/Qty1 through Tid4/Qty4)
                    for (let i = 1; i <= 4; i++) {
                        const tidKey = `Tid${i}`;
                        const qtyKey = `Qty${i}`;
                        
                        if (advanceData[tidKey] && advanceData[qtyKey]) {
                            const itemId = advanceData[tidKey];
                            const qty = advanceData[qtyKey];
                            
                            if (!resources.advanceItems[itemId]) {
                                resources.advanceItems[itemId] = 0;
                            }
                            resources.advanceItems[itemId] += qty;
                        }
                    }
                }
            }
        });
    }
    
    // Calculate skill resources
    const skillTypes = ['normal', 'main', 'assist', 'ultimate'];
    const skillUpgradeGroups = character.SkillsUpgradeGroup || [];
    
    skillTypes.forEach((skillType, index) => {
        const skillGroup = skillUpgradeGroups[index];
        if (!skillGroup) return;
        
        const currentSkillLevel = selectedChar.skillLevels[skillType].current;
        const targetSkillLevel = selectedChar.skillLevels[skillType].target;
        
        // Find all skill upgrades for this group
        const skillUpgrades = Object.values(resourcesState.characterSkillUpgrade)
            .filter(upgrade => upgrade.Group === skillGroup);
        
        // Calculate resources needed from current to target level
        // Sort skill upgrades by ID to ensure correct order
        skillUpgrades.sort((a, b) => a.Id - b.Id);
        
        for (let level = currentSkillLevel; level < targetSkillLevel; level++) {
            // Data structure: 
            // - Index 0: Base level (level 1), no AdvanceNum
            // - Index 1: Upgrade 1→2 (AdvanceNum=1)
            // - Index 2: Upgrade 2→3 (AdvanceNum=2)
            // - ...
            // - Index 9: Upgrade 9→10 (should be AdvanceNum=9, but data has AdvanceNum=8)
            // To upgrade from level L to L+1, use skillUpgrades[L]
            const upgrade = skillUpgrades[level];
            
            if (upgrade) {
                // Add gold cost
                if (upgrade.GoldQty) {
                    resources.gold += upgrade.GoldQty;
                }
                
                // Add item costs (Tid1/Qty1 through Tid4/Qty4)
                for (let i = 1; i <= 4; i++) {
                    const tidKey = `Tid${i}`;
                    const qtyKey = `Qty${i}`;
                    
                    if (upgrade[tidKey] && upgrade[qtyKey]) {
                        const itemId = upgrade[tidKey];
                        const qty = upgrade[qtyKey];
                        
                        if (!resources.skillItems[itemId]) {
                            resources.skillItems[itemId] = 0;
                        }
                        resources.skillItems[itemId] += qty;
                    }
                }
            }
        }
    });
    
    // Store calculated resources
    resourcesState.characterResources[characterId] = resources;
}

// ============================================================================
// HELPER FUNCTIONS FOR MATERIAL CALCULATIONS
// ============================================================================

// Convert materials to lowest tier count
function convertToLowestTier(itemId, quantity) {
    // Check which group this item belongs to
    for (const group of [...MATERIAL_GROUPS.advance, ...MATERIAL_GROUPS.skill, ...MATERIAL_GROUPS.discAdvance]) {
        const itemIndex = group.items.indexOf(parseInt(itemId));
        if (itemIndex !== -1) {
            // Convert to lowest tier (index 0)
            const multiplier = Math.pow(group.mergeRatio, itemIndex);
            return {
                lowestItemId: group.items[0],
                convertedQuantity: quantity * multiplier
            };
        }
    }
    return null;
}

// Calculate stamina estimate for material groups
function calculateStaminaEstimate(items, type) {
    const config = STAMINA_CONFIG[type];
    let totalLowestTierCount = 0;
    
    // Convert all items to lowest tier
    for (const [itemId, qty] of Object.entries(items)) {
        const conversion = convertToLowestTier(itemId, qty);
        if (conversion) {
            totalLowestTierCount += conversion.convertedQuantity;
        }
    }
    
    if (totalLowestTierCount === 0) return null;
    
    // Calculate dungeon runs and stamina
    const dungeonRuns = Math.ceil(totalLowestTierCount / config.dungeonDrop);
    const estimatedStamina = dungeonRuns * config.dungeonStamina;
    
    // Calculate daily task days
    const estimatedDays = Math.ceil(totalLowestTierCount / config.dailyTaskReward);
    
    return {
        estimatedStamina,
        estimatedDays,
        totalLowestTierCount
    };
}

// Check if item is part of a material group
function isGroupedMaterial(itemId, type) {
    const groups = MATERIAL_GROUPS[type];
    return groups.some(group => group.items.includes(parseInt(itemId)));
}

// Get character usage for an item
function getCharactersUsingItem(itemId) {
    // Use cached index if available
    if (resourcesState.itemUsageIndex[itemId]?.characters) {
        return resourcesState.itemUsageIndex[itemId].characters
            .map(charId => resourcesState.selectedCharacters.find(c => c.id === charId))
            .filter(Boolean);
    }
    return [];
}

// Get disc usage for an item
function getDiscsUsingItem(itemId) {
    // Use cached index if available
    if (resourcesState.itemUsageIndex[itemId]?.discs) {
        return resourcesState.itemUsageIndex[itemId].discs
            .map(discId => resourcesState.selectedDiscs.find(d => d.id === discId))
            .filter(Boolean);
    }
    return [];
}

// Render selected characters list
function renderSelectedCharactersList() {
    const container = document.getElementById('selected-characters-list');
    
    if (resourcesState.selectedCharacters.length === 0) {
        container.innerHTML = `
            <div class="empty-selection-state">
                <div class="empty-icon">${getIcon('emptyClipboard')}</div>
                <p>캐릭터를 선택하여 자원 계산을 시작하세요</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    resourcesState.selectedCharacters.forEach(char => {
        const character = resourcesState.characters[char.id];
        
        const card = document.createElement('div');
        card.className = 'character-resource-card';
        card.dataset.characterId = char.id;
        card.innerHTML = `
            <div class="character-resource-header">
                <img src="assets/char/avg1_${char.id}_002.png" 
                     alt="${char.name}" 
                     class="character-resource-avatar"
                     loading="lazy"
                     onerror="this.src='assets/char/${char.id}_icon.png'">
                <div class="character-resource-info">
                    <div class="character-resource-name">${char.name}</div>
                </div>
                <div class="character-resource-actions">
                    <button class="remove-resource-btn" type="button">
                        ${getIcon('remove')} 제거
                    </button>
                </div>
            </div>
            
            <div class="character-level-controls">
                <div class="level-section">
                    <div class="level-section-title">캐릭터 레벨</div>
                    <div class="level-input-row">
                        <div class="level-input-group">
                            <label class="level-input-label">현재</label>
                            <input type="number" 
                                   class="level-input-field" 
                                   value="${char.currentLevel}"
                                   min="1" 
                                   max="90"
                                   data-level-type="character"
                                   data-field="currentLevel">
                        </div>
                        <div class="level-input-group">
                            <label class="level-input-label">목표</label>
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
                    <div class="level-section-title">스킬 레벨</div>
                    <div class="skill-level-grid">
                        <div class="skill-level-item">
                            <div class="skill-level-name">일반</div>
                            <div class="skill-level-inputs">
                                <input type="number" 
                                       class="level-input-field compact" 
                                       value="${char.skillLevels.normal.current}"
                                       min="1" 
                                       max="10"
                                       data-level-type="skill"
                                       data-skill-type="normal"
                                       data-field="current">
                                <span>→</span>
                                <input type="number" 
                                       class="level-input-field compact" 
                                       value="${char.skillLevels.normal.target}"
                                       min="1" 
                                       max="10"
                                       data-level-type="skill"
                                       data-skill-type="normal"
                                       data-field="target">
                            </div>
                        </div>
                        
                        <div class="skill-level-item">
                            <div class="skill-level-name">메인</div>
                            <div class="skill-level-inputs">
                                <input type="number" 
                                       class="level-input-field compact" 
                                       value="${char.skillLevels.main.current}"
                                       min="1" 
                                       max="10"
                                       data-level-type="skill"
                                       data-skill-type="main"
                                       data-field="current">
                                <span>→</span>
                                <input type="number" 
                                       class="level-input-field compact" 
                                       value="${char.skillLevels.main.target}"
                                       min="1" 
                                       max="10"
                                       data-level-type="skill"
                                       data-skill-type="main"
                                       data-field="target">
                            </div>
                        </div>
                        
                        <div class="skill-level-item">
                            <div class="skill-level-name">지원</div>
                            <div class="skill-level-inputs">
                                <input type="number" 
                                       class="level-input-field compact" 
                                       value="${char.skillLevels.assist.current}"
                                       min="1" 
                                       max="10"
                                       data-level-type="skill"
                                       data-skill-type="assist"
                                       data-field="current">
                                <span>→</span>
                                <input type="number" 
                                       class="level-input-field compact" 
                                       value="${char.skillLevels.assist.target}"
                                       min="1" 
                                       max="10"
                                       data-level-type="skill"
                                       data-skill-type="assist"
                                       data-field="target">
                            </div>
                        </div>
                        
                        <div class="skill-level-item">
                            <div class="skill-level-name">필살기</div>
                            <div class="skill-level-inputs">
                                <input type="number" 
                                       class="level-input-field compact" 
                                       value="${char.skillLevels.ultimate.current}"
                                       min="1" 
                                       max="10"
                                       data-level-type="skill"
                                       data-skill-type="ultimate"
                                       data-field="current">
                                <span>→</span>
                                <input type="number" 
                                       class="level-input-field compact" 
                                       value="${char.skillLevels.ultimate.target}"
                                       min="1" 
                                       max="10"
                                       data-level-type="skill"
                                       data-skill-type="ultimate"
                                       data-field="target">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Remove character from resources
function removeCharacterFromResources(characterId) {
    resourcesState.selectedCharacters = resourcesState.selectedCharacters.filter(c => c.id !== characterId);
    delete resourcesState.characterResources[characterId];
    
    buildItemUsageIndex();
    renderSelectedCharactersList();
    renderResourceSummary();
    saveResourcesState();
    
    showToast('캐릭터가 제거되었습니다', 'info');
}

// Render resource summary
function renderResourceSummary() {
    const container = document.getElementById('resource-summary-content');
    
    if (resourcesState.selectedCharacters.length === 0) {
        container.innerHTML = `
            <div class="empty-summary-state">
                <div class="empty-icon"><i class="fa-solid fa-chart-simple"></i></div>
                <p>선택된 캐릭터가 없습니다</p>
            </div>
        `;
        return;
    }
    
    // Aggregate all resources
    const totalResources = {
        exp: 0,
        advanceItems: {},
        skillItems: {},
        gold: 0,
        levelupGold: 0
    };
    
    Object.values(resourcesState.characterResources).forEach(resources => {
        totalResources.exp += resources.exp;
        totalResources.gold += resources.gold;
        totalResources.levelupGold += resources.levelupGold || 0;

        Object.entries(resources.advanceItems || {}).forEach(([itemId, qty]) => {
            if (!totalResources.advanceItems[itemId]) {
                totalResources.advanceItems[itemId] = 0;
            }
            totalResources.advanceItems[itemId] += qty;
        });

        Object.entries(resources.skillItems).forEach(([itemId, qty]) => {
            if (!totalResources.skillItems[itemId]) {
                totalResources.skillItems[itemId] = 0;
            }
            totalResources.skillItems[itemId] += qty;
        });
    });
    
    container.innerHTML = '';
    
    console.log('Total disc resources:', totalResources);
    
    // Render advance items section with stamina estimate
    if (Object.keys(totalResources.advanceItems).length > 0) {
        const advanceEstimate = calculateStaminaEstimate(totalResources.advanceItems, 'advance');
        const advanceSection = document.createElement('div');
        advanceSection.className = 'resource-category';
        
        let estimateHTML = '';
        if (advanceEstimate) {
            estimateHTML = `
                <div class="stamina-estimate">
                    <span class="estimate-item"><i class="fa-solid fa-bolt"></i> ${advanceEstimate.estimatedStamina} 스태미나</span>
                    <span class="estimate-separator">|</span>
                    <span class="estimate-item"><i class="fa-regular fa-calendar"></i> ${advanceEstimate.estimatedDays}일</span>
                </div>
            `;
        }
        
        advanceSection.innerHTML = `
            <div class="resource-category-header">
                <div class="resource-category-title">승급 아이템</div>
                ${estimateHTML}
            </div>
            <div class="resource-items-container" id="advance-items-container"></div>
        `;
        container.appendChild(advanceSection);
        
        renderAdvanceItems(totalResources.advanceItems);
    }
    
    // Render skill items section with stamina estimate
    if (Object.keys(totalResources.skillItems).length > 0) {
        const skillEstimate = calculateStaminaEstimate(totalResources.skillItems, 'skill');
        const skillSection = document.createElement('div');
        skillSection.className = 'resource-category';
        
        let estimateHTML = '';
        if (skillEstimate) {
            estimateHTML = `
                <div class="stamina-estimate">
                    <span class="estimate-item"><i class="fa-solid fa-bolt"></i> ${skillEstimate.estimatedStamina} 스태미나</span>
                    <span class="estimate-separator">|</span>
                    <span class="estimate-item"><i class="fa-regular fa-calendar"></i> ${skillEstimate.estimatedDays}일</span>
                </div>
            `;
        }
        
        skillSection.innerHTML = `
            <div class="resource-category-header">
                <div class="resource-category-title">스킬 강화 아이템</div>
                ${estimateHTML}
            </div>
            <div class="resource-items-container" id="skill-items-container"></div>
        `;
        container.appendChild(skillSection);
        
        renderSkillItems(totalResources.skillItems);
    }
    
    // Render EXP and Gold side by side at the bottom
    const totalGold = totalResources.gold + totalResources.levelupGold;
    if (totalResources.exp > 0 || totalGold > 0) {
        const bottomSection = document.createElement('div');
        bottomSection.className = 'resource-bottom-section';
        bottomSection.innerHTML = '<div class="resource-bottom-grid" id="bottom-resources-grid"></div>';
        container.appendChild(bottomSection);

        const bottomGrid = document.getElementById('bottom-resources-grid');

        // Add EXP
        if (totalResources.exp > 0) {
            const expCard = document.createElement('div');
            expCard.className = 'resource-bottom-card';
            expCard.innerHTML = `
                <div class="resource-category-title">경험치 (${totalResources.exp.toLocaleString()})</div>
                <div class="resource-items-grid" id="exp-items-grid"></div>
            `;
            bottomGrid.appendChild(expCard);
        }

        // Add Total Gold (도라)
        if (totalGold > 0) {
            const goldCard = document.createElement('div');
            goldCard.className = 'resource-bottom-card';
            goldCard.innerHTML = `
                <div class="resource-category-title">도라 (총합)</div>
                <div class="resource-items-grid">
                    <div class="resource-item">
                        <div class="resource-item-icon-wrapper">
                            <img src="assets/items/item_1.png" class="resource-item-icon" alt="도라" onerror="this.style.display='none'">
                        </div>
                        <div class="resource-item-name">도라</div>
                        <div class="resource-item-qty">${totalGold.toLocaleString()}</div>
                    </div>
                </div>
            `;
            bottomGrid.appendChild(goldCard);
        }

        // Render exp items after DOM is ready
        if (totalResources.exp > 0) {
            renderExpItems(totalResources.exp);
        }
    }

    // Render badge requirements section
    renderBadgeRequirements();
}

// Render EXP items needed
function renderExpItems(totalExp) {
    const grid = document.getElementById('exp-items-grid');
    if (!grid) return;
    
    // Calculate optimal item distribution (use largest items first)
    const expItems = Object.values(resourcesState.charItemExp)
        .sort((a, b) => b.ExpValue - a.ExpValue);
    
    const itemCounts = {};
    let remainingExp = totalExp;
    
    expItems.forEach(expItem => {
        const count = Math.floor(remainingExp / expItem.ExpValue);
        if (count > 0) {
            itemCounts[expItem.ItemId] = count;
            remainingExp -= count * expItem.ExpValue;
        }
    });
    
    // Render items
    Object.entries(itemCounts).forEach(([itemId, count]) => {
        const item = resourcesState.items[itemId];
        if (!item) return;

        const itemElement = createResourceItemElement(item, count);
        grid.appendChild(itemElement);
    });
}

// Render badge requirements
function renderBadgeRequirements() {
    const container = document.getElementById('resource-summary-content');
    if (!container || resourcesState.selectedCharacters.length === 0) return;

    // Collect all badges needed by level (70, 80, 90)
    const badgesByLevel = {
        70: [],
        80: [],
        90: []
    };

    resourcesState.selectedCharacters.forEach(charData => {
        const character = resourcesState.characters[charData.id];

        if (!character || !character.GemSlots || character.GemSlots.length !== 3) {
            return;
        }

        // Only include badges for target level >= badge level
        const targetLevel = charData.targetLevel;

        // GemSlots array has 3 items in order: 70, 80, 90
        const levels = [70, 80, 90];
        levels.forEach((level, index) => {
            if (targetLevel >= level) {
                const gemSlotId = character.GemSlots[index];
                const charGemData = resourcesState.charGem[gemSlotId];

                if (charGemData && charGemData.GenerateCostTid) {
                    const itemId = charGemData.GenerateCostTid;

                    // Find existing badge for this itemId
                    let badgeEntry = badgesByLevel[level].find(b => b.itemId === itemId);

                    if (!badgeEntry) {
                        // Create new badge entry
                        badgeEntry = {
                            itemId: itemId,
                            characters: []
                        };
                        badgesByLevel[level].push(badgeEntry);
                    }

                    // Add character to this badge
                    badgeEntry.characters.push(character);
                }
            }
        });
    });

    // Check if any badges are needed
    const hasBadges = Object.values(badgesByLevel).some(badges => badges.length > 0);
    if (!hasBadges) return;

    // Create badge section
    const badgeSection = document.createElement('div');
    badgeSection.className = 'resource-category badge-requirements-section';
    badgeSection.innerHTML = `
        <div class="resource-category-header">
            <div class="resource-category-title">뱃지 요구사항</div>
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

    // Render badges for each level
    [70, 80, 90].forEach(level => {
        const badgeContainer = document.getElementById(`badge-${level}`);
        if (!badgeContainer) return;

        badgesByLevel[level].forEach(badgeData => {
            const badgeElement = document.createElement('div');
            badgeElement.className = 'badge-item';

            // Build character icons HTML
            const characterIconsHTML = badgeData.characters.map(character => `
                <div class="badge-character-icon">
                    <img src="assets/char/avg1_${character.Id}_002.png" alt="${character.NameKR || character.Name}" onerror="this.style.display='none'">
                </div>
            `).join('');

            badgeElement.innerHTML = `
                <div class="badge-item-background">
                    <img src="assets/items/rare_item_a_3.png" alt="Badge Background" onerror="this.style.display='none'">
                </div>
                <div class="badge-item-icon">
                    <img src="assets/items/item_${badgeData.itemId}.png" alt="Badge Item" onerror="this.style.display='none'">
                </div>
                <div class="badge-character-icons-container">
                    ${characterIconsHTML}
                </div>
            `;
            badgeContainer.appendChild(badgeElement);
        });
    });
}

// Render advance items needed
function renderAdvanceItems(advanceItems) {
    const container = document.getElementById('advance-items-container');
    if (!container) return;
    
    // Separate grouped and ungrouped items
    const groupedItems = [];
    const ungroupedItems = [];
    
    Object.entries(advanceItems).forEach(([itemId, qty]) => {
        if (isGroupedMaterial(itemId, 'advance')) {
            groupedItems.push([itemId, qty]);
        } else {
            ungroupedItems.push([itemId, qty]);
        }
    });
    
    // Render grouped items in rows
    MATERIAL_GROUPS.advance.forEach(group => {
        const groupItems = groupedItems.filter(([id]) => group.items.includes(parseInt(id)));
        if (groupItems.length > 0) {
            const groupRow = document.createElement('div');
            groupRow.className = 'resource-group-row';
            
            groupItems.forEach(([itemId, qty]) => {
                const item = resourcesState.items[itemId];
                if (!item) return;
                
                const itemElement = createResourceItemElement(item, qty, itemId);
                groupRow.appendChild(itemElement);
            });
            
            container.appendChild(groupRow);
        }
    });
    
    // Render ungrouped items in a grid
    if (ungroupedItems.length > 0) {
        const ungroupedGrid = document.createElement('div');
        ungroupedGrid.className = 'resource-items-grid';
        
        ungroupedItems.forEach(([itemId, qty]) => {
            const item = resourcesState.items[itemId];
            if (!item) return;
            
            const itemElement = createResourceItemElement(item, qty, itemId);
            ungroupedGrid.appendChild(itemElement);
        });
        
        container.appendChild(ungroupedGrid);
    }
}

// Render skill items needed
function renderSkillItems(skillItems) {
    const container = document.getElementById('skill-items-container');
    if (!container) return;
    
    // Separate grouped and ungrouped items
    const groupedItems = [];
    const ungroupedItems = [];
    
    Object.entries(skillItems).forEach(([itemId, qty]) => {
        if (isGroupedMaterial(itemId, 'skill')) {
            groupedItems.push([itemId, qty]);
        } else {
            ungroupedItems.push([itemId, qty]);
        }
    });
    
    // Render grouped items in rows
    MATERIAL_GROUPS.skill.forEach(group => {
        const groupItems = groupedItems.filter(([id]) => group.items.includes(parseInt(id)));
        if (groupItems.length > 0) {
            const groupRow = document.createElement('div');
            groupRow.className = 'resource-group-row';
            
            groupItems.forEach(([itemId, qty]) => {
                const item = resourcesState.items[itemId];
                if (!item) return;
                
                const itemElement = createResourceItemElement(item, qty, itemId);
                groupRow.appendChild(itemElement);
            });
            
            container.appendChild(groupRow);
        }
    });
    
    // Render ungrouped items in a grid
    if (ungroupedItems.length > 0) {
        const ungroupedGrid = document.createElement('div');
        ungroupedGrid.className = 'resource-items-grid';
        
        ungroupedItems.forEach(([itemId, qty]) => {
            const item = resourcesState.items[itemId];
            if (!item) return;
            
            const itemElement = createResourceItemElement(item, qty, itemId);
            ungroupedGrid.appendChild(itemElement);
        });
        
        container.appendChild(ungroupedGrid);
    }
}

// Create resource item element
function createResourceItemElement(item, qty, itemId) {
    const itemName = resourcesState.itemNames[item.Title] || item.Title;
    const rarity = item.Rarity || 1;
    const bgImage = `assets/items/rare_item_a_${6 - rarity}.png`;
    
    // Extract icon filename
    let iconPath = '';
    if (item.Icon) {
        const iconParts = item.Icon.split('/');
        const iconFile = iconParts[iconParts.length - 1];
        iconPath = `assets/items/${iconFile}.png`;
    }
    
    // Get characters using this item
    const charactersUsing = itemId ? getCharactersUsingItem(itemId) : [];
    
    // Get discs using this item
    const discsUsing = itemId ? getDiscsUsingItem(itemId) : [];
    
    const div = document.createElement('div');
    div.className = 'resource-item';
    
    let characterIconsHTML = '';
    const totalIcons = charactersUsing.length + discsUsing.length;
    
    if (totalIcons > 0) {
        const maxVisible = 3;
        const visibleCharacters = charactersUsing.slice(0, Math.min(maxVisible, charactersUsing.length));
        const visibleDiscs = discsUsing.slice(0, Math.max(0, maxVisible - charactersUsing.length));
        const remaining = totalIcons - visibleCharacters.length - visibleDiscs.length;
        
        characterIconsHTML = `
            <div class="character-icons-overlay">
                ${visibleCharacters.map(char => `
                    <img src="assets/char/avg1_${char.id}_002.png" 
                         class="character-icon-small" 
                         alt="${char.name}"
                         title="${char.name}"
                         onerror="this.style.display='none'">
                `).join('')}
                ${visibleDiscs.map(disc => {
                    let discIconPath = '';
                    if (disc.data.DiscBg) {
                        const fileId = disc.data.DiscBg.split('/').pop();
                        discIconPath = `assets/disc_icons/outfit_${fileId}.png`;
                    }
                    return `
                        <img src="${discIconPath}" 
                             class="character-icon-small" 
                             alt="${disc.name}"
                             title="${disc.name}"
                             onerror="this.style.display='none'">
                    `;
                }).join('')}
                ${remaining > 0 ? `<div class="character-icons-more" title="${remaining}개 더">+${remaining}</div>` : ''}
            </div>
        `;
    }
    
    div.innerHTML = `
        <div class="resource-item-icon-wrapper">
            <img src="${bgImage}" class="resource-item-bg" alt="background" onerror="this.style.display='none'">
            <img src="${iconPath}" class="resource-item-icon" alt="${itemName}" onerror="this.style.display='none'">
            ${characterIconsHTML}
        </div>
        <div class="resource-item-name">${itemName}</div>
        <div class="resource-item-qty">×${qty.toLocaleString()}</div>
    `;
    
    return div;
}

// Clear all selected characters and resources
function clearAllResources() {
    if (resourcesState.selectedCharacters.length === 0) {
        showToast('초기화할 데이터가 없습니다', 'info');
        return;
    }
    
    if (confirm('모든 선택된 캐릭터와 계산된 자원을 초기화하시겠습니까?')) {
        resourcesState.selectedCharacters = [];
        resourcesState.characterResources = {};
        
        buildItemUsageIndex();
        renderSelectedCharactersList();
        renderResourceSummary();
        saveResourcesState();
        
        showToast('모든 데이터가 초기화되었습니다', 'success');
    }
}

// Show resource help modal
function showResourceHelp() {
    const modal = document.getElementById('resource-help-modal');
    modal.classList.add('active');
}

// Close resource help modal
function closeResourceHelp() {
    const modal = document.getElementById('resource-help-modal');
    modal.classList.remove('active');
}

// ============================================================================
// DISC RESOURCE MANAGEMENT
// ============================================================================

// Open disc selection modal
function openDiscResourceSelect() {
    const modal = document.getElementById('disc-resource-modal');
    const grid = document.getElementById('disc-resource-grid');
    
    grid.innerHTML = '';
    
    // Get all available and visible discs (3-star and above)
    const availableDiscs = Object.entries(resourcesState.discs)
        .filter(([id, disc]) => disc.Visible && disc.Available)
        .sort((a, b) => parseInt(b[0]) - parseInt(a[0])); // Sort from high to low ID
    
    availableDiscs.forEach(([id, disc]) => {
        // Determine rarity based on StrengthenGroupId
        const rarityStars = disc.StrengthenGroupId === 41 ? 5 : 
                           disc.StrengthenGroupId === 31 ? 4 : 3;
        
        // Get disc name from DiscIP
        const discIPData = resourcesState.discIP[id];
        const discNameKey = discIPData?.StoryName;
        const discName = discNameKey ? (resourcesState.discIPNames[discNameKey] || discNameKey) : `레코드 ${id}`;
        
        // Get element icon
        const elementInfo = resourcesState.gameEnums.elementType?.[disc.EET];
        const elementIcon = elementInfo?.icon || '';
        
        // Check if already selected
        const isSelected = resourcesState.selectedDiscs.some(d => d.id === id);
        
        const discItem = document.createElement('div');
        discItem.className = `disc-item ${isSelected ? 'disabled' : ''}`;
        discItem.dataset.discId = id;
        discItem.dataset.rarity = rarityStars;
        discItem.dataset.name = discName;
        
        // Get disc icon - extract file ID from DiscBg field
        // e.g., "Disc/1001/1001" -> "1001"
        let discIconPath = '';
        if (disc.DiscBg) {
            const fileId = disc.DiscBg.split('/').pop();
            discIconPath = `assets/disc_icons/outfit_${fileId}.png`;
        }
        
        discItem.innerHTML = `
            <img src="${discIconPath}" class="disc-item-image" alt="Disc ${id}" loading="lazy" onerror="this.style.display='none'">
            <div class="disc-item-info">
                <div class="disc-item-name">
                    ${discName}
                    ${elementIcon ? `<img src="${elementIcon}" alt="Element" class="element-icon-inline" style="width: 20px; height: 20px; margin-left: 6px; vertical-align: middle;" onerror="this.style.display='none'">` : ''}
                </div>
                <div class="disc-item-grade">${'⭐'.repeat(rarityStars)}</div>
                <div class="disc-item-id">ID: ${id}</div>
            </div>
        `;
        
        grid.appendChild(discItem);
    });
    
    modal.classList.add('active');
}

// Close disc selection modal
function closeDiscResourceSelect() {
    document.getElementById('disc-resource-modal').classList.remove('active');
}

// Select a disc
function selectDisc(discId, rarity, name) {
    const disc = resourcesState.discs[discId];
    
    resourcesState.selectedDiscs.push({
        id: discId,
        name: name,
        rarity: rarity,
        currentLevel: 1,
        targetLevel: 90,
        data: disc
    });
    
    calculateDiscResources(discId);
    buildItemUsageIndex();
    renderSelectedDiscsList();
    renderDiscResourceSummary();
    saveResourcesState();
    closeDiscResourceSelect();
}

// Calculate resources needed for a disc
function calculateDiscResources(discId) {
    const disc = resourcesState.selectedDiscs.find(d => d.id === discId);
    if (!disc) return;
    
    const currentLevel = disc.currentLevel;
    const targetLevel = disc.targetLevel;
    const rarity = disc.rarity;
    
    // Calculate EXP needed
    let totalExp = 0;
    let expGroupPrefix = rarity === 5 ? 41 : rarity === 4 ? 31 : 11;
    
    for (let level = currentLevel; level < targetLevel; level++) {
        const strengthenId = `${expGroupPrefix}${String(level + 1).padStart(3, '0')}`;
        const strengthenData = resourcesState.discStrengthen[strengthenId];
        if (strengthenData && strengthenData.Exp) {
            totalExp += strengthenData.Exp;
        }
    }
    
    // Calculate advance materials (승급)
    const advanceItems = {};
    let advanceGold = 0;
    const advanceLevels = [10, 20, 30, 40, 50, 60, 70, 80];

    advanceLevels.forEach((advLevel, index) => {
        if (currentLevel < advLevel && targetLevel >= advLevel) {
            const promoteGroupId = disc.data.PromoteGroupId;
            const advanceNum = index + 1; // 1-based (1-8)
            const promoteId = `${promoteGroupId}${String(advanceNum).padStart(3, '0')}`; // Changed to 3 digits: 001-008
            const promoteData = resourcesState.discPromote[promoteId];

            if (promoteData) {
                // Add gold cost from ExpenseGold
                if (promoteData.ExpenseGold) {
                    advanceGold += promoteData.ExpenseGold;
                }

                // Add ItemId1~ItemId3 and their quantities
                for (let i = 1; i <= 3; i++) {
                    const itemIdKey = `ItemId${i}`;
                    const numKey = `Num${i}`;

                    if (promoteData[itemIdKey]) {
                        const itemId = promoteData[itemIdKey];
                        const qty = promoteData[numKey] || 0;

                        if (qty > 0) {
                            if (!advanceItems[itemId]) {
                                advanceItems[itemId] = 0;
                            }
                            advanceItems[itemId] += qty;
                        }
                    }
                }
            }
        }
    });

    // Calculate gold for levelup (250 gold per 1000 EXP)
    const levelupGold = Math.round((totalExp / 1000) * 250);

    // Store in state
    resourcesState.discResources[discId] = {
        exp: totalExp,
        advanceItems: advanceItems,
        gold: advanceGold,
        levelupGold: levelupGold
    };
}

// Update disc levels
function updateDiscLevel(discId, field, value) {
    const disc = resourcesState.selectedDiscs.find(d => d.id === discId);
    if (!disc) return;
    
    const newValue = Math.max(1, Math.min(90, parseInt(value) || 1));
    
    // Show feedback if value was clamped
    if (newValue !== parseInt(value)) {
        showToast(`값이 ${newValue}(으)로 조정되었습니다`, 'info');
    }
    
    disc[field] = newValue;
    
    // Ensure currentLevel <= targetLevel
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

// Remove disc from resources
function removeDiscFromResources(discId) {
    resourcesState.selectedDiscs = resourcesState.selectedDiscs.filter(d => d.id !== discId);
    delete resourcesState.discResources[discId];
    
    buildItemUsageIndex();
    renderSelectedDiscsList();
    renderDiscResourceSummary();
    saveResourcesState();
    
    showToast('레코드가 제거되었습니다', 'info');
}

// Render selected discs list
function renderSelectedDiscsList() {
    const container = document.getElementById('selected-discs-list');
    
    if (resourcesState.selectedDiscs.length === 0) {
        container.innerHTML = `
            <div class="empty-selection-state">
                <div class="empty-icon"><i class="fa-regular fa-clipboard"></i></div>
                <p>레코드를 선택하여 자원 계산을 시작하세요</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    resourcesState.selectedDiscs.forEach(disc => {
        // Get disc icon - extract file ID from DiscBg field
        // e.g., "Disc/1001/1001" -> "1001"
        let discIconPath = '';
        if (disc.data.DiscBg) {
            const fileId = disc.data.DiscBg.split('/').pop();
            discIconPath = `assets/disc_icons/outfit_${fileId}.png`;
        }
        
        // Get element icon
        const elementInfo = resourcesState.gameEnums.elementType?.[disc.data.EET];
        const elementIcon = elementInfo?.icon || '';
        const elementName = elementInfo?.name || '';
        
        const card = document.createElement('div');
        card.className = 'character-resource-card';
        card.dataset.discId = disc.id;
        
        card.innerHTML = `
            <div class="character-resource-header">
                <img src="${discIconPath}" class="character-resource-avatar" alt="Disc ${disc.id}" loading="lazy" onerror="this.style.display='none'">
                <div class="character-resource-info">
                    <div class="character-resource-name" style="display: flex; align-items: center; gap: 8px;">
                        <span>${disc.name}</span>
                        ${elementIcon ? `<img src="${elementIcon}" alt="${elementName}" class="element-icon-inline" style="width: 22px; height: 22px;" onerror="this.style.display='none'">` : ''}
                        <span style="color: #ffd700;">${'⭐'.repeat(disc.rarity)}</span>
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
                    <div class="level-section-title">레벨</div>
                    <div class="level-input-row">
                        <div class="level-input-group">
                            <label class="level-input-label">현재 레벨</label>
                            <input type="number" 
                                   class="level-input-field" 
                                   value="${disc.currentLevel}" 
                                   min="1" 
                                   max="90"
                                   data-field="currentLevel">
                        </div>
                        <div class="level-input-group">
                            <label class="level-input-label">목표 레벨</label>
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
}

// Render disc resource summary
function renderDiscResourceSummary() {
    const container = document.getElementById('disc-resource-summary-content');
    
    if (resourcesState.selectedDiscs.length === 0) {
        container.innerHTML = `
            <div class="empty-summary-state">
                <div class="empty-icon"><i class="fa-solid fa-chart-simple"></i></div>
                <p>선택된 레코드가 없습니다</p>
            </div>
        `;
        return;
    }
    
    // Aggregate all resources
    const totalResources = {
        exp: 0,
        advanceItems: {},
        gold: 0,
        levelupGold: 0
    };

    Object.values(resourcesState.discResources).forEach(resources => {
        totalResources.exp += resources.exp;
        totalResources.gold += resources.gold;
        totalResources.levelupGold += resources.levelupGold || 0;

        Object.entries(resources.advanceItems || {}).forEach(([itemId, qty]) => {
            if (!totalResources.advanceItems[itemId]) {
                totalResources.advanceItems[itemId] = 0;
            }
            totalResources.advanceItems[itemId] += qty;
        });
    });
    
    container.innerHTML = '';
    
    console.log('Total disc resources:', totalResources);
    
    // Render advance items section
    if (Object.keys(totalResources.advanceItems).length > 0) {
        console.log('Rendering disc advance items:', totalResources.advanceItems);
        const advanceEstimate = calculateStaminaEstimate(totalResources.advanceItems, 'discAdvance');
        const advanceSection = document.createElement('div');
        advanceSection.className = 'resource-category';
        
        let estimateHTML = '';
        if (advanceEstimate) {
            estimateHTML = `
                <div class="stamina-estimate">
                    <span class="estimate-item"><i class="fa-solid fa-bolt"></i> ${advanceEstimate.estimatedStamina} 스태미나</span>
                    <span class="estimate-separator">|</span>
                    <span class="estimate-item"><i class="fa-regular fa-calendar"></i> ${advanceEstimate.estimatedDays}일</span>
                </div>
            `;
        }
        
        advanceSection.innerHTML = `
            <div class="resource-category-header">
                <div class="resource-category-title">승급 아이템</div>
                ${estimateHTML}
            </div>
            <div class="resource-items-container" id="disc-advance-items-container"></div>
        `;
        container.appendChild(advanceSection);
        
        renderDiscAdvanceItems(totalResources.advanceItems);
    }
    
    // Render EXP and Gold
    const totalGold = totalResources.gold + totalResources.levelupGold;
    if (totalResources.exp > 0 || totalGold > 0) {
        const expSection = document.createElement('div');
        expSection.className = 'resource-bottom-section';
        expSection.innerHTML = '<div class="resource-bottom-grid" id="disc-bottom-grid"></div>';
        container.appendChild(expSection);

        const bottomGrid = document.getElementById('disc-bottom-grid');

        // Add EXP card
        if (totalResources.exp > 0) {
            const expCard = document.createElement('div');
            expCard.className = 'resource-bottom-card';
            expCard.innerHTML = `
                <div class="resource-category-title">경험치 (${totalResources.exp.toLocaleString()})</div>
                <div class="resource-items-grid" id="disc-exp-items-grid"></div>
            `;
            bottomGrid.appendChild(expCard);

            // Calculate disc exp items needed
            const expItems = {};
            let remainingExp = totalResources.exp;

            // Use disc exp items from DiscItemExp.json
            const discExpItems = [
                { itemId: 50004, exp: 20000 },
                { itemId: 50003, exp: 10000 },
                { itemId: 50002, exp: 5000 },
                { itemId: 50001, exp: 1000 }
            ];

            discExpItems.forEach(({ itemId, exp }) => {
                const count = Math.floor(remainingExp / exp);
                if (count > 0) {
                    expItems[itemId] = count;
                    remainingExp -= count * exp;
                }
            });

            // Render exp items
            const expGrid = document.getElementById('disc-exp-items-grid');
            if (expGrid) {
                Object.entries(expItems).forEach(([itemId, qty]) => {
                    const item = resourcesState.items[itemId];
                    if (item) {
                        const itemElement = createResourceItemElement(item, qty, itemId);
                        expGrid.appendChild(itemElement);
                    }
                });
            }
        }

        // Add Total Gold card
        if (totalGold > 0) {
            const goldCard = document.createElement('div');
            goldCard.className = 'resource-bottom-card';
            goldCard.innerHTML = `
                <div class="resource-category-title">도라 (총합)</div>
                <div class="resource-items-grid">
                    <div class="resource-item">
                        <div class="resource-item-icon-wrapper">
                            <img src="assets/items/item_1.png" class="resource-item-icon" alt="도라" onerror="this.style.display='none'">
                        </div>
                        <div class="resource-item-name">도라</div>
                        <div class="resource-item-qty">${totalGold.toLocaleString()}</div>
                    </div>
                </div>
            `;
            bottomGrid.appendChild(goldCard);
        }
    }
}

// Render disc advance items
function renderDiscAdvanceItems(advanceItems) {
    const container = document.getElementById('disc-advance-items-container');
    if (!container) {
        return;
    }
    
    container.innerHTML = '';
    
    // Group items
    const groupedItems = [];
    const ungroupedItems = [];
    
    Object.entries(advanceItems).forEach(([itemId, qty]) => {
        if (isGroupedMaterial(parseInt(itemId), 'discAdvance')) {
            groupedItems.push([parseInt(itemId), qty]);
        } else {
            ungroupedItems.push([parseInt(itemId), qty]);
        }
    });
    
    // Render grouped items in rows of 3
    MATERIAL_GROUPS.discAdvance.forEach(group => {
        const groupItems = groupedItems.filter(([itemId]) => group.items.includes(itemId));
        if (groupItems.length > 0) {
            const groupRow = document.createElement('div');
            groupRow.className = 'resource-group-row';
            
            groupItems.forEach(([itemId, qty]) => {
                const item = resourcesState.items[itemId];
                if (!item) return;
                
                const itemElement = createResourceItemElement(item, qty, itemId);
                groupRow.appendChild(itemElement);
            });
            
            container.appendChild(groupRow);
        }
    });
    
    // Render ungrouped items in a grid
    if (ungroupedItems.length > 0) {
        const ungroupedGrid = document.createElement('div');
        ungroupedGrid.className = 'resource-items-grid';
        
        ungroupedItems.forEach(([itemId, qty]) => {
            const item = resourcesState.items[itemId];
            if (!item) return;
            
            const itemElement = createResourceItemElement(item, qty, itemId);
            ungroupedGrid.appendChild(itemElement);
        });
        
        container.appendChild(ungroupedGrid);
    }
}

// Clear all disc resources
function clearAllDiscResources() {
    if (resourcesState.selectedDiscs.length === 0) {
        showToast('초기화할 데이터가 없습니다', 'info');
        return;
    }
    
    if (confirm('모든 선택된 레코드와 계산된 자원을 초기화하시겠습니까?')) {
        resourcesState.selectedDiscs = [];
        resourcesState.discResources = {};
        
        buildItemUsageIndex();
        renderSelectedDiscsList();
        renderDiscResourceSummary();
        saveResourcesState();
        
        showToast('모든 데이터가 초기화되었습니다', 'success');
    }
}

// Show disc resource help modal
function showDiscResourceHelp() {
    const modal = document.getElementById('disc-resource-help-modal');
    modal.classList.add('active');
}

// Close disc resource help modal
function closeDiscResourceHelp() {
    const modal = document.getElementById('disc-resource-help-modal');
    modal.classList.remove('active');
}

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', initResourcesPage);

// Modal click handler to close when clicking outside
document.addEventListener('click', function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.classList.remove('active');
        }
    });
});
