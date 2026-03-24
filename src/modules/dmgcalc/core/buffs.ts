/**
 * Buff Collection for Damage Calculator
 *
 * Collects buffs from 5 sources:
 *   1. Master talent buffs (Type 1 talents with BuffValue/EffectValue params)
 *   2. Assist skill buffs (AssistSkillId -> Skill -> BuffValue/EffectValue)
 *   3. Assist ult buffs (AssistUltimateId -> Skill -> BuffValue/EffectValue)
 *   4. Potential buffs (selected potentials with BuffValue params)
 *   5. LB talent stat bonuses (Type 2 talents, non-toggleable display entries)
 *
 * Each buff is returned as a BuffSource with parsed stat effects.
 *
 * @module dmgcalc/core/buffs
 */

import { GameData, getCharacterName } from '@/shared/game-data';
import { getState } from './state';
import { getAttrKeyFromEnumId, getStatDisplayName } from './enums';
import { parseBuffById, parseEffectById, isEffectRelevantForDamage } from './effects';
import { getPotentialStatBonuses } from './potentials';
import type { BuffSource, Position } from '../types';

// =============================================================================
// MAIN API
// =============================================================================

/**
 * Collect all buffs relevant to the damage calculator.
 *
 * @param charId     - Master character ID
 * @param limitBreak - Current limit break level (0-5)
 * @returns Array of BuffSource entries with parsed stat effects
 */
export function collectAllBuffs(charId: number, limitBreak: number): BuffSource[] {
  const buffs: BuffSource[] = [];

  // 1. Master talent buffs (Type 1)
  buffs.push(...collectTalentBuffs(charId, limitBreak));

  // 2 & 3. Assist skill/ult buffs
  const positions: Position[] = ['assist1', 'assist2'];
  for (const pos of positions) {
    const assistChar = window.state?.party?.[pos];
    if (!assistChar || typeof assistChar === 'string') continue;

    const assistId = typeof assistChar.id === 'string'
      ? parseInt(assistChar.id, 10)
      : assistChar.id;
    const assistData = GameData.characters?.[assistId] as any;
    if (!assistData) continue;

    const charName = getCharacterName(String(assistId));

    // Assist skill buffs
    const assistSkillId = assistData.AssistSkillId;
    if (assistSkillId) {
      const skillName = resolveSkillName(assistSkillId);
      const skillBuffs = collectSkillBuffs(
        assistSkillId,
        `${pos}-skill`,
        assistId,
        charName,
        'assist-skill',
        skillName
      );
      buffs.push(...skillBuffs);
    }

    // Assist ultimate buffs
    const assistUltId = assistData.AssistUltimateId;
    if (assistUltId) {
      const ultName = resolveSkillName(assistUltId);
      const ultBuffs = collectSkillBuffs(
        assistUltId,
        `${pos}-ult`,
        assistId,
        charName,
        'assist-ult',
        ultName
      );
      buffs.push(...ultBuffs);
    }
  }

  // 4. Potential buffs (BuffValue-based, toggleable)
  buffs.push(...collectPotentialBuffs());

  // 5. Potential stat bonuses (EffectValue/OnceAdditionalAttributeValue, display-only)
  buffs.push(...collectPotentialStatDisplayEntries());

  // 6. LB talent stat bonuses (Type 2, non-toggleable)
  buffs.push(...collectTalentBonusDisplayEntries(charId, limitBreak));

  return buffs;
}

/**
 * Initialize buffs in the dmgcalc state.
 * Preserves active state of previously existing buffs (matching by id).
 */
export function initializeBuffs(): void {
  const state = getState();
  const masterChar = window.state?.party?.master;
  if (!masterChar || typeof masterChar === 'string') {
    state.buffs = [];
    return;
  }

  const charId = typeof masterChar.id === 'string'
    ? parseInt(masterChar.id, 10)
    : masterChar.id;

  const collected = collectAllBuffs(charId, state.limitBreak);

  // Preserve active state of existing buffs (skip non-toggleable ones)
  const prevActive = new Map(state.buffs.map((b) => [b.id, b.active]));
  state.buffs = collected.map((buff) => ({
    ...buff,
    active: buff.nonToggleable
      ? true
      : prevActive.has(buff.id) ? prevActive.get(buff.id)! : buff.active,
  }));
}

