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

                <!-- Build Summary Section -->

                <!-- Party Overview Cards -->
                <div class="summary-section">
                    <h3 class="summary-section-title">${getIcon('people')} 캐릭터</h3>
                    <div class="summary-cards-grid">
                        ${generateSummaryCard('master', `${getIcon('master')} 메인`, 'master-badge')}
                        ${generateSummaryCard('assist1', `${getIcon('assist')} 지원 1`, 'assist-badge')}
                        ${generateSummaryCard('assist2', `${getIcon('assist')} 지원 2`, 'assist-badge')}
                    </div>
                </div>

                <!-- Discs and Notes Section (3 Columns) -->
                <div class="summary-section">
                    <div class="discs-notes-container">
                        ${generateAllDiscsSection()}
                    </div>
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
                <div class="summary-card-body">
                    <div class="summary-character-preview">
                        <div class="summary-character-info">
                            <div class="summary-char-basic">
                                <img src="assets/char/avg1_${charId}_002.png"
                                     alt="${charName}"
                                     class="summary-char-image"
                                     onerror="this.style.display='none'">
                                <div class="summary-char-name-section">
                                    <div class="summary-card-badge ${badgeClass}">${title}</div>
                                    <div class="summary-char-name">${charName}</div>
                                    ${generateSkillsSummaryCompact(charData, position)}
                                </div>
                            </div>
                            ${generatePotentialsSummary(position)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Generate ALL discs section (main + sub + notes in 3 columns)
    function generateAllDiscsSection() {
        if (!window.discsState) {
            return '<p style="color: var(--text-secondary); padding: 1rem;">레코드 데이터를 불러오는 중...</p>';
        }
        
        const mainSlots = ['main1', 'main2', 'main3'];
        const subSlots = ['sub1', 'sub2', 'sub3'];
        
        const hasMainDiscs = mainSlots.some(slotId => window.discsState.selectedDiscs?.[slotId]);
        const hasSubDiscs = subSlots.some(slotId => window.discsState.selectedDiscs?.[slotId]);
        
        let html = '';
        
        // Column 1: Main Discs
        html += '<div class="summary-disc-column">';
        html += '<h3 class="summary-section-title">🎵 메인 레코드</h3>';
        
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
                    iconPath = `assets/disc_icons/${iconName}.png`;
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
                            ${iconPath ? `<img src="${iconPath}" alt="${discName}" class="disc-card-icon" onerror="this.style.display='none'">` : `<div class="disc-card-icon-placeholder">${getIcon('disc')}</div>`}
                            <div class="disc-card-info">
                                <div class="disc-card-name">${discName}</div>
                                <div class="disc-card-lb">돌파 ${limitBreak}</div>
                            </div>
                        </div>
                        <div class="disc-skills-badges">
                            ${mainSkillName ? `<span class="disc-skill-badge main" title="${mainSkillName}">멜로디 Lv.${limitBreak}</span>` : ''}
                            ${secondarySkills.map(s => `<span class="disc-skill-badge secondary" title="${s.name}">협주 Lv.${s.level}</span>`).join('')}
                        </div>
                    </div>
                `;
            });
        } else {
            html += '<p style="color: var(--text-secondary); padding: 1rem;">선택된 메인 레코드 없음</p>';
        }
        
        html += '</div>'; // End main discs column
        
        // Column 2: Sub Discs
        html += '<div class="summary-disc-column">';
        html += '<h3 class="summary-section-title">🎶 보조 레코드</h3>';
        
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
                    iconPath = `assets/disc_icons/${iconName}.png`;
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
                            ${iconPath ? `<img src="${iconPath}" alt="${discName}" class="disc-card-icon" onerror="this.style.display='none'">` : `<div class="disc-card-icon-placeholder">${getIcon('disc')}</div>`}
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
        
        html += '</div>'; // End sub discs column
        
        // Column 3: Notes
        html += '<div class="summary-disc-column notes-column">';
        html += '<h3 class="summary-section-title">🎼 음표</h3>';
        html += generateNotesSummary();
        html += '</div>'; // End notes column
        
        return html;
    }
    
    // NOTE: generateDiscInfoSummary was removed as it's never called
    // Disc information is now shown via generateAllDiscsSection() in the main summary
    
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
    
    // Generate compact skills summary with generic labels inside character box
    function generateSkillsSummaryCompact(charData, position) {
        const isMaster = position === 'master';

        // Map of skill types with generic labels
        const skillMapping = isMaster ? [
            { key: 'NormalAtkId', label: '평타' },
            { key: 'SkillId', label: '스킬' },
            { key: 'UltimateId', label: '필살기' }
        ] : [
            { key: 'AssistSkillId', label: '지원' }
        ];

        let html = '<div class="summary-skills-inline">';

        skillMapping.forEach(({ key, label }) => {
            const skillId = charData[key];
            if (skillId && window.state?.skills?.[skillId]) {
                const level = window.state?.skillLevels?.[position]?.[skillId] || 1;

                html += `<div class="skill-badge-inline">${label} Lv.${level}</div>`;
            }
        });

        html += '</div>';
        return html;
    }
    
    // Generate potentials summary with icon-based display and marking functionality
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
            <div class="summary-section-label-row">
                <span>잠재력: ${totalPotentialLevels}</span>
                <span class="potential-hint">클릭: 마크 변경 | 드래그: 순서 변경</span>
            </div>`;

        // Render specific potentials first (top row, max 2)
        if (specificPots.length > 0) {
            html += '<div class="summary-potential-icons-grid specific-pots-grid" data-position="' + position + '" data-section="specific">';

            specificPots.forEach(potId => {
                const itemData = window.state?.items?.[potId];
                const character = window.state?.party?.[position];
                const isMaster = position === 'master';
                const skillId = isMaster ? character?.data.UltimateId : character?.data.AssistSkillId;
                const level = skillId ? (window.state?.skillLevels?.[position]?.[skillId] || 1) : 1;
                const mark = window.state.potentialMarks[position][potId] || '';

                html += `<div class="potential-icon-wrapper"
                              data-section="specific">
                    <div data-action="summary-cycle-potential-mark"
                         data-position="${position}"
                         data-potential-id="${potId}">`;

                if (typeof window.generatePotentialIconHTML === 'function') {
                    html += window.generatePotentialIconHTML(potId, position, level, mark);
                }

                html += `</div></div>`;
            });

            html += '</div>';
        }

        // Render normal/common potentials (4 per row grid)
        if (normalCommonPots.length > 0) {
            html += '<div class="summary-potential-icons-grid" data-position="' + position + '" data-section="normal">';

            normalCommonPots.forEach(potId => {
                const itemData = window.state?.items?.[potId];
                const level = window.state?.potentialLevels?.[position]?.[potId] || 1;
                const mark = window.state.potentialMarks[position][potId] || '';

                html += `<div class="potential-icon-wrapper"
                              data-section="normal">
                    <div data-action="summary-cycle-potential-mark"
                         data-position="${position}"
                         data-potential-id="${potId}">`;

                if (typeof window.generatePotentialIconHTML === 'function') {
                    html += window.generatePotentialIconHTML(potId, position, level, mark);
                }

                html += `</div></div>`;
            });

            html += '</div>';
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
        const buildIconPath = `assets/buildrank/BuildRank_${buildLevel}.png`;
        
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
                <div class="build-stat-icon">${getIcon('star')}</div>
                <div class="build-stat-info">
                    <span class="build-stat-label">총 점수</span>
                    <span class="build-stat-value large">${totalScore}</span>
                </div>
            </div>
            <div class="build-stat-card">
                <div class="build-stat-icon">${getIcon('critPower')}</div>
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

        // Drag-and-drop for potential reordering
        setupPotentialDragAndDrop(summaryContainer);
    }

    /**
     * Setup drag-and-drop for potential icon reordering with visual placeholder
     */
    function setupPotentialDragAndDrop(container) {
        let draggedElement = null;
        let sourcePosition = null;
        let sourcePotentialId = null;
        let sourceSection = null;
        let placeholder = null;
        let lastTargetWrapper = null;
        let lastInsertBefore = false;

        container.addEventListener('dragstart', function(e) {
            const potIcon = e.target.closest('.potential-icon-compact');
            if (!potIcon) return;

            draggedElement = e.target.closest('.potential-icon-wrapper');
            if (!draggedElement) return;

            sourcePotentialId = parseInt(potIcon.dataset.potentialId);
            sourcePosition = potIcon.dataset.position;
            sourceSection = draggedElement.dataset.section;

            // Add dragging class
            draggedElement.classList.add('dragging');

            // Create placeholder
            placeholder = document.createElement('div');
            placeholder.className = 'potential-drop-placeholder';
            placeholder.dataset.placeholder = 'true';

            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', draggedElement.innerHTML);
        });

        container.addEventListener('dragend', function(e) {
            if (draggedElement) {
                draggedElement.classList.remove('dragging');
            }

            // Remove placeholder
            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.removeChild(placeholder);
            }
            placeholder = null;
            lastTargetWrapper = null;
        });

        container.addEventListener('dragover', function(e) {
            e.preventDefault();
            if (!draggedElement || !placeholder) return;

            const targetWrapper = e.target.closest('.potential-icon-wrapper');
            if (!targetWrapper) return;

            const targetSection = targetWrapper.dataset.section;

            // Only show placeholder if same section
            if (sourceSection !== targetSection) {
                if (placeholder.parentNode) {
                    placeholder.parentNode.removeChild(placeholder);
                }
                lastTargetWrapper = null;
                return;
            }

            const targetGrid = targetWrapper.closest('.summary-potential-icons-grid');
            if (!targetGrid) return;

            // Don't show placeholder on the dragged element itself
            if (targetWrapper === draggedElement) return;

            // Determine if we should insert before or after based on mouse position
            const rect = targetWrapper.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;
            const insertBefore = e.clientX < midpoint;

            // Store the last valid target position
            lastTargetWrapper = targetWrapper;
            lastInsertBefore = insertBefore;

            // Insert placeholder
            if (insertBefore) {
                targetWrapper.parentNode.insertBefore(placeholder, targetWrapper);
            } else {
                targetWrapper.parentNode.insertBefore(placeholder, targetWrapper.nextSibling);
            }

            e.dataTransfer.dropEffect = 'move';
        });

        container.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();

            // Remove placeholder
            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.removeChild(placeholder);
            }

            if (!draggedElement) return;

            // Try to get target from event, or use last known target position
            let targetWrapper = e.target.closest('.potential-icon-wrapper');
            let insertBefore = lastInsertBefore;

            // If we didn't find a target (e.g., dropped on placeholder), use last target
            if (!targetWrapper && lastTargetWrapper) {
                targetWrapper = lastTargetWrapper;
            }

            if (!targetWrapper || targetWrapper === draggedElement) {
                // Reset and return
                draggedElement = null;
                sourcePotentialId = null;
                sourcePosition = null;
                sourceSection = null;
                lastTargetWrapper = null;
                return;
            }

            // Get target potential info from the icon element
            const targetPotIcon = targetWrapper.querySelector('.potential-icon-compact');
            if (!targetPotIcon) {
                // Reset and return
                draggedElement = null;
                sourcePotentialId = null;
                sourcePosition = null;
                sourceSection = null;
                lastTargetWrapper = null;
                return;
            }

            const targetPosition = targetPotIcon.dataset.position;
            const targetPotentialId = parseInt(targetPotIcon.dataset.potentialId);
            const targetSection = targetWrapper.dataset.section;

            // Only allow reordering within the same character position AND section
            if (sourcePosition !== targetPosition || sourceSection !== targetSection) {
                // Reset and return
                draggedElement = null;
                sourcePotentialId = null;
                sourcePosition = null;
                sourceSection = null;
                lastTargetWrapper = null;
                return;
            }

            // Reorder the potentials array
            reorderPotentialsWithDirection(sourcePosition, sourcePotentialId, targetPotentialId, insertBefore);

            // Reset
            draggedElement = null;
            sourcePotentialId = null;
            sourcePosition = null;
            sourceSection = null;
            lastTargetWrapper = null;
        });
    }

    /**
     * Reorder potentials array with specific insert direction
     */
    function reorderPotentialsWithDirection(position, sourcePotId, targetPotId, insertBefore) {
        if (!window.state?.selectedPotentials?.[position]) return;

        const potentials = window.state.selectedPotentials[position];
        const sourceIndex = potentials.indexOf(sourcePotId);
        const targetIndex = potentials.indexOf(targetPotId);

        if (sourceIndex === -1 || targetIndex === -1) return;

        // Remove source
        potentials.splice(sourceIndex, 1);

        // Recalculate target index after removal
        const newTargetIndex = potentials.indexOf(targetPotId);

        // Insert at appropriate position
        if (insertBefore) {
            potentials.splice(newTargetIndex, 0, sourcePotId);
        } else {
            potentials.splice(newTargetIndex + 1, 0, sourcePotId);
        }

        // Re-render summary to show new order
        updateSummary();
    }

    // NOTE: Old reorderPotentials() function removed - superseded by reorderPotentialsWithDirection()
    
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
        document.addEventListener('DOMContentLoaded', () => {
            setupSummaryEventDelegation();
        });
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
    window.saveBuildNotes = saveBuildNotes;
    window.cyclePotentialMark = cyclePotentialMark;
    
    // Don't auto-render on page load - wait for tab switch
    // renderSummary will be called by switchMainTab() when user clicks summary tab
})();
