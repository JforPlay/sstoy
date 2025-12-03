/**
 * Discs Tab Module
 * Handles disc selection and management for main and sub discs
 */

import { fetchJSON, debounce, log, onLanguageChange, loadFeatureData, loadLanguageData } from '../shared';
import { GameData, getDiscRarityInfo } from '../shared/game-data';
import { Modal } from '../shared/ui-components';
import { substituteSkillParams } from './param-parser';
import Fuse from 'fuse.js';
import type {
  GameLanguage,
  DiscSlotId,
  DiscState,
  Disc,
  DiscIP,
  Item,
  MainSkill,
  SecondarySkill,
  SubNoteSkill,
  SubNoteSkillPromoteGroup,
  EffectValue,
  GameEnums,
  ToastType,
} from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface ImageSizes {
  width: number;
  height: number;
}

interface ImageSizesConfig {
  DISC_ICON: ImageSizes;
  DISC_PORTRAIT: ImageSizes;
  NOTE_ICON: ImageSizes;
}

interface ElementInfo {
  name: string;
  icon: string;
}

interface RarityInfo {
  key: string;
  stars: number;
  borderClass: string;
}

interface SecondarySkillData {
  skill: SecondarySkill | null;
  groupId: number;
  isActive: boolean;
  Level: number;
}

interface SkillTranslation {
  name: string;
  desc: string;
}

interface DiscSelectorState {
  allDiscsWithNames: Array<{ disc: Disc; name: string; id: string }>;
  fuse: Fuse<{ disc: Disc; name: string; id: string }> | null;
  selectedElement: string;
  searchListener: ((e: Event) => void) | null;
}

interface ScheduleRenderOptions {
  preserveFocusId?: string | null;
}

// Fuse.js type


// Note: showToast and getIcon are available on window object

// =============================================================================
// CONSTANTS
// =============================================================================

const IMAGE_SIZES: ImageSizesConfig = {
  DISC_ICON: { width: 80, height: 80 },
  DISC_PORTRAIT: { width: 200, height: 200 },
  NOTE_ICON: { width: 48, height: 48 },
};

// =============================================================================
// STATE
// =============================================================================

export const discsState: DiscState = {
  allDiscs: [],
  discNames: {},
  itemData: {},
  gameEnums: {} as GameEnums,
  mainSkillData: {},
  secondarySkillData: {},
  mainSkillKRData: {},
  secondarySkillKRData: {},
  subNoteSkillPromoteData: {},
  subNoteSkillData: {},
  subNoteSkillKRData: {},
  effectValueData: {},
  selectedDiscs: {
    main1: null,
    main2: null,
    main3: null,
    sub1: null,
    sub2: null,
    sub3: null,
  },
  discLimitBreaks: {
    main1: 1,
    main2: 1,
    main3: 1,
    sub1: 1,
    sub2: 1,
    sub3: 1,
  },
  subDiscLevels: {
    sub1: 0,
    sub2: 0,
    sub3: 0,
  },
  acquiredNotes: {},
  currentSlot: null,
  requiredNotes: new Set(),
  discSelector: {
    allDiscsWithNames: [],
    fuse: null,
    selectedElement: 'all',
    searchListener: null,
  } as DiscSelectorState,
};

// Cache for note calculations
let notesFromDiscsCache: Record<string, number> | null = null;
let notesCacheKey: string | null = null;

// Throttled render scheduling
let discsRenderScheduled = false;
let pendingFocusId: string | null = null;

// Modal instances
let discModal: Modal | null = null;
let imageViewerModal: Modal | null = null;

// =============================================================================
// CACHE FUNCTIONS
// =============================================================================

function getNotesCacheKey(): string {
  const subDiscs = (['sub1', 'sub2', 'sub3'] as const).map((slotId) => {
    const disc = discsState.selectedDiscs[slotId];
    const level = discsState.subDiscLevels[slotId] || 0;
    return disc ? `${disc.Id}:${level}` : 'null';
  });
  return subDiscs.join('|');
}

function invalidateNotesCache(): void {
  notesFromDiscsCache = null;
  notesCacheKey = null;
}

// =============================================================================
// RENDER SCHEDULING
// =============================================================================

function scheduleRenderDiscs(options: ScheduleRenderOptions = {}): void {
  pendingFocusId = options.preserveFocusId || pendingFocusId;
  if (discsRenderScheduled) return;
  discsRenderScheduled = true;
  requestAnimationFrame(() => {
    discsRenderScheduled = false;
    renderDiscs(pendingFocusId);
    pendingFocusId = null;
  });
}

// =============================================================================
// DATA LOADING
// =============================================================================

