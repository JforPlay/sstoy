import { changeCombatAttributes, type CombatAttributes, type CombatScopedAttribute, type CombatAttributeChange } from './combat-attributes';
import { getCombatValue, type CombatLevelContext, type ValueMetadata } from './rotation-values';
import type { CombatBuffDefinition, CombatBuffState } from './combat-buffs';
import { isUnconditionalOwnerEffect } from './combat-rule-classifier';
import { matchCombatEffectConditions, type CombatConditionContext } from './combat-conditions';
export interface CombatEffectValue {
  Id: number; EffectType: number; EffectRate?: number; EffectTypeFirstSubtype: number; EffectTypeSecondSubtype: number;
  EffectTypeParam1?: string; EffectTypeParam2?: string; EffectTypeParam3?: string;
}
export interface CombatCooldownChange {slot:number;percent:number;seconds:number}
export interface ResolvedCombatAttributes { attributes: CombatAttributes; scoped: CombatScopedAttribute[]; cooldowns?:CombatCooldownChange[] }
export type CombatConditionFacts = CombatConditionContext | (()=>CombatConditionContext);
export interface CombatEffectMetadata extends ValueMetadata {
  Trigger?: number; TriggerCondition1?: number; TriggerParam1?: string;
  TriggerCondition2?: number; TakeEffectCondition1?: number;
  Target1?: number; TargetCondition1?: number; Target2?: number;
}
/** Only unconditional, owner-only numeric effects are static. Scripted
 * conditions and team targets must remain in their character event adapter. */
