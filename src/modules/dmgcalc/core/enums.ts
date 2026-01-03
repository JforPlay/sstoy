/**
 * Damage Calculator - Enum-Based Stat System
 * Dynamic stat system using GameEnums for proper i18n and accuracy
 *
 * @module dmgcalc/core/enums
 */

import { GameData } from '@/shared/game-data';

// =============================================================================
// STAT KEY MAPPING
// =============================================================================

/**
 * Maps attribute keys (from Attribute.json) to GameEnum effectAttributeType IDs
 * This allows us to get proper display names and metadata for stats
 *
 * Keys from Attribute.json: "Atk", "Hp", "CritPower", "WEE", "NORMALDMG", etc.
 * GameEnum IDs: 1 = ATK, 3 = MAXHP, 8 = CRITPOWER_P, 17 = WEE, 56 = NORMALDMG, etc.
 */
const ATTRIBUTE_KEY_TO_ENUM_ID: Record<string, number> = {
  // Basic stats
  'Atk': 1,           // ATK
  'Def': 2,           // DEF
  'Hp': 3,            // MAXHP (생명력)
  'HitRate': 4,       // HITRATE (명중률)
  'Evd': 5,           // EVD (회피율)
  'CritRate': 6,      // CRITRATE (치명타율)
  'CritResist': 7,    // CRITRESIST (치명타 저항)
  'CritPower': 8,     // CRITPOWER_P (치명타 피해)
  'Penetrate': 9,     // PENETRATE (관통)
  'DefIgnore': 10,    // DEF_IGNORE (방어력 무시)

  // Elemental resistance (R = Resistance)
  'WER': 11,          // Water resistance
  'FER': 12,          // Fire resistance
  'SER': 13,          // Stone/Earth resistance
  'AER': 14,          // Air/Wind resistance
  'LER': 15,          // Light resistance
  'DER': 16,          // Dark resistance

  // Elemental efficiency (EE = Elemental Efficiency / 속성 피해)
  'WEE': 17,          // Water element efficiency
  'FEE': 18,          // Fire element efficiency
  'SEE': 19,          // Stone/Earth element efficiency
  'AEE': 20,          // Air/Wind element efficiency
  'LEE': 21,          // Light element efficiency
  'DEE': 22,          // Dark element efficiency

  // Elemental penetration (EP)
  'WEP': 23,
  'FEP': 24,
  'SEP': 25,
  'AEP': 26,
  'LEP': 27,
  'DEP': 28,

  // Elemental resistance ignore (EI)
  'WEI': 29,
  'FEI': 30,
  'SEI': 31,
  'AEI': 32,
  'LEI': 33,
  'DEI': 34,

  // Received elemental damage (EERCD)
  'WEERCD': 35,
  'FEERCD': 36,
  'SEERCD': 37,
  'AEERCD': 38,
  'LEERCD': 39,
  'DEERCD': 40,

  // Special stats
  'Weight': 41,
  'ToughnessMax': 42,
  'ToughnessDamageAdjust': 43,
  'ShieldMax': 44,
  'MoveSpeed': 46,
  'AtkSpd': 47,
  'Intensity': 48,

  // Damage modifiers
  'GENDMG': 49,       // 가하는 피해 (damage dealt)
  'DMGPLUS': 50,      // 피해 + (flat damage bonus)
  'FINALDMG': 51,     // 최종 피해 (final damage multiplier)
  'FINALDMGPLUS': 52, // 최종 피해 + (final flat damage)
  'GENDMGRCD': 53,    // 받는 피해 감소 (damage taken reduction)
  'DMGPLUSRCD': 54,   // 받는 피해 증감 (damage taken modifier)
  'Suppress': 55,     // 약점 제압 (weakness suppress)

  // Skill type damage (dealt)
  'NORMALDMG': 56,    // 일반 공격 피해
  'SKILLDMG': 57,     // 스킬 피해
  'ULTRADMG': 58,     // 필살기 피해
  'OTHERDMG': 59,     // 기타 피해

  // Skill type damage (received)
  'RCDNORMALDMG': 60,
  'RCDSKILLDMG': 61,
  'RCDULTRADMG': 62,
  'RCDOTHERDMG': 63,

  // Mark/Summon/Projectile damage (dealt)
  'MARKDMG': 64,
  'RCDMARKDMG': 65,
  'SUMMONDMG': 66,
  'RCDSUMMONDMG': 67,
  'PROJECTILEDMG': 68,
  'RCDPROJECTILEDMG': 69,

  // Skill-specific crit rate
  'NORMALCRITRATE': 70,
  'SKILLCRITRATE': 71,
  'ULTRACRITRATE': 72,
  'MARKCRITRATE': 73,
  'SUMMONCRITRATE': 74,
  'PROJECTILECRITRATE': 75,
  'OTHERCRITRATE': 76,

  // Skill-specific crit power
  'NORMALCRITPOWER': 77,
  'SKILLCRITPOWER': 78,
  'ULTRACRITPOWER': 79,
  'MARKCRITPOWER': 80,
  'SUMMONCRITPOWER': 81,
  'PROJECTILECRITPOWER': 82,
  'OTHERCRITPOWER': 83,

  // Advanced modifiers
  'SKILL_INTENSITY': 85,      // 스킬 위력
  'TOUGHNESS_BROKEN_DMG': 86  // 강인도 파괴 피해
};

