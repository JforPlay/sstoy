/**
 * Skill Parsing for Damage Calculator
 *
 * Fetches skill data from Character -> Skill -> HitDamage chain and returns
 * structured SkillParameterData for the damage formula.
 *
 * Conversion note:
 *   HitDamage.SkillPercentAmend stores values in per-10000 format.
 *   e.g. 1720000 raw -> divide by 10000 -> 172.0 (percentage of ATK).
 *   calc.ts then divides by 100 to get the actual multiplier (1.72).
 *
 * @module dmgcalc/core/skills
 */

import { GameData } from '@/shared/game-data';
import type { SkillParameterData, HitDamageEntry, SkillType } from '../types';

// Skill type -> Character.json field mapping
const SKILL_TYPE_TO_FIELD: Record<SkillType, string> = {
  normalAtk: 'NormalAtkId',
  skill: 'SkillId',
  ultimate: 'UltimateId',
};

// =============================================================================
// MAIN API
// =============================================================================

/**
 * Get parsed skill data for a character's skill type at a given level.
 *
 * @param charId     - Character ID (from Character.json)
 * @param skillType  - 'normalAtk' | 'skill' | 'ultimate'
 * @param skillLevel - 1-based skill level (indexes SkillPercentAmend array)
 * @returns Parsed skill data or null if not found
 */
export function getSkillData(
  charId: number | string,
  skillType: SkillType,
  skillLevel: number,
  limitBreak: number = 0
): SkillParameterData | null {
  // 1. Resolve character -> skill ID
  const charData = GameData.characters?.[charId];
  if (!charData) return null;

  const field = SKILL_TYPE_TO_FIELD[skillType];
  const skillId = (charData as any)[field] as number | undefined;
  if (!skillId) return null;

  // 2. Load skill entry
  const skill = GameData.skills?.[skillId] as any;
  if (!skill) return null;

  // 3. Resolve localized name (Skill.json uses "Title" not "Name")
  const nameKey = skill.Title || skill.Name || `Skill.${skillId}.1`;
  const skillName = GameData.skillsKR?.[nameKey] || `Skill ${skillId}`;

  // 4. Resolve description (raw, with &Param& placeholders)
  const descKey = skill.Desc || `Skill.${skillId}.2`;
  const skillDesc = GameData.skillsKR?.[descKey] || '';

  // 5. Icon
  const skillIcon = extractFilename(skill.Icon || '');

  // 6. Determine max level from skill data (default 12)
  const maxLevel = skill.MaxLevel || 12;

  // 7. Parse Param1-Param10 for HitDamage, BuffValue, EffectValue references
  const hitDamages: HitDamageEntry[] = [];
  const buffParams: any[] = [];
  const effectParams: any[] = [];

  for (let i = 1; i <= 10; i++) {
    const paramValue = skill[`Param${i}`];
    if (!paramValue || typeof paramValue !== 'string') continue;

    const lower = paramValue.toLowerCase();

    if (lower.startsWith('hitdamage,') || lower.startsWith('damage,')) {
      const entry = parseHitDamageParam(paramValue, skillLevel, limitBreak);
      if (entry) hitDamages.push(entry);
    } else if (lower.startsWith('buffvalue,') || lower.startsWith('buff,')) {
      buffParams.push({ raw: paramValue, index: i });
    } else if (lower.startsWith('effectvalue,') || lower.startsWith('effect,')) {
      effectParams.push({ raw: paramValue, index: i });
    }
  }

  return {
    skillId,
    skillName,
    skillIcon,
    skillDesc,
    skillType: skillTypeToEnum(skillType),
    maxLevel,
    hitDamages,
    buffParams,
    effectParams,
  };
}

/**
 * Legacy compatibility wrapper used by calc.ts.
 * Returns an extended object with `effects`, `skillLevel`, `skillIconBg`,
 * `otherParams`, and `buffs` fields that calc.ts still references.
 */
export function fetchSkillData(
  skillType: SkillType,
  character: 'master' | 'assist1' | 'assist2' = 'master'
): (SkillParameterData & { effects: any[]; skillLevel: number; skillIconBg: string; otherParams: any; buffs: any[] }) | null {
  const charObj = window.state?.party?.[character];
  if (!charObj || typeof charObj === 'string') return null;

  const charId = charObj.id;
  const charData = GameData.characters?.[charId];
  if (!charData) return null;

  const field = SKILL_TYPE_TO_FIELD[skillType];
  const skillId = (charData as any)[field] as number | undefined;
  if (!skillId) return null;

  // Resolve current skill level from app state
  const skillLevel = window.state?.skillLevels?.[character]?.[skillId] || 1;

  const data = getSkillData(charId, skillType, skillLevel);
  if (!data) return null;

  // Extend with legacy fields that calc.ts uses
  return {
    ...data,
    effects: data.effectParams,   // calc.ts accesses .effects
    buffs: data.buffParams,       // calc.ts accesses .buffs
    skillLevel,                   // calc.ts accesses .skillLevel
    skillIconBg: '',              // calc.ts may reference .skillIconBg
    otherParams: {},              // calc.ts may reference .otherParams
  };
}

/**
 * Aggregate slotDmg multiplier from effect parameters.
 * Kept for backward compatibility with calc.ts.
 */
export function aggregateSlotDmgFromEffects(effects: any[]): number {
  if (!effects || effects.length === 0) return 1;

  let slotDmg = 1;
  for (const effect of effects) {
    if (effect?.value > 0) {
      slotDmg *= 1 + effect.value / 10000;
    }
  }
  return slotDmg;
}