/**
 * Apply active buffs to a stat map (legacy helper for stats.ts).
 */
export function applyActiveBuffsToStats(stats: Map<string, any>): void {
  const state = getState();

  for (const buff of state.buffs) {
    if (!buff.active) continue;

    for (const effect of buff.statEffects) {
      const stat = stats.get(effect.key);
      if (stat) {
        stat.sources.push({
          name: buff.name,
          value: effect.value,
          active: true,
        });
      }
    }
  }
}

// =============================================================================
// 1. TALENT BUFFS (Type 1 - toggleable)
// =============================================================================

/**
 * Collect buffs from master character's Type 1 talents.
 */
function collectTalentBuffs(charId: number, limitBreak: number): BuffSource[] {
  const buffs: BuffSource[] = [];
  if (!GameData.talentGroups || !GameData.talents) return buffs;

  const charIdStr = String(charId);
  const charName = getCharacterName(charIdStr);

  // Get talent groups unlocked at current LB
  const groups = Object.values(GameData.talentGroups)
    .filter((g: any) => String(g.CharId) === charIdStr && g.Background <= limitBreak);

  for (const group of groups) {
    const gAny = group as any;
    const lbTier = gAny.Background || 0;
    const talents = Object.values(GameData.talents)
      .filter((t: any) => t.GroupId === gAny.Id && (t as any).Type === 1);

    for (const talent of talents) {
      const t = talent as any;
      const talentId = t.Id || t.id;
      const talentName = resolveTalentName(talentId);

      // Only process Buff/BuffValue params from Type 1 talents.
      // EffectValue params are handled by aggregateTalentBonuses in stats.ts.
      for (let i = 1; i <= 5; i++) {
        const param = t[`Param${i}`];
        if (!param || typeof param !== 'string') continue;
        const lower = param.toLowerCase();
        if (!lower.startsWith('buffvalue,') && !lower.startsWith('buff,')) continue;
        if (lower.includes(',enum,')) continue;

        const buffSource = parseParamToBuff(param, limitBreak, {
          idPrefix: `talent-${talentId}-p${i}`,
          sourceCharId: charId,
          sourceCharName: charName,
          sourceType: 'talent',
          sourceName: `LB${lbTier} ${window.i18n?.t('dmgcalc.talent') || '재능'} - ${talentName}`,
        });
        if (buffSource) buffs.push(buffSource);
      }
    }
  }

  return buffs;
}

// =============================================================================
// 2 & 3. ASSIST SKILL / ULT BUFFS
// =============================================================================

/**
 * Collect buffs from a single skill (assist skill or assist ult).
 */