export async function loadDiscData(): Promise<void> {
  try {
    const gameLang = window.i18n?.currentLang || 'KR';
    log(`[App-Disc] Loading data for language: ${gameLang}`);

    // Load disc system data
    await loadFeatureData('discSystem');
    
    // Load language specific data
    await loadLanguageData(gameLang, ['DiscIP.json', 'MainSkill.json', 'SecondarySkill.json', 'SubNoteSkill.json']);

    // Populate local state from GameData
    // Core data (Items, Enums) and EffectValue are assumed to be loaded by app-char (core/characterBuilder)
    discsState.itemData = GameData.items;
    discsState.gameEnums = GameData.gameEnums;
    discsState.effectValueData = GameData.effectValue;

    discsState.mainSkillData = GameData.mainSkills;
    discsState.secondarySkillData = GameData.secondarySkills;
    discsState.subNoteSkillPromoteData = GameData.subNoteSkillPromote;
    discsState.subNoteSkillData = GameData.subNoteSkills;
    
    // Localization maps
    discsState.mainSkillKRData = GameData.mainSkillsKR || {};
    discsState.secondarySkillKRData = GameData.secondarySkillsKR || {};
    discsState.subNoteSkillKRData = GameData.subNoteSkillsKR || {};

    // Process disc data
    const discData = GameData.discs;
    if (discData) {
        discsState.allDiscs = Object.values(discData).filter((disc: any) => disc.Visible);

        // Create disc names mapping
        discsState.allDiscs.forEach((disc) => {
          const discIP = GameData.discIP?.[disc.Id];
          if (discIP && discIP.StoryName) {
            const koreanName = GameData.discIPKR?.[discIP.StoryName];
            discsState.discNames[disc.Id] = koreanName || discIP.StoryName;
          }
        });
    }

    renderDiscs();
  } catch (error) {
    console.error('Error loading disc data:', error);
    window.showToast?.(window.i18n?.t('disc.loadError') || 'Failed to load disc data.', 'error');
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getDiscIconPath(disc: Disc | null): string {
  if (!disc || !disc.Id) return '';
  const item = discsState.itemData[disc.Id];
  if (!item || !item.Icon) return '';

  const parts = item.Icon.split('/');
  const iconName = parts[parts.length - 1];
  return `assets/disc_icons/${iconName}.png`;
}

function getDiscLargeImagePath(discBg: string | undefined): string {
  if (!discBg) return '';
  const parts = discBg.split('/');
  const imageName = parts[parts.length - 1];
  return `assets/disc_icons/${imageName}_B.png`;
}

function getDiscElementInfo(disc: Disc | null): ElementInfo {
  const noElement = window.i18n?.t('disc.noElement') || 'No Element';
  if (!disc || !disc.EET) return { name: noElement, icon: '' };
  const elementInfo = discsState.gameEnums.elementType?.[disc.EET];
  return {
    name: elementInfo?.name || noElement,
    icon: elementInfo?.icon || '',
  };
}

function getSkillId(groupId: number, limitBreak: number): string {
  const levelStr = String(limitBreak).padStart(2, '0');
  return `${groupId}${levelStr}`;
}

function getMainSkillData(disc: Disc | null, limitBreak: number): MainSkill | null {
  if (!disc || !disc.MainSkillGroupId) return null;
  const skillId = getSkillId(disc.MainSkillGroupId, limitBreak);
  return discsState.mainSkillData[skillId] || null;
}

// =============================================================================
// NOTE CALCULATIONS
// =============================================================================

export function calculateNotesFromSubDiscs(): Record<string, number> {
  const currentKey = getNotesCacheKey();
  if (notesFromDiscsCache !== null && notesCacheKey === currentKey) {
    return notesFromDiscsCache;
  }

  const notesFromDiscs: Record<string, number> = {};

  (['sub1', 'sub2', 'sub3'] as const).forEach((slotId) => {
    const disc = discsState.selectedDiscs[slotId];
    if (!disc || !disc.SubNoteSkillGroupId) return;

    const phase = discsState.subDiscLevels[slotId] || 0;

    const promoteEntry = Object.values(discsState.subNoteSkillPromoteData).find((entry) => {
      if (entry.GroupId !== disc.SubNoteSkillGroupId) return false;
      const entryPhase = entry.Phase !== undefined ? entry.Phase : 0;
      return entryPhase === phase;
    });

    if (promoteEntry && promoteEntry.SubNoteSkills) {
      try {
        const noteContributions = JSON.parse(promoteEntry.SubNoteSkills) as Record<string, number>;
        for (const [noteId, value] of Object.entries(noteContributions)) {
          notesFromDiscs[noteId] = (notesFromDiscs[noteId] || 0) + value;
        }
      } catch {
        // Silent fail - invalid JSON
      }
    }
  });

  notesFromDiscsCache = notesFromDiscs;
  notesCacheKey = currentKey;

  return notesFromDiscs;
}

function getTotalNoteLevels(): Record<string, number> {
  const noteLevels: Record<string, number> = {};
  const notesFromDiscs = calculateNotesFromSubDiscs();

  const allNoteIds = new Set([
    ...Object.keys(notesFromDiscs),
    ...Object.keys(discsState.acquiredNotes),
  ]);

  allNoteIds.forEach((noteId) => {
    const fromDiscs = notesFromDiscs[noteId] || 0;
    const acquired = discsState.acquiredNotes[noteId] || 0;
    noteLevels[noteId] = fromDiscs + acquired;
  });

  return noteLevels;
}

function getTotalNoteLevel(noteId: string): number {
  const notesFromDiscs = calculateNotesFromSubDiscs();
  const fromDiscs = notesFromDiscs[noteId] || 0;
  const acquired = discsState.acquiredNotes[noteId] || 0;
  const total = fromDiscs + acquired;

  const noteData = discsState.subNoteSkillData[noteId];
  const maxLevel = noteData && noteData.Scores ? noteData.Scores.length : 100;

  return Math.min(total, maxLevel);
}

// =============================================================================
// SECONDARY SKILL FUNCTIONS
// =============================================================================

function getSecondarySkillByNotes(
  groupId: number,
  currentNoteLevels: Record<string, number>
): SecondarySkill | null {
  let highestSkill: SecondarySkill | null = null;

  for (let level = 9; level >= 1; level--) {
    const skillId = String(groupId) + String(level).padStart(2, '0');
    const skill = discsState.secondarySkillData[skillId];

    if (skill) {
      if (skill.NeedSubNoteSkills) {
        try {
          const requirements = JSON.parse(skill.NeedSubNoteSkills) as Record<string, number>;
          const requirementsMet = Object.entries(requirements).every(([noteId, requiredLevel]) => {
            const currentLevel = currentNoteLevels[noteId] || 0;
            return currentLevel >= requiredLevel;
          });

          if (requirementsMet) {
            highestSkill = skill;
            break;
          }
        } catch {
          // Silent fail - invalid JSON format
        }
      } else if (level === 1) {
        highestSkill = skill;
        break;
      }
    }
  }

  return highestSkill;
}

function getSecondarySkillsData(disc: Disc | null): SecondarySkillData[] {
  if (!disc) return [];

  const skills: SecondarySkillData[] = [];
  const currentNoteLevels = getTotalNoteLevels();

  if (disc.SecondarySkillGroupId1) {
    const skill1 = getSecondarySkillByNotes(disc.SecondarySkillGroupId1, currentNoteLevels);
    skills.push({
      skill: skill1,
      groupId: disc.SecondarySkillGroupId1,
      isActive: skill1 !== null,
      Level: skill1 ? skill1.Level : 0,
    });
  }

  if (disc.SecondarySkillGroupId2) {
    const skill2 = getSecondarySkillByNotes(disc.SecondarySkillGroupId2, currentNoteLevels);
    skills.push({
      skill: skill2,
      groupId: disc.SecondarySkillGroupId2,
      isActive: skill2 !== null,
      Level: skill2 ? skill2.Level : 0,
    });
  }

  return skills;
}

// =============================================================================
// SKILL PARSING
// =============================================================================

function parseElementTags(description: string): string {
  return window.parseElementTags ? window.parseElementTags(description) : description;
}

function getSkillTranslation(
  skill: MainSkill | SecondarySkill | null,
  isMainSkill: boolean
): SkillTranslation {
  if (!skill) return { name: '', desc: '' };

  const krData = isMainSkill ? discsState.mainSkillKRData : discsState.secondarySkillKRData;
  const name = krData[skill.Name] || skill.Name || '';
  const desc = krData[skill.Desc] || skill.Desc || '';

  return {
    name,
    desc: substituteSkillParams(desc, skill as unknown as Record<string, unknown>),
  };
}

function getSkillIconPath(iconPath: string | undefined): string | null {
  if (!iconPath) return null;
  const parts = iconPath.split('/');
  const filename = parts[parts.length - 1];
  return `assets/skill_icons/${filename}.png`;
}

// =============================================================================
// NOTE DESCRIPTION PARSING
// =============================================================================

function parseNoteDescription(description: string, noteId: string, level: number): string {
  if (!description || level === 0) return description;

  const noteData = discsState.subNoteSkillData[noteId];
  if (!noteData || !noteData.Param2) return description;

  const param2Parts = noteData.Param2.split(',').map((p) => p.trim());

  if (param2Parts.length < 4) {
    return description;
  }

  const [fileType, levelType, baseId, fieldKey, formatType] = param2Parts;

  if (fileType !== 'Effect' || levelType !== 'LevelUp') {
    return description;
  }

  if (!baseId) {
    return description;
  }

  const effectId = parseInt(baseId, 10) + level * 10;
  const effectEntry = discsState.effectValueData[effectId.toString()];

  if (!effectEntry) {
    return description;
  }

  let value: string | number | undefined = effectEntry[fieldKey as keyof EffectValue] as string | number | undefined;
  if (value === undefined) {
    return description;
  }

  if (formatType === 'HdPct') {
    const numValue = parseFloat(String(value)) * 100;
    const roundedValue = Math.round(numValue * 100) / 100;
    value = `${roundedValue}%`;
  }

  let parsedDesc = description;
  if (parsedDesc.includes('&Param2&')) {
    const styledValue = `<span class="param-value">${value}</span>`;
    parsedDesc = parsedDesc.replaceAll('&Param2&', styledValue);
  }

  parsedDesc = parseElementTags(parsedDesc);

  return parsedDesc;
}

function getNoteIconPath(noteData: SubNoteSkill | undefined): string {
  if (!noteData || !noteData.Icon) return '';

  const parts = noteData.Icon.split('/');
  const iconName = parts[parts.length - 1];
  return `assets/${iconName}_S.png`;
}

// =============================================================================
// SCORE CALCULATIONS
// =============================================================================

function calculateSecondarySkillsScore(): number {
  let totalScore = 0;

  (['main1', 'main2', 'main3'] as const).forEach((slotId) => {
    const disc = discsState.selectedDiscs[slotId];
    if (!disc) return;

    const secondarySkills = getSecondarySkillsData(disc);

    secondarySkills.forEach((skillData) => {
      if (skillData.isActive && skillData.skill && skillData.skill.Score) {
        totalScore += skillData.skill.Score;
      }
    });
  });

  return totalScore;
}

function calculateNotesScore(): number {
  let totalScore = 0;

  const notesFromDiscs = calculateNotesFromSubDiscs();
  const allNoteIds = new Set([
    ...Object.keys(notesFromDiscs),
    ...Object.keys(discsState.acquiredNotes),
  ]);

  allNoteIds.forEach((noteId) => {
    const totalLevel = getTotalNoteLevel(noteId);
    if (totalLevel === 0) return;

    const noteData = discsState.subNoteSkillData[noteId];
    if (noteData && noteData.Scores) {
      const scoreIndex = totalLevel - 1;
      if (scoreIndex >= 0 && scoreIndex < noteData.Scores.length) {
        totalScore += noteData.Scores[scoreIndex]!;
      }
    }
  });

  return totalScore;
}

export function calculateDiscScore(): number {
  const secondarySkillScore = calculateSecondarySkillsScore();
  const notesScore = calculateNotesScore();
  return secondarySkillScore + notesScore;
}

// =============================================================================
// REQUIRED NOTES
// =============================================================================

function getSecondarySkillNoteRequirements(disc: Disc | null): string[] {
  if (!disc) return [];

  const uniqueNotes = new Set<string>();

  [disc.SecondarySkillGroupId1, disc.SecondarySkillGroupId2].forEach((groupId) => {
    if (!groupId) return;

    for (let level = 1; level <= 9; level++) {
      const skillId = String(groupId) + String(level).padStart(2, '0');
      const skill = discsState.secondarySkillData[skillId];

      if (skill && skill.NeedSubNoteSkills) {
        try {
          const requirements = JSON.parse(skill.NeedSubNoteSkills) as Record<string, number>;
          Object.keys(requirements).forEach((noteId) => uniqueNotes.add(noteId));
        } catch {
          // Silent fail
        }
      }
    }
  });

  return Array.from(uniqueNotes);
}

export function updateRequiredNotes(): void {
  const requiredNotes = new Set<string>();

  (['main1', 'main2', 'main3'] as const).forEach((slotId) => {
    const disc = discsState.selectedDiscs[slotId];
    if (disc) {
      const notes = getSecondarySkillNoteRequirements(disc);
      notes.forEach((noteId) => requiredNotes.add(noteId));
    }
  });

  discsState.requiredNotes = requiredNotes;
}

function calculateNoteOverlap(disc: Disc): number {
  if (!disc || !disc.SubNoteSkillGroupId) return 0;

  const lookupId = String(disc.SubNoteSkillGroupId * 100);
  const phaseData = discsState.subNoteSkillPromoteData[lookupId];

  if (!phaseData || !phaseData.SubNoteSkills) return 0;

  try {
    const noteContributions = JSON.parse(phaseData.SubNoteSkills) as Record<string, number>;
    const providedNotes = Object.keys(noteContributions);
    return providedNotes.filter((noteId) => discsState.requiredNotes.has(noteId)).length;
  } catch {
    return 0;
  }
}

// =============================================================================
// HTML GENERATION
// =============================================================================

function generateNotesDisplay(): string {
  const notesFromDiscs = calculateNotesFromSubDiscs();
  const allNoteTypes = Object.keys(discsState.subNoteSkillData).sort();

  if (allNoteTypes.length === 0) {
    return `<p class="no-notes">${window.i18n?.t('disc.noteDataLoading') || 'Loading note data...'}</p>`;
  }

  const usedNotes = allNoteTypes.filter((noteId) => discsState.requiredNotes.has(noteId));
  const unusedNotes = allNoteTypes.filter((noteId) => !discsState.requiredNotes.has(noteId));

  const generateNoteCard = (noteId: string, isUsed: boolean): string => {
    const noteData = discsState.subNoteSkillData[noteId];
    if (!noteData) return '';

    const fromDiscs = notesFromDiscs[noteId] || 0;
    const acquired = discsState.acquiredNotes[noteId] || 0;
    const totalLevel = fromDiscs + acquired;
    const maxLevel = noteData.Scores ? noteData.Scores.length : 100;

    const krName = discsState.subNoteSkillKRData[noteData.Name] || noteData.Name || '';
    const krBriefDesc = discsState.subNoteSkillKRData[noteData.BriefDesc] || noteData.BriefDesc || '';
    const krDesc = discsState.subNoteSkillKRData[noteData.Desc] || noteData.Desc || '';

    const parsedDesc = parseNoteDescription(krDesc, noteId, totalLevel);
    const iconPath = getNoteIconPath(noteData);

    return `
      <div class="disc-note-card ${isUsed ? 'used-note' : 'unused-note'}">
        <div class="note-header">
          ${iconPath ? `<img src="${iconPath}" alt="${krName}" class="note-icon" width="${IMAGE_SIZES.NOTE_ICON.width}" height="${IMAGE_SIZES.NOTE_ICON.height}" loading="lazy" onerror="this.style.display='none'">` : ''}
          <div class="note-title">
            <h4>${krName}</h4>
            <p class="note-brief">${krBriefDesc}</p>
          </div>
        </div>
        <div class="note-levels">
          <div class="note-level-row">
            <span class="note-level-label">${window.i18n?.t('disc.subDisc') || 'Sub Disc'}:</span>
            <span class="note-level-value from-discs">${fromDiscs}</span>
          </div>
          <div class="note-level-row">
            <span class="note-level-label">${window.i18n?.t('disc.totalLevel') || 'Total Level'}:</span>
            <div class="note-level-control">
              <button class="note-adjust-btn"
                      data-action="disc-adjust-note-level"
                      data-note-id="${noteId}"
                      data-delta="-1">−</button>
              <input type="number"
                     id="note-total-${noteId}"
                     class="note-level-input total"
                     value="${totalLevel}"
                     min="${fromDiscs}"
                     max="${maxLevel}"
                     onchange="setTotalNoteLevel('${noteId}', this.value)"
                     onclick="this.select()">
              <button class="note-adjust-btn"
                      data-action="disc-adjust-note-level"
                      data-note-id="${noteId}"
                      data-delta="1">+</button>
            </div>
          </div>
          <div class="note-level-row additional">
            <span class="note-level-label">${window.i18n?.t('disc.additionalAcquired') || 'Additional'}:</span>
            <span class="note-level-value additional-level">${acquired}</span>
          </div>
        </div>
        ${totalLevel > 0 ? `
          <div class="note-effect">
            <div class="note-desc">${parsedDesc}</div>
          </div>
        ` : `
          <div class="note-effect inactive">
            <div class="note-desc">${window.i18n?.t('disc.noteLevelZero') || 'Note level is 0'}</div>
          </div>
        `}
      </div>
    `;
  };

  let html = '';

  if (usedNotes.length > 0) {
    html += `<div class="notes-section-header used">${window.i18n?.t('disc.usedNotes') || '📌 Used Notes'}</div>`;
    html += usedNotes.map((noteId) => generateNoteCard(noteId, true)).join('');
  }

  if (unusedNotes.length > 0) {
    html += `<div class="notes-section-header unused">${window.i18n?.t('disc.unusedNotes') || '💤 Unused Notes'}</div>`;
    html += unusedNotes.map((noteId) => generateNoteCard(noteId, false)).join('');
  }

  return html;
}

function generateDiscNotesDisplay(disc: Disc, phase: number): string {
  if (!disc || !disc.SubNoteSkillGroupId) return '';

  const lookupId = String(disc.SubNoteSkillGroupId * 100 + phase);
  const phaseData = discsState.subNoteSkillPromoteData[lookupId];

  if (!phaseData || !phaseData.SubNoteSkills) return '';

  try {
    const noteContributions = JSON.parse(phaseData.SubNoteSkills) as Record<string, number>;
    const noteItems = Object.entries(noteContributions)
      .map(([noteId, count]) => {
        const noteData = discsState.subNoteSkillData[noteId];
        if (!noteData) return '';

        const noteIconPath = getNoteIconPath(noteData);
        const noteName = discsState.subNoteSkillKRData[noteData.Name] || noteData.Name || '';

        return `
          <div class="disc-card-note-item">
            ${noteIconPath ? `<img src="${noteIconPath}" alt="${noteName}" class="disc-card-note-icon" width="${IMAGE_SIZES.NOTE_ICON.width}" height="${IMAGE_SIZES.NOTE_ICON.height}" loading="lazy" onerror="this.style.display='none'">` : ''}
            <div class="disc-card-note-info">
              <div class="disc-card-note-name">${noteName}</div>
              <div class="disc-card-note-count">+${count}</div>
            </div>
          </div>
        `;
      })
      .filter((i) => i)
      .join('');

    if (noteItems) {
      return `
        <div class="disc-card-notes-section">
          <div class="disc-card-notes-header">${window.i18n?.t('disc.providedNotes') || '🎵 Provided Notes'}</div>
          <div class="disc-card-notes-grid">
            ${noteItems}
          </div>
        </div>
      `;
    }
  } catch {
    // Silent fail
  }

  return '';
}

function generateSkillsDisplay(
  mainSkill: MainSkill | null,
  secondarySkills: SecondarySkillData[],
  limitBreak: number
): string {
  if (!mainSkill && (!secondarySkills || secondarySkills.length === 0)) return '';

  let html = '<div class="disc-skills-section">';

  if (mainSkill) {
    const translation = getSkillTranslation(mainSkill, true);
    const iconBgPath = getSkillIconPath(mainSkill.IconBg);
    const iconPath = getSkillIconPath(mainSkill.Icon);

    html += `
      <div class="disc-skill-item main-skill">
        <div class="skill-icon-container">
          ${iconBgPath ? `<img src="${iconBgPath}" alt="skill bg" class="skill-icon-bg" width="80" height="80" loading="lazy" onerror="this.style.display='none'">` : ''}
          ${iconPath ? `<img src="${iconPath}" alt="${translation.name}" class="skill-icon" width="60" height="60" loading="lazy" onerror="this.style.display='none'">` : ''}
        </div>
        <div class="skill-content">
          <div class="skill-header">
            <span class="skill-badge main">${window.i18n?.t('disc.melodySkill') || 'Melody Skill'}</span>
            <span class="skill-level-badge">Lv.${limitBreak}</span>
            <span class="skill-name">${translation.name}</span>
          </div>
          <div class="skill-desc">${translation.desc}</div>
        </div>
      </div>
    `;
  }

  if (secondarySkills && secondarySkills.length > 0) {
    secondarySkills.forEach((skillData) => {
      const secondarySkill = skillData.skill;
      const isActive = skillData.isActive;
      const skillLevel = skillData.Level || 0;
      const badgeText = window.i18n?.t('disc.harmonySkill') || 'Harmony Skill';

      if (isActive && secondarySkill) {
        const translation = getSkillTranslation(secondarySkill, false);
        const iconBgPath = getSkillIconPath(secondarySkill.IconBg);
        const iconPath = getSkillIconPath(secondarySkill.Icon);

        html += `
          <div class="disc-skill-item secondary-skill">
            <div class="skill-icon-container">
              ${iconBgPath ? `<img src="${iconBgPath}" alt="skill bg" class="skill-icon-bg" width="80" height="80" loading="lazy" onerror="this.style.display='none'">` : ''}
              ${iconPath ? `<img src="${iconPath}" alt="${translation.name}" class="skill-icon" width="60" height="60" loading="lazy" onerror="this.style.display='none'">` : ''}
            </div>
            <div class="skill-content">
              <div class="skill-header">
                <span class="skill-badge secondary">${badgeText}</span>
                <span class="skill-level-badge secondary-level">Lv.${skillLevel}</span>
                <span class="skill-name">${translation.name}</span>
              </div>
              <div class="skill-desc">${translation.desc}</div>
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="disc-skill-item secondary-skill inactive">
            <div class="skill-content">
              <div class="skill-header">
                <span class="skill-badge secondary inactive">${window.i18n?.t('disc.harmonySkill') || 'Harmony Skill'}</span>
                <span class="skill-level-badge secondary-level inactive">Lv.0</span>
                <span class="skill-name">${window.i18n?.t('disc.requirementNotMet') || 'Requirement Not Met'}</span>
              </div>
              <div class="skill-desc">${window.i18n?.t('disc.noteLevelNotMet') || 'Required note level not met.'}</div>
            </div>
          </div>
        `;
      }
    });
  }

  html += '</div>';
  return html;
}

function generateNoteRequirementsDisplay(disc: Disc): string {
  const requiredNotes = getSecondarySkillNoteRequirements(disc);

  if (requiredNotes.length === 0) return '';

  const noteItems = requiredNotes
    .map((noteId) => {
      const noteData = discsState.subNoteSkillData[noteId];
      if (!noteData) return '';

      const noteIconPath = getNoteIconPath(noteData);
      const noteName = discsState.subNoteSkillKRData[noteData.Name] || noteData.Name || '';

      return `
        <div class="required-note-item">
          ${noteIconPath ? `<img src="${noteIconPath}" alt="${noteName}" class="required-note-icon" width="${IMAGE_SIZES.NOTE_ICON.width}" height="${IMAGE_SIZES.NOTE_ICON.height}" loading="lazy" onerror="this.style.display='none'">` : ''}
          <span class="required-note-name">${noteName}</span>
        </div>
      `;
    })
    .filter((item) => item)
    .join('');

  if (!noteItems) return '';

  return `
    <div class="note-requirements-section">
      <div class="note-requirements-header">${window.i18n?.t('disc.requiredNotes') || '🎵 Required Notes'}</div>
      <div class="note-requirements-grid">
        ${noteItems}
      </div>
    </div>
  `;
}

function generateDiscSlot(slotId: DiscSlotId, slotNumber: number, isMain: boolean): string {
  const selectedDisc = discsState.selectedDiscs[slotId];
  const limitBreak = discsState.discLimitBreaks[slotId];
  const subDiscLevel = discsState.subDiscLevels[slotId as 'sub1' | 'sub2' | 'sub3'] || 0;

  const phaseLabelMap = ['1+', '10+', '20+', '30+', '40+', '50+', '60+', '70+', '80+'];
  const phaseLabel = phaseLabelMap[subDiscLevel] || '1+';

  if (selectedDisc) {
    const discName = discsState.discNames[selectedDisc.Id] || (window.i18n?.t('disc.unknownDisc') || 'Unknown Disc');
    const iconPath = getDiscIconPath(selectedDisc);
    const largePath = getDiscLargeImagePath(selectedDisc.DiscBg);
    const elementInfo = getDiscElementInfo(selectedDisc);
    const rarityInfo = getDiscRarityInfo(selectedDisc);

    let skillsHtml = '';
    let noteRequirementsHtml = '';
    if (isMain) {
      const mainSkill = getMainSkillData(selectedDisc, limitBreak);
      const secondarySkills = getSecondarySkillsData(selectedDisc);
      skillsHtml = generateSkillsDisplay(mainSkill, secondarySkills, limitBreak);
      noteRequirementsHtml = generateNoteRequirementsDisplay(selectedDisc);
    }

    let notesHtml = '';
    if (!isMain) {
      notesHtml = generateDiscNotesDisplay(selectedDisc, subDiscLevel);
    }

    let levelControlHtml = '';
    if (!isMain) {
      levelControlHtml = `
        <div class="limit-break-control">
          <label class="limit-break-label">${window.i18n?.t('disc.level') || 'Level'}</label>
          <div class="limit-break-selector">
            <button class="lb-btn"
                    data-action="disc-adjust-sub-level"
                    data-slot-id="${slotId}"
                    data-delta="-1"
                    ${subDiscLevel === 0 ? 'disabled' : ''}>-</button>
            <span class="lb-value">${phaseLabel}</span>
            <button class="lb-btn"
                    data-action="disc-adjust-sub-level"
                    data-slot-id="${slotId}"
                    data-delta="1"
                    ${subDiscLevel === 8 ? 'disabled' : ''}>+</button>
          </div>
        </div>
      `;
    } else {
      const exceedIconNumber = rarityInfo.stars;
      const exceedIconPath = `assets/disc_icons/rare_outfit_exceed_s_${exceedIconNumber}.png`;

      let exceedIconsHtml = '';
      for (let i = 0; i < limitBreak; i++) {
        exceedIconsHtml += `<img src="${exceedIconPath}" alt="${window.i18n?.t('disc.breakthrough') || 'Breakthrough'}" class="exceed-icon" width="32" height="32" loading="lazy" onerror="this.style.display='none'">`;
      }

      levelControlHtml = `
        <div class="limit-break-control">
          <label class="limit-break-label">${window.i18n?.t('disc.breakthrough') || 'Breakthrough'}</label>
          <div class="limit-break-selector">
            <button class="lb-btn"
                    data-action="disc-adjust-limit-break"
                    data-slot-id="${slotId}"
                    data-delta="-1"
                    ${limitBreak === 1 ? 'disabled' : ''}>-</button>
            <span class="lb-value">${limitBreak}</span>
            <button class="lb-btn"
                    data-action="disc-adjust-limit-break"
                    data-slot-id="${slotId}"
                    data-delta="1"
                    ${limitBreak === 6 ? 'disabled' : ''}>+</button>
          </div>
          <div class="exceed-icons-display">
            ${exceedIconsHtml}
          </div>
        </div>
      `;
    }

    return `
      <div class="disc-slot-card filled ${isMain ? 'main-disc' : 'sub-disc'}"
           data-action="disc-open-selector"
           data-slot-id="${slotId}">
        <div class="disc-slot-header">
          <span class="disc-slot-number">${slotNumber}</span>
          <div class="disc-slot-name-group">
            <div class="disc-name-with-element">
              <span class="disc-slot-name">${discName}</span>
              ${elementInfo.icon ? `<img src="${elementInfo.icon}" alt="${elementInfo.name}" class="disc-element-icon" title="${elementInfo.name}" width="20" height="20" loading="lazy" onerror="this.style.display='none'">` : `<span class="disc-element-name">${elementInfo.name}</span>`}
            </div>
            <span class="disc-slot-id">ID: ${selectedDisc.Id}</span>
          </div>
        </div>
        <div class="disc-slot-preview">
          <div class="disc-icon-container ${rarityInfo.borderClass}"
               data-action="disc-open-image-viewer"
               data-image-path="${largePath}"
               data-disc-name="${discName}"
               title="클릭하여 크게 보기">
            <img src="${iconPath}" alt="${discName}" class="disc-icon" width="${IMAGE_SIZES.DISC_ICON.width}" height="${IMAGE_SIZES.DISC_ICON.height}" loading="lazy"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="disc-placeholder" style="display: none;">
              <span class="disc-placeholder-icon">${window.getIcon?.('disc') || ''}</span>
            </div>
            <div class="disc-icon-overlay">
              <span class="zoom-icon">🔍</span>
            </div>
          </div>
          <div class="disc-action-buttons">
            <button class="change-disc-btn"
                    data-action="disc-open-selector"
                    data-slot-id="${slotId}">
              ${window.i18n?.t('disc.changeDisc') || 'Change Disc'}
            </button>
            <button class="remove-disc-btn"
                    data-action="disc-remove"
                    data-slot-id="${slotId}">
              ${window.i18n?.t('disc.removeDisc') || 'Remove Disc'}
            </button>
          </div>
        </div>

        ${levelControlHtml}

        ${notesHtml}

        ${noteRequirementsHtml}

        ${skillsHtml}
      </div>
    `;
  } else {
    return `
      <div class="disc-slot-card ${isMain ? 'main-disc' : 'sub-disc'}"
           data-action="disc-open-selector"
           data-slot-id="${slotId}">
        <div class="disc-slot-header">
          <span class="disc-slot-number">${slotNumber}</span>
          <span class="disc-slot-name">${isMain ? (window.i18n?.t('disc.main') || 'Main') : (window.i18n?.t('disc.sub') || 'Sub')} ${window.i18n?.t('summary.disc') || 'Disc'} ${slotNumber}</span>
        </div>
        <div class="disc-slot-preview">
          <div class="disc-placeholder">
            <span class="disc-placeholder-icon">${window.getIcon?.('disc') || ''}</span>
            <p>${window.i18n?.t('disc.selectDiscSlot') || 'Select Disc'}</p>
          </div>
        </div>
      </div>
    `;
  }
}

// =============================================================================
// MAIN RENDER
// =============================================================================

export function renderDiscs(preserveFocusId: string | null = null): void {
  const container = document.getElementById('discs-container');
  if (!container) return;

  const sidebarOpen = localStorage.getItem('notesSidebarOpen') !== 'false';

  const notesFromDiscs = calculateNotesFromSubDiscs();
  const totalNotes = Object.keys(notesFromDiscs).filter((noteId) => (notesFromDiscs[noteId] ?? 0) > 0).length;
  const acquiredCount = Object.keys(discsState.acquiredNotes).filter(
    (noteId) => (discsState.acquiredNotes[noteId] ?? 0) > 0
  ).length;
  const activeNotesCount = Math.max(totalNotes, acquiredCount);

  const discScore = calculateDiscScore();
  const secondarySkillScore = calculateSecondarySkillsScore();
  const notesScore = calculateNotesScore();

  container.innerHTML = `
    <div class="discs-layout">
      <div class="discs-main-content">
        <!-- Disc Score Display -->
        <div class="disc-score-banner">
          <div class="disc-score-main">
            <span class="disc-score-label">${window.i18n?.t('disc.discTotalScore') || 'Disc Total Score'}:</span>
            <span class="disc-score-value">${discScore}</span>
          </div>
          <div class="disc-score-breakdown">
            <span class="disc-score-detail">${window.i18n?.t('disc.harmonyScore') || 'Harmony'}: ${secondarySkillScore}</span>
            <span class="disc-score-separator">|</span>
            <span class="disc-score-detail">${window.i18n?.t('disc.noteScore') || 'Notes'}: ${notesScore}</span>
          </div>
        </div>

        <!-- Main Disc Slots -->
        <div class="disc-section">
          <h3 class="section-title">
            <span class="section-icon">🎵</span>
            ${window.i18n?.t('disc.mainDisc') || 'Main Disc'}
          </h3>
          <div class="disc-slots-grid">
            ${generateDiscSlot('main1', 1, true)}
            ${generateDiscSlot('main2', 2, true)}
            ${generateDiscSlot('main3', 3, true)}
          </div>
        </div>

        <!-- Sub Disc Slots -->
        <div class="disc-section">
          <h3 class="section-title">
            <span class="section-icon">🎶</span>
            ${window.i18n?.t('disc.subDiscLabel') || 'Sub Disc'}
          </h3>
          <div class="disc-slots-grid">
            ${generateDiscSlot('sub1', 1, false)}
            ${generateDiscSlot('sub2', 2, false)}
            ${generateDiscSlot('sub3', 3, false)}
          </div>
        </div>
      </div>

      <!-- Sidebar Overlay -->
      <div class="notes-sidebar-overlay ${sidebarOpen ? 'active' : ''}"
           id="notes-sidebar-overlay"
           data-action="disc-toggle-notes-sidebar"></div>

      <!-- Notes Sidebar -->
      <div class="notes-sidebar ${sidebarOpen ? 'open' : ''}" id="notes-sidebar">
        <div class="notes-sidebar-content">
          <div class="notes-sidebar-header">
            <h3 class="notes-sidebar-title">
              <span class="section-icon">🎼</span>
              ${window.i18n?.t('disc.noteLevel') || 'Note Level'}
            </h3>
            <button class="notes-sidebar-close"
                    data-action="disc-close-notes-sidebar"
                    title="${window.i18n?.t('disc.close') || 'Close'}">
              <span>✕</span>
            </button>
          </div>
          <div class="disc-notes-info">
            <p class="notes-explanation">${window.i18n?.t('disc.noteExplanation') || 'Sub discs automatically provide notes. Set additional acquired notes.'}</p>
          </div>
          <div class="disc-notes-grid" id="disc-notes-grid">
            ${generateNotesDisplay()}
          </div>
        </div>
      </div>

      <!-- Notes Toggle Button -->
      <button class="notes-sidebar-toggle ${sidebarOpen ? 'hidden' : ''}"
              id="notes-sidebar-toggle"
              data-action="disc-toggle-notes-sidebar"
              title="${window.i18n?.t('disc.noteLevel') || 'Note Level'}">
        <span class="toggle-icon">🎼</span>
        <span class="toggle-text">${window.i18n?.t('disc.notes') || 'Notes'}</span>
        ${activeNotesCount > 0 ? `<span class="toggle-badge">${activeNotesCount}</span>` : ''}
      </button>
    </div>

    <!-- Disc Selector Modal -->
    <div class="modal" id="disc-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>${window.i18n?.t('disc.selectDisc') || 'Select Disc'} - <span id="modal-slot-type"></span> <span id="modal-slot-number"></span></h2>
          <button class="close-btn" data-action="disc-close-selector">&times;</button>
        </div>

        <!-- Search and Filter -->
        <div class="selector-controls">
          <div class="search-container">
            <input type="text" id="disc-search" placeholder="${window.i18n?.t('disc.discSearchPlaceholder') || 'Search disc name...'}" class="search-input">
            <i class="fa-solid fa-search search-icon"></i>
          </div>

          <div class="element-filters">
            <button class="element-filter-btn active" data-element="all" data-action="disc-filter-element">
              <i class="fa-solid fa-border-all"></i> ${window.i18n?.t('disc.allElements') || 'All'}
            </button>
            <button class="element-filter-btn" data-element="1" data-action="disc-filter-element">
              <img src="assets/icon_common_property_1.png" alt="${window.i18n?.t('disc.waterElement') || 'Water'}" class="element-icon" width="20" height="20" loading="lazy" onerror="this.style.display='none'"> ${window.i18n?.t('disc.waterElement') || 'Water'}
            </button>
            <button class="element-filter-btn" data-element="2" data-action="disc-filter-element">
              <img src="assets/icon_common_property_2.png" alt="${window.i18n?.t('disc.fireElement') || 'Fire'}" class="element-icon" width="20" height="20" loading="lazy" onerror="this.style.display='none'"> ${window.i18n?.t('disc.fireElement') || 'Fire'}
            </button>
            <button class="element-filter-btn" data-element="3" data-action="disc-filter-element">
              <img src="assets/icon_common_property_3.png" alt="${window.i18n?.t('disc.earthElement') || 'Earth'}" class="element-icon" width="20" height="20" loading="lazy" onerror="this.style.display='none'"> ${window.i18n?.t('disc.earthElement') || 'Earth'}
            </button>
            <button class="element-filter-btn" data-element="4" data-action="disc-filter-element">
              <img src="assets/icon_common_property_4.png" alt="${window.i18n?.t('disc.windElement') || 'Wind'}" class="element-icon" width="20" height="20" loading="lazy" onerror="this.style.display='none'"> ${window.i18n?.t('disc.windElement') || 'Wind'}
            </button>
            <button class="element-filter-btn" data-element="5" data-action="disc-filter-element">
              <img src="assets/icon_common_property_5.png" alt="${window.i18n?.t('disc.lightElement') || 'Light'}" class="element-icon" width="20" height="20" loading="lazy" onerror="this.style.display='none'"> ${window.i18n?.t('disc.lightElement') || 'Light'}
            </button>
            <button class="element-filter-btn" data-element="6" data-action="disc-filter-element">
              <img src="assets/icon_common_property_6.png" alt="${window.i18n?.t('disc.darkElement') || 'Dark'}" class="element-icon" width="20" height="20" loading="lazy" onerror="this.style.display='none'"> ${window.i18n?.t('disc.darkElement') || 'Dark'}
            </button>
            <button class="element-filter-btn" data-element="7" data-action="disc-filter-element">
              <img src="assets/icon_common_property_7.png" alt="${window.i18n?.t('disc.noElementFilter') || 'No Element'}" class="element-icon" width="20" height="20" loading="lazy" onerror="this.style.display='none'"> ${window.i18n?.t('disc.noElementFilter') || 'No Element'}
            </button>
          </div>
        </div>

        <div class="disc-selector-grid" id="disc-selector-grid"></div>
      </div>
    </div>

    <!-- Image Viewer Modal -->
    <div class="modal" id="disc-image-viewer">
      <div class="image-viewer-content">
        <button class="close-btn" data-action="disc-close-image-viewer">&times;</button>
        <img id="viewer-image" src="" alt="Disc Image" width="${IMAGE_SIZES.DISC_PORTRAIT.width}" height="${IMAGE_SIZES.DISC_PORTRAIT.height}" loading="lazy">
        <div class="viewer-title" id="viewer-title"></div>
      </div>
    </div>
  `;

  if (preserveFocusId) {
    const target = document.getElementById(preserveFocusId) as HTMLInputElement | null;
    if (target) {
      const value = target.value || '';
      target.focus();
      // setSelectionRange throws an error on input type="number"
      if (target.setSelectionRange && target.type !== 'number') {
        const len = value.length;
        try {
          target.setSelectionRange(len, len);
        } catch (e) {
          console.warn('Failed to set selection range:', e);
        }
      }
    }
  }

  // Reset modal instances since DOM elements were replaced
  discModal = null;
  imageViewerModal = null;
}

// =============================================================================
// DISC SELECTOR
// =============================================================================

function setupDiscSearchInput(slotId: DiscSlotId): void {
  const searchInput = document.getElementById('disc-search') as HTMLInputElement | null;
  if (!searchInput) return;

  if (discsState.discSelector.searchListener) {
    searchInput.removeEventListener('input', discsState.discSelector.searchListener);
  }

  const listener = debounce((...args: unknown[]) => {
    const e = args[0] as Event;
    const target = e.target as HTMLInputElement;
    renderDiscGrid(target.value, slotId);
  }, 150) as (e: Event) => void;
  discsState.discSelector.searchListener = listener;
  searchInput.addEventListener('input', listener);
}

export function openDiscSelector(slotId: DiscSlotId): void {
  discsState.currentSlot = slotId;

  // Initialize modal if needed
  if (!discModal) {
    discModal = new Modal('disc-modal');
    discModal.onClose(() => {
      discsState.currentSlot = null;
    });
  }

  const slotType = document.getElementById('modal-slot-type');
  const slotNumber = document.getElementById('modal-slot-number');
  const searchInput = document.getElementById('disc-search') as HTMLInputElement | null;

  if (!slotType || !slotNumber) return;

  const isMain = slotId.startsWith('main');
  const num = slotId.replace(/\D/g, '');

  slotType.textContent = isMain ? (window.i18n?.t('disc.main') || 'Main') : (window.i18n?.t('disc.sub') || 'Sub');
  slotNumber.textContent = num;

  discsState.discSelector.allDiscsWithNames = discsState.allDiscs.map((disc) => ({
    disc,
    name: discsState.discNames[disc.Id] || (window.i18n?.t('disc.unknownDisc') || 'Unknown Disc'),
    id: String(disc.Id),
  }));

  if (typeof Fuse !== 'undefined') {
    discsState.discSelector.fuse = new Fuse(discsState.discSelector.allDiscsWithNames, {
      keys: ['name', 'id'],
      threshold: 0.4,
      includeScore: true,
    });
  }

  discsState.discSelector.selectedElement = 'all';
  if (searchInput) {
    searchInput.value = '';
  }

  const modalElem = document.getElementById('disc-modal');
  if (modalElem) {
    modalElem.querySelectorAll('.element-filter-btn').forEach((btn) => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.element === 'all');
    });
  }

  setupDiscSearchInput(slotId);
  renderDiscGrid('', slotId);

  discModal.open();
}

