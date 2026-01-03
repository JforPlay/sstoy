/**
 * Damage Calculator - Skill Parsing
 * Fetches and parses skill data including HitDamage, Buff, and Effect parameters
 *
 * @module dmgcalc/core/skills
 */

import { parseParamValue, parseDescriptionParams } from '@/modules/param-parser';
import { GameData } from '@/shared/game-data';
import type {
  SkillParameterData,
  HitDamageEntry,
  BuffEntry,
  EffectEntry,
  ParamParserState
} from '../types';
import { DEFAULT_SKILL_PERCENT, EFFECT_TYPE_TO_STAT } from '../constants';

// =============================================================================
// MAIN SKILL FETCHING
// =============================================================================

/**
 * Fetches character skill data and parses all parameters
 * @param skillType - 'normalAtk', 'skill', or 'ultimate'
 * @param character - Which character position (default: 'master')
 * @returns Parsed skill parameter data
 */
export function fetchSkillData(
  skillType: 'normalAtk' | 'skill' | 'ultimate',
  character: 'master' | 'assist1' | 'assist2' = 'master'
): SkillParameterData | null {
  const charData = getCharacterData(character);
  if (!charData) return null;

  // Get skill ID based on type
  let skillId: number | undefined;
  if (skillType === 'normalAtk') {
    skillId = charData.NormalAtkId;
  } else if (skillType === 'skill') {
    skillId = charData.SkillId;
  } else if (skillType === 'ultimate') {
    skillId = charData.UltimateId;
  }

  if (!skillId) return null;

  // Get skill data
  const skillData = GameData.skills?.[skillId];
  if (!skillData) return null;

  // Get skill level from state
  const skillLevel = window.state?.skillLevels?.[character]?.[skillId] || 1;

  // Get skill name
  const skillNameKey = (skillData as any).Name || `Skill.${skillId}.1`;
  const skillName = GameData.skillsKR?.[skillNameKey] || `Skill ${skillId}`;

  // Get skill description (raw with &Param1& placeholders)
  const skillDescKey = (skillData as any).Desc || `Skill.${skillId}.2`;
  const skillDescRaw = GameData.skillsKR?.[skillDescKey] || '';

  // Parse skill description to replace &Param1& with actual values
  const skillParams: Record<string, string> = {};
  const skillDataAny = skillData as any;
  for (let i = 1; i <= 10; i++) {
    const paramKey = `Param${i}`;
    if (skillDataAny[paramKey]) {
      skillParams[paramKey] = skillDataAny[paramKey];
    }
  }

  // Use parseDescriptionParams to replace parameters in description
  const parserState = createParserState();
  const skillDesc = parseDescriptionParams(
    skillDescRaw,
    skillParams,
    skillLevel,
    skillLevel,
    parserState,
    character
  );

  // Get skill icons
  const skillIcon = extractFilename((skillData as any).Icon || '');
  const skillIconBg = extractFilename((skillData as any).IconBg || '');

  // Parse all parameters
  const hitDamages = parseHitDamageParams(skillData, skillLevel, skillDescRaw);
  const buffs = parseBuffParams(skillData, skillLevel, skillDescRaw);
  const effects = parseEffectParams(skillData, skillLevel, skillDescRaw);
  const otherParams = parseOtherParams(skillData, skillLevel, skillDescRaw);

  return {
    skillId: String(skillId),
    skillName,
    skillDesc,
    skillIcon,
    skillIconBg,
    skillLevel,
    hitDamages,
    buffs,
    effects,
    otherParams
  };
}

// =============================================================================
// HIT DAMAGE PARSING
// =============================================================================

/**
 * Parses HitDamage parameters from skill data
 * HitDamage references are stored in Param1-Param10 fields
 * Format: "HitDamage,DamageNum,BaseId" or "HitDamage,LevelUp,BaseId"
 */
