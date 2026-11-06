import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import type {LiveCombatInput} from '../core/combat-live-build';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const read=async(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const tables=await loadExampleCombatTables(read,[156,149,159]);
const ids=[515601,515602,515603,515604,515605,515606,515607,515608,515609,515610,515611,515612,515613,515641,515642,515643];
function run(limitBreak:number,potentials:Record<number,number>){
  const live:LiveCombatInput={actors:[
    {id:156,level:90,ascension:8,limitBreak,potentials,skillSlots:{1:8,2:8,4:8,5:8}},
    ...[149,159].map(id=>({id,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{2:8,4:8,5:8}})),
  ],records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
  const profile=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:true});
  const policy={name:'ready',choose:(_state:any,legal:string[])=>legal.find(key=>key.includes('ultimate')) ?? legal[0] ?? null};
  return evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
}
describe('156 ammunition and independent native doll timeline',()=>{
  it('extracts the actual non-monster-named summon archive and ammo costs',()=>{
    const actor=tables.timings.characters.find(actor=>actor.id===156)!;
    const raw=JSON.parse(readFileSync('public/data/combat/156.json','utf8'));
    expect(raw.sources.some((source:{file:string})=>source.file==='char_15601_combos_penguindoll.unity3d')).toBe(true);
    expect(actor.comboAliases.some(alias=>alias.tag==='Run_P2')).toBe(true);
    const normal=actor.comboAliases.find(alias=>alias.tag==='Atk_Shot1')!;
    const clip=actor.timelines.find(clip=>clip.pathId===normal.clips[0])!;
    expect(clip.events.find(event=>event.type===2)?.reduceAmmoCount).toBe(1);
  });
  it.each([0,...ids])('executes main potential %s independently',id=>{
    const result=run(5,id?{[id]:Math.min(6,tables.potentials[id]!.MaxLevel!)}:{});
    for(const key of ['normal','reload','skill','ultimate'])expect(result.state.counts[`156:${key}`]).toBeGreaterThan(0);
    if(id===515604)expect(result.state.counts['156:after-reload']).toBeGreaterThan(0);
    expect(result.state.hitCounts?.['156:156310002']).toBeGreaterThan(0);
    if(id===515602)expect(result.state.hitCounts?.['156:156310004']).toBeGreaterThan(0);
    expect(Number.isFinite(result.damage)).toBe(true);
  });
  it.each([0,1,2,3,4,5])('replays all main potentials at breakthrough %s',limitBreak=>{
    const potentials=Object.fromEntries(ids.map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)]));
    const first=run(limitBreak,potentials),replay=run(limitBreak,potentials);
    expect(first.damage).toBeGreaterThan(0);
    expect(first.damage).toBe(replay.damage);expect(first.trace).toEqual(replay.trace);
    expect(first.state.counts['156:after-reload']).toBeGreaterThan(0);
    expect(first.state.counts['156:dodge']).toBeGreaterThan(0);
  });
});
