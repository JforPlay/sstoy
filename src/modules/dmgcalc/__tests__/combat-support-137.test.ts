import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import type {LiveCombatInput} from '../core/combat-live-build';
import {createSupport137} from '../core/combat-support-137';
import type {SupportCombatApi} from '../core/combat-support-adapter';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const read=async(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const tables=await loadExampleCombatTables(read,[156,137,143]);
const ids=[513721,513722,513723,513724,513725,513726,513727,513728,513729,513730,513731,513732,513733,513741,513742,513743];
function run(limitBreak:number,potentials:Record<number,number>){
  const live:LiveCombatInput={actors:[
    {id:156,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{1:8,2:8,4:8,5:8}},
    {id:137,level:90,ascension:8,limitBreak,potentials,skillSlots:{2:8,4:8,5:8}},
    {id:143,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{2:8,4:8,5:8}},
  ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
  const profile=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:true});
  const policy={name:'ready',choose:(_state:any,legal:string[])=>legal.find(key=>key.includes('ultimate')) ?? legal[0] ?? null};
  return evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
}
describe('137 jumping support and separately scoped drone actors',()=>{
  it('inherits drone speed from the level-start snapshot, not a temporary owner buff at spawn',()=>{
    const adapter=createSupport137({});
    const api={time:20,initialAttribute:()=>1.25,attribute:()=>99,
      independentLease:()=>{},independentCombo:()=>1,schedule:()=>{},
      summonAi:()=>({source:'char_13701_combos_uav.unity3d',thinkSeconds:.05,initialCooldown:0,normalCooldown:0}),
    } as unknown as SupportCombatApi;
    const state=adapter.projectileEnd!(adapter.initialize(api),api,'Bullet_137_UAV_BirthFly','boss');
    expect(state.drones[0]!.speed).toBe(1.25);
  });
  it.each([0,...ids])('executes support potential %s independently',id=>{
    const result=run(5,id?{[id]:Math.min(6,tables.potentials[id]!.MaxLevel!)}:{});
    for(const key of ['skill','ultimate'])expect(result.state.counts[`137:${key}`]).toBeGreaterThan(0);
    const script=result.state.supportScripts!['137']!;
    expect(Number(script.droneSequence)).toBeGreaterThan(0);
    expect(result.state.hitCounts?.['137:137300010']).toBeGreaterThan(0);
    expect(result.state.hitCounts?.['137:137300011']).toBeGreaterThan(0);
    if(id===513724)expect(result.state.hitCounts?.['137:137300013']).toBeGreaterThan(0);
    expect(Number.isFinite(result.damage)).toBe(true);
  });
  it.each([0,1,2,3,4,5])('replays all support potentials at breakthrough %s',limitBreak=>{
    const potentials=Object.fromEntries(ids.map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)]));
    const first=run(limitBreak,potentials),replay=run(limitBreak,potentials);
    expect(first.damage).toBeGreaterThan(0);
    expect(first.damage).toBe(replay.damage);expect(first.trace).toEqual(replay.trace);
    expect((first.state.supportScripts!['137']!.drones as unknown[]).length).toBeLessThanOrEqual(3);
    expect(first.state.hitCounts?.['137:137300012']).toBeGreaterThan(0);
    expect(first.state.hitCounts?.['137:137300013']).toBeGreaterThan(0);
  });
});
