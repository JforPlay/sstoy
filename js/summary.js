// Summary Tab Module
// Displays party overview and build statistics

(function() {
    'use strict';
    
    // Build rank data
    let buildRankData = null;
    
    // Load build rank data
    async function loadBuildRankData() {
        if (buildRankData) return buildRankData;
        
        try {
            const response = await fetch('data/StarTowerBuildRank.json');
            buildRankData = await response.json();
            return buildRankData;
        } catch (error) {
            console.error('Failed to load build rank data:', error);
            return null;
        }
    }
    
    // Calculate build level based on total score
    function calculateBuildLevel(totalScore) {
        if (!buildRankData) return { level: 1, minGrade: 0 };
        
        let highestLevel = 1;
        let highestMinGrade = 0;
        
        // Find the highest level that the score qualifies for
        Object.values(buildRankData).forEach(rank => {
            const minGrade = rank.MinGrade || 0;
            if (totalScore >= minGrade && rank.Level > highestLevel) {
                highestLevel = rank.Level;
                highestMinGrade = minGrade;
            }
        });
        
        return { level: highestLevel, minGrade: highestMinGrade };
    }
    
    // Render summary tab content
    async function renderSummary() {
        const container = document.getElementById('summary-container');
        if (!container) return;
        
        // Load build rank data
        await loadBuildRankData();
        
        const htmlContent = `
            <div class="summary-layout">
                <!-- Build Info Section (Title and Actions) -->
                <div class="build-info-section">
                    <div class="build-info-header">
                        <div class="build-title-wrapper">
                            <label class="build-title-label">빌드 이름</label>
                            <input 
                                type="text" 
                                id="build-title-input" 
                                class="build-title-input" 
                                placeholder="빌드 이름 입력..."
                                oninput="handleBuildTitleChange(event)"
                                value="${window.buildState?.buildTitle || '새로운 빌드'}"
                            />
                        </div>
                        
                        <div class="save-load-actions">
                            <button class="save-btn" data-action="saveload-save" id="save-btn">
                                <span class="btn-icon">💾</span>
                                <span class="btn-text">저장</span>
                            </button>
                            <button class="load-btn-main" data-action="saveload-load">
                                <span class="btn-icon">📂</span>
                                <span class="btn-text">불러오기</span>
                            </button>
                            <button class="share-btn" data-action="saveload-share" id="share-btn">
                                <span class="btn-icon">🔗</span>
                                <span class="btn-text">URL 공유</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="summary-header">
                    <h2>빌드 요약</h2>
                </div>

                <!-- Party Overview Cards -->
                <div class="summary-section">
                    <h3 class="summary-section-title">👥 캐릭터</h3>
                    <div class="summary-cards-grid">
                        ${generateSummaryCard('master', '👑 메인', 'master-badge')}
                        ${generateSummaryCard('assist1', '♟️ 지원 1', 'assist-badge')}
                        ${generateSummaryCard('assist2', '♟️ 지원 2', 'assist-badge')}
                    </div>
                </div>

                <!-- Notes Section -->
                <div class="summary-section">
                    <h3 class="summary-section-title">🎼 음표</h3>
                    ${generateNotesSummary()}
                </div>

                <!-- Discs Section -->
                <div class="summary-section">
                    <h3 class="summary-section-title">💿 레코드</h3>
                    ${generateAllDiscsSection()}
                </div>

                <!-- Build Stats Summary -->
                <div class="build-stats-panel">
                    <h3>파티 통계</h3>
                    <div class="build-stats-grid" id="build-stats-grid">
                        ${generateBuildStats()}
                    </div>
                </div>

                <!-- Quick Notes -->
                <div class="build-notes-panel">
                    <h3>빌드 메모 <span class="memo-hint">(로컬 저장 시에만 포함)</span></h3>
                    <textarea 
                        class="build-notes-textarea" 
                        id="build-notes"
                        placeholder="빌드에 대한 메모를 작성하세요...&#10;예: 특정 보스 전용, PvP 최적화 등&#10;&#10;💡 이 메모는 로컬 저장에만 포함되며 URL 공유 시에는 제외됩니다."
                        oninput="handleBuildMemoChange(event)"
                    >
                    ></textarea>
                </div>
            </div>
        `;
        
        container.innerHTML = htmlContent;
        
        // Load saved notes
        loadBuildNotes();
    }
    
    // Generate summary card for each position
    function generateSummaryCard(position, title, badgeClass) {
        const character = window.state?.party?.[position];
        
        if (!character) {
            return `
                <div class="summary-card ${position === 'master' ? 'master-summary' : 'assist-summary'}">
                    <div class="summary-card-header">
                        <div class="summary-card-badge ${badgeClass}">${title}</div>
                        <h3>캐릭터 미선택</h3>
                    </div>
                    <div class="summary-card-body">
                        <div class="summary-character-preview">
                            <div class="summary-empty-state">
                                <p>캐릭터를 선택해주세요</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        const charId = character.id;
        const charName = character.name;
        const charData = character.data;
        
        return `
            <div class="summary-card ${position === 'master' ? 'master-summary' : 'assist-summary'}">
                <div class="summary-card-header">
                    <div class="summary-card-badge ${badgeClass}">${title}</div>
                    <h3>${charName}</h3>
                </div>
                <div class="summary-card-body">
                    <div class="summary-character-preview">
                        <div class="summary-character-info">
                            <div class="summary-char-basic">
                                <img src="assets/avg1_${charId}_002.png" 
                                     alt="${charName}" 
                                     class="summary-char-image"
                                     onerror="this.style.display='none'">
                                <div class="summary-char-name-section">
                                    <div class="summary-char-name">${charName}</div>
                                    <div class="summary-char-id">ID: ${charId}</div>
                                </div>
                            </div>
                            ${generateSkillsSummary(charData, position)}
                            ${generatePotentialsSummary(position)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Generate ALL discs section (main + sub)
    function generateAllDiscsSection() {
        if (!window.discsState) {
            return '<p style="color: var(--text-secondary); padding: 1rem;">레코드 데이터를 불러오는 중...</p>';
        }
        
        const mainSlots = ['main1', 'main2', 'main3'];
        const subSlots = ['sub1', 'sub2', 'sub3'];
        
        const hasMainDiscs = mainSlots.some(slotId => window.discsState.selectedDiscs?.[slotId]);
        const hasSubDiscs = subSlots.some(slotId => window.discsState.selectedDiscs?.[slotId]);
        
        if (!hasMainDiscs && !hasSubDiscs) {
            return '<p style="color: var(--text-secondary); padding: 1rem;">선택된 레코드 없음</p>';
        }
        
        let html = '<div class="summary-discs-two-column">';
        
        // Left column: Main Discs
        html += '<div class="summary-disc-column">';
        html += '<h4 class="summary-disc-column-title">🎵 메인 레코드</h4>';
        
        if (hasMainDiscs) {
            mainSlots.forEach((slotId, index) => {
                const disc = window.discsState.selectedDiscs?.[slotId];
                if (!disc) {
                    html += '<div class="summary-disc-card empty">슬롯 비어있음</div>';
                    return;
                }
                
                const discName = window.discsState.discNames?.[disc.Id] || '레코드';
                const limitBreak = window.discsState.discLimitBreaks?.[slotId] || 1;
                
                // Get disc icon
                const item = window.discsState.itemData?.[disc.Id];
                let iconPath = '';
                if (item && item.Icon) {
                    const parts = item.Icon.split('/');
                    const iconName = parts[parts.length - 1];
                    iconPath = `assets/${iconName}.png`;
                }
                
                // Get main skill
                const mainSkillId = disc.MainSkillGroupId ? `${disc.MainSkillGroupId}${String(limitBreak).padStart(2, '0')}` : null;
                const mainSkill = mainSkillId ? window.discsState.mainSkillData?.[mainSkillId] : null;
                const mainSkillName = mainSkill ? (window.discsState.mainSkillKRData?.[mainSkill.Name] || mainSkill.Name || '멜로디') : '';
                
                // Get secondary skills
                const secondarySkills = [];
                if (disc.SecondarySkillGroupId1 || disc.SecondarySkillGroupId2) {
                    const noteLevels = {};
                    const notesFromDiscs = window.calculateNotesFromSubDiscs ? window.calculateNotesFromSubDiscs() : {};
                    const acquiredNotes = window.discsState.acquiredNotes || {};
                    
                    Object.keys({...notesFromDiscs, ...acquiredNotes}).forEach(noteId => {
                        noteLevels[noteId] = (notesFromDiscs[noteId] || 0) + (acquiredNotes[noteId] || 0);
                    });
                    
                    [disc.SecondarySkillGroupId1, disc.SecondarySkillGroupId2].forEach(groupId => {
                        if (!groupId) return;
                        
                        for (let level = 9; level >= 1; level--) {
                            const skillId = String(groupId) + String(level).padStart(2, '0');
                            const skill = window.discsState.secondarySkillData?.[skillId];
                            
                            if (skill) {
                                if (skill.NeedSubNoteSkills) {
                                    try {
                                        const requirements = JSON.parse(skill.NeedSubNoteSkills);
                                        const requirementsMet = Object.entries(requirements).every(([noteId, requiredLevel]) => {
                                            const currentLevel = noteLevels[noteId] || 0;
                                            return currentLevel >= requiredLevel;
                                        });
                                        
                                        if (requirementsMet) {
                                            const skillName = window.discsState.secondarySkillKRData?.[skill.Name] || skill.Name || '협주';
                                            secondarySkills.push({ name: skillName, level: skill.Level || level });
                                            break;
                                        }
                                    } catch (e) {}
                                } else if (level === 1) {
                                    const skillName = window.discsState.secondarySkillKRData?.[skill.Name] || skill.Name || '협주';
                                    secondarySkills.push({ name: skillName, level: 1 });
                                    break;
                                }
                            }
                        }
                    });
                }
                
                html += `
                    <div class="summary-disc-card">
                        <div class="disc-card-icon-row">
                            ${iconPath ? `<img src="${iconPath}" alt="${discName}" class="disc-card-icon" onerror="this.style.display='none'">` : '<div class="disc-card-icon-placeholder">💿</div>'}
                            <div class="disc-card-info">
                                <div class="disc-card-name">${discName}</div>
                                <div class="disc-card-lb">돌파 ${limitBreak}</div>
                            </div>
                        </div>
                        <div class="disc-skills-compact">
                            ${mainSkillName ? `<div class="disc-skill-compact main"><span class="skill-badge-mini">멜로디</span>${mainSkillName} Lv.${limitBreak}</div>` : ''}
                            ${secondarySkills.map(s => `<div class="disc-skill-compact"><span class="skill-badge-mini">협주</span>${s.name} Lv.${s.level}</div>`).join('')}
                        </div>
                    </div>
                `;
            });
        } else {
            html += '<p style="color: var(--text-secondary); padding: 1rem;">선택된 메인 레코드 없음</p>';
        }
        
        html += '</div>'; // End left column
        
        // Right column: Sub Discs
        html += '<div class="summary-disc-column">';
        html += '<h4 class="summary-disc-column-title">🎶 보조 레코드</h4>';
        
        if (hasSubDiscs) {
            subSlots.forEach((slotId, index) => {
                const disc = window.discsState.selectedDiscs?.[slotId];
                if (!disc) {
                    html += '<div class="summary-disc-card empty">슬롯 비어있음</div>';
                    return;
                }
                
                const discName = window.discsState.discNames?.[disc.Id] || '레코드';
                const subDiscLevel = window.discsState.subDiscLevels?.[slotId] || 0;
                const phaseLabelMap = ['1+', '10+', '20+', '30+', '40+', '50+', '60+', '70+', '80+'];
                const phaseLabel = phaseLabelMap[subDiscLevel] || '1+';
                
                // Get disc icon
                const item = window.discsState.itemData?.[disc.Id];
                let iconPath = '';
                if (item && item.Icon) {
                    const parts = item.Icon.split('/');
                    const iconName = parts[parts.length - 1];
                    iconPath = `assets/${iconName}.png`;
                }
                
                // Get notes provided
                const lookupId = String(disc.SubNoteSkillGroupId * 100 + subDiscLevel);
                const phaseData = window.discsState.subNoteSkillPromoteData?.[lookupId];
                let notesInfo = '';
                
                if (phaseData && phaseData.SubNoteSkills) {
                    try {
                        const noteContributions = JSON.parse(phaseData.SubNoteSkills);
                        notesInfo = Object.entries(noteContributions).map(([noteId, count]) => {
                            const noteData = window.discsState.subNoteSkillData?.[noteId];
                            if (!noteData) return '';
                            const noteName = window.discsState.subNoteSkillKRData?.[noteData.Name] || noteData.Name || '';
                            return `<div class="sub-disc-note-item">${noteName} +${count}</div>`;
                        }).filter(i => i).join('');
                    } catch (e) {}
                }
                
                html += `
                    <div class="summary-disc-card sub-disc">
                        <div class="disc-card-icon-row">
                            ${iconPath ? `<img src="${iconPath}" alt="${discName}" class="disc-card-icon" onerror="this.style.display='none'">` : '<div class="disc-card-icon-placeholder">💿</div>'}
                            <div class="disc-card-info">
                                <div class="disc-card-name">${discName}</div>
                                <div class="disc-card-lb">레벨 ${phaseLabel}</div>
                            </div>
                        </div>
                        ${notesInfo ? `<div class="sub-disc-notes">${notesInfo}</div>` : ''}
                    </div>
                `;
            });
        } else {
            html += '<p style="color: var(--text-secondary); padding: 1rem;">선택된 보조 레코드 없음</p>';
        }
        
        html += '</div>'; // End right column
        html += '</div>'; // End two-column container
        
        return html;
    }
    
    // Generate disc info summary for each position
    function generateDiscInfoSummary(position) {
        // Get discs for this position from discsState
        if (!window.discsState) return '';
        
        // Disc slots are just main1, main2, main3 (not position-prefixed)
        const mainSlots = ['main1', 'main2', 'main3'];
        
        // Check if any discs are selected
        const hasDiscs = mainSlots.some(slotId => window.discsState.selectedDiscs?.[slotId]);
        
        if (!hasDiscs) {
            return `<div class="summary-discs">
                <div class="summary-section-label">레코드</div>
                <p style="color: var(--text-secondary); font-size: 0.85rem; padding: 8px;">선택된 레코드 없음</p>
            </div>`;
        }
        
        let html = `<div class="summary-discs">
            <div class="summary-section-label">레코드</div>
            <div class="summary-disc-list">`;
        
        mainSlots.forEach((slotId, index) => {
            const disc = window.discsState.selectedDiscs?.[slotId];
            if (!disc) return;
            
            const discName = window.discsState.discNames?.[disc.Id] || '레코드';
            const limitBreak = window.discsState.discLimitBreaks?.[slotId] || 1;
            
            // Get main skill
            const mainSkillId = disc.MainSkillGroupId ? `${disc.MainSkillGroupId}${String(limitBreak).padStart(2, '0')}` : null;
            const mainSkill = mainSkillId ? window.discsState.mainSkillData?.[mainSkillId] : null;
            const mainSkillName = mainSkill ? (window.discsState.mainSkillKRData?.[mainSkill.Name] || mainSkill.Name || '멜로디') : '';
            
            // Get secondary skills
            const secondarySkills = [];
            if (disc.SecondarySkillGroupId1 || disc.SecondarySkillGroupId2) {
                const noteLevels = {}; // Calculate note levels
                const notesFromDiscs = window.calculateNotesFromSubDiscs ? window.calculateNotesFromSubDiscs() : {};
                const acquiredNotes = window.discsState.acquiredNotes || {};
                
                Object.keys({...notesFromDiscs, ...acquiredNotes}).forEach(noteId => {
                    noteLevels[noteId] = (notesFromDiscs[noteId] || 0) + (acquiredNotes[noteId] || 0);
                });
                
                [disc.SecondarySkillGroupId1, disc.SecondarySkillGroupId2].forEach(groupId => {
                    if (!groupId) return;
                    
                    // Find highest achievable skill level
                    for (let level = 9; level >= 1; level--) {
                        const skillId = String(groupId) + String(level).padStart(2, '0');
                        const skill = window.discsState.secondarySkillData?.[skillId];
                        
                        if (skill) {
                            if (skill.NeedSubNoteSkills) {
                                try {
                                    const requirements = JSON.parse(skill.NeedSubNoteSkills);
                                    const requirementsMet = Object.entries(requirements).every(([noteId, requiredLevel]) => {
                                        const currentLevel = noteLevels[noteId] || 0;
                                        return currentLevel >= requiredLevel;
                                    });
                                    
                                    if (requirementsMet) {
                                        const skillName = window.discsState.secondarySkillKRData?.[skill.Name] || skill.Name || '협주';
                                        secondarySkills.push({ name: skillName, level: skill.Level || level });
                                        break;
                                    }
                                } catch (e) {}
                            } else if (level === 1) {
                                const skillName = window.discsState.secondarySkillKRData?.[skill.Name] || skill.Name || '협주';
                                secondarySkills.push({ name: skillName, level: 1 });
                                break;
                            }
                        }
                    }
                });
            }
            
            html += `
                <div class="summary-disc-card">
                    <div class="disc-card-header">
                        <span class="disc-slot-num">${index + 1}</span>
                        <span class="disc-name-compact">${discName}</span>
                        <span class="disc-lb-compact">돌파 ${limitBreak}</span>
                    </div>
                    <div class="disc-skills-compact">
                        ${mainSkillName ? `<div class="disc-skill-compact main"><span class="skill-badge-mini">멜로디</span>${mainSkillName} Lv.${limitBreak}</div>` : ''}
                        ${secondarySkills.map(s => `<div class="disc-skill-compact"><span class="skill-badge-mini">협주</span>${s.name} Lv.${s.level}</div>`).join('')}
                    </div>
                </div>
            `;
        });
        
        html += '</div></div>';
        
        // Add notes section
        html += generateNotesSummary();
        
        return html;
    }
    
    // Generate notes summary section
    function generateNotesSummary() {
        if (!window.discsState || !window.discsState.subNoteSkillData) {
            return '<p style="color: var(--text-secondary); padding: 1rem;">음표 데이터를 불러오는 중...</p>';
        }
        
        const notesFromDiscs = window.calculateNotesFromSubDiscs ? window.calculateNotesFromSubDiscs() : {};
        const acquiredNotes = window.discsState.acquiredNotes || {};
        const requiredNotes = window.discsState.requiredNotes || new Set();
        
        // Combine all notes
        const allNoteIds = new Set([...Object.keys(notesFromDiscs), ...Object.keys(acquiredNotes)]);
        
        // Separate used and unused notes
        const usedNotes = [];
        const unusedNotes = [];
        
        allNoteIds.forEach(noteId => {
            const fromDiscs = notesFromDiscs[noteId] || 0;
            const acquired = acquiredNotes[noteId] || 0;
            const total = fromDiscs + acquired;
            
            if (total === 0) return;
            
            const noteData = window.discsState.subNoteSkillData[noteId];
            if (!noteData) return;
            
            const krName = window.discsState.subNoteSkillKRData?.[noteData.Name] || noteData.Name || '';
            
            // Get note icon
            let iconPath = '';
            if (noteData.Icon) {
                const parts = noteData.Icon.split('/');
                const iconName = parts[parts.length - 1];
                iconPath = `assets/${iconName}_S.png`;
            }
            
            const noteInfo = {
                id: noteId,
                name: krName,
                icon: iconPath,
                total
            };
            
            if (requiredNotes.has(noteId)) {
                usedNotes.push(noteInfo);
            } else {
                unusedNotes.push(noteInfo);
            }
        });
        
        if (usedNotes.length === 0 && unusedNotes.length === 0) {
            return '<p style="color: var(--text-secondary); padding: 1rem;">활성화된 음표 없음</p>';
        }
        
        let html = '<div class="summary-notes-compact-container">';
        
        if (usedNotes.length > 0) {
            html += `<div class="notes-compact-subsection">
                <h4 class="notes-compact-title used">📌 사용 중인 음표</h4>
                <div class="notes-compact-grid">`;
            
            usedNotes.forEach(note => {
                html += `
                    <div class="note-compact-card used" title="${note.name}">
                        ${note.icon ? `<img src="${note.icon}" alt="${note.name}" class="note-compact-icon" onerror="this.style.display='none'">` : '<div class="note-compact-icon-placeholder">🎵</div>'}
                        <div class="note-compact-level">${note.total}</div>
                    </div>
                `;
            });
            
            html += `</div></div>`;
        }
        
        if (unusedNotes.length > 0) {
            html += `<div class="notes-compact-subsection">
                <h4 class="notes-compact-title unused">💤 미사용 음표</h4>
                <div class="notes-compact-grid">`;
            
            unusedNotes.forEach(note => {
                html += `
                    <div class="note-compact-card unused" title="${note.name}">
                        ${note.icon ? `<img src="${note.icon}" alt="${note.name}" class="note-compact-icon" onerror="this.style.display='none'">` : '<div class="note-compact-icon-placeholder">🎵</div>'}
                        <div class="note-compact-level">${note.total}</div>
                    </div>
                `;
            });
            
            html += `</div></div>`;
        }
        
        html += `</div>`;
        return html;
    }
    
    // Generate skills summary (2 columns, compact)
    function generateSkillsSummary(charData, position) {
        const isMaster = position === 'master';
        
        // Map of skill type labels and their ID keys in charData
        const skillMapping = isMaster ? [
            { key: 'NormalAtkId', label: '일반공격' },
            { key: 'SkillId', label: '스킬' },
            { key: 'UltimateId', label: '필살기' },
            { key: 'DodgeId', label: '회피' },
            { key: 'SpecialSkillId', label: '특수스킬' }
        ] : [
            { key: 'AssistSkillId', label: '어시스트' }
        ];
        
        let html = '<div class="summary-skills"><div class="summary-section-label">스킬 레벨</div><div class="summary-skill-grid">';
        
        skillMapping.forEach(({ key, label }) => {
            const skillId = charData[key];
            if (skillId && window.state?.skills?.[skillId]) {
                const skillData = window.state.skills[skillId];
                const titleKey = skillData.Title;
                const skillName = window.state?.skillNames?.[titleKey] || label;
                const level = window.state?.skillLevels?.[position]?.[skillId] || 1;
                
                html += `
                    <div class="summary-skill-card">
                        <span class="skill-name-compact">${skillName}</span>
                        <span class="skill-level-compact">Lv.${level}</span>
                    </div>
                `;
            }
        });
        
        html += '</div></div>';
        return html;
    }
    
    // Generate potentials summary with marking functionality
    function generatePotentialsSummary(position) {
        const selectedPotentials = window.state?.selectedPotentials?.[position] || [];
        
        if (selectedPotentials.length === 0) {
            return `<div class="summary-potentials">
                <div class="summary-section-label">잠재력: 0</div>
                <p style="color: var(--text-secondary); font-size: 0.85rem; padding: 8px;">선택된 잠재력 없음</p>
            </div>`;
        }
        
        // Separate specific potentials from normal/common
        const specificPots = [];
        const normalCommonPots = [];
        
        selectedPotentials.forEach(potId => {
            const itemData = window.state?.items?.[potId];
            if (itemData && itemData.Stype === 42) {
                specificPots.push(potId);
            } else {
                normalCommonPots.push(potId);
            }
        });
        
        // Calculate total potential levels
        let totalPotentialLevels = 0;
        selectedPotentials.forEach(potId => {
            const itemData = window.state?.items?.[potId];
            const isSpecificPotential = itemData && itemData.Stype === 42;
            
            if (isSpecificPotential) {
                const character = window.state?.party?.[position];
                const isMaster = position === 'master';
                const skillId = isMaster ? character?.data.UltimateId : character?.data.AssistSkillId;
                const level = skillId ? (window.state?.skillLevels?.[position]?.[skillId] || 1) : 1;
                totalPotentialLevels += level;
            } else {
                const level = window.state?.potentialLevels?.[position]?.[potId] || 1;
                totalPotentialLevels += level;
            }
        });
        
        // Initialize potential marks if not exists
        if (!window.state.potentialMarks) {
            window.state.potentialMarks = {};
        }
        if (!window.state.potentialMarks[position]) {
            window.state.potentialMarks[position] = {};
        }
        
        let html = `<div class="summary-potentials">
            <div class="summary-section-label">잠재력: ${totalPotentialLevels}</div>`;
        
        // Show specific potentials first
        if (specificPots.length > 0) {
            html += '<div class="summary-potential-section">';
            html += '<div class="summary-potential-section-title">⭐ 전용 잠재력</div>';
            html += '<div class="summary-potential-list specific-potentials">';
            
            specificPots.forEach(potId => {
                const potential = window.state?.potentials?.[potId];
                if (!potential) return;
                
                const briefDescKey = potential.BriefDesc;
                const itemKey = briefDescKey ? briefDescKey.replace('Potential.', 'Item.') : null;
                const potName = itemKey ? (window.state?.itemNames?.[itemKey] || `Potential ${potId}`) : `Potential ${potId}`;
                
                const character = window.state?.party?.[position];
                const isMaster = position === 'master';
                const skillId = isMaster ? character?.data.UltimateId : character?.data.AssistSkillId;
                const level = skillId ? (window.state?.skillLevels?.[position]?.[skillId] || 1) : 1;
                
                const mark = window.state.potentialMarks[position][potId] || '';
                
                let markBadge = '';
                if (mark === '필수') {
                    markBadge = '<span class="potential-mark-badge essential">필수</span>';
                } else if (mark === '권장') {
                    markBadge = '<span class="potential-mark-badge recommended">권장</span>';
                } else if (mark === 'Lv.1') {
                    markBadge = '<span class="potential-mark-badge level-one">Lv.1</span>';
                }
                
                html += `
                    <div class="summary-potential-item specific" 
                         data-action="summary-cycle-potential-mark"
                         data-position="${position}"
                         data-potential-id="${potId}">
                        <div class="potential-info-compact">
                            <span class="potential-name-compact">${potName}</span>
                            ${markBadge}
                        </div>
                        <span class="potential-level-compact skill-level">Lv.${level}</span>
                    </div>
                `;
            });
            
            html += '</div></div>';
        }
        
        // Show normal/common potentials
        if (normalCommonPots.length > 0) {
            html += '<div class="summary-potential-section">';
            html += '<div class="summary-potential-section-title">📋 일반/공용 잠재력</div>';
            html += '<div class="summary-potential-list">';
            
            normalCommonPots.forEach(potId => {
                const potential = window.state?.potentials?.[potId];
                if (!potential) return;
                
                const briefDescKey = potential.BriefDesc;
                const itemKey = briefDescKey ? briefDescKey.replace('Potential.', 'Item.') : null;
                const potName = itemKey ? (window.state?.itemNames?.[itemKey] || `Potential ${potId}`) : `Potential ${potId}`;
                
                const level = window.state?.potentialLevels?.[position]?.[potId] || 1;
                const mark = window.state.potentialMarks[position][potId] || '';
                
                let markBadge = '';
                if (mark === '필수') {
                    markBadge = '<span class="potential-mark-badge essential">필수</span>';
                } else if (mark === '권장') {
                    markBadge = '<span class="potential-mark-badge recommended">권장</span>';
                } else if (mark === 'Lv.1') {
                    markBadge = '<span class="potential-mark-badge level-one">Lv.1</span>';
                }
                
                html += `
                    <div class="summary-potential-item"
                         data-action="summary-cycle-potential-mark"
                         data-position="${position}"
                         data-potential-id="${potId}">
                        <div class="potential-info-compact">
                            <span class="potential-name-compact">${potName}</span>
                            ${markBadge}
                        </div>
                        <span class="potential-level-compact">Lv.${level}</span>
                    </div>
                `;
            });
            
            html += '</div></div>';
        }
        
        html += '</div>';
        return html;
    }
    
    // Generate build statistics
    function generateBuildStats() {
        // Calculate character scores
        let totalCharacterScore = 0;
        ['master', 'assist1', 'assist2'].forEach(pos => {
            if (window.calculateCharacterScore) {
                totalCharacterScore += window.calculateCharacterScore(pos);
            }
        });
        
        // Calculate disc score
        let totalDiscScore = 0;
        if (window.calculateDiscScore) {
            totalDiscScore = window.calculateDiscScore();
        }
        
        // Total score
        const totalScore = totalCharacterScore + totalDiscScore;
        
        // Calculate build level
        const buildInfo = calculateBuildLevel(totalScore);
        const buildLevel = buildInfo.level;
        const buildIconPath = `assets/BuildRank_${buildLevel}.png`;
        
        // Calculate total potential levels across all characters
        let totalPotentialLevels = 0;
        ['master', 'assist1', 'assist2'].forEach(pos => {
            const selectedPotentials = window.state?.selectedPotentials?.[pos] || [];
            const character = window.state?.party?.[pos];
            
            selectedPotentials.forEach(potId => {
                const itemData = window.state?.items?.[potId];
                const isSpecificPotential = itemData && itemData.Stype === 42;
                
                if (isSpecificPotential) {
                    // For specific potentials, use skill level
                    const isMaster = pos === 'master';
                    const skillId = isMaster ? character?.data.UltimateId : character?.data.AssistSkillId;
                    const level = skillId ? (window.state?.skillLevels?.[pos]?.[skillId] || 1) : 1;
                    totalPotentialLevels += level;
                } else {
                    // For normal potentials, use potential level
                    const level = window.state?.potentialLevels?.[pos]?.[potId] || 1;
                    totalPotentialLevels += level;
                }
            });
        });
        
        return `
            <div class="build-stat-card highlight build-level-card">
                <div class="build-level-icon-container">
                    <img src="${buildIconPath}" alt="Build Level ${buildLevel}" class="build-level-icon" onerror="this.style.display='none'">
                </div>
                <div class="build-stat-info">
                    <span class="build-stat-label">빌드 레벨</span>
                    <span class="build-stat-value large">Lv.${buildLevel}</span>
                </div>
            </div>
            <div class="build-stat-card highlight">
                <div class="build-stat-icon">⭐</div>
                <div class="build-stat-info">
                    <span class="build-stat-label">총 점수</span>
                    <span class="build-stat-value large">${totalScore}</span>
                </div>
            </div>
            <div class="build-stat-card">
                <div class="build-stat-icon">⚡</div>
                <div class="build-stat-info">
                    <span class="build-stat-label">총 잠재력</span>
                    <span class="build-stat-value">${totalPotentialLevels}</span>
                </div>
            </div>
        `;
    }
    
    // Set potential mark (필수, 권장, Lv.1) - cycles through options
    function cyclePotentialMark(position, potId) {
        if (!window.state.potentialMarks) {
            window.state.potentialMarks = {};
        }
        if (!window.state.potentialMarks[position]) {
            window.state.potentialMarks[position] = {};
        }
        
        const currentMark = window.state.potentialMarks[position][potId] || '';
        
        // Cycle through: '' -> '필수' -> '권장' -> 'Lv.1' -> ''
        if (currentMark === '') {
            window.state.potentialMarks[position][potId] = '필수';
        } else if (currentMark === '필수') {
            window.state.potentialMarks[position][potId] = '권장';
        } else if (currentMark === '권장') {
            window.state.potentialMarks[position][potId] = 'Lv.1';
        } else {
            window.state.potentialMarks[position][potId] = '';
        }
        
        updateSummary();
    }
    
    // Update summary (called when switching to summary tab)
    function updateSummary() {
        renderSummary();
    }
    
    // Export build as JSON
    function exportBuild() {
        const buildData = {
            party: window.state?.party || {},
            selectedPotentials: window.state?.selectedPotentials || {},
            potentialLevels: window.state?.potentialLevels || {},
            skillLevels: window.state?.skillLevels || {},
            notes: document.getElementById('build-notes')?.value || '',
            timestamp: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(buildData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `stella-sora-build-${Date.now()}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        if (typeof showSuccess === 'function') {
            showSuccess('빌드를 성공적으로 내보냈습니다!');
        }
    }
    
    // Share build via URL
    function shareBuild() {
        const buildData = {
            party: window.state?.party || {},
            selectedPotentials: window.state?.selectedPotentials || {},
            potentialLevels: window.state?.potentialLevels || {},
            skillLevels: window.state?.skillLevels || {}
        };
        
        const encodedData = btoa(JSON.stringify(buildData));
        const shareUrl = `${window.location.origin}${window.location.pathname}?build=${encodedData}`;
        
        navigator.clipboard.writeText(shareUrl).then(() => {
            if (typeof showSuccess === 'function') {
                showSuccess('공유 링크가 클립보드에 복사되었습니다!');
            }
        }).catch(err => {
            console.error('Failed to copy:', err);
            if (typeof showError === 'function') {
                showError('링크 복사에 실패했습니다.');
            }
        });
    }
    
    // Copy build as text
    function copyBuild() {
        let text = '=== 스텔라 소라 빌드 ===\n\n';
        
        ['master', 'assist1', 'assist2'].forEach(position => {
            const character = window.state?.party?.[position];
            if (!character) return;
            
            const posLabel = position === 'master' ? '메인' : position === 'assist1' ? '지원 1' : '지원 2';
            text += `【${posLabel}】${character.name}\n`;
            
            // Skills
            const charData = character.data;
            const isMaster = position === 'master';
            const skillMapping = isMaster ? [
                { key: 'NormalAtkId', label: '일반공격' },
                { key: 'SkillId', label: '스킬' },
                { key: 'UltimateId', label: '필살기' },
                { key: 'DodgeId', label: '회피' },
                { key: 'SpecialSkillId', label: '특수스킬' }
            ] : [
                { key: 'AssistSkillId', label: '어시스트' }
            ];
            
            text += '  스킬 레벨:\n';
            skillMapping.forEach(({ key, label }) => {
                const skillId = charData[key];
                if (skillId && window.state?.skills?.[skillId]) {
                    const skillData = window.state.skills[skillId];
                    const titleKey = skillData.Title;
                    const skillName = window.state?.skillNames?.[titleKey] || label;
                    const level = window.state?.skillLevels?.[position]?.[skillId] || 1;
                    text += `    - ${skillName}: Lv.${level}\n`;
                }
            });
            
            // Potentials
            const potentials = window.state?.selectedPotentials?.[position] || [];
            if (potentials.length > 0) {
                text += '  잠재력:\n';
                potentials.forEach(potId => {
                    const potential = window.state?.potentials?.[potId];
                    if (potential) {
                        const briefDescKey = potential.BriefDesc;
                        const itemKey = briefDescKey ? briefDescKey.replace('Potential.', 'Item.') : null;
                        const potName = itemKey ? (window.state?.itemNames?.[itemKey] || `Potential ${potId}`) : `Potential ${potId}`;
                        const level = window.state?.potentialLevels?.[position]?.[potId] || 1;
                        text += `    - ${potName} (Lv.${level})\n`;
                    }
                });
            }
            
            text += '\n';
        });
        
        const notes = document.getElementById('build-notes')?.value;
        if (notes) {
            text += `메모:\n${notes}\n`;
        }
        
        navigator.clipboard.writeText(text).then(() => {
            if (typeof showSuccess === 'function') {
                showSuccess('빌드 정보가 클립보드에 복사되었습니다!');
            }
        }).catch(err => {
            console.error('Failed to copy:', err);
            if (typeof showError === 'function') {
                showError('복사에 실패했습니다.');
            }
        });
    }
    
    // ============================================================================
    // EVENT DELEGATION
    // ============================================================================
    
    /**
     * Setup event delegation for summary module
     */
    function setupSummaryEventDelegation() {
        const summaryContainer = document.getElementById('main-tab-summary');
        if (!summaryContainer) return;
        
        summaryContainer.addEventListener('click', function(e) {
            const target = e.target;
            const button = target.closest('[data-action]');
            
            if (!button) return;
            
            const action = button.dataset.action;
            handleSummaryAction(button, action);
        });
    }
    
    /**
     * Handle delegated summary actions
     */
    function handleSummaryAction(element, action) {
        switch(action) {
            case 'summary-cycle-potential-mark':
                {
                    const position = element.dataset.position;
                    const potentialId = parseInt(element.dataset.potentialId);
                    cyclePotentialMark(position, potentialId);
                }
                break;
                
            default:
                break;
        }
    }
    
    // Setup event delegation when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupSummaryEventDelegation);
    } else {
        setupSummaryEventDelegation();
    }
    
    // Save build notes
    function saveBuildNotes() {
        const notes = document.getElementById('build-notes')?.value || '';
        localStorage.setItem('stella-sora-build-notes', notes);
    }
    
    // Load build notes
    function loadBuildNotes() {
        const notes = localStorage.getItem('stella-sora-build-notes') || '';
        const textarea = document.getElementById('build-notes');
        if (textarea) {
            textarea.value = notes;
        }
    }
    
    // Make functions globally available
    window.renderSummary = renderSummary;
    window.updateSummary = updateSummary;
    window.exportBuild = exportBuild;
    window.shareBuild = shareBuild;
    window.copyBuild = copyBuild;
    window.saveBuildNotes = saveBuildNotes;
    window.cyclePotentialMark = cyclePotentialMark;
    
    // Don't auto-render on page load - wait for tab switch
    // renderSummary will be called by switchMainTab() when user clicks summary tab
})();