/**
 * Reverse mapping: GameEnum ID to attribute key
 * Generated automatically from ATTRIBUTE_KEY_TO_ENUM_ID
 */
const ENUM_ID_TO_ATTRIBUTE_KEY: Record<number, string> = Object.fromEntries(
  Object.entries(ATTRIBUTE_KEY_TO_ENUM_ID).map(([key, id]) => [id, key])
);

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Get GameEnum ID from attribute key
 * @param attrKey - Key from Attribute.json (e.g., "Atk", "CritRate", "WEE")
 * @returns GameEnum effectAttributeType ID, or null if not found
 */
export function getEnumIdFromAttrKey(attrKey: string): number | null {
  return ATTRIBUTE_KEY_TO_ENUM_ID[attrKey] ?? null;
}

/**
 * Get attribute key from GameEnum ID
 * @param enumId - GameEnum effectAttributeType ID
 * @returns Attribute key, or null if not found
 */
export function getAttrKeyFromEnumId(enumId: number): string | null {
  return ENUM_ID_TO_ATTRIBUTE_KEY[enumId] ?? null;
}

/**
 * Get localized display name for a stat
 * Uses GameEnums.effectAttributeType for proper i18n support
 *
 * @param attrKey - Attribute key (e.g., "Atk", "CritRate")
 * @returns Localized display name in current language
 */
export function getStatDisplayName(attrKey: string): string {
  // Try to get enum ID for this attribute key
  const enumId = getEnumIdFromAttrKey(attrKey);

  if (enumId !== null && GameData.gameEnums?.effectAttributeType) {
    const enumEntry = GameData.gameEnums.effectAttributeType[enumId];

    if (enumEntry) {
      // Return the localized name from GameEnums
      // This automatically uses the correct language (KR/JP/EN/CN) based on loaded data
      return enumEntry.name || enumEntry.key || attrKey;
    }
  }

  // Fallback: Try to find by matching key (case-insensitive)
  if (GameData.gameEnums?.effectAttributeType) {
    const enumEntries = Object.entries(GameData.gameEnums.effectAttributeType);
    const matchingEntry = enumEntries.find(([id, entry]: [string, any]) =>
      entry.key && entry.key.toLowerCase() === attrKey.toLowerCase()
    );

    if (matchingEntry) {
      const [, entry] = matchingEntry as [string, any];
      return entry.name || entry.key || attrKey;
    }
  }

  // Final fallback: return the key as-is
  return attrKey;
}

/**
 * Get GameEnum entry for a stat
 * @param attrKey - Attribute key
 * @returns GameEnum entry object, or null if not found
 */
export function getStatEnumEntry(attrKey: string): any | null {
  const enumId = getEnumIdFromAttrKey(attrKey);

  if (enumId !== null && GameData.gameEnums?.effectAttributeType) {
    return GameData.gameEnums.effectAttributeType[enumId] ?? null;
  }

  return null;
}

// =============================================================================
// STAT CATEGORIZATION
// =============================================================================

/**
 * Categorize stats dynamically based on stat key patterns
 * Returns: 'core', 'offense', 'elemental', 'special', 'defense', or 'other'
 */
export function getStatCategory(attrKey: string): string {
  // Core combat stats
  if (['Atk', 'CritRate', 'CritPower'].includes(attrKey)) {
    return 'core';
  }

  // Offensive stats
  if (['HitRate', 'StrikeRate', 'RuptureRate', 'CritLevelBonus', 'Penetrate', 'DefIgnore'].includes(attrKey)) {
    return 'offense';
  }

  // Elemental efficiency stats (ends with EE or EEP)
  if (attrKey.endsWith('EE') && !attrKey.endsWith('RCD')) {
    return 'elemental';
  }

  // Special damage modifiers
  if ([
    'EnergyEfficiency', 'AbnormalMastery', 'ElementalMastery',
    'GENDMG', 'FINALDMG', 'Intensity',
    'NORMALDMG', 'SKILLDMG', 'ULTRADMG',
    'NORMALCRITRATE', 'SKILLCRITRATE', 'ULTRACRITRATE',
    'NORMALCRITPOWER', 'SKILLCRITPOWER', 'ULTRACRITPOWER'
  ].includes(attrKey)) {
    return 'special';
  }

  // Defense stats (not directly used in damage calc, but important for survivability)
  if (['Hp', 'Def', 'DefRate', 'ShieldMax', 'ToughnessMax'].includes(attrKey)) {
    return 'defense';
  }

  // Resistance stats
  if (attrKey.endsWith('ER') || attrKey.endsWith('EERCD') || attrKey.endsWith('DMGRCD')) {
    return 'resistance';
  }

  return 'other';
}

/**
 * Check if a stat is damage-related (relevant for damage calculator)
 */
