import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import type {LiveCombatInput} from '../core/combat-live-build';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const read=async(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const tables=await loadExampleCombatTables(read,[162,127,107]);
describe('water-area support on the common shield and geometry engine',()=>{
  it.each([0,1,2,3,4,5])('replays every support potential for 180 seconds at breakthrough %s',limitBreak=>{
    const potentials=Object.fromEntries([512721,512722,512723,512724,512725,512726,512727,512728,512729,512730,512731,512732,512733,512741,512742,512743]
      .map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)]));
    const live:LiveCombatInput={actors:[
      {id:162,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{1:8,2:8,4:8,5:8}},
      {id:127,level:90,ascension:8,limitBreak,potentials,skillSlots:{2:8,4:8,5:8}},
      {id:107,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{2:8,4:8,5:8}},
    ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
    const profile=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:false});
    const policy={name:'ready',choose:(_state:any,legal:string[])=>legal.find(key=>key.includes('ultimate')) ?? legal[0] ?? null};
    const run=()=>evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
    const first=run(),replay=run();
    expect(first.damage).toBe(replay.damage);
    expect(first.trace).toEqual(replay.trace);
    expect(first.state.counts['127:skill']).toBeGreaterThan(0);
    expect(first.state.counts['127:ultimate']).toBeGreaterThan(0);
    expect(first.state.supportScripts!['127']!.lastFountain).toBeGreaterThan(0);
  });
});
