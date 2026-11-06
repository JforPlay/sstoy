import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {prepareCombatBuild} from '../core/combat-build';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import {makeCyclePolicy} from '../core/combat-optimizer';
import type {LiveCombatInput} from '../core/combat-live-build';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const read=async(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const tables=await loadExampleCombatTables(read,[162,132,107]);
const lotteryTables=await loadExampleCombatTables(read,[162,156,107]);
const roseTables=await loadExampleCombatTables(read,[162,159,107]);
const main=prepareCombatBuild(fixture,tables).actors[0]!;
describe('shared support adapter execution',()=>{
  it.each([0,1,2,3,4,5])('executes seven positioned support areas and party-wide breakthroughs at LB %s',limitBreak=>{
    const potentials=Object.fromEntries([515921,515922,515923,515924,515925,515926,515927,515928,515929,515930,515931,515932,515933,515941,515942,515943]
      .map(id=>[id,Math.min(6,roseTables.potentials[id]!.BuildScore.length)]));
    const live:LiveCombatInput={actors:[
      {id:162,level:90,ascension:8,limitBreak:1,potentials:main.context.potentials,skillSlots:main.context.skillSlots},
      {id:159,level:90,ascension:8,limitBreak,potentials,skillSlots:{2:8,4:8,5:8}},
      {id:107,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{2:8,4:8,5:8}},
    ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
    const profile=createExampleCombatModel({...fixture,live},roseTables,{boss:29,distance:2,cinematics:false});
    const policy=makeCyclePolicy({hotaruHold:2,tiliaHold:1,ultimateHold:2,mainHold:0,supportsFirst:true},'162',['159','107']);
    const run=()=>evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
    const first=run(),replay=run();
    expect(first.damage).toBe(replay.damage);
    expect(first.state.counts['159:skill']).toBeGreaterThan(0);
    expect(first.state.counts['159:ultimate']).toBeGreaterThan(0);
    expect(first.state.supportScripts!['159']!.generation).toBeGreaterThan(0);
    expect(first.trace).toEqual(replay.trace);
  });
  it.each([0,1,2,3,4,5])('executes the five-draw support state machine and all reviewed potential branches at LB %s',limitBreak=>{
    const potentials=Object.fromEntries([515621,515622,515623,515624,515625,515626,515627,515628,515629,515630,515631,515632,515633,515641,515642,515643]
      .map(id=>[id,Math.min(6,lotteryTables.potentials[id]!.BuildScore.length)]));
    const live:LiveCombatInput={actors:[
      {id:162,level:90,ascension:8,limitBreak:1,potentials:main.context.potentials,skillSlots:main.context.skillSlots},
      {id:156,level:90,ascension:8,limitBreak,potentials,skillSlots:{2:8,4:8,5:8}},
      {id:107,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{2:8,4:8,5:8}},
    ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
    const profile=createExampleCombatModel({...fixture,live},lotteryTables,{boss:28,distance:2,cinematics:true});
    const policy=makeCyclePolicy({hotaruHold:2,tiliaHold:1,ultimateHold:2,mainHold:0,supportsFirst:true},'162',['156','107']);
    const run=()=>evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
    const first=run(),replay=run();
    expect(first.damage).toBe(replay.damage);
    expect(first.state.counts['156:raffle']).toBeGreaterThan(0);
    expect(first.state.counts['156:sculpture']).toBeGreaterThan(0);
    expect(first.state.counts['156:heart']).toBeGreaterThan(0);
    expect(first.trace).toEqual(replay.trace);
  });
  it.each([0,1,2,3,4,5])('executes the 132 controller and breakthroughs at LB %s for the whole battle',limitBreak=>{
    const live:LiveCombatInput={actors:[
      {id:162,level:90,ascension:8,limitBreak:1,potentials:main.context.potentials,skillSlots:main.context.skillSlots},
      {id:132,level:90,ascension:8,limitBreak,potentials:{},skillSlots:{2:8,4:8,5:8}},
      {id:107,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{2:8,4:8,5:8}},
    ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
    const profile=createExampleCombatModel({...fixture,live},tables,{boss:28,distance:2,cinematics:true});
    const policy=makeCyclePolicy({hotaruHold:0,tiliaHold:0,ultimateHold:0,mainHold:0,supportsFirst:true},'162',['132','107']);
    const run=()=>evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
    const first=run(),replay=run();
    expect(first.damage).toBeGreaterThan(0);
    expect(first.damage).toBe(replay.damage);
    expect(first.trace).toEqual(replay.trace);
    expect(first.state.counts['132:skill']).toBeGreaterThan(0);
    expect(first.state.counts['132:ultimate']).toBeGreaterThan(0);
    expect(first.state.supportScripts!['132']).toBeDefined();
  });
  it.each([true,false])('executes reviewed star-stack potential branches (cinematics %s)',cinematics=>{
    const potentials=Object.fromEntries([513221,513222,513223,513224,513225,513226,513227,513228,513229,513230,513231,513232,513233,513241,513242,513243]
      .map(id=>[id,Math.min(6,tables.potentials[id]!.BuildScore.length)]));
    const live:LiveCombatInput={actors:[
      {id:162,level:90,ascension:8,limitBreak:1,potentials:main.context.potentials,skillSlots:main.context.skillSlots},
      {id:132,level:90,ascension:8,limitBreak:5,potentials,skillSlots:{2:8,4:8,5:8}},
      {id:107,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{2:8,4:8,5:8}},
    ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
    const profile=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics});
    const policy=makeCyclePolicy({hotaruHold:2,tiliaHold:1,ultimateHold:2,mainHold:0,supportsFirst:true},'162',['132','107']);
    const run=()=>evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
    const first=run(),replay=run();
    expect(first.state.tick).toBe(10800);
    expect(first.damage).toBe(replay.damage);
    expect(first.state.supportScripts!['132']!.lastCounterHit).toBeGreaterThan(0);
    expect(first.state.counts['drop:Item_132_Support_P24_Star:generated']).toBeGreaterThan(0);
    expect(first.state.counts['drop:Item_132_Support_P24_Star:picked']).toBeGreaterThan(0);
    expect(Object.values(first.state.shields!).some(shield=>shield.id===13223011 && shield.owner==='162')).toBe(true);
    expect(first.trace).toEqual(replay.trace);
  });
});
