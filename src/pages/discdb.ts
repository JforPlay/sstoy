/**
 * Disc Database Module
 * Handles disc selection, details display, and skill information
 */

// Import shared utilities (auto-initializes)
import '@/shared';
import '@/i18n';

import { showError, parseElementTags } from '@/shared';
import Fuse from 'fuse.js';
import type { Disc, MainSkill, SecondarySkill, SubNoteSkill, SubNoteSkillPromoteGroup, GameEnums, Item } from '@/types';

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
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function extractFilename(path: string): string {
  if (!path) return '';
  const parts = path.split('/');
  return parts[parts.length - 1] || '';
}

// =============================================================================
// DATA LOADING
// =============================================================================

async function loadDiscData(): Promise<void> {
  try {
    const gameLang = window.i18n?.currentLang || 'KR';
    const dataPath = window.i18n?.getDataPath(gameLang) || 'data/KR';

    console.log(`[DiscDB] Loading data for language: ${gameLang}`);

    const [
      discData,
      discIPData,
      discIPKRData,
      itemData,
      itemKRData,
      gameEnums,
      mainSkillData,
      secondarySkillData,
      mainSkillKRData,
      secondarySkillKRData,
      subNoteSkillData,
      subNoteSkillKRData,
      subNoteSkillPromoteData,
      discTagKRData,
      attributeData,
      discExtraAttributeData,
    ] = await Promise.all([
      fetch('data/Disc.json').then((r) => r.json()),
      fetch('data/DiscIP.json').then((r) => r.json()),
      fetch(`${dataPath}/DiscIP.json`).then((r) => r.json()),
      fetch('data/Item.json').then((r) => r.json()),
      fetch(`${dataPath}/Item.json`).then((r) => r.json()),
      fetch('data/GameEnums.json').then((r) => r.json()),
      fetch('data/MainSkill.json').then((r) => r.json()),
      fetch('data/SecondarySkill.json').then((r) => r.json()),
      fetch(`${dataPath}/MainSkill.json`).then((r) => r.json()),
      fetch(`${dataPath}/SecondarySkill.json`).then((r) => r.json()),
      fetch('data/SubNoteSkill.json').then((r) => r.json()),
      fetch(`${dataPath}/SubNoteSkill.json`).then((r) => r.json()),
      fetch('data/SubNoteSkillPromoteGroup.json').then((r) => r.json()),
      fetch(`${dataPath}/DiscTag.json`).then((r) => r.json()),
      fetch('data/Attribute.json').then((r) => r.json()),
      fetch('data/DiscExtraAttribute.json').then((r) => r.json()),
    ]);

    discDBState.discData = discData;
    discDBState.discIPData = discIPData;
    discDBState.discIPKRData = discIPKRData;
    discDBState.itemData = itemData;
    discDBState.itemKRData = itemKRData;
    discDBState.gameEnums = gameEnums;
    discDBState.mainSkillData = mainSkillData;
    discDBState.secondarySkillData = secondarySkillData;
    discDBState.mainSkillKRData = mainSkillKRData;
    discDBState.secondarySkillKRData = secondarySkillKRData;
    discDBState.subNoteSkillData = subNoteSkillData;
    discDBState.subNoteSkillKRData = subNoteSkillKRData;
    discDBState.subNoteSkillPromoteData = subNoteSkillPromoteData;
    discDBState.discTagKRData = discTagKRData;
    discDBState.attributeData = attributeData;
    discDBState.discExtraAttributeData = discExtraAttributeData;

    // Build disc names map
    Object.entries(discData as Record<string, Disc>).forEach(([id, disc]) => {
      if (disc.Visible && (disc as Record<string, unknown>).Available) {
        const discIPEntry = discIPData[id];
        if (discIPEntry) {
          const storyName = discIPEntry.StoryName;
          discDBState.discNames[id] =
            discIPKRData[storyName] || storyName || window.i18n?.t('discdb.discNameDefault') || `Disc ${id}`;
        } else {
          discDBState.discNames[id] = window.i18n?.t('discdb.discNameDefault') || `Disc ${id}`;
        }
      }
    });

    // Build allDiscs array
    discDBState.allDiscs = Object.entries(discData as Record<string, Disc>)
      .filter(([, disc]) => disc.Visible && (disc as Record<string, unknown>).Available)
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
        <img src="${iconPath}" alt="${name}" loading="lazy" onerror="this.style.display='none'">
        ${elementInfo.icon ? `<img src="${elementInfo.icon}" alt="${elementInfo.name || ''}" class="disc-card-element-badge" loading="lazy" onerror="this.style.display='none'">` : ''}
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

function getDiscRarityInfo(disc: Disc): { key: string; stars: number; borderClass: string } {
  if (!disc || !disc.Id) return { key: 'N', stars: 1, borderClass: 'rarity-n' };
  const item = discDBState.itemData[disc.Id];
  if (!item || !item.Rarity) return { key: 'N', stars: 1, borderClass: 'rarity-n' };

  const rarityInfo = discDBState.gameEnums.itemRarity?.[item.Rarity];
  if (!rarityInfo) return { key: 'N', stars: 1, borderClass: 'rarity-n' };

  const rarityClassMap: Record<string, string> = {
    SSR: 'rarity-ssr',
    SR: 'rarity-sr',
    R: 'rarity-r',
    M: 'rarity-m',
    N: 'rarity-n',
  };

  return {
    key: rarityInfo.key,
    stars: rarityInfo.stars,
    borderClass: rarityClassMap[rarityInfo.key] || 'rarity-n',
  };
}

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

    if (discDBState.gameEnums.effectAttributeType) {
      for (const [, enumValue] of Object.entries(discDBState.gameEnums.effectAttributeType)) {
        if (
          (enumValue as { key?: string; name?: string }).key &&
          (enumValue as { key: string }).key.toUpperCase() === key.toUpperCase()
        ) {
          attrName = (enumValue as { name: string }).name;
          break;
        }
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
      statsHTML.push(`<div class="stat-section-title">${window.i18n?.t('discdb.breakBonus')}</div>`);

      extraAttrs.forEach((attr) => {
        statsHTML.push(`
          <div class="stat-item extra-stat">
            <span class="stat-name">${window.i18n?.t('discdb.break')} ${attr.Break}</span>
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

function parseSkillDescription(description: string, skill: MainSkill | SecondarySkill): string {
  if (!description || !skill) return description;

  let parsedDesc = description;

  // Replace {1} through {10} with actual Param values
  for (let i = 1; i <= 10; i++) {
    const placeholder = `{${i}}`;
    const paramValue = (skill as Record<string, unknown>)[`Param${i}`];

    if (parsedDesc.includes(placeholder) && paramValue) {
      const styledValue = `<span class="param-value">${paramValue}</span>`;
      parsedDesc = parsedDesc.replaceAll(placeholder, styledValue);
    }
  }

  // Parse element tag patterns
  parsedDesc = parseElementTags(parsedDesc);

  return parsedDesc;
}

// parseElementTags is imported from @/shared

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

  // Main Skill
  if (extDisc.MainSkillGroupId) {
    const skillId = getSkillId(extDisc.MainSkillGroupId, limitBreak);
    const mainSkill = discDBState.mainSkillData[skillId];

    if (mainSkill) {
      const skillName = discDBState.mainSkillKRData[mainSkill.Name] || mainSkill.Name || '메인 스킬';
      const rawDesc = discDBState.mainSkillKRData[mainSkill.Desc] || mainSkill.Desc || '';
      const parsedDesc = parseSkillDescription(rawDesc, mainSkill);
      const iconBgPath = getSkillIconPath(mainSkill.IconBg);
      const iconPath = getSkillIconPath(mainSkill.Icon);

      skillsHTML.push(`
        <div class="skill-card main-skill">
          <div class="skill-icon-container">
            ${iconBgPath ? `<img src="${iconBgPath}" alt="skill bg" class="skill-icon-bg" loading="lazy" onerror="this.style.display='none'">` : ''}
            ${iconPath ? `<img src="${iconPath}" alt="${skillName}" class="skill-icon" loading="lazy" onerror="this.style.display='none'">` : ''}
          </div>
          <div class="skill-content">
            <div class="skill-header">
              <span class="skill-badge main">${window.i18n?.t('discdb.mainSkill')}</span>
              <span class="skill-name">${skillName}</span>
            </div>
            <div class="skill-description">${parsedDesc}</div>
          </div>
        </div>
      `);
    }
  }

  // Secondary Skills
  [extDisc.SecondarySkillGroupId1, extDisc.SecondarySkillGroupId2].forEach((groupId, index) => {
    if (!groupId) return;

    const skillId = getSkillId(groupId, limitBreak);
    const secondarySkill = discDBState.secondarySkillData[skillId];

    if (secondarySkill) {
      const skillName = discDBState.secondarySkillKRData[secondarySkill.Name] || secondarySkill.Name || '협주 스킬';
      const rawDesc = discDBState.secondarySkillKRData[secondarySkill.Desc] || secondarySkill.Desc || '';
      const parsedDesc = parseSkillDescription(rawDesc, secondarySkill);
      const iconBgPath = getSkillIconPath(secondarySkill.IconBg);
      const iconPath = getSkillIconPath(secondarySkill.Icon);

      skillsHTML.push(`
        <div class="skill-card secondary-skill">
          <div class="skill-icon-container">
            ${iconBgPath ? `<img src="${iconBgPath}" alt="skill bg" class="skill-icon-bg" loading="lazy" onerror="this.style.display='none'">` : ''}
            ${iconPath ? `<img src="${iconPath}" alt="${skillName}" class="skill-icon" loading="lazy" onerror="this.style.display='none'">` : ''}
          </div>
          <div class="skill-content">
            <div class="skill-header">
              <span class="skill-badge secondary">${window.i18n?.t(`discdb.concertoSkill${index + 1}`)}</span>
              <span class="skill-name">${skillName}</span>
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
  return `assets/${filename}_S.png`;
}

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
            ${noteIconPath ? `<img src="${noteIconPath}" alt="${noteName}" class="note-icon" loading="lazy" onerror="this.style.display='none'">` : ''}
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
            ${noteIconPath ? `<img src="${noteIconPath}" alt="${noteName}" class="note-icon" loading="lazy" onerror="this.style.display='none'">` : ''}
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
                    <button class="level-btn" onclick="adjustPhaseLevel(-1)">
                      <i class="fa-solid fa-minus"></i>
                    </button>
                    <span id="phase-level-display" class="level-display">${phaseLabels[discDBState.phaseLevel]}</span>
                    <button class="level-btn" onclick="adjustPhaseLevel(1)">
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
  const newLevel = Math.max(1, Math.min(5, currentLevel + delta));

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

// =============================================================================
// INITIALIZATION
// =============================================================================

async function initPage(): Promise<void> {
  await window.i18n?.init();

  window.addEventListener('languageChanged', async () => {
    console.log('[DiscDB] Language changed, reloading data');
    await loadDiscData();
    window.i18n?.updatePage();
    if (discDBState.currentDiscId) {
      selectDisc(discDBState.currentDiscId);
    }
  });

  await loadDiscData();
  setupSearchHandler();
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
window.adjustPhaseLevel = adjustPhaseLevel;

// Type declarations
declare global {
  interface Window {
    filterDiscsByElement?: (element: string) => void;
    adjustDiscLevelSlider?: () => void;
    adjustSkillLevel?: (delta: number) => void;
    adjustPhaseLevel?: (delta: number) => void;
  }
}

export { discDBState, loadDiscData, selectDisc, filterDiscsByElement };

