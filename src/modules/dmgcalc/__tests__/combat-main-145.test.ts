import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import type {LiveCombatInput} from '../core/combat-live-build';
import {createMain145} from '../core/combat-main-145';
import type {SupportCombatApi} from '../core/combat-support-adapter';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const read=async(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const tables=await loadExampleCombatTables(read,[145,157,142]);
const ids=[514501,514502,514503,514504,514505,514506,514507,514508,514509,514510,514511,514512,514513,514541,514542,514543];
function run(limitBreak:number,potentials:Record<number,number>){
  const live:LiveCombatInput={actors:[
    {id:145,level:90,ascension:8,limitBreak,potentials,skillSlots:{1:1,2:8,4:8,5:8}},
    ...[157,142].map(id=>({id,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{2:8,4:8,5:8}})),
  ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
  const profile=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:true});
  const policy={name:'ready',choose:(_state:any,legal:string[])=>legal.find(key=>key.includes('ultimate')) ?? legal[0] ?? null};
  return evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
}
describe('145 native umbrella collision, shield regeneration and gameplay triggers',()=>{
  it.each([0,...ids])('executes main potential %s independently',id=>{
    const result=run(5,id?{[id]:Math.min(6,tables.potentials[id]!.MaxLevel!)}:{});
    for(const key of ['normal','skill','ultimate'])expect(result.state.counts[`145:${key}`]).toBeGreaterThan(0);
    expect(result.state.hitCounts?.['145:145300001']).toBeGreaterThan(0);
    expect(result.state.hitCounts?.['145:145300003']).toBeUndefined(); // collision signal, not damage
    if(id===514502)expect(Number(result.state.supportScripts!['145']!.recoveryGeneration)).toBeGreaterThan(0);
    expect(Number.isFinite(result.damage)).toBe(true);
  });
  it.each([0,1,2,3,4,5])('replays all main potentials at breakthrough %s',limitBreak=>{
    const potentials=Object.fromEntries(ids.map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)]));
    const first=run(limitBreak,potentials),replay=run(limitBreak,potentials);
    expect(first.damage).toBeGreaterThan(0);expect(first.damage).toBe(replay.damage);expect(first.trace).toEqual(replay.trace);
    expect(first.state.hitCounts?.['145:145300002']).toBeGreaterThan(0);
    expect(first.state.hitCounts?.['145:145300005']).toBeGreaterThan(0);
  });
  it('uses the exported gameplay trigger rather than inventing a buff on every normal cast',()=>{
    const applied:number[]=[];
    const api={actor:'145',party:['145'],actorsByElement:()=>['145'],buffs:{add:(_owner:string,id:number)=>applied.push(id)}} as unknown as SupportCombatApi;
    const adapter=createMain145({514506:6}),initial=adapter.initialize(api);
    adapter.cast!(initial,api,'normal');expect(applied).not.toContain(14506011);
    adapter.gameplayTrigger!(initial,api,{normal:true,dodge:false,skill:false,ultimate:false});
    expect(applied).toContain(14506011);
    expect(tables.timings.characters.find(character=>character.id===145)!.timelines
      .some(timeline=>timeline.events.some(event=>event.normalAttackTriggerForFateCard&&event.triggerFateCardTheme))).toBe(true);
  });
});