function renderDiscGrid(searchQuery = '', slotId: DiscSlotId): void {
  const grid = document.getElementById('disc-selector-grid');
  if (!grid) return;

  grid.innerHTML = '';

  const isMain = slotId.startsWith('main');

  const selectedDiscIds = new Set<number>();
  (Object.keys(discsState.selectedDiscs) as DiscSlotId[]).forEach((slot) => {
    if (slot !== slotId && discsState.selectedDiscs[slot]) {
      selectedDiscIds.add(discsState.selectedDiscs[slot]!.Id);
    }
  });

  let discsToDisplay = discsState.discSelector.allDiscsWithNames.map((item) => item.disc);

  if (discsState.discSelector.selectedElement !== 'all') {
    discsToDisplay = discsToDisplay.filter(
      (disc) => String(disc.EET) === discsState.discSelector.selectedElement
    );
  }

  if (searchQuery && searchQuery.trim() !== '') {
    if (discsState.discSelector.fuse) {
      const results = (discsState.discSelector.fuse as any).search(searchQuery);
      const searchIds = new Set(results.map((r: any) => r.item.disc.Id));
      discsToDisplay = discsToDisplay.filter((disc) => searchIds.has(disc.Id));
    } else {
      const query = searchQuery.toLowerCase();
      discsToDisplay = discsToDisplay.filter((disc) => {
        const discName = discsState.discNames[disc.Id] || '';
        return discName.toLowerCase().includes(query) || String(disc.Id).includes(query);
      });
    }
  }

  let sortedDiscs: Disc[];
  if (isMain) {
    sortedDiscs = [...discsToDisplay].sort((a, b) => b.Id - a.Id);
  } else {
    sortedDiscs = [...discsToDisplay].sort((a, b) => {
      const overlapA = calculateNoteOverlap(a);
      const overlapB = calculateNoteOverlap(b);

      if (overlapB !== overlapA) {
        return overlapB - overlapA;
      }

      return b.Id - a.Id;
    });
  }

  const fragment = document.createDocumentFragment();

  if (sortedDiscs.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-search-state';
    emptyState.innerHTML = `<p>${window.i18n?.t('builder.noSearchResults') || 'No search results'}</p>`;
    fragment.appendChild(emptyState);
  } else {
    sortedDiscs.forEach((disc) => {
      const discName = discsState.discNames[disc.Id] || (window.i18n?.t('disc.unknownDisc') || 'Unknown Disc');
      const iconPath = getDiscIconPath(disc);
      const isSelected = discsState.selectedDiscs[slotId]?.Id === disc.Id;
      const isDisabled = selectedDiscIds.has(disc.Id);
      const noteOverlap = !isMain ? calculateNoteOverlap(disc) : 0;
      const hasRequiredNotes = noteOverlap > 0;
      const elementInfo = getDiscElementInfo(disc);
      const rarityInfo = getDiscRarityInfo(disc);

      let notesInfo = '';
      if (!isMain && disc.SubNoteSkillGroupId) {
        const lookupId = String(disc.SubNoteSkillGroupId * 100);
        const phaseData = discsState.subNoteSkillPromoteData[lookupId];

        if (phaseData && phaseData.SubNoteSkills) {
          try {
            const noteContributions = JSON.parse(phaseData.SubNoteSkills) as Record<string, number>;
            const noteIcons = Object.keys(noteContributions)
              .slice(0, 5)
              .map((noteId) => {
                const noteData = discsState.subNoteSkillData[noteId];
                if (!noteData) return '';
                const noteIconPath = getNoteIconPath(noteData);
                const noteName = discsState.subNoteSkillKRData[noteData.Name] || noteData.Name || '';
                const isRequired = discsState.requiredNotes.has(noteId);
                return noteIconPath
                  ? `<img src="${noteIconPath}" alt="${noteName}" class="disc-note-preview-icon ${isRequired ? 'required-match' : ''}" title="${noteName} +${noteContributions[noteId]}" width="${IMAGE_SIZES.NOTE_ICON.width}" height="${IMAGE_SIZES.NOTE_ICON.height}" loading="lazy" onerror="this.style.display='none'">`
                  : '';
              })
              .filter((i) => i)
              .join('');

            if (noteIcons) {
              notesInfo = `<div class="disc-option-notes">${noteIcons}</div>`;
            }
          } catch {
            // Silent fail
          }
        }
      }

      const discOption = document.createElement('div');
      discOption.className = `disc-option ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''} ${hasRequiredNotes ? 'has-required-notes' : ''}`;
      if (!isDisabled) {
        discOption.dataset.action = 'disc-select-option';
        discOption.dataset.discId = String(disc.Id);
      }
      discOption.dataset.noteOverlap = String(noteOverlap);

      discOption.innerHTML = `
        <div class="disc-option-image ${rarityInfo.borderClass}">
          <img src="${iconPath}" alt="${discName}" width="${IMAGE_SIZES.DISC_ICON.width}" height="${IMAGE_SIZES.DISC_ICON.height}" loading="lazy"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div class="disc-placeholder" style="display: none;">
            <span class="disc-placeholder-icon">${window.getIcon?.('disc') || ''}</span>
          </div>
          ${isDisabled ? `<div class="disc-disabled-overlay"><span class="disc-disabled-text">${window.i18n?.t('disc.alreadySelected') || 'Already Selected'}</span></div>` : ''}
        </div>
        <div class="disc-option-info">
          <div class="disc-option-name">${discName}</div>
          <div class="disc-option-details">
            <span class="disc-option-id">ID: ${disc.Id}</span>
            ${elementInfo.icon ? `<img src="${elementInfo.icon}" alt="${elementInfo.name}" class="disc-option-element-icon" title="${elementInfo.name}" width="20" height="20" loading="lazy" onerror="this.style.display='none'">` : `<span class="disc-option-element">${elementInfo.name}</span>`}
          </div>
          ${notesInfo}
        </div>
      `;

      fragment.appendChild(discOption);
    });
  }

  grid.appendChild(fragment);
}