function collectSkillBuffs(
  skillId: number,
  idPrefix: string,
  sourceCharId: number,
  sourceCharName: string,
  sourceType: 'assist-skill' | 'assist-ult',
  skillName: string
): BuffSource[] {
  const buffs: BuffSource[] = [];
  const skill = GameData.skills?.[skillId] as any;
  if (!skill) return buffs;

  // Get skill level from state (default 1)
  const skillLevel = resolveSkillLevel(skillId);

  const typeLabel = sourceType === 'assist-skill'
    ? (window.i18n?.t('dmgcalc.assistSkill') || '지원스킬')
    : (window.i18n?.t('dmgcalc.ultimate') || '궁극기');

  // First pass: collect Buff/BuffValue params and track their effect IDs
  const buffEffectIds = new Set<number>();
  for (let i = 1; i <= 10; i++) {
    const param = skill[`Param${i}`];
    if (!param || typeof param !== 'string') continue;
    const lower = param.toLowerCase();
    if (!lower.startsWith('buff')) continue;
    if (lower.includes(',enum,')) continue;

    const buffSource = parseParamToBuff(param, skillLevel, {
      idPrefix: `${idPrefix}-${skillId}-p${i}`,
      sourceCharId,
      sourceCharName,
      sourceType,
      sourceName: `${sourceCharName} ${typeLabel}`,
    });
    if (buffSource) {
      buffs.push(buffSource);
      // Track effect IDs from this buff to avoid duplicates
      const parts = param.split(',');
      const baseId = parseInt(parts[2] || '', 10);
      if (!isNaN(baseId)) {
        const bData = GameData.buffValue?.[baseId] as any;
        if (bData?.Effects) {
          for (const eid of bData.Effects) buffEffectIds.add(eid);
        }
      }
    }
  }

  // Second pass: collect Effect/EffectValue params that aren't duplicates of buff effects
  for (let i = 1; i <= 10; i++) {
    const param = skill[`Param${i}`];
    if (!param || typeof param !== 'string') continue;
    const lower = param.toLowerCase();
    if (!lower.startsWith('effect')) continue;
    if (lower.includes(',enum,')) continue;

    // Check if this effect ID is already covered by a buff
    const parts = param.split(',');
    const baseId = parseInt(parts[2] || '', 10);
    if (!isNaN(baseId) && buffEffectIds.has(baseId)) continue;

    const buffSource = parseParamToBuff(param, skillLevel, {
      idPrefix: `${idPrefix}-${skillId}-p${i}`,
      sourceCharId,
      sourceCharName,
      sourceType,
      sourceName: `${sourceCharName} ${typeLabel}`,
    });
    if (buffSource) buffs.push(buffSource);
  }

  return buffs;
}

// =============================================================================
// 4. POTENTIAL BUFFS
// =============================================================================

/**
 * Collect buffs from selected potentials for all positions.
 */
function collectPotentialBuffs(): BuffSource[] {
  const buffs: BuffSource[] = [];
  const positions: Position[] = ['master', 'assist1', 'assist2'];
  const potentialLevelOverrides = getState().potentialLevelOverrides;

  for (const position of positions) {
    const selected = window.state?.selectedPotentials?.[position] || [];
    const levels = window.state?.potentialLevels?.[position] || {};

    for (const potId of selected) {
      if (!potId) continue;

      const potential = GameData.potentials?.[potId] || window.state?.potentials?.[potId];
      if (!potential) continue;

      // Use local override if set, otherwise fall back to window.state level
      const level = potentialLevelOverrides[potId] !== undefined
        ? potentialLevelOverrides[potId]
        : (levels[potId] || 1);
      const charObj = window.state?.party?.[position];
      const sourceCharId = charObj && typeof charObj !== 'string' ? charObj.id : 0;
      const sourceCharName = sourceCharId
        ? getCharacterName(String(sourceCharId))
        : position;

      const potentialName = resolvePotentialDisplayName(potId);

      for (let i = 1; i <= 10; i++) {
        const param = (potential as any)[`Param${i}`];
        if (!param || typeof param !== 'string') continue;

        // Only collect Buff/BuffValue params as toggleable buffs.
        // EffectValue/Effect params are handled by getPotentialStatBonuses().
        // Enum params are display-only.
        const lower = param.toLowerCase();
        if (!lower.startsWith('buffvalue,') && !lower.startsWith('buff,')) continue;
        if (lower.includes(',enum,')) continue;

        const buffSource = parseParamToBuff(param, level, {
          idPrefix: `${position}-pot-${potId}-p${i}`,
          sourceCharId: typeof sourceCharId === 'number' ? sourceCharId : parseInt(sourceCharId, 10),
          sourceCharName,
          sourceType: 'potential',
          sourceName: `${sourceCharName} ${window.i18n?.t('dmgcalc.potential') || '잠재력'} -${potentialName}`,
        });
        if (buffSource) {
          buffSource.level = level;
          buffs.push(buffSource);
        }
      }
    }
  }

  return buffs;
}

// =============================================================================
// 5. POTENTIAL STAT BONUS DISPLAY ENTRIES
// =============================================================================

/**
 * Create non-toggleable display entries from potential stat bonuses.
 * These are the EffectValue/OnceAdditionalAttributeValue effects that
 * are already aggregated into stats by potentials.ts — we just display them.
 */
