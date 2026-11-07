import {readFileSync} from 'node:fs';
import {vi} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import type {SupportCombatApi} from '../core/combat-support-adapter';
export const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
export const tables=await loadExampleCombatTables(async n=>JSON.parse(readFileSync(`public/data/${n}.json`,'utf8')),[119,123,125,139,142,155,157]);
export function profile(id:number,role:'main'|'support',potentials:Record<number,number>={},cinematics=true){
  const ids=role==='main'?[id,157,142]:[139,id,142];
  const live={actors:ids.map(c=>({id:c,level:90,ascension:8,limitBreak:5,potentials:c===id?potentials:{},skillSlots:{1:8,2:8,4:8,5:8}})),records:fixture.records,notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
  return createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics});
}
export function mockApi(id:number){
  const stacks=new Map<string,number>(),weapons=tables.timings.characters.find(c=>c.id===id)!.weapons;
  return {actor:String(id),main:'139',party:['139',String(id),'142'],lightActors:[],time:1,distance:2,
    buffs:{add:(owner:string,buff:number)=>stacks.set(`${owner}:${buff}`,Math.min(tables.buffValues[buff]?.LaminatedNum??999,(stacks.get(`${owner}:${buff}`)??0)+1)),
      remove:(owner:string,buff:number)=>stacks.delete(`${owner}:${buff}`),count:(owner:string,buff:number)=>stacks.get(`${owner}:${buff}`)??0},
    area:vi.fn(()=>8),schedule:vi.fn(),hit:vi.fn(),projectile:vi.fn(),shield:vi.fn(),emitProc:vi.fn(),directSp:vi.fn(),
    actorInfo:()=>({element:1,job:0}),randomPercent:()=>0,hasBuffTag:()=>false,parameter:(param:number)=>tables.parameterValues[param]!.CommonData/10000,
    weaponData:(name:string,type:string)=>weapons.find(w=>w.name===name)!.components.find(c=>c.type===type)!.data,
    independentLease:vi.fn(),independentCombo:vi.fn(()=>1),summon:vi.fn(),despawn:vi.fn(),ultimateCooling:()=>true,
    removeStacks:(owner:string,buff:number,count:number)=>stacks.set(`${owner}:${buff}`,Math.max(0,(stacks.get(`${owner}:${buff}`)??0)-count)),
  } as unknown as SupportCombatApi;
}