function filterDiscsByElement(element: string): void {
  discsState.discSelector.selectedElement = element;

  const modal = document.getElementById('disc-modal');
  if (modal) {
    modal.querySelectorAll('.element-filter-btn').forEach((btn) => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.element === element);
    });
  }

  const searchInput = document.getElementById('disc-search') as HTMLInputElement | null;
  const searchQuery = searchInput ? searchInput.value : '';

  if (discsState.currentSlot) {
    renderDiscGrid(searchQuery, discsState.currentSlot);
  }
}

export function selectDiscOption(discId: string | number): void {
  const currentSlot = discsState.currentSlot;
  if (!currentSlot) return;

  const disc = discsState.allDiscs.find((d) => d.Id == discId);
  if (!disc) return;

  discsState.selectedDiscs[currentSlot] = disc;

  if (currentSlot.startsWith('sub')) {
    invalidateNotesCache();
  }

  if (currentSlot.startsWith('main')) {
    updateRequiredNotes();
  }

  closeDiscSelector();
  renderDiscs();

  const discName = discsState.discNames[disc.Id] || (window.i18n?.t('summary.disc') || 'Disc');
  const isMain = currentSlot.startsWith('main');
  const num = currentSlot.replace(/\D/g, '');
  const slotType = isMain ? (window.i18n?.t('disc.main') || 'Main') : (window.i18n?.t('disc.sub') || 'Sub');
  const msg = (window.i18n?.t('disc.discSelected') || 'Selected ${discName} for ${slotType} slot ${num}.')
    .replace('${discName}', discName)
    .replace('${slotType}', slotType)
    .replace('${num}', num);
  window.showToast?.(msg, 'success');
}

