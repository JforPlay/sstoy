/**
 * Damage Calculator - Effect Type Categorization & Parsing
 * Handles proper effect type categorization based on GameEnums
 * Implements Buff → Effect chain parsing
 *
 * @module dmgcalc/core/effects
 */

import { GameData } from '@/shared/game-data';
import type { Position } from '../types';

// =============================================================================
// EFFECT TYPE CATEGORIZATION
// =============================================================================

/**
 * Effect Type Categories based on GameEnums.effectType
 *
 * Reference:
 * - Type 6 (ADDBUFF): 버프 추가 - Add buff
 * - Type 12 (ATTR_FIX): 속성 변경 - Attribute change (stat increase)
 * - Type 45 (HITTED_ADDITIONAL_ATTR_FIX): 명중 시 속성 변경 - On-hit attribute change
 * - Type 42 (ADDSHIELD): 실드 추가 - Add shield
 * - Type 19 (HPRECOVERY): 생명력 회복 - HP recovery
 * - And many more...
 */
export enum EffectCategory {
  /** Stat increases/decreases (EffectType 12, 34, 37, 46) */
  STAT_MODIFICATION = 'stat_modification',

  /** On-hit effects (EffectType 45) */
  ON_HIT = 'on_hit',

  /** Buff-related (EffectType 6, 13, 22, 29, 30) */
  BUFF = 'buff',

  /** Shield-related (EffectType 42) */
  SHIELD = 'shield',

  /** HP recovery/drain (EffectType 19, 27, 28, 43, 44) */
  HP_RECOVERY = 'hp_recovery',

  /** Skill modifications (EffectType 7, 8, 10, 11, 16) */
  SKILL_MODIFICATION = 'skill_modification',

  /** State changes (EffectType 1, 25) */
  STATE_CHANGE = 'state_change',

  /** Cooldown modifications (EffectType 2, 3, 14, 15) */
  COOLDOWN = 'cooldown',

  /** Immunity/defense (EffectType 9, 17, 38, 49) */
  IMMUNITY = 'immunity',

  /** Special effects (resurrection, stealth, etc.) */
  SPECIAL = 'special',

  /** Unknown or uncategorized */
  UNKNOWN = 'unknown'
}

/**
 * Map EffectType to EffectCategory
 */
const EFFECT_TYPE_CATEGORY_MAP: Record<number, EffectCategory> = {
  // Stat modifications
  12: EffectCategory.STAT_MODIFICATION,  // 속성 변경
  34: EffectCategory.STAT_MODIFICATION,  // 특수 속성 변경
  37: EffectCategory.STAT_MODIFICATION,  // 플레이어 속성 변경
  46: EffectCategory.STAT_MODIFICATION,  // 속성 부여

  // On-hit effects
  45: EffectCategory.ON_HIT,  // 명중 시 속성 변경

  // Buff-related
  6: EffectCategory.BUFF,   // 버프 추가
  13: EffectCategory.BUFF,  // 버프 제거
  22: EffectCategory.BUFF,  // 기존 버프 시간 연장
  29: EffectCategory.BUFF,  // 버프 최대 중첩 변경
  30: EffectCategory.BUFF,  // 버프 시간 변경

  // Shield
  42: EffectCategory.SHIELD,  // 실드 추가

  // HP recovery/drain
  19: EffectCategory.HP_RECOVERY,  // 생명력 회복
  27: EffectCategory.HP_RECOVERY,  // 생명력 복구
  28: EffectCategory.HP_RECOVERY,  // 생명력 흡수
  43: EffectCategory.HP_RECOVERY,  // 현재 생명력 비례 감소
  44: EffectCategory.HP_RECOVERY,  // 최대 생명력 비례 감소

  // Skill modifications
  7: EffectCategory.SKILL_MODIFICATION,   // 스킬 레벨 증가
  8: EffectCategory.SKILL_MODIFICATION,   // 스킬 레벨 설정
  10: EffectCategory.SKILL_MODIFICATION,  // 스킬 사용 횟수 증가
  11: EffectCategory.SKILL_MODIFICATION,  // 스킬 횟수 회복
  16: EffectCategory.SKILL_MODIFICATION,  // 자원 소모 없음

  // State changes
  1: EffectCategory.STATE_CHANGE,  // 상태 변경
  25: EffectCategory.STATE_CHANGE, // 태그 추가

  // Cooldown
  2: EffectCategory.COOLDOWN,  // 현재 쿨타임
  3: EffectCategory.COOLDOWN,  // 최대 쿨타임
  14: EffectCategory.COOLDOWN, // 효과 현재 쿨타임 변경
  15: EffectCategory.COOLDOWN, // 효과 최대 쿨타임 변경

  // Immunity
  9: EffectCategory.IMMUNITY,  // 버프 면역
  17: EffectCategory.IMMUNITY, // 피해 면역 횟수 증가
  38: EffectCategory.IMMUNITY, // 사망 면역
  49: EffectCategory.IMMUNITY, // 특정 피해 ID 면역

  // Special
  18: EffectCategory.SPECIAL,  // 효과 동시 발동
  21: EffectCategory.SPECIAL,  // 즉사
  23: EffectCategory.SPECIAL,  // 피격 원소 유형 확장
  24: EffectCategory.SPECIAL,  // 효과 확률 변경
  31: EffectCategory.SPECIAL,  // 부활
  32: EffectCategory.SPECIAL,  // 부활 후 효과
  35: EffectCategory.SPECIAL,  // 장탄수 변경
  36: EffectCategory.SPECIAL,  // 몬스터 속성 변경
  39: EffectCategory.SPECIAL,  // 은신
  40: EffectCategory.SPECIAL,  // 에너지 회복 불가
  41: EffectCategory.SPECIAL,  // 몬스터 패턴 쿨타임 초기화
  47: EffectCategory.SPECIAL,  // 범위 효과 발동
  48: EffectCategory.SPECIAL,  // 패시브 스킬 발동
  50: EffectCategory.SPECIAL,  // 상태 발동 횟수
  51: EffectCategory.SPECIAL,  // 아이템 획득 범위 변경
};