function parseHitDamageParams(
  skillData: any,
  skillLevel: number,
  skillDesc: string
): HitDamageEntry[] {
  const hitDamages: HitDamageEntry[] = [];

  // Check Param1 through Param10 for HitDamage references
  for (let i = 1; i <= 10; i++) {
    const paramKey = `Param${i}`;
    const paramValue = skillData[paramKey];

    if (!paramValue || typeof paramValue !== 'string') continue;

    // Check if this param is a HitDamage reference
    const lowerParam = paramValue.toLowerCase();
    if (!lowerParam.startsWith('hitdamage,') && !lowerParam.startsWith('damage,')) continue;

    try {
      // Get the hit damage ID to access raw data first
      const hitDamageId = calculateParamId(paramValue, skillLevel);

      if (!hitDamageId || !GameData.hitDamage) continue;

      const hitEntry = GameData.hitDamage[hitDamageId];

      if (!hitEntry) continue;

      const hitData = hitEntry as any;

      // Use parseParamValue to get the formatted damage string
      const parserState = createParserState();
      const parsedValue = parseParamValue(
        paramValue,
        skillLevel,
        skillLevel,
        'master',
        parserState
      );

      // Parse the formatted string (e.g., "10.2%" or "25.5% + 100")
      let skillPercent = 0;
      let skillAbs = 0;

      if (parsedValue && parsedValue.value) {
        const valueStr = String(parsedValue.value);
        const parts = valueStr.split('+').map(p => p.trim());

        // First part is usually the percentage
        if (parts[0] && parts[0].includes('%')) {
          skillPercent = parseFloat(parts[0].replace('%', ''));
        }

        // Second part (if exists) is the absolute value
        if (parts[1]) {
          skillAbs = parseFloat(parts[1]);
        }
      }

      // Extract type information for damage calculation
      const sourceType = hitData.SourceType; // 1=Character, 2=Summon, etc.
      const damageType = hitData.DamageType; // 1=Normal, 2=Skill, 3=Ultimate
      const effectType = hitData.EffectType;
      const elementType = hitData.ElementType; // 1=Physical, 2=Fire, 3=Ice, etc.

      // Simple display name: Hit 1, Hit 2, etc.
      const displayName = `Hit ${hitDamages.length + 1}`;

      hitDamages.push({
        id: hitDamageId,
        displayName,
        skillPercent, // Already formatted as percentage
        skillAbs,
        sourceType,
        damageType,
        effectType,
        elementType,
        element: elementType ? String(elementType) : undefined,
        hitType: damageType ? String(damageType) : undefined,
        raw: hitEntry
      });

      console.log(
        `[DmgCalc] Parsed HitDamage ${hitDamageId}: ${displayName}, ` +
        `Param: "${paramValue}", ParsedValue: "${parsedValue.value}", ` +
        `Level ${skillLevel}, SkillPercent: ${skillPercent}%, SkillAbs: ${skillAbs}, ` +
        `SourceType: ${sourceType}, DamageType: ${damageType}, ElementType: ${elementType}`
      );
    } catch (error) {
      console.warn(`[DmgCalc] Error parsing HitDamage param ${paramKey}: ${paramValue}`, error);
    }
  }

  return hitDamages;
}

// =============================================================================
// BUFF PARSING
// =============================================================================

/**
 * Parses Buff parameters from skill data
 * Buffs have duration which is important for DPS calculations
 */
function parseBuffParams(
  skillData: any,
  skillLevel: number,
  skillDesc: string
): BuffEntry[] {
  const buffs: BuffEntry[] = [];

  // Check for Buff parameters in skill description
  const buffParams = extractParamsFromDesc(skillDesc, 'buff');

  buffParams.forEach((param, index) => {
    try {
      const buffData = parseParamValue(
        param,
        skillLevel,
        skillLevel,
        'master',
        window.state as any
      );

      if (buffData && GameData.buffValue) {
        const buffId = calculateParamId(param, skillLevel);
        const buffEntry = GameData.buffValue[buffId];

        if (buffEntry) {
          const duration = (buffEntry as any).Duration || 0;
          const stacks = (buffEntry as any).MaxStack;

          buffs.push({
            id: buffId,
            displayName: `Buff ${index + 1}`,
            duration: duration / 1000, // Convert to seconds
            stacks: stacks || undefined,
            values: buffEntry as any,
            raw: buffEntry
          });
        }
      }
    } catch (error) {
      console.warn(`[DmgCalc] Error parsing Buff param: ${param}`, error);
    }
  });

  return buffs;
}

// =============================================================================
// EFFECT PARSING
// =============================================================================

/**
 * Parses Effect parameters from skill data
 * Effects modify stats - EffectTypeFirstSubtype enum determines which stat
 */
function parseEffectParams(
  skillData: any,
  skillLevel: number,
  skillDesc: string
): EffectEntry[] {
  const effects: EffectEntry[] = [];

  // Check for Effect parameters in skill description
  const effectParams = extractParamsFromDesc(skillDesc, 'effect');

  effectParams.forEach((param, index) => {
    try {
      const effectData = parseParamValue(
        param,
        skillLevel,
        skillLevel,
        'master',
        window.state as any
      );

      if (effectData && GameData.effectValue) {
        const effectId = calculateParamId(param, skillLevel);
        const effectEntry = GameData.effectValue[effectId];

        if (effectEntry) {
          const effectType = (effectEntry as any).EffectTypeFirstSubtype;
          const value = (effectEntry as any).Value || 0;

          // Map effect type to target stat
          const targetStat = mapEffectTypeToStat(effectType);

          effects.push({
            id: effectId,
            displayName: `Effect ${index + 1}`,
            effectType: effectType ? String(effectType) : 'unknown',
            targetStat,
            value,
            raw: effectEntry
          });
        }
      }
    } catch (error) {
      console.warn(`[DmgCalc] Error parsing Effect param: ${param}`, error);
    }
  });

  return effects;
}