export function removeDisc(slotId: DiscSlotId): void {
  if (!slotId || !discsState.selectedDiscs[slotId]) {
    return;
  }

  const disc = discsState.selectedDiscs[slotId]!;
  const discName = discsState.discNames[disc.Id] || (window.i18n?.t('summary.disc') || 'Disc');
  const isMain = slotId.startsWith('main');
  const num = slotId.replace(/\D/g, '');
  const slotType = isMain ? (window.i18n?.t('disc.main') || 'Main') : (window.i18n?.t('disc.sub') || 'Sub');

  discsState.selectedDiscs[slotId] = null;

  if (isMain || slotId.startsWith('sub')) {
    discsState.discLimitBreaks[slotId] = 1;
  }

  if (slotId.startsWith('sub')) {
    const subSlotId = slotId as 'sub1' | 'sub2' | 'sub3';
    if (discsState.subDiscLevels[subSlotId] !== undefined) {
      discsState.subDiscLevels[subSlotId] = 0;
    }
    invalidateNotesCache();
  }

  if (isMain) {
    updateRequiredNotes();
  }

  renderDiscs();

  const removeMsg = (window.i18n?.t('disc.discRemoved') || 'Removed ${discName} from ${slotType} slot ${num}.')
    .replace('${discName}', discName)
    .replace('${slotType}', slotType)
    .replace('${num}', num);
  window.showToast?.(removeMsg, 'info');
}

