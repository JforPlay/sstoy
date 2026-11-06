import type { CombatBuildTables } from './combat-build';
import { createBaseCombatAttributes, type CombatRecordSelection } from './combat-base';
import { applyCombatAttributeEffect, type ResolvedCombatAttributes } from './combat-effects';
import { type CombatLevelContext } from './rotation-values';
import { applyBuildPassives } from './combat-passives';

export interface LiveCombatInput {
  actors: { id: number; level: number; ascension: number; limitBreak: number; potentials: Record<number, number>; skillSlots: Record<number, number>; badgeOffset?: number }[];
  records: CombatRecordSelection[];
  notes: Record<number, number>;
  badgeOptions: number[][];
}
export function prepareLiveCombatBuild(input: LiveCombatInput, tables: CombatBuildTables) {
  if (!input.actors.length) throw new Error('메인 여행가를 선택해 주세요.');
  const notes = Object.fromEntries(Object.entries(input.notes).filter(([, value]) => value > 0));
  let score = 0;
  for (const [id, count] of Object.entries(notes)) {
    if (!Number.isInteger(count) || count < 0 || count > 99) throw new Error(`소리 ${id} 레벨이 올바르지 않습니다.`);
    const points = tables.notes[Number(id)]?.Scores[count - 1];
    if (points === undefined) throw new Error(`소리 ${id} Lv.${count} 데이터가 없습니다.`);
    score += points;
  }
  const concertos: Record<number, number> = {};
  for (const record of input.records.slice(0, 3)) {
    const disc = tables.discs[record.id] as any;
    for (const group of [disc?.SecondarySkillGroupId1, disc?.SecondarySkillGroupId2]) {
      if (!group) continue;
      const active = Object.values(tables.secondarySkills).filter(row => row.GroupId === group &&
        Object.entries(JSON.parse(row.NeedSubNoteSkills) as Record<string, number>).every(([id, count]) => (notes[Number(id)] ?? 0) >= count))
        .sort((a, b) => b.Level - a.Level)[0];
      if (active && !concertos[group]) { concertos[group] = active.Level; score += active.Score; }
    }
  }
  for (const actor of input.actors) for (const [id, level] of Object.entries(actor.potentials)) {
    const points = tables.potentials[Number(id)]?.BuildScore[Math.min(6, level) - 1];
    if (points === undefined) throw new Error(`잠재력 ${id} Lv.${level} 데이터가 없습니다.`);
    score += points;
  }
  const rank = Object.values(tables.ranks).filter(row => (row.MinGrade ?? 0) <= score).sort((a, b) => b.Level - a.Level)[0];
  if (!rank) throw new Error('빌드 등급을 찾을 수 없습니다.');
  const buildAttribute = tables.attributes[String(rank.AttrBaseGroupId * 100000 + rank.Level)];
  const actors = input.actors.map((actor, index) => {
    const context: CombatLevelContext = { characterLevel: actor.level, ascension: actor.ascension, limitBreak: actor.limitBreak,
      potentials: { ...actor.potentials }, skillSlots: { ...actor.skillSlots }, notes, concertos, buildLevel: rank.Level };
    let base: ResolvedCombatAttributes = { attributes: createBaseCombatAttributes(actor.id, actor.level, actor.ascension, input.records.filter(record => record.id), tables, buildAttribute), scoped: [] };
    base = applyBuildPassives(base,actor.id,context,tables);
    let mainSpBonus = 0, supportSpBonus = 0;
    for (let badge = 0; badge < 3; badge++) {
      if (actor.level < [70, 80, 90][badge]!) continue;
      for (const id of input.badgeOptions[(actor.badgeOffset ?? index * 3) + badge] ?? []) {
        if (!id) continue;
        const row = tables.badges?.[id];
        if (!row) throw new Error(`배지 옵션 ${id} 데이터가 없습니다.`);
        const value = Number(row.Value);
        if (row.AttrType === 12) base = applyCombatAttributeEffect(base, { Id: id, EffectType: 12, EffectTypeFirstSubtype: row.AttrTypeFirstSubtype!, EffectTypeSecondSubtype: row.AttrTypeSecondSubtype!, EffectTypeParam1: row.Value });
        else if (row.AttrType === 37) { if (row.AttrTypeFirstSubtype === 1) mainSpBonus += value; else supportSpBonus += value; }
        else if (row.AttrType === 7) {
          if ((row.AttrTypeFirstSubtype === 2 && index > 0) || (row.AttrTypeFirstSubtype === 3 && index === 0)) continue;
          const slot = row.AttrTypeFirstSubtype === 1 ? 2 : row.AttrTypeFirstSubtype === 4 ? 5 : 4;
          context.skillSlots[slot] = (context.skillSlots[slot] ?? 0) + value;
        } else if (row.AttrType === 99) {
          const pool = tables.potentialPools[actor.id]!;
          const potential = [...(index ? pool.AssistNormalPotentialIds : pool.MasterNormalPotentialIds), ...pool.CommonPotentialIds].find(potential => potential % 100 === row.AttrTypeFirstSubtype);
          if (potential && context.potentials[potential]) context.potentials[potential] = Math.min(9, context.potentials[potential]! + value);
        } else throw new Error(`배지 옵션 ${id}의 효과를 아직 계산할 수 없습니다.`);
      }
    }
    return { id: actor.id, context, base, mainSpBonus, supportSpBonus };
  });
  return { actors, notes, badgeOptions: input.badgeOptions.map(options => [...options]), score, rank: rank.Level, duration: 180,
    assumedActorLevels: input.actors.map(actor => actor.level), assumedSkillLevels: input.actors.map(actor => actor.skillSlots[4] ?? 0),
    assumedTalentNodes: 'all-unlocked-at-breakthrough' as const };
}
