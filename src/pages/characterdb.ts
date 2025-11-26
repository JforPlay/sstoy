/**
 * Character Database
 * Displays character stats, skills, talents, and dating information
 *
 * Sections: State & Cache | Data Loading | Character Selection | Stats & Archive |
 *           Dating | Potentials | Skills | Talents | Image Gallery | Event Handlers
 */

// Import shared utilities first (auto-initializes)
import '@/shared';
import { parseElementTags, debounce, showError, showWarning, handleImageError, createEmptyState } from '@/shared';
import { i18n } from '@/i18n';
import { parseParamValue, formatValue, parseDescriptionParams } from '@/modules/param-parser';
import { saveToLocalStorage, loadFromLocalStorage, removeFromLocalStorage } from '@/utils/storage';
import type { ParamParserState } from '@/types';

// =============================================================================
// STATE & INTERFACES
// =============================================================================

interface CharacterDBState extends ParamParserState {
    characters: Record<string, any>;
    charactersKR: Record<string, any>;
    characterDes: Record<string, any>;
    characterDesKR: Record<string, any>;
    characterTagKR: Record<string, any>;
    affinityGifts: Record<string, any>;
    items: Record<string, any>;
    itemsKR: Record<string, any>;
    attributes: Record<string, any>;
    characterArchive: Record<string, any>;
    characterArchiveContent: Record<string, any>;
    characterArchiveContentKR: Record<string, any>;
    datingEvents: Record<string, any>;
    datingLandmarkKR: Record<string, any>;
    datingBranchKR: Record<string, any>;
    charGetLines: Record<string, any>;
    charGetLinesKR: Record<string, any>;
    gameEnums: Record<string, any>;
    uiText: Record<string, any>;
    selectedCharacterId: string | null;
    currentLevel: number;
    currentLimitBreak: number;
    selectedCharacterType: string;
    skillLevel: number;
    talentGroups: Record<string, any>;
    talentGroupsKR: Record<string, any>;
    talents: Record<string, any>;
    talentsKR: Record<string, any>;
    domCache: Record<string, any>;
    tagToGiftsMap: Record<string, any>;
    charPotentials: Record<string, any>;
    potentials: Record<string, any>;
    potentialsKR: Record<string, any>;
    skills: Record<string, any>;
    skillsKR: Record<string, any>;
    effectValue: Record<string, any>;
    hitDamage: Record<string, any>;
    onceAdditionalAttributeValue: Record<string, any>;
    scriptParameterValue: Record<string, any>;
    buffValue: Record<string, any>;
    shieldValue: Record<string, any>;
    currentPotentialType: string;
    potentialLevel: number;
}

// Character Database State
const dbState: CharacterDBState = {
    characters: {},
    charactersKR: {},
    characterDes: {},
    characterDesKR: {},
    characterTagKR: {},
    affinityGifts: {},
    items: {},
    itemsKR: {},
    attributes: {},
    characterArchive: {},
    characterArchiveContent: {},
    characterArchiveContentKR: {},
    datingEvents: {},
    datingLandmarkKR: {},
    datingBranchKR: {},
    charGetLines: {},
    charGetLinesKR: {},
    gameEnums: {},
    uiText: {},
    selectedCharacterId: null,
    currentLevel: 1,
    currentLimitBreak: 0,
    selectedCharacterType: '01', // 01=일반, 02=각성, 03=스킨
    skillLevel: 1, // Global skill level (1-13)
    talentGroups: {},
    talentGroupsKR: {},
    talents: {},
    talentsKR: {},
    // Cached DOM elements
    domCache: {},
    // Pre-computed tag to gifts map for performance
    tagToGiftsMap: {},
    charPotentials: {},
    potentials: {},
    potentialsKR: {},
    skills: {},
    skillsKR: {},
    effectValue: {},
    hitDamage: {},
    onceAdditionalAttributeValue: {},
    scriptParameterValue: {},
    buffValue: {},
    shieldValue: {},
    currentPotentialType: 'main',
    potentialLevel: 1
};

