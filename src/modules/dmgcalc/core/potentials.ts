/**
 * Potential Stat Bonuses for Damage Calculator
 *
 * Parses selected potentials and extracts stat bonuses.
 * Handles two parameter formats:
 *   - "EffectValue,{levelType},{id},EffectTypeParam1,HdPct"
 *   - "OnceAdditionalAttributeValue,{levelType},{id},Value1,10KHdPct"
 *
 * @module dmgcalc/core/potentials
 */

import { GameData } from '@/shared/game-data';
import { getAttrKeyFromEnumId } from './enums';
import { getState } from './state';
import type { Position } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface PotentialStatSource {
  /** Stat key (e.g. "Atk", "CritRate", "NORMALDMG") */
  statKey: string;
  /** Display name for the source */
  name: string;
  /** Numeric value (per-10000 format for percentage stats, or flat for absolute) */
  value: number;
  /** Whether this is a percentage bonus on a flat stat (ATK, DEF, HP) */
  isPercentage: boolean;
  /** Character ID the potential belongs to (for tracking) */
  characterId?: number;
  /** Potential ID (for level overrides) */
  potentialId?: number;
  /** Current resolved level of this potential */
  level?: number;
}

// Re-export types used by stats.ts
export type { PotentialStatSource as PotentialEffect };

// =============================================================================
// MAIN API
// =============================================================================

/**
 * Get all stat bonuses from selected potentials for a position.
 *
 * @param position - 'master' | 'assist1' | 'assist2'
 * @returns Array of stat sources to feed into aggregation
 */
export function getPotentialStatBonuses(position: Position): PotentialStatSource[] {
  const sources: PotentialStatSource[] = [];

  const selected = window.state?.selectedPotentials?.[position] || [];
  const levels = window.state?.potentialLevels?.[position] || {};

  if (selected.length === 0) return sources;

  // Resolve character ID for source tracking
  const charObj = window.state?.party?.[position];
  const charId = charObj && typeof charObj !== 'string'
    ? (typeof charObj.id === 'number' ? charObj.id : parseInt(charObj.id, 10))
    : undefined;

  for (const potId of selected) {
    if (!potId) continue;

    const potential = GameData.potentials?.[potId] || window.state?.potentials?.[potId];
    if (!potential) continue;

    // Use local override if set, otherwise fall back to window.state level
    const potentialLevelOverrides = getState().potentialLevelOverrides;
    const level = potentialLevelOverrides[potId] !== undefined
      ? potentialLevelOverrides[potId]
      : (levels[potId] || 1);
    const potName = resolvePotentialName(potId, position);

    // Parse Param1-Param10
    for (let i = 1; i <= 10; i++) {
      const param = (potential as any)[`Param${i}`];
      if (!param || typeof param !== 'string') continue;

      const parsed = parsePotentialParam(param, level, potName);
      if (parsed) {
        for (const src of parsed) {
          sources.push({ ...src, characterId: charId, potentialId: potId, level });
        }
      }
    }
  }

  return sources;
}

// =============================================================================
// LEGACY EXPORTS (for backward compatibility with stats.ts)
// =============================================================================

/**
 * Parse potential effects for all party positions.
 * Returns an array that convertPotentialEffectsToStatSources can consume.
 */
export function parseAllPartyPotentialEffects(): any[] {
  const all: any[] = [];
  const positions: Position[] = ['master', 'assist1', 'assist2'];

  for (const pos of positions) {
    const sources = getPotentialStatBonuses(pos);
    if (sources.length > 0) {
      all.push({
        character: pos,
        effects: sources.map((s) => ({
          statKey: s.statKey,
          value: s.value,
          source: s.name,
        })),
      });
    }
  }

  return all;
}

/**
 * Convert potential effects array to stat sources for aggregation.
 */
export function convertPotentialEffectsToStatSources(
  potentialEffects: any[]
): Array<{ statKey: string; source: string; value: number; character: Position }> {
  const result: Array<{ statKey: string; source: string; value: number; character: Position }> = [];

  for (const pot of potentialEffects) {
    for (const effect of pot.effects) {
      result.push({
        statKey: effect.statKey,
        source: effect.source,
        value: effect.value,
        character: pot.character,
      });
    }
  }

  return result;
}

// =============================================================================
// PARAM PARSING
// =============================================================================

/**
 * Parse a single potential parameter string into stat sources.
 */
function parsePotentialParam(
  paramStr: string,
  level: number,
  potName: string
): PotentialStatSource[] | null {
  const lower = paramStr.toLowerCase();

  // Skip display-only params (AttributeType1,Enum,EAT describes the stat type, not a bonus)
  if (lower.includes(',enum,') || lower.includes(',attributetype')) {
    return null;
  }

  if (lower.startsWith('effectvalue,') || lower.startsWith('effect,')) {
    return parseEffectValueParam(paramStr, level, potName);
  }

  if (lower.startsWith('onceadditionalattributevalue,')) {
    return parseOnceAdditionalParam(paramStr, level, potName);
  }

  if (lower.startsWith('onceadditionalattribute,')) {
    return parseOnceAdditionalParam(paramStr, level, potName);
  }

  return null;
}

/**
 * Parse "EffectValue,{levelType},{baseId},EffectTypeParam1,HdPct"
 *
 * Looks up the EffectValue entry, reads EffectTypeFirstSubtype (stat ID)
 * and EffectTypeParam1 (numeric value), and maps to a stat key.
 */
