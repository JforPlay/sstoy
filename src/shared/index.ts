/**
 * Shared utilities module - consolidates duplicate code across all modules
 *
 * This module provides:
 * - Cached JSON fetching
 * - Debounce utility
 * - Debug logging
 * - Language change handler registration
 * - Toast notifications
 * - LRU Cache implementation
 */

// =============================================================================
// JSON CACHING
// =============================================================================

const jsonCache = new Map<string, unknown>();
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Fetch JSON with caching to prevent duplicate requests
 */
export async function fetchJSON<T = unknown>(path: string): Promise<T> {
  if (jsonCache.has(path)) {
    return jsonCache.get(path) as T;
  }

  if (inFlight.has(path)) {
    return inFlight.get(path) as Promise<T>;
  }

  const promise = fetch(path)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      jsonCache.set(path, data);
      inFlight.delete(path);
      return data as T;
    })
    .catch((err) => {
      inFlight.delete(path);
      throw err;
    });

  inFlight.set(path, promise);
  return promise;
}

/**
 * Clear JSON cache, optionally by prefix
 */
export function clearJSONCache(prefix = ''): void {
  if (!prefix) {
    jsonCache.clear();
    return;
  }

  for (const key of jsonCache.keys()) {
    if (key.startsWith(prefix)) {
      jsonCache.delete(key);
    }
  }
}

// =============================================================================
// DEBOUNCE
// =============================================================================

/**
 * Debounce a function call
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait = 150
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>): void {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      fn(...args);
      timeout = null;
    }, wait);
  };
}

// =============================================================================
// DEBUG LOGGING
// =============================================================================

let debugEnabled = false;

export function setDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

export function log(...args: unknown[]): void {
  if (debugEnabled && typeof console !== 'undefined') {
    console.log(...args);
  }
}

// =============================================================================
// LANGUAGE CHANGE HANDLERS
// =============================================================================

type LanguageChangeHandler = () => void | Promise<void>;
const languageChangeHandlers: LanguageChangeHandler[] = [];

/**
 * Register a handler to be called when language changes
 * This consolidates the duplicate language change listeners across modules
 */
export function onLanguageChange(handler: LanguageChangeHandler): () => void {
  languageChangeHandlers.push(handler);

  // Return unsubscribe function
  return () => {
    const index = languageChangeHandlers.indexOf(handler);
    if (index > -1) {
      languageChangeHandlers.splice(index, 1);
    }
  };
}

/**
 * Initialize language change listener (call once at app startup)
 */
export function initLanguageChangeListener(): void {
  window.addEventListener('languageChanged', async () => {
    log('[Shared] Language changed, notifying handlers');
    await Promise.all(languageChangeHandlers.map((handler) => handler()));
  });
}

// =============================================================================
// ICON SYSTEM
// =============================================================================

const ICONS: Record<string, string> = {
  // Navigation & Core
  logo: 'fa-solid fa-star',
  characterDB: 'fa-solid fa-book',
  pottery: 'fa-solid fa-medal',
  tasks: 'fa-solid fa-clipboard-list',
  resources: 'fa-solid fa-box',
  guide: 'fa-solid fa-book-open',
  // Positions & Characters
  people: 'fa-solid fa-users',
  master: 'fa-solid fa-crown',
  assist: 'fa-solid fa-chess-pawn',
  // Features & Sections
  dating: 'fa-solid fa-heart',
  images: 'fa-solid fa-image',
  archive: 'fa-solid fa-book-bookmark',
  stats: 'fa-solid fa-chart-bar',
  disc: 'fa-solid fa-compact-disc',
  summary: 'fa-solid fa-list-check',
  chat: 'fa-solid fa-message',
  comments: 'fa-solid fa-comments',
  // UI Elements
  search: 'fa-solid fa-magnifying-glass',
  filter: 'fa-solid fa-filter',
  star: 'fa-solid fa-star',
  plus: 'fa-solid fa-plus',
  remove: 'fa-solid fa-xmark',
  change: 'fa-solid fa-arrow-rotate-right',
  memo: 'fa-solid fa-sticky-note',
  share: 'fa-solid fa-share-nodes',
  download: 'fa-solid fa-download',
  upload: 'fa-solid fa-upload',
  // Stats & Numbers
  attackPower: 'fa-solid fa-gavel',
  critPower: 'fa-solid fa-burst',
  impactPower: 'fa-solid fa-bolt',
  // Toast Notifications
  error: 'fa-solid fa-circle-exclamation',
  warning: 'fa-solid fa-triangle-exclamation',
  success: 'fa-solid fa-circle-check',
  info: 'fa-solid fa-circle-info',
  //Misc
  sun: 'fa-solid fa-sun',
  moon: 'fa-solid fa-moon',
};

/**
 * Get icon HTML string
 */
