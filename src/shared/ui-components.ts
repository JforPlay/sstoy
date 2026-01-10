/**
 * UI Component Rendering System
 *
 * Centralized rendering functions for all common UI components including character
 * cards, potential icons, navigation headers, and modals. Ensures visual consistency,
 * reduces code duplication, and provides a single source for UI updates.
 *
 * Key Features:
 * - Character card rendering (grid and builder layouts)
 * - Potential icon generation with level and mark badges
 * - Global navigation header with i18n support
 * - Reusable Modal class with keyboard shortcuts
 * - Event delegation-friendly HTML generation (data attributes instead of onclick)
 *
 * Rendering Strategy:
 * - Generate HTML strings with data attributes for event handling
 * - Use optimized image loading (lazy, eager, decoding)
 * - Include i18n attributes for automatic translation updates
 * - Support both selected and empty states
 *
 * @module shared/ui-components
 * @see {@link shared/game-data} For data access helpers
 * @see {@link shared/index} For utility functions (getIcon, parseElementTags)
 */

import { GameData, getCharacterName, getItemName } from './game-data';
import { getIcon, parseElementTags, createOptimizedImage, createResponsiveImage, ICONS } from './index';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Configuration options for character builder cards
 *
 * @interface CharacterCardOptions
 */
export interface CharacterCardOptions {
  showRemove?: boolean;
  showChange?: boolean;
  showLevelSelect?: boolean;
  isMaster?: boolean;
  levelPhase?: number;
  onClick?: string; // Function name to call
  selected?: boolean;
}

// =============================================================================
// CHARACTER CARD
// =============================================================================

/**
 * Renders a compact character card for grid displays
 *
 * Used in character selector modals and database views. Shows character
 * portrait, name, rarity stars, and element icon in a compact layout.
 *
 * Features:
 * - Element icon overlay on portrait
 * - Rarity displayed as stars (★)
 * - Selected state styling
 * - Event delegation via data-char-id attribute
 * - Lazy image loading for performance
 *
 * @param charId - Character ID to render
 * @param selected - Whether this character is currently selected
 * @returns HTML string for character card
 *
 * @example
 * ```typescript
 * const html = renderCharacterGridItem('1001', true);
 * grid.innerHTML += html;
 * ```
 */
export function renderCharacterGridItem(charId: string, selected = false): string {
  const char = GameData.characters[charId];
  if (!char) return '';

  const name = getCharacterName(charId);
  const imagePath = `assets/char/avg1_${charId}_002.png`;
  const selectedClass = selected ? 'selected' : '';

  // Get grade (rarity) as stars
  const gradeNum = Number(char.Grade) || 3;
  const gradeData = GameData.gameEnums?.characterGrade?.[gradeNum];
  const stars = gradeData?.stars ? '★'.repeat(gradeData.stars) : '★'.repeat(gradeNum);

  // Get element icon using EET (Element Enum Type)
  const elementId = char.EET;
  const elementIconPath = elementId ? `assets/icon_common_property_${elementId}.png` : '';

  // We can use dataset attributes for event delegation instead of inline onclick
  return `
    <div class="character-selector-card ${selectedClass}" data-char-id="${charId}" role="button" tabindex="0">
      <div class="character-selector-img-wrapper">
        ${createResponsiveImage(imagePath, name, 'character-selector-img')}
        ${elementIconPath ? createResponsiveImage(elementIconPath, 'Element', 'character-element-icon') : ''}
      </div>
      <div class="character-selector-info">
        <div class="character-selector-name">${name}</div>
        <div class="character-selector-grade">${stars}</div>
      </div>
    </div>
  `;
}

/**
 * Renders a detailed character card for the builder interface
 *
 * Shows full character information including portrait, stats, level selector,
 * and action buttons (Change/Remove). Used in the main builder for master
 * and assist positions.
 *
 * Features:
 * - Configurable action buttons (change/remove)
 * - Optional level phase selector (1+, 10+, 20+, etc.)
 * - Character stats display with icons
 * - Empty state for unselected positions
 * - Event delegation via data-action and data-position attributes
 *
 * @param position - Character position (master, assist1, assist2)
 * @param charId - Character ID or null for empty state
 * @param options - Configuration options for card behavior
 * @returns HTML string for character builder card
 *
 * @example
 * ```typescript
 * const html = renderCharacterBuilderCard('master', '1001', {
 *   showChange: true,
 *   showRemove: true,
 *   showLevelSelect: true,
 *   isMaster: true,
 *   levelPhase: 8
 * });
 * ```
 */
