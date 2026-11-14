import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {combatDiscHandlers} from '../core/combat-disc-handlers';
import {createCombatDiscRuntime,type NativeRecordData} from '../core/combat-disc-runtime';
import type {CombatRuntimeState} from '../core/combat-runtime';
import type {SupportCombatApi} from '../core/combat-support-adapter';

const data=JSON.parse(readFileSync('public/data/CombatRecords.json','utf8')) as Record<number,NativeRecordData>;
describe('native five-star record data',()=>{
  it('has an explicit handler for every released native script',()=>{
    for(const row of Object.values(data))if(row.source&&!['214038','214039','214066'].includes(String(row.id)))expect(combatDiscHandlers[row.id],String(row.id)).toBeTypeOf('function');
  });
  it('contains all released records and every breakthrough and concerto stage',()=>{
    const discs=JSON.parse(readFileSync('public/data/Disc.json','utf8'));
    const items=JSON.parse(readFileSync('public/data/Item.json','utf8'));
    const expected=Object.values(discs).filter((row:any)=>row.Visible&&row.Available&&items[row.Id]?.Rarity===1).map((row:any)=>row.Id);
    expect(Object.keys(data).map(Number)).toEqual(expected);
    for(const row of Object.values(data)){
      expect(row.main.map(skill=>skill.Level)).toEqual([1,2,3,4,5,6]);
      const groups=[...new Set(row.secondary.map(skill=>skill.GroupId))];
      expect(groups).toHaveLength(2);
      for(const group of groups)expect(row.secondary.filter(skill=>skill.GroupId===group).map(skill=>skill.Level)).toEqual([1,2,3,4,5]);
    }
  });
  for(const id of Object.keys(combatDiscHandlers).map(Number))it(`${id} resolves native field names at every stage`,()=>{
    for(let lb=0;lb<6;lb++){
      const concertos=Object.fromEntries(data[id]!.secondary.map(skill=>[skill.GroupId,Math.min(lb+1,5)]));
      const runtime=createCombatDiscRuntime(data,[{id,limitBreak:lb,level:81}],concertos,combatDiscHandlers,[]);
      const buffs=new Map<string,number>();
      const state={script:{}} as CombatRuntimeState;
      const api={actor:'main',main:'main',party:['main','support'],time:99,
        buffs:{add:(owner:string,id:number)=>buffs.set(`${owner}:${id}`,10),remove:(owner:string,id:number)=>buffs.delete(`${owner}:${id}`),count:(owner:string,id:number)=>buffs.get(`${owner}:${id}`)??10},
        actorInfo:()=>({element:1,job:2}),actorsByElement:()=>['main','support'],buffLimit:()=>10,randomPercent:()=>0,hasBuffTag:()=>true,shield:()=>{},
      } as unknown as SupportCombatApi;
      for(const element of [1,2,3,4,5,6])for(const actor of api.party){
        api.actorInfo=()=>({element,job:2});
        for(const kind of ['init','tick','cast','end','hit','before','mark','buff','ammo'] as const)
          for(const damageType of [1,2,3])runtime.process(state,{kind,actor,slot:2,element,variant:1,hit:{actor,damageType,element,slot:2,tags:[]}},api);
      }
    }
  });
});
