/**
 * Constants for Damage Calculator module
 */

// =============================================================================
// STAT CATEGORIES
// =============================================================================

/**
 * Stat categories for organized display
 * Keys match Attribute data file keys (mixed case)
 */
export const STAT_CATEGORIES = {
  core: ['Atk', 'CritRate', 'CritPower'],
  offense: ['HitRate', 'StrikeRate', 'RuptureRate'],
  elemental: ['WEE', 'FEE', 'SEE', 'AEE', 'LEE', 'DEE'],
  penetration: ['WEP', 'FEP', 'SEP', 'AEP', 'LEP', 'DEP'],
  resistIgnore: ['WEI', 'FEI', 'SEI', 'AEI', 'LEI', 'DEI'],
  damage: [
    'NORMALDMG', 'SKILLDMG', 'ULTRADMG', 'OTHERDMG',
    'MARKDMG', 'SUMMONDMG', 'PROJECTILEDMG',
    'NORMALCRITPOWER', 'SKILLCRITPOWER', 'ULTRACRITPOWER',
    'OTHERCRITPOWER', 'MARKCRITPOWER', 'SUMMONCRITPOWER', 'PROJECTILECRITPOWER'
  ],
  special: [
    'EnergyEfficiency', 'AbnormalMastery', 'Intensity',
    'GENDMG', 'DMGPLUS', 'FINALDMG', 'FINALDMGPLUS'
  ]
} as const;

// =============================================================================
// LEVEL PHASE MAPPING
// =============================================================================

/**
 * Maps level phase (0-8) to actual character level
 */
export const PHASE_TO_LEVEL = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90] as const;

// =============================================================================
// DAMAGE TYPE MAPPINGS (from decompiled formula analysis)
// =============================================================================

/**
 * Maps damageType enum to damage bonus stat keys
 * Based on GameEnums.damageType → effectAttributeType mapping
 */
export const DAMAGE_TYPE_TO_BONUS_STAT: Record<number, string> = {
  1: 'NORMALDMG',      // NORMAL → ID 56
  2: 'SKILLDMG',       // SKILL → ID 57
  3: 'ULTRADMG',       // ULTIMATE → ID 58
  4: 'OTHERDMG',       // OTHER → ID 59
  5: 'MARKDMG',        // MARK → ID 64
  6: 'PROJECTILEDMG',  // PROJECTILE → ID 68
  7: 'SUMMONDMG'       // SUMMON → ID 66
};

/**
 * Maps damageType enum to crit power stat keys
 * Based on GameEnums.damageType → effectAttributeType mapping
 */
export const DAMAGE_TYPE_TO_CRIT_STAT: Record<number, string> = {
  1: 'NORMALCRITPOWER',      // NORMAL → ID 77
  2: 'SKILLCRITPOWER',       // SKILL → ID 78
  3: 'ULTRACRITPOWER',       // ULTIMATE → ID 79
  4: 'OTHERCRITPOWER',       // OTHER → ID 83
  5: 'MARKCRITPOWER',        // MARK → ID 80
  6: 'PROJECTILECRITPOWER',  // PROJECTILE → ID 82
  7: 'SUMMONCRITPOWER'       // SUMMON → ID 81
};

/**
 * Maps damageType enum to damage taken stat keys (for enemy system)
 * Based on GameEnums.damageType → effectAttributeType mapping
 */
export const DAMAGE_TYPE_TO_TAKEN_STAT: Record<number, string> = {
  1: 'RCDNORMALDMG',      // NORMAL → ID 60
  2: 'RCDSKILLDMG',       // SKILL → ID 61
  3: 'RCDULTRADMG',       // ULTIMATE → ID 62
  4: 'RCDOTHERDMG',       // OTHER → ID 63
  5: 'RCDMARKDMG',        // MARK → ID 65
  6: 'RCDPROJECTILEDMG',  // PROJECTILE → ID 69
  7: 'RCDSUMMONDMG'       // SUMMON → ID 67
};

// =============================================================================
// ELEMENT TYPE MAPPINGS
// =============================================================================

/**
 * Maps elementType enum to element efficiency stat keys
 */
export const ELEMENT_TYPE_TO_STAT: Record<number, string> = {
  1: 'WEE',  // Physical (물리)
  2: 'FEE',  // Fire (불)
  3: 'SEE',  // Ice (얼음)
  4: 'AEE',  // Lightning (번개)
  5: 'LEE',  // Wind (바람)
  6: 'DEE'   // Dark (어둠)
};

/** Maps element type to penetration stat key */
export const ELEMENT_TYPE_TO_PEN: Record<number, string> = {
  1: 'WEP', 2: 'FEP', 3: 'SEP', 4: 'AEP', 5: 'LEP', 6: 'DEP'
};

/** Maps element type to resistance ignore stat key */
export const ELEMENT_TYPE_TO_IGNORE: Record<number, string> = {
  1: 'WEI', 2: 'FEI', 3: 'SEI', 4: 'AEI', 5: 'LEI', 6: 'DEI'
};

/**
 * Maps EffectTypeFirstSubtype enum to stat keys
 * Used by skill effects to determine which stat is modified
 * TODO: Complete this mapping based on actual game data
 */
