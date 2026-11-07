import {describe,it,expect} from 'vitest';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import {combatMainFactories,combatSupportFactories} from '../core/combat-adapter-registry';
import {fixture,tables} from './combat-four-helpers';
describe('나노하/시아 + 안즈·프리지아 실제 선택 파티',()=>{
  it.each([119,155])('메인 %s, 지원123/125 전체 잠재력·5돌파 180초',main=>{
    const ids=[main,123,125],actors=ids.map((id,index)=>{
      const a=index?combatSupportFactories[id]!({},{} as any):combatMainFactories[id]!({},{} as any);
      return {id,level:90,ascension:8,limitBreak:5,potentials:Object.fromEntries(a.potentials.map(p=>[p,Math.min(6,tables.potentials[p]!.MaxLevel!)])),skillSlots:{1:8,2:8,4:8,5:8}};
    });
    const live={actors,records:fixture.records,notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
    const p=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:true});
    const r=evaluateCombatPolicies(p.model,[{name:'ready',choose:(_s,legal)=>legal.find(k=>k.endsWith(':ultimate'))??legal[0]??null}],180,60,p.boss.switchRate)[0]!;
    expect(r.damage).toBeGreaterThan(0);expect(Number.isFinite(r.damageScore)).toBe(true);
    for(const id of ids){expect(r.state.counts[`${id}:skill`]).toBeGreaterThan(0);expect(r.state.counts[`${id}:ultimate`]).toBeGreaterThan(0);}
  });
});
