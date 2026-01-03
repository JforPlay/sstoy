/**
 * Damage Calculator - Potential Effects Parser
 * Parses potential effects and extracts stat bonuses/buffs for all party members
 *
 * @module dmgcalc/core/potentials
 */

import { GameData } from '@/shared/game-data';
import { parseParamValue } from '@/modules/param-parser';
import { getAttrKeyFromEnumId } from './enums';
import type { Position } from '../types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Parsed potential effect
 */
export interface PotentialEffect {
  potentialId: number;
  potentialName: string;
  level: number;
  maxLevel: number;
  character: Position;
  effects: ParsedEffect[];
}

/**
 * Individual parsed effect from a potential
 */
export interface ParsedEffect {
  /** Stat key (e.g., "Atk", "CritRate", "NORMALDMG") */
  statKey: string;
  /** Numeric value to add */
  value: number;
  /** Source description (for UI display) */
  source: string;
  /** Effect type ID from EffectValue */
  effectType: number;
  /** Effect subtype (maps to stat) */
  effectSubtype: number;
  /** Whether this is a conditional effect */
  isConditional: boolean;
  /** Condition description (if conditional) */
  condition?: string;
}

// =============================================================================
// POTENTIAL EFFECT PARSING
// =============================================================================

/**
 * Parse all potential effects for a character at a specific position
 *
 * @param position - Character position ('master', 'assist1', 'assist2')
 * @returns Array of potential effects with parsed stats
 */
export function parsePotentialEffects(position: Position): PotentialEffect[] {
  const effects: PotentialEffect[] = [];

  // Get selected potentials for this position
  const selectedPotentials = window.state?.selectedPotentials?.[position];
  if (!selectedPotentials || selectedPotentials.length === 0) {
    return effects;
  }

  // Get potential levels
  const potentialLevels = window.state?.potentialLevels?.[position] || {};

  // Process each selected potential
  selectedPotentials.forEach(potId => {
    if (!potId) return;

    const level = potentialLevels[potId] || 1;

    // Try both GameData.potentials and window.state.potentials
    const potential = GameData.potentials?.[potId] || window.state?.potentials?.[potId];

    if (!potential) {
      // Silently skip missing potentials (might be from newer game version)
      return;
    }

    const potentialName = getPotentialName(String(potId), position);
    const parsedEffects: ParsedEffect[] = [];

    // Parse all parameter fields (Param1 through Param10)
    for (let i = 1; i <= 10; i++) {
      const paramKey = `Param${i}` as keyof typeof potential;
      const paramValue = potential[paramKey];

      if (!paramValue || typeof paramValue !== 'string') continue;

      // Parse the parameter string
      try {
        const effectData = parsePotentialParameter(
          paramValue,
          level,
          position,
          potential,
          potentialName
        );

        if (effectData) {
          parsedEffects.push(...effectData);
        }
      } catch (error) {
        console.warn(`[DmgCalc] Failed to parse potential ${potId} param ${paramKey}:`, error);
      }
    }

    if (parsedEffects.length > 0) {
      effects.push({
        potentialId: potId,
        potentialName,
        level,
        maxLevel: (potential as any).MaxLevel || 1,
        character: position,
        effects: parsedEffects
      });
    }
  });

  return effects;
}

/**
 * Parse OnceAdditionalAttributeValue parameter
 *
 * Format: "OnceAdditionalAttributeValue,NoLevel,{id},Value1,10KHdPct"
 *
 * Structure:
 * - AttributeType1: Maps to GameEnums.effectAttributeType (e.g., 1=ATK, 57=SKILLDMG)
 * - ParameterType1: Type of parameter
 * - Value1: The actual value (in per-10000 format)
 *
 * @param paramStr - Parameter string
 * @param level - Potential level
 * @param potentialName - Display name
 * @returns Parsed effects
 */
