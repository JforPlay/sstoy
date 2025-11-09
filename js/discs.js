// Discs Tab Module
// Handles disc selection and management

(function() {
    'use strict';
    
    // State management
    const discsState = {
        allDiscs: [],
        discNames: {},
        itemData: {},
        gameEnums: {},
        mainSkillData: {},
        secondarySkillData: {},
        mainSkillKRData: {},
        secondarySkillKRData: {},
        subNoteSkillPromoteData: {},
        subNoteSkillData: {},
        subNoteSkillKRData: {},
        effectValueData: {},
        selectedDiscs: {
            main1: null,
            main2: null,
            main3: null,
            sub1: null,
            sub2: null,
            sub3: null
        },
        discLimitBreaks: {
            main1: 1,
            main2: 1,
            main3: 1,
            sub1: 1,
            sub2: 1,
            sub3: 1
        },
        // Track sub disc level growth (Phase 0-8)
        subDiscLevels: {
            sub1: 0, // Phase 0 = "1+", Phase 1 = "10+", etc.
            sub2: 0,
            sub3: 0
        },
        // Track acquired notes (manual) per note type
        acquiredNotes: {
            // e.g., "90011": 5, "90012": 3, etc.
        },
        currentSlot: null,
        // Track unique notes required by all main disc secondary skills
        requiredNotes: new Set() // Set of note IDs required by main discs
    };
    
    // Load disc data
    async function loadDiscData() {
        try {
            // Load Disc.json
            const discResponse = await fetch('data/Disc.json');
            const discData = await discResponse.json();
            
            // Load DiscIP.json for StoryName keys
            const discIPResponse = await fetch('data/DiscIP.json');
            const discIPData = await discIPResponse.json();
            
            // Load Korean translations
            const discKRResponse = await fetch('data/kr/DiscIP.json');
            const discKRData = await discKRResponse.json();
            
            // Load Item.json for icons
            const itemResponse = await fetch('data/Item.json');
            discsState.itemData = await itemResponse.json();
            
            // Load MainSkill.json
            const mainSkillResponse = await fetch('data/MainSkill.json');
            discsState.mainSkillData = await mainSkillResponse.json();
            
            // Load SecondarySkill.json
            const secondarySkillResponse = await fetch('data/SecondarySkill.json');
            discsState.secondarySkillData = await secondarySkillResponse.json();
            
            // Load Korean translations for skills
            const mainSkillKRResponse = await fetch('data/kr/MainSkill.json');
            discsState.mainSkillKRData = await mainSkillKRResponse.json();
            
            const secondarySkillKRResponse = await fetch('data/kr/SecondarySkill.json');
            discsState.secondarySkillKRData = await secondarySkillKRResponse.json();
            
            // Load SubNoteSkillPromoteGroup.json (maps GroupId to note types)
            const subNotePromoteResponse = await fetch('data/SubNoteSkillPromoteGroup.json');
            discsState.subNoteSkillPromoteData = await subNotePromoteResponse.json();
            
            // Load SubNoteSkill.json (note definitions)
            const subNoteSkillResponse = await fetch('data/SubNoteSkill.json');
            discsState.subNoteSkillData = await subNoteSkillResponse.json();
            
            // Load Korean translations for notes
            const subNoteSkillKRResponse = await fetch('data/kr/SubNoteSkill.json');
            discsState.subNoteSkillKRData = await subNoteSkillKRResponse.json();
            
            // Load EffectValue.json for proper parameter calculation
            const effectValueResponse = await fetch('data/EffectValue.json');
            discsState.effectValueData = await effectValueResponse.json();
            
            // Load GameEnums.json for element types
            const gameEnumsResponse = await fetch('data/GameEnums.json');
            discsState.gameEnums = await gameEnumsResponse.json();
            
            // Process disc data
            discsState.allDiscs = Object.values(discData).filter(disc => disc.Visible);
            
            // Create disc names mapping
            discsState.allDiscs.forEach(disc => {
                const discIP = discIPData[disc.Id];
                if (discIP && discIP.StoryName) {
                    const koreanName = discKRData[discIP.StoryName];
                    discsState.discNames[disc.Id] = koreanName || discIP.StoryName;
                }
            });
            
            renderDiscs();
        } catch (error) {
            console.error('Error loading disc data:', error);
            showToast('레코드 데이터를 불러오는데 실패했습니다.', 'error');
        }
    }
    
    // Extract icon path from Item.json
    function getDiscIconPath(disc) {
        if (!disc || !disc.Id) return '';
        const item = discsState.itemData[disc.Id];
        if (!item || !item.Icon) return '';
        
        const parts = item.Icon.split('/');
        const iconName = parts[parts.length - 1];
        return `assets/${iconName}.png`;
    }
    
    // Extract large image path from DiscBg
    function getDiscLargeImagePath(discBg) {
        if (!discBg) return '';
        const parts = discBg.split('/');
        const imageName = parts[parts.length - 1];
        return `assets/${imageName}_B.png`;
    }
    
    // Get element info for a disc
    function getDiscElementInfo(disc) {
        if (!disc || !disc.EET) return { name: '무속성', icon: '' };
        const elementInfo = discsState.gameEnums.elementType?.[disc.EET];
        return {
            name: elementInfo?.name || '무속성',
            icon: elementInfo?.icon || ''
        };
    }
    
    // Get rarity info for a disc
    function getDiscRarityInfo(disc) {
        if (!disc || !disc.Id) return { key: 'N', stars: 1, borderClass: 'rarity-n' };
        const item = discsState.itemData[disc.Id];
        if (!item || !item.Rarity) return { key: 'N', stars: 1, borderClass: 'rarity-n' };
        
        const rarityInfo = discsState.gameEnums.itemRarity?.[item.Rarity];
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
    
    // Get skill ID based on GroupId and limit break level
    function getSkillId(groupId, limitBreak) {
        // Format: GroupId + level (01-06)
        const levelStr = String(limitBreak).padStart(2, '0');
        return `${groupId}${levelStr}`;
    }
    
    // Get main skill data for a disc
    function getMainSkillData(disc, limitBreak) {
        if (!disc || !disc.MainSkillGroupId) return null;
        const skillId = getSkillId(disc.MainSkillGroupId, limitBreak);
        return discsState.mainSkillData[skillId];
    }
    
    // Get secondary skill data for a disc (can have up to 2 secondary skills)
    // Get secondary skill data based on note levels (not limit break)
    function getSecondarySkillsData(disc) {
        if (!disc) return [];

        const skills = [];
        const currentNoteLevels = getTotalNoteLevels(); // Get all current note levels

        // Check for SecondarySkillGroupId1
        if (disc.SecondarySkillGroupId1) {
            const skill1 = getSecondarySkillByNotes(disc.SecondarySkillGroupId1, currentNoteLevels);
            // Always add an entry, even if null (inactive)
            skills.push({
                skill: skill1,
                groupId: disc.SecondarySkillGroupId1,
                isActive: skill1 !== null,
                Level: skill1 ? skill1.Level : 0
            });
        }

        // Check for SecondarySkillGroupId2
        if (disc.SecondarySkillGroupId2) {
            const skill2 = getSecondarySkillByNotes(disc.SecondarySkillGroupId2, currentNoteLevels);
            // Always add an entry, even if null (inactive)
            skills.push({
                skill: skill2,
                groupId: disc.SecondarySkillGroupId2,
                isActive: skill2 !== null,
                Level: skill2 ? skill2.Level : 0
            });
        }

        return skills;
    }

    // Get total note levels (from discs + acquired)
    function getTotalNoteLevels() {
        const noteLevels = {};
        const notesFromDiscs = calculateNotesFromSubDiscs();

        // Combine notes from discs and acquired notes
        const allNoteIds = new Set([
            ...Object.keys(notesFromDiscs),
            ...Object.keys(discsState.acquiredNotes)
        ]);

        allNoteIds.forEach(noteId => {
            const fromDiscs = notesFromDiscs[noteId] || 0;
            const acquired = discsState.acquiredNotes[noteId] || 0;
            noteLevels[noteId] = fromDiscs + acquired;
        });

        return noteLevels;
    }

    // Find the highest secondary skill level achievable with current notes
    function getSecondarySkillByNotes(groupId, currentNoteLevels) {
        // Try levels 01-09 in descending order to find highest achievable
        let highestSkill = null;

        for (let level = 9; level >= 1; level--) {
            const skillId = String(groupId) + String(level).padStart(2, '0');
            const skill = discsState.secondarySkillData[skillId];

            if (skill) {
                if (skill.NeedSubNoteSkills) {
                    try {
                        const requirements = JSON.parse(skill.NeedSubNoteSkills);

                        // Check if all note requirements are met
                        const requirementsMet = Object.entries(requirements).every(([noteId, requiredLevel]) => {
                            const currentLevel = currentNoteLevels[noteId] || 0;
                            return currentLevel >= requiredLevel;
                        });

                        if (requirementsMet) {
                            highestSkill = skill;
                            break; // Found the highest achievable level
                        }
                    } catch (e) {
                        // Silent fail - invalid JSON format
                    }
                } else if (level === 1) {
                    // Level 1 with no requirements
                    highestSkill = skill;
                    break;
                }
            }
        }

        // Return highest achievable skill, or null if no requirements are met
        return highestSkill;
    }
    
    // Parse skill description with parameters
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
        
        return parsedDesc;
    }
    
    // Get translated skill name and description
    function getSkillTranslation(skill, isMainSkill) {
        if (!skill) return { name: '', desc: '' };
        
        const krData = isMainSkill ? discsState.mainSkillKRData : discsState.secondarySkillKRData;
        const name = krData[skill.Name] || skill.Name || '';
        const desc = krData[skill.Desc] || skill.Desc || '';
        
        return { 
            name, 
            desc: parseSkillDescription(desc, skill) 
        };
    }
    
    // Calculate notes contributed by sub discs
    function calculateNotesFromSubDiscs() {
        const notesFromDiscs = {}; // { "90011": 5, "90012": 3, etc. }
        
        // Iterate through sub disc slots
        ['sub1', 'sub2', 'sub3'].forEach(slotId => {
            const disc = discsState.selectedDiscs[slotId];
            if (!disc || !disc.SubNoteSkillGroupId) return;
            
            // Use the selected phase/level for this sub disc
            const phase = discsState.subDiscLevels[slotId] || 0;
            
            // Find the promote group entry for this disc at the selected phase
            const promoteEntry = Object.values(discsState.subNoteSkillPromoteData).find(entry => {
                if (entry.GroupId !== disc.SubNoteSkillGroupId) return false;
                const entryPhase = entry.Phase !== undefined ? entry.Phase : 0;
                return entryPhase === phase;
            });
            
            if (promoteEntry && promoteEntry.SubNoteSkills) {
                // Parse the JSON string: "{\"90011\":3,\"90012\":2}"
                try {
                    const noteContributions = JSON.parse(promoteEntry.SubNoteSkills);
                    
                    // Add each note type's contribution
                    for (const [noteId, value] of Object.entries(noteContributions)) {
                        notesFromDiscs[noteId] = (notesFromDiscs[noteId] || 0) + value;
                    }
                } catch (e) {
                    // Silent fail - invalid JSON
                }
            }
        });
        
        return notesFromDiscs;
    }
    
    // Get total note level (from discs + acquired)
    function getTotalNoteLevel(noteId) {
        const notesFromDiscs = calculateNotesFromSubDiscs();
        const fromDiscs = notesFromDiscs[noteId] || 0;
        const acquired = discsState.acquiredNotes[noteId] || 0;
        const total = fromDiscs + acquired;
        
        // Get max level from Scores array
        const noteData = discsState.subNoteSkillData[noteId];
        const maxLevel = noteData && noteData.Scores ? noteData.Scores.length : 100;
        
        return Math.min(total, maxLevel);
    }
    
    // Calculate score from secondary skills
    function calculateSecondarySkillsScore() {
        let totalScore = 0;
        
        // Check all main disc slots
        ['main1', 'main2', 'main3'].forEach(slotId => {
            const disc = discsState.selectedDiscs[slotId];
            if (!disc) return;
            
            const limitBreak = discsState.discLimitBreaks[slotId] || 1;
            const secondarySkills = getSecondarySkillsData(disc, limitBreak);
            
            secondarySkills.forEach(skillData => {
                if (skillData.isActive && skillData.skill && skillData.skill.Score) {
                    totalScore += skillData.skill.Score;
                }
            });
        });
        
        return totalScore;
    }
    
    // Calculate score from notes
    function calculateNotesScore() {
        let totalScore = 0;
        
        // Get all note types that have levels
        const notesFromDiscs = calculateNotesFromSubDiscs();
        const allNoteIds = new Set([
            ...Object.keys(notesFromDiscs),
            ...Object.keys(discsState.acquiredNotes)
        ]);
        
        allNoteIds.forEach(noteId => {
            const totalLevel = getTotalNoteLevel(noteId);
            if (totalLevel === 0) return;
            
            const noteData = discsState.subNoteSkillData[noteId];
            if (noteData && noteData.Scores) {
                // Use total level as index (0-based)
                const scoreIndex = totalLevel - 1;
                if (scoreIndex >= 0 && scoreIndex < noteData.Scores.length) {
                    totalScore += noteData.Scores[scoreIndex];
                }
            }
        });
        
        return totalScore;
    }
    
    // Calculate total disc score
    function calculateDiscScore() {
        const secondarySkillScore = calculateSecondarySkillsScore();
        const notesScore = calculateNotesScore();
        return secondarySkillScore + notesScore;
    }
    
    // Parse note description with &Param2& placeholder using EffectValue lookup
    function parseNoteDescription(description, noteId, level) {
        if (!description || level === 0) return description;
        
        const noteData = discsState.subNoteSkillData[noteId];
        if (!noteData || !noteData.Param2) return description;
        
        // Parse Param2: "Effect,LevelUp,90011001,EffectTypeParam1,HdPct"
        const param2Parts = noteData.Param2.split(',').map(p => p.trim());
        
        if (param2Parts.length < 4) {
            return description;
        }
        
        const [fileType, levelType, baseId, fieldKey, formatType] = param2Parts;
        
        // Only handle Effect + LevelUp for now (the standard format)
        if (fileType !== 'Effect' || levelType !== 'LevelUp') {
            return description;
        }
        
        // Calculate the effect ID: baseId + (level * 10)
        const effectId = parseInt(baseId) + (level * 10);
        const effectEntry = discsState.effectValueData[effectId.toString()];
        
        if (!effectEntry) {
            return description;
        }
        
        // Extract the value from the specified field
        let value = effectEntry[fieldKey];
        if (value === undefined) {
            return description;
        }
        
        // Format the value (HdPct means percentage)
        if (formatType === 'HdPct') {
            // Convert to percentage: "0.003" -> "0.3%"
            const numValue = parseFloat(value) * 100;
            // Round to 2 decimal places to avoid floating-point precision issues
            const roundedValue = Math.round(numValue * 100) / 100;
            value = `${roundedValue}%`;
        }
        
        // Replace &Param2& with styled value
        if (description.includes('&Param2&')) {
            const styledValue = `<span class="param-value">${value}</span>`;
            return description.replaceAll('&Param2&', styledValue);
        }
        
        return description;
    }
    
    // Get note icon path
    function getNoteIconPath(noteData) {
        if (!noteData || !noteData.Icon) return '';
        
        const parts = noteData.Icon.split('/');
        const iconName = parts[parts.length - 1];
        return `assets/${iconName}_S.png`;
    }
    
    // Generate notes display
    function generateNotesDisplay() {
        const notesFromDiscs = calculateNotesFromSubDiscs();
        const allNoteTypes = Object.keys(discsState.subNoteSkillData).sort();

        if (allNoteTypes.length === 0) {
            return '<p class="no-notes">음표 데이터를 불러오는 중...</p>';
        }

        // Separate used (required by main discs) and unused notes
        const usedNotes = allNoteTypes.filter(noteId => discsState.requiredNotes.has(noteId));
        const unusedNotes = allNoteTypes.filter(noteId => !discsState.requiredNotes.has(noteId));

        const generateNoteCard = (noteId, isUsed) => {
            const noteData = discsState.subNoteSkillData[noteId];
            if (!noteData) return '';
            
            const fromDiscs = notesFromDiscs[noteId] || 0;
            const acquired = discsState.acquiredNotes[noteId] || 0;
            const totalLevel = fromDiscs + acquired;
            const maxLevel = noteData.Scores ? noteData.Scores.length : 100;

            // Get Korean translation
            const krName = discsState.subNoteSkillKRData[noteData.Name] || noteData.Name || '';
            const krBriefDesc = discsState.subNoteSkillKRData[noteData.BriefDesc] || noteData.BriefDesc || '';
            const krDesc = discsState.subNoteSkillKRData[noteData.Desc] || noteData.Desc || '';

            // Parse description with level-based Param2
            const parsedDesc = parseNoteDescription(krDesc, noteId, totalLevel);

            const iconPath = getNoteIconPath(noteData);

            return `
                <div class="disc-note-card ${isUsed ? 'used-note' : 'unused-note'}">
                    <div class="note-header">
                        ${iconPath ? `<img src="${iconPath}" alt="${krName}" class="note-icon" onerror="this.style.display='none'">` : ''}
                        <div class="note-title">
                            <h4>${krName}</h4>
                            <p class="note-brief">${krBriefDesc}</p>
                        </div>
                    </div>
                    <div class="note-levels">
                        <div class="note-level-row">
                            <span class="note-level-label">보조 레코드:</span>
                            <span class="note-level-value from-discs">${fromDiscs}</span>
                        </div>
                        <div class="note-level-row">
                            <span class="note-level-label">총 레벨:</span>
                            <div class="note-level-control">
                                <button class="note-adjust-btn" 
                                        data-action="disc-adjust-note-level"
                                        data-note-id="${noteId}"
                                        data-delta="-1">−</button>
                                <input type="number"
                                       class="note-level-input total"
                                       value="${totalLevel}"
                                       min="${fromDiscs}"
                                       max="${maxLevel}"
                                       onchange="setTotalNoteLevel('${noteId}', this.value)"
                                       onclick="this.select()">
                                <button class="note-adjust-btn"
                                        data-action="disc-adjust-note-level"
                                        data-note-id="${noteId}"
                                        data-delta="1">+</button>
                            </div>
                        </div>
                        <div class="note-level-row additional">
                            <span class="note-level-label">추가 획득:</span>
                            <span class="note-level-value additional-level">${acquired}</span>
                        </div>
                    </div>
                    ${totalLevel > 0 ? `
                        <div class="note-effect">
                            <div class="note-desc">${parsedDesc}</div>
                        </div>
                    ` : `
                        <div class="note-effect inactive">
                            <div class="note-desc">음표 레벨이 0입니다</div>
                        </div>
                    `}
                </div>
            `;
        };

        // Generate sections
        let html = '';

        if (usedNotes.length > 0) {
            html += '<div class="notes-section-header used">📌 사용 중인 음표</div>';
            html += usedNotes.map(noteId => generateNoteCard(noteId, true)).join('');
        }

        if (unusedNotes.length > 0) {
            html += '<div class="notes-section-header unused">💤 미사용 음표</div>';
            html += unusedNotes.map(noteId => generateNoteCard(noteId, false)).join('');
        }

        return html;
    }
    
    // Render discs tab content
    function renderDiscs() {
        const container = document.getElementById('discs-container');
        if (!container) return;

        // Get saved sidebar state (default: open)
        const sidebarOpen = localStorage.getItem('notesSidebarOpen') !== 'false';

        // Count active notes for badge
        const notesFromDiscs = calculateNotesFromSubDiscs();
        const totalNotes = Object.keys(notesFromDiscs).filter(noteId => notesFromDiscs[noteId] > 0).length;
        const acquiredCount = Object.keys(discsState.acquiredNotes).filter(noteId => discsState.acquiredNotes[noteId] > 0).length;
        const activeNotesCount = Math.max(totalNotes, acquiredCount);
        
        // Calculate disc scores
        const discScore = calculateDiscScore();
        const secondarySkillScore = calculateSecondarySkillsScore();
        const notesScore = calculateNotesScore();

        container.innerHTML = `
            <div class="discs-layout">
                <div class="discs-main-content">
                    <!-- Disc Score Display -->
                    <div class="disc-score-banner">
                        <div class="disc-score-main">
                            <span class="disc-score-label">레코드 총 점수:</span>
                            <span class="disc-score-value">${discScore}</span>
                        </div>
                        <div class="disc-score-breakdown">
                            <span class="disc-score-detail">협주: ${secondarySkillScore}</span>
                            <span class="disc-score-separator">|</span>
                            <span class="disc-score-detail">음표: ${notesScore}</span>
                        </div>
                    </div>
                    
                    <!-- Main Disc Slots -->
                    <div class="disc-section">
                        <h3 class="section-title">
                            <span class="section-icon">🎵</span>
                            메인 레코드
                        </h3>
                        <div class="disc-slots-grid">
                            ${generateDiscSlot('main1', 1, true)}
                            ${generateDiscSlot('main2', 2, true)}
                            ${generateDiscSlot('main3', 3, true)}
                        </div>
                    </div>

                    <!-- 보조 Disc Slots -->
                    <div class="disc-section">
                        <h3 class="section-title">
                            <span class="section-icon">🎶</span>
                            보조 레코드
                        </h3>
                        <div class="disc-slots-grid">
                            ${generateDiscSlot('sub1', 1, false)}
                            ${generateDiscSlot('sub2', 2, false)}
                            ${generateDiscSlot('sub3', 3, false)}
                        </div>
                    </div>
                </div>

                <!-- Sidebar Overlay (click to close) -->
                <div class="notes-sidebar-overlay ${sidebarOpen ? 'active' : ''}"
                     id="notes-sidebar-overlay"
                     data-action="disc-toggle-notes-sidebar"></div>

                <!-- Collapsible Notes Sidebar -->
                <div class="notes-sidebar ${sidebarOpen ? 'open' : ''}" id="notes-sidebar">
                    <div class="notes-sidebar-content">
                        <div class="notes-sidebar-header">
                            <h3 class="notes-sidebar-title">
                                <span class="section-icon">🎼</span>
                                음표 레벨
                            </h3>
                            <button class="notes-sidebar-close" 
                                    data-action="disc-close-notes-sidebar" 
                                    title="닫기">
                                <span>✕</span>
                            </button>
                        </div>
                        <div class="disc-notes-info">
                            <p class="notes-explanation">보조 레코드가 자동으로 음표를 제공합니다. 추가 획득한 음표를 설정하세요.</p>
                        </div>
                        <div class="disc-notes-grid" id="disc-notes-grid">
                            ${generateNotesDisplay()}
                        </div>
                    </div>
                </div>

                <!-- Notes Sidebar Toggle Button -->
                <button class="notes-sidebar-toggle ${sidebarOpen ? 'hidden' : ''}"
                        id="notes-sidebar-toggle"
                        data-action="disc-toggle-notes-sidebar"
                        title="음표 레벨 보기">
                    <span class="toggle-icon">🎼</span>
                    <span class="toggle-text">음표</span>
                    ${activeNotesCount > 0 ? `<span class="toggle-badge">${activeNotesCount}</span>` : ''}
                </button>
            </div>
            
            <!-- Disc Selector Modal -->
            <div class="modal" id="disc-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>레코드 선택 - <span id="modal-slot-type"></span> <span id="modal-slot-number"></span></h2>
                        <button class="close-btn" data-action="disc-close-selector">&times;</button>
                    </div>
                    <div class="disc-selector-grid" id="disc-selector-grid"></div>
                </div>
            </div>
            
            <!-- Large Image Viewer Modal -->
            <div class="modal" id="disc-image-viewer">
                <div class="image-viewer-content">
                    <button class="close-btn" data-action="disc-close-image-viewer">&times;</button>
                    <img id="viewer-image" src="" alt="Disc Image">
                    <div class="viewer-title" id="viewer-title"></div>
                </div>
            </div>
        `;
    }
    
    // Generate notes display for a sub disc
    function generateDiscNotesDisplay(disc, phase) {
        if (!disc || !disc.SubNoteSkillGroupId) return '';

        // Calculate the lookup ID: GroupId * 100 + Phase
        const lookupId = String(disc.SubNoteSkillGroupId * 100 + phase);
        const phaseData = discsState.subNoteSkillPromoteData[lookupId];

        if (!phaseData || !phaseData.SubNoteSkills) return '';

        try {
            const noteContributions = JSON.parse(phaseData.SubNoteSkills);
            const noteItems = Object.entries(noteContributions).map(([noteId, count]) => {
                const noteData = discsState.subNoteSkillData[noteId];
                if (!noteData) return '';

                const noteIconPath = getNoteIconPath(noteData);
                const noteName = discsState.subNoteSkillKRData[noteData.Name] || noteData.Name || '';

                return `
                    <div class="disc-card-note-item">
                        ${noteIconPath ? `<img src="${noteIconPath}" alt="${noteName}" class="disc-card-note-icon" onerror="this.style.display='none'">` : ''}
                        <div class="disc-card-note-info">
                            <div class="disc-card-note-name">${noteName}</div>
                            <div class="disc-card-note-count">+${count}</div>
                        </div>
                    </div>
                `;
            }).filter(i => i).join('');

            if (noteItems) {
                return `
                    <div class="disc-card-notes-section">
                        <div class="disc-card-notes-header">🎵 제공 음표</div>
                        <div class="disc-card-notes-grid">
                            ${noteItems}
                        </div>
                    </div>
                `;
            }
        } catch (e) {
            // Silent fail
        }

        return '';
    }

    // Generate a single disc slot card
    function generateDiscSlot(slotId, slotNumber, isMain) {
        const selectedDisc = discsState.selectedDiscs[slotId];
        const limitBreak = discsState.discLimitBreaks[slotId];
        const subDiscLevel = discsState.subDiscLevels[slotId] || 0;
        
        // Phase to label mapping
        const phaseLabelMap = ['1+', '10+', '20+', '30+', '40+', '50+', '60+', '70+', '80+'];
        const phaseLabel = phaseLabelMap[subDiscLevel] || '1+';
        
        if (selectedDisc) {
            const discName = discsState.discNames[selectedDisc.Id] || '알 수 없는 레코드';
            const iconPath = getDiscIconPath(selectedDisc);
            const largePath = getDiscLargeImagePath(selectedDisc.DiscBg);
            const elementInfo = getDiscElementInfo(selectedDisc);
            const rarityInfo = getDiscRarityInfo(selectedDisc);
            
            let skillsHtml = '';
            let noteRequirementsHtml = '';
            if (isMain) {
                const mainSkill = getMainSkillData(selectedDisc, limitBreak);
                const secondarySkills = getSecondarySkillsData(selectedDisc);
                skillsHtml = generateSkillsDisplay(mainSkill, secondarySkills, limitBreak);
                noteRequirementsHtml = generateNoteRequirementsDisplay(selectedDisc);
            }

            // Notes display for sub discs
            let notesHtml = '';
            if (!isMain) {
                notesHtml = generateDiscNotesDisplay(selectedDisc, subDiscLevel);
            }
            
            // Level control for sub discs
            let levelControlHtml = '';
            if (!isMain) {
                levelControlHtml = `
                    <div class="limit-break-control">
                        <label class="limit-break-label">레벨</label>
                        <div class="limit-break-selector">
                            <button class="lb-btn" 
                                    data-action="disc-adjust-sub-level"
                                    data-slot-id="${slotId}"
                                    data-delta="-1"
                                    ${subDiscLevel === 0 ? 'disabled' : ''}>-</button>
                            <span class="lb-value">${phaseLabel}</span>
                            <button class="lb-btn"
                                    data-action="disc-adjust-sub-level"
                                    data-slot-id="${slotId}"
                                    data-delta="1"
                                    ${subDiscLevel === 8 ? 'disabled' : ''}>+</button>
                        </div>
                    </div>
                `;
            } else {
                // Limit break control for main discs with visual indicator
                // Map rarity stars to exceed icon number: SSR(5)→5, SR(4)→4, R(3)→3
                const exceedIconNumber = rarityInfo.stars;
                const exceedIconPath = `assets/rare_outfit_exceed_s_${exceedIconNumber}.png`;
                
                // Generate exceed icons based on limitBreak value
                let exceedIconsHtml = '';
                for (let i = 0; i < limitBreak; i++) {
                    exceedIconsHtml += `<img src="${exceedIconPath}" alt="돌파" class="exceed-icon" onerror="this.style.display='none'">`;
                }
                
                levelControlHtml = `
                    <div class="limit-break-control">
                        <label class="limit-break-label">돌파</label>
                        <div class="limit-break-selector">
                            <button class="lb-btn"
                                    data-action="disc-adjust-limit-break"
                                    data-slot-id="${slotId}"
                                    data-delta="-1"
                                    ${limitBreak === 1 ? 'disabled' : ''}>-</button>
                            <span class="lb-value">${limitBreak}</span>
                            <button class="lb-btn"
                                    data-action="disc-adjust-limit-break"
                                    data-slot-id="${slotId}"
                                    data-delta="1"
                                    ${limitBreak === 6 ? 'disabled' : ''}>+</button>
                        </div>
                        <div class="exceed-icons-display">
                            ${exceedIconsHtml}
                        </div>
                    </div>
                `;
            }
            
            return `
                <div class="disc-slot-card filled ${isMain ? 'main-disc' : 'sub-disc'}">
                    <div class="disc-slot-header">
                        <span class="disc-slot-number">${slotNumber}</span>
                        <div class="disc-slot-name-group">
                            <div class="disc-name-with-element">
                                <span class="disc-slot-name">${discName}</span>
                                ${elementInfo.icon ? `<img src="${elementInfo.icon}" alt="${elementInfo.name}" class="disc-element-icon" title="${elementInfo.name}" onerror="this.style.display='none'">` : `<span class="disc-element-name">${elementInfo.name}</span>`}
                            </div>
                            <span class="disc-slot-id">ID: ${selectedDisc.Id}</span>
                        </div>
                    </div>
                    <div class="disc-slot-preview">
                        <div class="disc-icon-container ${rarityInfo.borderClass}" 
                             data-action="disc-open-image-viewer"
                             data-image-path="${largePath}"
                             data-disc-name="${discName}"
                             title="클릭하여 크게 보기">
                            <img src="${iconPath}" alt="${discName}" class="disc-icon" 
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="disc-placeholder" style="display: none;">
                                <span class="disc-placeholder-icon">💿</span>
                            </div>
                            <div class="disc-icon-overlay">
                                <span class="zoom-icon">🔍</span>
                            </div>
                        </div>
                        <button class="change-disc-btn" 
                                data-action="disc-open-selector"
                                data-slot-id="${slotId}">
                            레코드 변경
                        </button>
                    </div>

                    ${levelControlHtml}

                    ${notesHtml}

                    ${noteRequirementsHtml}

                    ${skillsHtml}
                </div>
            `;
        } else {
            return `
                <div class="disc-slot-card ${isMain ? 'main-disc' : 'sub-disc'}" 
                     data-action="disc-open-selector"
                     data-slot-id="${slotId}">
                    <div class="disc-slot-header">
                        <span class="disc-slot-number">${slotNumber}</span>
                        <span class="disc-slot-name">${isMain ? '메인' : '보조'} 레코드 ${slotNumber}</span>
                    </div>
                    <div class="disc-slot-preview">
                        <div class="disc-placeholder">
                            <span class="disc-placeholder-icon">💿</span>
                            <p>레코드 선택</p>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    
    // Extract icon filename from path like "Icon/DiscSkill/DiscSkill_1"
    function getSkillIconPath(iconPath) {
        if (!iconPath) return null;
        const parts = iconPath.split('/');
        const filename = parts[parts.length - 1];
        return `assets/${filename}.png`;
    }
    
    // Generate skills display HTML
    function generateSkillsDisplay(mainSkill, secondarySkills, limitBreak) {
        if (!mainSkill && (!secondarySkills || secondarySkills.length === 0)) return '';

        let html = '<div class="disc-skills-section">';

        if (mainSkill) {
            const translation = getSkillTranslation(mainSkill, true);
            const iconBgPath = getSkillIconPath(mainSkill.IconBg);
            const iconPath = getSkillIconPath(mainSkill.Icon);
            
            html += `
                <div class="disc-skill-item main-skill">
                    <div class="skill-icon-container">
                        ${iconBgPath ? `<img src="${iconBgPath}" alt="skill bg" class="skill-icon-bg" onerror="this.style.display='none'">` : ''}
                        ${iconPath ? `<img src="${iconPath}" alt="${translation.name}" class="skill-icon" onerror="this.style.display='none'">` : ''}
                    </div>
                    <div class="skill-content">
                        <div class="skill-header">
                            <span class="skill-badge main">멜로디 스킬</span>
                            <span class="skill-level-badge">Lv.${limitBreak}</span>
                            <span class="skill-name">${translation.name}</span>
                        </div>
                        <div class="skill-desc">${translation.desc}</div>
                    </div>
                </div>
            `;
        }

        // Display all secondary skills (including inactive ones)
        if (secondarySkills && secondarySkills.length > 0) {
            secondarySkills.forEach((skillData, index) => {
                const secondarySkill = skillData.skill;
                const isActive = skillData.isActive;
                const skillLevel = skillData.Level || 0;
                const badgeText = '협주 스킬';

                if (isActive && secondarySkill) {
                    // Active skill with requirements met
                    const translation = getSkillTranslation(secondarySkill, false);
                    const iconBgPath = getSkillIconPath(secondarySkill.IconBg);
                    const iconPath = getSkillIconPath(secondarySkill.Icon);
                    
                    html += `
                        <div class="disc-skill-item secondary-skill">
                            <div class="skill-icon-container">
                                ${iconBgPath ? `<img src="${iconBgPath}" alt="skill bg" class="skill-icon-bg" onerror="this.style.display='none'">` : ''}
                                ${iconPath ? `<img src="${iconPath}" alt="${translation.name}" class="skill-icon" onerror="this.style.display='none'">` : ''}
                            </div>
                            <div class="skill-content">
                                <div class="skill-header">
                                    <span class="skill-badge secondary">${badgeText}</span>
                                    <span class="skill-level-badge secondary-level">Lv.${skillLevel}</span>
                                    <span class="skill-name">${translation.name}</span>
                                </div>
                                <div class="skill-desc">${translation.desc}</div>
                            </div>
                        </div>
                    `;
                } else {
                    // Inactive skill (requirements not met)
                    html += `
                        <div class="disc-skill-item secondary-skill inactive">
                            <div class="skill-content">
                                <div class="skill-header">
                                    <span class="skill-badge secondary inactive">협주 스킬</span>
                                    <span class="skill-level-badge secondary-level inactive">Lv.0</span>
                                    <span class="skill-name">요구 조건 미충족</span>
                                </div>
                                <div class="skill-desc">필요한 음표 레벨을 충족하지 못했습니다.</div>
                            </div>
                        </div>
                    `;
                }
            });
        }

        html += '</div>';
        return html;
    }

    // Get unique note requirements from all secondary skills of a disc
    function getSecondarySkillNoteRequirements(disc) {
        if (!disc) return [];

        const uniqueNotes = new Set();

        // Check both secondary skill groups
        [disc.SecondarySkillGroupId1, disc.SecondarySkillGroupId2].forEach(groupId => {
            if (!groupId) return;

            // Check all levels (01-09) for this group
            for (let level = 1; level <= 9; level++) {
                const skillId = String(groupId) + String(level).padStart(2, '0');
                const skill = discsState.secondarySkillData[skillId];

                if (skill && skill.NeedSubNoteSkills) {
                    try {
                        const requirements = JSON.parse(skill.NeedSubNoteSkills);
                        Object.keys(requirements).forEach(noteId => uniqueNotes.add(noteId));
                    } catch (e) {
                        // Silent fail
                    }
                }
            }
        });

        return Array.from(uniqueNotes);
    }

    // Update required notes based on all selected main discs
    function updateRequiredNotes() {
        const requiredNotes = new Set();

        // Check all main disc slots
        ['main1', 'main2', 'main3'].forEach(slotId => {
            const disc = discsState.selectedDiscs[slotId];
            if (disc) {
                const notes = getSecondarySkillNoteRequirements(disc);
                notes.forEach(noteId => requiredNotes.add(noteId));
            }
    });

    discsState.requiredNotes = requiredNotes;
}    // Calculate how many required notes a sub disc provides
    function calculateNoteOverlap(disc) {
        if (!disc || !disc.SubNoteSkillGroupId) return 0;

        const lookupId = String(disc.SubNoteSkillGroupId * 100); // Phase 0
        const phaseData = discsState.subNoteSkillPromoteData[lookupId];

        if (!phaseData || !phaseData.SubNoteSkills) return 0;

        try {
            const noteContributions = JSON.parse(phaseData.SubNoteSkills);
            const providedNotes = Object.keys(noteContributions);

            // Count how many of the provided notes are required
            return providedNotes.filter(noteId => discsState.requiredNotes.has(noteId)).length;
        } catch (e) {
            return 0;
        }
    }

    // Generate note requirements display for main discs
    function generateNoteRequirementsDisplay(disc) {
        const requiredNotes = getSecondarySkillNoteRequirements(disc);

        if (requiredNotes.length === 0) return '';

        const noteItems = requiredNotes.map(noteId => {
            const noteData = discsState.subNoteSkillData[noteId];
            if (!noteData) return '';

            const noteIconPath = getNoteIconPath(noteData);
            const noteName = discsState.subNoteSkillKRData[noteData.Name] || noteData.Name || '';

            return `
                <div class="required-note-item">
                    ${noteIconPath ? `<img src="${noteIconPath}" alt="${noteName}" class="required-note-icon" onerror="this.style.display='none'">` : ''}
                    <span class="required-note-name">${noteName}</span>
                </div>
            `;
        }).filter(item => item).join('');

        if (!noteItems) return '';

        return `
            <div class="note-requirements-section">
                <div class="note-requirements-header">🎵 필요 음표</div>
                <div class="note-requirements-grid">
                    ${noteItems}
                </div>
            </div>
        `;
    }
    
    // Open disc selector modal
    function openDiscSelector(slotId) {
        discsState.currentSlot = slotId;

        const modal = document.getElementById('disc-modal');
        const slotType = document.getElementById('modal-slot-type');
        const slotNumber = document.getElementById('modal-slot-number');
        const grid = document.getElementById('disc-selector-grid');

        if (!modal || !slotType || !slotNumber || !grid) return;

        // Determine slot type and number
        const isMain = slotId.startsWith('main');
        const num = slotId.replace(/\D/g, '');

        slotType.textContent = isMain ? '메인' : '보조';
        slotNumber.textContent = num;

        // Get all currently selected disc IDs (excluding the current slot being edited)
        const selectedDiscIds = new Set();
        Object.keys(discsState.selectedDiscs).forEach(slot => {
            if (slot !== slotId && discsState.selectedDiscs[slot]) {
                selectedDiscIds.add(discsState.selectedDiscs[slot].Id);
            }
        });

        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();

        // Sort discs
        let sortedDiscs;
        if (isMain) {
            // Main discs: sort by ID in descending order (high to low)
            sortedDiscs = [...discsState.allDiscs].sort((a, b) => b.Id - a.Id);
        } else {
            // Sub discs: sort by required note matches first, then by ID
            sortedDiscs = [...discsState.allDiscs].sort((a, b) => {
                const overlapA = calculateNoteOverlap(a);
                const overlapB = calculateNoteOverlap(b);
                
                // First, sort by number of required note matches (descending)
                if (overlapB !== overlapA) {
                    return overlapB - overlapA;
                }
                
                // Then, sort by ID (descending)
                return b.Id - a.Id;
            });
        }

        sortedDiscs.forEach(disc => {
            const discName = discsState.discNames[disc.Id] || '알 수 없는 레코드';
            const iconPath = getDiscIconPath(disc);
            const isSelected = discsState.selectedDiscs[slotId]?.Id === disc.Id;
            const isDisabled = selectedDiscIds.has(disc.Id); // Check if already selected elsewhere
            const noteOverlap = !isMain ? calculateNoteOverlap(disc) : 0;
            const hasRequiredNotes = noteOverlap > 0;
            const elementInfo = getDiscElementInfo(disc);
            const rarityInfo = getDiscRarityInfo(disc);
            
            // Get notes info for 보조 discs at Phase 0
            let notesInfo = '';
            if (!isMain && disc.SubNoteSkillGroupId) {
                // Calculate the lookup ID: GroupId * 100 + Phase (0 for initial display)
                const lookupId = String(disc.SubNoteSkillGroupId * 100);
                const phaseData = discsState.subNoteSkillPromoteData[lookupId];

                if (phaseData && phaseData.SubNoteSkills) {
                    try {
                        const noteContributions = JSON.parse(phaseData.SubNoteSkills);
                        const noteIcons = Object.keys(noteContributions).slice(0, 5).map(noteId => {
                            const noteData = discsState.subNoteSkillData[noteId];
                            if (!noteData) return '';
                            const noteIconPath = getNoteIconPath(noteData);
                            const noteName = discsState.subNoteSkillKRData[noteData.Name] || noteData.Name || '';
                            // Add 'required-match' class if this note is required by main discs
                            const isRequired = discsState.requiredNotes.has(noteId);
                            return noteIconPath ? `<img src="${noteIconPath}" alt="${noteName}" class="disc-note-preview-icon ${isRequired ? 'required-match' : ''}" title="${noteName} +${noteContributions[noteId]}" onerror="this.style.display='none'">` : '';
                        }).filter(i => i).join('');

                        if (noteIcons) {
                            notesInfo = `<div class="disc-option-notes">${noteIcons}</div>`;
                        }
                    } catch (e) {
                        // Silent fail
                    }
                }
            }
            
            const discOption = document.createElement('div');
            discOption.className = `disc-option ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''} ${hasRequiredNotes ? 'has-required-notes' : ''}`;
            if (!isDisabled) {
                discOption.dataset.action = 'disc-select-option';
                discOption.dataset.discId = disc.Id;
            }
            discOption.dataset.noteOverlap = noteOverlap;
            
            discOption.innerHTML = `
                <div class="disc-option-image ${rarityInfo.borderClass}">
                    <img src="${iconPath}" alt="${discName}"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="disc-placeholder" style="display: none;">
                        <span class="disc-placeholder-icon">💿</span>
                    </div>
                    ${isDisabled ? '<div class="disc-disabled-overlay"><span class="disc-disabled-text">이미 선택됨</span></div>' : ''}
                </div>
                <div class="disc-option-info">
                    <div class="disc-option-name">${discName}</div>
                    <div class="disc-option-details">
                        <span class="disc-option-id">ID: ${disc.Id}</span>
                        ${elementInfo.icon ? `<img src="${elementInfo.icon}" alt="${elementInfo.name}" class="disc-option-element-icon" title="${elementInfo.name}" onerror="this.style.display='none'">` : `<span class="disc-option-element">${elementInfo.name}</span>`}
                    </div>
                    ${notesInfo}
                </div>
            `;
            
            fragment.appendChild(discOption);
        });
        
        // Clear and append all at once
        grid.innerHTML = '';
        grid.appendChild(fragment);
        modal.style.display = 'flex';
        
        // Add click outside to close (use addEventListener to prevent memory leak)
        const handleDiscModalClick = (e) => {
            if (e.target === modal) {
                closeDiscSelector();
            }
        };
        
        // Store handler reference for cleanup
        modal._discModalClickHandler = handleDiscModalClick;
        
        setTimeout(() => {
            modal.addEventListener('click', handleDiscModalClick);
        }, 0);
    }
    
    // Select a disc from the modal
    function selectDiscOption(discId) {
        const currentSlot = discsState.currentSlot; // Save before closing modal
        if (!currentSlot) return;

        const disc = discsState.allDiscs.find(d => d.Id == discId);
        if (!disc) return;

        discsState.selectedDiscs[currentSlot] = disc;

        // Update required notes if a main disc was selected
        if (currentSlot.startsWith('main')) {
            updateRequiredNotes();
        }

        closeDiscSelector();
        renderDiscs();

        const discName = discsState.discNames[disc.Id] || '레코드';
        const isMain = currentSlot.startsWith('main');
        const num = currentSlot.replace(/\D/g, '');
        const slotType = isMain ? '메인' : '보조';
        showToast(`${slotType} 슬롯 ${num}에 ${discName}을(를) 선택했습니다.`, 'success');
    }
    
    // Close disc selector modal
    function closeDiscSelector() {
        const modal = document.getElementById('disc-modal');
        if (modal) {
            modal.style.display = 'none';
            
            // Properly remove event listener to prevent memory leak
            if (modal._discModalClickHandler) {
                modal.removeEventListener('click', modal._discModalClickHandler);
                modal._discModalClickHandler = null;
            }
        }
        discsState.currentSlot = null;
    }
    
    // Open large image viewer
    function openImageViewer(imagePath, title) {
        const modal = document.getElementById('disc-image-viewer');
        const image = document.getElementById('viewer-image');
        const titleEl = document.getElementById('viewer-title');
        
        if (!modal || !image || !titleEl) return;
        
        image.src = imagePath;
        titleEl.textContent = title;
        modal.style.display = 'flex';
        
        // Close on background click (use addEventListener to prevent memory leak)
        const handleImageViewerClick = (e) => {
            if (e.target === modal) {
                closeImageViewer();
            }
        };
        
        // Close on ESC key
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                closeImageViewer();
            }
        };
        
        // Store handlers for cleanup
        modal._imageViewerClickHandler = handleImageViewerClick;
        modal._imageViewerEscHandler = handleEscKey;
        
        modal.addEventListener('click', handleImageViewerClick);
        document.addEventListener('keydown', handleEscKey);
    }
    
    // Close image viewer
    function closeImageViewer() {
        const modal = document.getElementById('disc-image-viewer');
        if (modal) {
            modal.style.display = 'none';
            
            // Properly remove event listeners to prevent memory leak
            if (modal._imageViewerClickHandler) {
                modal.removeEventListener('click', modal._imageViewerClickHandler);
                modal._imageViewerClickHandler = null;
            }
            
            if (modal._imageViewerEscHandler) {
                document.removeEventListener('keydown', modal._imageViewerEscHandler);
                modal._imageViewerEscHandler = null;
            }
        }
    }
    
    // Adjust limit break level
    function adjustLimitBreak(slotId, delta) {
        const currentLB = discsState.discLimitBreaks[slotId];
        const newLB = Math.max(1, Math.min(6, currentLB + delta));
        
        if (newLB !== currentLB) {
            discsState.discLimitBreaks[slotId] = newLB;
            renderDiscs();
        }
    }
    
    // Adjust sub disc level (Phase 0-8)
    function adjustSubDiscLevel(slotId, delta) {
        const currentLevel = discsState.subDiscLevels[slotId] || 0;
        const newLevel = Math.max(0, Math.min(8, currentLevel + delta));
        
        if (newLevel !== currentLevel) {
            discsState.subDiscLevels[slotId] = newLevel;
            renderDiscs();
        }
    }
    
    // Adjust acquired note level
    // Adjust total note level (total = fromDiscs + acquired)
    function adjustTotalNoteLevel(noteId, delta) {
        const notesFromDiscs = calculateNotesFromSubDiscs();
        const fromDiscs = notesFromDiscs[noteId] || 0;
        const currentAcquired = discsState.acquiredNotes[noteId] || 0;
        const currentTotal = fromDiscs + currentAcquired;
        
        const noteData = discsState.subNoteSkillData[noteId];
        const maxLevel = noteData && noteData.Scores ? noteData.Scores.length : 100;
        
        // Calculate new total level (can't be less than fromDiscs)
        const newTotal = Math.max(fromDiscs, Math.min(maxLevel, currentTotal + delta));
        const newAcquired = newTotal - fromDiscs;
        
        if (newAcquired !== currentAcquired) {
            discsState.acquiredNotes[noteId] = newAcquired;
            renderDiscs();
        }
    }
    
    // Set total note level directly (from input)
    function setTotalNoteLevel(noteId, value) {
        const notesFromDiscs = calculateNotesFromSubDiscs();
        const fromDiscs = notesFromDiscs[noteId] || 0;
        
        const noteData = discsState.subNoteSkillData[noteId];
        const maxLevel = noteData && noteData.Scores ? noteData.Scores.length : 100;
        
        const numValue = parseInt(value, 10);
        const newTotal = isNaN(numValue) ? fromDiscs : Math.max(fromDiscs, Math.min(maxLevel, numValue));
        const newAcquired = newTotal - fromDiscs;
        
        discsState.acquiredNotes[noteId] = newAcquired;
        renderDiscs();
    }
    
    // Legacy functions kept for compatibility (in case they're called elsewhere)
    function adjustAcquiredNote(noteId, delta) {
        adjustTotalNoteLevel(noteId, delta);
    }
    
    function setAcquiredNote(noteId, value) {
        setTotalNoteLevel(noteId, value);
    }
    
    // Toggle notes sidebar
    function toggleNotesSidebar() {
        const sidebar = document.getElementById('notes-sidebar');
        const overlay = document.getElementById('notes-sidebar-overlay');
        const toggleBtn = document.getElementById('notes-sidebar-toggle');

        if (!sidebar || !toggleBtn || !overlay) return;

        const isOpen = sidebar.classList.contains('open');

        if (isOpen) {
            // Close sidebar
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            toggleBtn.classList.remove('hidden');
            localStorage.setItem('notesSidebarOpen', 'false');
        } else {
            // Open sidebar
            sidebar.classList.add('open');
            overlay.classList.add('active');
            toggleBtn.classList.add('hidden');
            localStorage.setItem('notesSidebarOpen', 'true');
        }
    }

    // ============================================================================
    // EVENT DELEGATION SYSTEM
    // ============================================================================
    
    /**
     * Centralized event delegation for discs module
     */
    let discsEventDelegationInitialized = false;
    
    function setupDiscsEventDelegation() {
        // Prevent multiple initialization
        if (discsEventDelegationInitialized) return;
        discsEventDelegationInitialized = true;
        
        // Delegate clicks on document for all disc- actions
        document.addEventListener('click', function(e) {
            const target = e.target;
            const button = target.closest('[data-action]');
            
            if (!button) return;
            
            const action = button.dataset.action;
            // Handle all actions that start with 'disc-'
            if (action && action.startsWith('disc-')) {
                handleDiscsAction(button, action, e);
            }
        });
    }
    
    /**
     * Handle delegated disc actions
     */
    function handleDiscsAction(element, action, event) {
        switch(action) {
            // Disc slot actions
            case 'disc-open-selector':
                openDiscSelector(element.dataset.slotId);
                break;
                
            case 'disc-select-option':
                selectDiscOption(element.dataset.discId);
                break;
                
            case 'disc-close-selector':
                closeDiscSelector();
                break;
                
            // Image viewer
            case 'disc-open-image-viewer':
                event.stopPropagation();
                openImageViewer(element.dataset.imagePath, element.dataset.discName);
                break;
                
            case 'disc-close-image-viewer':
                closeImageViewer();
                break;
                
            // Limit break adjustment
            case 'disc-adjust-limit-break':
                {
                    const slotId = element.dataset.slotId;
                    const delta = parseInt(element.dataset.delta);
                    adjustLimitBreak(slotId, delta);
                }
                break;
                
            // Sub disc level adjustment
            case 'disc-adjust-sub-level':
                {
                    const slotId = element.dataset.slotId;
                    const delta = parseInt(element.dataset.delta);
                    adjustSubDiscLevel(slotId, delta);
                }
                break;
                
            // Notes sidebar
            case 'disc-toggle-notes-sidebar':
                toggleNotesSidebar();
                break;
                
            case 'disc-close-notes-sidebar':
                toggleNotesSidebar();
                break;
                
            // Note level adjustment
            case 'disc-adjust-note-level':
                {
                    const noteId = element.dataset.noteId;
                    const delta = parseInt(element.dataset.delta);
                    adjustTotalNoteLevel(noteId, delta);
                }
                break;
                
            default:
                break;
        }
    }
    
    // Setup event delegation when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupDiscsEventDelegation);
    } else {
        setupDiscsEventDelegation();
    }
    
    // Make functions globally available
    window.loadDiscData = loadDiscData;
    window.renderDiscs = renderDiscs;
    window.openDiscSelector = openDiscSelector;
    window.selectDiscOption = selectDiscOption;
    window.closeDiscSelector = closeDiscSelector;
    window.openImageViewer = openImageViewer;
    window.closeImageViewer = closeImageViewer;
    window.adjustLimitBreak = adjustLimitBreak;
    window.adjustSubDiscLevel = adjustSubDiscLevel;
    window.adjustAcquiredNote = adjustAcquiredNote;
    window.setAcquiredNote = setAcquiredNote;
    window.adjustTotalNoteLevel = adjustTotalNoteLevel;
    window.setTotalNoteLevel = setTotalNoteLevel;
    window.toggleNotesSidebar = toggleNotesSidebar;
    window.calculateNotesFromSubDiscs = calculateNotesFromSubDiscs;
    window.calculateDiscScore = calculateDiscScore;
    window.discsState = discsState;
    
    // Auto-load and render on page load if discs tab exists
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (document.getElementById('discs-container')) {
                loadDiscData();
            }
        });
    } else {
        if (document.getElementById('discs-container')) {
            loadDiscData();
        }
    }
})();
