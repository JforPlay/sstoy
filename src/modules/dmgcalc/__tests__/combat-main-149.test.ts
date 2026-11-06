import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import type {LiveCombatInput} from '../core/combat-live-build';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const read=async(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const tables=await loadExampleCombatTables(read,[149,140,159]);
const ids=[514901,514902,514903,514904,514905,514906,514907,514908,514909,514910,514911,514912,514913,514941,514942,514943];
function run(limitBreak:number,potentials:Record<number,number>,cinematics=false){
  const live:LiveCombatInput={actors:[
    {id:149,level:90,ascension:8,limitBreak,potentials,skillSlots:{1:8,2:8,4:8,5:8}},
    ...[140,159].map(id=>({id,level:90,ascension:8,limitBreak:5,potentials:Object.fromEntries([
      ...tables.potentialPools[id]!.AssistSpecificPotentialIds,...tables.potentialPools[id]!.AssistNormalPotentialIds,...tables.potentialPools[id]!.CommonPotentialIds,
    ].map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)])),skillSlots:{2:8,4:8,5:8}})),
  ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
  const profile=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics});
  const policy={name:'ready',choose:(_state:any,legal:string[])=>legal.find(key=>key.includes('ultimate')) ?? legal[0] ?? null};
  return evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
}
describe('149 main live-source summon links',()=>{
  it.each([0,...ids])('runs main potential %s independently in an all-earth party',id=>{
    const result=run(5,id?{[id]:Math.min(6,tables.potentials[id]!.MaxLevel!)}:{},true);
    expect(result.state.counts['149:normal']).toBeGreaterThan(0);
    expect(result.state.counts['149:skill']).toBeGreaterThan(0);
    expect(result.state.counts['149:ultimate']).toBeGreaterThan(0);
    expect(result.state.supportScripts!['149']!.summons).toBeGreaterThan(0);
    expect(result.state.counts['140:resident:0']).toBeGreaterThan(0);
    if(id===514911)expect(result.state.counts['149:dodge']).toBeGreaterThan(0);
    expect(result.state.gray).toBeUndefined();
    expect(Number.isFinite(result.damage)).toBe(true);
  });
  it.each([0,1,2,3,4,5])('replays all main potentials at breakthrough %s',limitBreak=>{
    const potentials=Object.fromEntries(ids.map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)]));
    const first=run(limitBreak,potentials),replay=run(limitBreak,potentials);
    expect(first.damage).toBeGreaterThan(0);
    expect(first.damage).toBe(replay.damage);expect(first.trace).toEqual(replay.trace);
    expect(first.state.counts['149:dodge']).toBeGreaterThan(0);
    expect(first.state.sp.ledger.pools['162']).toBeUndefined();
  });
});
