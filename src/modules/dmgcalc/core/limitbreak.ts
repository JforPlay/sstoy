/**
 * Damage Calculator - Talent Limit Break Analysis
 * Calculates damage progression across talent limit break levels (0-8)
 *
 * IMPORTANT: This analyzes TALENT LIMIT BREAKS (한계돌파/돌파), NOT ascension phases
 * - Character is assumed to be at LEVEL 90 (max ascension)
 * - We compare damage as talent limit breaks (0-8) unlock talent bonuses
 * - Uses Talent.json and TalentGroup.json data
 *
 * @module dmgcalc/core/limitbreak
 */

import { GameData } from '@/shared/game-data';
import { loadFeatureData } from '@/shared/data-loader';
import { getState } from './state';
import { aggregateStatsFromBuild } from './stats';
import { calculateSkillDamage } from './calc';
import type { LimitBreakDataPoint, LimitBreakAnalysis, SkillType } from '../types';

// =============================================================================
// LIMIT BREAK ANALYSIS
// =============================================================================

/**
 * Analyze damage progression across all talent limit break levels
 * Character stays at level 90, talents unlock at different LB levels
 */
export async function analyzeLimitBreakProgression(
  skillType: SkillType
): Promise<LimitBreakAnalysis> {
  const state = getState();
  const masterChar = window.state?.party?.master;

  if (!masterChar || typeof masterChar === 'string') {
    throw new Error('No master character selected');
  }

  // Ensure talent data is loaded (TalentGroup.json and Talent.json are in characterDB feature)
  if (!GameData.talentGroups || Object.keys(GameData.talentGroups).length === 0 ||
      !GameData.talents || Object.keys(GameData.talents).length === 0) {
    console.log('[DmgCalc] Loading talent data from characterDB...');
    await loadFeatureData('characterDB');
  }

  if (!GameData.talentGroups || Object.keys(GameData.talentGroups).length === 0) {
    throw new Error('Failed to load talent data. Please try again.');
  }

  if (!GameData.talents || Object.keys(GameData.talents).length === 0) {
    throw new Error('Failed to load talent definitions. Please try again.');
  }

  const charId = String(masterChar.id); // Ensure it's a string for comparison

  // Get all talent groups for this character
  // CharId in TalentGroup.json is a string
  const talentGroups = Object.values(GameData.talentGroups || {})
    .filter((group: any) => String(group.CharId) === charId)
    .sort((a: any, b: any) => a.Background - b.Background);

  console.log(`[DmgCalc] Found ${talentGroups.length} talent groups for character ${charId}`);

  if (talentGroups.length === 0) {
    throw new Error(`No talent data found for character ${charId}. This character may not have limit break talents.`);
  }

  const dataPoints: LimitBreakDataPoint[] = [];
  let baselineDamage = 0;

  // Calculate damage for each limit break level (0-5)
  // LB 0 = no talents unlocked (base character at level 90)
  // LB 1-5 = progressively more talents unlocked, ACCUMULATING all previous bonuses
  for (let lb = 0; lb <= 5; lb++) {
    const dataPoint = await calculateLimitBreakDataPoint(lb, skillType, charId, talentGroups);

    if (lb === 0) {
      baselineDamage = dataPoint.totalDamage || 0;
    }

    // Calculate percentage gain relative to LB 0
    const currentDamage = dataPoint.totalDamage || 0;
    dataPoint.percentGain = baselineDamage > 0
      ? ((currentDamage - baselineDamage) / baselineDamage) * 100
      : 0;

    dataPoints.push(dataPoint);
  }

  // Generate chart data
  const chartData = generateChartData(dataPoints);

  // Return analysis with skill type (no conversion needed)
  return {
    skillType,
    dataPoints,
    chartData
  };
}

/**
 * Calculate damage and contributions for a specific limit break level
 */
async function calculateLimitBreakDataPoint(
  limitBreak: number,
  skillType: SkillType,
  charId: string,
  talentGroups: any[]
): Promise<LimitBreakDataPoint> {
  // Get talents unlocked at this LB level
  // Talents are unlocked at LB levels based on TalentGroup Background field
  const unlockedTalents = getTalentsAtLimitBreak(limitBreak, charId, talentGroups);

  // Apply talent bonuses to stats temporarily
  const talentBonuses = calculateTalentBonuses(unlockedTalents);

  // Temporarily store original stat values
  const originalStats = saveOriginalStats();

  try {
    // Apply talent bonuses to stats
    applyTalentBonuses(talentBonuses);

    // Recalculate stats with talent bonuses
    aggregateStatsFromBuild();

    // Calculate damage for this skill
    const masterChar = window.state?.party?.master;
    if (!masterChar || typeof masterChar === 'string') {
      return createEmptyDataPoint(limitBreak);
    }

    // Calculate skill damage (no conversion needed)
    const skillResult = calculateSkillDamage(skillType);

    const totalDamage = skillResult?.totalAvgDmg || 0;

    // Calculate contributions
    const statsContribution = calculateStatsContribution();
    const buffsContribution = calculateBuffsContribution();

    return {
      limitBreak,
      level: 90, // Always level 90 for talent analysis
      totalDamage,
      statsContribution,
      buffsContribution,
      percentGain: 0 // Will be calculated later
    };
  } finally {
    // Restore original stats
    restoreOriginalStats(originalStats);
    aggregateStatsFromBuild();
  }
}

