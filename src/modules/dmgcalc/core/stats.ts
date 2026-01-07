/**
 * Stat Aggregation for Damage Calculator
 * Handles aggregation from characters, potentials, and discs
 */

import type { AggregatedStat, StatSource, StatCategory, Position } from '../types';
import { STAT_CATEGORIES, PHASE_TO_LEVEL } from '../constants';
import { getState, updateState } from './state';
import { GameData } from '../../../shared/game-data';
import { formatStatValue as formatStatValueFromEnums } from './enums';
import { parseAllPartyPotentialEffects, convertPotentialEffectsToStatSources } from './potentials';
import { initializeBuffs, applyActiveBuffsToStats } from './buffs';

// Re-export formatStatValue for convenience
export { formatStatValueFromEnums as formatStatValue };

// =============================================================================
// MAIN AGGREGATION FUNCTION
// =============================================================================

/**
 * Aggregate all stats from build (character, potentials, discs)
 */
export function aggregateStatsFromBuild(): void {
  console.log(`[DmgCalc] ========== Starting stat aggregation ==========`);

  if (!window.state) {
    console.error(`[DmgCalc] ❌ window.state is undefined!`);
    return;
  }

  // Check if Attribute data is loaded
  if (!GameData.attributes) {
    console.error(`[DmgCalc] ❌ GameData.attributes is not loaded!`);
    console.log(`[DmgCalc] Available GameData keys:`, Object.keys(GameData));
  } else {
    console.log(`[DmgCalc] ✅ GameData.attributes loaded, ${Object.keys(GameData.attributes).length} entries`);
  }

  initializeStats();

  const masterChar = window.state.party?.master;
  if (!masterChar || typeof masterChar === 'string') {
    console.error(`[DmgCalc] ❌ No master character selected`);
    return;
  }

  console.log(`[DmgCalc] Master character:`, { id: masterChar.id, name: masterChar.name });

  // 1. Base character stats
  aggregateBaseStats(masterChar);

  // 2. Stats from talent bonuses (limit break analysis)
  aggregateTalentBonuses();

  // 3. Stats from potentials
  aggregatePotentialStats();

  // 4. Stats from discs
  aggregateDiscStats();

  // 5. Initialize and apply buff system
  initializeBuffs();
  applyActiveBuffsToStats(getState().stats);

  // 6. Calculate totals
  calculateStatTotals();

  console.log(`[DmgCalc] ========== Stat aggregation complete ==========`);
}

// =============================================================================
// STAT INITIALIZATION
// =============================================================================

/**
 * Initialize stat map with all stat categories
 */
function initializeStats(): void {
  const state = getState();
  state.stats.clear();

  // Initialize all stat categories (including missing stats!)
  Object.values(STAT_CATEGORIES).flat().forEach(statKey => {
    state.stats.set(statKey, {
      name: getStatDisplayName(statKey),
      baseValue: 0,
      sources: [],
      manualAdjustment: 0,
      total: 0
    });
  });

  console.log(`[DmgCalc] Initialized ${state.stats.size} stat categories, including missing stats:`, {
    hasGENDMG: state.stats.has('GENDMG'),
    hasDMGPLUS: state.stats.has('DMGPLUS'),
    hasFINALDMG: state.stats.has('FINALDMG'),
    hasFINALDMGPLUS: state.stats.has('FINALDMGPLUS'),
    hasNORMALCRITPOWER: state.stats.has('NORMALCRITPOWER'),
    hasSKILLCRITPOWER: state.stats.has('SKILLCRITPOWER'),
    hasULTRACRITPOWER: state.stats.has('ULTRACRITPOWER')
  });
}

/**
 * Get localized display name for a stat
 */
export function getStatDisplayName(statKey: string): string {
  if (GameData.gameEnums?.effectAttributeType) {
    const enumEntries = Object.entries(GameData.gameEnums.effectAttributeType);
    const matchingEntry = enumEntries.find(([id, entry]: [string, any]) =>
      entry.key && entry.key.toLowerCase() === statKey.toLowerCase()
    );

    if (matchingEntry) {
      const [statId, entry] = matchingEntry as [string, any];
      const uiTextKey = `UIText.Enums_Effect_${statId}.1`;
      return GameData.uiText?.[uiTextKey] || entry.name || statKey;
    }
  }
  return statKey;
}

