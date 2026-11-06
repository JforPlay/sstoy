/** Mirrors CommonHelper.GetValueConfigIdByLevelType. The metadata tables are
 * essential: Value tables alone cannot identify the owning potential/skill.
 */
export interface CombatLevelContext {
  characterLevel: number;
  /** Character advancement phase (nAdvance), NOT duplicate/talent limit break. */
  ascension: number;
  limitBreak: number;
  potentials: Record<number, number>;
  /** Exclusive level lookup is party-global in CommonHelper. Keep personal
   * selection separate so role guards and per-character branches stay local. */
  partyPotentials?:Record<number,number>;
  skillSlots: Record<number, number>;
  concertos: Record<number, number>;
  notes: Record<number, number>;
  buildLevel: number;
}
export interface ValueMetadata { Id: number; levelTypeData?: number; LevelData?: number }
export function resolveCombatValueId(metadata: ValueMetadata, context: CombatLevelContext): number {
  const data = metadata.LevelData ?? 0;
  let level: number;
  switch (metadata.levelTypeData ?? 0) {
    case 0: level = 0; break;
    case 1: level = (context.partyPotentials ?? context.potentials)[data] ?? 0; break;
    case 2: level = context.characterLevel; break;
    case 3: level = context.skillSlots[data] ?? 0; break;
    case 4: level = context.ascension; break;
    case 5: level = context.notes[data] ?? 0; break;
    case 6: level = context.concertos[data] ?? 0; break;
    case 7: level = context.buildLevel; break;
    default: throw new Error(`Unknown combat level type: ${metadata.levelTypeData}`);
  }
  if (!Number.isInteger(level) || level < 0) throw new Error('Invalid combat level');
  return metadata.Id + level * 10;
}
/** HitDamage stores arrays instead of separate +level*10 Value rows. The client
 * decrements potential, actor and skill levels only; advancement is zero-based. */
export function resolveCombatHitIndex(metadata: ValueMetadata, context: CombatLevelContext, length: number): number {
  if (!Number.isInteger(length) || length < 1) throw new Error('Missing hit coefficient array');
  const level = (resolveCombatValueId(metadata, context) - metadata.Id) / 10;
  const type = metadata.levelTypeData ?? 0;
  return Math.min(length - 1, Math.max(0, level - ([1, 2, 3].includes(type) ? 1 : 0)));
}
export function getCombatValue<T>(id: number, metadata: Record<string, ValueMetadata>, values: Record<string, T>, context: CombatLevelContext): T {
  const definition = metadata[id];
  if (!definition) throw new Error(`Missing combat metadata: ${id}`);
  const valueId = resolveCombatValueId(definition, context);
  const row = values[valueId];
  if (!row) throw new Error(`Missing combat value: ${id} -> ${valueId}`);
  return row;
}
