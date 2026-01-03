/**
 * Type definitions for Damage Calculator module
 * Extracted from app-dmgcalc.ts for better organization
 */

import type { CharacterState, ParamParserState as BaseParamParserState } from '../../types';

// Re-export ParamParserState for convenience
export type { BaseParamParserState as ParamParserState };

// =============================================================================
// APP STATE INTERFACES (External dependencies)
// =============================================================================

/**
 * Disc state from window.discsState
 */
export interface DiscState {
  selectedDiscs?: Record<string, any>;
  discLimitBreaks?: Record<string, number>;
  subDiscLevels?: Record<string, number>;
}

/**
 * App state from window.state
 */
export interface AppState {
  party?: {
    master: CharacterState | null;
    assist1: CharacterState | null;
    assist2: CharacterState | null;
  };
  characterLevelPhase?: {
    master: number;
    assist1: number;
    assist2: number;
  };
  selectedPotentials?: {
    master: number[];
    assist1: number[];
    assist2: number[];
  };
  potentialLevels?: {
    master: Record<number, number>;
    assist1: Record<number, number>;
    assist2: Record<number, number>;
  };
  potentials?: Record<number, any>;
  skillLevels?: {
    master: Record<string, number>;
    assist1: Record<string, number>;
    assist2: Record<string, number>;
  };
}

/**
 * i18n helper interface
 */
export interface I18nHelper {
  t: (key: string) => string;
}

// =============================================================================
// STAT AGGREGATION TYPES
// =============================================================================

/**
 * Individual stat contribution from a source
 */
export interface StatSource {
  source: string;           // Display name (e.g., "캐릭터 기본", "Main Disc: X")
  value: number;            // Contribution amount
  active: boolean;          // Can be toggled on/off
  character?: 'master' | 'assist1' | 'assist2'; // Track which character (for party system)
}

/**
 * Aggregated stat with all sources and totals
 */
export interface AggregatedStat {
  name: string;             // Display name (localized)
  baseValue: number;        // Base value before adjustments
  sources: StatSource[];    // Individual contributions
  manualAdjustment: number; // Manual override amount
  total: number;            // Final calculated total

  // For manual input feature (future)
  autoValue?: number;       // Auto-calculated value
  manualValue?: number;     // Manual override value
  useManual?: boolean;      // Use manual value instead of auto
  delta?: number;           // Difference (manual - auto)
  deltaPercent?: number;    // Percent difference
}

// =============================================================================
// BUFF & EFFECT TYPES
// =============================================================================

/**
 * Buff source (from potentials, discs, etc.)
 */
export interface BuffSource {
  id: string;
  name: string;
  description: string;
  values: Record<string, number>;
  active: boolean;
  category: 'potential' | 'disc' | 'other';
  character?: 'master' | 'assist1' | 'assist2'; // Track which character provides this buff
}

/**
 * Buff entry from skill parameters
 */
export interface BuffEntry {
  id: string;
  displayName: string;
  duration: number;         // Important for DPS calculation
  stacks?: number;          // Max stacks for stacking buffs
  values: Record<string, any>;
  raw: any;                 // Full buff data
}

/**
 * Effect entry from skill parameters
 */
export interface EffectEntry {
  id: string;
  displayName: string;
  effectType: string;       // From EffectTypeFirstSubtype enum
  targetStat: string;       // Which stat this buffs (e.g., 'Atk', 'CritRate')
  value: number;
  raw: any;                 // Full effect data
}

// =============================================================================
// SKILL DAMAGE TYPES
// =============================================================================

/**
 * HitDamage entry from skill parameters
 */
export interface HitDamageEntry {
  id: string;
  displayName: string;
  skillPercent: number;     // Main damage multiplier (percentage)
  skillAbs: number;         // Flat damage addition
  sourceType?: number;      // SourceType from HitDamage (1=Character, 2=Summon, etc.)
  damageType?: number;      // DamageType from HitDamage (1=Normal, 2=Skill, 3=Ultimate, etc.)
  effectType?: number;      // EffectType from HitDamage
  elementType?: number;     // ElementType from HitDamage (1=Physical, 2=Fire, 3=Ice, etc.)
  element?: string;
  hitType?: string;
  raw: any;                 // Full hit damage data
}

/**
 * Parsed skill parameter data
 */
export interface SkillParameterData {
  // Skill basic info
  skillId: string;
  skillName: string;
  skillDesc: string;
  skillIcon: string;
  skillIconBg: string;
  skillLevel: number;