// =============================================================================
// CHARACTER BASE STATS
// =============================================================================

/**
 * Aggregate base stats from character
 */
function aggregateBaseStats(character: any): void {
  // Get character base stats from Attribute data
  const charId = character.id;
  const levelPhase = window.state?.characterLevelPhase?.master || 0;
  const actualLevel = PHASE_TO_LEVEL[levelPhase] || 1;

  // Find GroupId from attributes (same logic as characterdb.ts)
  let groupId = null;
  const attributes = GameData.attributes;

  if (attributes) {
    for (const attrId in attributes) {
      const attr = attributes[attrId];
      if (attr && attr.GroupId) {
        if (attr.GroupId.toString().length >= 3) {
          const charIdFromGroup = parseInt(attr.GroupId.toString().slice(-3));
          const numCharId = typeof charId === 'string' ? parseInt(charId, 10) : charId;
          if (charIdFromGroup === numCharId || attr.GroupId === numCharId) {
            groupId = attr.GroupId;
            break;
          }
        }
      }
    }
  }

  // If GroupId not found, try to use charId directly
  if (!groupId) {
    groupId = charId;
  }

  // Calculate limit break (0-8)
  const limitBreak = levelPhase;

  // Construct attribute ID with limit break and level padding
  // Formula: {groupId}{(limitBreak * 1000 + level) padded to 5 digits}
  let attrLevel = actualLevel;
  // Special case: if levelPhase is 8, use level 90
  if (levelPhase === 8) {
    attrLevel = 90;
  }

  const combinedValue = (limitBreak * 1000) + attrLevel;
  const combinedPadded = combinedValue.toString().padStart(5, '0');
  const attrId = `${groupId}${combinedPadded}`;

  const attrData = attributes?.[attrId];

  console.log(`[DmgCalc] Looking for attribute ID: ${attrId}`, {
    charId,
    groupId,
    levelPhase,
    actualLevel: attrLevel,
    limitBreak,
    found: !!attrData,
    attrData: attrData ? Object.keys(attrData) : 'NOT FOUND'
  });

  if (!attrData) {
    console.error(`[DmgCalc] ❌ Attribute data not found for ID: ${attrId} (char: ${charId}, level: ${attrLevel}, LB: ${limitBreak})`);
    console.log(`[DmgCalc] Available attribute IDs starting with ${groupId}:`,
      Object.keys(attributes || {}).filter(id => id.startsWith(String(groupId))).slice(0, 10)
    );
    // Fallback to placeholder values
    addStatSource('Atk', '캐릭터 기본', 500, true);
    addStatSource('Hp', '캐릭터 기본', 5000, true);
    addStatSource('Def', '캐릭터 기본', 200, true);
    addStatSource('CritRate', '캐릭터 기본', 500, true); // 5% as 500 (per-10000)
    addStatSource('CritPower', '캐릭터 기본', 15000, true); // 150% as 15000 (per-100)
    return;
  }

  console.log(`[DmgCalc] ✅ Found character base stats:`, {
    Atk: attrData.Atk,
    Hp: attrData.Hp,
    Def: attrData.Def,
    CritRate: attrData.CritRate,
    CritPower: attrData.CritPower
  });

  // Add all stats from attribute data (use keys as-is from data file)
  for (const [key, value] of Object.entries(attrData)) {
    if (['Id', 'GroupId', 'Break', 'lvl'].includes(key)) continue;
    if (typeof value === 'number' && value !== 0) {
      addStatSource(key, '캐릭터 기본', value, true);
    }
  }
}

// =============================================================================
// TALENT BONUSES (LIMIT BREAK)
// =============================================================================

/**
 * Aggregate talent bonuses from character's current limit break level
 * This includes talents unlocked at each LB level (0-8)
 */
