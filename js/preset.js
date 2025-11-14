// Preset Builds Tab Module
// Handles preset build browsing and loading

(function() {
    'use strict';

    // State for preset filtering
    let currentElementFilter = 'all';

    /**
     * Filter presets by element
     */
    window.filterPresetsByElement = function(element) {
        currentElementFilter = element;
        const cards = document.querySelectorAll('.preset-card');
        const filterBtns = document.querySelectorAll('.element-filter-btn');

        // Update active button
        filterBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.element === element);
        });

        // Filter cards
        cards.forEach(card => {
            if (element === 'all' || card.dataset.element === element) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    };

    /**
     * Setup preset load button event delegation
     * Implements two-step confirmation + smooth loading animation
     */
    function setupPresetLoadButtons() {
        document.addEventListener('click', function(e) {
            const btn = e.target.closest('.preset-load-btn');
            if (!btn) return;

            const confirmState = btn.dataset.confirmState;
            const buildHash = btn.dataset.buildHash;
            const buildTitle = btn.dataset.buildTitle;

            if (confirmState === 'initial') {
                // First click - Show confirmation
                btn.dataset.confirmState = 'confirm';
                btn.textContent = '불러오기';
                btn.style.background = '#e67e22'; // Orange warning color

                // Auto-revert after 3 seconds
                setTimeout(() => {
                    if (btn.dataset.confirmState === 'confirm') {
                        btn.dataset.confirmState = 'initial';
                        btn.textContent = '보러가기';
                        btn.style.background = '';
                    }
                }, 3000);

            } else if (confirmState === 'confirm') {
                // Second click - Actually load with animation
                btn.dataset.confirmState = 'loading';
                btn.innerHTML = '<span class="loading-spinner">⏳</span>';
                btn.disabled = true;

                // Smooth fade-out transition
                const presetContainer = document.getElementById('preset-container');
                if (presetContainer) {
                    presetContainer.style.transition = 'opacity 0.3s ease';
                    presetContainer.style.opacity = '0.3';
                }

                // Load the preset after brief delay
                setTimeout(() => {
                    try {
                        window.loadPresetBuild(buildHash, buildTitle);

                        // Fade back in
                        if (presetContainer) {
                            presetContainer.style.opacity = '1';
                        }

                        // Reset button state
                        btn.dataset.confirmState = 'initial';
                        btn.textContent = '보러가기';
                        btn.disabled = false;
                        btn.style.background = '';

                        // Switch to summary tab to see the loaded build
                        setTimeout(() => {
                            if (typeof window.switchMainTab === 'function') {
                                window.switchMainTab('summary');
                            }
                        }, 500);

                    } catch (error) {
                        console.error('Error loading preset:', error);
                        if (presetContainer) {
                            presetContainer.style.opacity = '1';
                        }
                        btn.dataset.confirmState = 'initial';
                        btn.textContent = '실패';
                        btn.disabled = false;
                        btn.style.background = '#e74c3c';

                        setTimeout(() => {
                            btn.textContent = '보러가기';
                            btn.style.background = '';
                        }, 2000);
                    }
                }, 400);
            }
        });
    }

    /**
     * Render preset builds tab content
     */
    async function renderPresets() {
        console.log('[Preset] renderPresets called');
        const container = document.getElementById('preset-container');
        if (!container) {
            console.error('[Preset] Container #preset-container not found');
            return;
        }

        console.log('[Preset] Container found, loading preset data...');

        try {
            const presetData = await window.loadPresetBuilds();
            console.log('[Preset] Data loaded:', presetData);

            if (!presetData || !presetData.presets || presetData.presets.length === 0) {
                container.innerHTML = `
                    <div class="preset-empty-state">
                        <div class="empty-icon">🌟</div>
                        <h3>프리셋 빌드가 없습니다</h3>
                        <p>data/PresetBuilds.json에 프리셋을 추가하세요</p>
                    </div>
                `;
                return;
            }

            const elements = presetData.elements || {};
            const presets = presetData.presets;

            let html = '<div class="preset-layout"><div class="preset-builds-section">';

            // Header with filters
            html += '<div class="preset-header">';
            html += '<h2 class="preset-main-title">🌟 추천 빌드</h2>';
            html += '<div class="preset-filters">';
            html += '<button class="element-filter-btn active" data-element="all" onclick="filterPresetsByElement(\'all\')">전체</button>';

            Object.keys(elements).forEach(elementKey => {
                const element = elements[elementKey];
                html += `
                    <button class="element-filter-btn" data-element="${elementKey}" onclick="filterPresetsByElement('${elementKey}')">
                        <img src="${element.iconPath}" class="element-filter-icon" alt="${element.name}" onerror="this.style.display='none'" />
                        ${element.name}
                    </button>
                `;
            });
            html += '</div></div>';

            // Preset cards grid
            html += '<div class="preset-builds-grid">';

            presets.forEach(preset => {
                const element = elements[preset.element] || { name: preset.element, iconPath: '', color: '#95a5a6' };
                const tags = preset.tags || [];

                // Generate thumbnail path from characterId
                // Input: 144 (3 digits) -> Output: assets/char/head_14401_GC.png
                let thumbnailPath = '';
                if (preset.characterId) {
                    const fullId = `${preset.characterId}01`;
                    thumbnailPath = `assets/char/head_${fullId}_GC.png`;
                }

                html += `
                    <div class="preset-card" data-preset-id="${preset.id}" data-element="${preset.element || 'all'}">
                        ${thumbnailPath ? `
                            <div class="preset-thumbnail">
                                <img src="${thumbnailPath}" alt="${preset.title}" onerror="this.parentElement.style.display='none'" />
                            </div>
                        ` : ''}
                        <div class="preset-info">
                            <div class="preset-header-inline">
                                <span class="preset-element-tag" style="background-color: ${element.color}">
                                    <img src="${element.iconPath}" class="element-tag-icon" alt="${element.name}" onerror="this.style.display='none'" />
                                    ${element.name}
                                </span>
                                ${preset.meta ? '<span class="preset-meta-badge">메타</span>' : ''}
                            </div>
                            <h4 class="preset-title">${preset.title}</h4>
                            <p class="preset-description">${preset.description || ''}</p>
                            ${tags.length > 0 ? `
                                <div class="preset-tags">
                                    ${tags.map(tag => `<span class="preset-tag">${tag}</span>`).join('')}
                                </div>
                            ` : ''}
                            <div class="preset-footer">
                                ${preset.authorLink ? `
                                    <a href="${preset.authorLink}" target="_blank" rel="noopener" class="preset-author-link">
                                        <span class="author-icon">👤</span>
                                        <span>${preset.author || '익명'}</span>
                                        <span class="external-icon">🔗</span>
                                    </a>
                                ` : `
                                    <span class="preset-author">
                                        <span class="author-icon">👤</span>
                                        ${preset.author || '익명'}
                                    </span>
                                `}
                                <button
                                    class="preset-load-btn"
                                    data-build-hash="${preset.buildHash}"
                                    data-build-title="${preset.title}"
                                    data-confirm-state="initial"
                                >
                                    보러가기
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += '</div></div></div>'; // Close preset-builds-grid, preset-builds-section, preset-layout
            container.innerHTML = html;

        } catch (error) {
            console.error('Error rendering preset builds:', error);
            container.innerHTML = `
                <div class="preset-error-state">
                    <div class="error-icon">⚠️</div>
                    <h3>프리셋 불러오기 실패</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    // Initialize preset tab
    function initPresetTab() {
        setupPresetLoadButtons();
        console.log('[Preset] Tab initialized');
    }

    // Setup on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPresetTab);
    } else {
        initPresetTab();
    }

    // Export functions
    window.renderPresets = renderPresets;

})();
