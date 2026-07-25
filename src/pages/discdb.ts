/**
 * Disc Database Page Module - Entry Point
 *
 * Comprehensive disc encyclopedia with detailed information about discs (records/pottery),
 * including skills, attributes, notes, and story content. Uses event delegation pattern
 * for all dynamic UI interactions.
 *
 * Key Features:
 * - Disc browsing with search and element filtering
 * - Detailed disc information (skills, stats, story)
 * - Dynamic level and limit break adjustments
 * - Main skill, secondary skill, and note system display
 * - Event delegation for phase level controls
 * - Responsive stat calculations based on level/break
 *
 * @module pages/discdb
 * @see {@link shared/game-data} For disc data access
 * @see {@link modules/param-parser} For skill description parsing
 */

// Import shared utilities (auto-initializes)
import '../shared';
import { createResponsiveImage } from '../shared';
import '../i18n';
import { initGlobalHeader, initInfoModal } from '../shared/ui-components';
import { GameData, getDiscRarityInfo } from '../shared/game-data';
import { loadCoreData, loadFeatureData, loadLanguageData } from '../shared/data-loader';
import { substituteSkillParams } from '../modules/param-parser';

import { showError, parseElementTags } from '../shared';
import Fuse from 'fuse.js';
import { initBgmPlayer, type BgmPlayerHandle, type DiscBgmMap } from '../modules/bgm-player';
import type { Disc, MainSkill, SecondarySkill, SubNoteSkill, SubNoteSkillPromoteGroup, GameEnums, Item } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface DiscDBState {
  allDiscs: Array<{ id: string; disc: Disc; name: string }>;
  discNames: Record<string, string>;
  discData: Record<string, Disc>;
  discIPData: Record<string, { StoryName: string; StoryDesc?: string }>;
  discIPKRData: Record<string, string>;
  itemData: Record<string, Item>;
  itemKRData: Record<string, string>;
  gameEnums: GameEnums;
  uiText: Record<string, string>;
  mainSkillData: Record<string, MainSkill>;
  secondarySkillData: Record<string, SecondarySkill>;
  mainSkillKRData: Record<string, string>;
  secondarySkillKRData: Record<string, string>;
  subNoteSkillData: Record<string, SubNoteSkill>;
  subNoteSkillKRData: Record<string, string>;
  subNoteSkillPromoteData: Record<string, SubNoteSkillPromoteGroup>;
  discTagKRData: Record<string, string>;
  attributeData: Record<string, Record<string, unknown>>;
  discExtraAttributeData: Record<string, { GroupId: number; Break: number; Atk: number }>;
  currentDiscId: string | null;
  skillLevel: number;
  phaseLevel: number;
  discLevel: number;
  discLimitBreak: number;
  selector: {
    fuse: unknown;
    selectedElement: string;
  };
  bgmMap: DiscBgmMap;
  bgmPlayer: BgmPlayerHandle | null;
}

// =============================================================================
// STATE
// =============================================================================

