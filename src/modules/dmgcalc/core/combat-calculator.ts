import { readCombatAttribute, readScopedCombatAttribute, type CombatAttributeLimit } from './combat-attributes';
import { calculateCombatDamage, type ResistanceRules } from './combat-damage';
import type { ResolvedCombatAttributes } from './combat-effects';
import { resolveCombatHit, type CombatHitDefinition } from './combat-hit';
import type { CombatLevelContext } from './rotation-values';
interface FinalLimit { IsLimited?: boolean; IsPlayer?: boolean; Lower?: number; Upper?: number }
export interface CombatCalculationRules {
  attributes: Record<number, CombatAttributeLimit>;
  finalLimits: Record<number, FinalLimit>;
  resistance: ResistanceRules;
  dynamicDefCap: number; baseSuppress: number; dynamicSuppress: number;
}
const categories: Record<number, { damage: number; taken: number; crit: number; power: number; suppress: number }> = {
  1: { damage: 56, taken: 60, crit: 70, power: 77, suppress: 89 },
  2: { damage: 57, taken: 61, crit: 71, power: 78, suppress: 90 },
  3: { damage: 58, taken: 62, crit: 72, power: 79, suppress: 91 },
  4: { damage: 59, taken: 63, crit: 76, power: 83, suppress: 95 },
  5: { damage: 64, taken: 65, crit: 73, power: 80, suppress: 92 },
  6: { damage: 68, taken: 69, crit: 75, power: 82, suppress: 94 },
  7: { damage: 66, taken: 67, crit: 74, power: 81, suppress: 93 },
};
export function combatCalculationRules(config: Record<string, { Value: string }>, attributes: Record<number, CombatAttributeLimit>, finalLimits: Record<number, FinalLimit>): CombatCalculationRules {
  const value = (key: string): number => {
    const result = Number(config[key]?.Value);
    if (!Number.isFinite(result)) throw new Error(`Missing combat configuration ${key}`);
    return result;
  };
  const bracket = (name: string) => ({ lower: value(`${name}ResistanceValueLowerLimit`), upper: value(`${name}ResistanceValueUpperLimit`),
    amendLower: value(`${name}ResistanceAmendLowerLimit`), amendUpper: value(`${name}ResistanceAmendUpperLimit`) });
  return { attributes, finalLimits, resistance: { low: bracket('Low'), middle: bracket('Middle'), high: bracket('High') },
    dynamicDefCap: value('DynamicDEFCap'), baseSuppress: value('BaseSuppress'), dynamicSuppress: value('DynamicSuppress') };
}
export function calculateResolvedCombatHit(definition: CombatHitDefinition, context: CombatLevelContext,
  source: ResolvedCombatAttributes, target: ResolvedCombatAttributes, rules: CombatCalculationRules,sourcePlayer=true) {
  const hit = resolveCombatHit(definition, context);
  const category = categories[hit.damageType];
  if (!category) throw new Error(`Unknown damage category ${hit.damageType}`);
  const from = (type: number) => readCombatAttribute(source.attributes, type, rules.attributes, sourcePlayer);
  const to = (type: number) => readCombatAttribute(target.attributes, type, rules.attributes, false);
  const clamp = (value: number, type: number, player: boolean): number => {
    const limit = rules.finalLimits[type];
    return limit?.IsLimited && (!limit.IsPlayer || player) ? Math.min((limit.Upper ?? 0) / 10000, Math.max((limit.Lower ?? 0) / 10000, value)) : value;
  };
  const sourceScoped = (type: number) => readScopedCombatAttribute(source.attributes, source.scoped, type, 'element', hit.element);
  const targetScoped = (type: number) => readScopedCombatAttribute(target.attributes, target.scoped, type, 'element', hit.element);
  const pen = hit.element >= 1 && hit.element <= 6 ? clamp(readScopedCombatAttribute(source.attributes, source.scoped, 22 + hit.element, 'damage', hit.damageType), 6, true) : 0;
  const additional = hit.additionalAttribute ? (hit.additionalFromAttacker ? from(hit.additionalAttribute) : to(hit.additionalAttribute)) * hit.additionalRatio : 0;
  const result = calculateCombatDamage({
    scalingValue: from(hit.scalingAttribute), skillPercentRaw: hit.percentRaw, skillFlat: hit.flat, additionalFlat: additional,
    skillIntensity: 1 + from(85), perkIntensity: hit.perkIntensity * (definition.levelTypeData === 1 && definition.PerkIntensity?.length ? from(48) : 1),
    slotDamage: clamp(sourceScoped(category.damage), 1, true), elementDamage: from(16 + hit.element), generalDamage: from(49), damagePlus: from(50),
    critRate: Math.max(0, from(6) + clamp(sourceScoped(category.crit), 3, true)) - Math.max(0, to(7)),
    critPower: from(8), slotCritPower: clamp(sourceScoped(category.power), 4, true),
    enemyDef: to(2), enemyOriginalDef: target.attributes[2]?.origin ?? 0,
    defIgnore: from(10), defPenetrate: from(9), dynamicDefCap: rules.dynamicDefCap,
    enemyResistance: to(10 + hit.element), resistanceIgnore: from(28 + hit.element), resistancePenetrate: pen,
    suppress: clamp(from(55) + sourceScoped(category.suppress), 5, true), baseSuppress: rules.baseSuppress, dynamicSuppress: rules.dynamicSuppress,
    noElement: hit.element === 0,
    slotTaken: clamp(targetScoped(category.taken), 2, false), elementTaken: to(34 + hit.element), generalTaken: to(53),
    toughnessMultiplier: to(86), environmentMultiplier: to(96), damagePlusTaken: to(54), finalDamage: from(51), finalDamagePlus: from(52),
  }, rules.resistance);
  const critChance=Math.min(1,Math.max(0,Math.max(0,from(6)+clamp(sourceScoped(category.crit),3,true))-Math.max(0,to(7))));
  return { ...result, hit,critChance };
}
