// Disc Database Module
// Handles disc selection, details display, and L2D integration

(function() {
    'use strict';

    // State management
    const discDBState = {
        allDiscs: [],
        discNames: {},
        discData: {},
        discIPData: {},
        discIPKRData: {},
        itemData: {},
        itemKRData: {},
        gameEnums: {},
        mainSkillData: {},
        secondarySkillData: {},
        mainSkillKRData: {},
        secondarySkillKRData: {},
        subNoteSkillData: {},
        subNoteSkillKRData: {},
        subNoteSkillPromoteData: {},
        discTagKRData: {},
        attributeData: {},
        discExtraAttributeData: {},
        currentDiscId: null,
        // Display level controls
        skillLevel: 5, // 1-5 for main/secondary skills (limit break level)
        phaseLevel: 0, // 0-8 for notes (phase level)
        // Disc stat controls
        discLevel: 1, // 1-90
        discLimitBreak: 0, // 0-8 (advances at 10, 20, 30, 40, 50, 60, 70, 80, 90)
        // Selector state
        selector: {
            fuse: null,
            selectedElement: 'all'
        }
    };

    // Constants for element parsing (defined once, reused many times)
    const ELEMENT_COLORS = {
        '빛': '#FFD700',
        '불': '#FF4444',
        '바람': '#44FF44',
        '물': '#4444FF',
        '어둠': '#9944FF',
        '땅': '#8B4513'
    };

    const ELEMENT_ICONS = {
        '1015': 'Icon_ElementTagTrigger_Light',
        '1016': 'Icon_ElementTagTrigger_Fire',
        '1017': 'Icon_ElementTagTrigger_Wind',
        '1018': 'Icon_ElementTagTrigger_Water',
        '1019': 'Icon_ElementTagTrigger_Dark',
        '1020': 'Icon_ElementTagTrigger_Earth',
        '2016': 'Icon_ElementTagTrigger_Light',
        '2013': 'Icon_ElementTagTrigger_Fire',
        '2017': 'Icon_ElementTagTrigger_Wind',
        '2008': 'Icon_ElementTagTrigger_Water',
        '2018': 'Icon_ElementTagTrigger_Dark',
        '2029': 'Icon_ElementTagTrigger_Earth'
    };

    // Utility function to extract filename from path
    function extractFilename(path) {
        if (!path) return '';
        const parts = path.split('/');
        return parts[parts.length - 1];
    }

    // Load all disc data
    async function loadDiscData() {
        try {
            const [
                discData,
                discIPData,
                discIPKRData,
                itemData,
                itemKRData,
                gameEnums,
                mainSkillData,
                secondarySkillData,
                mainSkillKRData,
                secondarySkillKRData,
                subNoteSkillData,
                subNoteSkillKRData,
                subNoteSkillPromoteData,
                discTagKRData,
                attributeData,
                discExtraAttributeData
            ] = await Promise.all([
                fetch('data/Disc.json').then(r => r.json()),
                fetch('data/DiscIP.json').then(r => r.json()),
                fetch('data/kr/DiscIP.json').then(r => r.json()),
                fetch('data/Item.json').then(r => r.json()),
                fetch('data/kr/Item.json').then(r => r.json()),
                fetch('data/GameEnums.json').then(r => r.json()),
                fetch('data/MainSkill.json').then(r => r.json()),
                fetch('data/SecondarySkill.json').then(r => r.json()),
                fetch('data/kr/MainSkill.json').then(r => r.json()),
                fetch('data/kr/SecondarySkill.json').then(r => r.json()),
                fetch('data/SubNoteSkill.json').then(r => r.json()),
                fetch('data/kr/SubNoteSkill.json').then(r => r.json()),
                fetch('data/SubNoteSkillPromoteGroup.json').then(r => r.json()),
                fetch('data/kr/DiscTag.json').then(r => r.json()),
                fetch('data/Attribute.json').then(r => r.json()),
                fetch('data/DiscExtraAttribute.json').then(r => r.json())
            ]);

            discDBState.discData = discData;
            discDBState.discIPData = discIPData;
            discDBState.discIPKRData = discIPKRData;
            discDBState.itemData = itemData;
            discDBState.itemKRData = itemKRData;
            discDBState.gameEnums = gameEnums;
            discDBState.mainSkillData = mainSkillData;
            discDBState.secondarySkillData = secondarySkillData;
            discDBState.mainSkillKRData = mainSkillKRData;
            discDBState.secondarySkillKRData = secondarySkillKRData;
            discDBState.subNoteSkillData = subNoteSkillData;
            discDBState.subNoteSkillKRData = subNoteSkillKRData;
            discDBState.subNoteSkillPromoteData = subNoteSkillPromoteData;
            discDBState.discTagKRData = discTagKRData;
            discDBState.attributeData = attributeData;
            discDBState.discExtraAttributeData = discExtraAttributeData;

            // Build disc names map
            Object.entries(discData).forEach(([id, disc]) => {
                if (disc.Visible && disc.Available) {
                    const discIPEntry = discIPData[id];
                    if (discIPEntry) {
                        const storyName = discIPEntry.StoryName;
                        discDBState.discNames[id] = discIPKRData[storyName] || storyName || `레코드 ${id}`;
                    } else {
                        discDBState.discNames[id] = `레코드 ${id}`;
                    }
                }
            });

            // Build allDiscs array
            discDBState.allDiscs = Object.entries(discData)
                .filter(([id, disc]) => disc.Visible && disc.Available)
                .map(([id, disc]) => ({
                    id,
                    disc,
                    name: discDBState.discNames[id]
                }))
                .sort((a, b) => parseInt(b.id) - parseInt(a.id)); // Sort by ID descending

            // Initialize Fuse.js for search
            if (typeof Fuse !== 'undefined') {
                discDBState.selector.fuse = new Fuse(discDBState.allDiscs, {
                    keys: ['name', 'id'],
                    threshold: 0.4,
                    includeScore: true
                });
            }

            // Render disc selector
            renderDiscSelector('');

        } catch (error) {
            console.error('Error loading disc data:', error);
            if (typeof showError === 'function') {
                showError('레코드 데이터를 불러오는데 실패했습니다.');
            }
        }
    }

    // Render disc selector grid
    function renderDiscSelector(searchQuery = '') {
        const container = document.getElementById('disc-selector');
        if (!container) return;

        container.innerHTML = '';

        let discsToDisplay = discDBState.allDiscs;

        // Apply element filter
        if (discDBState.selector.selectedElement !== 'all') {
            discsToDisplay = discsToDisplay.filter(item =>
                String(item.disc.EET) === discDBState.selector.selectedElement
            );
        }

        // Apply search filter
        if (searchQuery && searchQuery.trim() !== '') {
            if (discDBState.selector.fuse) {
                const results = discDBState.selector.fuse.search(searchQuery);
                const searchIds = new Set(results.map(r => r.item.id));
                discsToDisplay = discsToDisplay.filter(item => searchIds.has(item.id));
            } else {
                const query = searchQuery.toLowerCase();
                discsToDisplay = discsToDisplay.filter(item =>
                    item.name.toLowerCase().includes(query) || item.id.includes(query)
                );
            }
        }

        if (discsToDisplay.length === 0) {
            container.innerHTML = '<div class="empty-search-state"><p>검색 결과가 없습니다</p></div>';
            return;
        }

        const fragment = document.createDocumentFragment();

        discsToDisplay.forEach(({ id, disc, name }) => {
            const itemData = discDBState.itemData[id];
            // Extract icon filename from Item.Icon path (e.g., "Icon/Disc/outfit_4039" -> "outfit_4039")
            let iconPath = '';
            if (itemData && itemData.Icon) {
                const iconName = extractFilename(itemData.Icon);
                iconPath = `assets/disc_icons/${iconName}.png`;
            }
            const elementInfo = discDBState.gameEnums.elementType?.[disc.EET] || {};
            const rarityInfo = getDiscRarityInfo(disc);

            const card = document.createElement('div');
            card.className = 'disc-card';
            card.onclick = () => selectDisc(id);

            card.innerHTML = `
                <div class="disc-card-image ${rarityInfo.borderClass}">
                    <img src="${iconPath}" alt="${name}" onerror="this.style.display='none'">
                    ${elementInfo.icon ? `<img src="${elementInfo.icon}" alt="${elementInfo.name}" class="disc-card-element-badge" onerror="this.style.display='none'">` : ''}
                </div>
                <div class="disc-card-info">
                    <div class="disc-card-name">${name}</div>
                    <div class="disc-card-id">ID: ${id}</div>
                </div>
            `;

            fragment.appendChild(card);
        });

        container.appendChild(fragment);
    }

    // Filter discs by element
    window.filterDiscsByElement = function(element) {
        discDBState.selector.selectedElement = element;

        // Update button states
        document.querySelectorAll('.element-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.element === element);
        });

        // Get current search query
        const searchInput = document.getElementById('disc-search');
        const searchQuery = searchInput ? searchInput.value : '';

        // Re-render selector
        renderDiscSelector(searchQuery);
    };

    // Render disc tags
    function renderDiscTags(disc) {
        const tagsContainer = document.getElementById('disc-tags');
        if (!tagsContainer) return;

        if (!disc.Tags || !Array.isArray(disc.Tags) || disc.Tags.length === 0) {
            tagsContainer.innerHTML = '';
            return;
        }

        const tagsHTML = disc.Tags.map(tagId => {
            const tagKey = `DiscTag.${tagId}.1`;
            const tagName = discDBState.discTagKRData[tagKey] || `Tag ${tagId}`;
            return `<span class="disc-tag-badge">${tagName}</span>`;
        }).join('');

        tagsContainer.innerHTML = tagsHTML;
    }

    // Calculate disc stats from slider value
    function getDiscStatsFromSlider(sliderValue) {
        // Advancements occur at: 11, 22, 33, 44, 55, 66, 77, 88
        // Slider goes 1-90 (level 1 to 90 with 8 limit break advancements at levels 10, 20, 30, 40, 50, 60, 70, 80)
        // No advancement at level 90
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

    // Render disc attributes
    function renderDiscAttributes(discId, level, limitBreak) {
        const statsContainer = document.getElementById('disc-stats-grid');
        if (!statsContainer) return;

        const disc = discDBState.discData[discId];
        if (!disc || !disc.AttrBaseGroupId) {
            statsContainer.innerHTML = '<p class="no-stats">속성 정보가 없습니다.</p>';
            return;
        }

        // Build attribute key based on whether there's a limit break
        let attrKey;
        if (limitBreak === 0) {
            // No break: GroupId + 3-digit level (e.g., 21003010 for level 10)
            attrKey = `${disc.AttrBaseGroupId}${String(level).padStart(3, '0')}`;
        } else {
            // With break: GroupId + break digit + 2-digit level (e.g., 21003110 for level 10, break 1)
            attrKey = `${disc.AttrBaseGroupId}${limitBreak}${String(level).padStart(2, '0')}`;
        }

        const attrData = discDBState.attributeData[attrKey];

        if (!attrData) {
            statsContainer.innerHTML = `<p class="no-stats">해당 레벨의 속성 정보를 찾을 수 없습니다. (Key: ${attrKey})</p>`;
            return;
        }

        // Get base attributes (exclude Id, GroupId, Break, lvl)
        const statsHTML = [];
        const excludeKeys = ['Id', 'GroupId', 'Break', 'lvl'];

        for (const [key, value] of Object.entries(attrData)) {
            if (excludeKeys.includes(key)) continue;

            // Get Korean name from effectAttributeType in GameEnums
            // Need to search case-insensitively since keys might be uppercase but enum uses numeric keys
            let attrName = key;
            
            // Search through effectAttributeType for matching key (case-insensitive)
            if (discDBState.gameEnums.effectAttributeType) {
                for (const [enumKey, enumValue] of Object.entries(discDBState.gameEnums.effectAttributeType)) {
                    if (enumValue.key && enumValue.key.toUpperCase() === key.toUpperCase()) {
                        attrName = enumValue.name;
                        break;
                    }
                }
            }

            statsHTML.push(`
                <div class="stat-item">
                    <span class="stat-name">${attrName}</span>
                    <span class="stat-value">${value}</span>
                </div>
            `);
        }

        // Add bonus attack from DiscExtraAttribute
        if (disc.AttrExtraGroupId) {
            const extraAttrs = Object.values(discDBState.discExtraAttributeData).filter(
                item => item.GroupId === disc.AttrExtraGroupId
            );

            if (extraAttrs.length > 0) {
                extraAttrs.sort((a, b) => a.Break - b.Break);

                statsHTML.push('<div class="stat-divider"></div>');
                statsHTML.push('<div class="stat-section-title">돌파 보너스 공격력</div>');

                extraAttrs.forEach(attr => {
                    statsHTML.push(`
                        <div class="stat-item extra-stat">
                            <span class="stat-name">돌파 ${attr.Break}</span>
                            <span class="stat-value">+${attr.Atk}</span>
                        </div>
                    `);
                });
            }
        }

        statsContainer.innerHTML = statsHTML.join('');
    }

    // Adjust disc level slider
    window.adjustDiscLevelSlider = function() {
        const slider = document.getElementById('disc-level-slider');
        const levelDisplay = document.getElementById('disc-current-level');
        const limitBreakDisplay = document.getElementById('disc-current-limitbreak');
        const limitBreakBadge = document.getElementById('disc-limitbreak-badge');

        if (!slider || !levelDisplay || !limitBreakDisplay) return;

        const sliderValue = parseInt(slider.value);
        const { level, limitBreak } = getDiscStatsFromSlider(sliderValue);

        // Update displays
        levelDisplay.textContent = level;
        limitBreakDisplay.textContent = limitBreak;

        // Show/hide limit break badge
        if (limitBreakBadge) {
            if (limitBreak > 0) {
                limitBreakBadge.style.display = 'inline-flex';
            } else {
                limitBreakBadge.style.display = 'none';
            }
        }

        // Update state
        discDBState.discLevel = level;
        discDBState.discLimitBreak = limitBreak;

        // Render stats
        if (discDBState.currentDiscId) {
            renderDiscAttributes(discDBState.currentDiscId, level, limitBreak);
        }
    };

    // Select and display disc
    function selectDisc(discId) {
        discDBState.currentDiscId = discId;
        const disc = discDBState.discData[discId];
        const discIP = discDBState.discIPData[discId];
        const itemData = discDBState.itemData[discId];

        if (!disc) return;

        // Show details container
        const detailsContainer = document.getElementById('disc-details');
        if (detailsContainer) {
            detailsContainer.style.display = 'block';
        }

        // Scroll to details
        detailsContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Update disc name
        const discName = discDBState.discNames[discId];
        const nameEl = document.getElementById('disc-name');
        if (nameEl) nameEl.textContent = discName;

        // Update disc ID
        const idEl = document.getElementById('disc-id');
        if (idEl) idEl.textContent = `ID: ${discId}`;

        // Update disc tags
        renderDiscTags(disc);

        // Update rarity stars
        const rarityInfo = getDiscRarityInfo(disc);
        const starsEl = document.getElementById('disc-rarity-stars');
        if (starsEl) {
            const starIcon = '★';
            const emptyStarIcon = '☆';
            const maxStars = 5;
            let starsHtml = '';

            for (let i = 0; i < maxStars; i++) {
                if (i < rarityInfo.stars) {
                    starsHtml += `<span class="star filled">${starIcon}</span>`;
                } else {
                    starsHtml += `<span class="star empty">${emptyStarIcon}</span>`;
                }
            }

            starsEl.innerHTML = starsHtml;
        }

        // Update element icon
        const elementInfo = discDBState.gameEnums.elementType?.[disc.EET] || {};
        const elementIcon = document.getElementById('disc-element-icon');
        if (elementIcon && elementInfo.icon) {
            elementIcon.src = elementInfo.icon;
            elementIcon.alt = elementInfo.name;
            elementIcon.style.display = 'inline-block';
        }

        // Update disc description (Literary from Item.json)
        updateDiscDescription(discId, itemData);

        // Update disc image
        updateDiscImage(discId, disc);

        // Update skills
        updateDiscSkills(disc);

        // Update archive/story
        updateDiscArchive(discId, discIP);

        // Reset and render disc attributes
        const levelSlider = document.getElementById('disc-level-slider');
        if (levelSlider) {
            levelSlider.value = 1;
            discDBState.discLevel = 1;
            discDBState.discLimitBreak = 0;

            const levelDisplay = document.getElementById('disc-current-level');
            const limitBreakDisplay = document.getElementById('disc-current-limitbreak');
            const limitBreakBadge = document.getElementById('disc-limitbreak-badge');

            if (levelDisplay) levelDisplay.textContent = '1';
            if (limitBreakDisplay) limitBreakDisplay.textContent = '0';
            if (limitBreakBadge) limitBreakBadge.style.display = 'none';
        }

        // Render initial stats
        renderDiscAttributes(discId, discDBState.discLevel, discDBState.discLimitBreak);

    }

    // Update disc description
    function updateDiscDescription(discId, itemData) {
        const descContainer = document.getElementById('disc-description');
        if (!descContainer) return;

        if (itemData && itemData.Literary) {
            const descKR = discDBState.itemKRData[itemData.Literary] || itemData.Literary;
            descContainer.innerHTML = `<p class="disc-literary">${descKR}</p>`;
        } else {
            descContainer.innerHTML = '<p class="disc-literary">설명 없음</p>';
        }
    }

    // Update disc image
    function updateDiscImage(discId, disc) {
        const imgEl = document.getElementById('disc-portrait');
        if (!imgEl) return;

        // Extract large image filename from DiscBg (e.g., "Disc/4039/4039" -> "4039")
        if (disc && disc.DiscBg) {
            const imageName = extractFilename(disc.DiscBg);
            const imagePath = `assets/disc_icons/${imageName}_B.png`;
            imgEl.src = imagePath;
            imgEl.style.display = 'block';
        } else {
            imgEl.style.display = 'none';
        }
    }

    // Get skill ID based on GroupId and level
    function getSkillId(groupId, level) {
        const levelStr = String(level).padStart(2, '0');
        return `${groupId}${levelStr}`;
    }

    // Get skill icon path
    function getSkillIconPath(iconPath) {
        if (!iconPath) return null;
        const filename = extractFilename(iconPath);
        return `assets/skill_icons/${filename}.png`;
    }

    // Update disc skills
    function updateDiscSkills(disc) {
        const container = document.getElementById('skills-container');
        if (!container) return;

        // Use array to collect HTML fragments (better memory performance than +=)
        const skillsHTML = [];

        // Use the selected skill level from toggle
        const limitBreak = discDBState.skillLevel;

        // Main Skill
        if (disc.MainSkillGroupId) {
            const skillId = getSkillId(disc.MainSkillGroupId, limitBreak);
            const mainSkill = discDBState.mainSkillData[skillId];

            if (mainSkill) {
                const skillName = discDBState.mainSkillKRData[mainSkill.Name] || mainSkill.Name || '메인 스킬';
                const rawDesc = discDBState.mainSkillKRData[mainSkill.Desc] || mainSkill.Desc || '';
                const parsedDesc = parseSkillDescription(rawDesc, mainSkill);
                const iconBgPath = getSkillIconPath(mainSkill.IconBg);
                const iconPath = getSkillIconPath(mainSkill.Icon);

                skillsHTML.push(`
                    <div class="skill-card main-skill">
                        <div class="skill-icon-container">
                            ${iconBgPath ? `<img src="${iconBgPath}" alt="skill bg" class="skill-icon-bg" onerror="this.style.display='none'">` : ''}
                            ${iconPath ? `<img src="${iconPath}" alt="${skillName}" class="skill-icon" onerror="this.style.display='none'">` : ''}
                        </div>
                        <div class="skill-content">
                            <div class="skill-header">
                                <span class="skill-badge main">멜로디 스킬</span>
                                <span class="skill-name">${skillName}</span>
                            </div>
                            <div class="skill-description">${parsedDesc}</div>
                        </div>
                    </div>
                `);
            }
        }

        // Secondary Skills - use same skill level as main skill (1-5)
        if (disc.SecondarySkillGroupId1) {
            const skillId = getSkillId(disc.SecondarySkillGroupId1, limitBreak);
            const secondarySkill = discDBState.secondarySkillData[skillId];

            if (secondarySkill) {
                const skillName = discDBState.secondarySkillKRData[secondarySkill.Name] || secondarySkill.Name || '협주 스킬';
                const rawDesc = discDBState.secondarySkillKRData[secondarySkill.Desc] || secondarySkill.Desc || '';
                const parsedDesc = parseSkillDescription(rawDesc, secondarySkill);
                const iconBgPath = getSkillIconPath(secondarySkill.IconBg);
                const iconPath = getSkillIconPath(secondarySkill.Icon);

                skillsHTML.push(`
                    <div class="skill-card secondary-skill">
                        <div class="skill-icon-container">
                            ${iconBgPath ? `<img src="${iconBgPath}" alt="skill bg" class="skill-icon-bg" onerror="this.style.display='none'">` : ''}
                            ${iconPath ? `<img src="${iconPath}" alt="${skillName}" class="skill-icon" onerror="this.style.display='none'">` : ''}
                        </div>
                        <div class="skill-content">
                            <div class="skill-header">
                                <span class="skill-badge secondary">협주 스킬 I</span>
                                <span class="skill-name">${skillName}</span>
                            </div>
                            <div class="skill-description">${parsedDesc}</div>
                        </div>
                    </div>
                `);
            }
        }

        // Secondary Skill 2
        if (disc.SecondarySkillGroupId2) {
            const skillId = getSkillId(disc.SecondarySkillGroupId2, limitBreak);
            const secondarySkill = discDBState.secondarySkillData[skillId];

            if (secondarySkill) {
                const skillName = discDBState.secondarySkillKRData[secondarySkill.Name] || secondarySkill.Name || '협주 스킬';
                const rawDesc = discDBState.secondarySkillKRData[secondarySkill.Desc] || secondarySkill.Desc || '';
                const parsedDesc = parseSkillDescription(rawDesc, secondarySkill);
                const iconBgPath = getSkillIconPath(secondarySkill.IconBg);
                const iconPath = getSkillIconPath(secondarySkill.Icon);

                skillsHTML.push(`
                    <div class="skill-card secondary-skill">
                        <div class="skill-icon-container">
                            ${iconBgPath ? `<img src="${iconBgPath}" alt="skill bg" class="skill-icon-bg" onerror="this.style.display='none'">` : ''}
                            ${iconPath ? `<img src="${iconPath}" alt="${skillName}" class="skill-icon" onerror="this.style.display='none'">` : ''}
                        </div>
                        <div class="skill-content">
                            <div class="skill-header">
                                <span class="skill-badge secondary">협주 스킬 II</span>
                                <span class="skill-name">${skillName}</span>
                            </div>
                            <div class="skill-description">${parsedDesc}</div>
                        </div>
                    </div>
                `);
            }
        }

        // Add note information if disc has SubNoteSkillGroupId (show for all discs)
        if (disc.SubNoteSkillGroupId) {
            skillsHTML.push(generateNotesDisplay(disc));
        }

        // Set innerHTML once (better performance than multiple +=)
        container.innerHTML = skillsHTML.join('');
    }

    // Generate notes display
    function generateNotesDisplay(disc) {
        if (!disc || !disc.SubNoteSkillGroupId) return '';

        // Use the selected phase level from toggle
        const phase = discDBState.phaseLevel;
        const lookupId = String(disc.SubNoteSkillGroupId * 100 + phase);
        const phaseData = discDBState.subNoteSkillPromoteData[lookupId];

        if (!phaseData || !phaseData.SubNoteSkills) return '';

        try {
            const noteContributions = JSON.parse(phaseData.SubNoteSkills);
            const noteItems = Object.entries(noteContributions).map(([noteId, count]) => {
                const noteData = discDBState.subNoteSkillData[noteId];
                if (!noteData) return '';

                const noteIconPath = getNoteIconPath(noteData);
                const noteName = discDBState.subNoteSkillKRData[noteData.Name] || noteData.Name || '';

                return `
                    <div class="note-item">
                        ${noteIconPath ? `<img src="${noteIconPath}" alt="${noteName}" class="note-icon" onerror="this.style.display='none'">` : ''}
                        <div class="note-info">
                            <div class="note-name">${noteName}</div>
                            <div class="note-count">+${count}</div>
                        </div>
                    </div>
                `;
            }).filter(i => i).join('');

            if (noteItems) {
                return `
                    <div class="notes-section">
                        <div class="section-header">
                            <h3 class="section-title">
                                <span class="section-icon"><i class="fa-solid fa-music"></i></span>
                                제공 소리
                            </h3>
                        </div>
                        
                        <!-- Note Phase Control -->
                        <div class="note-level-control">
                            <label class="level-label">
                                <i class="fa-solid fa-music"></i> 소리 단계
                            </label>
                            <div class="level-adjuster">
                                <button class="level-btn" onclick="adjustPhaseLevel(-1)">
                                    <i class="fa-solid fa-minus"></i>
                                </button>
                                <span id="phase-level-display" class="level-display">1+</span>
                                <button class="level-btn" onclick="adjustPhaseLevel(1)">
                                    <i class="fa-solid fa-plus"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div class="notes-grid">
                            ${noteItems}
                        </div>
                    </div>
                `;
            }
        } catch (e) {
            console.error('Error parsing notes:', e);
        }

        return '';
    }

    // Get note icon path
    function getNoteIconPath(noteData) {
        if (!noteData || !noteData.Icon) return '';
        const filename = extractFilename(noteData.Icon);
        return `assets/${filename}_S.png`;
    }

    // Adjust skill level (1-5)
    window.adjustSkillLevel = function(delta) {
        const currentLevel = discDBState.skillLevel;
        const newLevel = Math.max(1, Math.min(5, currentLevel + delta));

        if (newLevel !== currentLevel) {
            discDBState.skillLevel = newLevel;
            const displayEl = document.getElementById('skill-level-display');
            if (displayEl) displayEl.textContent = newLevel;

            // Refresh skills display
            if (discDBState.currentDiscId) {
                const disc = discDBState.discData[discDBState.currentDiscId];
                if (disc) {
                    updateDiscSkills(disc);
                }
            }
        }
    };

    // Adjust phase level (0-8)
    window.adjustPhaseLevel = function(delta) {
        const currentPhase = discDBState.phaseLevel;
        const newPhase = Math.max(0, Math.min(8, currentPhase + delta));

        if (newPhase !== currentPhase) {
            discDBState.phaseLevel = newPhase;

            // Phase to label mapping
            const phaseLabelMap = ['1+', '10+', '20+', '30+', '40+', '50+', '60+', '70+', '80+'];
            const displayEl = document.getElementById('phase-level-display');
            if (displayEl) displayEl.textContent = phaseLabelMap[newPhase];

            // Refresh skills and notes display
            if (discDBState.currentDiscId) {
                const disc = discDBState.discData[discDBState.currentDiscId];
                if (disc) {
                    updateDiscSkills(disc);
                }
            }
        }
    };

    // Update disc archive/story
    function updateDiscArchive(discId, discIP) {
        const container = document.getElementById('archive-container');
        if (!container) return;

        if (!discIP) {
            container.innerHTML = '<p class="no-archive">스토리 정보가 없습니다.</p>';
            return;
        }

        const storyName = discIP.StoryName;
        const storyDesc = discIP.StoryDesc;
        const storyNameKR = discDBState.discIPKRData[storyName] || storyName || '';
        const storyDescKR = discDBState.discIPKRData[storyDesc] || storyDesc || '';

        container.innerHTML = `
            <div class="archive-item">
                <div class="archive-header">
                    <h3 class="archive-title">${storyNameKR}</h3>
                </div>
                <div class="archive-content">
                    <p>${storyDescKR}</p>
                </div>
            </div>
        `;
    }

    // Get rarity info for a disc
    function getDiscRarityInfo(disc) {
        if (!disc || !disc.Id) return { key: 'N', stars: 1, borderClass: 'rarity-n' };
        const item = discDBState.itemData[disc.Id];
        if (!item || !item.Rarity) return { key: 'N', stars: 1, borderClass: 'rarity-n' };

        const rarityInfo = discDBState.gameEnums.itemRarity?.[item.Rarity];
        if (!rarityInfo) return { key: 'N', stars: 1, borderClass: 'rarity-n' };

        // Map rarity to border class
        const rarityClassMap = {
            'SSR': 'rarity-ssr',
            'SR': 'rarity-sr',
            'R': 'rarity-r',
            'M': 'rarity-m',
            'N': 'rarity-n'
        };

        return {
            key: rarityInfo.key,
            stars: rarityInfo.stars,
            borderClass: rarityClassMap[rarityInfo.key] || 'rarity-n'
        };
    }

    // Parse skill description with parameters (from discs.js)
    function parseSkillDescription(description, skill) {
        if (!description || !skill) return description;

        let parsedDesc = description;

        // Replace {1} through {10} with actual Param values
        for (let i = 1; i <= 10; i++) {
            const placeholder = `{${i}}`;
            const paramValue = skill[`Param${i}`];

            if (parsedDesc.includes(placeholder) && paramValue) {
                // Wrap the parameter value in a styled span
                const styledValue = `<span class="param-value">${paramValue}</span>`;
                parsedDesc = parsedDesc.replaceAll(placeholder, styledValue);
            }
        }

        // Parse element tag patterns
        parsedDesc = parseElementTags(parsedDesc);

        return parsedDesc;
    }

    // Parse element tag patterns in descriptions (from discs.js)
    function parseElementTags(description) {
        if (!description) return description;

        // Pattern 1: ##ElementName 속성 표식: AdditionalName#IconId#
        const extendedPattern = /##([가-힣]+)\s*속성\s*표식:\s*([가-힣]+)#(\d+)#/g;

        // Pattern 2: ##ElementName 속성 표식#IconId#
        const basicPattern = /##([가-힣]+)\s*속성\s*표식#(\d+)#/g;

        // Replace extended format
        let result = description.replace(extendedPattern, (match, elementName, additionalName, iconId) => {
            const color = ELEMENT_COLORS[elementName] || '#FFFFFF';
            const iconName = ELEMENT_ICONS[iconId];
            const iconPath = iconName ? `assets/${iconName}.png` : '';

            return `<span class="element-tag" style="color: ${color}; font-weight: 600;">
                ${elementName} 속성 표식: ${additionalName}
                ${iconPath ? `<img src="${iconPath}" alt="${elementName}" class="element-tag-icon" style="width: 20px; height: 20px; vertical-align: middle; margin-left: 4px;" onerror="this.style.display='none'">` : ''}
            </span>`;
        });

        // Replace basic format
        result = result.replace(basicPattern, (match, elementName, iconId) => {
            const color = ELEMENT_COLORS[elementName] || '#FFFFFF';
            const iconName = ELEMENT_ICONS[iconId];
            const iconPath = iconName ? `assets/${iconName}.png` : '';

            return `<span class="element-tag" style="color: ${color}; font-weight: 600;">
                ${elementName} 속성 표식
                ${iconPath ? `<img src="${iconPath}" alt="${elementName}" class="element-tag-icon" style="width: 20px; height: 20px; vertical-align: middle; margin-left: 4px;" onerror="this.style.display='none'">` : ''}
            </span>`;
        });

        return result;
    }

    // Setup search input handler with debouncing
    function setupSearchHandler() {
        const searchInput = document.getElementById('disc-search');
        if (!searchInput) return;

        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            // Clear previous timer
            clearTimeout(debounceTimer);
            
            // Set new timer (300ms debounce)
            debounceTimer = setTimeout(() => {
                renderDiscSelector(e.target.value);
            }, 300);
        });
    }

    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            loadDiscData();
            setupSearchHandler();
        });
    } else {
        loadDiscData();
        setupSearchHandler();
    }

})();
