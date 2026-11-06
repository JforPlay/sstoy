import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadExampleCombatTables } from '../core/combat-data';
import { prepareLiveCombatBuild } from '../core/combat-live-build';
import { classifyCombatEffect, isUnconditionalOwnerEffect } from '../core/combat-rule-classifier';
import { applyCombatAttributeEffect } from '../core/combat-effects';
import { resolveCombatValueId, type CombatLevelContext } from '../core/rotation-values';
const read = async (name: string) => JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const tables = await loadExampleCombatTables(read);
const actors = Object.values(await read('Character')).filter((actor: any)=>actor.Visible && actor.Available) as any[];
const potentials = await read('Potential');

describe('all released actors through the same common-rule pipeline', () => {
  it.each(actors.map(actor=>[actor.Id]))('resolves actor %s at every breakthrough through one passive pipeline', id => {
    for (let limitBreak=0; limitBreak<=5; limitBreak++) {
      const result = prepareLiveCombatBuild({actors:[{id,level:90,ascension:8,limitBreak,potentials:{},skillSlots:{2:8,4:8,5:8}}],
        records:[],notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])},tables);
      for (const channels of Object.values(result.actors[0]!.base.attributes)) {
        expect(Object.values(channels).every(Number.isFinite)).toBe(true);
      }
      expect(result.actors[0]!.context.limitBreak).toBe(limitBreak);
    }
  });
  it('executes all structurally common potential effects, without activating script-only references', () => {
    let applied = 0;
    for (const actor of actors) {
      const selected = Object.values(potentials).filter((row:any)=>row.CharId===actor.Id) as any[];
      const context: CombatLevelContext = {characterLevel:90,ascension:8,limitBreak:5,
        potentials:Object.fromEntries(selected.map(row=>[row.Id,row.MaxLevel===1?1:6])),skillSlots:{2:8,4:8,5:8},notes:{},concertos:{},buildLevel:1};
      for (const potential of selected) for (const effectId of [potential.EffectId1,potential.EffectId2,potential.EffectId3].filter(Boolean)) {
        const metadata = tables.effects[effectId];
        if (!metadata) continue; // Reported as a data gap, never invented.
        const value = tables.effectValues[resolveCombatValueId(metadata,context)];
        const classification = classifyCombatEffect(metadata,value);
        if (classification.kind !== 'static-attribute') continue;
        const result = applyCombatAttributeEffect({attributes:{},scoped:[]},value!);
        expect(JSON.stringify(result)).not.toMatch(/null/);
        applied++;
      }
    }
    expect(applied).toBeGreaterThan(0);
  });
  it('does not misclassify another recipient, a conditional branch or a probability as a static self bonus', () => {
    const metadata = {Id:1,Trigger:1,Target1:1,TriggerCondition1:1,TakeEffectCondition1:1,TargetCondition1:1};
    const value = {Id:1,EffectRate:100,EffectType:12,EffectTypeFirstSubtype:1,EffectTypeSecondSubtype:2,EffectTypeParam1:'.2'};
    expect(classifyCombatEffect(metadata,value).kind).toBe('static-attribute');
    expect(isUnconditionalOwnerEffect({...metadata,Target1:2})).toBe(false);
    expect(isUnconditionalOwnerEffect({...metadata,TriggerCondition2:54})).toBe(false);
    expect(classifyCombatEffect(metadata,{...value,EffectRate:50}).kind).toBe('individual-mechanism');
    expect(classifyCombatEffect({...metadata,Trigger:2},{...value,EffectType:45}).kind).toBe('hit-attribute');
  });
});
