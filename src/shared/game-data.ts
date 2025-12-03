/**
 * Game Data Store
 * Centralized singleton to hold all static game data.
 * Removes the need for every module to maintain its own copy of the database.
 */

import type { CharacterData, Item, PotentialData, SkillData, Disc } from '../types';

// Define a flexible interface for the data store
// We use 'any' for complex types not yet fully defined in centralized types
// to avoid type errors during the refactoring transition.
export interface GameDataStore {
  characters: Record<string, CharacterData>;
  charactersKR: Record<string, string>; // Localized names
  characterDes: Record<string, any>;
  characterDesKR: Record<string, any>;
  items: Record<string, Item>;
  itemsKR: Record<string, string>;
  potentials: Record<string, PotentialData>;
  potentialsKR: Record<string, string>; // Localized names
  skills: Record<string, SkillData>;
  skillsKR: Record<string, string>; // Localized names
  
  // Talents & Dating
  talentGroups: Record<string, any>;
  talentGroupsKR: Record<string, any>;
  talents: Record<string, any>;
  talentsKR: Record<string, any>;
  characterTagKR: Record<string, any>;
  datingEvents: Record<string, any>;
  datingLandmarkKR: Record<string, any>;
  datingBranchKR: Record<string, any>;
  charGetLines: Record<string, any>;
  charGetLinesKR: Record<string, any>;
  charGem: Record<string, any>;
  characterArchive: Record<string, any>;
  characterArchiveContent: Record<string, any>;
  characterArchiveContentKR: Record<string, any>;
  affinityGifts: Record<string, any>;
  agents: Record<string, any>;
  agentsKR: Record<string, any>;

  // Character Upgrade System
  characterUpgrade: Record<string, any>;
  characterSkillUpgrade: Record<string, any>;
  characterAdvance: Record<string, any>;
  charRaritySequence: Record<string, any>;
  charItemExp: Record<string, any>;
  starTowerBuildRank: Record<string, any>;

  // Enums and Configs
  gameEnums: Record<string, any>;
  uiText: Record<string, string>;
  
  // Math & Values
  effectValue: Record<string, any>;
  buffValue: Record<string, any>;
  shieldValue: Record<string, any>;
  hitDamage: Record<string, any>;
  onceAdditionalAttributeValue: Record<string, any>;
  scriptParameterValue: Record<string, any>;
  
  // Disc System
  discs: Record<string, any>;
  discIP: Record<string, any>;
  discIPKR: Record<string, any>;
  discTagKR: Record<string, any>;
  mainSkills: Record<string, any>;
  mainSkillsKR: Record<string, any>;
  secondarySkills: Record<string, any>;
  secondarySkillsKR: Record<string, any>;
  subNoteSkills: Record<string, any>;
  subNoteSkillsKR: Record<string, any>;
  subNoteSkillPromote: Record<string, any>;
  discItemExp: Record<string, any>;
  discPromoteLimit: Record<string, any>;
  discStrengthen: Record<string, any>;
  discPromote: Record<string, any>;
  discExtraAttribute: Record<string, any>;
  
  // Other
  [key: string]: any;
}

// Initialize with empty objects
export const GameData: GameDataStore = {
  characters: {},
  charactersKR: {},
  characterDes: {},
  characterDesKR: {},
  items: {},
  itemsKR: {},
  potentials: {},
  potentialsKR: {},
  skills: {},
  skillsKR: {},
  talentGroups: {},
  talentGroupsKR: {},
  talents: {},
  talentsKR: {},
  characterTagKR: {},
  datingEvents: {},
  datingLandmarkKR: {},
  datingBranchKR: {},
  charGetLines: {},
  charGetLinesKR: {},
  charGem: {},
  characterArchive: {},
  characterArchiveContent: {},
  characterArchiveContentKR: {},
  affinityGifts: {},
  agents: {},
  agentsKR: {},
  characterUpgrade: {},
  characterSkillUpgrade: {},
  characterAdvance: {},
  charRaritySequence: {},
  charItemExp: {},
  starTowerBuildRank: {},
  gameEnums: {},
  uiText: {},
  effectValue: {},
  buffValue: {},
  shieldValue: {},
  hitDamage: {},
  onceAdditionalAttributeValue: {},
  scriptParameterValue: {},
  discs: {},
  discIP: {},
  discIPKR: {},
  discTagKR: {},
  mainSkills: {},
  mainSkillsKR: {},
  secondarySkills: {},
  secondarySkillsKR: {},
  subNoteSkills: {},
  subNoteSkillsKR: {},
  subNoteSkillPromote: {},
  discItemExp: {},
  discPromoteLimit: {},
  discStrengthen: {},
  discPromote: {},
  discExtraAttribute: {},
};

