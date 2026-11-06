import { decodeIngameCode, type CharSchemas } from '../../app-ingame-codec';
import { createBaseCombatAttributes, type CombatBaseTables, type CombatRecordSelection } from './combat-base';
import { type CombatEffectValue, type ResolvedCombatAttributes } from './combat-effects';
import { type CombatLevelContext, type ValueMetadata } from './rotation-values';
import { prepareLiveCombatBuild, type LiveCombatInput } from './combat-live-build';
import { applyBuildPassives } from './combat-passives';
export interface CombatBuildExample {
  potentialPreset: string; durationSeconds: number; notes: 'concertoMinimum'; badgeOptions: number[][];
  characters: { id: number; limitBreak: number }[];
  records: CombatRecordSelection[];
  concertos: { groupId: number; level: number; name: string }[];
  live?: LiveCombatInput;
}
interface PotentialPool { Id: number; MasterSpecificPotentialIds: number[]; MasterNormalPotentialIds: number[];
  AssistSpecificPotentialIds: number[]; AssistNormalPotentialIds: number[]; CommonPotentialIds: number[] }
export interface CombatBuildTables extends CombatBaseTables {
  badges?: Record<number, { Id: number; AttrType: number; AttrTypeFirstSubtype?: number; AttrTypeSecondSubtype?: number; Value: string }>;
  potentialPools: Record<number, PotentialPool>;
  potentials: Record<number, { Id: number; MaxLevel?:number; BuildScore: number[]; EffectId1?: number; EffectId2?: number; EffectId3?: number }>;
  secondarySkills: Record<number, { GroupId: number; Level: number; NeedSubNoteSkills: string; Score: number }>;
  notes: Record<number, { Scores: number[]; EffectId: number[] }>;
  ranks: Record<number, { MinGrade?: number; Level: number; AttrBaseGroupId: number }>;
  effects: Record<number, ValueMetadata>;
  effectValues: Record<number, CombatEffectValue>;
  talentGroups: Record<number, { Id: number; CharId: number; Background: number }>;
  talents: Record<number, { GroupId: number; Type: number; [key: string]: unknown }>;
}
/** Build setup is independent of the battle search. Explicit defaults are
 * returned in the output so a predicted result never hides assumed levels. */
export function prepareCombatBuild(example: CombatBuildExample, tables: CombatBuildTables,
  actorLevels = [90, 80, 80], skillLevels = [8, 8, 8]) {
  if (example.live) return prepareLiveCombatBuild(example.live, tables);
  if (example.notes !== 'concertoMinimum' || example.badgeOptions.length !== 9
    || example.badgeOptions.some(options => options.length !== 4 || options.some(value => value !== 0))) throw new Error('Example requires minimum notes and empty badges');
  const schemas = new Map<number, CharSchemas>();
  for (const pool of Object.values(tables.potentialPools)) schemas.set(pool.Id, {
    master: { specificLen: pool.MasterSpecificPotentialIds.length, normalLen: pool.MasterNormalPotentialIds.length, commonLen: pool.CommonPotentialIds.length },
    assist: { specificLen: pool.AssistSpecificPotentialIds.length, normalLen: pool.AssistNormalPotentialIds.length, commonLen: pool.CommonPotentialIds.length },
  });
  const decoded = decodeIngameCode(example.potentialPreset, schemas, 7);
  if (!decoded.ok) throw new Error(`Invalid combat preset: ${decoded.reason}`);
  const notes: Record<number, number> = {};
  let score = 0;
  for (const concerto of example.concertos) {
    const row = Object.values(tables.secondarySkills).find(row => row.GroupId === concerto.groupId && row.Level === concerto.level);
    if (!row) throw new Error(`Missing concerto ${concerto.groupId} Lv.${concerto.level}`);
    score += row.Score;
    const requirements = JSON.parse(row.NeedSubNoteSkills) as Record<string, number>;
    for (const [id, count] of Object.entries(requirements)) notes[Number(id)] = Math.max(notes[Number(id)] ?? 0, count);
  }
  for (const [id, count] of Object.entries(notes)) {
    const value = tables.notes[Number(id)]?.Scores[count - 1];
    if (value === undefined) throw new Error(`Missing note score ${id} Lv.${count}`);
    score += value;
  }
  const slots = decoded.payload.slots.map((slot, index) => {
    if (example.characters[index]?.id !== slot.charId) throw new Error('Party order does not match the supplied preset');
    const pool = tables.potentialPools[slot.charId]!;
    const potentials: Record<number, number> = {};
    const add = (id: number, level: number) => {
      if (!level) return;
      if (level > 6) throw new Error('Potential levels above six require a badge, but badges are empty');
      const points = tables.potentials[id]?.BuildScore[level - 1];
      if (points === undefined) throw new Error(`Missing potential score ${id} Lv.${level}`);
      potentials[id] = level;
      score += points;
    };
    (index ? pool.AssistSpecificPotentialIds : pool.MasterSpecificPotentialIds).forEach((id, n) => add(id, slot.specificOn[n] ? 1 : 0));
    (index ? pool.AssistNormalPotentialIds : pool.MasterNormalPotentialIds).forEach((id, n) => add(id, slot.normalLevels[n] ?? 0));
    pool.CommonPotentialIds.forEach((id, n) => add(id, slot.commonLevels[n] ?? 0));
    return { id: slot.charId, potentials };
  });
  const rank = Object.values(tables.ranks).filter(row => (row.MinGrade ?? 0) <= score).sort((a, b) => b.Level - a.Level)[0];
  if (!rank) throw new Error('Missing build rank');
  const buildAttribute = tables.attributes[String(rank.AttrBaseGroupId * 100000 + rank.Level)];
  if (!buildAttribute) throw new Error('Missing build rank attributes');
  const actors = slots.map((slot, index) => {
    const level = actorLevels[index];
    const skillLevel = skillLevels[index];
    if (level === undefined || skillLevel === undefined) throw new Error('Missing actor or skill level');
    const ascension = Math.min(8, Math.floor(level / 10));
    const context: CombatLevelContext = { characterLevel: level, ascension, limitBreak: example.characters[index]!.limitBreak,
      potentials: slot.potentials, notes, concertos: Object.fromEntries(example.concertos.map(row => [row.groupId, row.level])),
      skillSlots: { 2: skillLevel, 4: skillLevel, 5: skillLevel }, buildLevel: rank.Level };
    let base: ResolvedCombatAttributes = { attributes: createBaseCombatAttributes(slot.id, level, ascension, example.records, tables, buildAttribute), scoped: [] };
    base = applyBuildPassives(base,slot.id,context,tables);
    return { id: slot.id, context, base, mainSpBonus: 0, supportSpBonus: 0 };
  });
  return { actors, notes, badgeOptions: example.badgeOptions.map(options => [...options]), score, rank: rank.Level,
    duration: example.durationSeconds, assumedActorLevels: [...actorLevels], assumedSkillLevels: [...skillLevels], assumedTalentNodes: 'all-unlocked-at-breakthrough' as const };
}