export function isDamageRelatedStat(attrKey: string): boolean {
  const category = getStatCategory(attrKey);
  return ['core', 'offense', 'elemental', 'special'].includes(category);
}

/**
 * Get all damage-related stat keys from current stats map
 */
export function getDamageRelatedStatKeys(statsMap: Map<string, any>): string[] {
  const keys: string[] = [];

  statsMap.forEach((stat, key) => {
    if (isDamageRelatedStat(key)) {
      keys.push(key);
    }
  });

  return keys.sort((a, b) => {
    // Sort by category first, then alphabetically
    const catA = getStatCategory(a);
    const catB = getStatCategory(b);

    if (catA !== catB) {
      const order = ['core', 'offense', 'elemental', 'special'];
      return order.indexOf(catA) - order.indexOf(catB);
    }

    return a.localeCompare(b);
  });
}

// =============================================================================
// STAT FORMATTING
// =============================================================================

/**
 * Get appropriate formatter function for a stat
 * Returns a function that formats the stat value for display
 */
export function getStatFormatter(attrKey: string): (value: number) => string {
  // Per-10000 stats (stored as 5000 = 50%)
  // CritRate, HitRate, StrikeRate, RuptureRate, and elemental stats
  if (
    attrKey === 'CritRate' ||
    attrKey === 'HitRate' ||
    attrKey === 'StrikeRate' ||
    attrKey === 'RuptureRate' ||
    attrKey === 'Evd' ||
    attrKey === 'CritResist' ||
    attrKey.endsWith('CRITRATE')  // NORMALCRITRATE, SKILLCRITRATE, etc.
  ) {
    return (val: number) => (val / 100).toFixed(1) + '%';
  }

  // CritPower is stored as per-100 (15000 = 150%)
  if (attrKey === 'CritPower' || attrKey.endsWith('CRITPOWER')) {
    return (val: number) => (val / 100).toFixed(0) + '%';
  }

  // Elemental efficiency stats (EE) - per-10000 format
  if (attrKey.endsWith('EE')) {
    return (val: number) => (val / 100).toFixed(1) + '%';
  }

  // Damage multiplier stats (per-10000 format, display as %)
  if (
    attrKey === 'GENDMG' ||
    attrKey === 'FINALDMG' ||
    attrKey === 'GENDMGRCD' ||
    attrKey === 'NORMALDMG' ||
    attrKey === 'SKILLDMG' ||
    attrKey === 'ULTRADMG' ||
    attrKey === 'OTHERDMG' ||
    attrKey.startsWith('RCD') ||
    attrKey.endsWith('DMG') ||
    attrKey.endsWith('DMGRCD')
  ) {
    return (val: number) => {
      // These are typically stored as 10000 = 100%
      // Show deviation from 100% (e.g., 11000 = +10%)
      const percent = (val / 10000) * 100;
      const deviation = percent - 100;
      if (deviation > 0) {
        return `+${deviation.toFixed(1)}%`;
      } else if (deviation < 0) {
        return `${deviation.toFixed(1)}%`;
      } else {
        return '0%';
      }
    };
  }

  // Flat stats: ATK, DEF, HP
  if (attrKey === 'Atk' || attrKey === 'Def' || attrKey === 'Hp') {
    return (val: number) => Math.round(val).toLocaleString();
  }

  // Default formatter: 2 decimal places
  return (val: number) => val.toFixed(2);
}

/**
 * Format stat value for display using the appropriate formatter
 */
export function formatStatValue(attrKey: string, value: number): string {
  const formatter = getStatFormatter(attrKey);
  return formatter(value);
}

// =============================================================================
// STAT DISCOVERY
// =============================================================================

/**
 * Get all available stat keys from GameEnums
 * Useful for debugging and validation
 */
export function getAllAvailableStatKeys(): string[] {
  const keys: string[] = [];

  if (GameData.gameEnums?.effectAttributeType) {
    Object.entries(GameData.gameEnums.effectAttributeType).forEach(([id, entry]: [string, any]) => {
      if (entry && entry.key) {
        // Try to find the corresponding attribute key
        const attrKey = getAttrKeyFromEnumId(parseInt(id, 10));
        if (attrKey) {
          keys.push(attrKey);
        } else {
          // If no mapping exists, use the enum key (might need manual mapping)
          keys.push(entry.key);
        }
      }
    });
  }

  return keys;
}

/**
 * Validate that all attribute keys have enum mappings
 * Returns array of unmapped keys (for debugging)
 */
export function getUnmappedStatKeys(attributeKeys: string[]): string[] {
  return attributeKeys.filter(key => getEnumIdFromAttrKey(key) === null);
}

// =============================================================================
// CATEGORY LABELS (i18n-ready)
// =============================================================================

/**
 * Get localized category label
 * TODO: Move to language files for proper i18n
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    core: '핵심 스탯',
    offense: '공격 스탯',
    elemental: '원소 효율',
    special: '특수 보너스',
    defense: '방어 스탯',
    resistance: '저항',
    other: '기타'
  };

  return labels[category] || category;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  ATTRIBUTE_KEY_TO_ENUM_ID,
  ENUM_ID_TO_ATTRIBUTE_KEY
};