/**
 * Helper to get localized character name safely
 */
export function getCharacterName(id: string): string {
  const key = `Character.${id}.1`;
  return GameData.charactersKR[key] || GameData.characters[id]?.Name || `Character ${id}`;
}

/**
 * Helper to get localized item name safely
 */
export function getItemName(id: string): string {
  // Try direct ID lookup or Item.ID.1 format
  if (GameData.itemsKR[id]) return GameData.itemsKR[id];
  const key = `Item.${id}.1`;
  return GameData.itemsKR[key] || (GameData.items[id]?.Name as string) || `Item ${id}`;
}

// =============================================================================
// SHARED CONSTANTS
// =============================================================================

// Element colors
export const ELEMENT_COLORS = {
    1: { bg: 'rgba(107, 155, 209, 0.15)', border: '#6B9BD1', color: '#6B9BD1', name: '물' },   // Water - Sky Blue
    2: { bg: 'rgba(232, 138, 173, 0.15)', border: '#E88AAD', color: '#E88AAD', name: '불' },     // Fire - Pastel Pink
    3: { bg: 'rgba(244, 198, 160, 0.15)', border: '#F4C6A0', color: '#F4C6A0', name: '땅' },    // Earth - Peach
    4: { bg: 'rgba(126, 215, 193, 0.15)', border: '#7ED7C1', color: '#7ED7C1', name: '바람' },  // Wind - Mint Green
    5: { bg: 'rgba(245, 230, 184, 0.15)', border: '#F5E6B8', color: '#F5E6B8', name: '빛' },    // Light - Soft Yellow
    6: { bg: 'rgba(197, 184, 224, 0.15)', border: '#C5B8E0', color: '#C5B8E0', name: '어둠' }  // Dark - Lavender
};

// Stat icons (for display) - Using Font Awesome via window.getIcon?.()
export const STAT_ICONS = {
    'Atk': 'attack',
    'Hp': 'hp',
    'Def': 'defense',
    'HitRate': 'accuracy',
    'CritRate': 'critRate',
    'CritPower': 'critPower'
};

// Main stats to display (in order)
export const MAIN_STATS = ['Atk', 'Hp', 'Def', 'HitRate', 'CritRate', 'CritPower'];

// Mapping from Attribute data keys to effectAttributeType enum IDs
// This is needed because the attribute keys (Hp, HitRate, etc.) don't match
// the effectAttributeType keys (MAXHP, HITRATE, etc.)
export const STAT_TO_EFFECT_ID: Record<string, string> = {
    'Atk': '1',          // ATK
    'Hp': '3',           // MAXHP
    'Def': '2',          // DEF
    'HitRate': '4',      // HITRATE
    'CritRate': '6',     // CRITRATE
    'CritPower': '8'     // CRITPOWER_P
};

export interface RarityInfo {
  key: string;
  stars: number;
  borderClass: string;
}

/**
 * Get rarity info for a disc
 */
export function getDiscRarityInfo(disc: Disc | null): RarityInfo {
  if (!disc || !disc.Id) return { key: 'N', stars: 1, borderClass: 'rarity-n' };
  const item = GameData.items[disc.Id];
  if (!item || !item.Rarity) return { key: 'N', stars: 1, borderClass: 'rarity-n' };

  const rarityInfo = GameData.gameEnums.itemRarity?.[item.Rarity];
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