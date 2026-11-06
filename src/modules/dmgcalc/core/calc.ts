/**
 * Damage Calculation Formulas
 * Reference implementation: https://stellasora-calculator.pages.dev/script.js
 * Not yet fully validated against current KR in-game damage.
 */

import type { SkillDamageResult, HitDamageCalculation, SkillType, DmgCalcState } from '../types';
import { PHASE_TO_LEVEL, ELEMENT_TYPE_TO_STAT, ELEMENT_TYPE_TO_PEN, ELEMENT_TYPE_TO_IGNORE, ELEMENT_TYPE_TO_TAKEN, DAMAGE_TYPE_TO_CRIT_STAT, DAMAGE_TYPE_TO_BONUS_STAT, DAMAGE_TYPE_TO_TAKEN_STAT, SKILL_TYPE_TO_DAMAGE_TYPE } from '../constants';
import { getState } from './state';
import { getStat, getAllStats } from './stats';
import { fetchSkillData, aggregateSlotDmgFromEffects } from './skills';
import { parseAllPartyPotentialHitDamages } from './potential-hitdamage';
import { GameData } from '../../../shared/game-data';
import { DAMAGE_TYPE_TO_CRIT_RATE_STAT } from '../constants';

// =============================================================================
// MAIN DAMAGE CALCULATION
// =============================================================================

/**
 * Calculate damage for a specific skill type
 */
export function calculateSkillDamage(skillType: SkillType): SkillDamageResult | null {
  if (!window.state?.party?.master) return null;

  const masterChar = window.state.party.master;
  if (typeof masterChar === 'string') return null;

  // Fetch comprehensive skill data with all parsed parameters
  const skillData = fetchSkillData(skillType);
  if (!skillData) return null;

  const charData = GameData.characters?.[masterChar.id];
  if (!charData) return null;

  // Get aggregated stats
  const stats = getStatsWithBuffs();
  const atk = stats.Atk || 0;
  const critRate = stats.CritRate || 0; // per-10000
  const critPower = stats.CritPower || 15000; // stored as 15000 for 150% (divide by 100 for display, 10000 for calc)

  // (Debug logging removed for production)

  // Calculate elemental efficiency (elementDmg in formula)
  const elementType = (charData as any).EET; // Element Efficiency Type
  const elementDmg = getElementalBonus(elementType) / 10000;

  // Aggregate slotDmg from Effects (specific damage increase buffs)
  const slotDmg = aggregateSlotDmgFromEffects(skillData.effects);

  // Calculate damage for EACH HitDamage entry
  const hitDamageCalculations: HitDamageCalculation[] = [];

  if (skillData.hitDamages.length === 0) {
    return null;
  } else {
    // Calculate damage for each HitDamage
    skillData.hitDamages.forEach((hitDamage) => {
      const calc = calculateSingleHitDamage(
        {
          displayName: hitDamage.displayName,
          skillPercent: hitDamage.skillPercent, // Already in percentage format (172 for 172%)
          skillAbs: hitDamage.skillAbs,
          damageType: hitDamage.damageType,
          elementType: hitDamage.elementType || elementType,
          damageBonusType: hitDamage.damageBonusType,
        },
        atk, critRate, critPower, slotDmg, elementDmg
      );
      hitDamageCalculations.push(calc);
    });
  }

  // Calculate totals (sum of all hits)
  const totalBaseDamage = hitDamageCalculations.reduce((sum, hit) => sum + hit.baseDamage, 0);
  const totalCritDamage = hitDamageCalculations.reduce((sum, hit) => sum + hit.critDamage, 0);
  const totalAverageDamage = hitDamageCalculations.reduce((sum, hit) => sum + hit.averageDamage, 0);

  // Get missing stats for complete breakdown
  const dmgCalcState = getState();
  const generalDmgRaw = dmgCalcState.stats.get('GENDMG')?.total || 0;
  const generalDmg = generalDmgRaw / 10000;
  const dmgPlus = dmgCalcState.stats.get('DMGPLUS')?.total || 0;
  const finalDmgRaw = dmgCalcState.stats.get('FINALDMG')?.total || 0;
  const finalDmg = finalDmgRaw / 10000;
  const finalDmgPlus = dmgCalcState.stats.get('FINALDMGPLUS')?.total || 0;

  // Calculate sample single hit for breakdown (use first hit or fallback)
  const sampleHit = skillData.hitDamages[0] || { skillPercent: 100, skillAbs: 0 };
  const skillPercent = sampleHit.skillPercent || 100;
  const skillAbs = sampleHit.skillAbs || 0;
  const rawDamage = (atk * skillPercent / 100) + skillAbs;
  const amplifiedDamage = (rawDamage * 1 * 1 * slotDmg * elementDmg * generalDmg) + dmgPlus;

  // Map HitDamageCalculation entries to HitResult entries
  const hits: import('../types').HitResult[] = hitDamageCalculations.map((calc, idx) => ({
    hitIndex: idx,
    damagePercent: calc.skillPercent,
    baseDmg: calc.baseDamage,
    critDmg: calc.critDamage,
    avgDmg: calc.averageDamage,
    damageType: skillData.hitDamages[idx]?.damageType ?? 1,
    elementType: skillData.hitDamages[idx]?.elementType ?? 0,
  }));

  return {
    skillName: skillData.skillName,
    skillIcon: skillData.skillIcon,
    skillType,
    skillId: skillData.skillId,
    totalBaseDmg: Math.round(totalBaseDamage),
    totalCritDmg: Math.round(totalCritDamage),
    totalAvgDmg: Math.round(totalAverageDamage),
    hits,
  };
}