export function getIcon(iconName: string, additionalClasses = ''): string {
  const iconClass = ICONS[iconName] || ICONS.star;
  return `<i class=\"${iconClass} ${additionalClasses}\"></i>`;
}

/**
 * Create icon element
 */
export function createIconElement(iconName: string, additionalClasses = ''): HTMLElement {
  const i = document.createElement('i');
  const iconClass = ICONS[iconName] || ICONS.star;
  i.className = `${iconClass} ${additionalClasses}`.trim();
  return i;
}

// =============================================================================
// THEME MANAGEMENT
// =============================================================================

/**
 * Set theme
 */
export function setTheme(theme: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);

  // Update theme toggle button icon and text
  // Show the mode it will switch TO (opposite of current)
  const themeToggles = document.querySelectorAll('#theme-toggle');
  themeToggles.forEach((toggle) => {
    const icon = toggle.querySelector('.theme-icon') as HTMLElement;
    const text = toggle.querySelector('.theme-text') as HTMLElement;
    if (icon) {
      if (theme === 'dark') {
        // Currently dark, will switch to light
        icon.className = `theme-icon ${ICONS.sun}`;
        if (text) {
          text.setAttribute('data-i18n', 'nav.themeLight');
          text.textContent = window.i18n?.t('nav.themeLight') ?? 'Light';
        }
      } else {
        // Currently light, will switch to dark
        icon.className = `theme-icon ${ICONS.moon}`;
        if (text) {
          text.setAttribute('data-i18n', 'nav.themeDark');
          text.textContent = window.i18n?.t('nav.themeDark') ?? 'Dark';
        }
      }
    }
  });
}

/**
 * Toggle theme
 */
export function toggleTheme(): void {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

// Initialize theme on load
if (typeof document !== 'undefined') {
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
  setTheme(savedTheme || 'dark');
}

// =============================================================================
// TOAST NOTIFICATIONS
// =============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number;
}

/**
 * Show a toast notification
 * Supports both: showToast("message") and showToast("message", "type") for backwards compatibility
 */
export function showToast(config: ToastConfig | string, typeOverride?: ToastType): void {
  let message: string;
  let type: ToastType = 'info';
  let duration = 3000;

  if (typeof config === 'string') {
    message = config;
    if (typeOverride) {
      type = typeOverride;
    }
  } else {
    message = config.message;
    type = config.type || 'info';
    duration = config.duration || 3000;
  }

  // Find or create toast container
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // Add icon based on type (matching legacy implementation)
  const iconMap: Record<ToastType, string> = {
    error: 'error',
    warning: 'warning',
    success: 'success',
    info: 'info',
  };

  toast.innerHTML = `
    <span class="toast-icon">${getIcon(iconMap[type])}</span>
    <span class="toast-message">${message}</span>
  `;

  // Add click to dismiss
  toast.addEventListener('click', () => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  });

  container.appendChild(toast);

  // Trigger animation on next frame (for CSS transition to work)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });
  });

  // Auto dismiss
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

export const showSuccess = (msg: string): void => showToast({ message: msg, type: 'success' });
export const showError = (msg: string): void => showToast({ message: msg, type: 'error' });
export const showWarning = (msg: string): void => showToast({ message: msg, type: 'warning' });
export const showInfo = (msg: string): void => showToast({ message: msg, type: 'info' });

// =============================================================================
// LRU CACHE
// =============================================================================

/**
 * Simple LRU Cache implementation
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    // Delete if exists (to update order)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// =============================================================================
// DOM UTILITIES
// =============================================================================

/**
 * Safely get element by ID with type assertion
 */
export function getElement<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * Safely query selector with type assertion
 */
export function querySelector<T extends HTMLElement>(
  selector: string,
  parent: ParentNode = document
): T | null {
  return parent.querySelector(selector) as T | null;
}

/**
 * Safely query all with type assertion
 */
export function querySelectorAll<T extends HTMLElement>(
  selector: string,
  parent: ParentNode = document
): NodeListOf<T> {
  return parent.querySelectorAll(selector) as NodeListOf<T>;
}

// =============================================================================
// IMAGE ERROR HANDLING
// =============================================================================

/**
 * Handle image error by hiding the element
 */
export function handleImageError(img: HTMLImageElement): void {
  img.style.display = 'none';
}

/**
 * Create onerror handler string for inline use in templates
 */
export const IMAGE_ERROR_HANDLER = "this.style.display='none'";

// =============================================================================
// ELEMENT TAG PARSING
// =============================================================================

/**
 * Parse element tags in descriptions and convert to styled HTML
 * Robust parsing using ## and #number# markers only, independent of text content
 */
