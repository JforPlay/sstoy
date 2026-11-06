import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import type {LiveCombatInput} from '../core/combat-live-build';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const read=async(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const tables=await loadExampleCombatTables(read,[162,147,142,143,118,112,133,134,139,140,145,157,107]);
describe.each([134,140,157])('isolated support potential branches %s',character=>{
  const pool=tables.potentialPools[character]!;
  const ids=[...pool.AssistSpecificPotentialIds,...pool.AssistNormalPotentialIds,...pool.CommonPotentialIds];
  it.each([0,...ids])('runs potential %s on its own, not only the all-selected combination',id=>{
    const live:LiveCombatInput={actors:[
      {id:162,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{1:8,2:8,4:8,5:8}},
      {id:character,level:90,ascension:8,limitBreak:5,potentials:id?{[id]:Math.min(6,tables.potentials[id]!.MaxLevel!)}:{},skillSlots:{2:8,4:8,5:8}},
      {id:107,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{2:8,4:8,5:8}},
    ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
    const profile=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:true});
    const policy={name:'ready',choose:(_state:any,legal:string[])=>legal.find(key=>key.includes('ultimate')) ?? legal[0] ?? null};
    const result=evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
    expect(result.state.counts[`${character}:skill`]).toBeGreaterThan(0);
    expect(result.state.counts[`${character}:ultimate`]).toBeGreaterThan(0);
    expect(Number.isFinite(result.damage)).toBe(true);
  });
});
describe.each([147,142,143,118,112,133,134,139,140,145,157])('shared-clock support profile %s',character=>{
  it.each([0,1,2,3,4,5])('replays all support potentials and breakthrough %s without replacing the selected party',limitBreak=>{
    const pool=tables.potentialPools[character]!;
    const potentials=Object.fromEntries([...pool.AssistSpecificPotentialIds,...pool.AssistNormalPotentialIds,...pool.CommonPotentialIds]
      .map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)]));
    const live:LiveCombatInput={actors:[
      {id:162,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{1:8,2:8,4:8,5:8}},
      {id:character,level:90,ascension:8,limitBreak,potentials,skillSlots:{2:8,4:8,5:8}},
      {id:107,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{2:8,4:8,5:8}},
    ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
    const profile=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:false});
    const policy={name:'ready',choose:(_state:any,legal:string[])=>legal.find(key=>key.includes('ultimate')) ?? legal[0] ?? null};
    const run=()=>evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
    const first=run(),replay=run();
    expect(first.damage).toBe(replay.damage);
    expect(first.trace).toEqual(replay.trace);
    expect(first.state.counts[`${character}:skill`]).toBeGreaterThan(0);
    expect(first.state.counts[`${character}:ultimate`]).toBeGreaterThan(0);
    if(character===147)expect(first.state.supportScripts!['147']!.times).toBeInstanceOf(Array);
    if(character===142)expect(first.state.supportScripts!['142']!.claws).toBeGreaterThan(0);
    if(character===139){
      expect(first.state.supportScripts!['139']!.secondStages).toBeGreaterThan(0);
      const state=profile.model.initial(),pool=state.sp.ledger.pools['139']!;
      pool.value=pool.capacity;
      const cast=profile.model.cast(state,'139:ultimate',0).state;
      expect(cast.sp.ledger.pools['139']!.spent).toBe(pool.capacity);
      const motion=cast.motions['139']!;
      const area=motion.combo.events.find(frame=>frame.event.areaEffectPrefab?.m_PathID==='-9459324182185272')!;
      const atSpawn=profile.model.advance(cast,area.time).state;
      const spawned=Object.values(atSpawn.weapons ?? {}).find(weapon=>weapon.name==='AreaEffect_13901_Ultra2_P43');
      expect(spawned).toBeDefined();
      expect(spawned!.x).not.toBe(2);
      const finished=profile.model.advance(cast,8).state;
      expect(finished.supportScripts!['139']!.secondStages).toBe(1);
      expect(finished.sp.ledger.pools['139']!.spent).toBe(pool.capacity);
    }
    if(character===145)expect(first.state.supportScripts!['145']!.ringGeneration).toBeGreaterThan(0);
    if(character===157)expect(first.state.supportScripts!['157']!.bubbles).toBeGreaterThan(0);
    if(character===134)expect(first.state.supportScripts!['134']!.loops).toBeGreaterThan(0);
    if(character===118){
      expect(first.state.counts['118:skill:continuation']).toBeGreaterThan(0);
      expect(first.state.counts['drop:Item_118_P23_YaoShui:generated']).toBeGreaterThan(0);
    }
  });
});
