/**
 * Damage Calculator - Potential HitDamage Parsing
 * Parses HitDamage parameters from potentials and treats them as additional damage skills
 *
 * @module dmgcalc/core/potential-hitdamage
 */

import { GameData } from '@/shared/game-data';
import type { Position, HitDamageEntry } from '../types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Additional damage skill from potential HitDamage
 */
export interface PotentialHitDamageSkill {
  /** Source potential ID */
  potentialId: number;

  /** Potential name */
  potentialName: string;

  /** Potential level */
  level: number;

  /** Character position */
  character: Position;

  /** Parsed HitDamage entries */
  hitDamages: HitDamageEntry[];

  /** Skill type classification */
  skillType: 'potential_damage';

  /** Damage type (from HitDamage.DamageType) */
  damageType: number;

  /** Element type (from HitDamage.ElementType) */
  elementType: number;

  /** Source type (from HitDamage.SourceType) */
  sourceType: number;
}

// =============================================================================
// HIT DAMAGE PARSING FROM POTENTIALS
// =============================================================================

/**
 * Parse HitDamage parameters from a potential
 *
 * Format: "HitDamage,DamageNum,{hitDamageId}"
 * or: "HitDamage,LevelUp,{baseId}"
 */
export function parseHitDamageFromPotential(
  potentialId: number,
  potential: any,
  level: number,
  position: Position
): PotentialHitDamageSkill | null {
  const hitDamages: HitDamageEntry[] = [];

  // Check all parameters for HitDamage
  for (let i = 1; i <= 10; i++) {
    const paramKey = `Param${i}` as keyof typeof potential;
    const paramValue = potential[paramKey];

    if (!paramValue || typeof paramValue !== 'string') continue;

    // Check if this is a HitDamage parameter
    if (!paramValue.toLowerCase().includes('hitdamage')) continue;

    const hitDamageEntry = parseHitDamageParameter(paramValue, level);
    if (hitDamageEntry) {
      hitDamages.push(hitDamageEntry);
    }
  }

  if (hitDamages.length === 0) {
    return null;
  }

  // Get potential name
  const potentialName = getPotentialName(String(potentialId), position);

  // Use first HitDamage for classification
  const firstHit = hitDamages[0];
  if (!firstHit) {
    return null;
  }

  return {
    potentialId,
    potentialName,
    level,
    character: position,
    hitDamages,
    skillType: 'potential_damage',
    damageType: firstHit.raw.DamageType || 0,
    elementType: firstHit.raw.ElementType || 0,
    sourceType: firstHit.raw.SourceType || 1
  };
}

/**
 * Parse a single HitDamage parameter
 */
function parseHitDamageParameter(
  paramStr: string,
  level: number
): HitDamageEntry | null {
  // Split parameter string: "HitDamage,DamageNum,{hitDamageId}"
  const parts = paramStr.split(',');
  if (parts.length < 3) return null;

  const fileType = parts[0];
  const levelType = parts[1];
  const baseIdStr = parts[2];

  if (!fileType || !levelType || !baseIdStr) return null;

  // Normalize file type
  const normalizedFileType = fileType.toLowerCase().trim();
  if (normalizedFileType !== 'hitdamage') {
    return null;
  }

  // Calculate actual HitDamage ID based on level type
  let hitDamageId = baseIdStr;

  switch (levelType) {
    case 'LevelUp':
      // For LevelUp: ID = baseId + (level * 10)
      const baseId = parseInt(baseIdStr, 10);
      if (!isNaN(baseId)) {
        hitDamageId = String(baseId + (level * 10));
      }
      break;

    case 'DamageNum':
      // DamageNum uses base ID directly (or with special logic)
      // For now, use base ID
      hitDamageId = baseIdStr;
      break;

    case 'NoLevel':
      // Direct ID lookup
      hitDamageId = baseIdStr;
      break;

    default:
      console.warn(`[DmgCalc] Unknown level type for HitDamage: ${levelType}`);
  }

  // Look up the HitDamage in game data
  const hitDamageData = GameData.hitDamage?.[hitDamageId];
  if (!hitDamageData) {
    console.warn(`[DmgCalc] HitDamage ${hitDamageId} not found`);
    return null;
  }

  const hdData = hitDamageData as any;

  // Extract damage values
  const skillPercent = (hdData.SkillPercent || 0) / 100;
  const skillAbs = hdData.SkillAbs || 0;

  return {
    id: hitDamageId,
    displayName: hdData.HitdamageInfo || `Hit Damage ${hitDamageId}`,
    skillPercent,
    skillAbs,
    sourceType: hdData.SourceType,
    damageType: hdData.DamageType,
    effectType: hdData.EffectType,
    elementType: hdData.ElementType,
    element: getElementName(hdData.ElementType),
    hitType: getDamageTypeName(hdData.DamageType),
    raw: hdData
  };
}

/**
 * Parse all HitDamage skills from potentials for the entire party
 */
export function parseAllPartyPotentialHitDamages(): PotentialHitDamageSkill[] {
  const allSkills: PotentialHitDamageSkill[] = [];

  const positions: Position[] = ['master', 'assist1', 'assist2'];

  positions.forEach(position => {
    const skills = parsePotentialHitDamagesForPosition(position);
    allSkills.push(...skills);
  });

  return allSkills;
}

/**
 * Parse HitDamage skills from potentials for a specific position
 */
function parsePotentialHitDamagesForPosition(position: Position): PotentialHitDamageSkill[] {
  const skills: PotentialHitDamageSkill[] = [];

  // Get selected potentials for this position
  const selectedPotentials = window.state?.selectedPotentials?.[position];
  if (!selectedPotentials || selectedPotentials.length === 0) {
    return skills;
  }

  // Get potential levels
  const potentialLevels = window.state?.potentialLevels?.[position] || {};

  // Process each selected potential
  selectedPotentials.forEach(potId => {
    if (!potId) return;

    const level = potentialLevels[potId] || 1;
    const potential = window.state?.potentials?.[potId];

    if (!potential) {
      return;
    }

    const skill = parseHitDamageFromPotential(potId, potential, level, position);
    if (skill) {
      skills.push(skill);
    }
  });

  return skills;
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
 * Get element name from element type
 */
function getElementName(elementType: number): string {
  const elementMap: Record<number, string> = {
    1: 'Physical',
    2: 'Fire',
    3: 'Ice',
    4: 'Wind',
    5: 'Electric',
    6: 'Water',
    7: 'Light',
    8: 'Dark'
  };
  return elementMap[elementType] || 'Unknown';
}

/**
 * Get damage type name
 */
function getDamageTypeName(damageType: number): string {
  const damageTypeMap: Record<number, string> = {
    1: 'Normal',
    2: 'Skill',
    3: 'Ultimate',
    4: 'DoT',
    5: 'Additional'
  };
  return damageTypeMap[damageType] || 'Unknown';
}