export function parseElementTags(description: string): string {
  if (!description) return description;

  // Map iconId to element info (color and icon)
  const iconIdToElement: Record<string, { color: string; icon: string; name: string }> = {
    // Basic element tag icons (10xx series)
    '1015': { color: '#FFD700', icon: 'Icon_ElementTagTrigger_Light', name: 'Light' },
    '1016': { color: '#FF4444', icon: 'Icon_ElementTagTrigger_Fire', name: 'Fire' },
    '1017': { color: '#44FF44', icon: 'Icon_ElementTagTrigger_Wind', name: 'Wind' },
    '1018': { color: '#4444FF', icon: 'Icon_ElementTagTrigger_Water', name: 'Water' },
    '1019': { color: '#9944FF', icon: 'Icon_ElementTagTrigger_Dark', name: 'Dark' },
    '1020': { color: '#8B4513', icon: 'Icon_ElementTagTrigger_Earth', name: 'Earth' },
    // Extended element tag icons (20xx series)
    '2016': { color: '#FFD700', icon: 'Icon_ElementTagTrigger_Light', name: 'Light' },
    '2013': { color: '#FF4444', icon: 'Icon_ElementTagTrigger_Fire', name: 'Fire' },
    '2017': { color: '#44FF44', icon: 'Icon_ElementTagTrigger_Wind', name: 'Wind' },
    '2008': { color: '#4444FF', icon: 'Icon_ElementTagTrigger_Water', name: 'Water' },
    '2018': { color: '#9944FF', icon: 'Icon_ElementTagTrigger_Dark', name: 'Dark' },
    '2029': { color: '#8B4513', icon: 'Icon_ElementTagTrigger_Earth', name: 'Earth' }
  };

  // Robust pattern: ##AnyText#Number#
  const pattern = /##([^#]+)#(\d+)#/g;

  return description.replace(pattern, (match, textContent, iconId) => {
    const elementInfo = iconIdToElement[iconId];

    if (elementInfo) {
      const iconPath = `assets/${elementInfo.icon}.png`;
      return `<span class="element-tag" style="color: ${elementInfo.color}; font-weight: 600;">${textContent}<img src="${iconPath}" alt="${elementInfo.name}" class="element-tag-icon" style="width: 20px; height: 20px; vertical-align: middle; margin-left: 4px;" onerror="this.style.display='none'"></span>`;
    } else {
      return `<span class="element-tag">${textContent}</span>`;
    }
  });
}

/**
 * Process description text - handles newlines, color tags, and element tags
 */
export function processDescriptionText(description: string): string {
  if (!description) return '';

  let result = description;

  // Replace vertical tab (\u000b) with <br> for newlines
  if (result.includes('\u000b')) {
    result = result.replace(/\u000b/g, '<br>');
  }

  // Strip color tags like <color=#0abec5> and </color>
  result = result.replace(/<color=[^>]+>/g, '').replace(/<\/color>/g, '');

  // Parse element tags
  result = parseElementTags(result);

  return result;
}

// =============================================================================
// POTENTIAL ICON HTML GENERATOR
// =============================================================================

/**
 * Generate HTML for potential icon (used in summary view)
 */