export function renderCharacterBuilderCard(
  position: string,
  charId: string | null,
  options: CharacterCardOptions = {}
): string {
  const { showRemove, showChange, showLevelSelect, isMaster, levelPhase } = options;

  if (!charId) {
    return renderEmptyCard(position, isMaster);
  }

  const char = GameData.characters[charId];
  if (!char) return renderEmptyCard(position, isMaster);

  const name = getCharacterName(charId);
  const imagePath = `assets/char/avg1_${charId}_002.png`;
  
  // Stats
  const grade = Number(char.Grade);
  const stars = '★'.repeat(grade); // Replace with icons if needed
  
  // Skills (Placeholder logic - in real app, this needs GameData.skills)

  return `
    ${createResponsiveImage(imagePath, name, 'character-card-image', true)}
    <div class="character-info">
      <div class="character-action-buttons">
        ${showChange ? `<button class="change-character-btn" data-action="open-character-select" data-position="${position}">
          <span class="change-icon">${getIcon('change')}</span>
          <span>Change</span>
        </button>` : ''}
        ${showRemove ? `<button class="remove-character-btn" data-action="remove-character" data-position="${position}">
          <span class="remove-icon">${getIcon('remove')}</span>
          <span>Remove</span>
        </button>` : ''}
      </div>
      <div class="character-info-header">
        <div class="character-name">${name}</div>
        <div class="character-id">ID: ${charId}</div>
      </div>
      
      ${showLevelSelect ? renderLevelSelector(position, levelPhase || 8) : ''}
      
      <div class="character-stats-enhanced">
         <div class="stat-card stat-grade">
            <div class="stat-content">
              <div class="stat-label">Grade</div>
              <div class="stat-value">${stars}</div>
            </div>
         </div>
         <!-- Add more stats here as needed -->
      </div>
    </div>
  `;
}

/**
 * Renders an empty character card placeholder
 *
 * Shows a "+" icon and prompt text for empty character slots.
 * Clicking opens the character selector modal.
 *
 * @param position - Character position identifier
 * @param isMaster - Whether this is a master position (changes text)
 * @returns HTML string for empty card
 */
function renderEmptyCard(position: string, isMaster: boolean = false): string {
  const text = isMaster ? 'Select Master' : 'Select Assist';
  return `
    <div class="empty-state" data-action="open-character-select" data-position="${position}">
      <div class="plus-icon">+</div>
      <p>${text}</p>
    </div>
  `;
}

/**
 * Renders a level phase selector dropdown
 *
 * Generates a select element with phase options (1+, 10+, 20+, ... 80+).
 * Phase 0 = 1+, Phase 1 = 10+, etc.
 *
 * @param position - Character position for event delegation
 * @param currentPhase - Currently selected phase (0-8)
 * @returns HTML string for level selector
 */
function renderLevelSelector(position: string, currentPhase: number): string {
  const options = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(val => 
    `<option value="${val}" ${currentPhase === val ? 'selected' : ''}>${val === 0 ? '1+' : val * 10 + '+'}</option>`
  ).join('');

  return `
    <div class="character-level-phase-selector">
      <label class="level-phase-label">Level:</label>
      <select class="level-phase-select" data-action="update-character-level-phase" data-position="${position}">
        ${options}
      </select>
    </div>
  `;
}

// =============================================================================
// POTENTIAL ICON
// =============================================================================

/**
 * Generates HTML for the potential corner icon
 *
 * Checks if the potential has a defined 'Corner' property and generates
 * the appropriate corner badge with masked background color.
 *
 * @param potId - Potential ID
 * @returns HTML string for the corner icon or empty string
 */
