import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import {planCombatWeapon,type ExtractedCombatWeapon} from '../core/combat-weapons';
import type {LiveCombatInput} from '../core/combat-live-build';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const read=async(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const tables=await loadExampleCombatTables(read,[133,143,162]);
const ids=[513301,513302,513303,513304,513305,513306,513307,513308,513309,513310,513311,513312,513313,513341,513342,513343];
function run(limitBreak:number,potentials:Record<number,number>,cinematics=false){
  const live:LiveCombatInput={actors:[
    {id:133,level:90,ascension:8,limitBreak,potentials,skillSlots:{1:8,2:8,4:8,5:8}},
    ...[143,162].map(id=>({id,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{2:8,4:8,5:8}})),
  ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
  const profile=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics});
  const policy={name:'ready',choose:(_state:any,legal:string[])=>legal.find(key=>key.includes('ultimate')) ?? legal[0] ?? null};
  return evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
}
describe('133 native channel and orbit lifecycle',()=>{
  it('requires explicit sustained contact and shares target immunity across every rotating collider',()=>{
    const data=JSON.parse(readFileSync('public/data/combat/133.json','utf8'));
    const weapon=data.weapons.find((weapon:ExtractedCombatWeapon)=>weapon.name==='Bullet_13301_Ultra_TornadoRotatex2');
    expect(()=>planCombatWeapon(weapon,2,60)).toThrow(/sustained-contact/);
    const plan=planCombatWeapon(weapon,2,60,undefined,[],{AssumeContinuousRotateContact:1});
    expect(plan.impacts[0]!.time).toBe(1/60);
    expect(plan.impacts[1]!.time-plan.impacts[0]!.time).toBeCloseTo(16/60);
    expect(plan.impacts).toHaveLength(12);
    expect(plan.snapshot).toBe(false);
  });
  it.each([0,...ids])('runs main potential %s independently',id=>{
    const result=run(5,id?{[id]:Math.min(6,tables.potentials[id]!.MaxLevel!)}:{},true);
    expect(result.state.counts['133:normal']).toBeGreaterThan(0);
    expect(result.state.counts['133:skill']).toBeGreaterThan(0);
    expect(result.state.counts['133:ultimate']).toBeGreaterThan(0);
    if(id===513313)expect(result.state.counts['133:dodge']).toBeGreaterThan(0);
    expect(Number.isFinite(result.damage)).toBe(true);
  });
  it.each([0,1,2,3,4,5])('replays a legal complete main build at breakthrough %s',limitBreak=>{
    const potentials=Object.fromEntries(ids.filter(id=>id!==513303).map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)]));
    const first=run(limitBreak,potentials),replay=run(limitBreak,potentials);
    expect(first.damage).toBeGreaterThan(0);
    expect(first.damage).toBe(replay.damage);expect(first.trace).toEqual(replay.trace);
    expect(first.state.counts['133:dodge']).toBeGreaterThan(0);
  });
});