// =============================================================================
// OTHER PARAMETERS
// =============================================================================

/**
 * Parses other parameters found in skill description
 */
function parseOtherParams(
  skillData: any,
  skillLevel: number,
  skillDesc: string
): Record<string, any> {
  const otherParams: Record<string, any> = {};

  // Extract all &Param1& through &Param10& references
  const paramMatches = skillDesc.matchAll(/&Param(\d+)&/g);

  for (const match of paramMatches) {
    const paramNum = parseInt(match[1] || '0');
    if (paramNum >= 1 && paramNum <= 10) {
      const paramKey = `Param${paramNum}`;
      const paramValue = (skillData as any)[paramKey];

      if (paramValue) {
        try {
          const parsedValue = parseParamValue(
            paramValue,
            skillLevel,
            skillLevel,
            'master',
            window.state as any
          );
          otherParams[paramKey] = {
            raw: paramValue,
            parsed: parsedValue
          };
        } catch (error) {
          console.warn(`[DmgCalc] Error parsing ${paramKey}:`, error);
        }
      }
    }
  }

  return otherParams;
}

// =============================================================================
// EFFECT AGGREGATION
// =============================================================================

/**
 * Aggregates slotDmg multiplier from Effect parameters
 * EffectTypeFirstSubtype determines what type of damage buff it is
 */
export function aggregateSlotDmgFromEffects(effects: EffectEntry[]): number {
  let slotDmg = 1; // Base multiplier is 1 (100%)

  effects.forEach(effect => {
    // Check if this effect is a damage increase buff
    // For now, we'll assume effects with positive values are damage buffs
    if (effect.value > 0) {
      // Convert value to multiplier (assuming value is in percentage * 100)
      // e.g., value 2000 = 20% = 0.20 multiplier
      slotDmg *= (1 + effect.value / 10000);
    }
  });

  return slotDmg;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extracts parameter strings of a specific type from skill description
 */
function extractParamsFromDesc(desc: string, type: string): string[] {
  const params: string[] = [];
  const regex = new RegExp(`${type},[^&]+`, 'gi');
  const matches = desc.matchAll(regex);

  for (const match of matches) {
    params.push(match[0]);
  }

  return params;
}

/**
 * Calculates the actual ID for a parameter based on level
 */
function calculateParamId(paramString: string, level: number): string {
  const parts = paramString.split(',');
  if (parts.length < 3) return '';

  const levelType = parts[1];
  const baseId = parseInt(parts[2] || '0');

  if (levelType === 'LevelUp') {
    return String(baseId + (level * 10));
  } else if (levelType === 'NoLevel') {
    return String(baseId);
  }

  return String(baseId);
}

/**
 * Maps EffectTypeFirstSubtype enum to stat key
 * TODO: Complete this mapping based on actual game data (Requirement #4)
 */
function mapEffectTypeToStat(effectType: number | undefined): string {
  if (!effectType) return 'unknown';

  return EFFECT_TYPE_TO_STAT[effectType] || 'unknown';
}

/**
 * Extracts filename from a file path
 */
function extractFilename(path: string): string {
  if (!path) return '';
  const parts = path.split('/');
  return parts[parts.length - 1] || '';
}

/**
 * Get character data for a specific position
 */
function getCharacterData(position: 'master' | 'assist1' | 'assist2'): any | null {
  const character = window.state?.party?.[position];
  if (!character || typeof character === 'string') return null;

  const charData = GameData.characters?.[character.id];
  return charData || null;
}

/**
 * Creates a ParamParserState structure from window.state for param parsing
 */
function createParserState(): ParamParserState {
  return {
    effectValue: GameData.effectValue || {},
    buffValue: GameData.buffValue || {},
    shieldValue: GameData.shieldValue || {},
    hitDamage: GameData.hitDamage || {},
    onceAdditionalAttributeValue: GameData.onceAdditionalAttributeValue || {},
    scriptParameterValue: GameData.scriptParameterValue || {},
    skills: GameData.skills || {},
    talents: GameData.talents || {},
    potentials: GameData.potentials || {},
    characters: GameData.characters || {},
    discs: GameData.discs || {},
    party: window.state?.party || { master: null, assist1: null, assist2: null },
    selectedPotentials: window.state?.selectedPotentials || { master: [], assist1: [], assist2: [] },
    potentialLevels: window.state?.potentialLevels || { master: {}, assist1: {}, assist2: {} },
    skillLevels: window.state?.skillLevels || { master: {}, assist1: {}, assist2: {} },
    characterLevelPhase: window.state?.characterLevelPhase || { master: 1, assist1: 1, assist2: 1 }
  } as ParamParserState;
}