export function closeDiscSelector(): void {
  if (discModal) {
    discModal.close();
  }
  discsState.currentSlot = null;
}

// =============================================================================
// IMAGE VIEWER
// =============================================================================

export function openImageViewer(imagePath: string, title: string): void {
  if (!imageViewerModal) {
    imageViewerModal = new Modal('disc-image-viewer');
  }

  const image = document.getElementById('viewer-image') as HTMLImageElement | null;
  const titleEl = document.getElementById('viewer-title');

  if (!image || !titleEl) return;

  image.src = imagePath;
  titleEl.textContent = title;
  imageViewerModal.open();
}

export function closeImageViewer(): void {
  if (imageViewerModal) {
    imageViewerModal.close();
  }
}

// =============================================================================
// LEVEL ADJUSTMENTS
// =============================================================================

export function adjustLimitBreak(slotId: DiscSlotId, delta: number): void {
  const currentLB = discsState.discLimitBreaks[slotId];
  const newLB = Math.max(1, Math.min(6, currentLB + delta));

  if (newLB !== currentLB) {
    discsState.discLimitBreaks[slotId] = newLB;
    scheduleRenderDiscs();
  }
}

export function adjustSubDiscLevel(slotId: 'sub1' | 'sub2' | 'sub3', delta: number): void {
  const currentLevel = discsState.subDiscLevels[slotId] || 0;
  const newLevel = Math.max(0, Math.min(8, currentLevel + delta));

  if (newLevel !== currentLevel) {
    discsState.subDiscLevels[slotId] = newLevel;
    invalidateNotesCache();
    scheduleRenderDiscs();
  }
}

