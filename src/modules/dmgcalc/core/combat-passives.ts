import type { CombatBuildTables } from './combat-build';
import { applyCombatAttributeEffect, type ResolvedCombatAttributes } from './combat-effects';
import { getCombatValue, type CombatLevelContext } from './rotation-values';

/** Shared by imported presets and live calculator input, for every actor.
 * Type 1 talents remain event mechanisms; Type 2 nodes are numeric passives. */
export function applyBuildPassives(base: ResolvedCombatAttributes, actorId: number, context: CombatLevelContext,
  tables: Pick<CombatBuildTables, 'talentGroups'|'talents'|'effects'|'effectValues'|'notes'>): ResolvedCombatAttributes {
  let result = base;
  const groups = new Set(Object.values(tables.talentGroups).filter(group => group.CharId === actorId && group.Background <= context.limitBreak).map(group => group.Id));
  for (const talent of Object.values(tables.talents).filter(row => row.Type === 2 && groups.has(row.GroupId))) {
    const references = talent.EffectId;
    const ids = Array.isArray(references) ? references.map(Number) : Object.entries(talent)
      .filter(([key,value]) => /^Param\d+$/.test(key) && typeof value === 'string' && value.startsWith('EffectValue,NoLevel,'))
      .map(([,value]) => Number((value as string).split(',')[2]));
    for (const id of new Set(ids)) {
      const effect = tables.effects[id] ? getCombatValue(id,tables.effects,tables.effectValues,context) : tables.effectValues[id];
      if (!effect) throw new Error(`Missing character breakthrough effect ${actorId}/${id}`);
      result = applyCombatAttributeEffect(result,effect);
    }
  }
  for (const [id, level] of Object.entries(context.notes)) {
    if (!level) continue;
    const note = tables.notes[Number(id)];
    if (!note) throw new Error(`Missing note ${id}`);
    for (const effect of note.EffectId) result = applyCombatAttributeEffect(result,getCombatValue(effect,tables.effects,tables.effectValues,context));
  }
  return result;
}
