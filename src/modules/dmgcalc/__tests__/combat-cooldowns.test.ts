import {describe,it,expect} from 'vitest';
import {applyCombatAttributeEffect} from '../core/combat-effects';
import {resolveCombatCooldown} from '../core/combat-cooldowns';
describe('native maximum cooldown amendments',()=>{
  it('targets the configured action slot rather than interpreting it as an attribute conversion',()=>{
    const result=applyCombatAttributeEffect({attributes:{},scoped:[]},{Id:1,EffectType:3,EffectTypeFirstSubtype:1,
      EffectTypeSecondSubtype:2,EffectTypeParam1:'-0.35',EffectTypeParam2:'4'});
    expect(resolveCombatCooldown(20,4,result.cooldowns!)).toBe(13);
    expect(resolveCombatCooldown(20,2,result.cooldowns!)).toBe(20);
  });
  it('adds percent and absolute changes and clamps to half the script-amended period',()=>{
    const result=applyCombatAttributeEffect({attributes:{},scoped:[]},{Id:1,EffectType:3,EffectTypeFirstSubtype:5,
      EffectTypeSecondSubtype:3,EffectTypeParam1:'-100'});
    for(const slot of [1,2,4])expect(resolveCombatCooldown(10,slot,result.cooldowns!)).toBe(5);
    expect(resolveCombatCooldown(10,2,[{slot:2,percent:.25,seconds:1}])).toBe(13.5);
  });
});