export function staticPotentialEffects(potentials: Record<number, number>, rows: Record<number, { EffectId1?: number; EffectId2?: number; EffectId3?: number }>,
  effects: Record<number, CombatEffectMetadata>): number[] {
  const result = new Set<number>();
  for (const id of Object.keys(potentials).map(Number)) {
    const row = rows[id];
    for (const effectId of [row?.EffectId1, row?.EffectId2, row?.EffectId3]) {
      if (!effectId) continue;
      const effect = effects[effectId];
      if (effect && isUnconditionalOwnerEffect(effect)) result.add(effectId);
    }
  }
  return [...result];
}
export function applyCombatAttributeEffect(current: ResolvedCombatAttributes, effect: CombatEffectValue, count = 1): ResolvedCombatAttributes {
  if (effect.EffectRate !== undefined && effect.EffectRate !== 100) throw new Error(`Effect ${effect.Id} requires a probability handler`);
  if(effect.EffectType===3){
    if(effect.EffectTypeSecondSubtype===1)return current; // SkillCDMaxAmend.Execute ignores assignment.
    const value=Number(effect.EffectTypeParam1 || 0)*count;
    const slots=effect.EffectTypeFirstSubtype===5?[1,2,4]:effect.EffectTypeFirstSubtype===1?[Number(effect.EffectTypeParam2)]:[];
    if(!Number.isFinite(value)||!slots.length||slots.some(slot=>![1,2,4].includes(slot))||![2,3].includes(effect.EffectTypeSecondSubtype))
      throw new Error(`Unsupported native cooldown effect ${effect.Id}`);
    return {...current,cooldowns:[...(current.cooldowns ?? []),...slots.map(slot=>({slot,
      percent:effect.EffectTypeSecondSubtype===2?value:0,seconds:effect.EffectTypeSecondSubtype===3?value:0}))]};
  }
  if (Number(effect.EffectTypeParam2 || 0) !== 0) throw new Error(`Effect ${effect.Id} requires a source-attribute conversion handler`);
  const value = Number(effect.EffectTypeParam1 || 0) * count;
  if (!Number.isFinite(value)) throw new Error(`Invalid attribute effect ${effect.Id}`);
  const type = effect.EffectTypeFirstSubtype;
  const subtype = effect.EffectTypeSecondSubtype;
  if (effect.EffectType === 12 || effect.EffectType === 45) {
    if (![1, 2, 3].includes(subtype)) throw new Error(`Unknown attribute channel ${subtype}`);
    return { ...current, attributes: changeCombatAttributes(current.attributes, [{ type, parameter: subtype as 1 | 2 | 3, value }]) };
  }
  if ([52,53,54,55,56,57,58,59].includes(effect.EffectType)) {
    return { ...current, scoped: [...current.scoped, { type, scope: [52,54,56,58].includes(effect.EffectType) ? 'element' : 'damage',
      selector: subtype, base: effect.EffectType <= 55 ? value : 0, percent: effect.EffectType >= 56 ? value : 0 }] };
  }
  throw new Error(`Effect ${effect.Id} is not a resolved attribute effect (${effect.EffectType})`);
}
export function collectCombatBuffAttributes(base: CombatAttributes, owner: string, buffs: CombatBuffState, time: number,
  definitions: Record<number, ValueMetadata>, values: Record<number, CombatBuffDefinition>, effects: Record<number, CombatEffectMetadata>,
  effectValues: Record<number, CombatEffectValue>, contexts: Record<string, CombatLevelContext>, hit?: { damageType: number; conditions?: CombatConditionFacts }, baseScoped: CombatScopedAttribute[] = [], hitOnly = false): ResolvedCombatAttributes {
  let result: ResolvedCombatAttributes = { attributes: base, scoped: [...baseScoped] };
  const instances=Object.values(buffs).flatMap(buff=>{
    if(!buff.sources) return [buff];
    const counts=buff.sources.reduce<Record<string,number>>((result,source)=>{
      result[source]=(result[source] ?? 0)+1;return result;
    },{});
    return Object.entries(counts).map(([source,stacks])=>({...buff,source,stacks,sources:undefined}));
  });
  for (const buff of instances) {
    if (buff.owner !== owner || (buff.expires !== null && buff.expires <= time)) continue;
    const context = contexts[buff.source];
    if (!context) throw new Error(`Missing buff source context ${buff.source}`);
    const definition = buff.valueId ? values[buff.valueId]! : getCombatValue(buff.id, definitions, values, context);
    if(!definition) throw new Error(`Missing stored buff value ${buff.valueId}`);
    for (const id of definition.Effects ?? []) {
      const metadata = effects[id];
      if (!metadata) throw new Error(`Missing buff effect ${id}`);
      const value = getCombatValue(id, effects, effectValues, context);
      const onHitAttribute = metadata.Trigger === 2 && [45,54,55,58,59].includes(value.EffectType);
      if (hitOnly && !onHitAttribute) continue;
      if (onHitAttribute) {
        if (!hit) continue;
        const unconditional=isUnconditionalOwnerEffect({...metadata,Trigger:1});
        if (!unconditional && hit.conditions) {
          const supplied=typeof hit.conditions==='function' ? hit.conditions() : hit.conditions;
          const conditionContext = {...supplied,owner,source:buff.source,
            enemy: owner === supplied.enemy ? supplied.source : supplied.enemy};
          const row = metadata as CombatEffectMetadata & Record<string,number|string|undefined>;
          if (!matchCombatEffectConditions(row,'Trigger',conditionContext) || !matchCombatEffectConditions(row,'TakeEffect',conditionContext)
            || !matchCombatEffectConditions(row,'Target',conditionContext,conditionContext.actors.find(actor=>actor.id===owner))) continue;
        } else if (!unconditional) {
          throw new Error(`Buff effect ${id} requires its conditional hit facts`);
        }
        result = applyCombatAttributeEffect(result, value, buff.stacks);
        continue;
      }
      // Stack-marker buffs carry a zero-valued attribute effect. Their cast/
      // hit triggers are handled by the record script, not by a stat snapshot.
      if (value.EffectType === 12 && Number(value.EffectTypeParam1 || 0) === 0 && Number(value.EffectTypeParam2 || 0) === 0) continue;
      if (metadata.Trigger !== undefined && metadata.Trigger !== 1) {
        // Boss modifiers 631025030/031/040/050 apply only to the configured
        // damage category during the before-hit event, never to every hit.
        if (metadata.Trigger === 3 && metadata.TriggerCondition1 === 54 && !metadata.TriggerCondition2) {
          if (!hit || hit.damageType !== Number(metadata.TriggerParam1)) continue;
        } else throw new Error(`Buff effect ${id} requires a dedicated trigger handler`);
      }
      // State flags (e.g. toughness-broken) are handled by the runtime; this
      // collector supplies only the associated numeric attribute amendments.
      // State flags and instantaneous healing are not persistent attributes.
      // The stationary no-incoming-damage profile starts at full HP, so native
      // recovery/revert effects produce no HP delta there; never count them as ATK.
      // ADD_TAG carries a tag string (e.g. DarkAnZhuo), not a numeric
      // attribute. State/tag queries are handled separately by the runtime.
      if (value.EffectType === 1 || value.EffectType===19 || value.EffectType===25 || value.EffectType===27) continue;
      result = applyCombatAttributeEffect(result, value, buff.stacks);
    }
  }
  return result;
}
export function addOnceCombatAttributes(current: ResolvedCombatAttributes, row: Record<string, number>, count = 1): ResolvedCombatAttributes {
  const changes: CombatAttributeChange[] = [];
  const scoped: CombatScopedAttribute[] = [];
  for (let index = 1; index <= 3; index++) {
    const type = row[`AttributeType${index}`];
    if (!type) continue;
    const parameter = row[`ParameterType${index}`];
    const value = (row[`Value${index}`] ?? 0) * count / 10000;
    const element = row[`ElementType${index}`] ?? 0;
    const damage = row[`DamageType${index}`] ?? 0;
    if (element || damage) {
      if (parameter !== 1 && parameter !== 2) throw new Error('Unsupported scoped once attribute channel');
      scoped.push({ type, scope: damage ? 'damage' : 'element', selector: damage || element,
        base: parameter === 1 ? value : 0, percent: parameter === 2 ? value : 0 });
    } else {
      if (![1, 2, 3].includes(parameter!)) throw new Error('Unknown once attribute channel');
      changes.push({ type, parameter: parameter as 1 | 2 | 3, value });
    }
  }
  return { attributes: changeCombatAttributes(current.attributes, changes), scoped: [...current.scoped, ...scoped] };
}