/**
 * Get effect category from effect type
 */
export function getEffectCategory(effectType: number): EffectCategory {
  return EFFECT_TYPE_CATEGORY_MAP[effectType] || EffectCategory.UNKNOWN;
}

/**
 * Check if effect type should be applied to damage calculation
 * Only STAT_MODIFICATION and ON_HIT are directly relevant
 */
export function isEffectRelevantForDamage(effectType: number): boolean {
  const category = getEffectCategory(effectType);
  return (
    category === EffectCategory.STAT_MODIFICATION ||
    category === EffectCategory.ON_HIT
  );
}

// =============================================================================
// PARSED EFFECT STRUCTURES
// =============================================================================

/**
 * Parsed effect from EffectValue
 */
export interface ParsedEffect {
  /** Effect ID */
  id: string;

  /** Effect type (from EffectValue.EffectType) */
  effectType: number;

  /** Effect category */
  category: EffectCategory;

  /** Effect name */
  name: string;

  /** First subtype (usually indicates which stat) */
  effectTypeFirstSubtype: number;

  /** Second subtype (indicates how to apply) */
  effectTypeSecondSubtype: number;

  /** Parameter value (the actual value) */
  effectTypeParam1: string;

  /** Parsed numeric value */
  value: number;

  /** Raw effect data */
  raw: any;
}

/**
 * Parsed buff from BuffValue
 */
export interface ParsedBuff {
  /** Buff ID */
  id: string;

  /** Buff name */
  name: string;

  /** Duration in milliseconds */
  duration: number;

  /** Max stacks */
  maxStacks: number;

  /** Effect IDs associated with this buff */
  effectIds: number[];

  /** Parsed effects */
  effects: ParsedEffect[];

  /** Raw buff data */
  raw: any;
}

// =============================================================================
// BUFF PARSING
// =============================================================================

/**
 * Parse a buff from BuffValue by ID
 */
export function parseBuffById(buffId: number | string): ParsedBuff | null {
  const buff = GameData.buffValue?.[buffId];
  if (!buff) {
    return null;
  }

  const buffData = buff as any;
  const effectIds = buffData.Effects || [];

  // Parse all effects for this buff
  const effects: ParsedEffect[] = [];
  effectIds.forEach((effectId: number) => {
    const parsedEffect = parseEffectById(effectId);
    if (parsedEffect) {
      effects.push(parsedEffect);
    }
  });

  return {
    id: String(buffId),
    name: buffData.Name || `Buff ${buffId}`,
    duration: buffData.Time || 0,
    maxStacks: buffData.LaminatedNum || 1,
    effectIds,
    effects,
    raw: buffData
  };
}

/**
 * Parse an effect from EffectValue by ID
 */
