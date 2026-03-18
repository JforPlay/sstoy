/**
 * Stat Aggregation for Damage Calculator
 *
 * Clean implementation that collects stats from all sources:
 *   1. Base character attributes (from Attribute.json)
 *   2. Talent bonuses (limit break unlocks)
 *   3. Potential stat bonuses
 *   4. Disc stats (main + sub)
 *   5. Active buff contributions
 *
 * @module dmgcalc/core/stats
 */

import type { AggregatedStat, StatSource, Position } from '../types';
import { STAT_CATEGORIES, PHASE_TO_LEVEL } from '../constants';
import { getState } from './state';
import { GameData } from '../../../shared/game-data';
import { getStatDisplayName, formatStatValue as formatStatValueFromEnums, getAttrKeyFromEnumId } from './enums';
import { getPotentialStatBonuses } from './potentials';
import { initializeBuffs } from './buffs';

// Re-export formatStatValue for convenience
export { formatStatValueFromEnums as formatStatValue };

// Keys to skip when iterating attribute data entries
const ATTR_META_KEYS = new Set(['Id', 'GroupId', 'Break', 'lvl']);

// =============================================================================
// MAIN AGGREGATION
// =============================================================================

/**
 * Aggregate all stats for a character build.
 *
 * @param charId       - Character ID (numeric, from Character.json)
 * @param level        - Actual character level (1-90)
 * @param limitBreak   - Limit break level (0-5, from dmgcalc stepper)
 * @returns Map of stat key -> AggregatedStat
 */
export function aggregateAllStats(
  charId: number,
  level: number,
  limitBreak: number
): Map<string, AggregatedStat> {
  const stats = initializeStats();

  // 1. Base character stats from Attribute.json
  aggregateBaseStats(stats, charId, level);

  // 2. Talent bonuses unlocked by limit break
  aggregateTalentBonuses(stats, charId, limitBreak);

  // 3. Potential stats (all 3 positions)
  aggregatePotentialStats(stats);

  // 4. Disc stats
  aggregateDiscStats(stats);

  // 5. Note (소리) stats
  aggregateNoteStats(stats);

  // 6. Calculate totals
  // NOTE: Active buffs are applied separately by applyBuffsToStats() in index.ts
  // after buff collection. Do NOT apply them here to avoid double-counting.
  calculateTotals(stats);

  // 7. Apply manual stat overrides (replaces calculated totals)
  applyStatOverrides(stats);

  return stats;
}

/**
 * Legacy entry point - reads character info from window.state and delegates
 * to aggregateAllStats. Updates dmgcalc state in place.
 */
