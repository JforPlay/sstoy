import {describe,it,expect} from 'vitest';
import {dispatchCombatProcs,type CombatProcListener} from '../core/combat-proc-dispatch';
import {reviewedBreakthroughRules} from '../core/combat-breakthrough-rules';
import {combatTagHash} from '../core/combat-tags';
import type {CombatProcContext} from '../core/combat-procs';

const facts:CombatProcContext['facts']={eliteOrBoss:true,boss:true,fireMark:true,waterMark:true,earthMark1:true,waterMark1:true,lightMark1:true,
  coldOrFrozen:true,waterMark1OrColdOrFrozen:true,allDark:true,allFire:true,allWater:true,allEarth:true,lightCount:3,windCount:3,
  mainHpFraction:1,hpFraction:1,hasShield:true,burstUltraBuff:true,burstPotential43:false,glimmer:true,firstStageUltraBuff:true,
  slot:4,damageType:2,element:4,blockedBulletCount:1,huaWeaponCount:1,hitTargetCount:1,ownedMinionCount:1,
  remainingOwnedSummons:0,ultraAreaCount:0,ultraTornadoCount:1};
function setup() {
  const added:string[]=[],removed:string[]=[];
  const context=(_listener:CombatProcListener):Omit<CombatProcContext,'actor'|'event'|'breakthrough'>=>({
    attacker:'main',target:'boss',main:'main',party:['main','support1','support2'],time:100,tags:[],facts:{...facts},
    groups:{avatars:['avatar'],friends:['main','support1','support2','minion'],'owned-minions':['minion'],
      'dark-players':['main'],'fire-players':['support1'],'wind-players':['support2'],'earth-players':['support1']},
    buffs:{add:(actor,id)=>{added.push(`${actor}:${id}`);},remove:(actor,id)=>{removed.push(`${actor}:${id}`);},count:()=>0},
    parameter:()=>1,randomPercent:()=>0,
  });
  return {context,added,removed};
}
describe('party-wide common proc dispatch',()=>{
  it.each(Object.keys(reviewedBreakthroughRules).map(Number))('dispatches every reviewed event of character %s through the same engine',character=>{
    const {context}=setup(),listeners=[{actor:String(character),character,breakthrough:5}];
    let state={};
    for(const event of new Set(reviewedBreakthroughRules[character]!.map(rule=>rule.event))) {
      const result=dispatchCombatProcs(reviewedBreakthroughRules,listeners,state,{event,owner:String(character),context});
      state=result.state;
      expect(Object.values(state)).toHaveLength(1);
    }
  });
  it('does not evaluate locked breakthroughs or fabricate facts for unrelated listeners',()=>{
    const listeners=Object.keys(reviewedBreakthroughRules).map(Number).map(character=>({actor:String(character),character,breakthrough:0}));
    for(const event of new Set(Object.values(reviewedBreakthroughRules).flat().map(rule=>rule.event))) {
      expect(dispatchCombatProcs(reviewedBreakthroughRules,listeners,{}, {event,owner:'103',context:()=>{throw new Error('Should not request facts');}}))
        .toEqual({state:{},once:[]});
    }
  });
  it('routes owner-only events by actor ID and keeps independent counters after party reorder',()=>{
    const {context,added}=setup();
    const listeners=[{actor:'support2',character:108,breakthrough:5},{actor:'main',character:116,breakthrough:5}];
    const inputContext=(listener:CombatProcListener)=>({...context(listener),tags:[combatTagHash('108_Skill')]});
    let state=dispatchCombatProcs(reviewedBreakthroughRules,listeners,{}, {event:'own-hit',owner:'support2',context:inputContext}).state;
    expect(added).toContain('support2:10896411');
    expect(state.main).toBeUndefined();
    const original=structuredClone(state);
    state=dispatchCombatProcs(reviewedBreakthroughRules,[...listeners].reverse(),state,{event:'party-hit',context}).state;
    expect(state.main!.counters['116:lb3']).toBe(1);
    expect(original.main).toBeUndefined();
    expect(state.support2).toEqual(original.support2);
  });
  it('never broadcasts an owner-only hook to every selected party member by accident',()=>{
    const {context}=setup();
    expect(()=>dispatchCombatProcs(reviewedBreakthroughRules,[],{},{event:'own-hit',context})).toThrow(/needs an owner/);
  });
});