export function getPotentialCornerIconHTML(potId: number): string {
  const potential = GameData.potentials?.[potId];
  const itemData = GameData.items?.[potId];
  
  if (!potential || !itemData) return '';

  // Check if this is a specific potential (Stype === 42)
  const isSpecificPotential = itemData.Stype === 42;
  
  // Determine background based on Stype and Rarity to extract color
  let backgroundImage = '';
  if (itemData.Stype === 42) {
    backgroundImage = 'assets/skill_icons/rare_vestige_card_s_7.png';
  } else if (itemData.Stype === 41) {
    if (itemData.Rarity === 1) {
      backgroundImage = 'assets/skill_icons/rare_vestige_card_s_9.png';
    } else if (itemData.Rarity === 2) {
      backgroundImage = 'assets/skill_icons/rare_vestige_card_s_8.png';
    }
  }

  // Corner Icon Logic
  // Access Corner property safely (cast to any as it might not be in the type definition yet)
  const cornerType = (potential as any).Corner;
  
  if (cornerType && !isSpecificPotential) {
    let shape = '';
    if (cornerType === 1) shape = 'Diamond';
    else if (cornerType === 2) shape = 'Triangle';
    else if (cornerType === 3) shape = 'Round';

    let color = '';
    if (itemData.Rarity === 1) {
      color = '#8759ff'; // Purple/Blue for Rarity 1
    } else if (itemData.Rarity === 2) {
      color = '#e3920e'; // Orange/Gold for Rarity 2
    }

    if (shape && color) {
      const maskUrl = `assets/skill_icons/Potential_${shape}_B.png`;
      const fgUrl = `assets/skill_icons/Potential_${shape}_A.png`;
      
      return `
          <div class="potential-corner-icon">
              <div class="potential-corner-wrapper">
                  <div class="potential-corner-mask" style="mask-image: url('${maskUrl}'); -webkit-mask-image: url('${maskUrl}'); background-color: ${color};"></div>
                  ${createResponsiveImage(fgUrl, '', 'potential-corner-fg')}
              </div>
          </div>
      `;
    }
  }
  
  return '';
}

/**
 * Generates HTML for a potential icon with level and mark badges
 *
 * Renders a styled potential icon with:
 * - Background image based on Stype (specific vs normal)
 * - Skill icon overlay
 * - Level badge (Lv.1-7)
 * - Mark badge (필수, 다다익선, 명함만, 후순위)
 * - Localized name label
 *
 * Signature Compatibility:
 * - Old: (potId, position, level, mark)
 * - New: (potId, position, state, charId) - auto-extracts level/mark from state
 *
 * Mark Migration:
 * - Automatically migrates old mark values (권장 → 다다익선)
 * - Supports both Korean and English mark names
 *
 * @param potId - Potential ID
 * @param position - Character position (master, assist1, assist2)
 * @param stateOrLevel - Either level number (old) or state object (new)
 * @param charIdOrMark - Either mark string (old) or charId (new)
 * @returns HTML string for potential icon with badges
 *
 * @example
 * ```typescript
 * // New signature
 * const html = generatePotentialIconHTML(20001, 'master', state, '1001');
 *
 * // Old signature (still supported)
 * const html = generatePotentialIconHTML(20001, 'master', 3, '필수');
 * ```
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
  if (!GameData.potentials?.[potId]) return '';

  const potential = GameData.potentials[potId];
  const itemData = GameData.items?.[potId];

  // Get potential name from itemNames using BriefDesc key
  const briefDescKey = potential.BriefDesc as string | undefined;
  const itemKey = briefDescKey ? String(briefDescKey).replace('Potential.', 'Item.') : null;
  const name = itemKey
    ? getItemName(itemKey) || `Potential ${potId}`
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
  
  // Get corner icon HTML
  const cornerIconHtml = getPotentialCornerIconHTML(potId);

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
    const label = window.i18n?.t('builder.marks.essential') || '필수';
    markBadgeHTML = `<span class="pot-mark-badge essential">${label}</span>`;
  } else if (migratedMark === '다다익선') {
    const label = window.i18n?.t('builder.marks.recommended') || '다다익선';
    markBadgeHTML = `<span class="pot-mark-badge recommended">${label}</span>`;
  } else if (migratedMark === '명함만') {
    const label = window.i18n?.t('builder.marks.minimum') || '명함만';
    markBadgeHTML = `<span class="pot-mark-badge level-one">${label}</span>`;
  } else if (migratedMark === '후순위') {
    const label = window.i18n?.t('builder.marks.low') || '후순위';
    markBadgeHTML = `<span class="pot-mark-badge low-priority">${label}</span>`;
  }

  return `
        <div class="potential-icon-card">
            <div class="potential-icon-compact"
                 draggable="true"
                 data-potential-id="${potId}"
                 data-position="${position}">
                ${
                  backgroundImage
                    ? createResponsiveImage(backgroundImage, '', 'pot-bg-img')
                    : ''
                }
                ${cornerIconHtml}
                ${
                  iconPath
                    ? createResponsiveImage(iconPath, name, 'pot-icon-img')
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
// LAYOUT
// =============================================================================

/**
 * Renders the global navigation header with all nav links and controls
 *
 * Generates the complete navbar HTML including:
 * - Logo and title with home link
 * - Navigation links with active state highlighting
 * - Theme toggle button (dark/light mode)
 * - Language selector dropdown (KR, EN, JP, CN)
 * - Mobile hamburger menu
 *
 * Features:
 * - Automatic i18n attribute injection for translation updates
 * - Active page highlighting
 * - Current theme/language detection from localStorage
 * - Responsive mobile menu support
 *
 * @param activePage - Current page ID for active state ('app', 'characterdb', etc.)
 * @returns HTML string for complete navigation header
 *
 * @example
 * ```typescript
 * const navbar = renderGlobalHeader('characterdb');
 * document.getElementById('global-navigation').innerHTML = navbar;
 * ```
 */