export function adjustTotalNoteLevel(noteId: string, delta: number): void {
  const notesFromDiscs = calculateNotesFromSubDiscs();
  const fromDiscs = notesFromDiscs[noteId] || 0;
  const currentAcquired = discsState.acquiredNotes[noteId] || 0;
  const currentTotal = fromDiscs + currentAcquired;

  const noteData = discsState.subNoteSkillData[noteId];
  const maxLevel = noteData && noteData.Scores ? noteData.Scores.length : 100;

  const newTotal = Math.max(fromDiscs, Math.min(maxLevel, currentTotal + delta));
  const newAcquired = newTotal - fromDiscs;

  if (newAcquired !== currentAcquired) {
    discsState.acquiredNotes[noteId] = newAcquired;
    scheduleRenderDiscs({ preserveFocusId: `note-total-${noteId}` });
  }
}

export function setTotalNoteLevel(noteId: string, value: string | number): void {
  const notesFromDiscs = calculateNotesFromSubDiscs();
  const fromDiscs = notesFromDiscs[noteId] || 0;

  const noteData = discsState.subNoteSkillData[noteId];
  const maxLevel = noteData && noteData.Scores ? noteData.Scores.length : 100;

  const numValue = parseInt(String(value), 10);
  const newTotal = isNaN(numValue) ? fromDiscs : Math.max(fromDiscs, Math.min(maxLevel, numValue));
  const newAcquired = newTotal - fromDiscs;

  discsState.acquiredNotes[noteId] = newAcquired;
  scheduleRenderDiscs({ preserveFocusId: `note-total-${noteId}` });
}