// =============================================================================
// SINGLE HIT DAMAGE CALCULATION
// =============================================================================

/**
 * Calculates damage for a single hit based on the decompiled game formula
 *
 * Full Formula from DECOMPILED_FORMULA_ANALYSIS.md:
 * Damage = ((((((Atk * ((skillPercentAmend + talentGroupPercentAmend) * 0.0001 / 100) + skillAbsAmend + talentGroupAbsAmend)
 *                   * skillIntensity * perkIntensity * slotDmg * elementDmg * generalDmg + dmgPlus)
 *                   * (critDmg + slotCritDmg) * (erAmend * defAmend * slotDmgTaken * elementDmgTaken * generalDmgTaken * resilienceBreakDmg))
 *                   + dmgPlusTaken) * finalDmg) + finalDmgPlus)
 *
 * Current implementation:
 * - talentGroupPercentAmend = 0 (not used yet)
 * - talentGroupAbsAmend = 0 (not used yet)
 * - skillIntensity = 1 (placeholder)
 * - perkIntensity = 1 (not used yet)
 * - generalDmg = from GENDMG stat
 * - dmgPlus = from DMGPLUS stat
 * - slotDmg = from damage type bonus stat (NORMALDMG, SKILLDMG, etc.)
 * - slotCritDmg = from damage type crit power stat (NORMALCRITPOWER, etc.)
 * - Enemy-related multipliers = from enemy config
 * - dmgPlusTaken = 0 (not used yet)
 * - finalDmg = from FINALDMG stat
 * - finalDmgPlus = from FINALDMGPLUS stat
 */