function collectPotentialStatDisplayEntries(): BuffSource[] {
  const entries: BuffSource[] = [];
  const positions: Position[] = ['master', 'assist1', 'assist2'];

  for (const position of positions) {
    const charObj = window.state?.party?.[position];
    if (!charObj || typeof charObj === 'string') continue;

    const sourceCharId = typeof charObj.id === 'number' ? charObj.id : parseInt(charObj.id, 10);
    const sourceCharName = getCharacterName(String(sourceCharId));

    const potSources = getPotentialStatBonuses(position);
    for (const src of potSources) {
      const statDisplayName = getStatDisplayName(src.statKey);

      entries.push({
        id: `${position}-pot-stat-${src.statKey}-${src.name}`,
        buffId: 0,
        name: src.name,
        sourceName: `${sourceCharName} ${window.i18n?.t('dmgcalc.potential') || '잠재력'} -${src.name.replace(/^Potential:\s*/, '')}`,
        description: '',
        statEffects: [{ key: src.statKey, value: src.value }],
        active: true,
        nonToggleable: true,
        sourceCharId,
        sourceCharName,
        sourceType: 'potential',
        level: src.level,
        potentialId: src.potentialId,
      });
    }
  }

  return entries;
}

// =============================================================================
// 6. LB TALENT STAT BONUSES (Type 2 - non-toggleable display entries)
// =============================================================================

/**
 * Collect Type 2 talent stat bonuses as non-toggleable display entries.
 * These are the stat bonuses from LB talent nodes (ATK, DEF, HP, etc.)
 * that are always active and aggregated into stats.
 */
function collectTalentBonusDisplayEntries(charId: number, limitBreak: number): BuffSource[] {
  const buffs: BuffSource[] = [];
  if (!GameData.talentGroups || !GameData.talents) return buffs;

  const charIdStr = String(charId);
  const charName = getCharacterName(charIdStr);

  const groups = Object.values(GameData.talentGroups)
    .filter((g: any) => String(g.CharId) === charIdStr && g.Background <= limitBreak)
    .sort((a: any, b: any) => a.Background - b.Background);

  for (const group of groups) {
    const gAny = group as any;
    const lbTier = gAny.Background || 0;
    const groupTalents = Object.values(GameData.talents)
      .filter((t: any) => t.GroupId === gAny.Id && t.Type === 2);

    for (const talent of groupTalents) {
      const t = talent as any;
      const talentId = t.Id || t.id;
      const talentName = resolveTalentName(talentId);

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

        const effectId = levelType === 'LevelUp' ? baseId + (limitBreak * 10) : baseId;
        const effectData = GameData.effectValue?.[effectId] as any;
        if (!effectData) continue;

        const subtype = effectData.EffectTypeFirstSubtype;
        const secondSub = effectData.EffectTypeSecondSubtype || 0;
        const rawParam = parseFloat(effectData.EffectTypeParam1 || '0');
        if (subtype === undefined || isNaN(rawParam) || rawParam === 0) continue;

        const statKey = getAttrKeyFromEnumId(subtype);
        if (!statKey) continue;

        // ATK/DEF/HP are non-bIntFloat (raw integers), others are bIntFloat (per-10000)
        const NON_INT_FLOAT_STATS = new Set(['Atk', 'Def', 'Hp', 'WEP', 'FEP', 'SEP', 'AEP', 'LEP', 'DEP']);
        const isBIntFloat = !NON_INT_FLOAT_STATS.has(statKey);
        const rawValue = isBIntFloat ? rawParam * 10000 : rawParam;
        const isFlat = !isBIntFloat && secondSub !== 2;

        const statDisplayName = getStatDisplayName(statKey);

        buffs.push({
          id: `lb-talent-${talentId}-p${i}-${effectId}`,
          buffId: effectId,
          name: `LB${lbTier} ${window.i18n?.t('dmgcalc.talent') || '재능'} - ${talentName}`,
          sourceName: `LB${lbTier} - ${statDisplayName}`,
          description: `${statDisplayName}: ${rawValue}`,
          statEffects: [{ key: statKey, value: rawValue, isFlat }],
          active: true,
          sourceCharId: charId,
          sourceCharName: charName,
          sourceType: 'talent-bonus',
          nonToggleable: true,
        });
      }
    }
  }

  return buffs;
}