function aggregateTalentBonuses(): void {
  // First check if there are manual overrides from limitbreak analysis
  const manualBonuses = (window as any).__talentBonuses;
  if (manualBonuses && Object.keys(manualBonuses).length > 0) {
    applyTalentBonusesFromMap(manualBonuses, '한계돌파 재능 (분석)');
    return;
  }

  // Otherwise, calculate from current character's limit break level
  const masterChar = window.state?.party?.master;
  if (!masterChar || typeof masterChar === 'string') return;

  const charId = String(masterChar.id);
  const limitBreak = window.state?.characterLevelPhase?.master || 0;

  // Get talent groups for this character
  const talentGroups = GameData.talentGroups
    ? Object.values(GameData.talentGroups)
        .filter((group: any) => String(group.CharId) === charId)
        .sort((a: any, b: any) => a.Background - b.Background)
    : [];

  if (talentGroups.length === 0) {
    console.log(`[DmgCalc] No talent groups found for character ${charId}`);
    return;
  }

  // Get talents unlocked up to current LB level (accumulative)
  const unlockedGroups = talentGroups.filter((group: any) => group.Background <= limitBreak);
  const unlockedTalents: any[] = [];

  unlockedGroups.forEach((group: any) => {
    const groupTalents = GameData.talents
      ? Object.values(GameData.talents).filter((talent: any) => talent.GroupId === group.Id)
      : [];
    unlockedTalents.push(...groupTalents);
  });

  if (unlockedTalents.length === 0) {
    console.log(`[DmgCalc] No talents unlocked at LB ${limitBreak}`);
    return;
  }

  console.log(`[DmgCalc] Processing ${unlockedTalents.length} unlocked talents at LB ${limitBreak}`);

  // Calculate bonuses from talents
  const bonuses: Record<number, number> = {};

  unlockedTalents.forEach((talent: any) => {
    // Only process Type 2 talents (sub nodes that give stat bonuses)
    if (talent.Type !== 2) return;
    if (!talent.Param1) return;

    // Parse the param to get the effect
    const paramParts = talent.Param1.split(',');
    if (paramParts.length < 3) return;

    const effectId = parseInt(paramParts[2]);
    const effectData = GameData.effectValue?.[effectId];

    if (!effectData) return;

    // Get the stat type ID from EffectTypeFirstSubtype
    const statTypeId = effectData.EffectTypeFirstSubtype;
    const rawValue = parseFloat(effectData.EffectTypeParam1 || '0');

    if (statTypeId !== undefined && !isNaN(rawValue) && rawValue !== 0) {
      bonuses[statTypeId] = (bonuses[statTypeId] || 0) + rawValue;
    }
  });

  // Apply calculated bonuses
  if (Object.keys(bonuses).length > 0) {
    applyTalentBonusesFromMap(bonuses, '한계돌파 재능');
  }
}

/**
 * Apply talent bonuses from a map to stats
 */
function applyTalentBonusesFromMap(bonuses: Record<number, number>, sourceName: string): void {
  console.log(`[DmgCalc] Applying talent bonuses from ${sourceName}:`, bonuses);

  Object.entries(bonuses).forEach(([statTypeIdStr, rawValue]) => {
    const statTypeId = parseInt(statTypeIdStr);
    if (isNaN(statTypeId) || typeof rawValue !== 'number') return;

    // Find the stat key for this effect type ID
    const statKey = getStatKeyFromEffectTypeId(statTypeId);
    if (!statKey) {
      console.warn(`[DmgCalc] Unknown stat type ID: ${statTypeId}`);
      return;
    }

    // Add the talent bonus as a stat source
    addStatSource(statKey, sourceName, rawValue, true);
    console.log(`[DmgCalc] Applied talent bonus: ${statKey} +${rawValue}`);
  });
}

/**
 * Convert EffectTypeFirstSubtype ID to stat key
 */
