/**
 * Damage Calculator - Buff System
 * Auto-detection and management of buffs from potentials and skills
 *
 * @module dmgcalc/core/buffs
 */

import { GameData } from '@/shared/game-data';
import { getState } from './state';
import type { BuffSource, BuffEntry, EffectEntry } from '../types';

// =============================================================================
// BUFF COLLECTION
// =============================================================================

/**
 * Collect all buffs from the current build
 * Scans potentials and skills from all characters
 */
export function collectBuffsFromBuild(): BuffSource[] {
  const buffs: BuffSource[] = [];

  if (!window.state?.party) return buffs;

  const { master, assist1, assist2 } = window.state.party;

  // Collect from master character
  if (master && typeof master !== 'string') {
    const masterBuffs = collectBuffsFromCharacter(master, 'master');
    buffs.push(...masterBuffs);
  }

  // Collect from assist1
  if (assist1 && typeof assist1 !== 'string') {
    const assist1Buffs = collectBuffsFromCharacter(assist1, 'assist1');
    buffs.push(...assist1Buffs);
  }

  // Collect from assist2
  if (assist2 && typeof assist2 !== 'string') {
    const assist2Buffs = collectBuffsFromCharacter(assist2, 'assist2');
    buffs.push(...assist2Buffs);
  }

  // TODO: Collect from disc skills (main discs have active skills that can buff)

  return buffs;
}

/**
 * Collect buffs from a single character's potentials
 */
function collectBuffsFromCharacter(
  character: any,
  position: 'master' | 'assist1' | 'assist2'
): BuffSource[] {
  const buffs: BuffSource[] = [];
  const charId = character.id;

  // Get selected potentials for this character
  const selectedPotentials = window.state?.selectedPotentials?.[position] || [];
  const potentialLevels = window.state?.potentialLevels?.[position] || {};

  selectedPotentials.forEach((potId: number) => {
    const level = potentialLevels[potId] || 1;

    // Get potential data - try both GameData and window.state
    const potential = GameData.potentials?.[potId] || window.state?.potentials?.[potId];
    if (!potential) {
      // Silently skip missing potentials
      return;
    }

    // Get skill data from potential
    const skillId = potential.SkillId;
    if (!skillId) return;

    // Ensure skillId is a valid index type
    const skill = GameData.skills?.[skillId as number];
    if (!skill) return;

    // Get skill description to parse buffs
    const skillDescRaw = skill.desc;
    if (!skillDescRaw) return;

    // Parse buffs from skill description
    const buffEntries = parseBuffsFromSkillDescription(skillDescRaw, level, String(skillId));

    // Convert BuffEntry to BuffSource
    buffEntries.forEach((buffEntry, index) => {
      const potentialName = potential.Name || `Potential ${potId}`;

      buffs.push({
        id: `${position}-pot-${potId}-buff-${index}`,
        name: `${potentialName} - ${buffEntry.displayName}`,
        description: generateBuffDescription(buffEntry),
        values: extractStatValuesFromBuff(buffEntry),
        active: true, // Default to active
        category: 'potential',
        character: position
      });
    });

    // Also parse effects (stat increases) from the potential
    const effectEntries = parseEffectsFromSkillDescription(skillDescRaw, level, String(skillId));

    effectEntries.forEach((effectEntry, index) => {
      const potentialName = potential.Name || `Potential ${potId}`;

      buffs.push({
        id: `${position}-pot-${potId}-effect-${index}`,
        name: `${potentialName} - ${effectEntry.targetStat}`,
        description: `+${effectEntry.value} ${effectEntry.targetStat}`,
        values: { [effectEntry.targetStat]: effectEntry.value },
        active: true,
        category: 'potential',
        character: position
      });
    });
  });

  return buffs;
}

// =============================================================================
// BUFF PARSING
// =============================================================================

/**
 * Parse buff parameters from skill description
 * Similar to parseBuffParams in skills.ts but simpler
 */
