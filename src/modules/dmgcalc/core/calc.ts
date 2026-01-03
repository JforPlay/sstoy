/**
 * Damage Calculation Formulas
 * Implements the complete damage formula based on decompiled game code
 */

import type { SkillDamageResult, HitDamageCalculation, SkillType, DamageCalcState } from '../types';
import { PHASE_TO_LEVEL, ELEMENT_TYPE_TO_STAT, DAMAGE_TYPE_TO_CRIT_STAT } from '../constants';
import { getState } from './state';
import { getStat, getAllStats } from './stats';
import { fetchSkillData, aggregateSlotDmgFromEffects } from './skills';
import { GameData } from '../../../shared/game-data';

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

  // Debug logging
  console.log(`[DmgCalc] ========== Calculating ${skillType} damage ==========`);
  console.log(`[DmgCalc] ATK being used: ${atk}`);
  console.log(`[DmgCalc] Crit Rate: ${critRate / 100}% (${critRate} raw)`);
  console.log(`[DmgCalc] Crit Power: ${critPower / 100}% (${critPower} raw) = ${critPower / 10000}x multiplier`);

  // Alert if ATK is suspiciously low
  if (atk < 100) {
    console.error(`[DmgCalc] ⚠️ WARNING: ATK is extremely low (${atk})! Stats may not be aggregating correctly.`);
    console.error(`[DmgCalc] Character ID: ${masterChar.id}, Level Phase: ${window.state?.characterLevelPhase?.master}`);
  }

  // Calculate elemental efficiency (elementDmg in formula)
  const elementType = (charData as any).EET; // Element Efficiency Type
  const elementDmg = 1 + (getElementalBonus(elementType) / 10000);

  // Aggregate slotDmg from Effects (specific damage increase buffs)
  const slotDmg = aggregateSlotDmgFromEffects(skillData.effects);

  // Calculate damage for EACH HitDamage entry
  const hitDamageCalculations: HitDamageCalculation[] = [];

  if (skillData.hitDamages.length === 0) {
    // Fallback if no HitDamage found
    console.warn(`[DmgCalc] No HitDamage found for ${skillData.skillName}, using fallback 250%`);
    const fallbackCalc = calculateSingleHitDamage({
      displayName: 'Fallback Hit',
      skillPercent: 250,
      skillAbs: 0
    }, atk, critRate, critPower, slotDmg, elementDmg);
    hitDamageCalculations.push(fallbackCalc);
  } else {
    // Calculate damage for each HitDamage
    skillData.hitDamages.forEach((hitDamage) => {
      const calc = calculateSingleHitDamage(
        {
          displayName: hitDamage.displayName,
          skillPercent: hitDamage.skillPercent, // Already in percentage format (172 for 172%)
          skillAbs: hitDamage.skillAbs,
          damageType: hitDamage.damageType // Pass damageType for slotCritDmg lookup
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
  const generalDmg = 1 + (generalDmgRaw / 10000);
  const dmgPlus = dmgCalcState.stats.get('DMGPLUS')?.total || 0;
  const finalDmgRaw = dmgCalcState.stats.get('FINALDMG')?.total || 0;
  const finalDmg = 1 + (finalDmgRaw / 10000);
  const finalDmgPlus = dmgCalcState.stats.get('FINALDMGPLUS')?.total || 0;

  // Calculate sample single hit for breakdown (use first hit or fallback)
  const sampleHit = skillData.hitDamages[0] || { skillPercent: 100, skillAbs: 0 };
  const skillPercent = sampleHit.skillPercent || 100;
  const skillAbs = sampleHit.skillAbs || 0;
  const rawDamage = (atk * skillPercent / 100) + skillAbs;
  const amplifiedDamage = (rawDamage * 1 * 1 * slotDmg * elementDmg * generalDmg) + dmgPlus;

  return {
    skillName: skillData.skillName,
    skillLevel: skillData.skillLevel,
    hitDamages: hitDamageCalculations,
    totalBaseDamage: Math.round(totalBaseDamage),
    totalCritDamage: Math.round(totalCritDamage),
    totalAverageDamage: Math.round(totalAverageDamage),
    breakdown: {
      // Basic stats
      atk,
      critRate,
      critDamage: critPower,

      // Skill multipliers
      skillPercent,
      skillAbs,
      skillIntensity: 1, // Placeholder
      perkIntensity: 1, // Placeholder

      // Damage multipliers
      slotDmg,
      elementDmg,
      generalDmg,
      dmgPlus,

      // Crit bonuses
      slotCritDmg: 0, // TODO: damage-type-specific crit

      // Enemy multipliers (calculated from state.enemy)
      defAmend: atk / (atk + dmgCalcState.enemy.defense),
      erAmend: 1 - (dmgCalcState.enemy.resistance / 10000),
      resilienceBreakDmg: dmgCalcState.enemy.toughness === 0 ? 1.5 : 1.0,
      enemyMultiplier: (atk / (atk + dmgCalcState.enemy.defense)) *
                       (1 - (dmgCalcState.enemy.resistance / 10000)) *
                       (dmgCalcState.enemy.toughness === 0 ? 1.5 : 1.0),

      // Final multipliers
      finalDmg,
      finalDmgPlus,

      // Intermediate calculations
      rawDamage,
      amplifiedDamage,

      // Legacy fields
      elementalBonus: 0,
      damageBonus: 0,
      finalDamageBonus: 0,
      defenseMultiplier: 1,
      resistanceMultiplier: 1
    },
    // Attach the comprehensive parsed parameter data
    parameterData: skillData
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
 * - generalDmg = 1 (TODO: Add from stats)
 * - dmgPlus = 0 (TODO: Add from stats)
 * - slotCritDmg = 0 (TODO: Add damage-type-specific crit power)
 * - Enemy-related multipliers = 1 (placeholder until enemy system is implemented)
 * - dmgPlusTaken = 0 (not used yet)
 * - finalDmg = 1 (TODO: Add from stats)
 * - finalDmgPlus = 0 (TODO: Add from stats)
 */
function calculateSingleHitDamage(
  hit: { displayName: string; skillPercent: number; skillAbs: number; damageType?: number },
  atk: number,
  critRate: number, // per-10000 format
  critPower: number, // per-100 format (15000 = 150%)
  slotDmg: number, // Specific damage increase from effects
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
  const generalDmgRaw = state.stats.get('GENDMG')?.total || 0;
  const generalDmg = 1 + (generalDmgRaw / 10000); // Convert per-10000 to multiplier
  const dmgPlus = state.stats.get('DMGPLUS')?.total || 0; // Flat damage bonus

  // Step 1: Calculate base damage with skill multipliers
  // Atk * ((skillPercentAmend + talentGroupPercentAmend) / 100) + skillAbsAmend + talentGroupAbsAmend
  const percentMultiplier = (skillPercentAmend + talentGroupPercentAmend) / 100;
  const rawDamage = (atk * percentMultiplier) + skillAbsAmend + talentGroupAbsAmend;

  // Debug logging for damage calculation
  console.log(`[DmgCalc] ${hit.displayName} calculation:`, {
    atk,
    skillPercent: skillPercentAmend,
    percentMultiplier,
    rawDamage,
    slotDmg,
    elementDmg,
    formula: `${atk} * ${percentMultiplier} = ${rawDamage}`
  });

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
  // Defense formula: ATK / (ATK + Enemy DEF)
  const enemyDef = state.enemy.defense;
  const defAmend = atk / (atk + enemyDef);

  // Resistance formula: 1 - (Enemy RES / 10000)
  const enemyRes = state.enemy.resistance;
  const erAmend = 1 - (enemyRes / 10000);

  // Resilience break damage: 1.5x if toughness broken, 1.0x otherwise
  const resilienceBreakDmg = state.enemy.toughness === 0 ? 1.5 : 1.0;

  // Damage taken multipliers (not implemented yet, default to 1)
  const slotDmgTaken = 1; // Specific damage taken increase (from RCDNORMALDMG, etc.)
  const elementDmgTaken = 1; // Elemental damage taken increase
  const generalDmgTaken = 1; // General damage taken increase
  const dmgPlusTaken = 0; // Flat damage increase from taken

  const enemyMultiplier = erAmend * defAmend * slotDmgTaken * elementDmgTaken * generalDmgTaken * resilienceBreakDmg;

  // Step 5: Apply enemy multipliers
  const baseDamage = (amplifiedDamage * enemyMultiplier) + dmgPlusTaken;
  const critDmg = (critDamageValue * enemyMultiplier) + dmgPlusTaken;

  // Step 6: Final damage multipliers (from DECOMPILED_FORMULA_ANALYSIS.md)
  const finalDmgRaw = state.stats.get('FINALDMG')?.total || 0;
  const finalDmg = 1 + (finalDmgRaw / 10000); // Convert per-10000 to multiplier
  const finalDmgPlus = state.stats.get('FINALDMGPLUS')?.total || 0; // Flat final damage

  const finalBaseDamage = (baseDamage * finalDmg) + finalDmgPlus;
  const finalCritDamage = (critDmg * finalDmg) + finalDmgPlus;

  // Average damage (accounting for crit rate)
  const critRateDecimal = Math.min(10000, Math.max(0, critRate)) / 10000; // Convert from per-10000
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

  // Apply active buffs to stats
  state.buffs.filter(buff => buff.active).forEach(buff => {
    Object.entries(buff.values).forEach(([key, value]) => {
      if (typeof value === 'number' && stats[key] !== undefined) {
        stats[key] += value;
      }
    });
  });

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
  state: DamageCalcState
): number {
  // Get damageType from hit (from HitDamage entry)
  const damageType = hit.damageType || 1; // Default to NORMAL if not specified

  // Map damageType to stat key (NORMALCRITPOWER, SKILLCRITPOWER, etc.)
  const statKey = DAMAGE_TYPE_TO_CRIT_STAT[damageType];
  if (!statKey) {
    console.warn(`[DmgCalc] No crit power stat mapping for damageType ${damageType}`);
    return 0;
  }

  // Get the stat value from state
  const critPowerRaw = state.stats.get(statKey)?.total || 0;

  // Convert per-10000 to decimal (e.g., 1500 → 0.15 for 15% bonus)
  const critPowerBonus = critPowerRaw / 10000;

  if (critPowerBonus > 0) {
    console.log(`[DmgCalc] ${hit.displayName} - slotCritDmg (${statKey}): ${critPowerRaw} raw → ${critPowerBonus} decimal`);
  }

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
 * Calculate resistance multiplier
 * TODO: Implement actual game formula
 */
export function calculateResistanceMultiplier(resistance: number): number {
  // Placeholder - need actual formula
  return Math.max(0, 1 - (resistance / 100));
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Calculate all skill damages (normalAtk, skill, ultimate)
 */
export function calculateAllDamage(): void {
  const state = getState();

  state.results = {
    normalAtk: calculateSkillDamage('normalAtk') || undefined,
    skill: calculateSkillDamage('skill') || undefined,
    ultimate: calculateSkillDamage('ultimate') || undefined
  };
}

/**
 * Get current damage results
 */
export function getDamageResults() {
  const state = getState();
  return state.results;
}