/**
 * Get all talents unlocked at a specific limit break level
 * IMPORTANT: This ACCUMULATES talents from all previous limit breaks
 * e.g., LB 3 includes talents from LB 0, LB 1, LB 2, AND LB 3
 */
function getTalentsAtLimitBreak(limitBreak: number, charId: string, talentGroups: any[]): any[] {
  const talents: any[] = [];

  // Get ALL talent groups with Background <= current LB level (accumulative)
  const unlockedGroups = talentGroups.filter((group: any) => group.Background <= limitBreak);

  unlockedGroups.forEach((group: any) => {
    // Get all talents in this group
    const groupTalents = Object.values(GameData.talents || {})
      .filter((talent: any) => talent.GroupId === group.Id);

    talents.push(...groupTalents);
  });

  return talents;
}

/**
 * Calculate stat bonuses from talents
 */
function calculateTalentBonuses(talents: any[]): Record<number, number> {
  const bonuses: Record<number, number> = {};

  talents.forEach((talent: any) => {
    // Only process Type 2 talents (sub nodes that give stat bonuses)
    if (talent.Type !== 2) return;

    if (!talent.Param1) return;

    // Parse the param to get the effect
    const paramParts = talent.Param1.split(',');
    if (paramParts.length < 3) return;

    const effectId = parseInt(paramParts[2]);
    const effectData = GameData.effectValue?.[effectId];

    if (!effectData) return;

    // Get the stat type ID from EffectTypeFirstSubtype
    const statTypeId = effectData.EffectTypeFirstSubtype;
    const rawValue = parseFloat(effectData.EffectTypeParam1 || '0');

    if (statTypeId !== undefined && !isNaN(rawValue) && rawValue !== 0) {
      bonuses[statTypeId] = (bonuses[statTypeId] || 0) + rawValue;
    }
  });

  return bonuses;
}

/**
 * Apply talent bonuses to stats (temporarily)
 */
function applyTalentBonuses(bonuses: Record<number, number>): void {
  // Store bonuses in state for stat aggregation to pick up
  // This is a temporary modification
  if (!(window as any).__talentBonuses) {
    (window as any).__talentBonuses = {};
  }
  (window as any).__talentBonuses = { ...bonuses };
}

/**
 * Save original stat state
 */
function saveOriginalStats(): any {
  return { ...(window as any).__talentBonuses };
}

/**
 * Restore original stat state
 */
function restoreOriginalStats(originalStats: any): void {
  (window as any).__talentBonuses = originalStats;
}

/**
 * Create empty data point
 */
function createEmptyDataPoint(limitBreak: number): LimitBreakDataPoint {
  return {
    limitBreak,
    level: 90,
    totalDamage: 0,
    statsContribution: 0,
    buffsContribution: 0,
    percentGain: 0
  };
}

/**
 * Get skill ID for a specific skill type
 */
function getSkillIdForType(character: any, skillType: SkillType): number | null {
  switch (skillType) {
    case 'normalAtk':
      return character.normalAtk;
    case 'skill':
      return character.skill;
    case 'ultimate':
      return character.ultimate;
    default:
      return null;
  }
}

/**
 * Calculate contribution from base stats (excluding buffs)
 */
function calculateStatsContribution(): number {
  const state = getState();
  const atkStat = state.stats.get('Atk');
  if (!atkStat) return 0;

  let baseAtk = atkStat.baseValue;

  atkStat.sources.forEach(source => {
    if (!source.name.includes('버프') && !source.name.includes('Buff')) {
      baseAtk += source.value;
    }
  });

  return baseAtk;
}

/**
 * Calculate contribution from buffs
 */
function calculateBuffsContribution(): number {
  const state = getState();
  const atkStat = state.stats.get('Atk');
  if (!atkStat) return 0;

  let buffAtk = 0;

  atkStat.sources.forEach(source => {
    if (source.name.includes('버프') || source.name.includes('Buff')) {
      buffAtk += source.value;
    }
  });

  return buffAtk;
}

/**
 * Generate Chart.js compatible data structure
 */
function generateChartData(dataPoints: LimitBreakDataPoint[]): any {
  return {
    labels: dataPoints.map(dp => `LB${dp.limitBreak}`),
    datasets: [
      {
        label: '총 피해',
        data: dataPoints.map(dp => dp.totalDamage || 0),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.3,
        fill: true
      },
      {
        label: '증가율 (%)',
        data: dataPoints.map(dp => dp.percentGain || 0),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: false,
        yAxisID: 'y1'
      }
    ]
  };
}
