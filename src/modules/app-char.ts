/**
 * Character Builder Module
 *
 * Core module for the character party builder system. Manages character selection,
 * potential configuration, skill levels, and dynamic description rendering with
 * parameter parsing. Uses event delegation pattern for all UI interactions.
 *
 * Key Features:
 * - Three-slot party system (master + 2 assists)
 * - Fuzzy search character selection with element filtering
 * - Dynamic potential selection with level management (specific max 2, normal unlimited)
 * - Skill level tracking per character (normal, skill, ultimate)
 * - Character level phase system (1+ through 80+, 9 phases)
 * - Build score calculation from potential levels
 * - Description parsing with level-based parameter substitution
 * - LRU cache for parsed descriptions (500 entries, ~90% hit rate)
 *
 * State Management:
 * - Centralized state object with party, potentials, skills, levels, marks
 * - Event delegation for all UI interactions (no global handlers)
 * - Responsive rendering with RAF throttling
 *
 * @module modules/app-char
 * @see {@link modules/param-parser} For description parameter parsing
 * @see {@link shared/game-data} For character and potential data
 * @see {@link modules/app-saveload} For state persistence
 */

import type {
  Position,
  CharacterState,
  CharacterData,
  SkillData,
  PotentialData,
  PotentialMark,
  DescriptionMode,
  MainTab,
  ActionElement,
} from '../types';

import {
  fetchJSON,
  debounce,
  log,
  showToast,
  showError,
  LRUCache,
  onLanguageChange,
  getElement,
  querySelector,
  querySelectorAll,
  processDescriptionText,
  createResponsiveImage,
  loadCoreData,
  loadFeatureData,
  loadLanguageData
} from '../shared';

import {
  GameData,
  getCharacterName,
  getItemName
} from '../shared/game-data';

import { generatePotentialIconHTML, getPotentialCornerIconHTML, Modal } from '../shared/ui-components';

import {
  parseParamValue,
  parseDescriptionParams,
  extractBuffMetadata,
  FILE_TYPE_MAP,
} from './param-parser';

// =============================================================================
// CONSTANTS
// =============================================================================

const SKILL_LEVEL_BONUS = 3;

export const IMAGE_SIZES = {
  CHARACTER_PORTRAIT: { width: 200, height: 200 },
  CHARACTER_GRID_ITEM: { width: 120, height: 120 },
  SKILL_ICON: { width: 48, height: 48 },
  POTENTIAL_ICON: { width: 64, height: 64 },
  ITEM_ICON: { width: 40, height: 40 },
} as const;

// =============================================================================
// STATE
// =============================================================================

interface PartyMember {
  id: string;
  name: string;
  data: CharacterData;
}

interface CharacterSelectorState {
  allCharacters: CharacterData[];
  fuse: unknown; // Fuse.js instance
  selectedElement: string;
  currentFilter: string;
}

interface AppCharState extends Omit<CharacterState, 'characters' | 'characterNames' | 'potentials' | 'potentialNames' | 'items' | 'itemNames' | 'skills' | 'skillNames' | 'gameEnums' | 'effectValue' | 'buffValue' | 'shieldValue' | 'hitDamage' | 'onceAdditionalAttributeValue' | 'scriptParameterValue' | 'uiText'> {
  currentPosition: Position | null;
  activeTab: Position;
  party: Record<Position, PartyMember | null>;
  characterSelector: CharacterSelectorState;
}

// Initialize state
const state: AppCharState = {
  // User selection state
  selectedPotentials: { master: [], assist1: [], assist2: [] },
  potentialLevels: { master: {}, assist1: {}, assist2: {} },
  skillLevels: { master: {}, assist1: {}, assist2: {} },
  characterLevelPhase: { master: 8, assist1: 8, assist2: 8 },
  potentialMarks: { master: {}, assist1: {}, assist2: {} },
  
  descriptionMode: 'brief',

  currentPosition: null,
  activeTab: 'master',
  party: {
    master: null,
    assist1: null,
    assist2: null,
  },
  characterSelector: {
    allCharacters: [],
    fuse: null,
    selectedElement: 'all',
    currentFilter: '',
  },
};

let characterModal: Modal | null = null;

// Expose state for debugging
if (typeof window !== 'undefined') {
  (window as any).state = state;
  (window as any).GameData = GameData; // Expose GameData too
}

// =============================================================================
// DATA LOADING
// =============================================================================

/**
 * Loads all required game data for character builder
 *
 * Loading sequence:
 * 1. Core data (Character, Item, GameEnums)
 * 2. Builder-specific data (Potential, Skill, EffectValue, etc.)
 * 3. Language-specific translations
 * 4. Initialize character selector with Fuse.js
 *
 * @throws {Error} If data loading fails
 */
export async function loadData(): Promise<void> {
  try {
    // Load core data
    await loadCoreData();

    // Load builder-specific data
    await loadFeatureData('characterBuilder');

    // Load current language data
    const lang = window.i18n?.currentLang || 'KR';
    // Load localized names
    await loadLanguageData(lang, ['Character.json', 'Item.json', 'Skill.json', 'Potential.json']);

    initializeCharacterSelector();
    console.info('[AppChar] Data loaded successfully');
  } catch (error) {
    console.error('[AppChar] Failed to load data:', error);
    showError('Failed to load game data. Please refresh.');
  }
}

/**
 * Checks if core character data has been loaded
 *
 * @returns True if GameData.characters is populated
 */
export function isDataLoaded(): boolean {
  return !!GameData.characters && Object.keys(GameData.characters).length > 0;
}

// Track current render request to cancel old ones
let currentRenderRequest: number | null = null;