function parseOnceAdditionalAttributeValue(
  paramStr: string,
  level: number,
  potentialName: string
): ParsedEffect[] | null {
  const effects: ParsedEffect[] = [];

  // Split parameter string: "OnceAdditionalAttributeValue,NoLevel,{id},Value1,10KHdPct"
  const parts = paramStr.split(',');
  if (parts.length < 3) return null;

  const fileType = parts[0];
  const levelType = parts[1];
  const baseIdStr = parts[2];

  if (!fileType || !levelType || !baseIdStr) return null;

  // Normalize file type
  const normalizedFileType = fileType.toLowerCase().trim();
  if (normalizedFileType !== 'onceadditionalattributevalue') {
    return null;
  }

  // Calculate actual ID based on level type
  let onceAdditionalId = baseIdStr;
  if (levelType === 'LevelUp') {
    const baseId = parseInt(baseIdStr, 10);
    if (!isNaN(baseId)) {
      onceAdditionalId = String(baseId + (level * 10));
    }
  }

  // Look up the OnceAdditionalAttributeValue in game data
  const onceAdditional = GameData.onceAdditionalAttributeValue?.[onceAdditionalId];
  if (!onceAdditional) {
    console.warn(`[DmgCalc] OnceAdditionalAttributeValue ${onceAdditionalId} not found`);
    return null;
  }

  const onceData = onceAdditional as any;

  // Extract value
  const rawValue = onceData.Value1 || 0;

  // Apply format transformations based on format type (4th parameter)
  const formatType = parts[4] || '';
  let value = rawValue;

  // Most OnceAdditional values are in per-10000 format (10KHdPct)
  // They're already in the correct format, no conversion needed
  if (!formatType.includes('10K') && formatType.includes('Pct')) {
    // Per-100 format: multiply by 100
    value = rawValue * 100;
  }

  // Get stat key from AttributeType1
  const attributeType = onceData.AttributeType1;
  if (attributeType === undefined) {
    return null;
  }

  const statKey = getAttrKeyFromEnumId(attributeType);
  if (!statKey) {
    console.warn(`[DmgCalc] Unknown AttributeType1 ${attributeType} in OnceAdditionalAttributeValue ${onceAdditionalId}`);
    return null;
  }

  effects.push({
    statKey,
    value,
    source: `잠재력: ${potentialName}`,
    effectType: 0, // Not from EffectValue
    effectSubtype: attributeType,
    isConditional: false
  });

  return effects.length > 0 ? effects : null;
}

/**
 * Parse a single potential parameter string
 *
 * @param paramStr - Parameter string (e.g., "EffectValue,NoLevel,10350111,EffectTypeParam1,HdPct")
 * @param level - Potential level
 * @param position - Character position
 * @param potential - Full potential data
 * @param potentialName - Display name for this potential
 * @returns Parsed effects, or null if parsing failed
 */
function parsePotentialParameter(
  paramStr: string,
  level: number,
  position: Position,
  potential: any,
  potentialName: string
): ParsedEffect[] | null {
  const effects: ParsedEffect[] = [];

  // Check if this is OnceAdditionalAttributeValue parameter
  if (paramStr.toLowerCase().includes('onceadditionalattributevalue')) {
    const onceAdditionalEffects = parseOnceAdditionalAttributeValue(paramStr, level, potentialName);
    if (onceAdditionalEffects) {
      return onceAdditionalEffects;
    }
  }

  // Parse the parameter value using param-parser
  const state = window.state as any;
  if (!state) return null;

  // Call parseParamValue to get the parsed value
  const parsedValue = parseParamValue(
    paramStr,
    level,
    1, // skillLevel (not used for potentials)
    position,
    state,
    false, // isSpecificPotential
    window.state?.characterLevelPhase?.[position] || 0
  );

  if (!parsedValue || typeof parsedValue !== 'object') {
    // Some parameters might just return a simple value
    // Try to extract effect data differently
    return parseEffectDirectly(paramStr, level, potentialName);
  }

  // If we got an object back, it might have effect data
  // Extract stat information from the parsed result
  const effectData = extractEffectFromParsed(parsedValue, potentialName);
  if (effectData) {
    effects.push(...effectData);
  }

  return effects.length > 0 ? effects : null;
}

/**
 * Extract effect data from a parsed parameter value
 */
function extractEffectFromParsed(parsedValue: any, potentialName: string): ParsedEffect[] | null {
  const effects: ParsedEffect[] = [];

  // Check if this is an effect value with stat modifications
  if (parsedValue.effectType !== undefined && parsedValue.effectSubtype !== undefined) {
    const statKey = getAttrKeyFromEnumId(parsedValue.effectSubtype);

    if (statKey) {
      effects.push({
        statKey,
        value: parsedValue.value || 0,
        source: `잠재력: ${potentialName}`,
        effectType: parsedValue.effectType,
        effectSubtype: parsedValue.effectSubtype,
        isConditional: false
      });
    }
  }

  return effects.length > 0 ? effects : null;
}

/**
 * Parse effect data directly from parameter string
 * Fallback method when parseParamValue doesn't give us structured data
 */