// =============================================================================
// HIT DAMAGE PARSING
// =============================================================================

/**
 * Parse a single HitDamage parameter string and return a HitDamageEntry.
 *
 * Parameter format: "HitDamage,{levelType},{baseId}"
 * levelType is one of: DamageNum, LevelUp, NoLevel
 *
 * For DamageNum: baseId points directly to a HitDamage entry whose
 *   SkillPercentAmend / SkillAbsAmend are arrays indexed by skill level.
 *
 * For LevelUp: actualId = baseId + (skillLevel * 10)
 *
 * For NoLevel: actualId = baseId
 */
function parseHitDamageParam(paramStr: string, skillLevel: number, limitBreak: number): HitDamageEntry | null {
  const parts = paramStr.split(',');
  if (parts.length < 3) return null;

  const levelType = parts[1]!;
  const baseId = parts[2];

  if (!baseId) return null;

  // For DamageNum, the baseId points directly to the HitDamage entry
  // and SkillPercentAmend is an array indexed by skill level or LB level.
  if (levelType === 'DamageNum') {
    return parseDamageNumEntry(baseId, skillLevel, limitBreak);
  }

  // For LevelUp / NoLevel, resolve the actual ID first
  const actualId = resolveId(baseId, levelType, skillLevel);
  return parseSingleHitDamage(actualId);
}

/**
 * Parse a DamageNum HitDamage entry.
 * SkillPercentAmend and SkillAbsAmend are arrays; index by skill level.
 */
function parseDamageNumEntry(baseId: string, skillLevel: number, limitBreak: number): HitDamageEntry | null {
  const hdData = GameData.hitDamage?.[baseId] as any;
  if (!hdData) return null;

  // Determine array index based on levelTypeData (from game's QueryLevelInfo):
  //   3 (SkillSlot): index by skill level (1-based → 0-based)
  //   4 (BreakCount): index by limitBreak + 1 (game uses nAdvance + 1, 1-based)
  //   Others: default to 0
  let index: number;
  const lType = hdData.levelTypeData;
  if (lType === 4) {
    // BreakCount: indexed by limit break level, 1-based in game → 0-based array
    index = Math.max(0, limitBreak);
  } else if (lType === 3) {
    // SkillSlot: indexed by skill level, 1-based → 0-based
    index = Math.max(0, skillLevel - 1);
  } else {
    index = 0;
  }

  const percentArr = hdData.SkillPercentAmend as number[] | undefined;
  const absArr = hdData.SkillAbsAmend as number[] | undefined;

  if (!percentArr?.length && !absArr?.length) return null;

  // Clamp index
  const maxIdx = Math.max(percentArr?.length ?? 0, absArr?.length ?? 0) - 1;
  index = Math.min(index, maxIdx);

  // SkillPercentAmend is in per-10000 format (1720000 = 172%).
  // We divide by 10000 to get the percentage value (172.0).
  const rawPercent = percentArr?.[index] ?? 0;
  const skillPercent = rawPercent / 10000;

  const skillAbs = absArr?.[index] ?? 0;

  return {
    id: parseInt(baseId, 10) || 0,
    displayName: `Hit ${baseId}`,
    skillPercent,
    skillAbs,
    damageType: hdData.DamageType ?? 1,
    elementType: hdData.ElementType ?? 0,
    energyCharge: hdData.EnergyCharge,
  };
}

/**
 * Parse a single (non-array) HitDamage entry (LevelUp / NoLevel).
 * These entries have scalar SkillPercentAmend or a single-element array.
 */
function parseSingleHitDamage(id: string): HitDamageEntry | null {
  const hdData = GameData.hitDamage?.[id] as any;
  if (!hdData) return null;

  // For LevelUp entries, the value may be a scalar or single-element array
  let rawPercent = 0;
  let rawAbs = 0;

  if (Array.isArray(hdData.SkillPercentAmend)) {
    rawPercent = hdData.SkillPercentAmend[0] ?? 0;
  } else if (typeof hdData.SkillPercentAmend === 'number') {
    rawPercent = hdData.SkillPercentAmend;
  }

  if (Array.isArray(hdData.SkillAbsAmend)) {
    rawAbs = hdData.SkillAbsAmend[0] ?? 0;
  } else if (typeof hdData.SkillAbsAmend === 'number') {
    rawAbs = hdData.SkillAbsAmend;
  }

  // Convert from per-10000 to percentage
  const skillPercent = rawPercent / 10000;

  return {
    id: parseInt(id, 10) || 0,
    displayName: `Hit ${id}`,
    skillPercent,
    skillAbs: rawAbs,
    damageType: hdData.DamageType ?? 1,
    elementType: hdData.ElementType ?? 0,
    energyCharge: hdData.EnergyCharge,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Resolve a parameterized ID using level type.
 */
function resolveId(baseIdStr: string, levelType: string, level: number): string {
  if (levelType === 'LevelUp') {
    const baseId = parseInt(baseIdStr, 10);
    if (!isNaN(baseId)) {
      return String(baseId + level * 10);
    }
  }
  return baseIdStr;
}

/**
 * Map SkillType string to numeric enum used in SkillParameterData.
 */
function skillTypeToEnum(st: SkillType): number {
  switch (st) {
    case 'normalAtk': return 1;
    case 'skill': return 2;
    case 'ultimate': return 3;
    default: return 0;
  }
}

/**
 * Extract filename from a path string (last segment after /).
 */
function extractFilename(path: string): string {
  if (!path) return '';
  const segments = path.split('/');
  return segments[segments.length - 1] || '';
}