export function calculateSingleHitDamage(
  hit: { displayName: string; skillPercent: number; skillAbs: number; damageType?: number; elementType?: number; damageBonusType?: number },
  atk: number,
  critRate: number, // per-10000 format
  critPower: number, // per-100 format (15000 = 150%)
  baseSlotDmg: number, // Base specific damage increase from skill effects
  elementDmg: number // Elemental damage multiplier (1 + elemental%)
): HitDamageCalculation {
  // Formula components
  const skillPercentAmend = hit.skillPercent; // Already in percentage (172 for 172%)
  const talentGroupPercentAmend = 0; // Not used yet
  const skillAbsAmend = hit.skillAbs;
  const talentGroupAbsAmend = 0; // Not used yet
  const skillIntensity = 1; // Placeholder
  const perkIntensity = 1; // Not used yet

  // Get missing stats from state (CRITICAL - from DECOMPILED_FORMULA_ANALYSIS.md)
  const state = getState();
  const generalDmgRaw = state.stats.get('GENDMG')?.total ?? 10000;
  const generalDmg = generalDmgRaw / 10000; // per-10000: 10000 = 1.0x baseline
  const dmgPlus = state.stats.get('DMGPLUS')?.total || 0; // Flat damage bonus

  // Calculate slotDmg from damage type bonus stats (NORMALDMG, SKILLDMG, etc.)
  // This includes bonuses from potentials and buffs
  const damageType = hit.damageType || 1; // Default to NORMAL
  const damageTypeBonusKey = DAMAGE_TYPE_TO_BONUS_STAT[damageType];
  const damageTypeBonusRaw = damageTypeBonusKey ? (state.stats.get(damageTypeBonusKey)?.total ?? 10000) : 10000;
  const damageTypeBonus = damageTypeBonusRaw / 10000; // per-10000: 10000 = 1.0x baseline
  
  // Combine base slot damage with damage type bonus
  const slotDmg = baseSlotDmg * damageTypeBonus;

  // Step 1: Calculate base damage with skill multipliers
  // Atk * ((skillPercentAmend + talentGroupPercentAmend) / 100) + skillAbsAmend + talentGroupAbsAmend
  const percentMultiplier = (skillPercentAmend + talentGroupPercentAmend) / 100;
  // HP-scaling hits must not silently use ATK when building rotation estimates.
  const scalingValue = hit.damageBonusType === 3 ? state.stats.get('Hp')?.total ?? 0 : atk;
  const rawDamage = (scalingValue * percentMultiplier) + skillAbsAmend + talentGroupAbsAmend;

  // Step 2: Apply intensity and damage multipliers
  // * skillIntensity * perkIntensity * slotDmg * elementDmg * generalDmg + dmgPlus
  const amplifiedDamage = (rawDamage * skillIntensity * perkIntensity * slotDmg * elementDmg * generalDmg) + dmgPlus;

  // Step 3: Calculate critical damage (base damage * crit multiplier)
  const critDmgMultiplier = critPower / 10000; // Convert from per-10000 to decimal (15000 → 1.5x)

  // Get damage-type-specific crit power (slotCritDmg from decompiled formula)
  // CRITICAL for accurate calculations - uses damageType from HitDamage
  const slotCritDmg = getDamageTypeCritPower(hit, state);

  const critDamageValue = amplifiedDamage * (critDmgMultiplier + slotCritDmg);

  // Step 4: Enemy-related multipliers
  // DEF formula from decompiled game code (dev/def.c):
  // defAmend = 1 - (effDEF * 40) / (effDEF * 32 + 24000)
  const enemyDef = (state.enemy as any).def ?? (state.enemy as any).defense ?? 500;
  const defAmend = calculateEffectiveDefenseMultiplier(enemyDef, state.stats.get('DefIgnore')?.total ?? 0, state.stats.get('Penetrate')?.total ?? 0);

  // RES formula: Effective_RES = (RES × (1 - IGNORING)) - PEN
  const enemyRes = (state.enemy as any).res ?? (state.enemy as any).resistance ?? 0;
  const hitElemType = hit.elementType || 0;
  const penStatKey = ELEMENT_TYPE_TO_PEN[hitElemType];
  const ignStatKey = ELEMENT_TYPE_TO_IGNORE[hitElemType];
  const penValue = penStatKey ? (state.stats.get(penStatKey)?.total || 0) : 0;
  const ignValue = ignStatKey ? (state.stats.get(ignStatKey)?.total || 0) / 10000 : 0;
  const selectedRes = state.enemy.elementalRes?.[hitElemType] ?? enemyRes;
  const effectiveRes = (selectedRes * (1 - ignValue)) - penValue;
  const erAmend = calculateResistanceMultiplier(effectiveRes);

  // Resilience break damage: 1.5x if toughness broken, 1.0x otherwise
  const resilienceBreakDmg = ((state.enemy as any).toughnessBroken === true || (state.enemy as any).toughness === 0) ? 1.5 : 1.0;

  // Damage taken multipliers — "received damage increase" debuffs on enemy
  // These come from party buffs like "받는 불 속성 피해 +60%"
  const slotTakenKey = DAMAGE_TYPE_TO_TAKEN_STAT[damageType];
  const slotTakenRaw = slotTakenKey ? (state.stats.get(slotTakenKey)?.total ?? 10000) : 10000;
  const slotDmgTaken = slotTakenRaw / 10000; // per-10000: 10000 = 1.0x

  const elemTakenKey = ELEMENT_TYPE_TO_TAKEN[hitElemType];
  const elemTakenRaw = elemTakenKey ? (state.stats.get(elemTakenKey)?.total ?? 10000) : 10000;
  const elementDmgTaken = elemTakenRaw / 10000; // per-10000: 10000 = 1.0x

  const genTakenRaw = state.stats.get('GENDMGRCD')?.total ?? 10000;
  const generalDmgTaken = genTakenRaw / 10000; // per-10000: 10000 = 1.0x

  const dmgPlusTaken = 0; // DMGPLUSRCD — not commonly used

  const enemyMultiplier = erAmend * defAmend * slotDmgTaken * elementDmgTaken * generalDmgTaken * resilienceBreakDmg;

  // Step 5: Apply enemy multipliers
  const baseDamage = (amplifiedDamage * enemyMultiplier) + dmgPlusTaken;
  const critDmg = (critDamageValue * enemyMultiplier) + dmgPlusTaken;

  // Step 6: Final damage multipliers (from DECOMPILED_FORMULA_ANALYSIS.md)
  const finalDmgRaw = state.stats.get('FINALDMG')?.total ?? 10000;
  const finalDmg = finalDmgRaw / 10000; // per-10000: 10000 = 1.0x baseline
  const finalDmgPlus = state.stats.get('FINALDMGPLUS')?.total || 0; // Flat final damage

  const finalBaseDamage = (baseDamage * finalDmg) + finalDmgPlus;
  const finalCritDamage = (critDmg * finalDmg) + finalDmgPlus;

  // Average damage (accounting for crit rate)
  const rateKey = DAMAGE_TYPE_TO_CRIT_RATE_STAT[damageType];
  const categoryRate = rateKey ? (state.stats.get(rateKey)?.total ?? 0) : 0;
  const critRateDecimal = Math.min(10000, Math.max(0, critRate + categoryRate)) / 10000;
  const avgDamage = finalBaseDamage * (1 - critRateDecimal) + finalCritDamage * critRateDecimal;

  return {
    displayName: hit.displayName,
    skillPercent: hit.skillPercent,
    skillAbs: hit.skillAbs,
    baseDamage: Math.round(finalBaseDamage),
    critDamage: Math.round(finalCritDamage),
    averageDamage: Math.round(avgDamage)
  };
}

