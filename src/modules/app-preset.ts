/**
 * @module app-preset
 * @description Preset Builds Module - Browse, filter, and load community-contributed preset builds
 *
 * **Features:**
 * - Preset Browsing: Paginated grid (9 items/page) with element badges, NEW/Meta tags
 * - Tag System: Live search, preset counts per tag, active/available sections
 * - Element Filtering: Filter by Water/Fire/Earth/Wind/Light/Dark/Normal
 * - Two-step Load: View (1st click) → Load (2nd click) with confirmation + animation
 * - Info Banner: Last updated, Boss Rush, Joint Drill, total builds count
 *
 * **Architecture:**
 * - Full event delegation (no window function pollution)
 * - Tag search with real-time filtering
 * - Smooth page transitions with scroll-to-top
 * - Preset sorting: NEW → Meta → Others, each group sorted by element order
 *
 * @see {@link https://github.com/JforPlay/sstoy} - Project Repository
 */

import { log, onLanguageChange, createResponsiveImage } from '../shared';
import type { MainTab } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface ElementData {
  name: string;
  iconPath: string;
  color: string;
}

interface PresetBuild {
  id: string;
  title: string;
  description?: string;
  author?: string;
  authorLink?: string;
  element: string;
  characterId?: string;
  tags?: string[];
  buildUrl?: string;
  buildHash?: string;
  new?: boolean;
  meta?: boolean;
}

interface PresetMetadata {
  lastUpdated?: string;
  bossRush?: string;
  jointDrill?: string;
  totalBuilds?: number;
  notes?: string;
}

interface PresetData {
  presets: PresetBuild[];
  elements?: Record<string, ElementData>;
  metadata?: PresetMetadata;
}

// Global function declarations - defined in types/index.ts

// =============================================================================
// CONSTANTS
// =============================================================================

const ITEMS_PER_PAGE = 9;
const ELEMENT_ORDER = ['Water', 'Fire', 'Earth', 'Wind', 'Light', 'Dark', 'Normal'];

const CATEGORY_FILES = {
  meta: 'PresetBuilds_Meta.json',
  arena: 'PresetBuilds_Arena.json',
  general: 'PresetBuilds_General.json',
  meta_backup: 'PresetBuilds_MetaBackup.json',
} as const;

const CATEGORY_LABELS = {
  meta: '연합/종언용',
  arena: '아레나/전선용',
  general: '범용/대체용',
  meta_backup: '오래된 메타덱들 백업용',
} as const;

type PresetCategory = keyof typeof CATEGORY_FILES;

// =============================================================================
// STATE
// =============================================================================

let currentCategory: PresetCategory = 'meta';
let currentElementFilter = 'all';
let currentTagFilters = new Set<string>();
let allTags = new Set<string>();
let tagSearchQuery = '';
let currentPage = 1;
let allPresetsData: PresetBuild[] = [];
let elementsData: Record<string, ElementData> = {};
let categoryMetadata: PresetMetadata | undefined;
let categoryCounts: Map<PresetCategory, number> = new Map();

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Extract build hash from full URL
 */