export function generatePotentialIconHTML(
  potId: number,
  position: string,
  stateOrLevel: any,
  charIdOrMark: string | number | null = null
): string {
  // Handle both old signature (potId, position, level, mark)
  // and new signature (potId, position, state, charId)
  let level = 1;
  let mark: string | null = null;
  
  if (typeof stateOrLevel === 'number') {
    // Old signature: (potId, position, level, mark)
    level = stateOrLevel;
    mark = charIdOrMark as string | null;
  } else {
    // New signature: (potId, position, state, charId) - extract level from state
    const state = stateOrLevel;
    level = state?.potentialLevels?.[position]?.[potId] || 1;
    mark = state?.potentialMarks?.[position]?.[potId] || null;
  }

  // IMAGE_SIZES constant for consistent dimensions
  const IMAGE_SIZES = {
    POTENTIAL_ICON: { width: 64, height: 64 },
  };
  if (!window.state?.potentials?.[potId]) return '';

  const potential = window.state.potentials[potId];
  const itemData = window.state.items?.[potId];

  // Get potential name from itemNames using BriefDesc key
  // Convert Potential.XXXXX.1 to Item.XXXXX.1 for itemNames lookup
  const briefDescKey = potential.BriefDesc as string | undefined;
  const itemKey = briefDescKey ? String(briefDescKey).replace('Potential.', 'Item.') : null;
  const name = itemKey
    ? window.state.itemNames?.[itemKey] || `Potential ${potId}`
    : `Potential ${potId}`;

  // Get icon path
  let iconPath = '';
  if (itemData?.Icon) {
    const iconName = itemData.Icon.split('/').pop();
    iconPath = `assets/skill_icons/${iconName}_A.png`;
  }

  // Determine background image based on Stype
  let backgroundImage = '';
  if (itemData) {
    if (itemData.Stype === 42) {
      backgroundImage = 'assets/skill_icons/rare_vestige_card_s_7.png';
    } else if (itemData.Stype === 41) {
      if (itemData.Rarity === 1) {
        backgroundImage = 'assets/skill_icons/rare_vestige_card_s_9.png';
      } else if (itemData.Rarity === 2) {
        backgroundImage = 'assets/skill_icons/rare_vestige_card_s_8.png';
      }
    }
  }

  // Migrate old mark values to new ones (support both Korean and English)
  let migratedMark = mark;
  // Map legacy Korean to current Korean
  if (mark === '권장') migratedMark = '다다익선';
  if (mark === 'Lv.1') migratedMark = '명함만';
  // Map English to Korean for display
  if (mark === 'essential') migratedMark = '필수';
  if (mark === 'recommended') migratedMark = '다다익선';
  if (mark === 'minimum') migratedMark = '명함만';
  if (mark === 'low') migratedMark = '후순위';

  // Generate mark badge HTML
  let markBadgeHTML = '';
  if (migratedMark === '필수') {
    markBadgeHTML = '<span class="pot-mark-badge essential">필수</span>';
  } else if (migratedMark === '다다익선') {
    markBadgeHTML = '<span class="pot-mark-badge recommended">다다익선</span>';
  } else if (migratedMark === '명함만') {
    markBadgeHTML = '<span class="pot-mark-badge level-one">명함만</span>';
  } else if (migratedMark === '후순위') {
    markBadgeHTML = '<span class="pot-mark-badge low-priority">후순위</span>';
  }

  return `
        <div class="potential-icon-card">
            <div class="potential-icon-compact"
                 draggable="true"
                 data-potential-id="${potId}"
                 data-position="${position}">
                ${
                  backgroundImage
                    ? `<img src="${backgroundImage}" alt="" class="pot-bg-img" loading="lazy" onerror="this.style.display='none'">`
                    : ''
                }
                ${
                  iconPath
                    ? `<img src="${iconPath}" alt="${name}" class="pot-icon-img" loading="lazy" onerror="this.style.display='none'">`
                    : '<span class="pot-icon-placeholder">✦</span>'
                }
                <div class="pot-level-badge">Lv.${level}</div>
                ${markBadgeHTML}
            </div>
            <div class="pot-name-label">${name}</div>
        </div>
    `;
}

// =============================================================================
// EMPTY STATE HELPERS
// =============================================================================

/**
 * Create an empty state HTML element
 */
export function createEmptyState(iconName: string, message: string): string {
  const icon = getIcon(iconName);
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <div class="empty-state-text">${message}</div>
    </div>
  `;
}

/**
 * Create a loading state HTML element
 */
export function createLoadingState(message: string = 'Loading...'): string {
  return createEmptyState('spinner', message);
}

// =============================================================================
// SCROLL TO TOP BUTTON
// =============================================================================

/**
 * Initialize scroll-to-top button
 */
function initScrollToTop(): void {
  // Create button
  const button = document.createElement('button');
  button.className = 'scroll-to-top';
  button.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
  button.setAttribute('aria-label', 'Scroll to top');
  button.setAttribute('title', 'Scroll to top');

  // Add click handler
  button.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  });

  // Add to body
  document.body.appendChild(button);

  // Show/hide based on scroll position
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  const handleScroll = () => {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    scrollTimeout = setTimeout(() => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      if (scrollTop > 300) {
        button.classList.add('visible');
      } else {
        button.classList.remove('visible');
      }
      scrollTimeout = null;
    }, 100);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });

  // Initial check
  handleScroll();
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize shared utilities and expose to window for legacy compatibility
 */
export function initShared(): void {
  // Initialize language change listener
  initLanguageChangeListener();

  // Initialize scroll-to-top button
  initScrollToTop();

  // Expose to window for modules not yet migrated
  window.appUtils = {
    fetchJSONCached: fetchJSON,
    clearJSONCache,
    log,
    debounce: debounce as <T extends (...args: unknown[]) => unknown>(fn: T, wait?: number) => T,
  };

  // Expose functions for HTML onclick handlers and legacy code
  window.showToast = showToast;
  window.showError = showError;
  window.showWarning = showWarning;
  window.showSuccess = showSuccess;
  window.showInfo = showInfo;
  window.getIcon = getIcon;
  window.toggleTheme = toggleTheme;
  window.ICONS = ICONS;
  window.createIconElement = createIconElement;
  window.generatePotentialIconHTML = generatePotentialIconHTML;
  window.parseElementTags = parseElementTags;
  window.processDescriptionText = processDescriptionText;
  window.handleImageError = handleImageError;
  window.createEmptyState = createEmptyState;
  window.createLoadingState = createLoadingState;

  log('[Shared] Utilities initialized');
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShared);
  } else {
    initShared();
  }
}