/** Public reference implementation; ignore is per-10000, penetration is flat. */
export function calculateEffectiveDefenseMultiplier(def: number, ignore = 0, penetration = 0): number {
  const effective = Math.max(0, def * (1 - Math.min(10000, Math.max(0, ignore)) / 10000) - penetration);
  return 1 - effective * 40 / (effective * 32 + 24000);
}

// =============================================================================
// STAT HELPERS
// =============================================================================

/**
 * Get stats with active buffs applied
 */
function getStatsWithBuffs(): Record<string, number> {
  const state = getState();

  const stats: Record<string, number> = {
    Atk: getStat('Atk'),
    CritRate: getStat('CritRate'),
    CritPower: getStat('CritPower') || 15000, // Default 150%
    DamageBonus: getStat('DamageBonus'),
    FinalDamageBonus: getStat('FinalDamageBonus')
  };

  // Aggregated totals already include active buffs; do not add them a second time.

  return stats;
}

/**
 * Get elemental efficiency bonus for character's element
 */
function getElementalBonus(elementType: number): number {
  const elementStat = ELEMENT_TYPE_TO_STAT[elementType];
  if (elementStat) {
    return getStat(elementStat);
  }
  return 0;
}

/**
 * Get damage-type-specific crit power (slotCritDmg from decompiled formula)
 * Maps damageType from HitDamage to NORMALCRITPOWER, SKILLCRITPOWER, etc.
 *
 * @param hit - Hit damage information with metadata
 * @param state - Damage calculator state
 * @returns Crit power bonus as decimal (e.g., 0.15 for 15% bonus)
 */