function parseBuffsFromSkillDescription(
  skillDesc: string,
  skillLevel: number,
  skillId: string
): BuffEntry[] {
  const buffs: BuffEntry[] = [];

  try {
    // Extract buff parameters (format: "buff,LevelType,BaseId")
    const buffMatches = skillDesc.match(/buff,[^#]+/g);
    if (!buffMatches) return buffs;

    buffMatches.forEach((param, index) => {
      try {
        // Calculate buff ID based on level
        const buffId = calculateBuffId(param, skillLevel);

        // Get buff data
        const buffData = GameData.buffValue?.[buffId];
        if (!buffData) return;

        buffs.push({
          id: buffId.toString(),
          displayName: `Buff ${index + 1}`,
          duration: (buffData as any).Duration || 0,
          stacks: (buffData as any).MaxStack || 1,
          values: buffData as any,
          raw: buffData
        });
      } catch (error) {
        console.warn(`[DmgCalc] Error parsing buff: ${param}`, error);
      }
    });
  } catch (error) {
    console.warn(`[DmgCalc] Error parsing buffs from skill ${skillId}`, error);
  }

  return buffs;
}

/**
 * Parse effect parameters from skill description
 * Effects are direct stat increases
 */
function parseEffectsFromSkillDescription(
  skillDesc: string,
  skillLevel: number,
  skillId: string
): EffectEntry[] {
  const effects: EffectEntry[] = [];

  try {
    // Extract effect parameters (format: "effect,LevelType,BaseId")
    const effectMatches = skillDesc.match(/effect,[^#]+/g);
    if (!effectMatches) return effects;

    effectMatches.forEach((param, index) => {
      try {
        // Calculate effect ID based on level
        const effectId = calculateEffectId(param, skillLevel);

        // Get effect data
        const effectData = GameData.effectValue?.[effectId];
        if (!effectData) return;

        // Map EffectTypeFirstSubtype to stat name
        const effectType = (effectData as any).EffectTypeFirstSubtype || 0;
        const targetStat = mapEffectTypeToStat(effectType);
        const value = (effectData as any).Value || 0;

        if (targetStat && value !== 0) {
          effects.push({
            id: effectId.toString(),
            displayName: `Effect ${index + 1}`,
            effectType: effectType.toString(),
            targetStat,
            value,
            raw: effectData
          });
        }
      } catch (error) {
        console.warn(`[DmgCalc] Error parsing effect: ${param}`, error);
      }
    });
  } catch (error) {
    console.warn(`[DmgCalc] Error parsing effects from skill ${skillId}`, error);
  }

  return effects;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Calculate buff ID from parameter string
 * Format: "buff,LevelUp,90201" at level 3 → 90231
 */
function calculateBuffId(param: string, level: number): number {
  const parts = param.split(',');
  if (parts.length < 3) return 0;

  const levelType = parts[1];
  const baseId = parseInt(parts[2] || '0', 10);

  if (levelType === 'LevelUp') {
    return baseId + (level * 10);
  } else if (levelType === 'NoLevel') {
    return baseId;
  }

  return baseId;
}

/**
 * Calculate effect ID from parameter string
 */
function calculateEffectId(param: string, level: number): number {
  const parts = param.split(',');
  if (parts.length < 3) return 0;

  const levelType = parts[1];
  const baseId = parseInt(parts[2] || '0', 10);

  if (levelType === 'LevelUp') {
    return baseId + (level * 10);
  } else if (levelType === 'NoLevel') {
    return baseId;
  }

  return baseId;
}

/**
 * Map EffectTypeFirstSubtype to stat name
 * Based on game enum mappings
 */
function mapEffectTypeToStat(effectType: number): string {
  const map: Record<number, string> = {
    101: 'Atk',
    102: 'Def',
    103: 'Hp',
    201: 'CritRate',
    202: 'CritPower',
    301: 'PhyEE',    // Physical Elemental Enhancement
    302: 'EtherEE',  // Ether
    303: 'FrostEE',  // Frost/Ice
    304: 'ElectricEE', // Electric
    305: 'FlameEE',  // Flame/Fire
    306: 'WindEE',   // Wind
    307: 'LightEE',  // Light
    308: 'DarkEE',   // Dark
    // Add more mappings as needed
  };

  return map[effectType] || '';
}

/**
 * Extract stat values from buff entry
 * Buffs affect various stats - extract the relevant ones
 */
function extractStatValuesFromBuff(buffEntry: BuffEntry): Record<string, number> {
  const values: Record<string, number> = {};

  // Buffs can contain multiple stat modifications
  // For now, return empty - will need proper parsing based on buff structure
  // TODO: Parse buff effects properly

  return values;
}

/**
 * Generate human-readable description for buff
 */
function generateBuffDescription(buffEntry: BuffEntry): string {
  let desc = '';

  if (buffEntry.duration > 0) {
    desc += `지속시간: ${(buffEntry.duration / 1000).toFixed(1)}초`;
  }

  if (buffEntry.stacks && buffEntry.stacks > 1) {
    desc += ` | 최대 중첩: ${buffEntry.stacks}`;
  }

  return desc || '버프';
}

// =============================================================================
// BUFF APPLICATION
// =============================================================================

/**
 * Apply active buffs to a stat map
 * Called during stat calculation
 */
export function applyActiveBuffsToStats(stats: Map<string, any>): void {
  const state = getState();

  state.buffs
    .filter(buff => buff.active)
    .forEach(buff => {
      Object.entries(buff.values).forEach(([statKey, value]) => {
        const stat = stats.get(statKey);
        if (stat) {
          // Add buff value as a source
          stat.sources.push({
            source: buff.name,
            value,
            active: true
          });
        }
      });
    });
}

/**
 * Initialize buff system
 * Call this during aggregateStatsFromBuild
 */
export function initializeBuffs(): void {
  const state = getState();

  // Collect all buffs from build
  const collectedBuffs = collectBuffsFromBuild();

  // Update state with collected buffs
  // Preserve active state of existing buffs if IDs match
  const existingBuffMap = new Map(state.buffs.map(b => [b.id, b.active]));

  state.buffs = collectedBuffs.map(buff => ({
    ...buff,
    active: existingBuffMap.has(buff.id) ? existingBuffMap.get(buff.id)! : buff.active
  }));
}