// =============================================================================
// PARAM -> BUFF PARSING
// =============================================================================

interface BuffMeta {
  idPrefix: string;
  sourceCharId: number;
  sourceCharName: string;
  sourceType: 'talent' | 'assist-skill' | 'assist-ult' | 'potential';
  sourceName: string;
}

/**
 * Attempt to parse a parameter string into a BuffSource.
 * Supports "BuffValue,..." and "EffectValue,..." parameter formats.
 */
function parseParamToBuff(
  paramStr: string,
  level: number,
  meta: BuffMeta
): BuffSource | null {
  const lower = paramStr.toLowerCase();

  if (lower.startsWith('buffvalue,') || lower.startsWith('buff,')) {
    return parseBuffValueParam(paramStr, level, meta);
  }

  // EffectValue params that directly modify stats are collected as "instant buffs"
  if (lower.startsWith('effectvalue,') || lower.startsWith('effect,')) {
    return parseEffectValueParam(paramStr, level, meta);
  }

  return null;
}

/**
 * Parse a BuffValue parameter: "BuffValue,{levelType},{baseId},..."
 * Resolves the buff and its effects into a BuffSource.
 */
function parseBuffValueParam(
  paramStr: string,
  level: number,
  meta: BuffMeta
): BuffSource | null {
  const parts = paramStr.split(',');
  if (parts.length < 3) return null;

  const levelType = parts[1]!;
  const baseId = parseInt(parts[2]!, 10);
  if (isNaN(baseId)) return null;

  // Try LevelUp-adjusted ID first, fall back to base ID
  // Some Buff,LevelUp params scale a field value (like Time) with level,
  // but the buff entry itself lives at the base ID.
  let actualId = levelType === 'LevelUp' ? baseId + level * 10 : baseId;
  let parsed = parseBuffById(actualId);
  if (!parsed && levelType === 'LevelUp') {
    actualId = baseId;
    parsed = parseBuffById(actualId);
  }
  if (!parsed) return null;

  // Extract stat effects from the buff's effects
  const statEffects = extractStatEffects(parsed.effects);
  if (statEffects.length === 0) return null;

  // Apply max stacks: final buff value = per-stack value × max stacks
  const maxStacks = parsed.maxStacks || 1;
  const stackedEffects = maxStacks > 1
    ? statEffects.map(e => ({ ...e, value: e.value * maxStacks }))
    : statEffects;

  return {
    id: `${meta.idPrefix}-buff-${actualId}`,
    buffId: actualId,
    name: meta.sourceName,
    sourceName: `${meta.sourceName}${maxStacks > 1 ? ` (×${maxStacks})` : ''}`,
    description: formatBuffDescription(parsed.duration, parsed.maxStacks),
    statEffects: stackedEffects,
    active: true,
    sourceCharId: meta.sourceCharId,
    sourceCharName: meta.sourceCharName,
    sourceType: meta.sourceType,
    duration: parsed.duration,
    maxStacks: parsed.maxStacks,
  };
}

/**
 * Parse an EffectValue parameter: "EffectValue,{levelType},{baseId},..."
 * Creates a "pseudo-buff" representing a direct stat modification.
 */
