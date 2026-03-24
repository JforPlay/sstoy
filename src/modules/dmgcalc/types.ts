// === Window state shape references (read-only, from app-char/app-disc) ===
export type Position = 'master' | 'assist1' | 'assist2';
export type SkillType = 'normalAtk' | 'skill' | 'ultimate';

// === DmgCalc own state ===
export type DiscSlotId = 'main1' | 'main2' | 'main3' | 'sub1' | 'sub2' | 'sub3';

export interface DmgCalcState {
  masterCharId: number | null;
  masterLevel: number;        // from PHASE_TO_LEVEL[characterLevelPhase]
  limitBreak: number;         // 0-5, dmgcalc-owned stepper value
  skillLevels: Record<SkillType, number>;
  discLevel: number;          // dmgcalc-owned disc level override (default 81)
  discLimitBreaks: Record<DiscSlotId, number>;  // per-slot LB overrides
  noteOverrides: Record<string, number>;  // noteId → level override (local)
  potentialLevelOverrides: Record<string, number>;  // potId → level override
  statOverrides: Record<string, number>;  // statKey → manual override value (replaces calculated total)
  stats: Map<string, AggregatedStat>;
  buffs: BuffSource[];
  enemy: EnemyConfig;
  results: Record<SkillType, SkillDamageResult | null>;
}

export interface EnemyConfig {
  level: number;
  def: number;
  res: number;
  toughnessBroken: boolean;
}

export interface AggregatedStat {
  key: string;
  displayName: string;
  baseValue: number;
  sources: StatSource[];
  total: number;
  /** Original calculated total before manual override */
  calculatedTotal: number;
}

export interface StatSource {
  name: string;
  value: number;
  active: boolean;
  characterId?: number;
  /** If true, value is a per-10000 percentage multiplier on the flat base stat */
  isPercentage?: boolean;
}

export interface BuffSource {
  id: string;
  buffId: number;
  name: string;
  sourceName: string;
  description: string;
  statEffects: { key: string; value: number; isFlat?: boolean }[];
  active: boolean;
  sourceCharId: number;
  sourceCharName: string;
  sourceType: 'talent' | 'assist-skill' | 'assist-ult' | 'potential' | 'talent-bonus';
  duration?: number;
  maxStacks?: number;
  nonToggleable?: boolean;
  level?: number;
  potentialId?: number;
}

export interface SkillDamageResult {
  skillName: string;
  skillIcon: string;
  skillType: SkillType;
  skillId: number;
  totalBaseDmg: number;
  totalCritDmg: number;
  totalAvgDmg: number;
  hits: HitResult[];
}

export interface HitResult {
  hitIndex: number;
  damagePercent: number;
  baseDmg: number;
  critDmg: number;
  avgDmg: number;
  damageType: number;
  elementType: number;
}

// === Kept for calc.ts compatibility ===
export interface HitDamageCalculation {
  displayName: string;
  skillPercent: number;
  skillAbs: number;
  baseDamage: number;
  critDamage: number;
  averageDamage: number;
}

export interface HitDamageEntry {
  id: number;
  displayName: string;
  skillPercent: number;
  skillAbs: number;
  damageType: number;
  elementType: number;
  energyCharge?: number;
}

export interface LimitBreakDataPoint {
  limitBreak: number;
  level: number;
  totalDamage: number;
  statsContribution: number;
  buffsContribution: number;
  percentGain: number;
}

export interface LimitBreakAnalysis {
  skillType: SkillType;
  dataPoints: LimitBreakDataPoint[];
  chartData: any;
}

export interface SkillParameterData {
  skillId: number;
  skillName: string;
  skillIcon: string;
  skillDesc: string;
  skillType: number;
  maxLevel: number;
  hitDamages: HitDamageEntry[];
  buffParams: any[];
  effectParams: any[];
}
