/**
 * Centralized Game Data Store
 *
 * Single source of truth for all game data loaded from JSON files. This singleton
 * eliminates duplicate data loading across modules and provides type-safe access
 * to character stats, skills, potentials, discs, and localized content.
 *
 * Key Features:
 * - Singleton pattern prevents duplicate memory usage
 * - Language-specific data with *KR suffix (supports KR, JP, EN, CN)
 * - Type-safe helpers for common data access patterns
 * - Organized data categories (characters, discs, upgrades, etc.)
 * - Global accessibility via window.GameData for debugging
 *
 * Data Organization:
 * - Base data: Character, Item, Skill, Potential (IDs and stats)
 * - Localized data: *KR properties contain translated names/descriptions
 * - Calculation data: EffectValue, BuffValue, HitDamage for skill formulas
 * - Upgrade data: CharacterUpgrade, DiscPromote, etc.
 * - Meta data: GameEnums, UIText for enums and UI strings
 *
 * @module shared/game-data
 * @see {@link shared/data-loader} For loading data into this store
 * @see {@link types/index} For TypeScript interfaces
 */

import type { CharacterData, Item, PotentialData, SkillData, Disc } from '../types';

// =============================================================================
// GAME DATA INTERFACE
// =============================================================================

/**
 * GameDataStore interface defining all game data properties
 *
 * Properties with *KR suffix contain localized data for the selected language.
 * The "KR" naming is historical - these properties hold data for whichever
 * language is currently active (KR, JP, EN, or CN).
 *
 * @interface GameDataStore
 */
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
  
  /** Allows dynamic property access for unknown data fields */
  [key: string]: any;
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Global game data singleton
 *
 * Populated by data-loader module. Access in console: window.GameData
 *
 * @example
 * ```typescript
 * import { GameData } from '@/shared/game-data';
 *
 * // Access character data
 * const char = GameData.characters['1001'];
 * const name = GameData.charactersKR['Character.1001.1'];
 * ```
 */
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

// =============================================================================
// DATA ACCESS HELPERS
// =============================================================================

/**
 * Gets localized character name with fallback chain
 *
 * Lookup order:
 * 1. Localized name from charactersKR (current language)
 * 2. English name from base characters data
 * 3. Fallback string with ID
 *
 * @param id - Character ID (e.g., '1001')
 * @returns Localized character name or fallback
 *
 * @example
 * ```typescript
 * const name = getCharacterName('1001');
 * // Returns: "아야" (KR) or "Aya" (EN) or "Character 1001"
 * ```
 */
export function getCharacterName(id: string): string {
  const key = `Character.${id}.1`;
  return GameData.charactersKR[key] || GameData.characters[id]?.Name || `Character ${id}`;
}

/**
 * Gets localized item name with fallback chain
 *
 * Supports both direct ID lookup and Item.{ID}.1 format.
 * Commonly used for potentials, materials, and equipment.
 *
 * @param id - Item ID or key (e.g., '20001' or 'Item.20001.1')
 * @returns Localized item name or fallback
 *
 * @example
 * ```typescript
 * const name = getItemName('20001');
 * // Returns localized potential name
 * ```
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

/**
 * Element color mappings for visual styling
 *
 * Maps element IDs to color schemes with background, border, and text colors.
 * Used throughout the UI for element-based theming.
 *
 * Element IDs:
 * - 1: Water (물) - Sky Blue
 * - 2: Fire (불) - Pastel Pink
 * - 3: Earth (땅) - Peach
 * - 4: Wind (바람) - Mint Green
 * - 5: Light (빛) - Soft Yellow
 * - 6: Dark (어둠) - Lavender
 *
 * @constant
 */
export const ELEMENT_COLORS = {
    1: { bg: 'rgba(107, 155, 209, 0.15)', border: '#6B9BD1', color: '#6B9BD1', name: '물' },   // Water - Sky Blue
    2: { bg: 'rgba(232, 138, 173, 0.15)', border: '#E88AAD', color: '#E88AAD', name: '불' },     // Fire - Pastel Pink
    3: { bg: 'rgba(244, 198, 160, 0.15)', border: '#F4C6A0', color: '#F4C6A0', name: '땅' },    // Earth - Peach
    4: { bg: 'rgba(126, 215, 193, 0.15)', border: '#7ED7C1', color: '#7ED7C1', name: '바람' },  // Wind - Mint Green
    5: { bg: 'rgba(245, 230, 184, 0.15)', border: '#F5E6B8', color: '#F5E6B8', name: '빛' },    // Light - Soft Yellow
    6: { bg: 'rgba(197, 184, 224, 0.15)', border: '#C5B8E0', color: '#C5B8E0', name: '어둠' }  // Dark - Lavender
};

/**
 * Stat icon mappings for UI display
 *
 * Maps stat names to icon identifiers used by getIcon() function.
 * Icons are rendered using Font Awesome classes.
 *
 * @constant
 */
export const STAT_ICONS = {
    'Atk': 'attack',
    'Hp': 'hp',
    'Def': 'defense',
    'HitRate': 'accuracy',
    'CritRate': 'critRate',
    'CritPower': 'critPower'
};

/**
 * Main character stats to display (in preferred order)
 *
 * Used for rendering stat cards and summaries. Order determines display priority.
 *
 * @constant
 */
export const MAIN_STATS = ['Atk', 'Hp', 'Def', 'HitRate', 'CritRate', 'CritPower'];

/**
 * Stat name to effect attribute type ID mapping
 *
 * Bridges the gap between Attribute data keys (Hp, HitRate) and
 * effectAttributeType enum IDs (3, 4) used in effect calculations.
 *
 * Required because attribute keys don't directly match effectAttributeType enum keys.
 *
 * @constant
 */
export const STAT_TO_EFFECT_ID: Record<string, string> = {
    'Atk': '1',          // ATK
    'Hp': '3',           // MAXHP
    'Def': '2',          // DEF
    'HitRate': '4',      // HITRATE
    'CritRate': '6',     // CRITRATE
    'CritPower': '8'     // CRITPOWER_P
};

// =============================================================================
// RARITY UTILITIES
// =============================================================================

/**
 * Disc rarity information
 *
 * @interface RarityInfo
 */
export interface RarityInfo {
  /** Rarity key (SSR, SR, R, M, N) */
  key: string;
  /** Number of stars (1-5) */
  stars: number;
  /** CSS class for rarity border styling */
  borderClass: string;
}

/**
 * Extracts rarity information from disc data
 *
 * Looks up disc item data, extracts rarity enum, and returns formatted
 * rarity info including CSS class for styling.
 *
 * @param disc - Disc data object or null
 * @returns Rarity info with key, stars, and CSS class
 *
 * @example
 * ```typescript
 * const disc = GameData.discs['101'];
 * const rarity = getDiscRarityInfo(disc);
 * // { key: 'SSR', stars: 5, borderClass: 'rarity-ssr' }
 * ```
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