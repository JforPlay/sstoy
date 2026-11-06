import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {createSupport134} from '../core/combat-support-134';
import type {SupportCombatApi} from '../core/combat-support-adapter';
const aliases=JSON.parse(readFileSync('public/data/combat/134.json','utf8')).comboAliases as {tag:string}[];
describe('134 support clip selection',()=>{
  it('restarts P43 decay instead of leaving two simultaneous decay coroutines',()=>{
    let count=0;
    const api={actor:'134',actorsByElement:()=>[],schedule:vi.fn(),buffs:{
      add:()=>{count=Math.min(6,count+1);},remove:()=>{count=0;},count:()=>count,
    },removeStacks:()=>{count--;}} as unknown as SupportCombatApi;
    const rules=createSupport134({513443:1});
    let state=rules.cast!(rules.initialize(api),api,'ultimate');
    state=rules.custom!(state,api,'134_P43_Buff');
    const oldGeneration=state.decayGeneration;
    state=rules.custom!(state,api,'134_P43_Buff');
    state=rules.event!(state,api,'decay',{generation:state.generation,decayGeneration:oldGeneration});
    expect(count).toBe(6);
    rules.event!(state,api,'decay',{generation:state.generation,decayGeneration:state.decayGeneration});
    expect(count).toBe(5);
  });
  it('resolves every combination of clip-changing potentials to an extracted native alias',()=>{
    const ids=[513421,513422,513423,513424,513426,513430,513442];
    for(let bits=0;bits<(1<<ids.length);bits++){
      const selected=Object.fromEntries(ids.filter((_,index)=>bits&(1<<index)).map(id=>[id,1]));
      const actions=createSupport134(selected).actions(false);
      for(const action of actions)for(const tag of [action.tag,...(action.chain ?? []).map(part=>part.tag)])
        expect(aliases.some(alias=>alias.tag===tag),String(tag)).toBe(true);
      expect(actions[1]!.loopCount).toBe(selected[513442]?4:2);
      expect(actions[0]!.chain!.at(-1)!.tag).toBe(selected[513422]?'134_Support_End_P22'
        :actions[0]!.chain![1]!.tag);
    }
  });
});