export const EFFECT_TYPE_TO_STAT: Record<number, string> = {
  // Core stats
  1: 'Atk',
  2: 'Def',
  3: 'HP',
  4: 'CritRate',
  5: 'CritPower',

  // Offense stats
  6: 'HitRate',
  7: 'StrikeRate',
  8: 'RuptureRate',

  // Element efficiency (matches ELEMENT_TYPE_TO_STAT indices)
  10: 'WEE',   // Physical
  11: 'FEE',   // Fire
  12: 'SEE',   // Ice
  13: 'AEE',   // Lightning
  14: 'LEE',   // Wind
  15: 'DEE',   // Dark

  // Damage bonuses (matches DAMAGE_TYPE_TO_BONUS_STAT indices offset)
  56: 'NORMALDMG',
  57: 'SKILLDMG',
  58: 'ULTRADMG',
  59: 'OTHERDMG',
  64: 'MARKDMG',
  68: 'PROJECTILEDMG',
  66: 'SUMMONDMG',

  // Crit power bonuses (matches DAMAGE_TYPE_TO_CRIT_STAT indices offset)
  77: 'NORMALCRITPOWER',
  78: 'SKILLCRITPOWER',
  79: 'ULTRACRITPOWER',
  83: 'OTHERCRITPOWER',
  80: 'MARKCRITPOWER',
  82: 'PROJECTILECRITPOWER',
  81: 'SUMMONCRITPOWER',

  // Special stats
  100: 'EnergyEfficiency',
  101: 'AbnormalMastery',
  102: 'Intensity',
  103: 'GENDMG',
  104: 'DMGPLUS',
  105: 'FINALDMG',
  106: 'FINALDMGPLUS'
};

// =============================================================================
// SKILL TYPE MAPPINGS
// =============================================================================

/**
 * Skill type display colors
 */
export const SKILL_COLORS = {
  normalAtk: '#3b82f6',   // Blue
  skill: '#8b5cf6',       // Purple
  ultimate: '#ec4899'     // Pink
} as const;

/**
 * Skill type to damageType enum mapping
 */
export const SKILL_TYPE_TO_DAMAGE_TYPE: Record<string, number> = {
  normalAtk: 1,  // NORMAL
  skill: 2,      // SKILL
  ultimate: 3    // ULTIMATE
};

// =============================================================================
// DEFAULT VALUES
// =============================================================================

/**
 * Default enemy configuration
 */
export const DEFAULT_ENEMY_CONFIG = {
  level: 80,
  defense: 500,
  resistance: 0,
  toughness: 100
} as const;

/**
 * Default manual mode state
 */
export const DEFAULT_MANUAL_STATE = {
  mode: 'auto' as const,
  customBuffs: [],
  statOverrides: {}
};

// =============================================================================
// FORMULA CONSTANTS (from decompiled analysis)
// =============================================================================

/**
 * Resilience break damage multiplier (150%)
 */
export const RESILIENCE_BREAK_MULTIPLIER = 1.5;

/**
 * Minimum damage value (game enforces minimum of 1)
 */
export const MIN_DAMAGE = 1;

/**
 * Maximum crit rate (100%)
 */
export const MAX_CRIT_RATE = 10000; // per-10000 format

/**
 * Default skill damage percentage if not found (100%)
 */
export const DEFAULT_SKILL_PERCENT = 100;

// =============================================================================
// FORMAT CONVERSION CONSTANTS
// =============================================================================

/**
 * Stat formatting divisors for different stat types
 */
export const STAT_FORMAT = {
  PER_10000: 10000,  // Most stats (damage bonuses, crit rate, etc.)
  PER_100: 100,      // Crit power
  PER_1: 1           // Flat stats (ATK, DEF, HP)
} as const;

// =============================================================================
// UI CONSTANTS
// =============================================================================

/**
 * Maximum number of build snapshots for comparison
 */
export const MAX_SNAPSHOTS = 3;

/**
 * Tab IDs as object for easy access
 */
export const TAB_IDS = {
  CURRENT: 'current',
  LIMITBREAK: 'limitbreak',
  COMPARISON: 'comparison',
  MANUAL: 'manual'
} as const;

/**
 * Tab IDs array for iteration
 */
export const TAB_IDS_ARRAY = ['current', 'limitbreak', 'comparison', 'manual'] as const;

/**
 * Tab configuration
 */
export const TAB_CONFIG = [
  { id: 'current', label: 'Current Build', icon: 'chart-line' },
  { id: 'limitbreak', label: 'Limit Break', icon: 'arrow-trend-up' },
  { id: 'comparison', label: 'Comparison', icon: 'code-compare' },
  { id: 'manual', label: 'Manual Override', icon: 'sliders' }
] as const;

/**
 * Stat category labels (i18n keys)
 */
export const STAT_CATEGORY_LABELS: Record<string, string> = {
  core: 'dmgcalc.statCategories.core',
  offense: 'dmgcalc.statCategories.offense',
  elemental: 'dmgcalc.statCategories.elemental',
  damage: 'dmgcalc.statCategories.damage',
  special: 'dmgcalc.statCategories.special'
};