function getStatKeyFromEffectTypeId(effectTypeId: number): string | null {
  // This mapping matches EFFECT_TYPE_TO_STAT in constants.ts
  const mapping: Record<number, string> = {
    1: 'Atk',
    2: 'Def',
    3: 'Hp',
    4: 'CritRate',
    5: 'CritPower',
    6: 'HitRate',
    7: 'StrikeRate',
    8: 'RuptureRate',
    10: 'WEE',
    11: 'FEE',
    12: 'SEE',
    13: 'AEE',
    14: 'LEE',
    15: 'DEE',
    56: 'NORMALDMG',
    57: 'SKILLDMG',
    58: 'ULTRADMG',
    59: 'OTHERDMG',
    64: 'MARKDMG',
    68: 'PROJECTILEDMG',
    66: 'SUMMONDMG',
    77: 'NORMALCRITPOWER',
    78: 'SKILLCRITPOWER',
    79: 'ULTRACRITPOWER',
    83: 'OTHERCRITPOWER',
    80: 'MARKCRITPOWER',
    82: 'PROJECTILECRITPOWER',
    81: 'SUMMONCRITPOWER',
    100: 'EnergyEfficiency',
    101: 'AbnormalMastery',
    102: 'Intensity',
    103: 'GENDMG',
    104: 'DMGPLUS',
    105: 'FINALDMG',
    106: 'FINALDMGPLUS'
  };

  return mapping[effectTypeId] || null;
}

// =============================================================================
// POTENTIAL STATS
// =============================================================================

/**
 * Aggregate stats from potentials for all party members
 * Uses parsePotentialEffects() to extract and apply stat bonuses
 */
function aggregatePotentialStats(): void {
  // Parse potential effects from all party positions (master, assist1, assist2)
  const allPotentialEffects = parseAllPartyPotentialEffects();

  if (allPotentialEffects.length === 0) {
    console.log('[DmgCalc] No potential effects found');
    return;
  }

  console.log(`[DmgCalc] Found ${allPotentialEffects.length} potentials with effects`);

  // Convert to stat sources and add to aggregation
  const statSources = convertPotentialEffectsToStatSources(allPotentialEffects);

  statSources.forEach(({ statKey, source, value, character }) => {
    // Skip if value is 0 or invalid
    if (!value || value === 0) return;

    // Add the stat source with character tracking
    addStatSourceWithCharacter(statKey, source, value, true, character);
  });

  // Log summary of potential contributions
  const potentialContributions = new Map<string, number>();
  statSources.forEach(({ statKey, value }) => {
    const current = potentialContributions.get(statKey) || 0;
    potentialContributions.set(statKey, current + value);
  });

  if (potentialContributions.size > 0) {
    console.log('[DmgCalc] Potential stat contributions:', Object.fromEntries(potentialContributions));
  }
}

/**
 * Add a stat source with character tracking
 */
function addStatSourceWithCharacter(
  statKey: string,
  source: string,
  value: number,
  active: boolean,
  character?: Position
): void {
  const state = getState();
  let stat = state.stats.get(statKey);

  // If stat doesn't exist in initialized categories, create it dynamically
  if (!stat) {
    state.stats.set(statKey, {
      name: getStatDisplayName(statKey),
      baseValue: 0,
      sources: [],
      manualAdjustment: 0,
      total: 0
    });
    stat = state.stats.get(statKey);
  }

  if (stat) {
    stat.sources.push({ source, value, active, character });
  }
}

// =============================================================================
// DISC STATS
// =============================================================================

/**
 * Aggregate stats from discs (main and sub)
 */