function parseEffectValueParam(
  paramStr: string,
  level: number,
  potName: string
): PotentialStatSource[] | null {
  const parts = paramStr.split(',');
  if (parts.length < 3) return null;

  const levelType = parts[1]!;
  const baseId = parseInt(parts[2]!, 10);
  if (isNaN(baseId)) return null;

  const actualId = resolveId(baseId, levelType, level);
  const effectData = GameData.effectValue?.[actualId] as any;
  if (!effectData) return null;

  const subtype = effectData.EffectTypeFirstSubtype;
  if (subtype === undefined) return null;

  const statKey = getAttrKeyFromEnumId(subtype);
  if (!statKey) return null;

  // Extract value from EffectTypeParam1
  let value = 0;
  const raw = effectData.EffectTypeParam1;
  if (raw !== undefined) {
    value = typeof raw === 'string' ? parseFloat(raw) : raw;
  }
  if (isNaN(value) || value === 0) return null;

  // Apply format conversion based on the format hint in the param string
  const formatHint = parts[4] || '';
  value = applyFormatConversion(value, formatHint);

  // SecondSubtype=2 (PERCENTAGE) on non-bIntFloat stats = percentage multiplier
  const secondSubtype = effectData.EffectTypeSecondSubtype || 0;
  const FLAT_BASE_STATS = new Set(['Atk', 'Def', 'Hp']);
  const isPercentage = secondSubtype === 2 && FLAT_BASE_STATS.has(statKey);

  return [{
    statKey,
    name: `Potential: ${potName}`,
    value,
    isPercentage,
  }];
}

/**
 * Parse "OnceAdditionalAttributeValue,{levelType},{baseId},Value1,10KHdPct"
 *
 * Looks up OnceAdditionalAttributeValue entry, reads AttributeType1 (stat ID)
 * and Value1 (numeric value).
 */
function parseOnceAdditionalParam(
  paramStr: string,
  level: number,
  potName: string
): PotentialStatSource[] | null {
  const parts = paramStr.split(',');
  if (parts.length < 3) return null;

  const levelType = parts[1]!;
  const baseId = parseInt(parts[2]!, 10);
  if (isNaN(baseId)) return null;

  const actualId = resolveId(baseId, levelType, level);
  const data = GameData.onceAdditionalAttributeValue?.[actualId] as any;
  if (!data) return null;

  const attributeType = data.AttributeType1;
  if (attributeType === undefined) return null;

  const statKey = getAttrKeyFromEnumId(attributeType);
  if (!statKey) return null;

  let value = data.Value1 ?? 0;
  if (typeof value === 'string') value = parseFloat(value);
  if (isNaN(value) || value === 0) return null;

  // OnceAdditionalAttributeValue values are always per-10000 percentages
  // (Lua: ParseOnceDesc multiplies by IntFloatPrecision 0.0001)
  // For per-10000 stats (SKILLDMG, GENDMG, etc.), this value adds directly
  // For flat stats (ATK, DEF, HP), this is a percentage of the base stat
  const FLAT_BASE_STATS = new Set(['Atk', 'Def', 'Hp']);
  const isPercentage = FLAT_BASE_STATS.has(statKey);

  // Value is already in per-10000 format — no conversion needed
  return [{
    statKey,
    name: `Potential: ${potName}`,
    value,
    isPercentage,
  }];
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Resolve an ID based on level type.
 */
function resolveId(baseId: number, levelType: string, level: number): number {
  if (levelType === 'LevelUp') {
    return baseId + level * 10;
  }
  return baseId;
}

/**
 * Apply format conversion to a raw value based on the format hint.
 *
 * Two different data sources with different value formats:
 *
 * 1. EffectValue.EffectTypeParam1: stored as decimals (0.25 = 25%)
 *    → needs multiply by 10000 for per-10000 stat format
 *
 * 2. OnceAdditionalAttributeValue.Value1: stored as per-10000 integers (70 = 0.7%)
 *    → already in per-10000 format, no conversion needed
 *
 * Format hints from param strings:
 *   - "10KHdPct": already per-10000 (from OnceAdditionalAttributeValue) → no conversion
 *   - "HdPct", "Pct", "Hd": decimal percentage (from EffectValue) → multiply by 10000
 *   - "Fixed": flat value → no conversion
 */
function applyFormatConversion(value: number, formatHint: string): number {
  const hint = formatHint.toLowerCase();

  if (hint === 'fixed') {
    // Flat value, no conversion
    return value;
  }

  if (hint.includes('10k')) {
    // Already in per-10000 format (OnceAdditionalAttributeValue.Value1)
    return value;
  }

  if (hint.includes('hd') || hint.includes('pct')) {
    // Decimal percentage from EffectValue → convert to per-10000
    return value * 10000;
  }

  // Default: assume decimal percentage, convert to per-10000
  return value * 10000;
}

/**
 * Resolve the display name for a potential.
 */
function resolvePotentialName(potId: number, _position: Position): string {
  // Primary: Get name from Item.json (same pattern as app-char.ts)
  const itemKey = `Item.${potId}.1`;
  if (GameData.itemsKR?.[itemKey]) {
    return GameData.itemsKR[itemKey];
  }

  // Fallback: try potentialNames from state
  const potIdStr = String(potId);
  if (window.state?.potentialNames?.[potIdStr]) {
    return window.state.potentialNames[potIdStr];
  }

  return `Potential ${potId}`;
}
