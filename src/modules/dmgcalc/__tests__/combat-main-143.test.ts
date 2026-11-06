import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import type {LiveCombatInput} from '../core/combat-live-build';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const read=async(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const tables=await loadExampleCombatTables(read,[143,133,162]);
const ids=[514301,514302,514303,514304,514305,514306,514307,514308,514309,514310,514311,514312,514313,514341,514342,514343];
function run(limitBreak:number,potentials:Record<number,number>,distance=2,supportPotentials:Record<number,number>={}){
  const live:LiveCombatInput={actors:[
    {id:143,level:90,ascension:8,limitBreak,potentials,skillSlots:{1:8,2:8,4:8,5:8}},
    {id:133,level:90,ascension:8,limitBreak:0,potentials:supportPotentials,skillSlots:{2:8,4:8,5:8}},
    {id:162,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{2:8,4:8,5:8}},
  ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
  const profile=createExampleCombatModel({...fixture,live},tables,{boss:29,distance,cinematics:true});
  const policy={name:'ready',choose:(_state:any,legal:string[])=>legal.find(key=>key.includes('ultimate')) ?? legal[0] ?? null};
  return evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
}
describe('143 native charge-funded main skill',()=>{
  it.each([0,...ids])('executes main potential %s independently',id=>{
    const result=run(5,id?{[id]:Math.min(6,tables.potentials[id]!.MaxLevel!)}:{});
    for(const key of ['normal','skill','ultimate'])expect(result.state.counts[`143:${key}`]).toBeGreaterThan(0);
    expect(result.state.counts['143:skill:charge-consumed']).toBeGreaterThan(0);
    expect(Number.isFinite(result.damage)).toBe(true);
  });
  it.each([0,1,2,3,4,5])('replays all main potentials with valid Wind flower support at breakthrough %s',limitBreak=>{
    const potentials=Object.fromEntries(ids.map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)]));
    const supportPotentials=Object.fromEntries([513321,513323,513324,513327,513328,513330].map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)]));
    const first=run(limitBreak,potentials,5,supportPotentials),replay=run(limitBreak,potentials,5,supportPotentials);
    expect(first.damage).toBeGreaterThan(0);
    expect(first.damage).toBe(replay.damage);expect(first.trace).toEqual(replay.trace);
    expect(first.state.counts['143:dodge']).toBeGreaterThan(0);
  });
});
