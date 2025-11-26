/**
 * Character Builder Module (app-char.ts)
 *
 * Main module for the character builder functionality:
 * - Character selection and display
 * - Potential selection and management
 * - Skill level management
 * - Description parsing and display
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
} from '@/types';

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
} from '@/shared';

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

interface AppCharState extends CharacterState {
  currentPosition: Position | null;
  activeTab: Position;
  party: Record<Position, PartyMember | null>;
  characterSelector: CharacterSelectorState;
  itemNames: Record<string, string>;
  uiText: Record<string, string>;
}

// Initialize state
const state: AppCharState = {
  // Data caches
  characters: {},
  characterNames: {},
  potentials: {},
  potentialNames: {},
  itemNames: {},
  skills: {},
  skillNames: {},
  effectValue: {},
  buffValue: {},
  shieldValue: {},
  hitDamage: {},
  onceAdditionalAttributeValue: {},
  scriptParameterValue: {},
  gameEnums: {},
  uiText: {},

  // UI state
  currentPosition: null,
  activeTab: 'master',
  descriptionMode: 'brief',

  // Party state
  party: {
    master: null,
    assist1: null,
    assist2: null,
  },

  // Potential state
  selectedPotentials: {
    master: [],
    assist1: [],
    assist2: [],
  },
  potentialLevels: {
    master: {},
    assist1: {},
    assist2: {},
  },
  potentialMarks: {
    master: {},
    assist1: {},
    assist2: {},
  },

  // Skill state
  skillLevels: {
    master: {},
    assist1: {},
    assist2: {},
  },

  // Character level phase (0-8)
  characterLevelPhase: {
    master: 8,
    assist1: 8,
    assist2: 8,
  },

  // Character selector
  characterSelector: {
    allCharacters: [],
    fuse: null,
    selectedElement: 'all',
    currentFilter: '',
  },

  // Items data
  items: {},
};

// Description cache
const descriptionCache = new LRUCache<string, string>(500);
let cacheHits = 0;
let cacheMisses = 0;

// =============================================================================
// CACHE UTILITIES
// =============================================================================

export function clearDescriptionCache(): void {
  descriptionCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

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
// DATA LOADING
// =============================================================================

let dataLoaded = false;

export function isDataLoaded(): boolean {
  return dataLoaded;
}

async function loadData(): Promise<void> {
  try {
    const gameLang = window.i18n?.currentLang ?? 'KR';
    const dataPath = window.i18n?.getDataPath(gameLang) ?? 'data/KR';

    log('[App-Char] Loading data for language:', gameLang);

    // Load all data in parallel
    const [
      characters,
      characterNames,
      charPotentials,
      potentials,
      potentialNames,
      items,
      itemNames,
      gameEnums,
      skills,
      skillNames,
      effectValue,
      hitDamage,
      onceAdditionalAttributeValue,
      scriptParameterValue,
      buffValue,
      shieldValue,
      uiText,
    ] = await Promise.all([
      fetchJSON<Record<string, CharacterData>>('data/Character.json'),
      fetchJSON<Record<string, string>>(`${dataPath}/Character.json`),
      fetchJSON<Record<string, unknown>>('data/CharPotential.json'),
      fetchJSON<Record<string, PotentialData>>('data/Potential.json'),
      fetchJSON<Record<string, string>>(`${dataPath}/Potential.json`),
      fetchJSON<Record<string, unknown>>('data/Item.json'),
      fetchJSON<Record<string, string>>(`${dataPath}/Item.json`),
      fetchJSON<Record<string, unknown>>('data/GameEnums.json'),
      fetchJSON<Record<string, SkillData>>('data/Skill.json'),
      fetchJSON<Record<string, string>>(`${dataPath}/Skill.json`),
      fetchJSON<Record<string, unknown>>('data/EffectValue.json'),
      fetchJSON<Record<string, unknown>>('data/HitDamage.json'),
      fetchJSON<Record<string, unknown>>('data/OnceAdditionalAttributeValue.json'),
      fetchJSON<Record<string, unknown>>('data/ScriptParameterValue.json'),
      fetchJSON<Record<string, unknown>>('data/BuffValue.json'),
      fetchJSON<Record<string, unknown>>('data/ShieldValue.json'),
      fetchJSON<Record<string, string>>(`${dataPath}/UIText.json`),
    ]);

    // Update state
    Object.assign(state, {
      characters,
      characterNames,
      potentials,
      potentialNames,
      itemNames,
      items,
      gameEnums,
      skills,
      skillNames,
      effectValue,
      hitDamage,
      onceAdditionalAttributeValue,
      scriptParameterValue,
      buffValue,
      shieldValue,
      uiText,
    });

    // Store charPotentials separately for lookup
    (state as unknown as { charPotentials: Record<string, unknown> }).charPotentials = charPotentials;

    // Initialize character selector
    initializeCharacterSelector();

    // Clear description cache when data changes
    clearDescriptionCache();

    dataLoaded = true;
    log('[App-Char] Data loaded successfully');
  } catch (error) {
    console.error('[App-Char] Failed to load data:', error);
    showError('Failed to load character data');
    throw error;
  }
}

// =============================================================================
// CHARACTER SELECTOR
// =============================================================================

function initializeCharacterSelector(): void {
  // Filter to only visible and available characters
  const playableCharacters = Object.entries(state.characters)
    .filter(([_, data]) => data.Visible && data.Available)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([id, data]) => ({
      id,
      name: state.characterNames[(data as unknown as { Name: string }).Name] ?? (data as unknown as { Name: string }).Name ?? id,
      data,
    }));

  state.characterSelector.allCharacters = playableCharacters.map((c) => ({
    ...c.data,
    Id: c.id,
    Name: c.name,
  }));

  // Initialize Fuse.js for search (if available)
  if (typeof Fuse !== 'undefined') {
    state.characterSelector.fuse = new Fuse(state.characterSelector.allCharacters, {
      keys: ['Name'],
      threshold: 0.3,
    });
  }
}

// =============================================================================
// CHARACTER SELECTION
// =============================================================================

export function openCharacterSelect(position: Position): void {
  state.currentPosition = position;

  const modal = getElement<HTMLDivElement>('character-modal');
  if (!modal) return;

  modal.classList.add('active');
  renderCharacterGrid();

  // Focus search input
  const searchInput = getElement<HTMLInputElement>('character-search');
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
}

export function closeCharacterSelect(): void {
  const modal = getElement<HTMLDivElement>('character-modal');
  if (modal) {
    modal.classList.remove('active');
  }
  state.currentPosition = null;
}

export function selectCharacter(characterId: string): void {
  const character = state.characters[characterId];
  if (!character || !state.currentPosition) return;

  const position = state.currentPosition;
  const name = state.characterNames[`Character.${characterId}.1`] ?? characterId;

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

export function removeCharacter(position: Position): void {
  state.party[position] = null;
  state.selectedPotentials[position] = [];
  state.potentialLevels[position] = {};
  state.skillLevels[position] = {};
  state.potentialMarks[position] = {};

  updateCharacterCard(position);
  updatePotentialsDisplay(position);
}

// =============================================================================
// CHARACTER CARD RENDERING
// =============================================================================

function updateCharacterCard(position: Position): void {
  const card = getElement<HTMLDivElement>(`${position}-card`);
  if (!card) return;

  const character = state.party[position];

  if (!character) {
    renderEmptyCharacterCard(card, position);
    return;
  }

  renderFilledCharacterCard(card, position, character);
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
  const rarityInfo = (state.gameEnums.itemRarity as Record<number, any>)?.[gradeNum] as { stars?: number } | undefined;
  const stars = rarityInfo?.stars ?? gradeNum;

  const elementInfo = (state.gameEnums.elementType as Record<number, any>)?.[character.data.EET] as { name?: string; icon?: string } | undefined;
  const elementName = elementInfo?.name ?? String(character.data.EET);
  const elementIcon = elementInfo?.icon ?? '';

  const jobClassInfo = (state.gameEnums.characterJobClass as Record<number, any>)?.[classNum] as { name?: string } | undefined;
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

  card.innerHTML = `
    <img src="assets/char/avg1_${character.id}_002.png"
         alt="${character.name}"
         class="character-card-image"
         width="${IMAGE_SIZES.CHARACTER_PORTRAIT.width}"
         height="${IMAGE_SIZES.CHARACTER_PORTRAIT.height}"
         loading="lazy"
         onerror="this.style.display='none'">
    <div class="character-info">
      <div class="character-action-buttons">
        <button class="change-character-btn" data-action="open-character-select" data-position="${position}">
          <span class="change-icon">${window.getIcon?.('change') ?? '🔄'}</span>
          <span>${t('builder.change')}</span>
        </button>
        <button class="remove-character-btn" data-action="remove-character" data-position="${position}">
          <span class="remove-icon">${window.getIcon?.('remove') ?? '❌'}</span>
          <span>${t('builder.remove')}</span>
        </button>
      </div>
      <div class="character-info-header">
        <div class="character-name">${character.name}</div>
        <div class="character-id">ID: ${character.id}</div>
      </div>
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
      <div class="character-stats-enhanced">
        <div class="stat-card stat-grade">
          <div class="stat-content">
            <div class="stat-label"><strong>${t('builder.grade')}</strong></div>
            <div class="stat-value">${window.getIcon?.('star').repeat(stars) ?? '★'.repeat(stars)}</div>
          </div>
        </div>
        <div class="stat-card stat-class">
          <div class="stat-content">
            <div class="stat-label"><strong>${t('builder.class')}</strong></div>
            <div class="stat-value">${jobClassName}</div>
          </div>
        </div>
        <div class="stat-card stat-faction">
          <div class="stat-content">
            <div class="stat-label"><strong>${t('builder.faction')}</strong></div>
            <div class="stat-value">${character.data.Faction}</div>
          </div>
        </div>
        <div class="stat-card stat-element">
          <div class="stat-content">
            <div class="stat-label"><strong>${t('builder.element')}</strong></div>
            <div class="stat-value">${elementIcon ? `<img src="${elementIcon}" alt="${elementName}" class="element-icon-inline" title="${elementName}" onerror="this.style.display='none'">` : elementName}</div>
          </div>
        </div>
      </div>
      <div class="character-skills">
        <div class="skills-title">${t('builder.skillInfo')}</div>
        ${skillsHtml}
      </div>
    </div>
  `;
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
      const title = state.skillNames[skill.title] || skill.name;

      // Get skill description
      const descKey = state.descriptionMode === 'brief' ? skill.briefDesc : skill.desc;
      let description = state.skillNames[descKey ?? ''] ?? '';

      if (description && skill.data) {
        description = parseDescriptionParams(
          description,
          skill.data as Record<string, string>,
          currentLevel,
          currentLevel,
          state as CharacterState,
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
            <img src="${elementBgPath}"
                 alt=""
                 class="skill-icon-bg"
                 width="${IMAGE_SIZES.SKILL_ICON.width}"
                 height="${IMAGE_SIZES.SKILL_ICON.height}"
                 loading="lazy"
                 onerror="this.style.display='none'">
            ${iconPath ? `<img src="${iconPath}" alt="${skill.name}" class="skill-icon" width="${IMAGE_SIZES.SKILL_ICON.width}" height="${IMAGE_SIZES.SKILL_ICON.height}" loading="lazy" onerror="this.style.display='none'">` : ''}
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
      const skillData = (state.skills as unknown as Record<string, Record<string, unknown>>)[String(skillId)];
      if (skillData) {
        const titleKey = (skillData.Title as string) ?? '';
        const briefKey = (skillData.BriefDesc as string) ?? '';
        const descKey = (skillData.Desc as string) ?? '';

        skills[key] = {
          id: String(skillId),
          data: skillData,
          title: titleKey,
          name: state.skillNames[briefKey] ?? `Skill ${skillId}`,
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

export function updateCharacterLevelPhase(position: Position, phase: number): void {
  state.characterLevelPhase[position] = phase;
  updateCharacterCard(position);
  updatePotentialsDisplay(position);
}

// =============================================================================
// CHARACTER GRID RENDERING
// =============================================================================

const renderCharacterGrid = debounce((...args: unknown[]): void => {
  const searchQuery = String(args[0] || '');
  const grid = getElement<HTMLDivElement>('character-grid');
  if (!grid) return;

  grid.innerHTML = '';

  let charactersToDisplay = state.characterSelector.allCharacters;

  // Apply element filter first
  if (state.characterSelector.selectedElement !== 'all') {
    charactersToDisplay = charactersToDisplay.filter((item: any) =>
      String(item.char?.EET || item.EET) === state.characterSelector.selectedElement
    );
  }

  // Apply search filter
  if (searchQuery && searchQuery.trim() !== '') {
    if (state.characterSelector.fuse) {
      const fuse = state.characterSelector.fuse as { search: (q: string) => Array<{ item: any }> };
      const results = fuse.search(searchQuery);
      const searchIds = new Set(results.map((r) => r.item.id || r.item.Id));
      charactersToDisplay = charactersToDisplay.filter((item: any) => 
        searchIds.has(item.id || item.Id)
      );
    } else {
      // Fallback to simple string matching
      const lowerQuery = searchQuery.toLowerCase();
      charactersToDisplay = charactersToDisplay.filter((item: any) => {
        const name = item.name || item.Name || '';
        const id = String(item.id || item.Id || '');
        return name.toLowerCase().includes(lowerQuery) || id.includes(lowerQuery);
      });
    }
  }

  // Check if empty
  if (charactersToDisplay.length === 0) {
    grid.innerHTML = `<div class="empty-search-state"><p>${window.i18n?.t('builder.noSearchResults') ?? 'No search results'}</p></div>`;
    return;
  }

  // Render characters
  const t = (key: string): string => window.i18n?.t(key) ?? key;
  charactersToDisplay.forEach((item: any) => {
    const id = item.id || item.Id;
    const char = item.char || item;
    const name = item.name || item.Name;
    const charImagePath = `assets/char/avg1_${id}_002.png`;

    // Get star rating from GameEnums
    const rarityInfo = (state.gameEnums.itemRarity as Record<number, any>)?.[char.Grade];
    const stars = rarityInfo?.stars || char.Grade || 5;

    // Get element info
    const elementInfo = (state.gameEnums.elementType as Record<number, any>)?.[char.EET] || {};

    const itemDiv = document.createElement('div');
    itemDiv.className = 'character-item';
    itemDiv.dataset.action = 'select-character';
    itemDiv.dataset.characterId = String(id);
    itemDiv.innerHTML = `
      <div class="character-item-header">
        <img src="${charImagePath}"
             alt="${name}"
             class="character-item-image"
             width="${IMAGE_SIZES.CHARACTER_GRID_ITEM.width}"
             height="${IMAGE_SIZES.CHARACTER_GRID_ITEM.height}"
             loading="lazy"
             onerror="this.style.display='none'">
        ${elementInfo.icon ? `<img src="${elementInfo.icon}" alt="${elementInfo.name}" class="character-element-badge" width="24" height="24" loading="lazy" onerror="this.style.display='none'">` : ''}
        <div class="character-item-info">
          <div class="character-item-name">${name}</div>
          <div class="character-item-id">ID: ${id}</div>
        </div>
      </div>
      <div class="character-item-id">${t('builder.grade')}: ${window.getIcon?.('star').repeat(stars) ?? '★'.repeat(stars)}</div>
    `;
    grid.appendChild(itemDiv);
  });
}, 150);

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
  const charPotential = (state as unknown as { charPotentials: Record<string, any> }).charPotentials[charId];

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
      <div class="potential-section-title">${isMaster ? t('builder.masterSpecificPotential') : t('builder.assistSpecificPotential')}</div>
      ${specificPotentials.map((potId: number) => createPotentialCard(potId, position)).join('')}
    `;
  }

  // Combine normal and common potentials
  const allNormalCommonPotentials = [...normalPotentials, ...commonPotentials];

  // Create single section for normal and common potentials
  if (allNormalCommonPotentials.length > 0) {
    const section = document.createElement('div');
    section.className = 'potential-category';
    section.innerHTML = `
      <div class="potential-category-title">${isMaster ? t('builder.masterNormalPotential') : t('builder.assistNormalPotential')}</div>
      <div class="normal-common-grid">
        ${allNormalCommonPotentials.map((potId: number) => createPotentialCard(potId, position)).join('')}
      </div>
    `;
    otherContainer.appendChild(section);
  }
}

// Create potential card HTML - matches JS version
function createPotentialCard(potId: number, position: Position): string {
  const potential = state.potentials[potId];
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
  const name = itemKey ? (state.itemNames[itemKey] || `Potential ${potId}`) : `Potential ${potId}`;

  // Get item data for icon and background
  const itemData = (state.items as Record<string, any>)?.[potId];
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

  let briefDesc = state.potentialNames[briefKey] || t('builder.briefDesc');
  let detailedDesc = state.potentialNames[detailedKey] || t('builder.detailedDesc');

  // Get character level phase
  const charLevelPhase = state.characterLevelPhase[position] || 8;

  // Parse parameters
  briefDesc = parseDescriptionParams(
    briefDesc,
    potential as unknown as Record<string, string>,
    effectiveLevel,
    skillLevelForParams,
    state as CharacterState,
    position,
    isSpecificPotential,
    charLevelPhase
  );
  detailedDesc = parseDescriptionParams(
    detailedDesc,
    potential as unknown as Record<string, string>,
    effectiveLevel,
    skillLevelForParams,
    state as CharacterState,
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
  const buildInfo = (state.gameEnums.potentialBuild as Record<number, any>)?.[buildNumber];
  const buildLabel = buildInfo?.name || '';

  // Calculate score for this potential if selected
  const score = isSelected ? calculatePotentialScore(potId, position) : 0;

  return `
    <div class="potential-card ${isSelected ? 'selected' : ''}" data-build="${buildNumber}">
      ${buildLabel ? `<div class="build-badge">${buildLabel}</div>` : ''}
      ${isSelected ? `<div class="score-badge">${t('builder.score')}: ${score}</div>` : ''}
      <div class="potential-card-header"
           data-action="toggle-potential"
           data-potential-id="${potId}"
           data-position="${position}">
        <div class="potential-card-image">
          ${backgroundImage ? `<img src="${backgroundImage}" alt="" class="potential-bg" width="${IMAGE_SIZES.POTENTIAL_ICON.width}" height="${IMAGE_SIZES.POTENTIAL_ICON.height}" loading="lazy" onerror="this.style.display='none'">` : ''}
          ${iconPath ? `<img src="${iconPath}" alt="${name}" class="potential-icon" width="${IMAGE_SIZES.POTENTIAL_ICON.width}" height="${IMAGE_SIZES.POTENTIAL_ICON.height}" loading="lazy" onerror="this.style.display='none'">` : `<span class="potential-placeholder">${window.getIcon?.('target') ?? '🎯'}</span>`}
        </div>
        <div class="potential-card-info">
          <div class="potential-card-name">${name}</div>
          <div class="potential-card-meta">
            <span>ID: ${potId}</span>
            ${!isSpecificPotential ? `<span>${t('builder.maxLevel')}: ${actualMaxLevel}</span>` : ''}
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
  const name = state.potentialNames[nameKey] ?? `Potential ${potential.Id}`;

  // Get description
  const descKey =
    state.descriptionMode === 'brief' ? potential.BriefDesKey : potential.DesKey;
  let description = state.potentialNames[descKey ?? ''] ?? '';

  if (description && potential) {
    const levelPhase = state.characterLevelPhase[position] ?? 8;
    description = parseDescriptionParams(
      description,
      potential as unknown as Record<string, string>,
      currentLevel,
      currentLevel,
      state as CharacterState,
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
  const potential = state.potentials[potentialId];
  if (!potential || !(potential as unknown as { BuildScore?: number[] }).BuildScore) return 0;

  // Get item data to check if it's a specific potential
  const itemData = (state.items as Record<string, { Stype?: number }>)?.[potentialId];
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

export function togglePotential(potentialId: number, position: Position): void {
  const selected = state.selectedPotentials[position];
  const index = selected.indexOf(potentialId);

  if (index > -1) {
    // Deselect
    selected.splice(index, 1);
    delete state.potentialLevels[position][potentialId];
    delete state.potentialMarks[position][potentialId];
  } else {
    // Check if specific potential limit reached
    const potential = state.potentials[potentialId];
    if (potential?.Stype === 42) {
      const specificCount = selected.filter(
        (id) => state.potentials[id]?.Stype === 42
      ).length;
      if (specificCount >= 2) {
        const t = (key: string): string => window.i18n?.t(key) ?? key;
        window.showToast?.(t('builder.maxSpecificPotentials'));
        return;
      }
    }

    // Select
    selected.push(potentialId);
    state.potentialLevels[position][potentialId] = 1;
  }

  updatePotentialsDisplay(position);
}

export function updatePotentialLevel(
  potentialId: number,
  position: Position,
  value: number
): void {
  const potential = state.potentials[potentialId];
  if (!potential) return;

  const maxLevel = (potential.MaxLevel ?? 6) + 6;
  const clampedValue = Math.min(Math.max(1, value), maxLevel);

  state.potentialLevels[position][potentialId] = clampedValue;
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

export function switchTab(position: Position): void {
  state.activeTab = position;

  // Update tab buttons
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

  // Input delegation for real-time updates
  document.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement & ActionElement;
    const action = target.dataset.action;

    if (action === 'update-potential-level' || action === 'update-skill-level') {
      const maxLevel = parseInt(target.dataset.maxLevel ?? '13', 10);
      target.value = String(validateNumericInput(target.value, 1, maxLevel));
    }
  });

  // ESC to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = getElement<HTMLDivElement>('character-modal');
      if (modal?.classList.contains('active')) {
        closeCharacterSelect();
      }
    }
  });

  // Search input
  const searchInput = getElement<HTMLInputElement>('character-search');
  if (searchInput) {
    searchInput.addEventListener(
      'input',
      debounce((...args: unknown[]) => {
        const e = args[0] as Event;
        renderCharacterGrid((e.target as HTMLInputElement).value);
      }, 150) as EventListener
    );
  }
}

async function init(): Promise<void> {
  log('[App-Char] Initializing...');

  // Show loading spinner
  const spinner = getElement<HTMLDivElement>('spinner-loading');
  if (spinner) {
    spinner.classList.remove('hidden');
  }

  try {
    await loadData();
    setupEventListeners();

    // Initialize empty character cards
    (['master', 'assist1', 'assist2'] as Position[]).forEach((position) => {
      updateCharacterCard(position);
      updatePotentialsDisplay(position);
    });

    // Register for language changes
    onLanguageChange(async () => {
      log('[App-Char] Language changed, reloading data');
      await loadData();

      // Re-render all characters
      (['master', 'assist1', 'assist2'] as Position[]).forEach((position) => {
        if (state.party[position]) {
          updateCharacterCard(position);
          updatePotentialsDisplay(position);
        }
      });
    });

    log('[App-Char] Initialized successfully');
  } catch (error) {
    console.error('[App-Char] Initialization failed:', error);
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

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

// Declare global augmentations
declare global {
  const Fuse: new <T>(items: T[], options: { keys: string[]; threshold: number }) => {
    search: (query: string) => Array<{ item: T }>;
  };
}