function aggregateDiscStats(): void {
  if (!window.discsState?.selectedDiscs) return;

  const mainDiscs = ['main1', 'main2', 'main3'] as const;
  const subDiscs = ['sub1', 'sub2', 'sub3'] as const;
  const attributes = GameData.attributes;
  const discData = GameData.discs;

  if (!attributes || !discData) {
    console.warn('[DmgCalc] Missing disc or attribute data');
    return;
  }

  // Main disc stats (use limit break)
  mainDiscs.forEach(slotId => {
    const selectedDisc = window.discsState?.selectedDiscs?.[slotId];
    if (!selectedDisc) return;

    // IMPORTANT: Default to 0 (no limit break) if not set
    const limitBreak = window.discsState?.discLimitBreaks?.[slotId] || 0;
    const discId = selectedDisc.Id;
    const discName = getDiscName(discId);
    const disc = discData[discId];

    if (!disc) return;

    const extDisc = disc as any;
    const groupId = extDisc.AttrBaseGroupId;

    if (!groupId) {
      console.warn(`[DmgCalc] No AttrBaseGroupId for disc ${discId}`);
      return;
    }

    // For main discs, max level is 70 (not 90 like characters)
    // Attribute key format: {groupId}{limitBreak}{level padded to 2}
    // All limit breaks use the same format (no special case for LB 0)
    let attrKey: string;
    const level = 70; // Main disc max level

    attrKey = `${groupId}${limitBreak}${String(level).padStart(2, '0')}`;

    const attrData = attributes[attrKey];

    if (!attrData) {
      console.warn(`[DmgCalc] ❌ Main disc attribute not found: ${attrKey} (disc: ${discId}, LB: ${limitBreak}, Level: ${level})`);
      console.log(`[DmgCalc] Available keys for groupId ${groupId}:`,
        Object.keys(attributes).filter(k => k.startsWith(String(groupId))).slice(0, 5)
      );
      return;
    }

    console.log(`[DmgCalc] ✅ Main disc ${slotId} stats:`, {
      discName,
      attrKey,
      Atk: attrData.Atk,
      stats: Object.keys(attrData).filter(k => !['Id', 'GroupId', 'Break', 'lvl'].includes(k))
    });

    // Add all stats from disc attributes
    const excludeKeys = ['Id', 'GroupId', 'Break', 'lvl'];
    const mainDiscTemplate = window.i18n?.t('dmgcalc.statSources.mainDisc') || 'Main Disc: {name}';
    const mainDiscLabel = mainDiscTemplate.replace('{name}', discName);
    for (const [statKey, value] of Object.entries(attrData)) {
      if (excludeKeys.includes(statKey)) continue;
      if (typeof value === 'number' && value > 0) {
        addStatSource(statKey, mainDiscLabel, value, true);
      }
    }
  });

  // Sub disc stats (use phase level)
  subDiscs.forEach(slotId => {
    const selectedDisc = window.discsState?.selectedDiscs?.[slotId];
    if (!selectedDisc) return;

    const phase = window.discsState?.subDiscLevels?.[slotId] || 0;
    const discId = selectedDisc.Id;
    const discName = getDiscName(discId);
    const disc = discData[discId];

    if (!disc) return;

    const extDisc = disc as any;
    const groupId = extDisc.AttrBaseGroupId;

    if (!groupId) {
      console.warn(`[DmgCalc] No AttrBaseGroupId for sub disc ${discId}`);
      return;
    }

    // Phase levels correspond to: 1, 10, 20, 30, 40, 50, 60, 70, 80, 90
    const level = PHASE_TO_LEVEL[phase] || 1;

    // Sub discs use limit break 0 (no limit break)
    const attrKey = `${groupId}${String(level).padStart(3, '0')}`;

    const attrData = attributes[attrKey];

    if (!attrData) {
      console.warn(`[DmgCalc] Attribute not found for sub disc ${discId}, key: ${attrKey}`);
      return;
    }

    // Add all stats from sub disc attributes
    const excludeKeys = ['Id', 'GroupId', 'Break', 'lvl'];
    const subDiscTemplate = window.i18n?.t('dmgcalc.statSources.subDisc') || 'Sub Disc: {name}';
    const subDiscLabel = subDiscTemplate.replace('{name}', discName);
    for (const [statKey, value] of Object.entries(attrData)) {
      if (excludeKeys.includes(statKey)) continue;
      if (typeof value === 'number' && value > 0) {
        addStatSource(statKey, subDiscLabel, value, true);
      }
    }
  });
}

// =============================================================================
// STAT SOURCE MANAGEMENT
// =============================================================================

