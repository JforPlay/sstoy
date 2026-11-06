import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import type {LiveCombatInput} from '../core/combat-live-build';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const read=async(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const tables=await loadExampleCombatTables(read,[157,145,108,118]);
const ids=[515701,515702,515703,515704,515705,515706,515707,515708,515709,515710,515711,515712,515713,515741,515742,515743];
function run(limitBreak:number,potentials:Record<number,number>,cinematics=false,allDark=false){
  const live:LiveCombatInput={actors:[
    {id:157,level:90,ascension:8,limitBreak,potentials,skillSlots:{1:8,2:8,4:8,5:8}},
    ...[145,allDark?118:108].map(id=>({id,level:90,ascension:8,limitBreak:allDark?5:0,
      potentials:allDark?Object.fromEntries([
        ...tables.potentialPools[id]!.AssistSpecificPotentialIds,...tables.potentialPools[id]!.AssistNormalPotentialIds,...tables.potentialPools[id]!.CommonPotentialIds,
      ].map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)])):{},
      skillSlots:{2:8,4:8,5:8}})),
  ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
  const profile=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics});
  const policy={name:'ready',choose:(_state:any,legal:string[])=>legal.find(key=>key.includes('ultimate')) ?? legal[0] ?? null};
  return evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
}
describe('157 main hunting and fish states',()=>{
  it('replays an all-dark party with Otoha rain follow-ups and main conditional modifiers',()=>{
    const potentials=Object.fromEntries(ids.map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)]));
    const first=run(5,potentials,false,true),replay=run(5,potentials,false,true);
    expect(first.damage).toBe(replay.damage);expect(first.trace).toEqual(replay.trace);
    expect(first.state.counts['145:skill']).toBeGreaterThan(0);
    expect(first.state.counts['118:skill']).toBeGreaterThan(0);
    expect(first.state.supportScripts!['145']!.skillGeneration).toBeGreaterThan(0);
  });
  it.each([0,...ids])('runs main potential %s independently',id=>{
    const result=run(5,id?{[id]:Math.min(6,tables.potentials[id]!.MaxLevel!)}:{},true);
    expect(result.state.counts['157:normal']).toBeGreaterThan(0);
    expect(result.state.counts['157:hunt']).toBeGreaterThan(0);
    expect(result.state.counts['157:skill']).toBeGreaterThan(0);
    expect(result.state.counts['157:ultimate']).toBeGreaterThan(0);
    if(id===515702)expect(result.state.supportScripts!['157']!.fishAttacks).toBeGreaterThan(0);
    if(id===515712)expect(result.state.counts['157:dodge']).toBeGreaterThan(0);
    expect(Number.isFinite(result.damage)).toBe(true);
  });
  it.each([0,1,2,3,4,5])('replays all main potentials at breakthrough %s',limitBreak=>{
    const potentials=Object.fromEntries(ids.map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)]));
    const first=run(limitBreak,potentials),replay=run(limitBreak,potentials);
    expect(first.damage).toBeGreaterThan(0);
    expect(first.damage).toBe(replay.damage);expect(first.trace).toEqual(replay.trace);
    expect(first.state.supportScripts!['157']!.fishAttacks).toBeGreaterThan(0);
    expect(first.state.counts['157:dodge']).toBeGreaterThan(0);
    expect(first.state.sp.ledger.pools['162']).toBeUndefined();
  });
});
