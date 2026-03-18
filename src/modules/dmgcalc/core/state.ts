import type { DmgCalcState, EnemyConfig, BuffSource, AggregatedStat, SkillDamageResult, SkillType, DiscSlotId } from '../types';

const DEFAULT_ENEMY: EnemyConfig = {
  level: 80,
  def: 500,
  res: 0,
  toughnessBroken: false,
};

let state: DmgCalcState = createDefaultState();

function createDefaultState(): DmgCalcState {
  return {
    masterCharId: null,
    masterLevel: 90,
    limitBreak: 0,
    skillLevels: { normalAtk: 8, skill: 8, ultimate: 8 },
    discLevel: 81,
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
  Object.assign(state.enemy, partial);
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

export function setResult(skillType: SkillType, result: SkillDamageResult): void {
  state.results[skillType] = result;
}

export function setBuildInfo(charId: number | null, level: number, skillLevels: Record<SkillType, number>): void {
  state.masterCharId = charId;
  state.masterLevel = level;
  state.skillLevels = skillLevels;
}

/**
 * Set skill level for a specific skill type (local override).
 * Clamps level to 1-13 range.
 */
export function setSkillLevel(type: SkillType, level: number): void {
  state.skillLevels[type] = Math.max(1, Math.min(13, level));
}

export function setDiscLevel(level: number): void {
  state.discLevel = Math.max(1, Math.min(90, level));
}

export function setDiscLimitBreak(slotId: DiscSlotId, lb: number): void {
  state.discLimitBreaks[slotId] = Math.max(0, Math.min(6, lb));
}

export function setStatOverride(statKey: string, value: number): void {
  state.statOverrides[statKey] = value;
}

export function clearStatOverride(statKey: string): void {
  delete state.statOverrides[statKey];
}

export function setNoteLevel(noteId: string, level: number): void {
  state.noteOverrides[noteId] = Math.max(0, Math.min(99, level));
}

export function setPotentialLevel(potId: string, level: number): void {
  // Max level from Potential.json, default to 20
  const potential = (window as any).GameData?.potentials?.[potId] as any;
  const maxLevel = potential?.MaxLevel || 20;
  state.potentialLevelOverrides[potId] = Math.max(1, Math.min(maxLevel, level));
}