/**
 * Add a stat source to the aggregated stats
 */
function addStatSource(statKey: string, source: string, value: number, active: boolean): void {
  const state = getState();
  let stat = state.stats.get(statKey);

  // If stat doesn't exist in initialized categories, create it dynamically
  if (!stat) {
    state.stats.set(statKey, {
      name: getStatDisplayName(statKey),
      baseValue: 0,
      sources: [],
      manualAdjustment: 0,
      total: 0
    });
    stat = state.stats.get(statKey);
  }

  if (stat) {
    stat.sources.push({ source, value, active });
  }
}

/**
 * Calculate total values for all stats
 */
function calculateStatTotals(): void {
  const state = getState();

  state.stats.forEach((stat, key) => {
    const activeSourcesTotal = stat.sources
      .filter(s => s.active)
      .reduce((sum, s) => sum + s.value, 0);

    stat.total = stat.baseValue + activeSourcesTotal + stat.manualAdjustment;

    // Debug log for ATK stat
    if (key === 'Atk') {
      console.log(`[DmgCalc] Final ATK calculation:`, {
        baseValue: stat.baseValue,
        sourcesCount: stat.sources.length,
        activeSources: stat.sources.filter(s => s.active).map(s => ({ source: s.source, value: s.value })),
        activeSourcesTotal,
        manualAdjustment: stat.manualAdjustment,
        total: stat.total
      });
    }
  });

  // Update state with calculated stats
  updateState({ stats: state.stats });
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get potential name from ID
 */
function getPotentialName(potId: string): string {
  const numId = parseInt(potId, 10);
  if (isNaN(numId)) return potId;

  const potential = window.state?.potentials?.[numId];
  if (!potential) return potId;

  // Get the name key from the potential's Name field
  const nameKey = (potential as any).Name;
  if (!nameKey || !window.state?.potentialNames) return potId;

  return window.state.potentialNames[nameKey] || potId;
}

/**
 * Get disc name from ID
 */
function getDiscName(discId: number): string {
  if (!window.discsState?.discNames) return discId.toString();
  return window.discsState.discNames[discId] || discId.toString();
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get a specific stat value
 */
export function getStat(statKey: string): number {
  const state = getState();
  return state.stats.get(statKey)?.total || 0;
}

/**
 * Get all stats
 */
export function getAllStats(): Map<string, AggregatedStat> {
  const state = getState();
  return state.stats;
}

/**
 * Toggle a stat source on/off
 */
export function toggleStatSource(statKey: string, sourceIndex: number): void {
  const state = getState();
  const stat = state.stats.get(statKey);

  if (stat && stat.sources[sourceIndex]) {
    stat.sources[sourceIndex].active = !stat.sources[sourceIndex].active;
    calculateStatTotals();
  }
}

/**
 * Set manual adjustment for a stat
 */
export function setManualAdjustment(statKey: string, adjustment: number): void {
  const state = getState();
  const stat = state.stats.get(statKey);

  if (stat) {
    stat.manualAdjustment = adjustment;
    calculateStatTotals();
  }
}

/**
 * Get stats grouped by category
 * Returns all stats organized by their category (core, offense, elemental, etc.)
 */
export function getStatsByCategory(): Map<StatCategory, Map<string, AggregatedStat>> {
  const state = getState();
  const categorizedStats = new Map<StatCategory, Map<string, AggregatedStat>>();

  // Initialize categories
  const categories: StatCategory[] = ['core', 'offense', 'elemental', 'special'];
  categories.forEach(cat => categorizedStats.set(cat, new Map()));

  // Group stats by category
  Object.entries(STAT_CATEGORIES).forEach(([categoryName, statKeys]) => {
    const category = categoryName as StatCategory;
    const categoryMap = categorizedStats.get(category);

    if (categoryMap) {
      statKeys.forEach(statKey => {
        const stat = state.stats.get(statKey);
        if (stat) {
          categoryMap.set(statKey, stat);
        }
      });
    }
  });

  return categorizedStats;
}