function extractHashFromUrl(urlOrHash: string): string {
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
function getFilteredPresets(): PresetBuild[] {
  return allPresetsData.filter((preset) => {
    const tags = preset.tags || [];

    // Check element filter
    const elementMatch = currentElementFilter === 'all' || preset.element === currentElementFilter;

    // Check tag filters (if any tags selected, card must have ALL selected tags)
    const tagMatch =
      currentTagFilters.size === 0 || [...currentTagFilters].every((tag) => tags.includes(tag));

    return elementMatch && tagMatch;
  });
}

/**
 * Get paginated presets
 */
function getPaginatedPresets(filtered: PresetBuild[]): PresetBuild[] {
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  return filtered.slice(startIndex, endIndex);
}

/**
 * Calculate total pages
 */
function getTotalPages(filtered: PresetBuild[]): number {
  return Math.ceil(filtered.length / ITEMS_PER_PAGE);
}

/**
 * Generate info container HTML
 */
function generateInfoContainer(metadata: PresetMetadata | undefined, totalPresets: number): string {
  if (!metadata) return '';

  const actualTotal = metadata.totalBuilds === 0 ? totalPresets : metadata.totalBuilds;

  return `
    <div class="preset-info-banner">
      <div class="preset-info-grid">
        <div class="preset-info-item">
          <div class="preset-info-item-icon">
            <i class="fa-regular fa-calendar-days"></i>
          </div>
          <div class="preset-info-item-content">
            <div class="preset-info-item-label">${window.i18n?.t('preset.lastUpdated') || '최근 업데이트'}</div>
            <div class="preset-info-item-value">${metadata.lastUpdated || 'N/A'}</div>
          </div>
        </div>

        ${metadata.bossRush ? `
        <div class="preset-info-item">
          <div class="preset-info-item-icon">
            <i class="fa-solid fa-users"></i>
          </div>
          <div class="preset-info-item-content">
            <div class="preset-info-item-label">${window.i18n?.t('preset.bossRush') || '연합토벌'}</div>
            <div class="preset-info-item-value">${metadata.bossRush}</div>
          </div>
        </div>
        ` : ''}

        ${metadata.jointDrill ? `
        <div class="preset-info-item">
          <div class="preset-info-item-icon">
            <i class="fa-solid fa-skull-crossbones"></i>
          </div>
          <div class="preset-info-item-content">
            <div class="preset-info-item-label">${window.i18n?.t('preset.jointDrill') || '종언'}</div>
            <div class="preset-info-item-value">${metadata.jointDrill}</div>
          </div>
        </div>
        ` : ''}

        <div class="preset-info-item">
          <div class="preset-info-item-icon">
            <i class="fa-solid fa-layer-group"></i>
          </div>
          <div class="preset-info-item-content">
            <div class="preset-info-item-label">${window.i18n?.t('preset.totalBuilds') || '총 빌드 수'}</div>
            <div class="preset-info-item-value">${actualTotal}개</div>
          </div>
        </div>
      </div>

      ${metadata.notes ? `
      <div class="preset-info-note">
        <i class="fa-solid fa-circle-info"></i>
        <span>${metadata.notes}</span>
      </div>
      ` : ''}
    </div>
  `;
}

/**
 * Sort presets: new then meta then others, each group sorted by element order
 */
function sortPresets(presets: PresetBuild[]): PresetBuild[] {
  return [...presets].sort((a, b) => {
    const getPriority = (preset: PresetBuild): number => {
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
    const elementIndexA =
      ELEMENT_ORDER.indexOf(a.element) !== -1 ? ELEMENT_ORDER.indexOf(a.element) : 999;
    const elementIndexB =
      ELEMENT_ORDER.indexOf(b.element) !== -1 ? ELEMENT_ORDER.indexOf(b.element) : 999;

    return elementIndexA - elementIndexB;
  });
}

/**
 * Get count of presets for each tag
 */
function getTagCounts(): Map<string, number> {
  const tagCounts = new Map<string, number>();
  allPresetsData.forEach((preset) => {
    (preset.tags || []).forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  return tagCounts;
}

/**
 * Filter tags based on search query
 */
function getFilteredTags(): string[] {
  const query = tagSearchQuery.toLowerCase().trim();
  if (!query) {
    return [...allTags].sort();
  }
  return [...allTags].filter((tag) => tag.toLowerCase().includes(query)).sort();
}

/**
 * Preload counts for all categories (lightweight - only fetches preset count)
 */
async function preloadCategoryCounts(): Promise<void> {
  const categories: PresetCategory[] = ['meta', 'arena', 'general', 'meta_backup'];

  // Load counts in parallel
  await Promise.all(
    categories.map(async (category) => {
      try {
        const filePath = CATEGORY_FILES[category];
        const data = (await window.loadPresetBuilds?.(filePath)) as PresetData | undefined;
        if (data && data.presets) {
          categoryCounts.set(category, data.presets.length);
        }
      } catch (error) {
        log(`[Preset] Failed to load count for ${category}`);
        categoryCounts.set(category, 0);
      }
    })
  );
}

/**
 * Get count of presets for a specific category
 */
function getCategoryCount(category: PresetCategory): number {
  return categoryCounts.get(category) || 0;
}

// =============================================================================
// RENDERING
// =============================================================================

/**
 * Render category tabs
 */
function renderCategoryTabs(): string {
  const categories: PresetCategory[] = ['meta', 'arena', 'general', 'meta_backup'];

  let html = '<div class="preset-category-tabs">';

  categories.forEach((category) => {
    const isActive = category === currentCategory;
    const count = getCategoryCount(category);

    html += `
      <button
        class="category-tab ${isActive ? 'active' : ''}"
        data-category="${category}"
      >
        ${CATEGORY_LABELS[category]}
        <span class="category-count">(${count})</span>
      </button>
    `;
  });

  html += '</div>';
  return html;
}

/**
 * Render preset cards for current page
 */
function renderPresetCards(presets: PresetBuild[]): void {
  const grid = document.querySelector('.preset-builds-grid');
  if (!grid) return;

  let html = '';

  presets.forEach((preset) => {
    const element = elementsData[preset.element] || {
      name: preset.element,
      iconPath: '',
      color: '#95a5a6',
    };
    const tags = preset.tags || [];

    let thumbnailPath = '';
    if (preset.characterId) {
      const fullId = `${preset.characterId}01`;
      thumbnailPath = `assets/char/head_${fullId}_GC.png`;
    }

    html += `
      <div class="preset-card" data-preset-id="${preset.id}" data-element="${preset.element || 'all'}" data-tags="${tags.join(',')}">
        ${
          thumbnailPath
            ? `
          <div class="preset-thumbnail">
            ${createResponsiveImage(thumbnailPath, preset.title, 'preset-thumbnail-img')}
          </div>
        `
            : ''
        }
        <div class="preset-info">
          <div class="preset-header-inline">
            <span class="preset-element-tag" style="background-color: ${element.color}">
              ${createResponsiveImage(element.iconPath, element.name, 'element-tag-icon')}
              ${element.name}
            </span>
            ${preset.new ? '<span class="preset-new-badge">NEW</span>' : ''}
            ${preset.meta ? `<span class="preset-meta-badge">${window.i18n?.t('preset.meta') || 'Meta'}</span>` : ''}
          </div>
          <h4 class="preset-title">${preset.title}</h4>
          <p class="preset-description">${preset.description || ''}</p>
          ${
            tags.length > 0
              ? `
            <div class="preset-tags">
              ${tags.map((tag) => `<span class="preset-tag">${tag}</span>`).join('')}
            </div>
          `
              : ''
          }
          <div class="preset-footer">
            ${
              preset.authorLink
                ? `
              <a href="${preset.authorLink}" target="_blank" rel="noopener" class="preset-author-link">
                <span class="author-icon">@</span>
                <span>${preset.author || (window.i18n?.t('preset.anonymous') || 'Anonymous')}</span>
                <span class="external-icon">&nearr;</span>
              </a>
            `
                : `
              <span class="preset-author">
                <span class="author-icon">@</span>
                ${preset.author || (window.i18n?.t('preset.anonymous') || 'Anonymous')}
              </span>
            `
            }
            <button
              class="preset-load-btn"
              data-build-url="${preset.buildUrl || preset.buildHash || ''}"
              data-build-title="${preset.title}"
              data-confirm-state="initial"
            >
              ${window.i18n?.t('preset.viewBuild') || 'View'}
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
function renderPagination(totalItems: number, totalPages: number): void {
  const container = document.querySelector('.preset-pagination');
  if (!container) return;

  if (totalPages <= 1) {
    const countText = (window.i18n?.t('preset.totalBuilds') || '${count} builds total').replace(
      '${count}',
      String(totalItems)
    );
    container.innerHTML = `<span class="pagination-info">${countText}</span>`;
    return;
  }

  let html = '';

  // Previous button
  html += `<button class="pagination-btn pagination-prev ${currentPage === 1 ? 'disabled' : ''}"
              data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
              <i class="fa-solid fa-chevron-left"></i>
          </button>`;

  // Page numbers
  html += '<div class="pagination-numbers">';

  // Always show first page
  if (currentPage > 3) {
    html += `<button class="pagination-num" data-page="1">1</button>`;
    if (currentPage > 4) {
      html += `<span class="pagination-ellipsis">...</span>`;
    }
  }

  // Show pages around current
  for (
    let i = Math.max(1, currentPage - 2);
    i <= Math.min(totalPages, currentPage + 2);
    i++
  ) {
    html += `<button class="pagination-num ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }

  // Always show last page
  if (currentPage < totalPages - 2) {
    if (currentPage < totalPages - 3) {
      html += `<span class="pagination-ellipsis">...</span>`;
    }
    html += `<button class="pagination-num" data-page="${totalPages}">${totalPages}</button>`;
  }

  html += '</div>';

  // Next button
  html += `<button class="pagination-btn pagination-next ${currentPage === totalPages ? 'disabled' : ''}"
              data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
              <i class="fa-solid fa-chevron-right"></i>
          </button>`;

  // Info
  html += `<span class="pagination-info">${(currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} / ${totalItems}</span>`;

  container.innerHTML = html;
}

/**
 * Update display (cards + pagination)
 */
function updateDisplay(): void {
  const filtered = getFilteredPresets();
  const totalPages = getTotalPages(filtered);
  const paginated = getPaginatedPresets(filtered);

  renderPresetCards(paginated);
  renderPagination(filtered.length, totalPages);
}

/**
 * Apply filters and update display with pagination
 */
function applyFilters(): void {
  currentPage = 1;
  updateDisplay();
}

// =============================================================================
// GLOBAL FUNCTIONS
// =============================================================================

/**
 * Go to specific page
 */
export function goToPresetPage(page: number): void {
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
}

/**
 * Filter presets by element (internal)
 */
function filterPresetsByElement(element: string): void {
  currentElementFilter = element;
  const filterBtns = document.querySelectorAll('.element-filter-btn');

  // Update active button
  filterBtns.forEach((btn) => {
    const btnElement = btn as HTMLElement;
    btn.classList.toggle('active', btnElement.dataset.element === element);
  });

  applyFilters();
}

/**
 * Toggle tag filter (internal)
 */
function toggleTagFilter(tag: string): void {
  if (currentTagFilters.has(tag)) {
    currentTagFilters.delete(tag);
  } else {
    currentTagFilters.add(tag);
  }

  renderTagFilters();
  applyFilters();
}

/**
 * Clear all tag filters (internal)
 */
function clearTagFilters(): void {
  currentTagFilters.clear();
  renderTagFilters();
  applyFilters();
}

/**
 * Handle tag search input (internal)
 */
function searchTags(query: string): void {
  tagSearchQuery = query;
  renderTagFilters();
}

/**
 * Render tag filters section
 */
function renderTagFilters(): void {
  const container = document.querySelector('.tag-filter-section-dynamic');
  if (!container) return;

  const filteredTags = getFilteredTags();
  const tagCounts = getTagCounts();

  let html = '';

  // Show active filters if any
  if (currentTagFilters.size > 0) {
    html += '<div class="active-tags-section">';
    html += `<span class="active-tags-label">${window.i18n?.t('preset.activeTags') || 'Active filters'}:</span>`;
    html += '<div class="active-tags-list">';
    [...currentTagFilters].forEach((tag) => {
      const count = tagCounts.get(tag) || 0;
      html += `
        <button class="tag-filter-btn active" data-tag="${tag}">
          ${tag}
          <span class="tag-count">${count}</span>
          <span class="tag-remove">×</span>
        </button>
      `;
    });
    html += '</div></div>';
  }

  // Show available tags
  const availableTags = filteredTags.filter((tag) => !currentTagFilters.has(tag));
  if (availableTags.length > 0) {
    html += '<div class="available-tags-section">';
    html += '<div class="tag-filter-buttons">';
    availableTags.forEach((tag) => {
      const count = tagCounts.get(tag) || 0;
      html += `
        <button class="tag-filter-btn" data-tag="${tag}">
          ${tag}
          <span class="tag-count">${count}</span>
        </button>
      `;
    });
    html += '</div></div>';
  } else if (tagSearchQuery && availableTags.length === 0 && currentTagFilters.size === 0) {
    html += `<div class="no-tags-found">${window.i18n?.t('preset.noTagsFound') || 'No tags found'}</div>`;
  }

  container.innerHTML = html;
}

// =============================================================================
// CATEGORY SWITCHING
// =============================================================================

/**
 * Switch to a different preset category
 */
async function switchCategory(category: PresetCategory): Promise<void> {
  if (category === currentCategory) return;

  log(`[Preset] Switching to category: ${category}`);
  currentCategory = category;

  // Reset filters and pagination
  currentElementFilter = 'all';
  currentTagFilters.clear();
  allTags.clear();
  tagSearchQuery = '';
  currentPage = 1;

  // Show loading state
  const container = document.getElementById('preset-container');
  if (container) {
    container.style.transition = 'opacity 0.3s ease';
    container.style.opacity = '0.5';
  }

  // Load category data
  try {
    const filePath = CATEGORY_FILES[category];
    const presetData = (await window.loadPresetBuilds?.(filePath)) as PresetData | undefined;

    if (!presetData || !presetData.presets) {
      throw new Error('Invalid preset data');
    }

    // Update global data
    elementsData = presetData.elements || {};
    allPresetsData = sortPresets(presetData.presets);
    categoryMetadata = presetData.metadata;

    // Update count for this category
    categoryCounts.set(category, allPresetsData.length);

    // Collect tags
    allPresetsData.forEach((preset) => {
      (preset.tags || []).forEach((tag) => allTags.add(tag));
    });

    // Re-render entire tab
    await renderPresetsContent();

    if (container) {
      container.style.opacity = '1';
    }

    log(`[Preset] Category switched successfully: ${allPresetsData.length} builds loaded`);
  } catch (error) {
    console.error(`Error loading category ${category}:`, error);
    if (container) {
      container.style.opacity = '1';
    }
  }
}

/**
 * Render preset content (without re-fetching initial data)
 */
async function renderPresetsContent(): Promise<void> {
  const container = document.getElementById('preset-container');
  if (!container) return;

  let html = '<div class="preset-layout">';

  // Add category tabs at the top
  html += renderCategoryTabs();

  // Info container
  html += generateInfoContainer(categoryMetadata, allPresetsData.length);

  html += '<div class="preset-builds-section">';

  // Filters section
  html += '<div class="preset-filters-section">';

  // Element filters
  html += '<div class="preset-filter-group">';
  html += `<span class="filter-group-label">${window.i18n?.t('preset.filterByElement') || 'Filter by Element'}</span>`;
  html += '<div class="preset-filters">';
  html += `<button class="element-filter-btn active" data-element="all">${window.i18n?.t('disc.allElements') || 'All'}</button>`;

  Object.keys(elementsData).forEach((elementKey) => {
    const element = elementsData[elementKey];
    if (!element) return;
    html += `
      <button class="element-filter-btn" data-element="${elementKey}">
        ${createResponsiveImage(element.iconPath, element.name, 'element-filter-icon')}
        ${element.name}
      </button>
    `;
  });
  html += '</div></div>';

  // Tag filters
  if (allTags.size > 0) {
    html += '<div class="preset-filter-group tag-filter-group">';
    html += '<div class="tag-filter-header">';
    html += `<span class="filter-group-label">${window.i18n?.t('preset.filterByTag') || 'Filter by Tag'}</span>`;
    html += '<div class="tag-search-wrapper">';
    html += `<input type="text"
      class="tag-search-input"
      placeholder="${window.i18n?.t('preset.searchTags') || 'Search tags...'}"
    />`;
    html += '<i class="fa-solid fa-search tag-search-icon"></i>';
    html += '</div>';
    html += `<button class="tag-filter-clear">${window.i18n?.t('preset.clearFilters') || 'Clear All'}</button>`;
    html += '</div>';
    html += '<div class="tag-filter-section-dynamic"></div>';
    html += '</div>';
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

  // Render tag filters
  renderTagFilters();
}

// =============================================================================
// PRESET LOAD BUTTONS
// =============================================================================

/**
 * Setup all event delegation for the preset tab
 */
function setupEventDelegation(): void {
  // Use single event listener on document for all preset interactions
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Category tab buttons
    const categoryTab = target.closest('.category-tab') as HTMLElement | null;
    if (categoryTab && !categoryTab.classList.contains('active')) {
      const category = categoryTab.dataset.category as PresetCategory;
      if (category) {
        switchCategory(category);
      }
      return;
    }

    // Element filter buttons
    const elementBtn = target.closest('.element-filter-btn') as HTMLElement | null;
    if (elementBtn) {
      const element = elementBtn.dataset.element;
      if (element) filterPresetsByElement(element);
      return;
    }

    // Tag filter buttons
    const tagBtn = target.closest('.tag-filter-btn') as HTMLElement | null;
    if (tagBtn) {
      const tag = tagBtn.dataset.tag;
      if (tag) toggleTagFilter(tag);
      return;
    }

    // Clear filters button
    const clearBtn = target.closest('.tag-filter-clear');
    if (clearBtn) {
      clearTagFilters();
      return;
    }

    // Pagination buttons
    const paginationBtn = target.closest('.pagination-btn, .pagination-num') as HTMLElement | null;
    if (paginationBtn && !paginationBtn.classList.contains('disabled')) {
      const page = parseInt(paginationBtn.dataset.page || '0');
      if (page > 0) goToPresetPage(page);
      return;
    }

    // Preset load buttons
    const loadBtn = target.closest('.preset-load-btn') as HTMLButtonElement | null;
    if (loadBtn) {
      handlePresetLoadClick(loadBtn);
      return;
    }
  });

  // Tag search input
  document.addEventListener('input', (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('tag-search-input')) {
      searchTags((target as HTMLInputElement).value);
    }
  });
}

/**
 * Handle preset load button click with two-step confirmation
 */
function handlePresetLoadClick(btn: HTMLButtonElement): void {
  const confirmState = btn.dataset.confirmState;
  const buildUrl = btn.dataset.buildUrl || '';
  const buildTitle = btn.dataset.buildTitle || '';

  if (confirmState === 'initial') {
    // First click - Show confirmation
    btn.dataset.confirmState = 'confirm';
    btn.textContent = window.i18n?.t('preset.loadBuild') || 'Load';
    btn.style.background = '#e67e22';

    // Auto-revert after 3 seconds
    setTimeout(() => {
      if (btn.dataset.confirmState === 'confirm') {
        btn.dataset.confirmState = 'initial';
        btn.textContent = window.i18n?.t('preset.viewBuild') || 'View';
        btn.style.background = '';
      }
    }, 3000);
  } else if (confirmState === 'confirm') {
    // Second click - Actually load with animation
    btn.dataset.confirmState = 'loading';
    btn.innerHTML = '<span class="loading-spinner">...</span>';
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
        window.loadPresetBuild?.(buildHash, buildTitle);

        // Fade back in
        if (presetContainer) {
          presetContainer.style.opacity = '1';
        }

        // Reset button state
        btn.dataset.confirmState = 'initial';
        btn.textContent = window.i18n?.t('preset.viewBuild') || 'View';
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
        btn.textContent = window.i18n?.t('preset.loadFailed') || 'Failed';
        btn.disabled = false;
        btn.style.background = '#e74c3c';

        setTimeout(() => {
          btn.textContent = window.i18n?.t('preset.viewBuild') || 'View';
          btn.style.background = '';
        }, 2000);
      }
    }, 400);
  }
}

// =============================================================================
// MAIN RENDER
// =============================================================================

/**
 * Render the preset builds tab with all filters and pagination
 *
 * @async
 * @returns {Promise<void>}
 *
 * @description
 * Main entry point for preset tab rendering:
 * 1. Load PresetBuilds.json (via window.loadPresetBuilds)
 * 2. Sort presets (NEW → Meta → Others, by element)
 * 3. Generate info banner (last updated, boss rush, joint drill, total builds)
 * 4. Render element filters (all + 7 elements)
 * 5. Render tag filters with search input
 * 6. Display first page of filtered presets
 * 7. Render pagination controls
 *
 * @example
 * ```typescript
 * await renderPresets();
 * // Preset tab now shows paginated grid with filters
 * ```
 */
export async function renderPresets(): Promise<void> {
  console.info('[AppPreset] renderPresets called');
  const container = document.getElementById('preset-container');
  if (!container) {
    console.error('[Preset] Container #preset-container not found');
    return;
  }

  console.info('[AppPreset] Container found, loading preset data...');

  // Reset filter and pagination state
  currentElementFilter = 'all';
  currentTagFilters.clear();
  allTags.clear();
  tagSearchQuery = '';
  currentPage = 1;

  try {
    // Preload counts for all categories (lightweight)
    await preloadCategoryCounts();
    log('[AppPreset] Category counts loaded');

    // Load the default category (meta)
    const filePath = CATEGORY_FILES[currentCategory];
    const presetData = (await window.loadPresetBuilds?.(filePath)) as PresetData | undefined;
    console.info('[AppPreset] Data loaded:', presetData);

    if (!presetData || !presetData.presets || presetData.presets.length === 0) {
      container.innerHTML = `
        <div class="preset-empty-state">
          <div class="empty-icon">📭</div>
          <h3>${window.i18n?.t('preset.noPresets') || 'No preset builds'}</h3>
          <p>${window.i18n?.t('preset.noPresetsDesc') || 'Add presets to PresetBuilds_Meta.json'}</p>
        </div>
      `;
      return;
    }

    // Store data for pagination
    elementsData = presetData.elements || {};
    allPresetsData = sortPresets(presetData.presets);
    categoryMetadata = presetData.metadata;

    // Collect all unique tags
    allPresetsData.forEach((preset) => {
      (preset.tags || []).forEach((tag) => allTags.add(tag));
    });

    // Render the content with category tabs
    await renderPresetsContent();
  } catch (error) {
    console.error('Error rendering preset builds:', error);
    container.innerHTML = `
      <div class="preset-error-state">
        <div class="error-icon">⚠️</div>
        <h3>${window.i18n?.t('preset.presetLoadFailed') || 'Failed to load presets'}</h3>
        <p>${error instanceof Error ? error.message : String(error)}</p>
      </div>
    `;
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

export function init(): void {
  setupEventDelegation();
  log('[Preset] Tab initialized');
}

// Listen for language changes
onLanguageChange(async () => {
  log('[App-Preset] Language changed, re-rendering presets');
  const presetContainer = document.getElementById('preset-container');
  if (presetContainer && presetContainer.innerHTML) {
    await renderPresets();
  }
});

// Make only necessary functions globally available for programmatic access
if (typeof window !== 'undefined') {
  window.renderPresets = renderPresets;
  // Internal functions now handled by event delegation
}

export default {
  renderPresets,
  init,
};