const discDBState: DiscDBState = {
  allDiscs: [],
  discNames: {},
  discData: {},
  discIPData: {},
  discIPKRData: {},
  itemData: {},
  itemKRData: {},
  gameEnums: {},
  uiText: {},
  mainSkillData: {},
  secondarySkillData: {},
  mainSkillKRData: {},
  secondarySkillKRData: {},
  subNoteSkillData: {},
  subNoteSkillKRData: {},
  subNoteSkillPromoteData: {},
  discTagKRData: {},
  attributeData: {},
  discExtraAttributeData: {},
  currentDiscId: null,
  skillLevel: 5,
  phaseLevel: 0,
  discLevel: 1,
  discLimitBreak: 0,
  selector: {
    fuse: null,
    selectedElement: 'all',
  },
  bgmMap: {},
  bgmPlayer: null,
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Extracts filename from a file path
 *
 * @param path - Full file path (e.g., "assets/icons/disc_icon.png")
 * @returns Filename without path (e.g., "disc_icon.png")
 */
function extractFilename(path: string): string {
  if (!path) return '';
  const parts = path.split('/');
  return parts[parts.length - 1] || '';
}

// =============================================================================
// DATA LOADING
// =============================================================================

/**
 * Loads all disc-related data from game files
 *
 * Loads core data, disc system features, and language-specific translations.
 * Builds disc names map, filters visible/available discs, and initializes
 * Fuse.js search functionality.
 *
 * @throws {Error} If data loading fails
 */
async function loadDiscData(): Promise<void> {
  try {
    const gameLang = window.i18n?.currentLang || 'KR';
    console.info(`[DiscDB] Loading data for language: ${gameLang}`);

    await loadCoreData();
    await loadFeatureData('discSystem');

    try {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/');
      const res = await fetch(`${base}data/disc_bgm_map.json`);
      if (res.ok) {
        discDBState.bgmMap = await res.json();
      } else {
        console.warn('[DiscDB] disc_bgm_map.json fetch returned', res.status);
        discDBState.bgmMap = {};
      }
    } catch (err) {
      console.warn('[DiscDB] Failed to load disc_bgm_map.json', err);
      discDBState.bgmMap = {};
    }

    const langFiles = [
      'DiscIP.json',
      'Item.json',
      'MainSkill.json',
      'SecondarySkill.json',
      'SubNoteSkill.json',
      'DiscTag.json',
      'UIText.json'
    ];
    await loadLanguageData(gameLang, langFiles);

    // Sync GameData to local state
    discDBState.discData = GameData.discs;
    discDBState.discIPData = GameData.discIP;
    discDBState.discIPKRData = GameData.discIPKR;
    discDBState.itemData = GameData.items;
    discDBState.itemKRData = GameData.itemsKR as any;
    discDBState.gameEnums = GameData.gameEnums as any;
    discDBState.uiText = GameData.uiText as any;
    discDBState.mainSkillData = GameData.mainSkills;
    discDBState.secondarySkillData = GameData.secondarySkills;
    discDBState.mainSkillKRData = GameData.mainSkillsKR as any;
    discDBState.secondarySkillKRData = GameData.secondarySkillsKR as any;
    discDBState.subNoteSkillData = GameData.subNoteSkills;
    discDBState.subNoteSkillKRData = GameData.subNoteSkillsKR as any;
    discDBState.subNoteSkillPromoteData = GameData.subNoteSkillPromote as any;
    discDBState.discTagKRData = GameData.discTagKR;
    discDBState.attributeData = GameData.attributes as any;
    discDBState.discExtraAttributeData = GameData.discExtraAttribute as any;

    // Build disc names map
    Object.entries(discDBState.discData).forEach(([id, disc]) => {
      if (disc.Visible && (disc as Record<string, unknown>).Available) {
        const discIPEntry = discDBState.discIPData[id];
        if (discIPEntry) {
          const storyName = discIPEntry.StoryName;
          const localized = discDBState.discIPKRData[storyName];

          if (localized && !localized.startsWith('레코드')) {
            discDBState.discNames[id] = localized;
          }
        } 
      }
    });

    // Build allDiscs array
    discDBState.allDiscs = Object.entries(discDBState.discData)
      .filter(([id, disc]) => {
        if (!disc.Visible || !(disc as Record<string, unknown>).Available) return false;
        return !!discDBState.discNames[id];
      })
      .map(([id, disc]) => ({
        id,
        disc,
        name: discDBState.discNames[id] || '',
      }))
      .sort((a, b) => parseInt(b.id) - parseInt(a.id));

    // Initialize Fuse.js for search
    if (typeof Fuse !== 'undefined') {
      discDBState.selector.fuse = new Fuse(discDBState.allDiscs, {
        keys: ['name', 'id'],
        threshold: 0.4,
        includeScore: true,
      });
    }

    renderDiscSelector('');
  } catch (error) {
    console.error('Error loading disc data:', error);
    showError(window.i18n?.t('discdb.loadingError') || 'Error loading disc data');
  }
}

// =============================================================================
// RENDERING
// =============================================================================

/**
 * Renders disc selector grid with search and filter applied
 *
 * Displays all discs matching current element filter and search query.
 * Uses document fragment for efficient DOM manipulation.
 *
 * @param searchQuery - Search text to filter discs by name or ID (default: '')
 */
function renderDiscSelector(searchQuery: string = ''): void {
  const container = document.getElementById('disc-selector');
  if (!container) return;

  container.innerHTML = '';

  let discsToDisplay = discDBState.allDiscs;

  // Apply element filter
  if (discDBState.selector.selectedElement !== 'all') {
    discsToDisplay = discsToDisplay.filter(
      (item) => String(item.disc.EET) === discDBState.selector.selectedElement
    );
  }

  // Apply search filter
  if (searchQuery && searchQuery.trim() !== '') {
    if (discDBState.selector.fuse) {
      const results = (discDBState.selector.fuse as any).search(searchQuery);
      const searchIds = new Set(results.map((r: any) => r.item.id));
      discsToDisplay = discsToDisplay.filter((item) => searchIds.has(item.id));
    } else {
      const query = searchQuery.toLowerCase();
      discsToDisplay = discsToDisplay.filter(
        (item) => item.name.toLowerCase().includes(query) || item.id.includes(query)
      );
    }
  }

  if (discsToDisplay.length === 0) {
    container.innerHTML = `<div class="empty-search-state"><p>${window.i18n?.t('discdb.noResults')}</p></div>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  discsToDisplay.forEach(({ id, disc, name }) => {
    const itemData = discDBState.itemData[id];
    let iconPath = '';
    if (itemData && itemData.Icon) {
      const iconName = extractFilename(itemData.Icon as string);
      iconPath = `assets/disc_icons/${iconName}.png`;
    }
    const elementInfo = discDBState.gameEnums.elementType?.[disc.EET] as { icon?: string; name?: string } | undefined || {};
    const rarityInfo = getDiscRarityInfo(disc);

    const card = document.createElement('div');
    card.className = 'disc-card';
    card.onclick = () => selectDisc(id);

    card.innerHTML = `
      <div class="disc-card-image ${rarityInfo.borderClass}">
        ${createResponsiveImage(iconPath, name, 'disc-card-icon')}
        ${elementInfo.icon ? createResponsiveImage(elementInfo.icon, elementInfo.name || '', 'disc-card-element-badge') : ''}
      </div>
      <div class="disc-card-info">
        <div class="disc-card-name">${name}</div>
        <div class="disc-card-id">${window.i18n?.t('discdb.id')}: ${id}</div>
      </div>
    `;

    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

/**
 * Renders tag badges for a disc
 *
 * @param disc - Disc data containing tag IDs
 */
function renderDiscTags(disc: Disc): void {
  const tagsContainer = document.getElementById('disc-tags');
  if (!tagsContainer) return;

  const tags = (disc as Record<string, unknown>).Tags as number[] | undefined;
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    tagsContainer.innerHTML = '';
    return;
  }

  const tagsHTML = tags
    .map((tagId) => {
      const tagKey = `DiscTag.${tagId}.1`;
      const tagName = discDBState.discTagKRData[tagKey] || `Tag ${tagId}`;
      return `<span class="disc-tag-badge">${tagName}</span>`;
    })
    .join('');

  tagsContainer.innerHTML = tagsHTML;
}

/**
 * Calculates disc level and limit break from slider value
 *
 * Slider advancement thresholds: 11, 22, 33, 44, 55, 66, 77, 88
 * Each threshold represents a limit break level.
 *
 * @param sliderValue - Slider value (1-95)
 * @returns Object containing calculated level and limitBreak values
 *
 * @example
 * ```typescript
 * getDiscStatsFromSlider(55); // { level: 48, limitBreak: 5 }
 * ```
 */
function getDiscStatsFromSlider(sliderValue: number): { level: number; limitBreak: number } {
  const advancements = [11, 22, 33, 44, 55, 66, 77, 88];

  let limitBreak = 0;
  for (let i = 0; i < advancements.length; i++) {
    if (sliderValue >= advancements[i]!) {
      limitBreak = i + 1;
    } else {
      break;
    }
  }

  const level = sliderValue - limitBreak;

  return { level, limitBreak };
}

/**
 * Renders disc attributes (stats) based on level and limit break
 *
 * Calculates attribute key from GroupId, level, and limit break,
 * then displays all stats with translated names.
 *
 * @param discId - Disc ID to get attributes for
 * @param level - Current disc level
 * @param limitBreak - Current limit break level (0-8)
 */
function renderDiscAttributes(discId: string, level: number, limitBreak: number): void {
  const statsContainer = document.getElementById('disc-stats-grid');
  if (!statsContainer) return;

  const disc = discDBState.discData[discId] as Disc & { AttrBaseGroupId?: number; AttrExtraGroupId?: number };
  if (!disc || !disc.AttrBaseGroupId) {
    statsContainer.innerHTML = `<p class="no-stats">${window.i18n?.t('discdb.noStats')}</p>`;
    return;
  }

  let attrKey: string;
  if (limitBreak === 0) {
    attrKey = `${disc.AttrBaseGroupId}${String(level).padStart(3, '0')}`;
  } else {
    attrKey = `${disc.AttrBaseGroupId}${limitBreak}${String(level).padStart(2, '0')}`;
  }

  const attrData = discDBState.attributeData[attrKey];

  if (!attrData) {
    statsContainer.innerHTML = `<p class="no-stats">${window.i18n?.t('discdb.noStatsForLevel')} (Key: ${attrKey})</p>`;
    return;
  }

  const statsHTML: string[] = [];
  const excludeKeys = ['Id', 'GroupId', 'Break', 'lvl'];

  for (const [key, value] of Object.entries(attrData)) {
    if (excludeKeys.includes(key)) continue;

    let attrName = key;

    if (GameData.gameEnums?.effectAttributeType) {
      // Find the enum entry by matching the key
      const enumEntries = Object.entries(GameData.gameEnums.effectAttributeType);
      const matchingEntry = enumEntries.find(([id, entry]: [string, any]) =>
        entry.key && entry.key.toLowerCase() === key.toLowerCase()
      );

      if (matchingEntry) {
        const [statId, entry] = matchingEntry as [string, any];
        // Look up translation in UIText using the ID
        const uiTextKey = `UIText.Enums_Effect_${statId}.1`;
        attrName = discDBState.uiText?.[uiTextKey] || entry.name || key;
      }
    }

    statsHTML.push(`
      <div class="stat-item">
        <span class="stat-name">${attrName}</span>
        <span class="stat-value">${value}</span>
      </div>
    `);
  }

  // Add bonus attack from DiscExtraAttribute
  if (disc.AttrExtraGroupId) {
    const extraAttrs = Object.values(discDBState.discExtraAttributeData).filter(
      (item) => item.GroupId === disc.AttrExtraGroupId
    );

    if (extraAttrs.length > 0) {
      extraAttrs.sort((a, b) => a.Break - b.Break);

      statsHTML.push('<div class="stat-divider"></div>');
      const breakTitle = window.i18n?.t('discdb.breakBonus') || 'Break Bonus';
      statsHTML.push(`<div class="stat-section-title">${breakTitle}</div>`);

      extraAttrs.forEach((attr) => {
        const breakLabel = window.i18n?.t('discdb.break') || 'Break';
        statsHTML.push(`
          <div class="stat-item extra-stat">
            <span class="stat-name">${breakLabel} ${attr.Break}</span>
            <span class="stat-value">+${attr.Atk}</span>
          </div>
        `);
      });
    }
  }

  statsContainer.innerHTML = statsHTML.join('');
}

// =============================================================================
// DISC SELECTION
// =============================================================================

/**
 * Resolves the icon path for a disc id, reusing the same logic as renderDiscSelector.
 * Returns null if no icon is available.
 */
function getDiscIconPath(discId: string): string | null {
  const itemData = discDBState.itemData[discId];
  if (!itemData || !itemData.Icon) return null;
  const iconName = extractFilename(itemData.Icon as string);
  return `assets/disc_icons/${iconName}.png`;
}

/**
 * Selects a disc and displays its detailed information
 *
 * Shows disc details container, updates all disc information sections
 * (name, ID, tags, rarity, element, description, image, skills, archive),
 * and scrolls to the details section.
 *
 * @param discId - ID of disc to select and display
 */
function selectDisc(discId: string): void {
  discDBState.currentDiscId = discId;
  const disc = discDBState.discData[discId] as Disc & { DiscBg?: string; PromoteGroupId?: number };
  const discIP = discDBState.discIPData[discId];
  const itemData = discDBState.itemData[discId];

  if (!disc) return;

  // Show details container
  const detailsContainer = document.getElementById('disc-details');
  if (detailsContainer) {
    detailsContainer.style.display = 'block';
  }

  // Scroll with offset to show the beginning of the info box (including title)
  if (detailsContainer) {
    const yOffset = -100; // Offset to show content above the details
    const y = detailsContainer.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  // Update disc name
  const discName = discDBState.discNames[discId] || '';
  const nameEl = document.getElementById('disc-name');
  if (nameEl) nameEl.textContent = discName;

  // Update disc ID
  const idEl = document.getElementById('disc-id');
  if (idEl) idEl.textContent = `${window.i18n?.t('discdb.id')}: ${discId}`;

  // Update disc tags
  renderDiscTags(disc);

  // Update rarity stars
  const rarityInfo = getDiscRarityInfo(disc);
  const starsEl = document.getElementById('disc-rarity-stars');
  if (starsEl) {
    const starIcon = '★';
    const emptyStarIcon = '☆';
    const maxStars = 5;
    let starsHtml = '';

    for (let i = 0; i < maxStars; i++) {
      if (i < rarityInfo.stars) {
        starsHtml += `<span class="star filled">${starIcon}</span>`;
      } else {
        starsHtml += `<span class="star empty">${emptyStarIcon}</span>`;
      }
    }

    starsEl.innerHTML = starsHtml;
  }

  // Update element icon
  const elementInfo = discDBState.gameEnums.elementType?.[disc.EET] as { icon?: string; name?: string } | undefined || {};
  const elementIcon = document.getElementById('disc-element-icon') as HTMLImageElement | null;
  if (elementIcon && elementInfo.icon) {
    elementIcon.src = elementInfo.icon;
    elementIcon.alt = elementInfo.name || '';
    elementIcon.style.display = 'inline-block';
  }

  // Update disc description
  updateDiscDescription(discId, itemData);

  // Update disc image
  updateDiscImage(discId, disc);

  // Update skills
  updateDiscSkills(disc);

  // Update archive/story
  updateDiscArchive(discId, discIP);

  // Reset and render disc attributes
  const levelSlider = document.getElementById('disc-level-slider') as HTMLInputElement | null;
  if (levelSlider) {
    levelSlider.value = '1';
    discDBState.discLevel = 1;
    discDBState.discLimitBreak = 0;

    const levelDisplay = document.getElementById('disc-current-level');
    const limitBreakDisplay = document.getElementById('disc-current-limitbreak');
    const limitBreakBadge = document.getElementById('disc-limitbreak-badge');

    if (levelDisplay) levelDisplay.textContent = '1';
    if (limitBreakDisplay) limitBreakDisplay.textContent = '0';
    if (limitBreakBadge) limitBreakBadge.style.display = 'none';
  }

  renderDiscAttributes(discId, discDBState.discLevel, discDBState.discLimitBreak);

  // Update BGM hero overlay buttons
  const player = discDBState.bgmPlayer;
  const playBtn = document.getElementById('disc-hero-play-btn') as HTMLButtonElement | null;
  const favBtn = document.getElementById('disc-hero-fav-btn') as HTMLButtonElement | null;
  const hasBgm = !!player && player.hasBgm(discId);
  if (playBtn) {
    playBtn.hidden = !hasBgm;
    playBtn.title = window.i18n?.t('discdb.bgm.playThisTooltip') ?? '';
    playBtn.onclick = hasBgm ? () => { void player!.playDisc(discId); } : null;
  }
  if (favBtn) {
    favBtn.hidden = !hasBgm;
    const isFav = !!player && player.isFavorite(discId);
    favBtn.classList.toggle('active', isFav);
    favBtn.title = window.i18n?.t(isFav ? 'discdb.bgm.unfavoriteTooltip' : 'discdb.bgm.favoriteTooltip') ?? '';
    favBtn.onclick = hasBgm ? () => {
      const nowFav = player!.toggleFavorite(discId);
      favBtn.classList.toggle('active', nowFav);
      favBtn.title = window.i18n?.t(nowFav ? 'discdb.bgm.unfavoriteTooltip' : 'discdb.bgm.favoriteTooltip') ?? '';
    } : null;
  }
}

function updateDiscDescription(discId: string, itemData: Item | undefined): void {
  const descContainer = document.getElementById('disc-description');
  if (!descContainer) return;

  if (itemData && (itemData as Record<string, unknown>).Literary) {
    const literary = (itemData as Record<string, unknown>).Literary as string;
    const descKR = discDBState.itemKRData[literary] || literary;
    descContainer.innerHTML = `<p class="disc-literary">${descKR}</p>`;
  } else {
    descContainer.innerHTML = `<p class="disc-literary">${window.i18n?.t('discdb.noDescription')}</p>`;
  }
}

function updateDiscImage(discId: string, disc: Disc & { DiscBg?: string }): void {
  const imgEl = document.getElementById('disc-portrait') as HTMLImageElement | null;
  if (!imgEl) return;

  if (disc && disc.DiscBg) {
    const imageName = extractFilename(disc.DiscBg);
    const imagePath = `assets/disc_icons/${imageName}_B.png`;
    imgEl.src = imagePath;
    imgEl.style.display = 'block';
  } else {
    imgEl.style.display = 'none';
  }
}

function getSkillId(groupId: number, level: number): string {
  const levelStr = String(level).padStart(2, '0');
  return `${groupId}${levelStr}`;
}

function getSkillIconPath(iconPath: string | undefined): string | null {
  if (!iconPath) return null;
  const filename = extractFilename(iconPath);
  return `assets/skill_icons/${filename}.png`;
}

// parseElementTags is imported from @/shared

/**
 * Updates and renders all disc skills
 *
 * Displays main skill, secondary skills (concerto), and note information
 * based on current skill level. Includes skill icons, names, and parsed descriptions.
 *
 * @param disc - Disc data containing skill group IDs
 */
function updateDiscSkills(disc: Disc): void {
  const container = document.getElementById('skills-container');
  if (!container) return;

  const skillsHTML: string[] = [];
  const limitBreak = discDBState.skillLevel;
  const extDisc = disc as Disc & {
    MainSkillGroupId?: number;
    SecondarySkillGroupId1?: number;
    SecondarySkillGroupId2?: number;
    SubNoteSkillGroupId?: number;
  };

  // Add informative note about skill levels
  skillsHTML.push(`
    <div class="skill-level-info-banner">
      <div class="info-item">
        <i class="fa-solid fa-info-circle"></i>
        <span><strong>${window.i18n?.t('discdb.mainSkill')}</strong>: ${window.i18n?.t('discdb.mainSkillLevelInfo')}</span>
      </div>
      <div class="info-item">
        <i class="fa-solid fa-info-circle"></i>
        <span><strong>${window.i18n?.t('discdb.concertoSkills')}</strong>: ${window.i18n?.t('discdb.concertoSkillLevelInfo')}</span>
      </div>
    </div>
  `);

  // Main Skill
  if (extDisc.MainSkillGroupId) {
    const skillId = getSkillId(extDisc.MainSkillGroupId, limitBreak);
    const mainSkill = discDBState.mainSkillData[skillId];

    if (mainSkill) {
      const skillName = discDBState.mainSkillKRData[mainSkill.Name] || mainSkill.Name || '메인 스킬';
      const rawDesc = discDBState.mainSkillKRData[mainSkill.Desc] || mainSkill.Desc || '';
      const parsedDesc = substituteSkillParams(rawDesc, mainSkill as unknown as Record<string, unknown>);
      const iconBgPath = getSkillIconPath(mainSkill.IconBg);
      const iconPath = getSkillIconPath(mainSkill.Icon);

      skillsHTML.push(`
        <div class="skill-card main-skill">
          <div class="skill-icon-container">
            ${iconBgPath ? createResponsiveImage(iconBgPath, 'skill bg', 'skill-icon-bg') : ''}
            ${iconPath ? createResponsiveImage(iconPath, skillName, 'skill-icon') : ''}
          </div>
          <div class="skill-content">
            <div class="skill-header">
              <span class="skill-badge main">${window.i18n?.t('discdb.mainSkill')}</span>
              <span class="skill-name">${skillName} <span class="skill-level-badge">Lv.${limitBreak}</span></span>
            </div>
            <div class="skill-description">${parsedDesc}</div>
          </div>
        </div>
      `);
    }
  }

  // Secondary Skills (capped at level 5)
  [extDisc.SecondarySkillGroupId1, extDisc.SecondarySkillGroupId2].forEach((groupId, index) => {
    if (!groupId) return;

    const secondarySkillLevel = Math.min(limitBreak, 5);
    const skillId = getSkillId(groupId, secondarySkillLevel);
    const secondarySkill = discDBState.secondarySkillData[skillId];

    if (secondarySkill) {
      const skillName = discDBState.secondarySkillKRData[secondarySkill.Name] || secondarySkill.Name || '협주 스킬';
      const rawDesc = discDBState.secondarySkillKRData[secondarySkill.Desc] || secondarySkill.Desc || '';
      const parsedDesc = substituteSkillParams(rawDesc, secondarySkill as unknown as Record<string, unknown>);
      const iconBgPath = getSkillIconPath(secondarySkill.IconBg);
      const iconPath = getSkillIconPath(secondarySkill.Icon);

      skillsHTML.push(`
        <div class="skill-card secondary-skill">
          <div class="skill-icon-container">
            ${iconBgPath ? createResponsiveImage(iconBgPath, 'skill bg', 'skill-icon-bg') : ''}
            ${iconPath ? createResponsiveImage(iconPath, skillName, 'skill-icon') : ''}
          </div>
          <div class="skill-content">
            <div class="skill-header">
              <span class="skill-badge secondary">${window.i18n?.t(`discdb.concertoSkill${index + 1}`)}</span>
              <span class="skill-name">${skillName} <span class="skill-level-badge">Lv.${secondarySkillLevel}</span></span>
            </div>
            <div class="skill-description">${parsedDesc}</div>
          </div>
        </div>
      `);
    }
  });

  // Add note information
  if (extDisc.SubNoteSkillGroupId) {
    skillsHTML.push(generateNotesDisplay(disc));
  }

  container.innerHTML = skillsHTML.join('');
}

function getSecondarySkillNoteRequirements(disc: Disc): string[] {
  const uniqueNotes = new Set<string>();
  const extDisc = disc as Disc & { SecondarySkillGroupId1?: number; SecondarySkillGroupId2?: number };

  [extDisc.SecondarySkillGroupId1, extDisc.SecondarySkillGroupId2].forEach((groupId) => {
    if (!groupId) return;

    for (let level = 1; level <= 9; level++) {
      const skillId = String(groupId) + String(level).padStart(2, '0');
      const skill = discDBState.secondarySkillData[skillId];

      if (skill && skill.NeedSubNoteSkills) {
        try {
          const requirements = JSON.parse(skill.NeedSubNoteSkills);
          Object.keys(requirements).forEach((noteId) => uniqueNotes.add(noteId));
        } catch {
          // Silent fail
        }
      }
    }
  });

  return Array.from(uniqueNotes);
}

function getNoteIconPath(noteData: SubNoteSkill): string {
  if (!noteData || !noteData.Icon) return '';
  const filename = extractFilename(noteData.Icon);
  return `assets/common/${filename}_S.png`;
}

/**
 * Generates HTML for note system display
 *
 * Shows both required notes (for secondary skills) and provided notes
 * (from sub disc) with phase level controls.
 *
 * @param disc - Disc data with SubNoteSkillGroupId
 * @returns HTML string for notes section, or empty string if no notes
 */
function generateNotesDisplay(disc: Disc): string {
  const extDisc = disc as Disc & { SubNoteSkillGroupId?: number };
  if (!disc || !extDisc.SubNoteSkillGroupId) return '';

  const phase = discDBState.phaseLevel;
  const lookupId = String(extDisc.SubNoteSkillGroupId * 100 + phase);
  const phaseData = discDBState.subNoteSkillPromoteData[lookupId];

  if (!phaseData || !phaseData.SubNoteSkills) return '';

  try {
    const noteContributions = JSON.parse(phaseData.SubNoteSkills);
    const requiredNotes = getSecondarySkillNoteRequirements(disc);

    const providedNoteItems = Object.entries(noteContributions)
      .map(([noteId, count]) => {
        const noteData = discDBState.subNoteSkillData[noteId];
        if (!noteData) return '';

        const noteIconPath = getNoteIconPath(noteData);
        const noteName = discDBState.subNoteSkillKRData[noteData.Name] || noteData.Name || '';

        return `
          <div class="note-item">
            ${noteIconPath ? createResponsiveImage(noteIconPath, noteName, 'note-icon') : ''}
            <div class="note-info">
              <div class="note-name">${noteName}</div>
              <div class="note-count">+${count}</div>
            </div>
          </div>
        `;
      })
      .filter((i) => i)
      .join('');

    const requiredNoteItems = requiredNotes
      .map((noteId) => {
        const noteData = discDBState.subNoteSkillData[noteId];
        if (!noteData) return '';

        const noteIconPath = getNoteIconPath(noteData);
        const noteName = discDBState.subNoteSkillKRData[noteData.Name] || noteData.Name || '';

        return `
          <div class="note-item">
            ${noteIconPath ? createResponsiveImage(noteIconPath, noteName, 'note-icon') : ''}
            <div class="note-info">
              <div class="note-name">${noteName}</div>
            </div>
          </div>
        `;
      })
      .filter((i) => i)
      .join('');

    const phaseLabels = ['1+', '10+', '20+', '30+', '40+', '50+', '60+', '70+', '80+'];

    if (providedNoteItems || requiredNoteItems) {
      return `
        <div class="notes-section">
          <div class="notes-container">
            ${
              requiredNoteItems
                ? `
              <div class="notes-column">
                <div class="section-header">
                  <h3 class="section-title">
                    <span class="section-icon"><i class="fa-solid fa-star"></i></span>
                    ${window.i18n?.t('discdb.requiredNotes')}
                  </h3>
                </div>
                <div class="notes-grid required-notes">
                  ${requiredNoteItems}
                </div>
              </div>
            `
                : ''
            }

            ${
              providedNoteItems
                ? `
              <div class="notes-column">
                <div class="section-header">
                  <h3 class="section-title">
                    <span class="section-icon"><i class="fa-solid fa-music"></i></span>
                    ${window.i18n?.t('discdb.providedNotes')}
                  </h3>
                </div>
                <div class="notes-grid">
                  ${providedNoteItems}
                </div>

                <div class="note-level-control">
                  <label class="level-label">
                    <i class="fa-solid fa-music"></i> ${window.i18n?.t('discdb.notePhase')}
                  </label>
                  <div class="level-adjuster">
                    <button class="level-btn" data-phase-delta="-1">
                      <i class="fa-solid fa-minus"></i>
                    </button>
                    <span id="phase-level-display" class="level-display">${phaseLabels[discDBState.phaseLevel]}</span>
                    <button class="level-btn" data-phase-delta="1">
                      <i class="fa-solid fa-plus"></i>
                    </button>
                  </div>
                </div>
              </div>
            `
                : ''
            }
          </div>
        </div>
      `;
    }
  } catch (e) {
    console.error('Error parsing notes:', e);
  }

  return '';
}

function updateDiscArchive(discId: string, discIP: { StoryName: string; StoryDesc?: string } | undefined): void {
  const container = document.getElementById('archive-container');
  if (!container) return;

  if (!discIP) {
    container.innerHTML = `<p class="no-archive">${window.i18n?.t('discdb.noStory')}</p>`;
    return;
  }

  const storyName = discIP.StoryName;
  const storyDesc = discIP.StoryDesc;
  const storyNameKR = discDBState.discIPKRData[storyName] || storyName || '';
  const storyDescKR = storyDesc ? discDBState.discIPKRData[storyDesc] || storyDesc || '' : '';

  container.innerHTML = `
    <div class="archive-item">
      <div class="archive-header">
        <h3 class="archive-title">${storyNameKR}</h3>
      </div>
      <div class="archive-content">
        <p>${storyDescKR}</p>
      </div>
    </div>
  `;
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * Filters displayed discs by element type
 *
 * Updates UI to show only discs of selected element, or all if 'all' selected.
 * Updates active state of filter buttons.
 *
 * @param element - Element type ID as string, or 'all' for no filter
 */
function filterDiscsByElement(element: string): void {
  discDBState.selector.selectedElement = element;

  document.querySelectorAll('.element-filter-btn').forEach((btn) => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.element === element);
  });

  const searchInput = document.getElementById('disc-search') as HTMLInputElement | null;
  const searchQuery = searchInput ? searchInput.value : '';

  renderDiscSelector(searchQuery);
}

function adjustDiscLevelSlider(): void {
  const slider = document.getElementById('disc-level-slider') as HTMLInputElement | null;
  const levelDisplay = document.getElementById('disc-current-level');
  const limitBreakDisplay = document.getElementById('disc-current-limitbreak');
  const limitBreakBadge = document.getElementById('disc-limitbreak-badge');

  if (!slider || !levelDisplay || !limitBreakDisplay) return;

  const sliderValue = parseInt(slider.value);
  const { level, limitBreak } = getDiscStatsFromSlider(sliderValue);

  levelDisplay.textContent = String(level);
  limitBreakDisplay.textContent = String(limitBreak);

  if (limitBreakBadge) {
    limitBreakBadge.style.display = limitBreak > 0 ? 'inline-flex' : 'none';
  }

  discDBState.discLevel = level;
  discDBState.discLimitBreak = limitBreak;

  if (discDBState.currentDiscId) {
    renderDiscAttributes(discDBState.currentDiscId, level, discDBState.discLimitBreak);
  }
}

function adjustSkillLevel(delta: number): void {
  const currentLevel = discDBState.skillLevel;
  const newLevel = Math.max(1, Math.min(6, currentLevel + delta));

  if (newLevel !== currentLevel) {
    discDBState.skillLevel = newLevel;
    const displayEl = document.getElementById('skill-level-display');
    if (displayEl) displayEl.textContent = String(newLevel);

    if (discDBState.currentDiscId) {
      const disc = discDBState.discData[discDBState.currentDiscId];
      if (disc) {
        updateDiscSkills(disc);
      }
    }
  }
}

function adjustPhaseLevel(delta: number): void {
  const currentPhase = discDBState.phaseLevel;
  const newPhase = Math.max(0, Math.min(8, currentPhase + delta));

  if (newPhase !== currentPhase) {
    discDBState.phaseLevel = newPhase;

    const phaseLabelMap = ['1+', '10+', '20+', '30+', '40+', '50+', '60+', '70+', '80+'];
    const displayEl = document.getElementById('phase-level-display');
    if (displayEl) displayEl.textContent = phaseLabelMap[newPhase] || '';

    if (discDBState.currentDiscId) {
      const disc = discDBState.discData[discDBState.currentDiscId];
      if (disc) {
        updateDiscSkills(disc);
      }
    }
  }
}

function setupSearchHandler(): void {
  const searchInput = document.getElementById('disc-search');
  if (!searchInput) return;

  let debounceTimer: ReturnType<typeof setTimeout>;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
      renderDiscSelector((e.target as HTMLInputElement).value);
    }, 300);
  });
}

/**
 * Sets up event delegation for dynamically generated UI elements
 *
 * Uses event delegation pattern to handle phase level adjustment buttons
 * without polluting global namespace. Listens on document level and uses
 * closest() to find target elements.
 */
function setupEventDelegation(): void {
  // Event delegation for phase level adjustment buttons
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Phase level adjustment buttons
    const levelBtn = target.closest('.level-btn[data-phase-delta]') as HTMLElement | null;
    if (levelBtn) {
      const delta = parseInt(levelBtn.dataset.phaseDelta || '0');
      if (delta !== 0) adjustPhaseLevel(delta);
      return;
    }
  });
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initializes the disc database page
 *
 * Workflow:
 * 1. Initialize i18n system
 * 2. Initialize global navigation header
 * 3. Set up language change listener
 * 4. Load disc data
 * 5. Set up search and event handlers
 */
async function initPage(): Promise<void> {
  await window.i18n?.init();

  // Initialize Global Header after i18n is ready
  initGlobalHeader('discdb');

  // Initialize Page Info Modal
  initInfoModal();

  window.addEventListener('languageChanged', async () => {
    console.info('[DiscDB] Language changed, reloading data');
    await loadDiscData();
    window.i18n?.updatePage();
    if (discDBState.currentDiscId) {
      selectDisc(discDBState.currentDiscId);
    }
  });

  await loadDiscData();
  setupSearchHandler();
  setupEventDelegation();

  // Initialize BGM player (safe if no-op — init returns null on unsupported browsers).
  const panelEl = document.getElementById('disc-bgm-panel');
  if (panelEl) {
    discDBState.bgmPlayer = initBgmPlayer({
      panelEl,
      bgmMap: discDBState.bgmMap,
      getDiscName: (id) => discDBState.discNames[id] || id,
      getDiscIconPath,
      t: (key) => window.i18n?.t(key) ?? key,
    });
  }

  // Handle favorite-row nav events
  document.addEventListener('bgm:navigate', (ev) => {
    const detail = (ev as CustomEvent<{ discId: string }>).detail;
    if (detail?.discId) selectDisc(detail.discId);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}

// Export for global access
window.filterDiscsByElement = filterDiscsByElement;
window.adjustDiscLevelSlider = adjustDiscLevelSlider;
window.adjustSkillLevel = adjustSkillLevel;
// adjustPhaseLevel now handled by event delegation

// Type declarations
declare global {
  interface Window {
    filterDiscsByElement?: (element: string) => void;
    adjustDiscLevelSlider?: () => void;
    adjustSkillLevel?: (delta: number) => void;
  }
}

export { discDBState, loadDiscData, selectDisc, filterDiscsByElement };

