/** AttributeEntry's three independent amendment channels. Values are decimals
 * in native attribute units (HP=HP, CritRate=0..1). Never pool party members'
 * attributes: a contribution belongs to the actor receiving the effect.
 */
export interface CombatAttributeEntry { origin: number; base: number; percent: number; absolute: number; assignment?: number }
export interface CombatAttributeLimit {
  IsLimited?: boolean; IsPlayer?: boolean; Lower?: number; Upper?: number;
  IsLimitedPre?: boolean; IsPlayerPre?: boolean; LowerPre?: number; UpperPre?: number;
}
export type CombatAttributes = Record<number, CombatAttributeEntry>;
export interface CombatAttributeChange { type: number; parameter: 1 | 2 | 3; value: number }
export interface CombatScopedAttribute { type: number; scope: 'element' | 'damage'; selector: number; base: number; percent: number; assignment?: number }
const empty = (): CombatAttributeEntry => ({ origin: 0, base: 0, percent: 0, absolute: 0 });
export function changeCombatAttributes(attributes: CombatAttributes, changes: CombatAttributeChange[]): CombatAttributes {
  const result = { ...attributes };
  for (const change of changes) {
    if (!Number.isFinite(change.value) || !Number.isInteger(change.type) || change.type < 1 || change.type > 96) throw new Error('Invalid attribute change');
    const entry = { ...(result[change.type] ?? empty()) };
    const key = change.parameter === 1 ? 'base' : change.parameter === 2 ? 'percent' : change.parameter === 3 ? 'absolute' : null;
    if (key === null) throw new Error('Unknown attribute parameter type');
    entry[key] += change.value;
    result[change.type] = entry;
  }
  return result;
}
export function readCombatAttribute(attributes: CombatAttributes, type: number, limits: Record<number, CombatAttributeLimit>, player = true): number {
  const entry = attributes[type] ?? empty();
  const limit = limits[type];
  const clamp = (value: number, low = 0, high = 0) => Math.min(high / 10000, Math.max(low / 10000, value));
  let percent = entry.percent;
  if (limit?.IsLimitedPre && (!limit.IsPlayerPre || player)) percent = clamp(percent, limit.LowerPre, limit.UpperPre);
  let result = entry.assignment ?? ((entry.origin + entry.base) * (1 + percent) + entry.absolute);
  if (limit?.IsLimited && (!limit.IsPlayer || player)) result = clamp(result, limit.Lower, limit.Upper);
  return result;
}

/** ActorAdditionalAttrInfo.GetAttributeValueWithElementOrDamageType. Scoped
 * amendments join the base/percent channels BEFORE multiplication. They are
 * not an extra multiplier and must not leak to other damage categories. */
export function readScopedCombatAttribute(attributes: CombatAttributes, scoped: CombatScopedAttribute[], type: number,
  scope: 'element' | 'damage', selector: number): number {
  const entry = attributes[type] ?? empty();
  const matches = scoped.filter(value => value.type === type && value.scope === scope && value.selector === selector);
  const assigned = [...matches].reverse().find(value => value.assignment !== undefined);
  if (assigned) return assigned.assignment!;
  return (entry.origin + entry.base + matches.reduce((sum, value) => sum + value.base, 0))
    * (1 + entry.percent + matches.reduce((sum, value) => sum + value.percent, 0)) + entry.absolute;
}
