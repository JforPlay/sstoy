import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import type {LiveCombatInput} from '../core/combat-live-build';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const read=async(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const tables=await loadExampleCombatTables(read,[139,127,137]);
const ids=[513901,513902,513903,513904,513905,513906,513907,513908,513909,513910,513911,513912,513913,513941,513942,513943];
function profile(limitBreak:number,potentials:Record<number,number>,mixed=false){
  const live:LiveCombatInput={actors:[
    {id:139,level:90,ascension:8,limitBreak,potentials,skillSlots:{1:8,2:8,4:8,5:8}},
    ...[127,...mixed?[137]:[]].map(id=>({id,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{2:8,4:8,5:8}})),
  ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
  return createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:true});
}
function run(limitBreak:number,potentials:Record<number,number>,mixed=false){
  const p=profile(limitBreak,potentials,mixed);
  const policy={name:'ready',choose:(_state:any,legal:string[])=>legal.find(key=>key.includes('ultimate')) ?? legal[0] ?? null};
  return evaluateCombatPolicies(p.model,[policy],180,60,p.boss.switchRate)[0]!;
}
describe('139 soul substitutions and independently timed ultimate stages',()=>{
  it.each([0,...ids])('executes main potential %s independently',id=>{
    const result=run(5,id?{[id]:Math.min(6,tables.potentials[id]!.MaxLevel!)}:{});
    for(const key of ['normal','skill','ultimate','ultimate-second'])expect(result.state.counts[`139:${key}`]).toBeGreaterThan(0);
    expect((result.state.hitCounts?.['139:139100101'] ?? 0)+(result.state.hitCounts?.['139:139100201'] ?? 0)).toBeGreaterThan(0);
    expect(Number.isFinite(result.damage)).toBe(true);
  });
  it.each([0,1,2,3,4,5])('replays main potentials at breakthrough %s',limitBreak=>{
    const potentials=Object.fromEntries(ids.map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)]));
    const first=run(limitBreak,potentials),replay=run(limitBreak,potentials);
    expect(first.damage).toBeGreaterThan(0);expect(first.damage).toBe(replay.damage);expect(first.trace).toEqual(replay.trace);
    expect(first.state.counts['139:soul-ultimate'],JSON.stringify(first.state.counts)).toBeGreaterThan(0);
  });
  it('does not grant the mono-water P1 replacement to a mixed party',()=>{
    const result=run(0,{513901:1,513902:1},true);
    expect(result.state.counts['139:soul-ultimate']).toBeUndefined();
  });
  it('keeps the second ultimate as a legal free decision, not an automatic chained cast',()=>{
    const p=profile(0,{});let state=p.model.initial();
    state.sp.ledger.pools['139']={...state.sp.ledger.pools['139']!,value:state.sp.ledger.pools['139']!.capacity};
    state=p.model.cast(state,'139:ultimate',0).state;
    const end=p.scenario.actions.find(action=>action.id==='139:ultimate')!.combo.duration;
    state=p.model.advance(state,end).state;
    expect(state.counts['139:ultimate-second']).toBeUndefined();
    expect(p.model.actions(state,end)).toContain('139:ultimate-second');
    const before=state.sp.ledger.pools['139']!.value;
    state=p.model.cast(state,'139:ultimate-second',end).state;
    expect(state.sp.ledger.pools['139']!.value).toBe(before);
    expect(p.scenario.actions.find(action=>action.id==='139:ultimate-second')!.spCost).toBe(0);
  });
});