function parseEffectValueParam(
  paramStr: string,
  level: number,
  meta: BuffMeta
): BuffSource | null {
  const parts = paramStr.split(',');
  if (parts.length < 3) return null;

  const levelType = parts[1]!;
  const baseId = parseInt(parts[2]!, 10);
  if (isNaN(baseId)) return null;

  const actualId = levelType === 'LevelUp' ? baseId + level * 10 : baseId;
  const parsed = parseEffectById(actualId);
  if (!parsed) return null;

  // Only include stat-modifying effects
  if (!isEffectRelevantForDamage(parsed.effectType)) return null;

  const statKey = getAttrKeyFromEnumId(parsed.effectTypeFirstSubtype);
  if (!statKey || parsed.value === 0) return null;

  return {
    id: `${meta.idPrefix}-effect-${actualId}`,
    buffId: actualId,
    name: meta.sourceName,
    sourceName: meta.sourceName,
    description: `${statKey}: ${parsed.value}`,
    statEffects: [{ key: statKey, value: parsed.value }],
    active: true,
    sourceCharId: meta.sourceCharId,
    sourceCharName: meta.sourceCharName,
    sourceType: meta.sourceType,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract stat key/value pairs from parsed effects.
 */
function extractStatEffects(
  effects: Array<{ effectType: number; effectTypeFirstSubtype: number; value: number }>
): Array<{ key: string; value: number }> {
  const result: Array<{ key: string; value: number }> = [];

  for (const effect of effects) {
    if (!isEffectRelevantForDamage(effect.effectType)) continue;

    const statKey = getAttrKeyFromEnumId(effect.effectTypeFirstSubtype);
    if (!statKey || effect.value === 0) continue;

    // Accumulate duplicates
    const existing = result.find((r) => r.key === statKey);
    if (existing) {
      existing.value += effect.value;
    } else {
      result.push({ key: statKey, value: effect.value });
    }
  }

  return result;
}

/**
 * Generate a human-readable description for a buff.
 */
function formatBuffDescription(duration?: number, maxStacks?: number): string {
  const parts: string[] = [];
  if (duration && duration > 0) {
    parts.push(`${(duration / 1000).toFixed(1)}s`);
  }
  if (maxStacks && maxStacks > 1) {
    parts.push(`max ${maxStacks} stacks`);
  }
  return parts.join(' | ') || 'Buff';
}

/**
 * Resolve the current skill level for a skill ID from window.state.
 */
function resolveSkillLevel(skillId: number): number {
  if (!window.state?.skillLevels) return 1;

  // Check all positions for this skill ID
  for (const pos of ['master', 'assist1', 'assist2'] as const) {
    const lvl = window.state.skillLevels[pos]?.[skillId];
    if (lvl) return lvl;
  }
  return 1;
}

/**
 * Resolve the localized name for a talent.
 * Talents have a Title key like "Talent.{id}.1" which maps to talentsKR.
 */
function resolveTalentName(talentId: number): string {
  const titleKey = `Talent.${talentId}.1`;

  // Try talentsKR first
  if (GameData.talentsKR?.[titleKey]) {
    return GameData.talentsKR[titleKey];
  }

  // Try the talent data's Title field
  const talent = GameData.talents?.[talentId] as any;
  if (talent?.Title && GameData.talentsKR?.[talent.Title]) {
    return GameData.talentsKR[talent.Title];
  }

  return `Talent ${talentId}`;
}

/**
 * Resolve the display name for a potential.
 * Uses BriefDesc key (Potential.{id}.1) from potentialsKR.
 */
function resolvePotentialDisplayName(potId: number): string {
  // Primary: Get name from Item.json using the pattern Item.{potId}.1
  // This is how app-char.ts resolves potential names
  const itemKey = `Item.${potId}.1`;
  if (GameData.itemsKR?.[itemKey]) {
    return GameData.itemsKR[itemKey];
  }

  // Fallback: try potentialNames from state
  const potIdStr = String(potId);
  if (window.state?.potentialNames?.[potIdStr]) {
    return window.state.potentialNames[potIdStr];
  }

  // Fallback: try BriefDesc from potentialsKR (longer description)
  const briefKey = `Potential.${potId}.1`;
  if (GameData.potentialsKR?.[briefKey]) {
    return truncate(GameData.potentialsKR[briefKey], 30);
  }

  const potential = GameData.potentials?.[potId] as any;
  if (potential?.Name && GameData.potentialsKR) {
    const localized = GameData.potentialsKR[potential.Name];
    if (localized) return localized;
  }

  return `Potential ${potId}`;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}

/**
 * Resolve the localized name for a skill.
 */
function resolveSkillName(skillId: number): string {
  const skill = GameData.skills?.[skillId] as any;
  if (!skill) return `Skill ${skillId}`;

  const nameKey = skill.Title || skill.Name || `Skill.${skillId}.1`;
  return GameData.skillsKR?.[nameKey] || `Skill ${skillId}`;
}
