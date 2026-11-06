import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import type {LiveCombatInput} from '../core/combat-live-build';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const read=async(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const tables=await loadExampleCombatTables(read,[132,115,162]);
const ids=[513201,513202,513203,513204,513205,513206,513207,513208,513209,513210,513211,513212,513213,513241,513242,513243];
function run(limitBreak:number,potentials:Record<number,number>,hold=false){
  const live:LiveCombatInput={actors:[
    {id:132,level:90,ascension:8,limitBreak,potentials,skillSlots:{1:8,2:8,4:8,5:8}},
    ...[115,162].map(id=>({id,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{2:8,4:8,5:8}})),
  ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
  const profile=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:true});
  const policy={name:'ready',choose:(_state:any,legal:string[])=>legal.find(key=>key.includes('ultimate'))
    ?? (hold?legal.find(key=>key.endsWith('-hold')):null) ?? legal[0] ?? null};
  return evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
}
describe('132 bound skill stages and enhancement windows',()=>{
  it.each([0,...ids])('executes main potential %s independently',id=>{
    const result=run(5,id?{[id]:Math.min(6,tables.potentials[id]!.MaxLevel!)}:{});
    for(const key of ['normal','skill','ultimate'])expect(result.state.counts[`132:${key}`]).toBeGreaterThan(0);
    expect(Object.entries(result.state.counts).some(([key,count])=>key.startsWith('132:skill2')&&Number(count)>0)).toBe(true);
    expect(Number.isFinite(result.damage)).toBe(true);
  });
  it.each([0,1,2,3,4,5])('replays all main potentials at breakthrough %s',limitBreak=>{
    const potentials=Object.fromEntries(ids.map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)]));
    const first=run(limitBreak,potentials),replay=run(limitBreak,potentials);
    expect(first.damage).toBeGreaterThan(0);
    expect(first.damage).toBe(replay.damage);expect(first.trace).toEqual(replay.trace);
    expect(first.state.counts['132:skill3'] ?? first.state.counts['132:skill3-enhanced']).toBeGreaterThan(0);
  });
  it('offers the native minimum and maximum hold durations without changing records',()=>{
    const short=run(0,{}),hold=run(0,{},true);
    expect(hold.state.counts['132:skill2-hold']).toBeGreaterThan(0);
    expect(short.state.counts['132:skill2-hold']).toBeUndefined();
    expect(hold.damage).not.toBe(short.damage);
  });
});