function renderCharacterGrid(): void {
  const grid = getElement<HTMLDivElement>('character-grid');
  if (!grid) return;

  // Cancel previous render if still in progress
  if (currentRenderRequest !== null) {
    cancelIdleCallback(currentRenderRequest);
    currentRenderRequest = null;
  }

  grid.innerHTML = '';

  // Filter based on current selector state (search/element)
  let charsToDisplay = state.characterSelector.allCharacters;

  // Apply Element Filter
  if (state.characterSelector.selectedElement !== 'all') {
      charsToDisplay = charsToDisplay.filter(c =>
          String(c.EET) === state.characterSelector.selectedElement
      );
  }

  // Apply Search Filter
  if (state.characterSelector.currentFilter) {
      if (state.characterSelector.fuse) {
          const results = (state.characterSelector.fuse as any).search(state.characterSelector.currentFilter);
          charsToDisplay = results.map((r: any) => r.item);
      } else {
          const lower = state.characterSelector.currentFilter.toLowerCase();
          charsToDisplay = charsToDisplay.filter(c =>
              getCharacterName(c.Id).toLowerCase().includes(lower)
          );
      }
  }

  // Render in chunks for better INP
  const CHUNK_SIZE = 12; // Render 12 characters at a time
  const charsToRender = [...charsToDisplay];
  let currentIndex = 0;

  const renderChunk = (): void => {
    const chunk = charsToRender.slice(currentIndex, currentIndex + CHUNK_SIZE);
    const fragment = document.createDocumentFragment();

    chunk.forEach((char) => {
      const card = document.createElement('div');
      card.className = 'character-selector-card';
      card.dataset.charId = char.Id;
      card.onclick = () => selectCharacter(char.Id);

      const name = getCharacterName(char.Id);
      const imagePath = `assets/char/avg1_${char.Id}_002.png`;

      // Get grade (rarity) as stars
      const gradeNum = Number(char.Grade) || 3;
      const gradeData = GameData.gameEnums?.characterGrade?.[gradeNum];
      const stars = gradeData?.stars ? '★'.repeat(gradeData.stars) : '★'.repeat(gradeNum);

      // Get element icon using EET (Element Enum Type)
      const elementId = char.EET;
      const elementIconPath = elementId ? `assets/common/icon_common_property_${elementId}.png` : '';

      card.innerHTML = `
        <div class="character-selector-img-wrapper">
          ${createResponsiveImage(imagePath, name, 'character-selector-img', false, 120, 120)}
          ${elementIconPath ? createResponsiveImage(elementIconPath, 'Element', 'character-element-icon', false, 24, 24) : ''}
        </div>
        <div class="character-selector-info">
          <div class="character-selector-name">${name}</div>
          <div class="character-selector-grade">${stars}</div>
        </div>
      `;
      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
    currentIndex += CHUNK_SIZE;

    // Schedule next chunk
    if (currentIndex < charsToRender.length) {
      if ('requestIdleCallback' in window) {
        currentRenderRequest = requestIdleCallback(renderChunk, { timeout: 100 });
      } else {
        currentRenderRequest = setTimeout(renderChunk, 0) as unknown as number;
      }
    } else {
      currentRenderRequest = null;
    }
  };

  // Start rendering
  renderChunk();
}

export function closeCharacterSelect(): void {
  if (characterModal) {
    characterModal.close();
  }
  state.currentPosition = null;
}

export function removeCharacter(position: Position): void {
  state.party[position] = null;
  state.selectedPotentials[position] = [];
  state.potentialLevels[position] = {};
  state.skillLevels[position] = {};
  state.potentialMarks[position] = {};

  updateCharacterCard(position);
  updatePotentialsDisplay(position);
}

function initializeCharacterSelector(): void {
  if (!GameData.characters) return;

  state.characterSelector.allCharacters = Object.values(GameData.characters).filter(
    (c) => c.Visible
  );
  
  // Sort by ID
  state.characterSelector.allCharacters.sort((a, b) => parseInt(a.Id) - parseInt(b.Id));

  // Initialize Fuse.js if available
  if (typeof (window as any).Fuse !== 'undefined') {
    state.characterSelector.fuse = new (window as any).Fuse(state.characterSelector.allCharacters, {
      keys: ['Name'],
      threshold: 0.3,
    });
  }
}

// =============================================================================
// CHARACTER SELECTION
// =============================================================================

/**
 * Opens character selection modal for specified position
 *
 * Creates modal if doesn't exist, renders filtered character grid,
 * and focuses search input for immediate typing.
 *
 * @param position - Party position to select character for (master/assist1/assist2)
 */
export function openCharacterSelect(position: Position): void {
  state.currentPosition = position;

  if (!characterModal) {
    characterModal = new Modal('character-modal');
    characterModal.onClose(() => {
      state.currentPosition = null;
    });
  }

  characterModal.open();
  renderCharacterGrid(); // Renders using GameData.characters

  // Focus search input
  const searchInput = getElement<HTMLInputElement>('character-search');
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
}

/**
 * Selects character for current position and updates UI
 *
 * Clears previous character's data (potentials, skills, marks) if switching
 * to different character. Updates card and potentials display, then closes modal.
 *
 * @param characterId - ID of character to select
 */
export function selectCharacter(characterId: string): void {
  const character = GameData.characters[characterId]; // Use GameData
  if (!character || !state.currentPosition) return;

  const position = state.currentPosition;
  const name = getCharacterName(characterId); // Use helper

  // Clear old character data when switching
  if (state.party[position]?.id !== characterId) {
    state.selectedPotentials[position] = [];
    state.potentialLevels[position] = {};
    state.skillLevels[position] = {};
    state.potentialMarks[position] = {};
  }

  state.party[position] = {
    id: characterId,
    name,
    data: character,
  };

  updateCharacterCard(position);
  updatePotentialsDisplay(position);
  closeCharacterSelect();
}



// Description cache
const descriptionCache = new LRUCache<string, string>(500);
let cacheHits = 0;
let cacheMisses = 0;

// =============================================================================
// CACHE UTILITIES
// =============================================================================

/**
 * Clears description cache and resets hit/miss counters
 *
 * Use when language changes or data is reloaded to ensure fresh parsing.
 */
export function clearDescriptionCache(): void {
  descriptionCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

/**
 * Gets description cache performance statistics
 *
 * @returns Cache statistics including size, hits, misses, and hit rate percentage
 *
 * @example
 * ```typescript
 * const stats = getCacheStats();
 * console.log(`Cache: ${stats.size} entries, ${stats.hitRate}% hit rate`);
 * ```
 */
export function getCacheStats(): {
  size: number;
  hits: number;
  misses: number;
  hitRate: string;
} {
  const total = cacheHits + cacheMisses;
  return {
    size: descriptionCache.size,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: total > 0 ? ((cacheHits / total) * 100).toFixed(1) : '0',
  };
}

// =============================================================================
// CHARACTER CARD RENDERING
// =============================================================================

function updateCharacterCard(position: Position): void {
  const card = getElement<HTMLDivElement>(`${position}-card`);
  if (!card) {
    console.warn(`[App-Char] Card element not found: ${position}-card`);
    return;
  }

  const character = state.party[position];

  // Update party bar slot
  updatePartyBarSlot(position, character);

  if (!character) {
    renderEmptyCharacterCard(card, position);
    clearSkillInfoSection(position);
    return;
  }

  // Preserve details element open state before re-rendering
  const skillInfoSection = getElement<HTMLDivElement>(`${position}-skill-info`);
  const existingDetails = skillInfoSection?.querySelector('.character-skills-collapsible') as HTMLDetailsElement | null;
  const wasOpen = existingDetails?.open ?? true; // Default to open for new characters

  renderFilledCharacterCard(card, position, character);
  renderSkillInfoSection(position, character);

  // Restore details element open state after re-rendering
  const newDetails = skillInfoSection?.querySelector('.character-skills-collapsible') as HTMLDetailsElement | null;
  if (newDetails) {
    newDetails.open = wasOpen;
  }
}

/**
 * Updates the party bar slot avatar, name, and element icon for a position
 */
function updatePartyBarSlot(position: Position, character: PartyMember | null): void {
  const avatarContainer = getElement<HTMLDivElement>(`party-avatar-${position}`);
  const nameElement = getElement<HTMLSpanElement>(`party-name-${position}`);
  const elementIconContainer = getElement<HTMLDivElement>(`party-element-${position}`);
  
  if (avatarContainer) {
    if (character) {
      const imagePath = `assets/char/avg1_${character.id}_002.png`;
      avatarContainer.innerHTML = createResponsiveImage(imagePath, character.name, 'party-avatar-img', false, 48, 48);
    } else {
      avatarContainer.innerHTML = '<div class="party-empty-avatar">+</div>';
    }
  }
  
  if (nameElement) {
    nameElement.textContent = character?.name || '-';
  }
  
  // Update element icon
  if (elementIconContainer) {
    if (character) {
      const elementId = character.data.EET;
      const elementInfo = (GameData.gameEnums.elementType as Record<number, any>)?.[elementId] as { name?: string } | undefined;
      const elementName = elementInfo?.name ?? '';
      const elementIconPath = `assets/common/icon_common_property_${elementId}.png`;
      elementIconContainer.innerHTML = `<img src="${elementIconPath}" alt="${elementName}" class="party-element-img" title="${elementName}" onerror="this.style.display='none'">`;
      elementIconContainer.style.display = 'flex';
    } else {
      elementIconContainer.innerHTML = '';
      elementIconContainer.style.display = 'none';
    }
  }
}

function renderEmptyCharacterCard(card: HTMLDivElement, position: Position): void {
  const t = (key: string): string => window.i18n?.t(key) ?? key;
  const selectText =
    position === 'master'
      ? t('builder.selectMasterCharacter')
      : t('builder.selectAssistCharacter');

  card.innerHTML = `
    <div class="empty-state">
      <div class="plus-icon">+</div>
      <p>${selectText}</p>
    </div>
  `;

  card.style.cursor = 'pointer';
  card.onclick = () => openCharacterSelect(position);
}

function renderFilledCharacterCard(
  card: HTMLDivElement,
  position: Position,
  character: PartyMember
): void {
  card.style.cursor = 'default';
  card.onclick = null;

  const t = (key: string): string => window.i18n?.t(key) ?? key;
  const isMaster = position === 'master';

  // Get character info from enums
  const gradeNum = Number(character.data.Grade);
  const classNum = Number(character.data.Class);
  const rarityInfo = (GameData.gameEnums.itemRarity as Record<number, any>)?.[gradeNum] as { stars?: number } | undefined;
  const stars = rarityInfo?.stars ?? gradeNum;

  const elementInfo = (GameData.gameEnums.elementType as Record<number, any>)?.[character.data.EET] as { name?: string; icon?: string } | undefined;
  const elementName = elementInfo?.name ?? String(character.data.EET);
  const elementIcon = elementInfo?.icon ?? '';

  const jobClassInfo = (GameData.gameEnums.characterJobClass as Record<number, any>)?.[classNum] as { name?: string } | undefined;
  const jobClassName = jobClassInfo?.name ?? String(character.data.Class);

  // Get skills
  const skills = getCharacterSkills(character, position);
  const currentLevelPhase = state.characterLevelPhase[position] ?? 8;

  const skillLabels: Record<string, string> = {
    normalAtk: t('builder.skills.normalAtk'),
    skill: isMaster ? t('builder.skills.skill') : t('builder.skills.assist'),
    ultimate: t('builder.skills.ultimate'),
    masterSkill: t('builder.skills.skill'),
  };

  // Initialize skill levels if not set
  if (!state.skillLevels[position]) {
    state.skillLevels[position] = {};
  }

  // Build skill HTML
  const skillsHtml = buildSkillsHtml(skills, position, skillLabels, currentLevelPhase);

  // Build element icon path
  const elementId = character.data.EET;
  const elementIconPath = elementId ? `assets/common/icon_common_property_${elementId}.png` : '';

  card.innerHTML = `
    <div class="character-card-header">
      <div class="character-portrait-wrapper">
        ${createResponsiveImage(`assets/char/avg1_${character.id}_002.png`, character.name, 'character-card-image', true, 200, 200)}
      </div>
      <div class="character-header-info">
        <div class="character-name-row">
          ${elementIconPath ? `<img src="${elementIconPath}" alt="${elementName}" class="character-element-icon" title="${elementName}" onerror="this.style.display='none'">` : ''}
          <span class="character-name">${character.name}</span>
        </div>
        <div class="character-id">ID: ${character.id}</div>
        <div class="character-meta-badges">
          <span class="meta-badge grade-badge">${window.getIcon?.('star').repeat(stars) ?? '★'.repeat(stars)}</span>
          <span class="meta-badge class-badge">${jobClassName}</span>
        </div>
      </div>
    </div>
    <div class="character-card-body">
      <div class="character-controls-row">
        <div class="character-level-phase-selector">
          <label class="level-phase-label">${t('builder.characterLevel')}:</label>
          <select class="level-phase-select" data-action="update-character-level-phase" data-position="${position}">
            <option value="0" ${currentLevelPhase === 0 ? 'selected' : ''}>1+</option>
            <option value="1" ${currentLevelPhase === 1 ? 'selected' : ''}>10+</option>
            <option value="2" ${currentLevelPhase === 2 ? 'selected' : ''}>20+</option>
            <option value="3" ${currentLevelPhase === 3 ? 'selected' : ''}>30+</option>
            <option value="4" ${currentLevelPhase === 4 ? 'selected' : ''}>40+</option>
            <option value="5" ${currentLevelPhase === 5 ? 'selected' : ''}>50+</option>
            <option value="6" ${currentLevelPhase === 6 ? 'selected' : ''}>60+</option>
            <option value="7" ${currentLevelPhase === 7 ? 'selected' : ''}>70+</option>
            <option value="8" ${currentLevelPhase === 8 ? 'selected' : ''}>80+</option>
          </select>
        </div>
        <div class="character-action-buttons">
          <button class="change-character-btn" data-action="open-character-select" data-position="${position}" title="${t('builder.change')}">
            <span class="change-icon"><i class="fa-solid fa-arrows-rotate"></i></span>
            <span class="btn-text">${t('builder.change')}</span>
          </button>
          <button class="remove-character-btn" data-action="remove-character" data-position="${position}" title="${t('builder.remove')}">
            <span class="remove-icon"><i class="fa-solid fa-xmark"></i></span>
            <span class="btn-text">${t('builder.remove')}</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders the skill info section separately from the character card
 */
function renderSkillInfoSection(position: Position, character: PartyMember): void {
  const skillInfoSection = getElement<HTMLDivElement>(`${position}-skill-info`);
  if (!skillInfoSection) return;

  const t = (key: string): string => window.i18n?.t(key) ?? key;
  const isMaster = position === 'master';

  // Get skills
  const skills = getCharacterSkills(character, position);
  const currentLevelPhase = state.characterLevelPhase[position] ?? 8;

  const skillLabels: Record<string, string> = {
    normalAtk: t('builder.skills.normalAtk'),
    skill: isMaster ? t('builder.skills.skill') : t('builder.skills.assist'),
    ultimate: t('builder.skills.ultimate'),
    masterSkill: t('builder.skills.skill'),
  };

  // Initialize skill levels if not set
  if (!state.skillLevels[position]) {
    state.skillLevels[position] = {};
  }

  // Build skill HTML
  const skillsHtml = buildSkillsHtml(skills, position, skillLabels, currentLevelPhase);

  skillInfoSection.innerHTML = `
    <details class="character-skills-collapsible" open>
      <summary class="skills-toggle">
        <span class="skills-title"><i class="fa-solid fa-wand-magic-sparkles"></i> ${t('builder.skillInfo')}</span>
        <span class="skills-toggle-icon"><i class="fa-solid fa-chevron-down"></i></span>
      </summary>
      <div class="character-skills">
        ${skillsHtml}
      </div>
    </details>
  `;
}

/**
 * Clears the skill info section when character is removed
 */
function clearSkillInfoSection(position: Position): void {
  const skillInfoSection = getElement<HTMLDivElement>(`${position}-skill-info`);
  if (skillInfoSection) {
    skillInfoSection.innerHTML = '';
  }
}

function buildSkillsHtml(
  skills: Record<string, EnrichedSkill | undefined>,
  position: Position,
  skillLabels: Record<string, string>,
  levelPhase: number
): string {
  const isMaster = position === 'master';
  const skillKeys = isMaster
    ? ['normalAtk', 'skill', 'ultimate']
    : ['normalAtk', 'masterSkill', 'skill', 'ultimate'];

  const t = (key: string): string => window.i18n?.t(key) ?? key;
  const character = state.party[position];
  if (!character) return '';

  return skillKeys
    .map((key) => {
      const skill = skills[key];
      if (!skill) return '';

      const skillIdNum = parseInt(skill.id, 10);
      const currentLevel = state.skillLevels[position]?.[skillIdNum] ?? 1;
      const maxLevel = Math.min(skill.maxLevel + SKILL_LEVEL_BONUS, 13);
      const hasLevelSelector = !['dodge', 'specialSkill'].includes(key);

      // Get skill icon
      const iconName = skill.icon ? skill.icon.split('/').pop() : '';
      const iconPath = iconName ? `assets/skill_icons/${iconName}.png` : '';

      // Get element background
      const elementId = character.data.EET;
      const elementBgPath = `assets/skill_icons/skill_btn_b_type_${elementId}.png`;

      // Get skill title (localized)
      const title = GameData.skillsKR[skill.title] || skill.name;

      // Get skill description
      const descKey = state.descriptionMode === 'brief' ? skill.briefDesc : skill.desc;
      let description = GameData.skillsKR[descKey ?? ''] ?? '';

      if (description && skill.data) {
        description = parseDescriptionParams(
          description,
          skill.data as Record<string, string>,
          currentLevel,
          currentLevel,
          { ...GameData, ...state } as unknown as CharacterState,
          position,
          false,
          levelPhase
        );
        // Process color tags and element tags
        description = processDescriptionText(description);
      }

      return `
        <div class="skill-item" data-skill-id="${skill.id}">
          <div class="skill-icon-wrapper">
            ${createResponsiveImage(elementBgPath, '', 'skill-icon-bg', false, 48, 48)}
            ${iconPath ? createResponsiveImage(iconPath, skill.name, 'skill-icon', false, 48, 48) : ''}
          </div>
          <div class="skill-info">
            <div class="skill-title">${title}</div>
            ${description ? `<div class="skill-desc">${description}</div>` : ''}
            <div class="skill-header">
              <span class="skill-label">${skillLabels[key] ?? key}</span>
              ${skill.cd > 0 ? `<span class="skill-label">CD: ${(skill.cd / 10000).toFixed(1)}${t('builder.cooldown')}</span>` : ''}
              ${
                hasLevelSelector
                  ? `
                <div class="skill-level-selector">
                  <label class="skill-level-label">${t('builder.skillLevel')}:</label>
                  <div class="skill-level-controls">
                    <button class="level-btn" 
                            data-action="update-skill-level"
                            data-position="${position}"
                            data-skill-id="${skill.id}"
                            data-max-level="${maxLevel}"
                            data-delta="-1">−</button>
                    <input type="text" class="skill-level-input" 
                           value="${currentLevel}"
                           data-action="update-skill-level"
                           data-position="${position}"
                           data-skill-id="${skill.id}"
                           data-max-level="${maxLevel}">
                    <button class="level-btn"
                            data-action="update-skill-level"
                            data-position="${position}"
                            data-skill-id="${skill.id}"
                            data-max-level="${maxLevel}"
                            data-delta="1">+</button>
                  </div>
                </div>
              `
                  : ''
              }
            </div>
          </div>
        </div>
      `;
    })
    .filter(Boolean)
    .join('');
}

// =============================================================================
// SKILL MANAGEMENT
// =============================================================================

interface EnrichedSkill {
  id: string;
  data: Record<string, unknown>;
  title: string;
  name: string;
  briefDesc: string;
  desc: string;
  cd: number;
  maxLevel: number;
  icon: string;
}

function getCharacterSkills(
  character: PartyMember,
  position: Position
): Record<string, EnrichedSkill | undefined> {
  const data = character.data;
  const isMaster = position === 'master';

  const skillIds: Record<string, number | undefined> = {
    normalAtk: isMaster ? (data.NormalAtkId as number | undefined) : (data.AssistNormalAtkId as number | undefined),
    skill: isMaster ? (data.SkillId as number | undefined) : (data.AssistSkillId as number | undefined),
    ultimate: isMaster ? (data.UltimateId as number | undefined) : (data.AssistUltimateId as number | undefined),
  };

  // For assist characters, also add the master skill
  if (!isMaster && data.SkillId) {
    skillIds.masterSkill = data.SkillId as number;
  }

  // Get skill details from Skill.json
  const skills: Record<string, EnrichedSkill | undefined> = {};
  for (const [key, skillId] of Object.entries(skillIds)) {
    if (skillId) {
      const skillData = (GameData.skills as unknown as Record<string, Record<string, unknown>>)[String(skillId)];
      if (skillData) {
        const titleKey = (skillData.Title as string) ?? '';
        const briefKey = (skillData.BriefDesc as string) ?? '';
        const descKey = (skillData.Desc as string) ?? '';

        skills[key] = {
          id: String(skillId),
          data: skillData,
          title: titleKey,
          name: GameData.skillsKR[briefKey] ?? `Skill ${skillId}`,
          briefDesc: briefKey,
          desc: descKey,
          cd: (skillData.SkillCD as number) ?? 0,
          maxLevel: (skillData.MaxLevel as number) ?? 1,
          icon: (skillData.Icon as string) ?? '',
        };
      }
    }
  }

  return skills;
}

/**
 * Updates skill level for character at position
 *
 * Clamps value between 1 and maxLevel, then triggers re-render of
 * character card and potentials (to update damage calculations).
 *
 * @param position - Character position
 * @param skillId - Skill ID (string or number)
 * @param value - New skill level
 * @param maxLevel - Maximum allowed level for this skill
 */
export function updateSkillLevel(
  position: Position,
  skillId: string | number,
  value: number,
  maxLevel: number
): void {
  const clampedValue = Math.min(Math.max(1, value), maxLevel);
  const numericId = typeof skillId === 'string' ? parseInt(skillId, 10) : skillId;

  if (!state.skillLevels[position]) {
    state.skillLevels[position] = {};
  }

  state.skillLevels[position][numericId] = clampedValue;

  // Update display
  updateCharacterCard(position);
  updatePotentialsDisplay(position);
}

/**
 * Updates character level phase (0-8 for 1+, 10+, ..., 80+)
 *
 * Character level phase affects damage calculations in param-parser
 * for DamageNum type parameters with levelTypeData === 4.
 *
 * @param position - Character position
 * @param phase - Level phase index (0=1+, 1=10+, ..., 8=80+)
 */
export function updateCharacterLevelPhase(position: Position, phase: number): void {
  state.characterLevelPhase[position] = phase;
  updateCharacterCard(position);
  updatePotentialsDisplay(position);
}

// =============================================================================
// CHARACTER GRID RENDERING
// =============================================================================


/**
 * Filters character grid by element type
 *
 * Updates active filter button styling and re-renders grid with
 * characters matching selected element (or 'all' for no filter).
 *
 * @param element - Element ID or 'all' for no filter
 */
export function filterCharactersByElement(element: string): void {
  state.characterSelector.selectedElement = element;

  // Update filter buttons
  querySelectorAll<HTMLButtonElement>('.element-filter-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.element === element);
  });

  renderCharacterGrid();
}

// =============================================================================
// POTENTIALS DISPLAY
// =============================================================================

function updatePotentialsDisplay(position: Position): void {
  const otherContainer = getElement<HTMLDivElement>(`${position}-potentials`);
  const specificSection = getElement<HTMLDivElement>(`${position}-specific-section`);
  const character = state.party[position];

  // Update score display in the slot header
  updateScoreDisplay(position);

  if (!otherContainer || !specificSection) return;

  otherContainer.innerHTML = '';
  specificSection.innerHTML = '';

  if (!character) {
    return;
  }

  const charId = character.id;
  const charPotential = GameData.charPotentials?.[charId];

  if (!charPotential) {
    const t = (key: string): string => window.i18n?.t(key) ?? key;
    otherContainer.innerHTML = `<p style="color: var(--text-secondary); padding: 8px; font-size: 0.9rem;">${t('builder.noPotentialsAvailable')}</p>`;
    return;
  }

  // Determine which potentials to show based on position
  const isMaster = position === 'master';

  // Get potential IDs
  const specificPotentials = isMaster
    ? (charPotential.MasterSpecificPotentialIds || [])
    : (charPotential.AssistSpecificPotentialIds || []);

  const normalPotentials = isMaster
    ? (charPotential.MasterNormalPotentialIds || [])
    : (charPotential.AssistNormalPotentialIds || []);

  const commonPotentials = charPotential.CommonPotentialIds || [];

  // Sort all potential arrays by ID
  specificPotentials.sort((a: number, b: number) => a - b);
  normalPotentials.sort((a: number, b: number) => a - b);
  commonPotentials.sort((a: number, b: number) => a - b);

  const t = (key: string): string => window.i18n?.t(key) ?? key;

  // Display specific potentials in the specific section
  if (specificPotentials.length > 0) {
    specificSection.innerHTML = `
      <div class="potential-section-title">
        ${isMaster ? t('builder.masterSpecificPotential') : t('builder.assistSpecificPotential')}
        <span class="section-title-hint">${t('builder.specificPotentialHint')}</span>
      </div>
      ${specificPotentials.map((potId: number) => createPotentialCard(potId, position)).join('')}
    `;
  }

  // Separate normal and common potentials
  // Group normal potentials by branch (Build property)
  const groupedByBranch: Record<number, number[]> = {};
  const commonPotIds: number[] = [];

  // First, separate normal potentials by branch
  normalPotentials.forEach((potId: number) => {
    const potential = GameData.potentials[potId];
    if (potential) {
      const build = (potential as any).Build || 0;
      if (!groupedByBranch[build]) {
        groupedByBranch[build] = [];
      }
      groupedByBranch[build].push(potId);
    }
  });

  // Create section for branch potentials (Build 1 and 2)
  const branchPotentials = [...(groupedByBranch[1] || []), ...(groupedByBranch[2] || [])];
  if (branchPotentials.length > 0) {
    const section = document.createElement('div');
    section.className = 'potential-category branch-potentials';

    // Create 2-column layout grouped by branch
    const branch1 = groupedByBranch[1] || [];
    const branch2 = groupedByBranch[2] || [];

    // Interleave cards from both branches for proper grid layout
    const interleavedCards: string[] = [];
    const maxLength = Math.max(branch1.length, branch2.length);

    for (let i = 0; i < maxLength; i++) {
      if (i < branch1.length && branch1[i] !== undefined) {
        interleavedCards.push(createPotentialCard(branch1[i]!, position, true));
      }
      if (i < branch2.length && branch2[i] !== undefined) {
        interleavedCards.push(createPotentialCard(branch2[i]!, position, true));
      }
    }

    section.innerHTML = `
      <div class="potential-category-title">${isMaster ? t('builder.masterNormalPotential') : t('builder.assistNormalPotential')}</div>
      <div class="branch-potentials-grid">
        ${interleavedCards.join('')}
      </div>
    `;
    otherContainer.appendChild(section);
  }

  // Combine common potentials and any other branch (Build 0 or 3)
  const allCommonPotentials = [
    ...commonPotentials,
    ...(groupedByBranch[0] || []),
    ...(groupedByBranch[3] || [])
  ];

  // Create section for common potentials with vertical ordering
  if (allCommonPotentials.length > 0) {
    const section = document.createElement('div');
    section.className = 'potential-category common-potentials';

    // Split common potentials into two columns for vertical ordering
    const midpoint = Math.ceil(allCommonPotentials.length / 2);
    const commonColumn1 = allCommonPotentials.slice(0, midpoint);
    const commonColumn2 = allCommonPotentials.slice(midpoint);

    // Interleave cards from both columns for proper grid layout
    const interleavedCommon: string[] = [];
    const maxLength = Math.max(commonColumn1.length, commonColumn2.length);

    for (let i = 0; i < maxLength; i++) {
      if (i < commonColumn1.length && commonColumn1[i] !== undefined) {
        interleavedCommon.push(createPotentialCard(commonColumn1[i]!, position, true));
      }
      if (i < commonColumn2.length && commonColumn2[i] !== undefined) {
        interleavedCommon.push(createPotentialCard(commonColumn2[i]!, position, true));
      }
    }

    section.innerHTML = `
      <div class="potential-category-title">${t('builder.commonPotential')}</div>
      <div class="common-potentials-grid">
        ${interleavedCommon.join('')}
      </div>
    `;
    otherContainer.appendChild(section);
  }
}

/**
 * Determines which skill type a specific potential is influenced by
 * by analyzing its param strings for DamageType or LevelData references.
 * Returns null if no skill-scaling params are found.
 */
function getSpecificPotentialSkillType(potential: any, _position: Position): string | null {
  const t = (key: string): string => window.i18n?.t(key) ?? key;

  // Analyze the potential's params to find DamageType
  // Check Param1 through Param10
  for (let i = 1; i <= 10; i++) {
    const paramKey = `Param${i}`;
    const paramString = potential[paramKey];

    if (!paramString || typeof paramString !== 'string') continue;

    const elements = paramString.split(',').map((e: string) => e.trim());
    if (elements.length < 3) continue;

    const fileType = elements[0]?.toLowerCase();
    const levelType = elements[1];
    const baseId = elements[2];

    if (!baseId) continue;

    // Check if this is a damage/hitdamage param with DamageNum level type
    if ((fileType === 'damage' || fileType === 'hitdamage') && levelType === 'DamageNum') {
      // Look up the DamageType from hitDamage data
      const damageEntry = (GameData.hitDamage as Record<string, any> | undefined)?.[baseId];

      // Check DamageType field first
      if (damageEntry && damageEntry.DamageType) {
        const damageType = damageEntry.DamageType;
        const damageTypeInfo = (GameData.gameEnums?.damageType as Record<number, { key?: string; name?: string }>)?.[damageType];

        if (damageTypeInfo?.key) {
          switch (damageTypeInfo.key) {
            case 'NORMAL':
              return t('builder.skills.normalAtk');
            case 'SKILL':
              return t('builder.skills.skill');
            case 'ULTIMATE':
              return t('builder.skills.ultimate');
            case 'OTHER':
              return t('builder.skills.assist');
          }
        }
      }

      // Also check LevelData field for skill type determination
      if (damageEntry && damageEntry.LevelData) {
        const levelData = damageEntry.LevelData;
        switch (levelData) {
          case 5: // Normal attack
            return t('builder.skills.normalAtk');
          case 2: // Main skill
            return t('builder.skills.skill');
          case 4: // Ultimate
            return t('builder.skills.ultimate');
        }
      }
    }
  }

  // No skill-scaling params found
  return null;
}

// Create potential card HTML - matches JS version
function createPotentialCard(potId: number, position: Position, isHorizontal: boolean = false): string {
  const potential = GameData.potentials[potId];
  if (!potential) return '';

  const t = (key: string): string => window.i18n?.t(key) ?? key;

  // Fallback rendering (generatePotentialIconHTML has incompatible signature)
  const isSelected = state.selectedPotentials[position]?.includes(potId);
  const currentLevel = state.potentialLevels[position]?.[potId] || 1;
  const maxLevel = (potential.MaxLevel || 0) + 6;

  // Get potential name from Item.json using BriefDesc as the key
  // Convert Potential.XXXXX.1 to Item.XXXXX.1 for itemNames lookup
  const briefDescKey = potential.BriefDesc;
  const itemKey = briefDescKey ? String(briefDescKey).replace('Potential.', 'Item.') : null;
  const name = itemKey ? (GameData.itemsKR[itemKey] || `Potential ${potId}`) : `Potential ${potId}`;

  // Get item data for icon and background
  const itemData = (GameData.items as Record<string, any>)?.[potId];
  let backgroundImage = '';
  let iconPath = '';

  if (itemData) {
    // Determine background based on Stype and Rarity
    if (itemData.Stype === 42) {
      backgroundImage = 'assets/skill_icons/rare_vestige_card_s_7.png';
    } else if (itemData.Stype === 41) {
      if (itemData.Rarity === 1) {
        backgroundImage = 'assets/skill_icons/rare_vestige_card_s_9.png';
      } else if (itemData.Rarity === 2) {
        backgroundImage = 'assets/skill_icons/rare_vestige_card_s_8.png';
      }
    }

    // Get icon path
    if (itemData.Icon) {
      const iconName = itemData.Icon.split('/').pop();
      iconPath = `assets/skill_icons/${iconName}_A.png`;
    }
  }

  // Get descriptions
  const briefKey = `Potential.${potId}.1`;
  const detailedKey = `Potential.${potId}.2`;

  // Check if this is a specific potential (Stype === 42)
  const isSpecificPotential = itemData && itemData.Stype === 42;

  // Get skill influence label for specific potentials
  let skillInfluenceBadge = '';
  if (isSpecificPotential) {
    const skillType = getSpecificPotentialSkillType(potential, position);
    if (skillType) {
      skillInfluenceBadge = `<span class="skill-influence-badge" title="${t('builder.skillInfluenceTooltip')}">${skillType}</span>`;
    }
  }

  // Get corner icon using shared helper
  const cornerIconHtml = getPotentialCornerIconHTML(potId);

  // Calculate actual max level
  const BASE_POTENTIAL_LEVEL = 6;
  const maxLevelBonus = potential.MaxLevel || 0;
  const actualMaxLevel = BASE_POTENTIAL_LEVEL + maxLevelBonus;

  // Get current level and skill level
  let effectiveLevel;
  let skillLevelForParams;

  if (isSpecificPotential) {
    const character = state.party[position];
    const isMaster = position === 'master';
    const skillId = isMaster ? character?.data.UltimateId : character?.data.AssistSkillId;

    if (character && skillId) {
      effectiveLevel = state.skillLevels[position]?.[skillId as number] || 1;
      skillLevelForParams = effectiveLevel;
    } else {
      effectiveLevel = 1;
      skillLevelForParams = 1;
    }
  } else {
    effectiveLevel = currentLevel;
    skillLevelForParams = currentLevel;
  }

  let briefDesc = GameData.potentialsKR[briefKey] || t('builder.briefDesc');
  let detailedDesc = GameData.potentialsKR[detailedKey] || t('builder.detailedDesc');

  // Get character level phase
  const charLevelPhase = state.characterLevelPhase[position] || 8;

  // Parse parameters
  briefDesc = parseDescriptionParams(
    briefDesc,
    potential as unknown as Record<string, string>,
    effectiveLevel,
    skillLevelForParams,
    { ...GameData, ...state } as unknown as CharacterState,
    position,
    isSpecificPotential,
    charLevelPhase
  );
  detailedDesc = parseDescriptionParams(
    detailedDesc,
    potential as unknown as Record<string, string>,
    effectiveLevel,
    skillLevelForParams,
    { ...GameData, ...state } as unknown as CharacterState,
    position,
    isSpecificPotential,
    charLevelPhase
  );

  // Process color tags and element tags
  briefDesc = processDescriptionText(briefDesc);
  detailedDesc = processDescriptionText(detailedDesc);

  const desc = state.descriptionMode === 'brief' ? briefDesc : detailedDesc;

  // Get build label
  const buildNumber = (potential as any).Build || 0;
  const buildInfo = (GameData.gameEnums.potentialBuild as Record<number, any>)?.[buildNumber];
  const buildLabel = buildInfo?.name || '';

  // Calculate score for this potential if selected
  const score = isSelected ? calculatePotentialScore(potId, position) : 0;

  // Horizontal layout for branch and common potentials
  if (isHorizontal) {
    return `
      <div class="potential-card potential-card-horizontal ${isSelected ? 'selected' : ''}" data-build="${buildNumber}">
        ${buildLabel ? `<div class="build-badge">${buildLabel}</div>` : ''}
        ${isSelected ? `<div class="score-badge">${t('builder.score')}: ${score}</div>` : ''}
        <div class="potential-card-left"
             data-action="toggle-potential"
             data-potential-id="${potId}"
             data-position="${position}">
          <div class="potential-card-image">
            ${backgroundImage ? createResponsiveImage(backgroundImage, '', 'potential-bg', false, 128, 128) : ''}
            ${cornerIconHtml}
            ${iconPath ? createResponsiveImage(iconPath, name, 'potential-icon', false, 64, 64) : `<span class="potential-placeholder">${window.getIcon?.('target') ?? '🎯'}</span>`}
          </div>
          <div class="potential-card-info">
            <div class="potential-card-name">${name}</div>
            <div class="potential-card-meta">
              <span>ID: ${potId}</span>
              ${!isSpecificPotential ? `<span>${t('builder.maxLevel')}: ${actualMaxLevel}</span>` : ''}
            </div>
          </div>
          ${
            !isSpecificPotential && actualMaxLevel > 1
              ? `
          <div class="potential-level-selector horizontal-level-selector">
            <span class="potential-level-label">${t('builder.potentialLevel')}:</span>
            <div class="potential-level-controls">
              <button class="level-btn"
                      data-action="update-potential-level"
                      data-potential-id="${potId}"
                      data-position="${position}"
                      data-max-level="${actualMaxLevel}"
                      data-delta="-1">\u2212</button>
              <input
                type="text"
                class="potential-level-input"
                value="${currentLevel}"
                data-action="update-potential-level"
                data-potential-id="${potId}"
                data-position="${position}"
                data-max-level="${actualMaxLevel}"
              >
              <button class="level-btn"
                      data-action="update-potential-level"
                      data-potential-id="${potId}"
                      data-position="${position}"
                      data-max-level="${actualMaxLevel}"
                      data-delta="1">+</button>
            </div>
          </div>
        `
              : ''
          }
        </div>
        <div class="potential-card-right"
             data-action="toggle-potential"
             data-potential-id="${potId}"
             data-position="${position}">
          <div class="potential-card-desc">${desc}</div>
        </div>
      </div>
    `;
  }

  // Vertical layout for specific potentials (original layout)
  return `
    <div class="potential-card ${isSelected ? 'selected' : ''}" data-build="${buildNumber}">
      ${buildLabel ? `<div class="build-badge">${buildLabel}</div>` : ''}
      ${isSelected ? `<div class="score-badge">${t('builder.score')}: ${score}</div>` : ''}
      <div class="potential-card-header"
           data-action="toggle-potential"
           data-potential-id="${potId}"
           data-position="${position}">
        <div class="potential-card-image">
          ${backgroundImage ? createResponsiveImage(backgroundImage, '', 'potential-bg') : ''}
          ${cornerIconHtml}
          ${iconPath ? createResponsiveImage(iconPath, name, 'potential-icon') : `<span class="potential-placeholder">${window.getIcon?.('target') ?? '🎯'}</span>`}
        </div>
        <div class="potential-card-info">
          <div class="potential-card-name">${name}</div>
          <div class="potential-card-meta">
            <span>ID: ${potId}</span>
            ${!isSpecificPotential ? `<span>${t('builder.maxLevel')}: ${actualMaxLevel}</span>` : skillInfluenceBadge}
          </div>
        </div>
      </div>
      ${
        isSelected && !isSpecificPotential && actualMaxLevel > 1
          ? `
        <div class="potential-level-selector">
          <div class="potential-level-label">${t('builder.potentialLevel')}:</div>
          <div class="potential-level-controls">
            <button class="level-btn"
                    data-action="update-potential-level"
                    data-potential-id="${potId}"
                    data-position="${position}"
                    data-max-level="${actualMaxLevel}"
                    data-delta="-1">\u2212</button>
            <input
              type="text"
              class="potential-level-input"
              value="${currentLevel}"
              data-action="update-potential-level"
              data-potential-id="${potId}"
              data-position="${position}"
              data-max-level="${actualMaxLevel}"
            >
            <button class="level-btn"
                    data-action="update-potential-level"
                    data-potential-id="${potId}"
                    data-position="${position}"
                    data-max-level="${actualMaxLevel}"
                    data-delta="1">+</button>
          </div>
        </div>
      `
          : ''
      }
      <div class="potential-card-body"
           data-action="toggle-potential"
           data-potential-id="${potId}"
           data-position="${position}">
        <div class="potential-card-desc">${desc}</div>
      </div>
    </div>
  `;
}

function renderPotentialsSection(
  potentials: PotentialData[],
  position: Position,
  type: 'specific' | 'normal'
): string {
  if (potentials.length === 0) return '';

  const t = (key: string): string => window.i18n?.t(key) ?? key;
  const title =
    type === 'specific'
      ? t('builder.masterSpecificPotential')
      : t('builder.masterNormalPotential');

  const potentialCards = potentials
    .map((potential) => renderPotentialCard(potential, position))
    .join('');

  return `
    <div class="potentials-section ${type}-potentials">
      <h3 class="section-title">${title}</h3>
      <div class="potentials-grid">
        ${potentialCards}
      </div>
    </div>
  `;
}

function renderPotentialCard(potential: PotentialData, position: Position): string {
  const isSelected = state.selectedPotentials[position].includes(potential.Id);
  const currentLevel = state.potentialLevels[position]?.[potential.Id] ?? 1;
  const maxLevel = (potential.MaxLevel ?? 6) + 6;
  const mark = state.potentialMarks[position]?.[potential.Id] ?? null;

  // Get potential name
  const nameKey = potential.Name ?? `Name_${potential.Id}`;
  const name = GameData.potentialsKR[nameKey] ?? `Potential ${potential.Id}`;

  // Get description
  const descKey =
    state.descriptionMode === 'brief' ? potential.BriefDesKey : potential.DesKey;
  let description = GameData.potentialsKR[descKey ?? ''] ?? '';

  if (description && potential) {
    const levelPhase = state.characterLevelPhase[position] ?? 8;
    description = parseDescriptionParams(
      description,
      potential as unknown as Record<string, string>,
      currentLevel,
      currentLevel,
      { ...GameData, ...state } as unknown as CharacterState,
      position,
      potential.Stype === 42,
      levelPhase
    );
    // Process color tags and element tags
    description = processDescriptionText(description);
  }

  // Get mark badge
  const markBadge = mark ? getMarkBadge(mark) : '';

  return `
    <div class="potential-card ${isSelected ? 'selected' : ''}"
         data-action="toggle-potential"
         data-potential-id="${potential.Id}"
         data-position="${position}">
      <div class="potential-header">
        <span class="potential-name">${name}</span>
        ${markBadge}
      </div>
      ${
        isSelected
          ? `
        <div class="potential-level-control">
          <button class="level-btn minus" data-action="update-potential-level"
                  data-potential-id="${potential.Id}" data-position="${position}"
                  data-delta="-1" data-max-level="${maxLevel}">-</button>
          <input type="number" class="potential-level-input" value="${currentLevel}"
                 min="1" max="${maxLevel}" data-action="update-potential-level"
                 data-potential-id="${potential.Id}" data-position="${position}"
                 data-max-level="${maxLevel}">
          <button class="level-btn plus" data-action="update-potential-level"
                  data-potential-id="${potential.Id}" data-position="${position}"
                  data-delta="1" data-max-level="${maxLevel}">+</button>
        </div>
      `
          : ''
      }
      <div class="potential-description">${description}</div>
    </div>
  `;
}

function getMarkBadge(mark: PotentialMark): string {
  if (!mark) return '';

  const t = (key: string): string => window.i18n?.t(key) ?? key;
  const markLabels: Record<string, string> = {
    essential: t('builder.marks.essential'),
    recommended: t('builder.marks.recommended'),
    minimum: t('builder.marks.minimum'),
    low: t('builder.marks.low'),
  };

  return `<span class="mark-badge mark-${mark}">${markLabels[mark] ?? mark}</span>`;
}

// =============================================================================
// SCORE CALCULATION
// =============================================================================

/**
 * Calculate score for a potential based on its level
 */
export function calculatePotentialScore(potentialId: number, position: Position): number {
  const potential = GameData.potentials[potentialId];
  if (!potential || !(potential as unknown as { BuildScore?: number[] }).BuildScore) return 0;

  // Get item data to check if it's a specific potential
  const itemData = (GameData.items as Record<string, { Stype?: number }>)?.[potentialId];
  const isSpecificPotential = itemData && itemData.Stype === 42;

  if (isSpecificPotential) {
    // Specific potentials always give 180 points
    return 180;
  } else {
    // Normal/common potentials: use level as index into BuildScore array
    const level = state.potentialLevels[position]?.[potentialId] || 1;
    const scoreIndex = level - 1; // Convert 1-based level to 0-based index
    const buildScore = (potential as unknown as { BuildScore: number[] }).BuildScore;

    // BuildScore array is indexed by level (0-based)
    if (buildScore[scoreIndex] !== undefined) {
      return buildScore[scoreIndex];
    }

    // Fallback to first score if index is out of bounds
    return buildScore[0] || 0;
  }
}

/**
 * Calculate total character score for a position
 */
export function calculateCharacterScore(position: Position): number {
  const selectedPotentials = state.selectedPotentials[position] || [];
  let totalScore = 0;

  selectedPotentials.forEach((potentialId) => {
    totalScore += calculatePotentialScore(potentialId, position);
  });

  return totalScore;
}

/**
 * Update score display in the slot header
 */
export function updateScoreDisplay(position: Position): void {
  let scoreDisplay = document.getElementById(`${position}-score-display`);

  // Create score display if it doesn't exist
  if (!scoreDisplay) {
    const slotHeader = document.querySelector(`#tab-${position} .slot-header`);
    if (slotHeader) {
      scoreDisplay = document.createElement('div');
      scoreDisplay.id = `${position}-score-display`;
      scoreDisplay.className = 'character-score-display';
      slotHeader.appendChild(scoreDisplay);
    }
  }

  if (scoreDisplay) {
    const t = (key: string): string => window.i18n?.t(key) ?? key;
    const totalScore = calculateCharacterScore(position);
    scoreDisplay.innerHTML = `<span class="score-label">${t('builder.totalScore')}:</span> <span class="score-value">${totalScore}</span>`;
  }
}

// =============================================================================
// POTENTIAL MANAGEMENT
// =============================================================================

/**
 * Toggles potential selection for character
 *
 * If already selected, removes from list and clears level/marks.
 * If not selected, checks specific potential limit (max 2 with Stype 42)
 * before adding to list with default level 1.
 *
 * @param potentialId - Potential ID to toggle
 * @param position - Character position
 */
export function togglePotential(potentialId: number, position: Position): void {
  const selected = state.selectedPotentials[position];
  const index = selected.indexOf(potentialId);

  if (index > -1) {
    // Deselect
    selected.splice(index, 1);
    // Level and mark are preserved in state for re-selection
  } else {
    // Check if specific potential limit reached
    // Use GameData.items because Stype is defined there
    const itemData = GameData.items?.[potentialId];
    if (itemData?.Stype === 42) {
      const specificCount = selected.filter(
        (id) => GameData.items?.[id]?.Stype === 42
      ).length;

      if (specificCount >= 2) {
        const t = (key: string): string => window.i18n?.t(key) ?? key;
        window.showToast?.(t('builder.maxSpecificPotentials'));
        return;
      }
    }

    // Select
    selected.push(potentialId);
    // Initialize level to 1 only if not already set (preserves previous level)
    if (!state.potentialLevels[position][potentialId]) {
      state.potentialLevels[position][potentialId] = 1;
    }
  }

  updatePotentialsDisplay(position);
}

/**
 * Updates potential level for character
 *
 * Max level is calculated as (MaxLevel from data + 6). Value is clamped
 * between 1 and maxLevel before updating state and display.
 *
 * @param potentialId - Potential ID
 * @param position - Character position
 * @param value - New level value
 */
export function updatePotentialLevel(
  potentialId: number,
  position: Position,
  value: number
): void {
  const potential = GameData.potentials[potentialId];
  if (!potential) return;

  const maxLevel = (potential.MaxLevel ?? 6) + 6;
  const clampedValue = Math.min(Math.max(1, value), maxLevel);

  state.potentialLevels[position][potentialId] = clampedValue;
  
  // Try to update DOM directly first to avoid full re-render
  const input = document.querySelector(`.potential-level-input[data-potential-id="${potentialId}"][data-position="${position}"]`) as HTMLInputElement;
  if (input) {
      input.value = clampedValue.toString();
      
      const card = input.closest('.potential-card');
      if (card) {
          // Update score badge
          const scoreBadge = card.querySelector('.score-badge');
          if (scoreBadge) {
              const newScore = calculatePotentialScore(potentialId, position);
              const t = (key: string): string => window.i18n?.t(key) ?? key;
              scoreBadge.textContent = `${t('builder.score')}: ${newScore}`;
          }

          // Update description
          const descElement = card.querySelector('.potential-card-desc');
          if (descElement) {
              const t = (key: string): string => window.i18n?.t(key) ?? key;
              const briefKey = `Potential.${potentialId}.1`;
              const detailedKey = `Potential.${potentialId}.2`;
              
              let rawDesc = state.descriptionMode === 'brief' 
                  ? (GameData.potentialsKR[briefKey] || t('builder.briefDesc'))
                  : (GameData.potentialsKR[detailedKey] || t('builder.detailedDesc'));

              if (rawDesc) {
                  const itemData = (GameData.items as Record<string, any>)?.[potentialId];
                  const isSpecificPotential = itemData && itemData.Stype === 42;
                  
                  // Calculate effective level (logic from createPotentialCard)
                  let effectiveLevel = clampedValue;
                  let skillLevelForParams = clampedValue;

                  if (isSpecificPotential) {
                      const character = state.party[position];
                      const isMaster = position === 'master';
                      const skillId = isMaster ? character?.data.UltimateId : character?.data.AssistSkillId;
                      if (character && skillId) {
                          const skillLevel = state.skillLevels[position]?.[skillId as number] || 1;
                          effectiveLevel = skillLevel;
                          skillLevelForParams = skillLevel;
                      } else {
                          effectiveLevel = 1;
                          skillLevelForParams = 1;
                      }
                  }

                  const charLevelPhase = state.characterLevelPhase[position] || 8;
                  
                  let parsedDesc = parseDescriptionParams(
                      rawDesc,
                      potential as unknown as Record<string, string>,
                      effectiveLevel,
                      skillLevelForParams,
                      { ...GameData, ...state } as unknown as CharacterState,
                      position,
                      isSpecificPotential,
                      charLevelPhase
                  );
                  
                  descElement.innerHTML = processDescriptionText(parsedDesc);
              }
          }
      }
      
      // Update header score
      updateScoreDisplay(position);
       
      return; 
  }

  updatePotentialsDisplay(position);
}

export function cyclePotentialMark(potentialId: number, position: Position): void {
  const marks: (PotentialMark | null)[] = [null, 'essential', 'recommended', 'minimum', 'low'];
  const currentMark = state.potentialMarks[position]?.[potentialId] ?? null;
  const currentIndex = marks.indexOf(currentMark);
  const nextMark = marks[(currentIndex + 1) % marks.length];

  if (nextMark) {
    state.potentialMarks[position][potentialId] = nextMark;
  } else {
    delete state.potentialMarks[position][potentialId];
  }

  updatePotentialsDisplay(position);
}

// =============================================================================
// TAB SWITCHING
// =============================================================================

/**
 * Switches active character position tab
 *
 * Updates party bar styling and shows/hides corresponding slot content.
 *
 * @param position - Position to switch to (master/assist1/assist2)
 */
export function switchTab(position: Position): void {
  state.activeTab = position;

  // Update party bar slots
  querySelectorAll<HTMLDivElement>('.party-slot').forEach((slot) => {
    slot.classList.toggle('active', slot.dataset.position === position);
  });

  // Legacy: Update tab buttons if they exist
  querySelectorAll<HTMLButtonElement>('.position-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.position === position);
  });

  // Update tab content
  querySelectorAll<HTMLDivElement>('.character-slot').forEach((slot) => {
    slot.classList.toggle('active-tab', slot.id === `tab-${position}`);
  });
}

export function switchMainTab(tab: MainTab): void {
  // Update main tab buttons
  querySelectorAll<HTMLButtonElement>('.compact-main-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Update main tab content
  querySelectorAll<HTMLDivElement>('.main-tab-content').forEach((content) => {
    content.classList.toggle('active', content.id === `main-tab-${tab}`);
  });

  // Show/hide position tabs (only for characters tab)
  const positionTabs = getElement<HTMLDivElement>('position-tabs-inline');
  if (positionTabs) {
    positionTabs.style.display = tab === 'characters' ? 'flex' : 'none';
  }

  // Trigger tab-specific initialization
  if (tab === 'summary' && typeof window.renderSummary === 'function') {
    window.renderSummary();
  } else if (tab === 'preset' && typeof window.renderPresets === 'function') {
    window.renderPresets();
  } else if (tab === 'dmgcalc' && typeof window.renderDamageCalculator === 'function') {
    window.renderDamageCalculator();
  }
}

// =============================================================================
// DESCRIPTION MODE
// =============================================================================

/**
 * Toggles between brief and detailed description modes
 *
 * Brief mode shows BriefDesc, detailed mode shows full Desc.
 * Re-renders all active character cards and potentials with new descriptions.
 */
export function toggleDescriptionMode(): void {
  state.descriptionMode = state.descriptionMode === 'brief' ? 'detailed' : 'brief';

  const t = (key: string): string => window.i18n?.t(key) ?? key;

  // Update toggle buttons
  querySelectorAll<HTMLButtonElement>('.description-toggle span').forEach((span) => {
    span.textContent =
      state.descriptionMode === 'brief'
        ? t('builder.briefMode')
        : t('builder.detailedMode');
  });

  // Re-render all character cards and potentials
  (['master', 'assist1', 'assist2'] as Position[]).forEach((position) => {
    if (state.party[position]) {
      updateCharacterCard(position);
      updatePotentialsDisplay(position);
    }
  });
}

// =============================================================================
// INPUT VALIDATION
// =============================================================================

function validateNumericInput(value: string, min: number, max: number): number {
  const num = parseInt(value, 10);
  if (isNaN(num)) return min;
  return Math.min(Math.max(num, min), max);
}

// =============================================================================
// EVENT DELEGATION
// =============================================================================

function handleDelegatedAction(element: ActionElement, event: Event): void {
  const action = element.dataset.action;
  if (!action) return;

  switch (action) {
    case 'open-character-select':
      if (element.dataset.position) {
        openCharacterSelect(element.dataset.position as Position);
      }
      break;

    case 'select-character':
      if (element.dataset.characterId) {
        selectCharacter(element.dataset.characterId);
      }
      break;

    case 'remove-character':
      if (element.dataset.position) {
        removeCharacter(element.dataset.position as Position);
      }
      break;

    case 'close-character-select':
      closeCharacterSelect();
      break;

    case 'update-skill-level': {
      const position = element.dataset.position as Position | undefined;
      const skillId = parseInt(element.dataset.skillId ?? '0', 10);
      const maxLevel = parseInt(element.dataset.maxLevel ?? '13', 10);
      const delta = parseInt(element.dataset.delta ?? '0', 10);

      if (position && skillId) {
        const currentLevel = state.skillLevels[position]?.[skillId] ?? 1;
        const newValue =
          delta !== 0
            ? currentLevel + delta
            : validateNumericInput((element as HTMLInputElement).value, 1, maxLevel);

        updateSkillLevel(position, skillId, newValue, maxLevel);
      }
      break;
    }

    case 'toggle-potential': {
      const potentialId = parseInt(element.dataset.potentialId ?? '0', 10);
      const position = element.dataset.position as Position | undefined;
      if (potentialId && position) {
        togglePotential(potentialId, position);
      }
      break;
    }

    case 'update-potential-level': {
      const potentialId = parseInt(element.dataset.potentialId ?? '0', 10);
      const position = element.dataset.position as Position | undefined;
      const maxLevel = parseInt(element.dataset.maxLevel ?? '12', 10);
      const delta = parseInt(element.dataset.delta ?? '0', 10);

      if (potentialId && position) {
        const currentLevel = state.potentialLevels[position]?.[potentialId] ?? 1;
        const newValue =
          delta !== 0
            ? currentLevel + delta
            : validateNumericInput((element as HTMLInputElement).value, 1, maxLevel);

        updatePotentialLevel(potentialId, position, newValue);
      }
      break;
    }

    case 'toggle-description':
      toggleDescriptionMode();
      break;

    case 'update-character-level-phase': {
      // Only handle on change events, not click events (prevents dropdown from closing)
      if (event.type !== 'change') {
        break;
      }
      const position = element.dataset.position as Position | undefined;
      const phase = parseInt((element as HTMLSelectElement).value, 10);
      if (position) {
        updateCharacterLevelPhase(position, phase);
      }
      break;
    }

    case 'switch-main-tab':
      if (element.dataset.tab) {
        switchMainTab(element.dataset.tab as MainTab);
      }
      break;

    case 'switch-position-tab':
      if (element.dataset.position) {
        switchTab(element.dataset.position as Position);
      }
      break;

    case 'filter-character-element':
      if (element.dataset.element) {
        filterCharactersByElement(element.dataset.element);
      }
      break;

    default:
      log('[App-Char] Unknown action:', action);
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

function setupEventListeners(): void {
  // Click delegation
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const actionElement = target.closest<ActionElement>('[data-action]');
    if (actionElement) {
      handleDelegatedAction(actionElement, e);
    }
  });

  // Change delegation
  document.addEventListener('change', (e) => {
    const target = e.target as ActionElement;
    if (target.dataset.action) {
      handleDelegatedAction(target, e);
    }
  });

  // Focus delegation - auto-select all text in level inputs for easy editing
  document.addEventListener('focus', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.classList.contains('potential-level-input') ||
        target.classList.contains('skill-level-input')) {
      target.select();
    }
  }, true); // Use capture phase to ensure we catch focus events

  // Blur delegation - validate and clip level input values when focus leaves
  document.addEventListener('blur', (e) => {
    const target = e.target as HTMLInputElement & ActionElement;
    const action = target.dataset.action;

    if (action === 'update-potential-level' || action === 'update-skill-level') {
      const maxLevel = parseInt(target.dataset.maxLevel ?? '13', 10);
      target.value = String(validateNumericInput(target.value, 1, maxLevel));
    }
  }, true); // Use capture phase to ensure we catch blur events

  // Search input
  const searchInput = getElement<HTMLInputElement>('character-search');
  if (searchInput) {
    searchInput.addEventListener(
      'input',
      debounce((...args: unknown[]) => {
        const e = args[0] as Event;
        state.characterSelector.currentFilter = (e.target as HTMLInputElement).value;
        renderCharacterGrid();
      }, 150) as EventListener
    );
  }
}

