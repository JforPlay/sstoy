import type { DmgCalcState, EnemyConfig, BuffSource, AggregatedStat, SkillDamageResult, SkillType, DiscSlotId } from '../types';
import {normalizeDiscLimitBreak,normalizeBaseSkillLevel} from '../constants';

const DEFAULT_ENEMY: EnemyConfig = {
  level: 80,
  def: 500,
  res: 0,
  toughnessBroken: false,
};

let state: DmgCalcState = createDefaultState();

function createDefaultState(): DmgCalcState {
  return {
    expandedSteps: [],
    badgeOptions: Array.from({ length: 9 }, () => [0, 0, 0, 0]),
    enemyPresetId: null,
    masterCharId: null,
    masterLevel: 90,
    limitBreak: 0,
    supportLimitBreaks: { assist1: 0, assist2: 0 },
    skillLevels: { normalAtk: 8, skill: 8, ultimate: 8 },
    discLevel: 81,
    discLevels: { main1: 81, main2: 81, main3: 81, sub1: 81, sub2: 81, sub3: 81 },
    discLimitBreaks: { main1: 1, main2: 1, main3: 1, sub1: 1, sub2: 1, sub3: 1 },
    noteOverrides: {},
    potentialLevelOverrides: {},
    statOverrides: {},
    stats: new Map(),
    buffs: [],
    enemy: { ...DEFAULT_ENEMY },
    results: { normalAtk: null, skill: null, ultimate: null },
  };
}

export function getState(): DmgCalcState {
  return state;
}

export function resetState(): void {
  state = createDefaultState();
}

export function updateEnemy(partial: Partial<EnemyConfig>): void {
  for (const key of ['level', 'def', 'res'] as const) {
    const value = partial[key];
    if (typeof value === 'number' && Number.isFinite(value)) state.enemy[key] = key === 'res' ? value : Math.max(key === 'level' ? 1 : 0, value);
  }
  if (typeof partial.toughnessBroken === 'boolean') state.enemy.toughnessBroken = partial.toughnessBroken;
}

export function setLimitBreak(lb: number): void {
  state.limitBreak = Math.max(0, Math.min(5, lb));
}

export function toggleBuff(buffId: string): void {
  const buff = state.buffs.find(b => b.id === buffId);
  if (buff) buff.active = !buff.active;
}

export function setStats(stats: Map<string, AggregatedStat>): void {
  state.stats = stats;
}

export function setBuffs(buffs: BuffSource[]): void {
  state.buffs = buffs;
}

export function setResult(skillType: SkillType, result: SkillDamageResult | null): void {
  state.results[skillType] = result;
}

export function setBuildInfo(charId: number | null, level: number, skillLevels: Record<SkillType, number>): void {
  if (state.masterCharId !== charId) {
    // Independent setup may already be filled before the first character.
    if (state.masterCharId !== null) {
      state.badgeOptions = Array.from({ length: 9 }, () => [0, 0, 0, 0]);
      state.noteOverrides = {};
    }
    state.limitBreak = 0;
    state.potentialLevelOverrides = {};
    state.statOverrides = {};
    state.stats = new Map();
    state.buffs = [];
    state.results = { normalAtk: null, skill: null, ultimate: null };
  }
  state.masterCharId = charId;
  state.masterLevel = level;
  state.skillLevels = Object.fromEntries(Object.entries(skillLevels).map(([key,value])=>[key,normalizeBaseSkillLevel(value)])) as Record<SkillType,number>;
}

export function setStepExpanded(step: number, expanded: boolean): void {
  if (!Number.isInteger(step) || step < 1 || step > 6) return;
  state.expandedSteps = state.expandedSteps.filter(value => value !== step);
  if (expanded) state.expandedSteps.push(step);
}

/**
 * Set skill level for a specific skill type (local override).
 * Base training is 1-10. Badge levels are added separately, exactly once.
 */
export function setSkillLevel(type: SkillType, level: number): void {
  state.skillLevels[type] = normalizeBaseSkillLevel(level);
}

export function setDiscLevel(level: number, slot?: DiscSlotId): void {
  if (!Number.isFinite(level)) return;
  const value = Math.max(1, Math.min(90, Math.round(level)));
  if (slot && slot in state.discLevels) state.discLevels[slot] = value;
  else {
    state.discLevel = value;
    for (const key of Object.keys(state.discLevels) as DiscSlotId[]) state.discLevels[key] = value;
  }
}

export function setDiscLimitBreak(slotId: DiscSlotId, lb: number): void {
  state.discLimitBreaks[slotId] = normalizeDiscLimitBreak(lb);
}

export function setStatOverride(statKey: string, value: number): void {
  if (Number.isFinite(value)) state.statOverrides[statKey] = value;
}

export function clearStatOverride(statKey: string): void {
  delete state.statOverrides[statKey];
}

export function setNoteLevel(noteId: string, level: number): void {
  if (!Number.isFinite(level)) return;
  state.noteOverrides[noteId] = Math.max(0, Math.min(99, Math.floor(level)));
}

export function setPotentialLevel(potId: string, level: number): void {
  // Max level = BASE_POTENTIAL_LEVEL(6) + potential.MaxLevel (matching app-char.ts logic)
  const potential = (window as any).GameData?.potentials?.[potId] as any;
  const BASE_POTENTIAL_LEVEL = 6;
  const maxLevelBonus = potential?.MaxLevel || 0;
  const maxLevel = BASE_POTENTIAL_LEVEL + maxLevelBonus;
  state.potentialLevelOverrides[potId] = Math.max(1, Math.min(maxLevel, level));
}