function parseEffectDirectly(
  paramStr: string,
  level: number,
  potentialName: string
): ParsedEffect[] | null {
  const effects: ParsedEffect[] = [];

  // Split parameter string: "fileType,levelType,baseId,fieldKey,formatType"
  const parts = paramStr.split(',');
  if (parts.length < 3) return null;

  const fileType = parts[0];
  const levelType = parts[1];
  const baseIdStr = parts[2];
  const fieldKey = parts[3] || 'EffectTypeParam1';

  if (!fileType || !levelType || !baseIdStr) return null;

  // Normalize file type
  const normalizedFileType = fileType.toLowerCase().trim();

  // Only process effect-related file types
  if (normalizedFileType !== 'effectvalue' && normalizedFileType !== 'effect') {
    return null;
  }

  // Calculate actual ID based on level type
  let effectId = baseIdStr;
  if (levelType === 'LevelUp') {
    // For LevelUp: ID = baseId + (level * 10)
    const baseId = parseInt(baseIdStr, 10);
    if (!isNaN(baseId)) {
      effectId = String(baseId + (level * 10));
    }
  }

  // Look up the effect in EffectValue
  const effectValue = GameData.effectValue?.[effectId];
  if (!effectValue) {
    console.warn(`[DmgCalc] EffectValue ${effectId} not found`);
    return null;
  }

  // Extract the value from the specified field
  const rawValue = (effectValue as any)[fieldKey];
  if (rawValue === undefined) {
    return null;
  }

  // Convert value based on format type
  const formatType = parts[4] || '';
  let value = typeof rawValue === 'string' ? parseFloat(rawValue) : rawValue;

  if (isNaN(value)) {
    return null;
  }

  // Apply format transformations
  if (formatType.includes('Pct') || formatType.includes('pct')) {
    // Already a percentage value, might need scaling
    if (formatType.includes('10K')) {
      // Per-10000 format: multiply by 100 to get per-10000 value
      value = value * 10000;
    } else if (formatType.includes('Hd') || formatType.includes('HD')) {
      // Per-100 format: multiply by 100 to get per-100 value
      value = value * 100;
    }
  }

  // Get stat key from EffectTypeFirstSubtype
  const effectSubtype = (effectValue as any).EffectTypeFirstSubtype;
  if (effectSubtype === undefined) {
    return null;
  }

  const statKey = getAttrKeyFromEnumId(effectSubtype);
  if (!statKey) {
    console.warn(`[DmgCalc] Unknown effect subtype ${effectSubtype} for potential ${potentialName}`);
    return null;
  }

  effects.push({
    statKey,
    value,
    source: `잠재력: ${potentialName}`,
    effectType: (effectValue as any).EffectType || 0,
    effectSubtype,
    isConditional: false // TODO: Detect conditional effects
  });

  return effects.length > 0 ? effects : null;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get potential display name
 */
function getPotentialName(potId: string, position: Position): string {
  // Try window.state.potentialNames first
  if (window.state?.potentialNames?.[potId]) {
    return window.state.potentialNames[potId];
  }

  // Try GameData
  const potential = window.state?.potentials?.[potId as any];
  if (potential) {
    const nameKey = (potential as any).Name;
    if (nameKey && GameData.potentialsKR) {
      return GameData.potentialsKR[nameKey] || `Potential ${potId}`;
    }
  }

  // Include position in fallback name
  const positionLabel = position === 'master' ? '주력' : position === 'assist1' ? '지원1' : '지원2';
  return `잠재력 ${potId} (${positionLabel})`;
}

/**
 * Get all potential effects for the entire party
 */
export function parseAllPartyPotentialEffects(): PotentialEffect[] {
  const allEffects: PotentialEffect[] = [];

  // Parse potentials from all three character positions
  const positions: Position[] = ['master', 'assist1', 'assist2'];

  positions.forEach(position => {
    const effects = parsePotentialEffects(position);
    allEffects.push(...effects);
  });

  return allEffects;
}

/**
 * Convert potential effects to stat sources for aggregation
 */
export function convertPotentialEffectsToStatSources(
  potentialEffects: PotentialEffect[]
): Array<{ statKey: string; source: string; value: number; character: Position }> {
  const statSources: Array<{ statKey: string; source: string; value: number; character: Position }> = [];

  potentialEffects.forEach(potential => {
    potential.effects.forEach(effect => {
      statSources.push({
        statKey: effect.statKey,
        source: effect.source,
        value: effect.value,
        character: potential.character
      });
    });
  });

  return statSources;
}