function getDamageTypeCritPower(
  hit: { displayName: string; skillPercent: number; skillAbs: number; damageType?: number },
  state: DmgCalcState
): number {
  // Get damageType from hit (from HitDamage entry)
  const damageType = hit.damageType || 1; // Default to NORMAL if not specified

  // Map damageType to stat key (NORMALCRITPOWER, SKILLCRITPOWER, etc.)
  const statKey = DAMAGE_TYPE_TO_CRIT_STAT[damageType];
  if (!statKey) {
    return 0;
  }

  // Get the stat value from state
  const critPowerRaw = state.stats.get(statKey)?.total || 0;

  // Convert per-10000 to decimal (e.g., 1500 → 0.15 for 15% bonus)
  const critPowerBonus = critPowerRaw / 10000;

  return critPowerBonus;
}

// =============================================================================
// ENEMY-RELATED CALCULATIONS (Placeholders)
// =============================================================================

/**
 * Calculate level-based multiplier
 */
function getLevelFromPhase(phase: number): number {
  return PHASE_TO_LEVEL[phase] || 1;
}

/**
 * Calculate defense multiplier based on character and enemy stats
 * TODO: Implement actual game formula
 */
export function calculateDefenseMultiplier(charLevel: number, enemyLevel: number, enemyDef: number): number {
  // Simplified defense formula - adjust based on actual game mechanics
  const levelDiff = charLevel - enemyLevel;
  const levelMult = 1 + (levelDiff * 0.01);
  const defReduction = (charLevel * 100) / ((charLevel * 100) + enemyDef);
  return levelMult * defReduction;
}

/**
 * Calculate resistance multiplier using decompiled piecewise bracket formula.
 * From dev/res.c and dev/config.json.
 * VUL/PEN/IGNORING hardcoded to 0 for Phase 1.
 */
function calculateResistanceMultiplier(effectiveRes: number): number {
  if (effectiveRes <= 0) {
    // With VUL=0: no bonus from negative resistance
    return 1.0;
  }

  // Piecewise bracket interpolation from dev/config.json:
  // Low: 0-250 → amend 0-0.25
  // Mid: 251-750 → amend 0.35-0.6
  // High: 751-2000 → amend 0.9-0.99
  let resistAmend: number;

  // Quadratic interpolation within each bracket (from decompiled res.c)
  if (effectiveRes <= 250) {
    const t = effectiveRes / 250;
    resistAmend = 0 + (0.25 - 0) * (t * t);
  } else if (effectiveRes <= 750) {
    const t = (effectiveRes - 251) / (750 - 251);
    resistAmend = 0.35 + (0.6 - 0.35) * (t * t);
  } else {
    const capped = Math.min(effectiveRes, 2000);
    const t = (capped - 751) / (2000 - 751);
    resistAmend = 0.9 + (0.99 - 0.9) * (t * t);
  }

  return 1 - resistAmend;
}

// =============================================================================
// POTENTIAL SKILL DAMAGE
// =============================================================================

