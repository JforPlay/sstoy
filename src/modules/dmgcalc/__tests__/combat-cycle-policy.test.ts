import {describe,it,expect} from 'vitest';
import {makeCyclePolicy} from '../core/combat-optimizer';
import type {CombatRuntimeState} from '../core/combat-runtime';
const state={ready:{},buffs:{}} as CombatRuntimeState;
const config={hotaruHold:0,tiliaHold:0,ultimateHold:0,mainHold:0,supportsFirst:false};
describe('character-independent cycle priorities',()=>{
  it('does not drop bound second/third stages that are not named exactly skill',()=>{
    const policy=makeCyclePolicy(config,'132',['115','162']);
    expect(policy.choose(state,['132:skill2-enhanced-2','132:skill2-enhanced-2-hold'],10)).toBe('132:skill2-enhanced-2');
    expect(policy.choose(state,['132:skill3-enhanced'],10)).toBe('132:skill3-enhanced');
  });
  it('searches holding alternatives and arbitrary support stage names',()=>{
    const policy=makeCyclePolicy({...config,longSkillHold:true},'132',['115','162']);
    expect(policy.choose(state,['132:skill2','132:skill2-hold'],10)).toBe('132:skill2-hold');
    const supports=makeCyclePolicy({...config,supportsFirst:true},'132',['115','162']);
    expect(supports.choose(state,['115:followup','132:skill'],10)).toBe('115:followup');
  });
});