export function renderGlobalHeader(activePage: string): string {
  const navItems = [
    { id: 'characterdb', href: 'characterdb.html', icon: 'characterDB' },
    { id: 'discdb', href: 'discdb.html', icon: 'disc' },
    { id: 'app', href: 'app.html', icon: 'pottery' },
    { id: 'tasks', href: 'tasks.html', icon: 'tasks' },
    { id: 'resources', href: 'resources.html', icon: 'resources' },
  ];

  const navLinks = navItems.map(item => {
    const isActive = activePage === item.id ? 'active' : '';
    // Get translated label, fallback to ID if not available
    const label = window.i18n?.t(`nav.${item.id}`) || item.id;
    return `
      <a href="${item.href}" class="navbar-link ${isActive}">
        <span class="navbar-link-icon">${getIcon(item.icon)}</span>
        <span class="navbar-link-text" data-i18n="nav.${item.id}">${label}</span>
      </a>
    `;
  }).join('');

  // Get current state for initial render
  const currentTheme = localStorage.getItem('theme') || 'dark';
  const currentLang = window.i18n?.currentLang || 'KR';

  // Determine theme toggle state (icon shows what it will switch TO)
  const themeIconClass = currentTheme === 'dark' ? ICONS.sun : ICONS.moon;
  const themeTextKey = currentTheme === 'dark' ? 'nav.themeLight' : 'nav.themeDark';
  // Get translated theme text, fallback to English
  const themeText = window.i18n?.t(themeTextKey) || (currentTheme === 'dark' ? 'Light' : 'Dark');

  // Get translated title
  const homeTitle = window.i18n?.t('nav.title') || 'Stella Sora Tools';

  return `
    <nav class="navbar">
      <a href="index.html" class="navbar-brand">
        <span class="navbar-logo-icon">${getIcon('star')}</span>
        <span class="navbar-title" data-i18n="nav.title">${homeTitle}</span>
      </a>
      <button class="navbar-hamburger" id="navbar-hamburger" aria-label="Toggle navigation">
        <i class="fa-solid fa-bars"></i>
      </button>
      <div class="navbar-menu" id="navbar-menu">
        <div class="navbar-links">
          ${navLinks}
        </div>
        <div class="navbar-controls">
           <button id="theme-toggle" class="theme-toggle" aria-label="Toggle Theme" onclick="toggleTheme()">
              <i class="theme-icon ${themeIconClass}"></i>
              <span class="theme-text" data-i18n="${themeTextKey}">${themeText}</span>
           </button>
           <select id="language-select" class="language-select" onchange="window.i18n.setLanguage(this.value)">
              <option value="KR" ${currentLang === 'KR' ? 'selected' : ''}>KR | 한국어</option>
              <option value="EN" ${currentLang === 'EN' ? 'selected' : ''}>EN | English</option>
              <option value="JP" ${currentLang === 'JP' ? 'selected' : ''}>JP | 日本語</option>
              <option value="CN" ${currentLang === 'CN' ? 'selected' : ''}>CN | 中文</option>
           </select>
        </div>
      </div>
    </nav>
  `;
}

/**
 * Initializes the global navigation header with event handlers
 *
 * Injects the navbar HTML into #global-navigation container and sets up:
 * - Hamburger menu toggle for mobile
 * - Click-outside-to-close behavior
 * - ARIA attributes for accessibility
 *
 * Should be called once on page load after DOM is ready.
 *
 * @param activePage - Current page ID for active state highlighting
 *
 * @example
 * ```typescript
 * // In page initialization
 * document.addEventListener('DOMContentLoaded', () => {
 *   initGlobalHeader('characterdb');
 * });
 * ```
 */