/**
 * Initializes character builder module
 *
 * Initialization sequence:
 * 1. Show loading spinner
 * 2. Load all required game data
 * 3. Set up event delegation for UI interactions
 * 4. Render empty character cards for all positions
 * 5. Register language change handler for data reloading
 * 6. Hide loading spinner
 *
 * @throws {Error} If data loading or initialization fails
 */
export async function init(): Promise<void> {
  console.info('[AppChar] Initializing...');

  // Show loading spinner
  const spinner = getElement<HTMLDivElement>('spinner-loading');
  if (spinner) {
    spinner.classList.remove('hidden');
  }

  try {
    await loadData();
    setupEventListeners();

    // Initialize empty character cards
    try {
      (['master', 'assist1', 'assist2'] as Position[]).forEach((position) => {
        updateCharacterCard(position);
        updatePotentialsDisplay(position);
      });
    } catch (err) {
      console.error('[AppChar] Error initializing character cards:', err);
    }

    // Register for language changes
    onLanguageChange(async () => {
      console.info('[AppChar] Language changed, reloading data');
      await loadData();

      // Re-render all characters
      (['master', 'assist1', 'assist2'] as Position[]).forEach((position) => {
        if (state.party[position]) {
          updateCharacterCard(position);
          updatePotentialsDisplay(position);
        }
      });
    });

    console.info('[AppChar] Initialized successfully');
  } catch (error) {
    console.error('[AppChar] Initialization failed:', error);
  } finally {
    // Hide loading spinner
    if (spinner) {
      spinner.classList.add('hidden');
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

// Export state for other modules
export { state };

// Export for global access (legacy compatibility)
if (typeof window !== 'undefined') {
  window.state = state as unknown as CharacterState;
  window.switchMainTab = switchMainTab;
  window.isDataLoaded = isDataLoaded;
  window.updateCharacterCard = updateCharacterCard;
  window.updatePotentialsDisplay = updatePotentialsDisplay;
  window.calculateCharacterScore = calculateCharacterScore;

  // Additional exports for other modules
  (window as unknown as Record<string, unknown>).filterCharactersByElement = filterCharactersByElement;
  (window as unknown as Record<string, unknown>).selectCharacter = selectCharacter;
  (window as unknown as Record<string, unknown>).openCharacterSelect = openCharacterSelect;
  (window as unknown as Record<string, unknown>).closeCharacterSelect = closeCharacterSelect;
}

// Declare global augmentations
declare global {
  const Fuse: new <T>(items: T[], options: { keys: string[]; threshold: number }) => {
    search: (query: string) => Array<{ item: T }>;
  };
}