export function parseEffectById(effectId: number | string): ParsedEffect | null {
  const effect = GameData.effectValue?.[effectId];
  if (!effect) {
    // Some effect IDs referenced by buffs don't exist in EffectValue data — this is expected
    return null;
  }

  const effectData = effect as any;
  const effectType = effectData.EffectType;
  const category = getEffectCategory(effectType);

  // Parse the value
  // EffectTypeParam1 stores percentage stats as decimals (e.g. 0.25 = 25%)
  // and flat stats (DEF, HP) as raw numbers.
  // For percentage stats, the stat system uses per-10000 format, so we multiply by 10000.
  // Flat stats (Def=2, Hp=3, ToughnessMax=42) are used as-is.
  let value = 0;
  if (effectData.EffectTypeParam1 !== undefined) {
    const rawValue = typeof effectData.EffectTypeParam1 === 'string'
      ? parseFloat(effectData.EffectTypeParam1)
      : effectData.EffectTypeParam1;

    // Determine value conversion based on bIntFloat AND SecondSubtype
    // ATK(1), DEF(2), HP(3), Penetrate(9), WEP-DEP(23-28) are non-bIntFloat
    // But SecondSubtype=2 (PERCENTAGE) means even non-bIntFloat stats have decimal values
    const NON_INT_FLOAT_SUBTYPES = new Set([1, 2, 3, 9, 23, 24, 25, 26, 27, 28]);
    const firstSubtype = effectData.EffectTypeFirstSubtype || 0;
    const secondSubtype = effectData.EffectTypeSecondSubtype || 0;
    if (!NON_INT_FLOAT_SUBTYPES.has(firstSubtype) || secondSubtype === 2) {
      // bIntFloat stat OR percentage on flat stat: decimal → per-10000
      value = rawValue * 10000;
    } else {
      // Non-bIntFloat with SecondSubtype=1 (flat): use raw value as-is
      value = rawValue;
    }
  }

  return {
    id: String(effectId),
    effectType,
    category,
    name: effectData.Name || `Effect ${effectId}`,
    effectTypeFirstSubtype: effectData.EffectTypeFirstSubtype || 0,
    effectTypeSecondSubtype: effectData.EffectTypeSecondSubtype || 0,
    effectTypeParam1: effectData.EffectTypeParam1 || '0',
    value,
    raw: effectData
  };
}

// =============================================================================
// BUFF → EFFECT CHAIN PARSING
// =============================================================================

/**
 * Parse buff parameter from potential
 * Format: "BuffValue,NoLevel,{buffId},Time,10K"
 *
 * Returns the buff with all its effects parsed
 */
export function parseBuffParameter(
  paramStr: string,
  level: number
): ParsedBuff | null {
  const parts = paramStr.split(',');
  if (parts.length < 3) return null;

  const fileType = parts[0];
  const levelType = parts[1];
  const baseIdStr = parts[2];

  if (!fileType || !levelType || !baseIdStr) return null;

  // Normalize file type
  const normalizedFileType = fileType.toLowerCase().trim();
  if (normalizedFileType !== 'buffvalue' && normalizedFileType !== 'buff') {
    return null;
  }

  // Calculate actual buff ID based on level type
  let buffId = baseIdStr;
  if (levelType === 'LevelUp') {
    const baseId = parseInt(baseIdStr, 10);
    if (!isNaN(baseId)) {
      buffId = String(baseId + (level * 10));
    }
  }

  return parseBuffById(buffId);
}

/**
 * Get all stat modifications from a buff's effects
 * Filters to only STAT_MODIFICATION and ON_HIT effects
 */
export function getStatModificationsFromBuff(
  buff: ParsedBuff
): Array<{ statKey: string; value: number; isOnHit: boolean }> {
  const mods: Array<{ statKey: string; value: number; isOnHit: boolean }> = [];

  buff.effects.forEach(effect => {
    if (!isEffectRelevantForDamage(effect.effectType)) {
      return;
    }

    // Get stat key from EffectTypeFirstSubtype
    const statKey = getStatKeyFromEffectSubtype(effect.effectTypeFirstSubtype);
    if (statKey) {
      mods.push({
        statKey,
        value: effect.value,
        isOnHit: effect.category === EffectCategory.ON_HIT
      });
    }
  });

  return mods;
}

/**
 * Map EffectTypeFirstSubtype to stat key
 * This would use the existing enum mapping
 */
function getStatKeyFromEffectSubtype(subtype: number): string | null {
  // Import the existing function from enums.ts
  const { getAttrKeyFromEnumId } = require('./enums');
  return getAttrKeyFromEnumId(subtype);
}
