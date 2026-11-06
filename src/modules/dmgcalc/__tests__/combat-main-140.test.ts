import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import type {LiveCombatInput} from '../core/combat-live-build';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const read=async(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const tables=await loadExampleCombatTables(read,[140,156,149]);
const ids=[514001,514002,514003,514004,514005,514006,514007,514008,514009,514010,514011,514012,514013,514041,514042,514043];
function profile(limitBreak:number,potentials:Record<number,number>){
  const live:LiveCombatInput={actors:[
    {id:140,level:90,ascension:8,limitBreak,potentials,skillSlots:{1:8,2:8,4:8,5:8}},
    ...[156,149].map(id=>({id,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{2:8,4:8,5:8}})),
  ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
  return createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:true});
}
function run(form:'tank'|'cannon',limitBreak:number,potentials:Record<number,number>){
  const p=profile(limitBreak,potentials);
  const policy={name:form,choose:(_state:any,legal:string[])=>{
    const valid=legal.filter(key=>!key.startsWith('140:skill-')||key===`140:skill-${form}`);
    return valid.find(key=>key.includes('ultimate')) ?? valid[0] ?? null;
  }};
  return evaluateCombatPolicies(p.model,[policy],180,60,p.boss.switchRate)[0]!;
}
describe.each(['tank','cannon'] as const)('140 %s transformation controller',form=>{
  it.each([0,...ids])('executes main potential %s independently',id=>{
    const result=run(form,5,id?{[id]:Math.min(6,tables.potentials[id]!.MaxLevel!)}:{});
    expect(result.state.counts[`140:skill-${form}`]).toBeGreaterThan(0);
    expect(result.state.counts[`140:${form}-normal`]).toBeGreaterThan(0);
    expect(result.state.counts['140:ultimate']).toBeGreaterThan(0);
    expect(result.state.counts['140:return']).toBeGreaterThan(0);
    expect(result.damage).toBeGreaterThan(0);
    expect(Number.isFinite(result.damage)).toBe(true);
  });
  it.each([0,1,2,3,4,5])('replays main potentials at breakthrough %s',limitBreak=>{
    const potentials=Object.fromEntries(ids.map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)]));
    const first=run(form,limitBreak,potentials),replay=run(form,limitBreak,potentials);
    expect(first.damage).toBe(replay.damage);expect(first.trace).toEqual(replay.trace);
    expect(first.state.counts[`140:${form}-skill`]).toBeGreaterThan(0);
    if(form==='tank')expect(first.state.hitCounts?.['140:140509001']).toBeGreaterThan(0);
    expect(first.state.hitCounts?.['140:140511001']).toBeGreaterThan(0);
  });
});
