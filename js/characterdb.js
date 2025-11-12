// Character Database State
const dbState = {
    characters: {},
    charactersKR: {},
    characterDes: {},
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
    selectedCharacterId: null,
    currentLevel: 1,
    currentLimitBreak: 0,
    selectedCharacterType: '01', // 01=일반, 02=각성, 03=스킨
    // Cached DOM elements
    domCache: {},
    // Pre-computed tag to gifts map for performance
    tagToGiftsMap: {}
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

// Stat icons (for display) - Using Font Awesome via getIcon()
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
const DATA_VERSION = '1.1.1'; // Updated for charGetLines support

/**
 * Debounce utility function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Shared image error handler
 */
function handleImageError(img) {
    img.style.display = 'none';
}

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
        heroSection: document.querySelector('.character-hero-section')
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
            gift.Tags.forEach(tag => {
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
function saveDataToCache(data) {
    try {
        const cacheData = {
            version: DATA_VERSION,
            timestamp: Date.now(),
            data: data
        };
        localStorage.setItem('characterdb_data', JSON.stringify(cacheData));
    } catch (e) {
        console.warn('Failed to cache data:', e);
    }
}

/**
 * Load data from localStorage if valid
 */
function loadDataFromCache() {
    try {
        const cached = localStorage.getItem('characterdb_data');
        if (!cached) return null;

        const cacheData = JSON.parse(cached);

        // Check version and age (cache for 24 hours)
        const age = Date.now() - cacheData.timestamp;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (cacheData.version === DATA_VERSION && age < maxAge) {
            return cacheData.data;
        }

        // Clear old cache
        localStorage.removeItem('characterdb_data');
        return null;
    } catch (e) {
        console.warn('Failed to load cache:', e);
        return null;
    }
}

/**
 * Load all required data files
 */
async function loadData() {
    // Try to load from cache first
    const cachedData = loadDataFromCache();
    if (cachedData) {
        console.log('Loading data from cache');
        Object.assign(dbState, cachedData);
        cacheDOMElements();
        buildTagToGiftsMap();
        renderCharacterSelector();
        return;
    }
    try {
        const [
            charactersData,
            charactersKRData,
            characterDesData,
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
            enumsData
        ] = await Promise.all([
            fetch('data/Character.json').then(r => r.json()),
            fetch('data/kr/Character.json').then(r => r.json()),
            fetch('data/CharacterDes.json').then(r => r.json()),
            fetch('data/kr/CharacterTag.json').then(r => r.json()),
            fetch('data/AffinityGift.json').then(r => r.json()),
            fetch('data/Item.json').then(r => r.json()),
            fetch('data/kr/Item.json').then(r => r.json()),
            fetch('data/Attribute.json').then(r => r.json()),
            fetch('data/CharacterArchive.json').then(r => r.json()),
            fetch('data/CharacterArchiveContent.json').then(r => r.json()),
            fetch('data/kr/CharacterArchiveContent.json').then(r => r.json()),
            fetch('data/DatingCharacterEvent.json').then(r => r.json()),
            fetch('data/kr/DatingLandmark.json').then(r => r.json()),
            fetch('data/kr/DatingBranch.json').then(r => r.json()),
            fetch('data/CharGetLines.json').then(r => r.json()),
            fetch('data/kr/CharGetLines.json').then(r => r.json()),
            fetch('data/GameEnums.json').then(r => r.json())
        ]);

        dbState.characters = charactersData;
        dbState.charactersKR = charactersKRData;
        dbState.characterDes = characterDesData;
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

        console.log('Data loaded successfully from server');

        // Save to cache
        const dataToCache = {
            characters: dbState.characters,
            charactersKR: dbState.charactersKR,
            characterDes: dbState.characterDes,
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
            gameEnums: dbState.gameEnums
        };
        saveDataToCache(dataToCache);

        // Cache DOM elements and build maps
        cacheDOMElements();
        buildTagToGiftsMap();

        renderCharacterSelector();
    } catch (error) {
        console.error('Error loading data:', error);
        showError('데이터를 불러오는 중 오류가 발생했습니다. 페이지를 새로고침해주세요.');

        // Try to load from cache as fallback
        const cachedData = loadDataFromCache();
        if (cachedData) {
            console.log('Falling back to cached data');
            Object.assign(dbState, cachedData);
            cacheDOMElements();
            buildTagToGiftsMap();
            renderCharacterSelector();
            showWarning('오프라인 모드: 캐시된 데이터를 사용하고 있습니다.');
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
function selectCharacter(charId, event) {
    dbState.selectedCharacterId = charId;
    dbState.currentLevel = 1;
    dbState.currentLimitBreak = 0;
    dbState.selectedCharacterType = '01'; // Reset to default type

    // Update selected state in UI
    document.querySelectorAll('.character-selector-card').forEach(card => {
        card.classList.remove('selected');
    });
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('selected');
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

    // Scroll to details
    detailsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Render character header card
 */
function renderCharacterHeader(charId) {
    const char = dbState.characters[charId];
    const charNameKey = `Character.${charId}.1`;
    const charName = dbState.charactersKR[charNameKey] || `Character ${charId}`;
    const charDes = dbState.characterDes[charId];

    // Apply character theme color based on element type
    const heroSection = dbState.domCache.heroSection || document.querySelector('.character-hero-section');
    const elementColorData = ELEMENT_COLORS[char.EET];
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
        gradeBadge.innerHTML = getIcon('star').repeat(gradeData.stars);
        gradeBadge.style.display = 'inline-flex';
    } else {
        gradeBadge.style.display = 'none';
    }

    // Render character tags
    const tagsContainer = dbState.domCache.charTags || document.getElementById('char-tags');
    tagsContainer.innerHTML = '';
    if (charDes && charDes.Tag) {
        charDes.Tag.forEach(tagId => {
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
            birthdayInfo.innerHTML = `<span class="info-icon">${getIcon('birthday')}</span><span class="info-label">생일</span><span class="info-value">${charDes.Birthday}</span>`;
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
function renderGiftPreferences(charId) {
    const container = dbState.domCache.charQuickStats || document.getElementById('char-quick-stats');
    container.innerHTML = '';
    const charDes = dbState.characterDes[charId];

    if (!charDes) {
        container.innerHTML = '<div class="gift-empty">선물 정보 없음</div>';
        return;
    }

    // Render preferred gifts
    if (charDes.PreferTags && charDes.PreferTags.length > 0) {
        const preferSection = document.createElement('div');
        preferSection.className = 'gift-section';

        const preferTitle = document.createElement('div');
        preferTitle.className = 'gift-section-title prefer';
        preferTitle.innerHTML = `<span class="gift-icon">${getIcon('dating')}</span> 좋아하는 선물`;
        preferSection.appendChild(preferTitle);

        const preferGrid = document.createElement('div');
        preferGrid.className = 'gift-grid';

        charDes.PreferTags.forEach(tag => {
            const gifts = findGiftsByTag(tag);
            gifts.forEach(gift => {
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
        hateTitle.innerHTML = `<span class="gift-icon">${getIcon('heartBroken')}</span> 싫어하는 선물`;
        hateSection.appendChild(hateTitle);

        const hateGrid = document.createElement('div');
        hateGrid.className = 'gift-grid';

        charDes.HateTags.forEach(tag => {
            const gifts = findGiftsByTag(tag);
            gifts.forEach(gift => {
                hateGrid.appendChild(createGiftIcon(gift, true));
            });
        });

        hateSection.appendChild(hateGrid);
        container.appendChild(hateSection);
    }

    if ((!charDes.PreferTags || charDes.PreferTags.length === 0) &&
        (!charDes.HateTags || charDes.HateTags.length === 0)) {
        container.innerHTML = '<div class="gift-empty">선물 정보 없음</div>';
    }
}

/**
 * Find gifts by tag (optimized with pre-computed map)
 */
function findGiftsByTag(tag) {
    return dbState.tagToGiftsMap[tag] || [];
}

/**
 * Create gift icon element
 */
function createGiftIcon(gift, isHate) {
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
    const itemName = dbState.itemsKR[itemNameKey] || 'Unknown';

    // Get rarity background
    const rarityMap = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };
    const rarityNum = rarityMap[item.Rarity] || 5;
    const rarityBg = `assets/items/rare_item_a_${rarityNum}.png`;

    // Get item icon
    const iconParts = item.Icon.split('/');
    const iconFile = iconParts[iconParts.length - 1];
    const iconPath = `assets/items/${iconFile}.png`;

    // Create icon structure
    wrapper.innerHTML = `
        <div class="gift-icon-bg">
            <img src="${rarityBg}" class="gift-rarity-bg" onerror="handleImageError(this)">
        </div>
        <img src="${iconPath}" class="gift-item-icon" onerror="handleImageError(this)" alt="${itemName}">
        <div class="gift-tooltip">${itemName}</div>
    `;

    return wrapper;
}

/**
 * Render character images with type selection
 */
function renderCharacterImages(charId) {
    const charIdStr = String(charId);
    const type = dbState.selectedCharacterType;

    // Update portrait (main SK image)
    const portraitContainer = document.querySelector('.character-portrait-hero');
    let portrait = document.getElementById('char-portrait');

    // Remove any existing no-image message
    const existingMessage = portraitContainer.querySelector('.portrait-no-image');
    if (existingMessage) {
        existingMessage.remove();
    }

    // If portrait doesn't exist, create it
    if (!portrait) {
        portrait = document.createElement('img');
        portrait.id = 'char-portrait';
        portrait.alt = 'Character Portrait';
        portraitContainer.insertBefore(portrait, portraitContainer.querySelector('.char-type-selector-hero'));
    } else {
        portrait.style.display = 'block';
    }

    portrait.src = `assets/char/head_${charIdStr}${type}_SK.png`;

    // Handle image error for skin type
    portrait.onerror = function() {
        if (type === '03') {
            // Hide the broken image
            this.style.display = 'none';

            // Show message for missing skin
            const message = document.createElement('div');
            message.className = 'portrait-no-image';
            message.textContent = '이 캐릭터는 스킨이 아직 없어요...';
            portraitContainer.insertBefore(message, portraitContainer.querySelector('.char-type-selector-hero'));
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
function renderCharacterImageGallery(charId) {
    const container = dbState.domCache.charImageGallery || document.getElementById('char-image-gallery');
    if (!container) return;

    container.innerHTML = '';
    const charIdStr = String(charId);
    const type = dbState.selectedCharacterType;

    // Image types to display (SK is now in header, so exclude it)
    const imageTypes = [
        { suffix: '_GC', label: '배너', className: 'char-img-banner', badgeColor: '#ec4899' },
        { suffix: '_GD', label: '얼굴', className: 'char-img-head', badgeColor: '#8b5cf6' },
        { suffix: '_GOODS', label: 'SD', className: 'char-img-sd', badgeColor: '#10b981' },
        { suffix: '_Q', label: 'SD Q', className: 'char-img-sd', badgeColor: '#f59e0b' }
    ];

    imageTypes.forEach(imgType => {
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'char-img-wrapper-new';

        // Image badge
        const badge = document.createElement('div');
        badge.className = 'char-img-badge';
        badge.textContent = imgType.label;
        badge.style.background = imgType.badgeColor;

        const img = document.createElement('img');
        img.className = `char-img-new ${imgType.className}`;
        img.src = `assets/char/head_${charIdStr}${type}${imgType.suffix}.png`;
        img.alt = `${imgType.label}`;
        img.dataset.fullSrc = img.src; // Store for lightbox
        img.onerror = function() {
            imgWrapper.style.display = 'none';
        };

        // Click to view full size
        img.onclick = function() {
            openImageLightbox(this.src, `${imgType.label}`);
        };

        imgWrapper.appendChild(badge);
        imgWrapper.appendChild(img);
        container.appendChild(imgWrapper);
    });
}

/**
 * Open image lightbox
 */
function openImageLightbox(src, title) {
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
    lightbox.querySelector('.lightbox-img').src = src;
    lightbox.querySelector('.lightbox-title').textContent = title;
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
function changeCharacterType(type, event) {
    dbState.selectedCharacterType = type;

    // Update type selector UI
    document.querySelectorAll('.char-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    // Re-render character images
    if (dbState.selectedCharacterId) {
        renderCharacterImages(dbState.selectedCharacterId);
    }
}

/**
 * Render character stats
 */
function renderStats(charId, level, limitBreak) {
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
            if (charIdFromGroup === charId || attr.GroupId === charId) {
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
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">스탯 정보를 찾을 수 없습니다.<br>ID: ${attrId}</div></div>`;
        return;
    }

    // Render main stats
    MAIN_STATS.forEach(statKey => {
        if (attrData[statKey] !== undefined) {
            const card = document.createElement('div');
            card.className = 'stat-card';

            const icon = document.createElement('div');
            icon.className = 'stat-icon';
            icon.innerHTML = getIcon(STAT_ICONS[statKey] || 'stats');

            const content = document.createElement('div');
            content.className = 'stat-content';

            const name = document.createElement('div');
            name.className = 'stat-name';
            name.textContent = STAT_NAMES[statKey] || statKey;

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
function renderArchive(charId) {
    const container = dbState.domCache.archiveList || document.getElementById('archive-list');
    container.innerHTML = '';

    // Find all archives for this character
    const archives = Object.values(dbState.characterArchive)
        .filter(arch => arch.CharacterId === charId)
        .sort((a, b) => a.Sort - b.Sort);

    if (archives.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${getIcon('archive')}</div><div class="empty-state-text">아카이브 정보가 없습니다.</div></div>`;
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
            updateDiv.innerHTML = `<div class="archive-update-label">⚠️ 조건 만족시 정보 변경</div>${updateText}`;
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
function toggleArchive(item) {
    item.classList.toggle('expanded');
}

/**
 * Get character chat lines for a specific character
 * Type 1 = '신규 입수시', 2 = '재 입수시', 3 = '각성 시', 4 = '호감도 10 달성시'
 */
function getCharacterChatLines(charId) {
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
                1: '신규 입수시',
                2: '재 입수시',
                3: '각성 시',
                4: '호감도 10 달성시'
            };

            const lineKey = line.Lines;
            const lineText = dbState.charGetLinesKR[lineKey] || '';

            return {
                type: line.Type,
                typeLabel: typeLabels[line.Type] || `Type ${line.Type}`,
                text: lineText
            };
        })
        .filter(line => line.text); // Filter out empty lines

    return chatLines;
}

/**
 * Render character chat lines as HTML
 */
function renderChatLinesHTML(chatLines) {
    if (!chatLines || chatLines.length === 0) {
        return '';
    }

    const linesHTML = chatLines.map(line => `
        <div class="chat-line-item">
            <div class="chat-line-type">${getIcon('chat')} ${line.typeLabel}</div>
            <div class="chat-line-text">${line.text}</div>
        </div>
    `).join('');

    return `
        <div class="chat-lines-container">
            <div class="chat-lines-header">${getIcon('comments')} 캐릭터 대사</div>
            ${linesHTML}
        </div>
    `;
}

/**
 * Render dating information
 */
function renderDating(charId) {
    const container = dbState.domCache.datingList || document.getElementById('dating-list');
    container.innerHTML = '';

    // Get the dating section
    const datingSection = document.querySelector('.dating-section');

    // Check if dating section is already wrapped
    let rightColumn = datingSection.parentElement;
    if (!rightColumn.classList.contains('character-right-column')) {
        // Create wrapper for right column (chat lines + dating)
        rightColumn = document.createElement('div');
        rightColumn.className = 'character-right-column';

        // Wrap the dating section
        datingSection.parentNode.insertBefore(rightColumn, datingSection);
        rightColumn.appendChild(datingSection);
    }

    // Remove any existing chat lines container
    const existingChatLines = rightColumn.querySelector('.chat-lines-section');
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
        rightColumn.insertBefore(chatLinesSection, datingSection);
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
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${getIcon('dating')}</div><div class="empty-state-text">데이트 정보가 없습니다.</div></div>`;
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
        const answer = dbState.datingBranchKR[branchKey] || 'db 버그.. 버그 제보해주시면 확인하겠습니다';

        const card = document.createElement('div');
        card.className = 'dating-card';

        const location = document.createElement('div');
        location.className = 'dating-location';
        location.innerHTML = `<span class="dating-location-icon">📍</span>${locationName}`;

        const answerLabel = document.createElement('div');
        answerLabel.className = 'dating-answer-label';
        answerLabel.textContent = '정답';

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
function getStatsFromSlider(sliderValue) {
    // Advancement points where limit break increases
    const advancements = [11, 22, 33, 44, 55, 66, 77, 88];

    let limitBreak = 0;
    for (let i = 0; i < advancements.length; i++) {
        if (sliderValue >= advancements[i]) {
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
document.addEventListener('DOMContentLoaded', () => {
    const levelSlider = document.getElementById('level-slider');
    const currentLevelDisplay = document.getElementById('current-level');
    const currentLimitBreakDisplay = document.getElementById('current-limitbreak');
    const limitBreakBadge = document.getElementById('limitbreak-badge');

    // Debounced stats render function (waits 150ms after user stops dragging)
    const debouncedRenderStats = debounce((charId, level, limitBreak) => {
        renderStats(charId, level, limitBreak);
    }, 150);

    levelSlider.addEventListener('input', (e) => {
        const sliderValue = parseInt(e.target.value);
        const { level, limitBreak } = getStatsFromSlider(sliderValue);

        // Update displays immediately (no lag for UI feedback)
        currentLevelDisplay.textContent = level;
        currentLimitBreakDisplay.textContent = limitBreak;

        // Show/hide limit break badge
        if (limitBreak > 0) {
            limitBreakBadge.style.display = 'inline-flex';
        } else {
            limitBreakBadge.style.display = 'none';
        }

        // Update state
        dbState.currentLevel = level;
        dbState.currentLimitBreak = limitBreak;

        // Render stats with debouncing (reduces DOM updates during dragging)
        if (dbState.selectedCharacterId) {
            debouncedRenderStats(dbState.selectedCharacterId, level, limitBreak);
        }
    });

    // Load data when page loads
    loadData();
});