  // Parsed HitDamage entries
  hitDamages: HitDamageEntry[];

  // Parsed Buff entries
  buffs: BuffEntry[];

  // Parsed Effect entries
  effects: EffectEntry[];

  // Other parameters found in description
  otherParams: Record<string, any>;
}

/**
 * Calculated damage for a single hit
 */
export interface HitDamageCalculation {
  displayName: string;
  skillPercent: number;
  skillAbs: number;
  baseDamage: number;
  critDamage: number;
  averageDamage: number;
}

/**
 * Complete skill damage calculation result
 */
export interface SkillDamageResult {
  skillName: string;
  skillLevel: number;

  // Individual hit damages
  hitDamages: HitDamageCalculation[];

  // Total damage (sum of all hits)
  totalBaseDamage: number;
  totalCritDamage: number;
  totalAverageDamage: number;

  // Breakdown of damage multipliers
  breakdown: {
    // Basic stats
    atk: number;
    critRate: number;
    critDamage: number;

    // Skill multipliers
    skillPercent: number;
    skillAbs: number;
    skillIntensity: number;
    perkIntensity: number;

    // Damage multipliers
    slotDmg: number;
    elementDmg: number;
    generalDmg: number;
    dmgPlus: number;

    // Crit bonuses
    slotCritDmg: number;

    // Enemy multipliers
    defAmend: number;
    erAmend: number;
    resilienceBreakDmg: number;
    enemyMultiplier: number;

    // Final multipliers
    finalDmg: number;
    finalDmgPlus: number;

    // Intermediate calculations
    rawDamage: number;
    amplifiedDamage: number;

    // Legacy fields
    elementalBonus: number;
    damageBonus: number;
    finalDamageBonus: number;
    defenseMultiplier: number;
    resistanceMultiplier: number;
  };

  // Parsed parameter data
  parameterData?: SkillParameterData;
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/**
 * Enemy configuration
 */
export interface EnemyConfig {
  level: number;
  defense: number;
  resistance: number;
  toughness: number;
}

/**
 * Calculation results for all skills
 */
export interface SkillResults {
  normalAtk?: SkillDamageResult;
  skill?: SkillDamageResult;
  ultimate?: SkillDamageResult;
}

/**
 * Main damage calculator state
 */
export interface DamageCalcState {
  // Aggregated stats
  stats: Map<string, AggregatedStat>;

  // Buff tracking
  buffs: BuffSource[];

  // Enemy configuration
  enemy: EnemyConfig;

  // Calculation results
  results: SkillResults;

  // Manual adjustments enabled
  manualMode: boolean;

  // Active tab
  activeTab?: TabId;

  // Limit break analysis data
  limitbreak?: LimitBreakAnalysis;
}

/**
 * Limit break progression data point
 */
export interface LimitBreakDataPoint {
  limitBreak: number;          // 0-6
  level: number;               // Actual level at this LB
  damage?: number;             // Calculated damage
  totalDamage?: number;        // Total damage (alternative naming)
  atk?: number;                // ATK stat at this LB
  improvement?: number;        // % improvement from previous LB
  percentGain?: number;        // Percent gain (alternative naming)
  statsContribution?: number;  // Contribution from stats
  buffsContribution?: number;  // Contribution from buffs
}

/**
 * Complete limit break analysis
 */
export interface LimitBreakAnalysis {
  skillType: SkillType;
  dataPoints: LimitBreakDataPoint[];
  totalImprovement?: number;  // Total % from LB0 to LB6
  bestLimitBreak?: number;    // Which LB gives best improvement
  analysis?: LimitBreakDataPoint[];  // Alternative naming for dataPoints
  selectedSkill?: SkillType; // Currently selected skill for analysis
  loading?: boolean;         // Loading state
  chartData?: any;           // Chart.js data for visualization
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Skill type identifier
 */
export type SkillType = 'normalAtk' | 'skill' | 'ultimate';

/**
 * Character position
 */
export type CharacterPosition = 'master' | 'assist1' | 'assist2';

/**
 * Position alias for backward compatibility
 */
export type Position = CharacterPosition;

/**
 * Stat category type
 */
export type StatCategory = 'core' | 'offense' | 'elemental' | 'special';

/**
 * Tab identifier for damage calculator UI
 */
export type TabId = 'current' | 'limitbreak' | 'comparison' | 'manual';