export function initGlobalHeader(activePage: string): void {
  const headerContainer = document.getElementById('global-navigation');
  if (headerContainer) {
    headerContainer.innerHTML = renderGlobalHeader(activePage);
    
    // Re-initialize toggle logic since we replaced the DOM
    const hamburger = document.getElementById('navbar-hamburger');
    const menu = document.getElementById('navbar-menu');
    
    if (hamburger && menu) {
      hamburger.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering document click
        menu.classList.toggle('open');
        hamburger.setAttribute('aria-expanded', menu.classList.contains('open').toString());
      });

      // Close menu when clicking outside
      document.addEventListener('click', (e) => {
        const target = e.target as Node;
        if (menu.classList.contains('open') && 
            !menu.contains(target) && 
            !hamburger.contains(target)) {
          menu.classList.remove('open');
          hamburger.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }
}

// =============================================================================
// MODAL
// =============================================================================

/**
 * Reusable Modal component with lifecycle hooks
 *
 * Provides a flexible modal interface with:
 * - Open/close methods with CSS class-based animations
 * - Escape key to close
 * - Click backdrop to close
 * - onOpen/onClose callbacks for custom logic
 * - Automatic cleanup of event listeners
 *
 * Modal Structure:
 * - Uses .active class to trigger CSS display: flex
 * - Supports multiple close buttons (.close-btn, .load-modal-close, etc.)
 * - Prevents event bubbling for proper backdrop clicks
 *
 * @class Modal
 *
 * @example
 * ```typescript
 * const modal = new Modal('character-select-modal');
 *
 * modal.onOpen(() => {
 *   console.info('[Modal] Character selector opened');
 * });
 *
 * modal.onClose(() => {
 *   console.info('[Modal] Character selector closed');
 * });
 *
 * // Open modal
 * modal.open();
 *
 * // Close modal (or press ESC, click backdrop)
 * modal.close();
 *
 * // Check state
 * if (modal.isOpen()) {
 *   // Modal is currently visible
 * }
 * ```
 */
export class Modal {
  private element: HTMLElement | null;
  private onOpenCallbacks: Array<() => void> = [];
  private onCloseCallbacks: Array<() => void> = [];

  /**
   * Creates a new Modal instance
   *
   * @param elementId - DOM element ID of the modal container
   */
  constructor(elementId: string) {
    this.element = document.getElementById(elementId);
    if (!this.element) {
      console.warn(`[Modal] Element with ID '${elementId}' not found.`);
    } else {
      this.initHandlers();
    }
  }

  /**
   * Handles ESC key press to close modal
   */
  private handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.close();
    }
  };

  /**
   * Initializes close button and backdrop click handlers
   */
  private initHandlers(): void {
    if (!this.element) return;

    // Close buttons
    const closeBtns = this.element.querySelectorAll('.close-btn, .load-modal-close, .patch-modal-close');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent bubbling to backdrop
        this.close();
      });
    });

    // Click backdrop to close
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        this.close();
      }
    });
  }

  /**
   * Opens the modal
   *
   * Adds .active class to trigger CSS animation and registers ESC key handler.
   * Calls all onOpen callbacks.
   */
  public open(): void {
    if (this.element) {
      // Clear inline display if it was set by legacy code
      this.element.style.removeProperty('display');
      // Add active class to trigger CSS display: flex
      this.element.classList.add('active');
      
      document.addEventListener('keydown', this.handleEsc);
      
      this.onOpenCallbacks.forEach(cb => cb());
    }
  }

  /**
   * Closes the modal
   *
   * Removes .active class to trigger CSS animation and unregisters ESC key handler.
   * Calls all onClose callbacks.
   */
  public close(): void {
    if (this.element) {
      this.element.classList.remove('active');
      document.removeEventListener('keydown', this.handleEsc);
      this.onCloseCallbacks.forEach(cb => cb());
    }
  }

  /**
   * Registers a callback to run when modal opens
   *
   * @param callback - Function to call on modal open
   */
  public onOpen(callback: () => void): void {
    this.onOpenCallbacks.push(callback);
  }

  /**
   * Registers a callback to run when modal closes
   *
   * @param callback - Function to call on modal close
   */
  public onClose(callback: () => void): void {
    this.onCloseCallbacks.push(callback);
  }

  /**
   * Checks if modal is currently open
   *
   * @returns True if modal has .active class, false otherwise
   */
  public isOpen(): boolean {
      return this.element ? this.element.classList.contains('active') : false;
  }
}

// =============================================================================
// RE-EXPORTS FOR BACKWARD COMPATIBILITY
// =============================================================================

// Re-export createResponsiveImage for modules that import from ui-components
export { createResponsiveImage } from './dom';