/** Local interface for potential skill damage results (not exported to types.ts) */
interface PotentialSkillDamageResult {
  potentialId: number;
  potentialName: string;
  character: import('../types').Position;
  skillType: string;
  damageType: number;
  elementType: number;
  hitDamages: HitDamageCalculation[];
  totalBaseDamage: number;
  totalCritDamage: number;
  totalAverageDamage: number;
}

/**
 * Calculate damage for all potential HitDamage skills
 * These are additional damage skills that come from character potentials
 */
function calculatePotentialSkillDamages(): PotentialSkillDamageResult[] {
  const results: PotentialSkillDamageResult[] = [];

  // Parse all potential HitDamage skills from party
  const potentialSkills = parseAllPartyPotentialHitDamages();

  if (potentialSkills.length === 0) {
    return results;
  }

  // Get aggregated stats for damage calculation
  const stats = getStatsWithBuffs();
  const atk = stats.Atk || 0;
  const critRate = stats.CritRate || 0;
  const critPower = stats.CritPower || 15000;

  // Get character element for elemental damage bonus
  const masterChar = window.state?.party?.master;
  let elementDmg = 1;
  if (masterChar && typeof masterChar !== 'string') {
    const charData = GameData.characters?.[masterChar.id];
    if (charData) {
      const elementType = (charData as any).EET;
      elementDmg = getElementalBonus(elementType) / 10000;
    }
  }

  // Calculate damage for each potential skill
  potentialSkills.forEach(potSkill => {
    const hitDamageCalculations: HitDamageCalculation[] = [];

    potSkill.hitDamages.forEach(hitDamage => {
      // Calculate damage for this hit
      // skillPercent is already in percentage format from potential-hitdamage.ts
      // (rawPercent / 10000, same as skills.ts)
      const calc = calculateSingleHitDamageInternal(
        {
          displayName: hitDamage.displayName,
          skillPercent: hitDamage.skillPercent,
          skillAbs: hitDamage.skillAbs,
          damageType: hitDamage.damageType,
          damageBonusType: hitDamage.damageBonusType
        },
        atk, critRate, critPower, 1, elementDmg
      );
      hitDamageCalculations.push(calc);
    });

    // Sum up totals
    const totalBaseDamage = hitDamageCalculations.reduce((sum, hit) => sum + hit.baseDamage, 0);
    const totalCritDamage = hitDamageCalculations.reduce((sum, hit) => sum + hit.critDamage, 0);
    const totalAverageDamage = hitDamageCalculations.reduce((sum, hit) => sum + hit.averageDamage, 0);

    results.push({
      potentialId: potSkill.potentialId,
      potentialName: potSkill.potentialName,
      character: potSkill.character,
      skillType: 'potential_damage',
      damageType: potSkill.damageType,
      elementType: potSkill.elementType,
      hitDamages: hitDamageCalculations,
      totalBaseDamage: Math.round(totalBaseDamage),
      totalCritDamage: Math.round(totalCritDamage),
      totalAverageDamage: Math.round(totalAverageDamage)
    });

  });

  return results;
}

/** Keep legacy potential-hit callers on the same formula as regular hits. */
function calculateSingleHitDamageInternal(
  hit: { displayName: string; skillPercent: number; skillAbs: number; damageType?: number; elementType?: number; damageBonusType?: number },
  atk: number, critRate: number, critPower: number, baseSlotDmg: number, elementDmg: number
): HitDamageCalculation {
  return calculateSingleHitDamage(hit, atk, critRate, critPower, baseSlotDmg, elementDmg);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Calculate all skill damages (normalAtk, skill, ultimate, potentialSkills)
 */
export function calculateAllDamage(): void {
  const state = getState();

  state.results = {
    normalAtk: calculateSkillDamage('normalAtk') ?? null,
    skill: calculateSkillDamage('skill') ?? null,
    ultimate: calculateSkillDamage('ultimate') ?? null,
  };
}

/**
 * Get current damage results
 */
export function getDamageResults() {
  const state = getState();
  return state.results;
}
