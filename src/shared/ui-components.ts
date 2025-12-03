/**
 * UI Component Renderer
 * Centralized logic for rendering common UI elements like cards, icons, and headers.
 * Ensures consistency and easier styling updates.
 */

import { GameData, getCharacterName, getItemName } from './game-data';
import { getIcon, parseElementTags, createOptimizedImage, ICONS } from './index';

// =============================================================================
// TYPES
// =============================================================================

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
 * Renders a compact character card (used in Character Selector grid)
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
        ${createOptimizedImage(imagePath, name, 'character-selector-img')}
        ${elementIconPath ? `<img src="${elementIconPath}" alt="Element" class="character-element-icon" loading="lazy" onerror="this.style.display='none'">` : ''}
      </div>
      <div class="character-selector-info">
        <div class="character-selector-name">${name}</div>
        <div class="character-selector-grade">${stars}</div>
      </div>
    </div>
  `;
}

/**
 * Renders a detailed character card (used in Builder)
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
    <img src="${imagePath}" alt="${name}" class="character-card-image">
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

function renderEmptyCard(position: string, isMaster: boolean = false): string {
  const text = isMaster ? 'Select Master' : 'Select Assist';
  return `
    <div class="empty-state" data-action="open-character-select" data-position="${position}">
      <div class="plus-icon">+</div>
      <p>${text}</p>
    </div>
  `;
}

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
// LAYOUT
// =============================================================================

/**
 * Renders the global navigation header
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
 * Initialize the global header by injecting it into the DOM
 */
export function initGlobalHeader(activePage: string): void {
  const headerContainer = document.getElementById('global-navigation');
  if (headerContainer) {
    headerContainer.innerHTML = renderGlobalHeader(activePage);
    
    // Re-initialize toggle logic since we replaced the DOM
    const hamburger = document.getElementById('navbar-hamburger');
    const menu = document.getElementById('navbar-menu');
    
    if (hamburger && menu) {
      hamburger.addEventListener('click', () => {
        menu.classList.toggle('open');
        hamburger.setAttribute('aria-expanded', menu.classList.contains('open').toString());
      });
    }
  }
}

// =============================================================================
// MODAL
// =============================================================================

export class Modal {
  private element: HTMLElement | null;
  private onOpenCallbacks: Array<() => void> = [];
  private onCloseCallbacks: Array<() => void> = [];

  constructor(elementId: string) {
    this.element = document.getElementById(elementId);
    if (!this.element) {
      console.warn(`[Modal] Element with ID '${elementId}' not found.`);
    } else {
      this.initHandlers();
    }
  }

  private handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.close();
    }
  };

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

  public close(): void {
    if (this.element) {
      this.element.classList.remove('active');
      document.removeEventListener('keydown', this.handleEsc);
      this.onCloseCallbacks.forEach(cb => cb());
    }
  }

  public onOpen(callback: () => void): void {
    this.onOpenCallbacks.push(callback);
  }

  public onClose(callback: () => void): void {
    this.onCloseCallbacks.push(callback);
  }
  
  public isOpen(): boolean {
      return this.element ? this.element.classList.contains('active') : false;
  }
}

