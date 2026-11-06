import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import type {LiveCombatInput} from '../core/combat-live-build';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const read=async(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const tables=await loadExampleCombatTables(read,[103,107,115,162]);
function model(limitBreak=0,potentials:Record<number,number>={},useSeina=false) {
  const live:LiveCombatInput={actors:[
    {id:103,level:90,ascension:8,limitBreak,potentials,skillSlots:{1:8,2:8,4:8,5:8}},
    {id:107,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{2:8,4:8,5:8}},
    {id:useSeina?162:115,level:90,ascension:8,limitBreak:useSeina?limitBreak:0,potentials:useSeina?Object.fromEntries(
      [516221,516222,516223,516224,516225,516226,516227,516228,516229,516230,516231,516232,516233,516241,516242,516243]
        .map(id=>[id,tables.potentials[id]!.MaxLevel!])):{},skillSlots:{2:8,4:8,5:8}},
  ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
  return createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:false});
}
describe('Kohaku on the shared main-role engine',()=>{
  it.each([0,1,2,3,4,5])('runs Seina origin as support with her potentials at breakthrough %s',limitBreak=>{
    const profile=model(limitBreak,{},true);
    const policy={name:'ready',choose:(_state:any,legal:string[])=>legal.find(key=>key.includes('ultimate')) ?? legal[0] ?? null};
    const result=evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
    expect(result.state.counts['162:skill']).toBeGreaterThan(0);
    expect(result.state.counts['162:ultimate']).toBeGreaterThan(0);
    expect(result.state.counts['162:normal:0']).toBeUndefined();
    expect(result.damage).toBeGreaterThan(0);
  });
  it('counts all three native shoot events in one uninterrupted B animation, rather than casting three full skills',()=>{
    const profile=model(),runtime=profile.model;
    let state=runtime.cast(runtime.initial(),'103:skill',0).state;
    state=runtime.advance(state,9).state;
    expect(state.counts['103:phase2']).toBeUndefined();
    expect(state.counts['103:phase3']).toBeUndefined();
    expect(state.supportScripts!['103']!.phase).toBe(0);
    expect(state.pausedCooldowns?.['103:skill']).toBeUndefined();
    expect(state.ready['103:skill']).toBeGreaterThan(8*60);
    expect(runtime.actions(state,9)).not.toContain('103:skill');
  });
  it('consumes actual ammunition and reloads without replacing the selected main',()=>{
    const profile=model(),runtime=profile.model;
    const state=runtime.advance(runtime.initial(),30).state;
    expect(state.counts['103:normal']).toBeGreaterThan(12);
    expect(state.counts['103:reload']).toBeGreaterThan(0);
    expect(state.counts['162:normal:0']).toBeUndefined();
    expect(state.damage).toBeGreaterThan(0);
  });
  it.each([0,1,2,3,4,5])('replays 180 seconds with every supported potential and breakthrough %s',limitBreak=>{
    const potentials=Object.fromEntries([510301,510302,510303,510304,510305,510306,510307,510308,510309,510310,510311,510312,510313,510341,510342,510343]
      .map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)]));
    const profile=model(limitBreak,potentials);
    const policy={name:'ready',choose:(_state:any,legal:string[])=>legal.find(key=>key.includes('ultimate')) ?? legal.find(key=>key.endsWith(':extra')) ?? legal[0] ?? null};
    const run=()=>evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
    const first=run(),second=run();
    expect(first.damage).toBe(second.damage);
    expect(first.trace).toEqual(second.trace);
    expect(first.state.counts['103:skill']).toBeGreaterThan(0);
    expect(first.state.counts['103:ultimate']).toBeGreaterThan(0);
    expect(first.state.supportScripts!['103']!.critCount).toBeDefined();
  });
});
