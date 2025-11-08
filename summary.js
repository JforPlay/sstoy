// Summary Tab Module
// Displays party overview and build statistics

(function() {
    'use strict';
    
    // Render summary tab content
    function renderSummary() {
        const container = document.getElementById('summary-container');
        if (!container) return;
        
        const htmlContent = `
            <div class="summary-layout">
                <div class="summary-header">
                    <h2>빌드 요약</h2>
                    <div class="summary-actions">
                        <button class="summary-action-btn" onclick="exportBuild()">
                            <span class="action-icon">📤</span>
                            <span>내보내기</span>
                        </button>
                        <button class="summary-action-btn" onclick="shareBuild()">
                            <span class="action-icon">🔗</span>
                            <span>공유하기</span>
                        </button>
                        <button class="summary-action-btn" onclick="copyBuild()">
                            <span class="action-icon">📋</span>
                            <span>복사하기</span>
                        </button>
                    </div>
                </div>

                <!-- Party Overview Cards -->
                <div class="summary-cards-grid">
                    ${generateSummaryCard('master', '👑 메인', 'master-badge')}
                    ${generateSummaryCard('assist1', '♟️ 지원 1', 'assist-badge')}
                    ${generateSummaryCard('assist2', '♟️ 지원 2', 'assist-badge')}
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
                    <h3>빌드 메모</h3>
                    <textarea 
                        class="build-notes-textarea" 
                        id="build-notes"
                        placeholder="빌드에 대한 메모를 작성하세요...&#10;예: 특정 보스 전용, PvP 최적화 등"
                        oninput="saveBuildNotes()"
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
        const character = state?.party?.[position];
        
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
    
    // Generate skills summary
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
        
        let html = '<div class="summary-skills"><div class="summary-skills-title">스킬 레벨</div><div class="summary-skill-list">';
        
        skillMapping.forEach(({ key, label }) => {
            const skillId = charData[key];
            if (skillId && state?.skills?.[skillId]) {
                const skillData = state.skills[skillId];
                const titleKey = skillData.Title;
                const skillName = state?.skillNames?.[titleKey] || label;
                const level = state?.skillLevels?.[position]?.[skillId] || 1;
                
                html += `
                    <div class="summary-skill-item">
                        <span class="summary-skill-name">${skillName}</span>
                        <span class="summary-skill-level">Lv.${level}</span>
                    </div>
                `;
            }
        });
        
        html += '</div></div>';
        return html;
    }
    
    // Generate potentials summary
    function generatePotentialsSummary(position) {
        const selectedPotentials = state?.selectedPotentials?.[position] || [];
        
        if (selectedPotentials.length === 0) {
            return '<div class="summary-potentials"><div class="summary-potentials-title">잠재력 (0)</div><p style="color: var(--text-secondary); font-size: 0.85rem; padding: 8px;">선택된 잠재력 없음</p></div>';
        }
        
        // Separate specific potentials (Stype 42) from normal/common
        const specificPots = [];
        const normalCommonPots = [];
        
        selectedPotentials.forEach(potId => {
            const itemData = state?.items?.[potId];
            if (itemData && itemData.Stype === 42) {
                specificPots.push(potId);
            } else {
                normalCommonPots.push(potId);
            }
        });
        
        let html = `<div class="summary-potentials"><div class="summary-potentials-title">잠재력 (${selectedPotentials.length})</div>`;
        
        // Show specific potentials first
        if (specificPots.length > 0) {
            html += '<div class="summary-potential-section"><div class="summary-potential-section-title">전용 잠재력</div><div class="summary-potential-list">';
            specificPots.forEach(potId => {
                const potential = state?.potentials?.[potId];
                if (potential) {
                    const briefDescKey = potential.BriefDesc;
                    const itemKey = briefDescKey ? briefDescKey.replace('Potential.', 'Item.') : null;
                    const potName = itemKey ? (state?.itemNames?.[itemKey] || `Potential ${potId}`) : `Potential ${potId}`;
                    
                    // Specific potentials use skill level, not potential level
                    const character = state?.party?.[position];
                    const isMaster = position === 'master';
                    const skillId = isMaster ? character?.data.UltimateId : character?.data.AssistSkillId;
                    const level = skillId ? (state?.skillLevels?.[position]?.[skillId] || 1) : 1;
                    
                    html += `
                        <div class="summary-potential-item">
                            <span class="summary-potential-name">${potName}</span>
                            <span class="summary-potential-level">스킬 Lv.${level}</span>
                        </div>
                    `;
                }
            });
            html += '</div></div>';
        }
        
        // Show normal/common potentials
        if (normalCommonPots.length > 0) {
            html += '<div class="summary-potential-section"><div class="summary-potential-section-title">일반/공용 잠재력</div><div class="summary-potential-list">';
            normalCommonPots.forEach(potId => {
                const potential = state?.potentials?.[potId];
                if (potential) {
                    const briefDescKey = potential.BriefDesc;
                    const itemKey = briefDescKey ? briefDescKey.replace('Potential.', 'Item.') : null;
                    const potName = itemKey ? (state?.itemNames?.[itemKey] || `Potential ${potId}`) : `Potential ${potId}`;
                    const level = state?.potentialLevels?.[position]?.[potId] || 1;
                    
                    html += `
                        <div class="summary-potential-item">
                            <span class="summary-potential-name">${potName}</span>
                            <span class="summary-potential-level">Lv.${level}</span>
                        </div>
                    `;
                }
            });
            html += '</div></div>';
        }
        
        html += '</div>';
        return html;
    }
    
    // Generate build statistics
    function generateBuildStats() {
        // Count total potentials
        const totalPotentials = ['master', 'assist1', 'assist2'].reduce((sum, pos) => {
            return sum + (state?.selectedPotentials?.[pos]?.length || 0);
        }, 0);
        
        // Count specific potentials
        const specificPotentials = ['master', 'assist1', 'assist2'].reduce((sum, pos) => {
            const potentials = state?.selectedPotentials?.[pos] || [];
            return sum + potentials.filter(potId => {
                const itemData = state?.items?.[potId];
                return itemData && itemData.Stype === 42;
            }).length;
        }, 0);
        
        // Calculate average potential level
        let totalLevels = 0;
        let levelCount = 0;
        
        ['master', 'assist1', 'assist2'].forEach(pos => {
            const potentials = state?.selectedPotentials?.[pos] || [];
            potentials.forEach(potId => {
                const level = state?.potentialLevels?.[pos]?.[potId] || 6;
                totalLevels += level;
                levelCount++;
            });
        });
        
        const avgLevel = levelCount > 0 ? (totalLevels / levelCount).toFixed(1) : 0;
        
        return `
            <div class="build-stat-card">
                <div class="build-stat-icon">⚡</div>
                <div class="build-stat-info">
                    <span class="build-stat-label">총 잠재력</span>
                    <span class="build-stat-value">${totalPotentials}</span>
                </div>
            </div>
            <div class="build-stat-card">
                <div class="build-stat-icon">🎯</div>
                <div class="build-stat-info">
                    <span class="build-stat-label">특성 잠재력</span>
                    <span class="build-stat-value">${specificPotentials}</span>
                </div>
            </div>
            <div class="build-stat-card">
                <div class="build-stat-icon">💿</div>
                <div class="build-stat-info">
                    <span class="build-stat-label">음반 장착</span>
                    <span class="build-stat-value">0/18</span>
                </div>
            </div>
            <div class="build-stat-card">
                <div class="build-stat-icon">📊</div>
                <div class="build-stat-info">
                    <span class="build-stat-label">평균 레벨</span>
                    <span class="build-stat-value">${avgLevel}</span>
                </div>
            </div>
        `;
    }
    
    // Update summary (called when switching to summary tab)
    function updateSummary() {
        console.log('updateSummary called!');
        renderSummary();
    }
    
    // Export build as JSON
    function exportBuild() {
        const buildData = {
            party: state?.party || {},
            selectedPotentials: state?.selectedPotentials || {},
            potentialLevels: state?.potentialLevels || {},
            skillLevels: state?.skillLevels || {},
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
            party: state?.party || {},
            selectedPotentials: state?.selectedPotentials || {},
            potentialLevels: state?.potentialLevels || {},
            skillLevels: state?.skillLevels || {}
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
            const character = state?.party?.[position];
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
                if (skillId && state?.skills?.[skillId]) {
                    const skillData = state.skills[skillId];
                    const titleKey = skillData.Title;
                    const skillName = state?.skillNames?.[titleKey] || label;
                    const level = state?.skillLevels?.[position]?.[skillId] || 1;
                    text += `    - ${skillName}: Lv.${level}\n`;
                }
            });
            
            // Potentials
            const potentials = state?.selectedPotentials?.[position] || [];
            if (potentials.length > 0) {
                text += '  잠재력:\n';
                potentials.forEach(potId => {
                    const potential = state?.potentials?.[potId];
                    if (potential) {
                        const briefDescKey = potential.BriefDesc;
                        const itemKey = briefDescKey ? briefDescKey.replace('Potential.', 'Item.') : null;
                        const potName = itemKey ? (state?.itemNames?.[itemKey] || `Potential ${potId}`) : `Potential ${potId}`;
                        const level = state?.potentialLevels?.[position]?.[potId] || 1;
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
    
    // Don't auto-render on page load - wait for tab switch
    // renderSummary will be called by switchMainTab() when user clicks summary tab
})();
