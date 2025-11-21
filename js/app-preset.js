// Preset Builds Tab Module
// Handles preset build browsing and loading

(function() {
    'use strict';

    // State for preset filtering
    let currentElementFilter = 'all';
    let currentTagFilters = new Set(); // Active tag filters
    let allTags = new Set(); // All available tags

    // Pagination state
    const ITEMS_PER_PAGE = 9;
    let currentPage = 1;
    let allPresetsData = []; // Store all presets
    let elementsData = {}; // Store elements data

    // Element order for sorting
    const ELEMENT_ORDER = ['Water', 'Fire', 'Earth', 'Wind', 'Light', 'Dark', 'Normal'];

    /**
     * Extract build hash from full URL
     * @param {string} urlOrHash - Full URL or just hash string
     * @returns {string} - Extracted hash
     */
    function extractHashFromUrl(urlOrHash) {
        if (!urlOrHash) return '';

        // Check if it's already just a hash (backwards compatibility)
        if (!urlOrHash.includes('://') && !urlOrHash.includes('#')) {
            return urlOrHash;
        }

        // Extract hash from full URL (after #build=)
        const match = urlOrHash.match(/[#&]build=([^&]+)/);
        if (match && match[1]) {
            return match[1];
        }

        // Fallback: return as-is
        return urlOrHash;
    }

    /**
     * Get filtered presets based on current filters
     */
    function getFilteredPresets() {
        return allPresetsData.filter(preset => {
            const tags = preset.tags || [];

            // Check element filter
            const elementMatch = currentElementFilter === 'all' || preset.element === currentElementFilter;

            // Check tag filters (if any tags selected, card must have ALL selected tags)
            const tagMatch = currentTagFilters.size === 0 ||
                [...currentTagFilters].every(tag => tags.includes(tag));

            return elementMatch && tagMatch;
        });
    }

    /**
     * Get paginated presets
     */
    function getPaginatedPresets(filtered) {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return filtered.slice(startIndex, endIndex);
    }

    /**
     * Calculate total pages
     */
    function getTotalPages(filtered) {
        return Math.ceil(filtered.length / ITEMS_PER_PAGE);
    }

    /**
     * Render preset cards for current page
     */
    function renderPresetCards(presets) {
        const grid = document.querySelector('.preset-builds-grid');
        if (!grid) return;

        let html = '';

        presets.forEach(preset => {
            const element = elementsData[preset.element] || { name: preset.element, iconPath: '', color: '#95a5a6' };
            const tags = preset.tags || [];

            let thumbnailPath = '';
            if (preset.characterId) {
                const fullId = `${preset.characterId}01`;
                thumbnailPath = `assets/char/head_${fullId}_GC.png`;
            }

            html += `
                <div class="preset-card" data-preset-id="${preset.id}" data-element="${preset.element || 'all'}" data-tags="${tags.join(',')}">
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
                            ${preset.new ? '<span class="preset-new-badge">NEW</span>' : ''}
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
                                data-build-url="${preset.buildUrl || preset.buildHash || ''}"
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

        grid.innerHTML = html;
    }

    /**
     * Render pagination UI
     */
    function renderPagination(totalItems, totalPages) {
        const container = document.querySelector('.preset-pagination');
        if (!container) return;

        if (totalPages <= 1) {
            container.innerHTML = `<span class="pagination-info">총 ${totalItems}개의 빌드</span>`;
            return;
        }

        let html = '';

        // Previous button
        html += `<button class="pagination-btn pagination-prev ${currentPage === 1 ? 'disabled' : ''}"
                    onclick="goToPresetPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-left"></i>
                </button>`;

        // Page numbers
        html += '<div class="pagination-numbers">';

        // Always show first page
        if (currentPage > 3) {
            html += `<button class="pagination-num" onclick="goToPresetPage(1)">1</button>`;
            if (currentPage > 4) {
                html += `<span class="pagination-ellipsis">...</span>`;
            }
        }

        // Show pages around current
        for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
            html += `<button class="pagination-num ${i === currentPage ? 'active' : ''}" onclick="goToPresetPage(${i})">${i}</button>`;
        }

        // Always show last page
        if (currentPage < totalPages - 2) {
            if (currentPage < totalPages - 3) {
                html += `<span class="pagination-ellipsis">...</span>`;
            }
            html += `<button class="pagination-num" onclick="goToPresetPage(${totalPages})">${totalPages}</button>`;
        }

        html += '</div>';

        // Next button
        html += `<button class="pagination-btn pagination-next ${currentPage === totalPages ? 'disabled' : ''}"
                    onclick="goToPresetPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-right"></i>
                </button>`;

        // Info
        html += `<span class="pagination-info">${(currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} / ${totalItems}</span>`;

        container.innerHTML = html;
    }

    /**
     * Apply filters and update display with pagination
     */
    function applyFilters() {
        currentPage = 1; // Reset to first page on filter change
        updateDisplay();
    }

    /**
     * Update display (cards + pagination)
     */
    function updateDisplay() {
        const filtered = getFilteredPresets();
        const totalPages = getTotalPages(filtered);
        const paginated = getPaginatedPresets(filtered);

        renderPresetCards(paginated);
        renderPagination(filtered.length, totalPages);
    }

    /**
     * Go to specific page
     */
    window.goToPresetPage = function(page) {
        const filtered = getFilteredPresets();
        const totalPages = getTotalPages(filtered);

        if (page < 1 || page > totalPages) return;

        currentPage = page;
        updateDisplay();

        // Scroll to top of preset section
        const section = document.querySelector('.preset-builds-section');
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    /**
     * Filter presets by element
     */
    window.filterPresetsByElement = function(element) {
        currentElementFilter = element;
        const filterBtns = document.querySelectorAll('.element-filter-btn');

        // Update active button
        filterBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.element === element);
        });

        applyFilters();
    };

    /**
     * Toggle tag filter
     */
    window.toggleTagFilter = function(tag) {
        const btn = document.querySelector(`.tag-filter-btn[data-tag="${tag}"]`);

        if (currentTagFilters.has(tag)) {
            currentTagFilters.delete(tag);
            if (btn) btn.classList.remove('active');
        } else {
            currentTagFilters.add(tag);
            if (btn) btn.classList.add('active');
        }

        applyFilters();
    };

    /**
     * Clear all tag filters
     */
    window.clearTagFilters = function() {
        currentTagFilters.clear();
        document.querySelectorAll('.tag-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        applyFilters();
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
            const buildUrl = btn.dataset.buildUrl;
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
                        // Extract hash from full URL
                        const buildHash = extractHashFromUrl(buildUrl);
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
     * Sort presets: new → meta → others, each group sorted by element order
     */
    function sortPresets(presets) {
        return [...presets].sort((a, b) => {
            // Priority: new (3) > meta (2) > others (1)
            const getPriority = (preset) => {
                if (preset.new) return 3;
                if (preset.meta) return 2;
                return 1;
            };

            const priorityA = getPriority(a);
            const priorityB = getPriority(b);

            // Sort by priority first (descending)
            if (priorityA !== priorityB) {
                return priorityB - priorityA;
            }

            // Then sort by element order
            const elementIndexA = ELEMENT_ORDER.indexOf(a.element) !== -1 ? ELEMENT_ORDER.indexOf(a.element) : 999;
            const elementIndexB = ELEMENT_ORDER.indexOf(b.element) !== -1 ? ELEMENT_ORDER.indexOf(b.element) : 999;

            return elementIndexA - elementIndexB;
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

        // Reset filter and pagination state
        currentElementFilter = 'all';
        currentTagFilters.clear();
        allTags.clear();
        currentPage = 1;

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

            // Store data for pagination
            elementsData = presetData.elements || {};
            allPresetsData = sortPresets(presetData.presets);

            // Collect all unique tags
            allPresetsData.forEach(preset => {
                (preset.tags || []).forEach(tag => allTags.add(tag));
            });

            let html = '<div class="preset-layout"><div class="preset-builds-section">';

            // Filters section
            html += '<div class="preset-filters-section">';

            // Element filters
            html += '<div class="preset-filter-group">';
            html += '<span class="filter-group-label">속성별로 찾기</span>';
            html += '<div class="preset-filters">';
            html += '<button class="element-filter-btn active" data-element="all" onclick="filterPresetsByElement(\'all\')">전체</button>';

            Object.keys(elementsData).forEach(elementKey => {
                const element = elementsData[elementKey];
                html += `
                    <button class="element-filter-btn" data-element="${elementKey}" onclick="filterPresetsByElement('${elementKey}')">
                        <img src="${element.iconPath}" class="element-filter-icon" alt="${element.name}" onerror="this.style.display='none'" />
                        ${element.name}
                    </button>
                `;
            });
            html += '</div></div>';

            // Tag filters
            if (allTags.size > 0) {
                html += '<div class="preset-filter-group">';
                html += '<span class="filter-group-label">태그로 찾기</span>';
                html += '<div class="tag-filter-buttons">';
                [...allTags].sort().forEach(tag => {
                    html += `<button class="tag-filter-btn" data-tag="${tag}" onclick="toggleTagFilter('${tag}')">${tag}</button>`;
                });
                html += `<button class="tag-filter-clear" onclick="clearTagFilters()">선택 초기화</button>`;
                html += '</div></div>';
            }

            html += '</div>'; // Close preset-filters-section

            // Preset cards grid (empty - will be populated by updateDisplay)
            html += '<div class="preset-builds-grid"></div>';

            // Pagination container
            html += '<div class="preset-pagination"></div>';

            html += '</div></div>'; // Close preset-builds-section, preset-layout
            container.innerHTML = html;

            // Initial render with pagination
            updateDisplay();

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

    // Listen for language changes
    window.addEventListener('languageChanged', async (event) => {
        console.log('[App-Preset] Language changed, re-rendering presets');
        // Re-render presets if container exists and has been rendered
        const presetContainer = document.getElementById('preset-container');
        if (presetContainer && presetContainer.innerHTML) {
            await renderPresets();
        }
    });

    // Export functions
    window.renderPresets = renderPresets;

})();