// Legacy functions for compatibility
export function adjustAcquiredNote(noteId: string, delta: number): void {
  adjustTotalNoteLevel(noteId, delta);
}

export function setAcquiredNote(noteId: string, value: string | number): void {
  setTotalNoteLevel(noteId, value);
}

// =============================================================================
// NOTES SIDEBAR
// =============================================================================

export function toggleNotesSidebar(): void {
  const sidebar = document.getElementById('notes-sidebar');
  const overlay = document.getElementById('notes-sidebar-overlay');
  const toggleBtn = document.getElementById('notes-sidebar-toggle');

  if (!sidebar || !toggleBtn || !overlay) return;

  const isOpen = sidebar.classList.contains('open');

  if (isOpen) {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    toggleBtn.classList.remove('hidden');
    localStorage.setItem('notesSidebarOpen', 'false');
  } else {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    toggleBtn.classList.add('hidden');
    localStorage.setItem('notesSidebarOpen', 'true');
  }
}

// =============================================================================
// EVENT DELEGATION
// =============================================================================

let discsEventDelegationInitialized = false;

function handleDiscsAction(element: HTMLElement, action: string, event: Event): void {
  // Helper to safely get slot ID
  const getSlotId = (): DiscSlotId | null => {
    const slotId = element.dataset.slotId as DiscSlotId;
    if (!slotId) {
      console.warn('[App-Disc] Missing slotId for action:', action);
      return null;
    }
    return slotId;
  };

  switch (action) {
    case 'disc-open-selector': {
      const slotId = getSlotId();
      if (slotId) openDiscSelector(slotId);
      break;
    }

    case 'disc-remove': {
      const slotId = getSlotId();
      if (slotId) removeDisc(slotId);
      break;
    }

    case 'disc-select-option': {
      const discId = element.dataset.discId;
      if (discId) selectDiscOption(discId);
      break;
    }

    case 'disc-close-selector':
      closeDiscSelector();
      break;

    case 'disc-filter-element':
      if (element.dataset.element) {
        filterDiscsByElement(element.dataset.element);
      }
      break;

    case 'disc-open-image-viewer':
      event.stopPropagation();
      if (element.dataset.imagePath && element.dataset.discName) {
        openImageViewer(element.dataset.imagePath, element.dataset.discName);
      }
      break;

    case 'disc-close-image-viewer':
      closeImageViewer();
      break;

    case 'disc-adjust-limit-break': {
      const slotId = getSlotId();
      const delta = parseInt(element.dataset.delta!, 10);
      if (slotId && !isNaN(delta)) {
        adjustLimitBreak(slotId, delta);
      }
      break;
    }

    case 'disc-adjust-sub-level': {
      const slotId = getSlotId();
      const delta = parseInt(element.dataset.delta!, 10);
      // Ensure slotId is a sub slot (though typing suggests it might be any, runtime check is safer)
      if (slotId && slotId.startsWith('sub') && !isNaN(delta)) {
        adjustSubDiscLevel(slotId as 'sub1' | 'sub2' | 'sub3', delta);
      }
      break;
    }

    case 'disc-toggle-notes-sidebar':
    case 'disc-close-notes-sidebar':
      toggleNotesSidebar();
      break;

    case 'disc-adjust-note-level': {
      const noteId = element.dataset.noteId;
      const delta = parseInt(element.dataset.delta!, 10);
      if (noteId && !isNaN(delta)) {
        adjustTotalNoteLevel(noteId, delta);
      }
      break;
    }

    default:
      break;
  }
}

function setupDiscsEventDelegation(): void {
  if (discsEventDelegationInitialized) return;
  discsEventDelegationInitialized = true;

  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-action]') as HTMLElement | null;

    if (!button) return;

    const action = button.dataset.action;
    if (action && action.startsWith('disc-')) {
      handleDiscsAction(button, action, e);
    }
  });

  // Global ESC listener for Image Viewer
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && imageViewerModal?.isOpen()) {
      imageViewerModal.close();
    }
  });
}

// =============================================================================
// INITIALIZATION
// =============================================================================

export async function init(): Promise<void> {
  setupDiscsEventDelegation();

  // Listen for language changes
  onLanguageChange(async () => {
    log('[App-Disc] Language changed, reloading data');
    if (document.getElementById('discs-container')) {
      await loadDiscData();
    }
  });

  // Auto-load if container exists
  if (document.getElementById('discs-container')) {
    await loadDiscData();
  }
  
  log('[App-Disc] Initialized');
}

// Make functions globally available for legacy compatibility
if (typeof window !== 'undefined') {
  window.loadDiscData = loadDiscData;
  window.renderDiscs = renderDiscs;
  window.openDiscSelector = openDiscSelector;
  window.selectDiscOption = selectDiscOption;
  window.closeDiscSelector = closeDiscSelector;
  window.openImageViewer = openImageViewer;
  window.closeImageViewer = closeImageViewer;
  window.adjustLimitBreak = adjustLimitBreak;
  window.adjustSubDiscLevel = adjustSubDiscLevel;
  window.adjustAcquiredNote = adjustAcquiredNote;
  window.setAcquiredNote = setAcquiredNote;
  window.adjustTotalNoteLevel = adjustTotalNoteLevel;
  window.setTotalNoteLevel = setTotalNoteLevel;
  window.toggleNotesSidebar = toggleNotesSidebar;
  window.calculateNotesFromSubDiscs = calculateNotesFromSubDiscs;
  window.calculateDiscScore = calculateDiscScore;
  window.updateRequiredNotes = updateRequiredNotes;
  window.discsState = discsState;
}

export default {
  discsState,
  loadDiscData,
  renderDiscs,
  openDiscSelector,
  selectDiscOption,
  closeDiscSelector,
  removeDisc,
  adjustLimitBreak,
  adjustSubDiscLevel,
  adjustTotalNoteLevel,
  setTotalNoteLevel,
  toggleNotesSidebar,
  calculateNotesFromSubDiscs,
  calculateDiscScore,
  updateRequiredNotes,
};
