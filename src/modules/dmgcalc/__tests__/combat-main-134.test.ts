import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import {createMain134} from '../core/combat-main-134';
import type {SupportCombatApi} from '../core/combat-support-adapter';
import type {LiveCombatInput} from '../core/combat-live-build';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const read=async(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const tables=await loadExampleCombatTables(read,[134,140,157]);
const ids=[513401,513402,513403,513404,513405,513406,513407,513408,513409,513410,513411,513412,513413,513441,513442,513443];
describe('134 main ammunition and native attacks',()=>{
  it.each([0,...ids])('runs main potential %s independently, including the unmodified three-round magazine',id=>{
    const live:LiveCombatInput={actors:[
      {id:134,level:90,ascension:8,limitBreak:5,potentials:id?{[id]:Math.min(6,tables.potentials[id]!.MaxLevel!)}:{},
        skillSlots:{1:8,2:8,4:8,5:8}},
      ...[140,157].map(id=>({id,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{2:8,4:8,5:8}})),
    ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
    const profile=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:true});
    const policy={name:'ready',choose:(_state:any,legal:string[])=>legal.find(key=>key.includes('ultimate')) ?? legal[0] ?? null};
    const result=evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
    expect(result.state.counts['134:normal']).toBeGreaterThan(0);
    expect(result.state.counts['134:skill']).toBeGreaterThan(0);
    expect(result.state.counts['134:ultimate']).toBeGreaterThan(0);
    expect(Number.isFinite(result.damage)).toBe(true);
    expect(result.state.supportScripts!['134']!.ammo).toBeLessThanOrEqual(id===513401?9:3);
  });
  it.each([0,1,2,3,4,5])('replays every main potential at breakthrough %s for three minutes',limitBreak=>{
    const live:LiveCombatInput={actors:[
      {id:134,level:90,ascension:8,limitBreak,potentials:Object.fromEntries(ids.map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)])),
        skillSlots:{1:8,2:8,4:8,5:8}},
      ...[140,157].map(id=>({id,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{2:8,4:8,5:8}})),
    ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
    const profile=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:false});
    const policy={name:'ready',choose:(_state:any,legal:string[])=>legal.find(key=>key.includes('ultimate')) ?? legal[0] ?? null};
    const run=()=>evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
    const first=run(),replay=run();
    expect(first.damage).toBeGreaterThan(0);
    expect(first.damage).toBe(replay.damage);expect(first.trace).toEqual(replay.trace);
    expect(first.state.counts['134:normal']).toBeGreaterThan(0);
    expect(first.state.counts['134:skill']).toBeGreaterThan(0);
    expect(first.state.counts['134:ultimate']).toBeGreaterThan(0);
    expect(first.state.supportScripts!['134']!.ammo).toBeGreaterThanOrEqual(0);
    expect(first.state.supportScripts!['134']!.ammo).toBeLessThanOrEqual(9);
    expect(first.state.sp.ledger.pools['162']).toBeUndefined();
  });
  it('consumes special ammo at the native event, not when the normal attack is selected',()=>{
    const api={actor:'134',time:0,party:['134'],actorsByElement:()=>[],buffs:{add(){},remove(){},count:()=>0}} as unknown as SupportCombatApi;
    const rules=createMain134({513401:1,513404:1});
    let state=rules.initialize(api);
    state=rules.custom!(state,api,'Add_Ammo_End');
    state=rules.end!(state,api,'skill',false);
    state=rules.cast!(state,api,'normal');
    expect(state.ammo).toBe(9);
    expect(rules.comboTag!(state,api,'normal')).toBe('Attack_Strengthen_P04');
    state=rules.custom!(state,api,'Use_Bullet');expect(state.ammo).toBe(6);
    state=rules.end!(state,api,'normal',false);
    state=rules.cast!(state,api,'normal');
    expect(rules.comboTag!(state,api,'normal')).toBe('Attack_Strengthen_1');
    state=rules.custom!(state,api,'Use_Bullet');expect(state.ammo).toBe(5);
  });
});