export function aggregateStatsFromBuild(): void {
  if (!window.state) return;

  const masterChar = window.state.party?.master;
  if (!masterChar || typeof masterChar === 'string') return;

  const charId = typeof masterChar.id === 'string' ? parseInt(masterChar.id, 10) : masterChar.id;
  const levelPhase = window.state.characterLevelPhase?.master || 0;
  const level = PHASE_TO_LEVEL[levelPhase] || 1;

  const dmgState = getState();
  const lb = dmgState.limitBreak;

  // Initialize buffs before aggregation so applyActiveBuffs can read them
  initializeBuffs();

  const stats = aggregateAllStats(charId, level, lb);
  dmgState.stats = stats;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

function initializeStats(): Map<string, AggregatedStat> {
  const stats = new Map<string, AggregatedStat>();

  // Pre-populate every known stat key so downstream code always finds them
  const allKeys = Object.values(STAT_CATEGORIES).flat();
  for (const key of allKeys) {
    stats.set(key, createStat(key));
  }

  return stats;
}

function createStat(key: string): AggregatedStat {
  return {
    key,
    displayName: getStatDisplayName(key),
    baseValue: 0,
    sources: [],
    total: 0,
    calculatedTotal: 0,
  };
}

// =============================================================================
// 1. BASE CHARACTER STATS
// =============================================================================

function aggregateBaseStats(
  stats: Map<string, AggregatedStat>,
  charId: number,
  level: number
): void {
  const attributes = GameData.attributes;
  if (!attributes) return;

  const groupId = findGroupId(charId, attributes);
  if (groupId === null) return;

  // Determine ascension phase from level
  const phase = levelToPhase(level);

  // Attribute key: {groupId}{(phase * 1000 + level) padded to 5 digits}
  const combined = (phase * 1000) + level;
  const attrId = `${groupId}${combined.toString().padStart(5, '0')}`;
  const attrData = attributes[attrId];

  if (!attrData) {
    return;
  }

  for (const [key, value] of Object.entries(attrData)) {
    if (ATTR_META_KEYS.has(key)) continue;
    if (typeof value !== 'number' || value === 0) continue;

    addSource(stats, key, { name: 'Base', value, active: true });
  }
}

/**
 * Find the GroupId for a character by scanning attribute entries.
 * GroupId is the prefix used in attribute ID construction.
 */
function findGroupId(charId: number, attributes: Record<string, any>): number | null {
  for (const attrId in attributes) {
    const attr = attributes[attrId];
    if (!attr?.GroupId) continue;
    const gid = attr.GroupId;
    const gidStr = gid.toString();
    if (gidStr.length >= 3) {
      const tail = parseInt(gidStr.slice(-3), 10);
      if (tail === charId || gid === charId) {
        return gid;
      }
    }
  }
  return charId; // fallback: use charId directly
}

/**
 * Map a level to its ascension phase (Break value in Attribute.json).
 * Break goes 0-8: Break 0 = lv1-9, Break 1 = lv10-19, ..., Break 8 = lv80-90+
 * Level 90 still uses Break 8 (no Break 9 exists in the data).
 */
function levelToPhase(level: number): number {
  if (level >= 80) return 8;
  if (level >= 70) return 7;
  if (level >= 60) return 6;
  if (level >= 50) return 5;
  if (level >= 40) return 4;
  if (level >= 30) return 3;
  if (level >= 20) return 2;
  if (level >= 10) return 1;
  return 0;
}

// =============================================================================
// 2. TALENT BONUSES
// =============================================================================

function aggregateTalentBonuses(
  stats: Map<string, AggregatedStat>,
  charId: number,
  limitBreak: number
): void {
  if (!GameData.talentGroups || !GameData.talents) return;

  const charIdStr = String(charId);

  // Get talent groups for this character, sorted by Background (tier)
  const groups = Object.values(GameData.talentGroups)
    .filter((g: any) => String(g.CharId) === charIdStr && g.Background <= limitBreak)
    .sort((a: any, b: any) => a.Background - b.Background);

  if (groups.length === 0) return;

  // Collect talents from all unlocked groups
  for (const group of groups) {
    const groupTalents = Object.values(GameData.talents)
      .filter((t: any) => t.GroupId === (group as any).Id);

    for (const talent of groupTalents) {
      const t = talent as any;
      if (t.Type !== 2) continue; // Only stat-bonus talents

      // Process Param1-Param5 for EffectValue references
      for (let i = 1; i <= 5; i++) {
        const param = t[`Param${i}`];
        if (!param || typeof param !== 'string') continue;

        const lower = param.toLowerCase();
        if (!lower.startsWith('effectvalue')) continue;

        const parts = param.split(',');
        if (parts.length < 3) continue;

        const levelType = parts[1]!;
        const baseId = parseInt(parts[2]!, 10);
        if (isNaN(baseId)) continue;

        // Resolve the actual effect ID
        const effectId = levelType === 'LevelUp' ? baseId + (limitBreak * 10) : baseId;
        const effectData = GameData.effectValue?.[effectId];
        if (!effectData) continue;

        const subtype = (effectData as any).EffectTypeFirstSubtype;
        const secondSubtype = (effectData as any).EffectTypeSecondSubtype;
        const rawParam = parseFloat((effectData as any).EffectTypeParam1 || '0');
        if (subtype === undefined || isNaN(rawParam) || rawParam === 0) continue;

        const statKey = getAttrKeyFromEnumId(subtype);
        if (!statKey) continue;

        // ATK/DEF/HP are non-bIntFloat (raw integers). All others are bIntFloat (per-10000).
        // EffectTypeParam1 for bIntFloat stats is a decimal (0.015 = 150 in per-10000).
        // SecondSubtype: 1=BASE_VALUE (add to stat), 2=PERCENTAGE (multiply base stat)
        const NON_INT_FLOAT_STATS = new Set(['Atk', 'Def', 'Hp', 'WEP', 'FEP', 'SEP', 'AEP', 'LEP', 'DEP']);
        const isBIntFloat = !NON_INT_FLOAT_STATS.has(statKey);

        let rawValue: number;
        if (isBIntFloat) {
          // bIntFloat: convert decimal to per-10000 (0.015 → 150)
          rawValue = rawParam * 10000;
        } else {
          // Non-bIntFloat (ATK/DEF/HP): flat value or percentage
          rawValue = rawParam;
        }

        // SecondSubtype=2 (PERCENTAGE) on flat stats = percentage multiplier
        const isPercentage = secondSubtype === 2 && !isBIntFloat;
        addSource(stats, statKey, { name: 'Talent', value: rawValue, active: true, isPercentage });
      }
    }
  }
}

// =============================================================================
// 3. POTENTIAL STATS
// =============================================================================

function aggregatePotentialStats(stats: Map<string, AggregatedStat>): void {
  const positions: Position[] = ['master', 'assist1', 'assist2'];

  for (const position of positions) {
    const sources = getPotentialStatBonuses(position);
    for (const src of sources) {
      if (src.isPercentage) {
        // Percentage bonuses on flat stats — store with special name prefix
        // These will be applied as multipliers during calculateTotals
        addSource(stats, src.statKey, {
          name: `${src.name} (%)`,
          value: src.value,
          active: true,
          characterId: src.characterId,
          isPercentage: true,
        });
      } else {
        addSource(stats, src.statKey, {
          name: src.name,
          value: src.value,
          active: true,
          characterId: src.characterId,
        });
      }
    }
  }
}

// =============================================================================
// 4. DISC STATS
// =============================================================================

function aggregateDiscStats(stats: Map<string, AggregatedStat>): void {
  if (!window.discsState?.selectedDiscs) return;

  const attributes = GameData.attributes;
  const discData = GameData.discs;
  if (!attributes || !discData) return;

  // Disc attribute key format (from Lua GetDiscAttributeId):
  // nGroupId * 1000 + nPhase * 100 + nLevel
  // e.g., 21003 * 1000 + 8 * 100 + 80 = 21003880

  const dmgState = getState();
  const discLevel = dmgState.discLevel || 81;
  const discPhase = levelToPhase(discLevel);

  // Main discs
  const mainSlots = ['main1', 'main2', 'main3'] as const;
  for (const slotId of mainSlots) {
    const selectedDisc = window.discsState.selectedDiscs?.[slotId];
    if (!selectedDisc) continue;

    const disc = discData[selectedDisc.Id];
    if (!disc) continue;

    const groupId = (disc as any).AttrBaseGroupId;
    if (!groupId) continue;

    const lb = dmgState.discLimitBreaks?.[slotId] ?? window.discsState.discLimitBreaks?.[slotId] ?? 1;
    const level = discLevel;
    const phase = discPhase;
    // Key: groupId * 1000 + phase * 100 + level
    const attrKey = String(groupId * 1000 + phase * 100 + level);
    const attrData = attributes[attrKey];
    if (!attrData) continue;

    const discName = getDiscName(selectedDisc.Id);
    const sourceName = `Main Disc: ${discName} (LB${lb})`;

    for (const [key, value] of Object.entries(attrData)) {
      if (ATTR_META_KEYS.has(key)) continue;
      if (typeof value !== 'number' || value <= 0) continue;
      addSource(stats, key, { name: sourceName, value, active: true });
    }
  }

  // Sub discs
  const subSlots = ['sub1', 'sub2', 'sub3'] as const;
  for (const slotId of subSlots) {
    const selectedDisc = window.discsState.selectedDiscs?.[slotId];
    if (!selectedDisc) continue;

    const disc = discData[selectedDisc.Id];
    if (!disc) continue;

    const groupId = (disc as any).AttrBaseGroupId;
    if (!groupId) continue;

    const level = discLevel;
    const phase = discPhase;
    const attrKey = String(groupId * 1000 + phase * 100 + level);
    const attrData = attributes[attrKey];
    if (!attrData) continue;

    const discName = getDiscName(selectedDisc.Id);
    const sourceName = `Sub Disc: ${discName}`;

    for (const [key, value] of Object.entries(attrData)) {
      if (ATTR_META_KEYS.has(key)) continue;
      if (typeof value !== 'number' || value <= 0) continue;
      addSource(stats, key, { name: sourceName, value, active: true });
    }
  }
}

// =============================================================================
// 5. NOTE (소리) STATS
// =============================================================================

/**
 * Aggregate stat bonuses from notes (소리).
 *
 * Note levels come from two sources:
 *   - Sub disc contributions (SubNoteSkillGroupId → SubNoteSkillPromote → SubNoteSkills JSON)
 *   - Acquired notes (window.discsState.acquiredNotes)
 *
 * The user can override individual note levels via state.noteOverrides.
 */
function aggregateNoteStats(stats: Map<string, AggregatedStat>): void {
  const dmgState = getState();
  const noteOverrides = dmgState.noteOverrides;

  // Collect all note IDs from overrides
  const noteIds = Object.keys(noteOverrides);
  if (noteIds.length === 0) return;

  const subNoteSkills = GameData.subNoteSkills;
  const effectValues = GameData.effectValue;
  if (!subNoteSkills || !effectValues) return;

  for (const noteId of noteIds) {
    const level = noteOverrides[noteId];
    if (!level || level <= 0) continue;

    const noteData = subNoteSkills[noteId] as any;
    if (!noteData || !noteData.Param2) continue;

    // Parse Param2: "Effect,LevelUp,{baseId},EffectTypeParam1,HdPct"
    const param2Parts = noteData.Param2.split(',').map((p: string) => p.trim());
    if (param2Parts.length < 3) continue;

    const [fileType, levelType, baseIdStr] = param2Parts;
    if (fileType !== 'Effect' || levelType !== 'LevelUp') continue;

    const baseId = parseInt(baseIdStr, 10);
    if (isNaN(baseId)) continue;

    const actualId = baseId + level * 10;
    const effectData = effectValues[actualId] as any;
    if (!effectData) continue;

    const subtype = effectData.EffectTypeFirstSubtype;
    if (subtype === undefined) continue;

    const statKey = getAttrKeyFromEnumId(subtype);
    if (!statKey) continue;

    let rawParam = effectData.EffectTypeParam1;
    if (rawParam === undefined) continue;
    rawParam = typeof rawParam === 'string' ? parseFloat(rawParam) : rawParam;
    if (isNaN(rawParam) || rawParam === 0) continue;

    // Determine value type from bIntFloat flag AND SecondSubtype
    const secondSubtype = effectData.EffectTypeSecondSubtype || 0;
    const NON_INT_FLOAT_STATS = new Set(['Atk', 'Def', 'Hp', 'WEP', 'FEP', 'SEP', 'AEP', 'LEP', 'DEP']);
    const isBIntFloat = !NON_INT_FLOAT_STATS.has(statKey);

    let value: number;
    let isPercentage = false;

    if (isBIntFloat) {
      // bIntFloat stats: decimal → per-10000 (e.g., 0.012 → 120)
      value = rawParam * 10000;
    } else if (secondSubtype === 2) {
      // Non-bIntFloat (ATK/DEF/HP) with PERCENTAGE type: decimal → per-10000
      // e.g., ATK note: 0.003 = 0.3% of base ATK → store as 30 per-10000
      value = rawParam * 10000;
      isPercentage = true;
    } else {
      // Flat value
      value = rawParam;
    }

    // Get note name for source label
    const noteKRKey = `SubNoteSkill.${noteId}.1`;
    const noteName = GameData.subNoteSkillsKR?.[noteKRKey]
      || window.discsState?.subNoteSkillKRData?.[noteKRKey]
      || `Note ${noteId}`;

    addSource(stats, statKey, {
      name: `소리: ${noteName} Lv.${level}`,
      value,
      active: true,
      isPercentage,
    });
  }
}

// =============================================================================
// 6. ACTIVE BUFFS
// =============================================================================

function applyActiveBuffs(stats: Map<string, AggregatedStat>): void {
  const dmgState = getState();

  for (const buff of dmgState.buffs) {
    if (!buff.active) continue;

    for (const effect of buff.statEffects) {
      addSource(stats, effect.key, {
        name: buff.name,
        value: effect.value,
        active: true,
      });
    }
  }
}

// =============================================================================
// TOTAL CALCULATION
// =============================================================================

function calculateTotals(stats: Map<string, AggregatedStat>): void {
  stats.forEach((stat) => {
    // Separate flat and percentage sources
    const activeSources = stat.sources.filter((s) => s.active);
    const flatTotal = activeSources
      .filter((s) => !s.isPercentage)
      .reduce((sum, s) => sum + s.value, 0);
    const pctTotal = activeSources
      .filter((s) => s.isPercentage)
      .reduce((sum, s) => sum + s.value, 0);

    // Base + flat additions, then apply percentage multiplier
    const flatBase = stat.baseValue + flatTotal;
    if (pctTotal !== 0) {
      stat.total = Math.round(flatBase * (1 + pctTotal / 10000));
    } else {
      stat.total = flatBase;
    }
    // Preserve the calculated total before any manual override
    stat.calculatedTotal = stat.total;
  });
}

/**
 * Apply manual stat overrides from state.statOverrides.
 * These replace the calculated total with a user-specified value.
 */
function applyStatOverrides(stats: Map<string, AggregatedStat>): void {
  const overrides = getState().statOverrides;
  for (const [key, value] of Object.entries(overrides)) {
    const stat = stats.get(key);
    if (stat) {
      stat.total = value;
    }
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Add a StatSource to an AggregatedStat entry, creating it if missing.
 */
function addSource(
  stats: Map<string, AggregatedStat>,
  key: string,
  source: StatSource
): void {
  let stat = stats.get(key);
  if (!stat) {
    stat = createStat(key);
    stats.set(key, stat);
  }
  stat.sources.push(source);
}

function getDiscName(discId: number): string {
  return window.discsState?.discNames?.[discId]?.toString() || String(discId);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get a single stat's total value from the dmgcalc state.
 */
export function getStat(statKey: string): number {
  return getState().stats.get(statKey)?.total || 0;
}

/**
 * Get the full stats map from the dmgcalc state.
 */
export function getAllStats(): Map<string, AggregatedStat> {
  return getState().stats;
}

/**
 * Toggle an individual stat source on/off and recalculate totals.
 */
export function toggleStatSource(statKey: string, sourceIndex: number): void {
  const stat = getState().stats.get(statKey);
  if (stat?.sources[sourceIndex]) {
    stat.sources[sourceIndex].active = !stat.sources[sourceIndex].active;
    calculateTotals(getState().stats);
  }
}

/**
 * Get stats grouped by category for UI display.
 */
export function getStatsByCategory(): Map<string, Map<string, AggregatedStat>> {
  const categorized = new Map<string, Map<string, AggregatedStat>>();

  for (const [categoryName, statKeys] of Object.entries(STAT_CATEGORIES)) {
    const categoryMap = new Map<string, AggregatedStat>();
    for (const key of statKeys) {
      const stat = getState().stats.get(key);
      if (stat) {
        categoryMap.set(key, stat);
      }
    }
    categorized.set(categoryName, categoryMap);
  }

  return categorized;
}

// Re-export getStatDisplayName so UI modules can import it from stats
export { getStatDisplayName };