// Element colors
const ELEMENT_COLORS = {
    1: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', color: '#3b82f6', name: '물' },   // Water - Blue
    2: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', color: '#ef4444', name: '불' },     // Fire - Red
    3: { bg: 'rgba(120, 53, 15, 0.15)', border: '#92400e', color: '#92400e', name: '땅' },    // Earth - Brown
    4: { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e', color: '#22c55e', name: '바람' },  // Wind - Green
    5: { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', color: '#eab308', name: '빛' },    // Light - Yellow
    6: { bg: 'rgba(139, 92, 246, 0.15)', border: '#8b5cf6', color: '#8b5cf6', name: '어둠' }  // Dark - Purple
};

// Stat display names (Korean)
const STAT_NAMES = {
    'Atk': '공격력',
    'Hp': '생명력',
    'Def': '방어력',
    'HitRate': '명중률',
    'CritRate': '치명타 확률',
    'CritPower': '치명타 위력',
    'ToughnessDamageAdjust': '강인도 데미지 배율',
    'WEE': '물 원소 강화',
    'FEE': '불 원소 강화',
    'SEE': '땅 원소 강화',
    'AEE': '바람 원소 강화',
    'LEE': '빛 원소 강화',
    'DEE': '어둠 원소 강화'
};

// Stat icons (for display) - Using Font Awesome via window.getIcon?.()
const STAT_ICONS = {
    'Atk': 'attack',
    'Hp': 'hp',
    'Def': 'defense',
    'HitRate': 'accuracy',
    'CritRate': 'critRate',
    'CritPower': 'critPower',
    'ToughnessDamageAdjust': 'toughness'
};

// Main stats to display (in order)
const MAIN_STATS = ['Atk', 'Hp', 'Def', 'HitRate', 'CritRate', 'CritPower', 'ToughnessDamageAdjust'];

// Data version for cache invalidation
const DATA_VERSION = '1.1.=10'; // update 11/18

/**
 * Cache DOM elements for better performance
 */
function cacheDOMElements() {
    dbState.domCache = {
        characterDetails: document.getElementById('character-details'),
        characterSelector: document.getElementById('character-selector'),
        charName: document.getElementById('char-name'),
        charElementIcon: document.getElementById('char-element-icon'),
        charGrade: document.getElementById('char-grade'),
        charTags: document.getElementById('char-tags'),
        charAdditionalInfo: document.getElementById('char-additional-info'),
        charQuickStats: document.getElementById('char-quick-stats'),
        charImageGallery: document.getElementById('char-image-gallery'),
        charPortrait: document.getElementById('char-portrait'),
        statsGrid: document.getElementById('stats-grid'),
        archiveList: document.getElementById('archive-list'),
        datingList: document.getElementById('dating-list'),
        levelSlider: document.getElementById('level-slider'),
        currentLevel: document.getElementById('current-level'),
        currentLimitbreak: document.getElementById('current-limitbreak'),
        limitbreakBadge: document.getElementById('limitbreak-badge'),
        heroSection: document.querySelector('.character-hero-section'),
        potentialsDisplay: document.getElementById('potentials-display'),
        skillsDisplay: document.getElementById('skills-display'),
        talentsDisplay: document.getElementById('talents-display')
    };
}

/**
 * Build tag to gifts map for optimized lookups
 */
function buildTagToGiftsMap() {
    dbState.tagToGiftsMap = {};
    for (const giftId in dbState.affinityGifts) {
        const gift = dbState.affinityGifts[giftId];
        if (gift.Tags && Array.isArray(gift.Tags)) {
            gift.Tags.forEach((tag: any) => {
                if (!dbState.tagToGiftsMap[tag]) {
                    dbState.tagToGiftsMap[tag] = [];
                }
                dbState.tagToGiftsMap[tag].push(gift);
            });
        }
    }
}

/**
 * Save data to localStorage with version
 */
function saveDataToCache(data: any): void {
    const cacheData = {
        version: DATA_VERSION,
        timestamp: Date.now(),
        data: data
    };
    saveToLocalStorage('characterdb_data', cacheData);
}

/**
 * Load data from localStorage if valid
 */
function loadDataFromCache() {
    const cacheData = loadFromLocalStorage<{ version: string; timestamp: number; data: any }>('characterdb_data');
    if (!cacheData) return null;

    // Check version and age (cache for 24 hours)
    const age = Date.now() - cacheData.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (cacheData.version === DATA_VERSION && age < maxAge) {
        return cacheData.data;
    }

    // Clear old cache
    removeFromLocalStorage('characterdb_data');
    return null;
}

/**
 * Load all required data files
 */
async function loadData() {
    // Try to load from cache first (but only if language hasn't changed)
    const cachedData = loadDataFromCache();
    const currentLang = window.i18n?.currentLang || 'KR';
    if (cachedData && cachedData.language === currentLang) {
        Object.assign(dbState, cachedData);
        cacheDOMElements();
        buildTagToGiftsMap();
        renderCharacterSelector();
        await loadPotentialData();
        return;
    }
    try {
        // Get current language from i18n
        const gameLang = window.i18n?.currentLang || 'KR';
        const dataPath = window.i18n?.getDataPath(gameLang) || 'data/KR';

        const [
            charactersData,
            charactersKRData,
            characterDesData,
            characterDesKRData,
            characterTagKRData,
            affinityGiftsData,
            itemsData,
            itemsKRData,
            attributesData,
            archiveData,
            archiveContentData,
            archiveContentKRData,
            datingData,
            datingLandmarkData,
            datingBranchData,
            charGetLinesData,
            charGetLinesKRData,
            enumsData,
            talentGroupsData,
            talentGroupsKRData,
            talentsData,
            talentsKRData,
            uiTextData
        ] = await Promise.all([
            fetch('data/Character.json').then(r => r.json()),
            fetch(`${dataPath}/Character.json`).then(r => r.json()),
            fetch('data/CharacterDes.json').then(r => r.json()),
            fetch(`${dataPath}/CharacterDes.json`).then(r => r.json()),
            fetch(`${dataPath}/CharacterTag.json`).then(r => r.json()),
            fetch('data/AffinityGift.json').then(r => r.json()),
            fetch('data/Item.json').then(r => r.json()),
            fetch(`${dataPath}/Item.json`).then(r => r.json()),
            fetch('data/Attribute.json').then(r => r.json()),
            fetch('data/CharacterArchive.json').then(r => r.json()),
            fetch('data/CharacterArchiveContent.json').then(r => r.json()),
            fetch(`${dataPath}/CharacterArchiveContent.json`).then(r => r.json()),
            fetch('data/DatingCharacterEvent.json').then(r => r.json()),
            fetch(`${dataPath}/DatingLandmark.json`).then(r => r.json()),
            fetch(`${dataPath}/DatingBranch.json`).then(r => r.json()),
            fetch('data/CharGetLines.json').then(r => r.json()),
            fetch(`${dataPath}/CharGetLines.json`).then(r => r.json()),
            fetch('data/GameEnums.json').then(r => r.json()),
            fetch('data/TalentGroup.json').then(r => r.json()),
            fetch(`${dataPath}/TalentGroup.json`).then(r => r.json()),
            fetch('data/Talent.json').then(r => r.json()),
            fetch(`${dataPath}/Talent.json`).then(r => r.json()),
            fetch(`${dataPath}/UIText.json`).then(r => r.json())
        ]);

        dbState.characters = charactersData;
        dbState.charactersKR = charactersKRData;
        dbState.characterDes = characterDesData;
        dbState.characterDesKR = characterDesKRData;
        dbState.characterTagKR = characterTagKRData;
        dbState.affinityGifts = affinityGiftsData;
        dbState.items = itemsData;
        dbState.itemsKR = itemsKRData;
        dbState.attributes = attributesData;
        dbState.characterArchive = archiveData;
        dbState.characterArchiveContent = archiveContentData;
        dbState.characterArchiveContentKR = archiveContentKRData;
        dbState.datingEvents = datingData;
        dbState.datingLandmarkKR = datingLandmarkData;
        dbState.datingBranchKR = datingBranchData;
        dbState.charGetLines = charGetLinesData;
        dbState.charGetLinesKR = charGetLinesKRData;
        dbState.gameEnums = enumsData;
        dbState.talentGroups = talentGroupsData;
        dbState.talentGroupsKR = talentGroupsKRData;
        dbState.talents = talentsData;
        dbState.talentsKR = talentsKRData;
        dbState.uiText = uiTextData;

        // Save to cache with language info
        const dataToCache = {
            language: gameLang,
            characters: dbState.characters,
            charactersKR: dbState.charactersKR,
            characterDes: dbState.characterDes,
            characterDesKR: dbState.characterDesKR,
            characterTagKR: dbState.characterTagKR,
            affinityGifts: dbState.affinityGifts,
            items: dbState.items,
            itemsKR: dbState.itemsKR,
            attributes: dbState.attributes,
            characterArchive: dbState.characterArchive,
            characterArchiveContent: dbState.characterArchiveContent,
            characterArchiveContentKR: dbState.characterArchiveContentKR,
            datingEvents: dbState.datingEvents,
            datingLandmarkKR: dbState.datingLandmarkKR,
            datingBranchKR: dbState.datingBranchKR,
            charGetLines: dbState.charGetLines,
            charGetLinesKR: dbState.charGetLinesKR,
            gameEnums: dbState.gameEnums,
            talentGroups: dbState.talentGroups,
            talentGroupsKR: dbState.talentGroupsKR,
            talents: dbState.talents,
            talentsKR: dbState.talentsKR,
            uiText: dbState.uiText
        };
        saveDataToCache(dataToCache);

        // Cache DOM elements and build maps
        cacheDOMElements();
        buildTagToGiftsMap();

        renderCharacterSelector();

        // Load potential data
        await loadPotentialData();
    } catch (error) {
        console.error('Error loading data:', error);
        window.showError?.(window.i18n?.t('messages.error_loading') || 'Error loading data');

        // Try to load from cache as fallback
        const cachedData = loadDataFromCache();
        if (cachedData) {
            console.log('Falling back to cached data');
            Object.assign(dbState, cachedData);
            cacheDOMElements();
            buildTagToGiftsMap();
            renderCharacterSelector();
            window.showWarning?.(window.i18n?.t('messages.warning_offline') || 'Using offline data');
        }
    }
}

/**
 * Render character selector grid
 */
function renderCharacterSelector() {
    const container = dbState.domCache.characterSelector || document.getElementById('character-selector');
    container.innerHTML = '';

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();

    // Filter visible and available characters
    const availableCharacters = Object.values(dbState.characters)
        .filter(char => char.Visible && char.Available)
        .sort((a, b) => a.Id - b.Id);

    availableCharacters.forEach(char => {
        const charNameKey = `Character.${char.Id}.1`;
        const charName = dbState.charactersKR[charNameKey] || `Character ${char.Id}`;

        // Skip characters with ??? name
        if (charName === '???') return;

        const card = document.createElement('div');
        card.className = 'character-selector-card';
        card.dataset.charId = char.Id; // Store char ID for event delegation
        card.onclick = (e) => selectCharacter(char.Id, e);

        const img = document.createElement('img');
        img.className = 'character-selector-img';
        const charIdStr = String(char.Id);
        img.src = `assets/char/avg1_${charIdStr}_002.png`;
        img.alt = charName;
        img.onerror = function() { handleImageError(this); };

        const name = document.createElement('div');
        name.className = 'character-selector-name';
        name.textContent = charName;

        card.appendChild(img);
        card.appendChild(name);
        fragment.appendChild(card);
    });

    container.appendChild(fragment);
}

/**
 * Select a character and display details
 */
function selectCharacter(charId: string, event: Event): void {
    dbState.selectedCharacterId = charId;
    dbState.currentLevel = 1;
    dbState.currentLimitBreak = 0;
    dbState.selectedCharacterType = '01'; // Reset to default type

    // Update selected state in UI
    document.querySelectorAll('.character-selector-card').forEach(card => {
        card.classList.remove('selected');
    });
    if (event && event.currentTarget) {
        (event.currentTarget as HTMLElement).classList.add('selected');
    }

    // Reset character type selector UI
    document.querySelectorAll('.char-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('.char-type-btn')?.classList.add('active');

    // Show details container
    const detailsContainer = dbState.domCache.characterDetails || document.getElementById('character-details');
    detailsContainer.style.display = 'block';

    // Reset level slider (starts at 1, which is level 1 with no limit break)
    const slider = dbState.domCache.levelSlider || document.getElementById('level-slider');
    const levelDisplay = dbState.domCache.currentLevel || document.getElementById('current-level');
    const limitbreakDisplay = dbState.domCache.currentLimitbreak || document.getElementById('current-limitbreak');
    const limitbreakBadge = dbState.domCache.limitbreakBadge || document.getElementById('limitbreak-badge');

    slider.value = 1;
    levelDisplay.textContent = 1;
    limitbreakDisplay.textContent = 0;
    limitbreakBadge.style.display = 'none';

    // Render all sections
    renderCharacterHeader(charId);
    renderStats(charId, 1, 0);
    renderArchive(charId);
    renderDating(charId);
    renderPotentials(charId);

    // Check which tab is currently active and render it
    const activeTab = document.querySelector('.chardb-tab-panel.active');
    if (activeTab) {
        const tabId = activeTab.id;
        if (tabId === 'tab-skills') {
            renderSkills(charId);
        } else if (tabId === 'tab-talents') {
            renderTalents(charId);
        }
    }

    // Scroll to details
    detailsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Render character header card
 */
function renderCharacterHeader(charId: string): void {
    const char = dbState.characters[charId];
    const charNameKey = `Character.${charId}.1`;
    const charName = dbState.charactersKR[charNameKey] || `Character ${charId}`;
    const charDes = dbState.characterDes[charId];

    // Apply character theme color based on element type
    const heroSection = dbState.domCache.heroSection || document.querySelector('.character-hero-section');
    const elementColorData = (ELEMENT_COLORS as any)[char.EET];
    if (elementColorData) {
        heroSection.style.setProperty('--char-theme-color', elementColorData.color);
    } else {
        heroSection.style.setProperty('--char-theme-color', '#6366f1');
    }

    const charNameEl = dbState.domCache.charName || document.getElementById('char-name');
    charNameEl.textContent = charName;

    // Element icon - inline next to name
    const elementData = dbState.gameEnums.elementType?.[char.EET];
    const elementIcon = dbState.domCache.charElementIcon || document.getElementById('char-element-icon');
    if (elementData) {
        elementIcon.src = elementData.icon;
        elementIcon.style.display = 'inline-block';
    } else {
        elementIcon.style.display = 'none';
    }

    // Grade badge - inline after element icon
    const gradeData = dbState.gameEnums.characterGrade?.[char.Grade];
    const gradeBadge = dbState.domCache.charGrade || document.getElementById('char-grade');
    gradeBadge.className = 'grade-badge-inline';
    if (gradeData && gradeData.stars) {
        gradeBadge.innerHTML = window.getIcon?.('star').repeat(gradeData.stars);
        gradeBadge.style.display = 'inline-flex';
    } else {
        gradeBadge.style.display = 'none';
    }

    // Render character tags
    const tagsContainer = dbState.domCache.charTags || document.getElementById('char-tags');
    tagsContainer.innerHTML = '';
    if (charDes && charDes.Tag) {
        charDes.Tag.forEach((tagId: any) => {
            const tagKey = `CharacterTag.${tagId}.1`;
            const tagName = dbState.characterTagKR[tagKey] || `Tag ${tagId}`;

            const tagBadge = document.createElement('span');
            tagBadge.className = 'char-tag-hero';
            tagBadge.textContent = tagName;
            tagsContainer.appendChild(tagBadge);
        });
    }

    // Render additional info (birthday)
    const infoContainer = dbState.domCache.charAdditionalInfo || document.getElementById('char-additional-info');
    infoContainer.innerHTML = '';
    if (charDes) {
        if (charDes.Birthday) {
            const birthdayInfo = document.createElement('div');
            birthdayInfo.className = 'char-info-item-hero';
            birthdayInfo.innerHTML = `<span class="info-icon">${window.getIcon?.('birthday')}</span><span class="info-label">${window.i18n?.t('characterdb.birthday')}</span><span class="info-value">${charDes.Birthday}</span>`;
            infoContainer.appendChild(birthdayInfo);
        }
    }

    // Render gift preferences
    renderGiftPreferences(charId);

    // Render character images
    renderCharacterImages(charId);
}

/**
 * Render gift preferences in hero section
 */
function renderGiftPreferences(charId: string): void {
    const container = dbState.domCache.charQuickStats || document.getElementById('char-quick-stats');
    container.innerHTML = '';
    const charDes = dbState.characterDes[charId];

    if (!charDes) {
        container.innerHTML = `<div class="gift-empty">${window.i18n?.t('characterdb.noGiftInfo')}</div>`;
        return;
    }

    // Render preferred gifts
    if (charDes.PreferTags && charDes.PreferTags.length > 0) {
        const preferSection = document.createElement('div');
        preferSection.className = 'gift-section';

        const preferTitle = document.createElement('div');
        preferTitle.className = 'gift-section-title prefer';
        preferTitle.innerHTML = `<span class="gift-icon">${window.getIcon?.('dating')}</span> ${window.i18n?.t('characterdb.preferredGifts')}`;
        preferSection.appendChild(preferTitle);

        const preferGrid = document.createElement('div');
        preferGrid.className = 'gift-grid';

        charDes.PreferTags.forEach((tag: any) => {
            const gifts = findGiftsByTag(tag);
            gifts.forEach((gift: any) => {
                preferGrid.appendChild(createGiftIcon(gift, false));
            });
        });

        preferSection.appendChild(preferGrid);
        container.appendChild(preferSection);
    }

    // Render hate gifts
    if (charDes.HateTags && charDes.HateTags.length > 0) {
        const hateSection = document.createElement('div');
        hateSection.className = 'gift-section';

        const hateTitle = document.createElement('div');
        hateTitle.className = 'gift-section-title hate';
        hateTitle.innerHTML = `<span class="gift-icon">${window.getIcon?.('heartBroken')}</span> ${window.i18n?.t('characterdb.hatedGifts')}`;
        hateSection.appendChild(hateTitle);

        const hateGrid = document.createElement('div');
        hateGrid.className = 'gift-grid';

        charDes.HateTags.forEach((tag: any) => {
            const gifts = findGiftsByTag(tag);
            gifts.forEach((gift: any) => {
                hateGrid.appendChild(createGiftIcon(gift, true));
            });
        });

        hateSection.appendChild(hateGrid);
        container.appendChild(hateSection);
    }

    if ((!charDes.PreferTags || charDes.PreferTags.length === 0) &&
        (!charDes.HateTags || charDes.HateTags.length === 0)) {
        container.innerHTML = `<div class="gift-empty">${window.i18n?.t('characterdb.noGiftInfo')}</div>`;
    }
}

/**
 * Find gifts by tag (optimized with pre-computed map)
 */
function findGiftsByTag(tag: any): any[] {
    return dbState.tagToGiftsMap[tag] || [];
}

/**
 * Create gift icon element
 */
function createGiftIcon(gift: any, isHate: any): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'gift-icon-wrapper';
    if (isHate) wrapper.classList.add('hate');

    // Get item data (note: gift.Id not gift.ID)
    const item = dbState.items[gift.Id];
    if (!item) {
        console.log('Item not found for gift:', gift.Id);
        return wrapper;
    }

    // Get Korean name
    const itemNameKey = item.Title;
    const itemName = (dbState.itemsKR as any)[itemNameKey] || 'Unknown';

    // Get rarity background
    const rarityMap: Record<number, number> = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };
    const rarityNum = rarityMap[item.Rarity] || 5;
    const rarityBg = `assets/items/rare_item_a_${rarityNum}.png`;

    // Get item icon
    const iconParts = item.Icon.split('/');
    const iconFile = iconParts[iconParts.length - 1];
    const iconPath = `assets/items/${iconFile}.png`;

    // Create icon structure
    wrapper.innerHTML = `
        <div class="gift-icon-bg">
            <img src="${rarityBg}" class="gift-rarity-bg" loading="lazy" onerror="handleImageError(this)">
        </div>
        <img src="${iconPath}" class="gift-item-icon" loading="lazy" onerror="handleImageError(this)" alt="${itemName}">
        <div class="gift-tooltip">${itemName}</div>
    `;

    return wrapper;
}

/**
 * Render character images with type selection
 */
function renderCharacterImages(charId: string): void {
    const charIdStr = String(charId);
    const type = dbState.selectedCharacterType;

    // Update portrait (main SK image)
    const portraitContainer = document.querySelector('.character-portrait-hero');
    let portrait = document.getElementById('char-portrait');

    // Remove any existing no-image message
    const existingMessage = portraitContainer?.querySelector('.portrait-no-image');
    if (existingMessage) {
        existingMessage.remove();
    }

    // If portrait doesn't exist, create it
    if (!portrait) {
        portrait = document.createElement('img');
        portrait.id = 'char-portrait';
        (portrait as HTMLImageElement).alt = 'Character Portrait';
        portraitContainer?.insertBefore(portrait, portraitContainer.querySelector('.char-type-selector-hero'));
    } else {
        portrait.style.display = 'block';
    }

    (portrait as HTMLImageElement).src = `assets/char/head_${charIdStr}${type}_SK.png`;

    // Handle image error for skin type
    portrait.onerror = function() {
        if (type === '03') {
            // Hide the broken image
            this.style.display = 'none';

            // Show message for missing skin
            const message = document.createElement('div');
            message.className = 'portrait-no-image';
            message.textContent = window.i18n?.t('characterdb.noSkin') || 'No skin image';
            portraitContainer?.insertBefore(message, portraitContainer.querySelector('.char-type-selector-hero'));
        } else {
            this.style.display = 'none';
        }
    };

    // Render all available images in character image gallery
    renderCharacterImageGallery(charId);
}

/**
 * Render character image gallery
 */
function renderCharacterImageGallery(charId: string): void {
    const container = dbState.domCache.charImageGallery || document.getElementById('char-image-gallery');
    if (!container) return;

    container.innerHTML = '';
    const charIdStr = String(charId);
    const type = dbState.selectedCharacterType;

    // Image types to display (CG first, then others)
    const imageTypes = [
        { suffix: '_CG', label: window.i18n?.t('characterdb.imageLabels.cg'), className: 'char-img-cg', badgeColor: '#f43f5e', baseOnly: true },
        { suffix: '_GC', label: window.i18n?.t('characterdb.imageLabels.banner'), className: 'char-img-banner', badgeColor: '#ec4899' },
        { suffix: '_GD', label: window.i18n?.t('characterdb.imageLabels.face'), className: 'char-img-head', badgeColor: '#8b5cf6' },
        { suffix: '_GOODS', label: window.i18n?.t('characterdb.imageLabels.sd'), className: 'char-img-sd', badgeColor: '#10b981' },
        { suffix: '_Q', label: window.i18n?.t('characterdb.imageLabels.sdq'), className: 'char-img-sd', badgeColor: '#f59e0b' }
    ];

    imageTypes.forEach(imgType => {
        // Skip CG image if not base type (CG only available for base characters)
        if (imgType.baseOnly && type !== '01') {
            return;
        }

        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'char-img-wrapper-new';

        // Image badge
        const badge = document.createElement('div');
        badge.className = 'char-img-badge';
        badge.textContent = imgType.label ?? '';
        badge.style.background = imgType.badgeColor;

        const img = document.createElement('img');
        img.className = `char-img-new ${imgType.className}`;
        // Use different path format for CG images
        if (imgType.suffix === '_CG') {
            img.src = `assets/char/${charIdStr}${type}${imgType.suffix}.png`;
        } else {
            img.src = `assets/char/head_${charIdStr}${type}${imgType.suffix}.png`;
        }
        img.alt = `${imgType.label}`;
        img.dataset.fullSrc = img.src; // Store for lightbox
        img.onerror = function() {
            imgWrapper.style.display = 'none';
        };

        // Click to view full size
        img.onclick = function() {
            openImageLightbox(img.src, `${imgType.label}`);
        };

        imgWrapper.appendChild(badge);
        imgWrapper.appendChild(img);
        container.appendChild(imgWrapper);
    });
}

/**
 * Open image lightbox
 */
function openImageLightbox(src: string, title: string): void {
    // Create lightbox if doesn't exist
    let lightbox = document.getElementById('image-lightbox');
    if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.id = 'image-lightbox';
        lightbox.className = 'image-lightbox';
        lightbox.innerHTML = `
            <div class="lightbox-backdrop" onclick="closeImageLightbox()"></div>
            <div class="lightbox-content">
                <button class="lightbox-close" onclick="closeImageLightbox()">✕</button>
                <img class="lightbox-img" src="" alt="">
                <div class="lightbox-title"></div>
            </div>
        `;
        document.body.appendChild(lightbox);
    }

    // Set image and show
    (lightbox.querySelector('.lightbox-img') as HTMLImageElement).src = src;
    (lightbox.querySelector('.lightbox-title') as HTMLElement).textContent = title;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Close image lightbox
 */
function closeImageLightbox() {
    const lightbox = document.getElementById('image-lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }
}

/**
 * Change character type (일반/각성/스킨)
 */
function changeCharacterType(type: string, event: Event): void {
    dbState.selectedCharacterType = type;

    // Update type selector UI
    document.querySelectorAll('.char-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (event && event.currentTarget && 'classList' in event.currentTarget) {
        (event.currentTarget as HTMLElement).classList.add('active');
    }

    // Re-render character images
    if (dbState.selectedCharacterId) {
        renderCharacterImages(dbState.selectedCharacterId);
    }
}

/**
 * Render character stats
 */
function renderStats(charId: string, level: number, limitBreak: number): void {
    const container = dbState.domCache.statsGrid || document.getElementById('stats-grid');
    container.innerHTML = '';

    // Find attribute data for this character and level
    // Attribute ID format: {GroupId}{limitbreak * 1000}{level with 5-digit padding}
    // Example: Character 103, level 10, limit break 1 = "10301010"
    const char = dbState.characters[charId];

    // Find GroupId from attributes
    let groupId = null;
    for (const attrId in dbState.attributes) {
        const attr = dbState.attributes[attrId];
        if (attr.GroupId.toString().length >= 3) {
            const charIdFromGroup = parseInt(attr.GroupId.toString().slice(-3));
            const numCharId = typeof charId === 'string' ? parseInt(charId, 10) : charId;
            if (charIdFromGroup === numCharId || attr.GroupId === numCharId) {
                groupId = attr.GroupId;
                break;
            }
        }
    }

    // If GroupId not found, try to construct it
    if (!groupId) {
        // Try common patterns
        groupId = charId;
    }

    // Construct attribute ID with limit break and 5-digit level padding
    // Formula: {groupId}{(limitBreak * 1000 + level) padded to 5 digits}
    // Example: Character 101, LB 1, Level 12 = "101" + "01012" = "10101012"
    const combinedValue = (limitBreak * 1000) + level;
    const combinedPadded = combinedValue.toString().padStart(5, '0');
    const attrId = `${groupId}${combinedPadded}`;

    const attrData = dbState.attributes[attrId];

    if (!attrData) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">${window.i18n?.t('characterdb.noStatInfo')}<br>ID: ${attrId}</div></div>`;
        return;
    }

    // Render main stats
    MAIN_STATS.forEach(statKey => {
        if (attrData[statKey] !== undefined) {
            const card = document.createElement('div');
            card.className = 'stat-card';

            const icon = document.createElement('div');
            icon.className = 'stat-icon';
            icon.innerHTML = window.getIcon?.((STAT_ICONS as any)[statKey] || 'stats') || '';

            const content = document.createElement('div');
            content.className = 'stat-content';

            const name = document.createElement('div');
            name.className = 'stat-name';
            name.textContent = (STAT_NAMES as any)[statKey] || statKey;

            const value = document.createElement('div');
            value.className = 'stat-value';

            // Format value
            let displayValue = attrData[statKey];
            if (statKey === 'CritPower' || statKey === 'HitRate' || statKey === 'CritRate' || statKey === 'ToughnessDamageAdjust') {
                // These are stored as per-10000 values, convert to percentage
                displayValue = (attrData[statKey] / 100).toFixed(1) + '%';
            } else if (statKey === 'Hp') {
                displayValue = attrData[statKey].toLocaleString();
            } else {
                displayValue = attrData[statKey].toLocaleString();
            }

            value.textContent = displayValue;

            content.appendChild(name);
            content.appendChild(value);
            card.appendChild(icon);
            card.appendChild(content);
            container.appendChild(card);
        }
    });
}

/**
 * Render character archive
 */
function renderArchive(charId: string): void {
    const container = dbState.domCache.archiveList || document.getElementById('archive-list');
    container.innerHTML = '';

    // Find all archives for this character
    const archives = Object.values(dbState.characterArchive)
        .filter(arch => arch.CharacterId === charId)
        .sort((a, b) => a.Sort - b.Sort);

    if (archives.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${window.getIcon?.('archive')}</div><div class="empty-state-text">${window.i18n?.t('characterdb.noArchiveInfo')}</div></div>`;
        return;
    }

    archives.forEach(archive => {
        const content = dbState.characterArchiveContent[archive.Id];
        if (!content) return;

        const titleKey = content.Title;
        const contentKey = content.Content;
        const updateContentKey = content.UpdateContent1;

        const title = dbState.characterArchiveContentKR[titleKey] || titleKey;
        const contentText = dbState.characterArchiveContentKR[contentKey] || contentKey;
        const updateText = updateContentKey ? dbState.characterArchiveContentKR[updateContentKey] : null;

        const item = document.createElement('div');
        item.className = 'archive-item';

        const header = document.createElement('div');
        header.className = 'archive-header';
        header.onclick = () => toggleArchive(item);

        const titleDiv = document.createElement('div');
        titleDiv.className = 'archive-title';
        titleDiv.innerHTML = `<span>📄</span> ${title}`;

        const toggle = document.createElement('div');
        toggle.className = 'archive-toggle';
        toggle.textContent = '▼';

        header.appendChild(titleDiv);
        header.appendChild(toggle);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'archive-content';

        const textDiv = document.createElement('div');
        textDiv.className = 'archive-text';
        textDiv.textContent = contentText;

        contentDiv.appendChild(textDiv);

        if (updateText) {
            const updateDiv = document.createElement('div');
            updateDiv.className = 'archive-update-notice';
            updateDiv.innerHTML = `<div class="archive-update-label">⚠️ ${window.i18n?.t('characterdb.archiveCondition')}</div>${updateText}`;
            contentDiv.appendChild(updateDiv);
        }

        item.appendChild(header);
        item.appendChild(contentDiv);
        container.appendChild(item);
    });
}

/**
 * Toggle archive item expansion
 */
function toggleArchive(item: any): void {
    item.classList.toggle('expanded');
}

/**
 * Get character chat lines for a specific character
 * Type 1 = '신규 입수시', 2 = '재 입수시', 3 = '각성 시', 4 = '호감도 10 달성시'
 */
function getCharacterChatLines(charId: string): any[] {
    // Ensure charId is a number for comparison
    const numCharId = typeof charId === 'string' ? parseInt(charId, 10) : charId;

    // Check if data is loaded
    if (!dbState.charGetLines || !dbState.charGetLinesKR) {
        return [];
    }

    const chatLines = Object.values(dbState.charGetLines)
        .filter(line => line.Character === numCharId)
        .map(line => {
            const typeLabels = {
                1: window.i18n?.t('characterdb.chatLineTypes.1'),
                2: window.i18n?.t('characterdb.chatLineTypes.2'),
                3: window.i18n?.t('characterdb.chatLineTypes.3'),
                4: window.i18n?.t('characterdb.chatLineTypes.4')
            };

            const lineKey = line.Lines;
            const lineText = dbState.charGetLinesKR[lineKey] || '';

            return {
                type: line.Type,
                typeLabel: (typeLabels as any)[line.Type] || `Type ${line.Type}`,
                text: lineText
            };
        })
        .filter(line => line.text); // Filter out empty lines

    return chatLines;
}

/**
 * Render character chat lines as HTML
 */
function renderChatLinesHTML(chatLines: any): string {
    if (!chatLines || chatLines.length === 0) {
        return '';
    }

    const linesHTML = chatLines.map((line: any) => `
        <div class="chat-line-item">
            <div class="chat-line-type">${window.getIcon?.('chat')} ${line.typeLabel}</div>
            <div class="chat-line-text">${line.text}</div>
        </div>
    `).join('');

    return `
        <div class="chat-lines-container">
            <div class="chat-lines-header">${window.getIcon?.('comments')} ${window.i18n?.t('characterdb.chatLines')}</div>
            ${linesHTML}
        </div>
    `;
}

/**
 * Render dating information
 */
function renderDating(charId: string): void {
    const container = dbState.domCache.datingList || document.getElementById('dating-list');
    container.innerHTML = '';

    // Get the dating section
    const datingSection = document.querySelector('.dating-section');

    // Check if dating section is already wrapped
    let rightColumn = datingSection?.parentElement;
    if (rightColumn && !rightColumn.classList.contains('character-right-column')) {
        // Create wrapper for right column (chat lines + dating)
        rightColumn = document.createElement('div');
        rightColumn.className = 'character-right-column';

        // Wrap the dating section
        if (datingSection && datingSection.parentNode) {
            datingSection.parentNode.insertBefore(rightColumn, datingSection);
            rightColumn.appendChild(datingSection);
        }
    }

    // Remove any existing chat lines container
    const existingChatLines = rightColumn?.querySelector('.chat-lines-section');
    if (existingChatLines) {
        existingChatLines.remove();
    }

    // Get character chat lines
    const chatLines = getCharacterChatLines(charId);
    const chatLinesHTML = renderChatLinesHTML(chatLines);

    // Add chat lines at the top of right column if available
    if (chatLinesHTML) {
        const chatLinesSection = document.createElement('div');
        chatLinesSection.className = 'chat-lines-section';
        chatLinesSection.innerHTML = chatLinesHTML;
        rightColumn?.insertBefore(chatLinesSection, datingSection);
    }

    // Find all dating events for this character
    // Convert charId to number for comparison
    const numCharId = typeof charId === 'string' ? parseInt(charId, 10) : charId;
    const datingEvents = Object.values(dbState.datingEvents)
        .filter(event => {
            return event.DatingEventParams &&
                   event.DatingEventParams.length >= 2 &&
                   event.DatingEventParams[0] === numCharId;
        });

    if (datingEvents.length === 0 && !chatLinesHTML) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${window.getIcon?.('dating')}</div><div class="empty-state-text">${window.i18n?.t('characterdb.noDatingInfo')}</div></div>`;
        return;
    }

    // Create a wrapper for dating cards to maintain grid layout
    const datingCardsWrapper = document.createElement('div');
    datingCardsWrapper.className = 'dating-cards-wrapper';

    datingEvents.forEach(event => {
        const locationId = event.DatingEventParams[1];
        const branchTag = event.BranchTag;
        const cgImage = event.CG; // Get CG field

        // Get location name
        const locationKey = `DatingLandmark.${locationId}.1`;
        const locationName = dbState.datingLandmarkKR[locationKey] || `Location ${locationId}`;

        // Get correct answer
        // Format: DatingBranch.{locationId}001.{branchTag}
        const branchKey = `DatingBranch.${locationId}001.${branchTag}`;
        const answer = dbState.datingBranchKR[branchKey] || window.i18n?.t('characterdb.datingBug');

        const card = document.createElement('div');
        card.className = 'dating-card';

        const location = document.createElement('div');
        location.className = 'dating-location';
        location.innerHTML = `<span class="dating-location-icon">📍</span>${locationName}`;

        const answerLabel = document.createElement('div');
        answerLabel.className = 'dating-answer-label';
        answerLabel.textContent = window.i18n?.t('characterdb.datingAnswer') || 'Answer';

        const answerDiv = document.createElement('div');
        answerDiv.className = 'dating-answer';
        answerDiv.textContent = answer;
        
        // Add CG image if available
        if (cgImage) {
            const cgImgWrapper = document.createElement('div');
            cgImgWrapper.className = 'dating-cg-wrapper';

            const cgImg = document.createElement('img');
            cgImg.className = 'dating-cg-img';
            cgImg.src = `assets/dating/${cgImage}.png`;
            cgImg.alt = locationName;
            cgImg.onerror = function() {
                cgImgWrapper.style.display = 'none';
            };

            cgImgWrapper.appendChild(cgImg);
            card.appendChild(cgImgWrapper);
        }

        card.appendChild(location);
        card.appendChild(answerLabel);
        card.appendChild(answerDiv);
        datingCardsWrapper.appendChild(card);
    });

    // Append the dating cards wrapper to container
    if (datingEvents.length > 0) {
        container.appendChild(datingCardsWrapper);
    }
}

/**
 * Calculate level and limit break from slider value
 * Slider goes from 1-98 (90 levels + 8 limit break advancements)
 * Advancements occur at: 11, 22, 33, 44, 55, 66, 77, 88
 * - 1-10: Levels 1-10, LB 0
 * - 11: Level 10, LB 1 (advancement)
 * - 12-21: Levels 11-20, LB 1
 * - 22: Level 20, LB 2 (advancement)
 * - ...and so on
 */
function getStatsFromSlider(sliderValue: number): { level: number; limitBreak: number } {
    // Advancement points where limit break increases
    const advancements = [11, 22, 33, 44, 55, 66, 77, 88];

    let limitBreak = 0;
    for (let i = 0; i < advancements.length; i++) {
        if (sliderValue >= advancements[i]!) {
            limitBreak = i + 1;
        } else {
            break;
        }
    }

    const level = sliderValue - limitBreak;

    return { level, limitBreak };
}

/**
 * Handle level slider changes
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize i18n first
    await i18n.init();

    const levelSlider = document.getElementById('level-slider');
    const currentLevelDisplay = document.getElementById('current-level');
    const currentLimitBreakDisplay = document.getElementById('current-limitbreak');
    const limitBreakBadge = document.getElementById('limitbreak-badge');

    // Debounced stats render function (waits 150ms after user stops dragging)
    const debouncedRenderStats = debounce((charId: string, level: number, limitBreak: number) => {
        renderStats(charId, level, limitBreak);
    }, 150);

    levelSlider?.addEventListener('input', (e) => {
        const sliderValue = parseInt((e.target as HTMLInputElement).value);
        const { level, limitBreak } = getStatsFromSlider(sliderValue);

        // Update displays immediately (no lag for UI feedback)
        if (currentLevelDisplay) currentLevelDisplay.textContent = level.toString();
        if (currentLimitBreakDisplay) currentLimitBreakDisplay.textContent = limitBreak.toString();

        // Show/hide limit break badge
        if (limitBreak > 0) {
            if (limitBreakBadge) limitBreakBadge.style.display = 'inline-flex';
        } else {
            if (limitBreakBadge) limitBreakBadge.style.display = 'none';
        }

        // Update state
        dbState.currentLevel = level;
        dbState.currentLimitBreak = limitBreak;

        // Render stats with debouncing (reduces DOM updates during dragging)
        if (dbState.selectedCharacterId) {
            debouncedRenderStats(dbState.selectedCharacterId, level, limitBreak);
        }
    });

    // Listen for language changes
    window.addEventListener('languageChanged', async (event) => {
        console.log('[CharacterDB] Language changed, reloading data');
        // Update static i18n elements
        window.i18n?.updatePage();
        // Clear cache when language changes
        localStorage.removeItem('characterdb_data');
        // Reload all data
        await loadData();
        // Re-render current character if any
        if (dbState.selectedCharacterId) {
            const charId = dbState.selectedCharacterId;
            // Re-render all sections that are always visible
            renderCharacterSelector(); // Update character names in selector
            renderCharacterHeader(charId);
            renderStats(charId, dbState.currentLevel, dbState.currentLimitBreak);
            renderArchive(charId);
            renderDating(charId);
            renderPotentials(charId);
            // Re-render tab-specific content (skills and talents)
            renderSkills(charId);
            renderTalents(charId);
        } else {
            // If no character selected, just update the selector
            renderCharacterSelector();
        }
    });

    // Load data when page loads
    await loadData();
});

// =============================================================================
// POTENTIALS SECTION
// =============================================================================

// Add potential data to dbState
dbState.charPotentials = {};
dbState.potentials = {};
dbState.potentialsKR = {};
dbState.items = {};
dbState.itemsKR = {};
dbState.skills = {};
dbState.skillsKR = {};
dbState.effectValue = {};
dbState.hitDamage = {};
dbState.onceAdditionalAttributeValue = {};
dbState.scriptParameterValue = {};
dbState.buffValue = {};
dbState.shieldValue = {};
dbState.currentPotentialType = 'main'; // 'main' or 'assist'
dbState.potentialLevel = 1; // Global potential level (1-9)

// Debounced render function for potentials (150ms delay)
const debouncedRenderPotentials = debounce((charId: string) => {
    renderPotentials(charId);
}, 150);

// Load potential data (called after main data is loaded)
async function loadPotentialData() {
    try {
        // Get current language from i18n
        const gameLang = window.i18n?.currentLang || 'KR';
        const dataPath = window.i18n?.getDataPath(gameLang) || 'data/KR';

        const [
            charPotentials,
            potentials,
            potentialsKR,
            skills,
            skillsKR,
            effectValue,
            hitDamage,
            onceAdditionalAttributeValue,
            scriptParameterValue,
            buffValue,
            shieldValue
        ] = await Promise.all([
            fetch('data/CharPotential.json').then(r => r.json()),
            fetch('data/Potential.json').then(r => r.json()),
            fetch(`${dataPath}/Potential.json`).then(r => r.json()),
            fetch('data/Skill.json').then(r => r.json()),
            fetch(`${dataPath}/Skill.json`).then(r => r.json()),
            fetch('data/EffectValue.json').then(r => r.json()),
            fetch('data/HitDamage.json').then(r => r.json()),
            fetch('data/OnceAdditionalAttributeValue.json').then(r => r.json()),
            fetch('data/ScriptParameterValue.json').then(r => r.json()),
            fetch('data/BuffValue.json').then(r => r.json()),
            fetch('data/ShieldValue.json').then(r => r.json())
        ]);

        dbState.charPotentials = charPotentials;
        dbState.potentials = potentials;
        dbState.potentialsKR = potentialsKR;
        dbState.skills = skills;
        dbState.skillsKR = skillsKR;
        dbState.effectValue = effectValue;
        dbState.hitDamage = hitDamage;
        dbState.onceAdditionalAttributeValue = onceAdditionalAttributeValue;
        dbState.scriptParameterValue = scriptParameterValue;
        dbState.buffValue = buffValue;
        dbState.shieldValue = shieldValue;

        console.log('Potential data loaded successfully');
    } catch (error) {
        console.error('Error loading potential data:', error);
        window.showError?.(window.i18n?.t('messages.error_loadingPotentials') || 'Error loading potentials');
    }
}

// =============================================================================
// POTENTIAL SYSTEM
// =============================================================================
// Parameter parsing functions are imported from @/modules/param-parser

let currentPotentialData: any = null; // Store current potential for description processing

/**
 * Process description with parameter parsing for characterdb context
 * Note: skillLevel should be the actual skill level from dbState, not defaulting to 1
 */
function processDescription(desc: any, level: any, skillLevel?: number): string {
    if (!desc) return '';

    // Use the global skill level from dbState if not explicitly provided
    const effectiveSkillLevel = skillLevel ?? dbState.skillLevel;

    // Use the shared parameter parser with dbState context
    return parseDescriptionParams(desc, currentPotentialData, level, effectiveSkillLevel, dbState as any);
}

/**
 * Create a potential card element
 */
function createPotentialCard(potId: any, level: any): HTMLElement | null {
    const potential = dbState.potentials[potId];
    if (!potential) {
        console.log('[Potentials] Potential not found:', potId);
        return null;
    }

    const item = dbState.items[potId];
    if (!item) {
        console.log('[Potentials] Item not found:', potId);
        return null;
    }

    // Check if this is a specific potential (Stype 42)
    const isSpecificPotential = item.Stype === 42;

    // All potentials now follow the global level slider (1-9)
    // Clamp level to valid range (arrays may have limited length)
    const maxLevel = 9; // Most potential arrays have max length 9
    const currentLevel = Math.min(Math.max(1, level), maxLevel);

    // Get Korean name
    const nameKey = item.Title;
    const name = (dbState.potentialsKR as any)[nameKey] || (dbState.itemsKR as any)[nameKey] || nameKey;

    // Get icon path
    const iconName = item.Icon?.split('/')?.pop();
    const iconPath = iconName ? `assets/skill_icons/${iconName}_A.png` : null;

    // Get rarity background
    const rarity = item.Rarity;
    let backgroundImage = null;
    if (item.Stype === 42) {
        backgroundImage = 'assets/skill_icons/rare_vestige_card_s_7.png';
    } else if (item.Stype === 41) {
        if (rarity === 1) {
            backgroundImage = 'assets/skill_icons/rare_vestige_card_s_9.png';
        } else if (rarity === 2) {
            backgroundImage = 'assets/skill_icons/rare_vestige_card_s_8.png';
        }
    }

    // Get DETAILED description (always use .2 suffix for detailed)
    currentPotentialData = potential;
    const detailedKey = `Potential.${potId}.2`;
    const detailedDesc = (dbState.potentialsKR as any)[detailedKey] || `Potential ${potId} detailed description not found`;
    const processedDesc = processDescription(detailedDesc, currentLevel);

    // Create card
    const card = document.createElement('div');
    card.className = 'potential-card';

    card.innerHTML = `
        <div class="potential-card-header">
            <div class="potential-card-image">
                ${backgroundImage ? `<img src="${backgroundImage}" class="potential-bg" loading="lazy" onerror="this.style.display='none'">` : ''}
                ${iconPath ? `<img src="${iconPath}" class="potential-icon" loading="lazy" onerror="this.style.display='none'">` : '<span class="potential-placeholder">✨</span>'}
            </div>
            <div class="potential-card-info">
                <div class="potential-card-name">${name}</div>
                <div class="potential-card-meta">ID: ${potId} | Lv.${currentLevel}</div>
            </div>
        </div>
        <div class="potential-card-body">
            <div class="potential-card-desc">${processedDesc}</div>
        </div>
    `;

    return card;
}

/**
 * Render potentials for the selected character
 */
function renderPotentials(charId: string) {
    const container = dbState.domCache.potentialsDisplay || document.getElementById('potentials-display');
    if (!container) return;

    // Check if potential data is loaded
    if (!dbState.charPotentials || Object.keys(dbState.charPotentials).length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-text">${window.i18n?.t('characterdb.loadingPotentials')}</div></div>`;
        container.classList.add('empty');
        return;
    }

    const type = dbState.currentPotentialType;
    const level = dbState.potentialLevel;

    // Get character potentials
    const charPotentials = dbState.charPotentials[charId];
    if (!charPotentials) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✨</div><div class="empty-state-text">${window.i18n?.t('characterdb.noPotentialInfo')}</div></div>`;
        container.classList.add('empty');
        return;
    }

    // Get potential lists based on type
    // Main potentials = MasterSpecificPotentialIds + MasterNormalPotentialIds + CommonPotentialIds
    // Assist potentials = AssistSpecificPotentialIds + AssistNormalPotentialIds + CommonPotentialIds
    let potentialList = [];
    if (type === 'main') {
        potentialList = [
            ...(charPotentials.MasterSpecificPotentialIds || []),
            ...(charPotentials.MasterNormalPotentialIds || []),
            ...(charPotentials.CommonPotentialIds || [])
        ];
    } else {
        potentialList = [
            ...(charPotentials.AssistSpecificPotentialIds || []),
            ...(charPotentials.AssistNormalPotentialIds || []),
            ...(charPotentials.CommonPotentialIds || [])
        ];
    }

    if (!potentialList || potentialList.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✨</div><div class="empty-state-text">${window.i18n?.t('characterdb.noPotentialInfoForType')}</div></div>`;
        container.classList.add('empty');
        return;
    }

    container.classList.remove('empty');
    container.innerHTML = '';

    // Group potentials by Build (유파)
    const potentialsByBuild = {};
    potentialList.forEach(potId => {
        const potential = dbState.potentials[potId];
        if (!potential) return;

        const buildId = potential.Build || 3; // Default to 3 (공용) if not specified
        if (!(potentialsByBuild as any)[buildId]) {
            (potentialsByBuild as any)[buildId] = [];
        }
        (potentialsByBuild as any)[buildId].push(potId);
    });

    // Sort build IDs (1, 2, 3)
    const buildIds = Object.keys(potentialsByBuild).sort((a, b) => parseInt(a) - parseInt(b));

    // Get character description for build titles and descriptions
    const charDesBase = dbState.characterDes?.[charId];
    const charDesTranslated = dbState.characterDesKR;

    // Render each 유파 group
    let renderedCount = 0;
    buildIds.forEach(buildId => {
        let buildTitle = '';
        let buildDescription = '';

        // Get build title and description based on type and build ID
        if (type === 'main') {
            if (buildId === '1') {
                const titleKey = charDesBase?.PotentialMain1;
                const descKey = charDesBase?.PotentialMainContent1;
                buildTitle = titleKey ? (charDesTranslated?.[titleKey] || window.i18n?.t('characterdb.potentialStyle1')) : window.i18n?.t('characterdb.potentialStyle1');
                buildDescription = descKey ? (charDesTranslated?.[descKey] || '') : '';
            } else if (buildId === '2') {
                const titleKey = charDesBase?.PotentialMain2;
                const descKey = charDesBase?.PotentialMainContent2;
                buildTitle = titleKey ? (charDesTranslated?.[titleKey] || window.i18n?.t('characterdb.potentialStyle2') || 'Style 2') : window.i18n?.t('characterdb.potentialStyle2') || 'Style 2';
                buildDescription = descKey ? (charDesTranslated?.[descKey] || '') : '';
            } else {
                buildTitle = window.i18n?.t('characterdb.potentialCommon') || 'Common';
                buildDescription = '';
            }
        } else {
            if (buildId === '1') {
                const titleKey = charDesBase?.PotentialAssistant1;
                const descKey = charDesBase?.PotentialAssistantContent1;
                buildTitle = titleKey ? (charDesTranslated?.[titleKey] || window.i18n?.t('characterdb.potentialStyle1') || 'Style 1') : window.i18n?.t('characterdb.potentialStyle1') || 'Style 1';
                buildDescription = descKey ? (charDesTranslated?.[descKey] || '') : '';
            } else if (buildId === '2') {
                const titleKey = charDesBase?.PotentialAssistant2;
                const descKey = charDesBase?.PotentialAssistantContent2;
                buildTitle = titleKey ? (charDesTranslated?.[titleKey] || window.i18n?.t('characterdb.potentialStyle2') || 'Style 2') : window.i18n?.t('characterdb.potentialStyle2') || 'Style 2';
                buildDescription = descKey ? (charDesTranslated?.[descKey] || '') : '';
            } else {
                buildTitle = window.i18n?.t('characterdb.potentialCommon') || 'Common';
                buildDescription = '';
            }
        }

        // Create section header for this 유파
        const sectionHeader = document.createElement('div');
        sectionHeader.className = 'potential-build-header';
        sectionHeader.innerHTML = `
            <div class="potential-build-title-wrapper">
                <div class="potential-build-title">
                    <span class="potential-build-icon">✦</span>
                    ${buildTitle}
                </div>
                <div class="potential-build-count">${(potentialsByBuild as any)[buildId].length}개</div>
            </div>
            ${buildDescription ? `<div class="potential-build-description">${buildDescription}</div>` : ''}
        `;
        container.appendChild(sectionHeader);

        // Separate specific potentials from normal/common potentials
        const specificPots: any[] = [];
        const normalCommonPots: any[] = [];

        (potentialsByBuild as any)[buildId].forEach((potId: any) => {
            const item = dbState.items[potId];
            if (item && item.Stype === 42) {
                specificPots.push(potId);
            } else {
                normalCommonPots.push(potId);
            }
        });

        // Render specific potentials first
        if (specificPots.length > 0) {
            const specificGroup = document.createElement('div');
            specificGroup.className = 'potential-group';
            specificPots.forEach(potId => {
                const card = createPotentialCard(potId, level);
                if (card) {
                    specificGroup.appendChild(card);
                    renderedCount++;
                }
            });
            container.appendChild(specificGroup);
        }

        // Render normal/common potentials
        if (normalCommonPots.length > 0) {
            const normalGroup = document.createElement('div');
            normalGroup.className = 'potential-group';
            normalCommonPots.forEach(potId => {
                const card = createPotentialCard(potId, level);
                if (card) {
                    normalGroup.appendChild(card);
                    renderedCount++;
                }
            });
            container.appendChild(normalGroup);
        }
    });
}

/**
 * Switch between main and assist potentials
 */
function switchPotentialType(type: string, event: Event): void {
    dbState.currentPotentialType = type;

    // Update button states
    document.querySelectorAll('.potential-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (event && event.currentTarget) {
        (event.currentTarget as HTMLElement).classList.add('active');
    }

    // Re-render potentials
    if (dbState.selectedCharacterId) {
        renderPotentials(dbState.selectedCharacterId);
    }
}

/**
 * Update global potential level
 */
function updatePotentialLevel(newLevel: number) {
    dbState.potentialLevel = Math.max(1, Math.min(9, newLevel));

    // Update display immediately (no lag for UI feedback)
    const display = document.getElementById('potential-level-display');
    if (display) {
        display.textContent = dbState.potentialLevel.toString();
    }

    // Update slider
    const slider = document.getElementById('potential-level-slider');
    if (slider) {
        (slider as HTMLInputElement).value = String(dbState.potentialLevel);
    }

    // Re-render potentials with debouncing (reduces DOM updates during dragging)
    if (dbState.selectedCharacterId) {
        debouncedRenderPotentials(dbState.selectedCharacterId);
    }
}

/**
 * Adjust potential level by delta
 */
function adjustPotentialLevel(delta: number) {
    const newLevel = dbState.potentialLevel + delta;
    updatePotentialLevel(newLevel);
}

/**
 * Switch between character database tabs
 */
function switchCharDbTab(tabName: string, event?: Event): void {
    // Update tab buttons
    document.querySelectorAll('.chardb-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (event?.target) {
        (event.target as HTMLElement).closest('.chardb-tab-btn')?.classList.add('active');
    }

    // Update tab panels
    document.querySelectorAll('.chardb-tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`)?.classList.add('active');

    // Render content for tabs that haven't been rendered yet
    if (tabName === 'skills' && dbState.selectedCharacterId) {
        renderSkills(dbState.selectedCharacterId);
    } else if (tabName === 'talents' && dbState.selectedCharacterId) {
        renderTalents(dbState.selectedCharacterId);
    }
}

// =============================================================================
// SKILLS SECTION
// =============================================================================

/**
 * Render character skills
 */
function renderSkills(charId: string): void {
    const container = dbState.domCache.skillsDisplay || document.getElementById('skills-display');
    if (!container) return;

    const char = dbState.characters[charId];
    if (!char) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚡</div><div class="empty-state-text">${window.i18n?.t('characterdb.noSkillInfo')}</div></div>`;
        return;
    }

    // Check if skill data is loaded
    if (!dbState.skills || Object.keys(dbState.skills).length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-text">${window.i18n?.t('characterdb.loadingSkills')}</div></div>`;
        return;
    }

    const skillLevel = dbState.skillLevel;

    // Get skill IDs
    const skillIds = [
        { id: char.NormalAtkId, label: window.i18n?.t('characterdb.skillTypes.normalAtk'), key: 'normalAtk' },
        { id: char.SkillId, label: window.i18n?.t('characterdb.skillTypes.skill'), key: 'skill' },
        { id: char.AssistSkillId, label: window.i18n?.t('characterdb.skillTypes.assistSkill'), key: 'assistSkill' },
        { id: char.UltimateId, label: window.i18n?.t('characterdb.skillTypes.ultimate'), key: 'ultimate' }
    ];

    container.innerHTML = '';

    skillIds.forEach(({ id, label, key }) => {
        if (!id) return;

        const skill = dbState.skills[id];
        if (!skill) return;

        const iconName = skill.Icon ? skill.Icon.split('/').pop() : '';
        const iconPath = iconName ? `assets/skill_icons/${iconName}.png` : '';

        // Get element background
        const elementId = char.EET;
        const elementBgPath = `assets/skill_icons/skill_btn_b_type_${elementId}.png`;

        // Get title
        const titleKey = skill.Title;
        const title = (dbState.skillsKR as any)[titleKey] || label;

        // Get description (use detailed description .2)
        const descKey = skill.Desc;
        let description = (dbState.skillsKR as any)[descKey] || '';

        // Parse parameters in description
        currentPotentialData = skill; // Temporarily use skill as the data source for params
        description = processDescription(description, skillLevel, skillLevel);

        // Create skill card
        const card = document.createElement('div');
        card.className = 'skill-card';

        card.innerHTML = `
            <div class="skill-card-header">
                <div class="skill-card-icon-wrapper">
                    <img src="${elementBgPath}" alt="" class="skill-icon-bg" loading="lazy" onerror="this.style.display='none'">
                    ${iconPath ? `<img src="${iconPath}" alt="${title}" class="skill-icon" loading="lazy" onerror="this.style.display='none'">` : '<span class="skill-placeholder">⚡</span>'}
                </div>
                <div class="skill-card-info">
                    <div class="skill-card-title">${title}</div>
                    <div class="skill-card-meta">
                        <span class="skill-label">${label}</span>
                        ${skill.SkillCD > 0 ? `<span class="skill-label">CD: ${(skill.SkillCD / 10000).toFixed(1)}초</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="skill-card-body">
                <div class="skill-card-desc">${description}</div>
            </div>
        `;

        container.appendChild(card);
    });

    if (container.children.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚡</div><div class="empty-state-text">스킬 정보가 없습니다.</div></div>';
    }
}

/**
 * Update global skill level
 */
function updateSkillLevelDB(newLevel: number) {
    dbState.skillLevel = Math.max(1, Math.min(13, newLevel));

    // Update display
    const display = document.getElementById('skill-level-display');
    if (display) {
        display.textContent = dbState.skillLevel.toString();
    }

    // Update slider
    const slider = document.getElementById('skill-level-slider');
    if (slider) {
        (slider as HTMLInputElement).value = String(dbState.skillLevel);
    }

    // Re-render skills and potentials (potentials also depend on skill level)
    if (dbState.selectedCharacterId) {
        renderSkills(dbState.selectedCharacterId);
        renderPotentials(dbState.selectedCharacterId);
    }
}

/**
 * Adjust skill level by delta
 */
function adjustSkillLevel(delta: number): void {
    const newLevel = dbState.skillLevel + delta;
    updateSkillLevelDB(newLevel);
}

// =============================================================================
// TALENTS SECTION
// =============================================================================

/**
 * Render character talents (limit break progression)
 */
function renderTalents(charId: string): void {
    const container = dbState.domCache.talentsDisplay || document.getElementById('talents-display');
    if (!container) return;

    // Check if talent data is loaded
    if (!dbState.talentGroups || Object.keys(dbState.talentGroups).length === 0 ||
        !dbState.talents || Object.keys(dbState.talents).length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-text">돌파 데이터를 불러오는 중...</div></div>';
        return;
    }

    // Find all talent groups for this character (Background 1-5 for limit breaks)
    const talentGroups = Object.values(dbState.talentGroups)
        .filter(group => group.CharId === charId)
        .sort((a, b) => a.Background - b.Background);

    if (talentGroups.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✨</div><div class="empty-state-text">돌파 정보가 없습니다.</div></div>';
        return;
    }

    container.innerHTML = '';

    talentGroups.forEach(group => {
        // Get title for this limit break phase
        const titleKey = group.Title;
        const title = dbState.talentGroupsKR[titleKey] || `돌파 ${group.Background}`;

        // Create section for this limit break
        const section = document.createElement('div');
        section.className = 'talent-section';

        // Section header
        const header = document.createElement('div');
        header.className = 'talent-section-header';
        header.innerHTML = `
            <div class="talent-section-title">
                <span class="talent-section-icon">🌟</span>
                ${title}
            </div>
            <div class="talent-section-badge">돌파 ${group.Background}</div>
        `;
        section.appendChild(header);

        // Get all talents for this group
        const talents = Object.values(dbState.talents)
            .filter(talent => talent.GroupId === group.Id)
            .sort((a, b) => a.Sort - b.Sort);

        // Separate sub nodes (Type 2) and main node (Type 1)
        const subNodes = talents.filter(t => t.Type === 2);
        const mainNode = talents.find(t => t.Type === 1);

        // Render sub nodes (stat increases) - aggregate them
        if (subNodes.length > 0) {
            const subNodesContainer = document.createElement('div');
            subNodesContainer.className = 'talent-subnodes';

            const subNodesTitle = document.createElement('div');
            subNodesTitle.className = 'talent-subnodes-title';
            subNodesTitle.textContent = '스탯 증가';
            subNodesContainer.appendChild(subNodesTitle);

            // Aggregate stats by effectAttributeType (the actual stat ID)
            const statAggregation = {};

            subNodes.forEach(talent => {
                if (talent.Param1) {
                    // Parse the param to get the actual value
                    const parsed = parseParamValue(talent.Param1, 1, 1, null, dbState);

                    // Extract info from Param1
                    const paramParts = talent.Param1.split(',');
                    if (paramParts.length >= 3) {
                        const effectId = paramParts[2];
                        const formatType = paramParts[4] || 'Fixed';

                        // Get the effect data
                        const effectData = dbState.effectValue[effectId];
                        if (effectData) {
                            // Get the actual stat type ID from EffectTypeFirstSubtype
                            const statTypeId = effectData.EffectTypeFirstSubtype;

                            // Get the raw value from EffectTypeParam1
                            const rawValue = parseFloat(effectData.EffectTypeParam1);

                            if (statTypeId !== undefined && !isNaN(rawValue)) {
                                // Use statTypeId as the key for aggregation
                                if (!(statAggregation as any)[statTypeId]) {
                                    (statAggregation as any)[statTypeId] = {
                                        value: 0,
                                        formatType: formatType,
                                        count: 0
                                    };
                                }

                                // Add the raw value (rounded to avoid floating point errors)
                                (statAggregation as any)[statTypeId].value = Math.round(((statAggregation as any)[statTypeId].value + rawValue) * 1000000) / 1000000;
                                (statAggregation as any)[statTypeId].count++;
                            }
                        }
                    }
                }
            });

            // Render aggregated stats
            const statsList = document.createElement('div');
            statsList.className = 'talent-stats-list';

            for (const [statTypeId, data] of Object.entries(statAggregation)) {
                const statItem = document.createElement('div');
                statItem.className = 'talent-stat-item';

                // Get stat name from GameEnums effectAttributeType
                const statEnum = dbState.gameEnums?.effectAttributeType?.[statTypeId];
                const statName = statEnum?.name || `Stat ${statTypeId}`;

                // Format the value
                const data = (statAggregation as any)[statTypeId] as any;
                let displayValue = data.value;
                if (data.formatType === 'HdPct') {
                    displayValue = (Math.round(data.value * 10000) / 100).toFixed(2) + '%';
                } else if (data.formatType === '10KHdPct') {
                    displayValue = (Math.round(data.value) / 100).toFixed(2) + '%';
                } else if (data.formatType === '10K') {
                    displayValue = (Math.round(data.value) / 10000).toFixed(1);
                } else if (data.formatType === '10KPct') {
                    displayValue = (Math.round(data.value) / 10000).toFixed(1) + '%';
                } else {
                    // For Fixed format, round to nearest integer
                    displayValue = Math.round(data.value).toLocaleString();
                }

                statItem.innerHTML = `
                    <span class="talent-stat-name">${statName}</span>
                    <span class="talent-stat-value">+${displayValue}</span>
                `;
                statsList.appendChild(statItem);
            }

            subNodesContainer.appendChild(statsList);
            section.appendChild(subNodesContainer);
        }

        // Render main node (main effect)
        if (mainNode) {
            const descKey = mainNode.Desc;
            let mainDesc = dbState.talentsKR[descKey] || '';

            // Parse parameters
            currentPotentialData = mainNode;
            mainDesc = processDescription(mainDesc, 1, 1);

            const mainNodeCard = document.createElement('div');
            mainNodeCard.className = 'talent-mainnode';

            mainNodeCard.innerHTML = `
                <div class="talent-mainnode-desc">${mainDesc}</div>
            `;

            section.appendChild(mainNodeCard);
        }

        container.appendChild(section);
    });
}

// Make functions globally accessible
window.switchPotentialType = switchPotentialType;
window.updatePotentialLevel = updatePotentialLevel;
window.adjustPotentialLevel = adjustPotentialLevel;
window.switchCharDbTab = switchCharDbTab;
window.updateSkillLevel = updateSkillLevelDB;
window.adjustSkillLevel = adjustSkillLevel;
(window as unknown as Record<string, unknown>).changeCharacterType = changeCharacterType;
(window as unknown as Record<string, unknown>).selectCharacter = selectCharacter;
(window as unknown as Record<string, unknown>).closeImageLightbox = closeImageLightbox;

// Type declarations for characterdb-specific functions
declare global {
  interface Window {
    switchPotentialType?: (type: string, event: Event) => void;
    updatePotentialLevel?: (level: number) => void;
    adjustPotentialLevel?: (delta: number) => void;
    switchCharDbTab?: (tabName: string) => void;
    updateSkillLevel?: (level: number) => void;
    changeCharacterType?: (type: string, event: Event) => void;
    selectCharacter?: (charId: string, event: Event) => void;
    closeImageLightbox?: () => void;
  }
}
