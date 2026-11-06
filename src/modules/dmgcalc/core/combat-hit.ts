import { resolveCombatHitIndex, type CombatLevelContext, type ValueMetadata } from './rotation-values';
export interface CombatHitDefinition extends ValueMetadata {
  DamageBonusType?: number; DamageType?: number; ElementType?: number; EffectType?:number;
  SkillPercentAmend?: number[]; SkillAbsAmend?: number[];
  PerkIntensity?: number[]; AdditionalType?: number; AdditionalSource?: number; AdditionalPercent?: number[];
  EnergyCharge?: number; SkillId?: number; DamageTag?: number[];
}
/** Resolve coefficients once from the correct owner's levels. Trigger frequency
 * is deliberately not inferred from Param text or the number of references. */
export function resolveCombatHit(hit: CombatHitDefinition, context: CombatLevelContext) {
  const coefficient = (values?: number[]): number => values?.length ? values[resolveCombatHitIndex(hit, context, values.length)]! : 0;
  return {
    id: hit.Id,
    scalingAttribute: hit.DamageBonusType ?? 0,
    damageType: hit.DamageType ?? 0,
    element: hit.ElementType ?? 0,
    percentRaw: coefficient(hit.SkillPercentAmend),
    flat: coefficient(hit.SkillAbsAmend),
    perkIntensity: hit.levelTypeData === 1 && hit.PerkIntensity?.length ? coefficient(hit.PerkIntensity) / 10000 : 1,
    additionalAttribute: hit.AdditionalType ?? 0,
    additionalFromAttacker: hit.AdditionalSource === 2,
    additionalRatio: coefficient(hit.AdditionalPercent) / 100,
    energy: hit.EnergyCharge ?? 0,
    skillKey: hit.SkillId ? String(hit.SkillId) : null,
    tags: hit.DamageTag ?? [],
  };
}
