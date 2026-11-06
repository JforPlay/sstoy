// combat-workflow: native-matrix
import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import {createMain110} from '../core/combat-main-110';
import type {SupportCombatApi} from '../core/combat-support-adapter';
import {combatTagHash as hash} from '../core/combat-tags';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const tables=await loadExampleCombatTables(async name=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8')),[110,157,145]);
const ids=[1,2,3,4,5,6,7,8,9,10,11,12,13,41,42,43].map(n=>511000+n);
function profile(limitBreak:number,potentials:Record<number,number>){
  const live={actors:[110,157,145].map(id=>({id,level:90,ascension:8,limitBreak:id===110?limitBreak:0,potentials:id===110?potentials:{},skillSlots:{1:8,2:8,4:8,5:8}})),
    records:fixture.records,notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
  return createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:true});
}
const policy={name:'ready',choose:(_s:any,legal:string[])=>legal.find(key=>key.includes('ultimate'))??legal[0]??null};
function run(limitBreak:number,potentials:Record<number,number>){const p=profile(limitBreak,potentials);return evaluateCombatPolicies(p.model,[policy],180,60,p.boss.switchRate)[0]!;}
describe('Firen native main combat',()=>{
  it('routes breakthrough buffs to the live avatar group, including marks triggered by an avatar',()=>{
    const p=profile(3,{});p.scenario.automatic=()=>null;
    let s=p.model.cast(p.model.initial(),'110:skill',0).state;
    s=p.model.advance(s,.1).state;
    expect(p.buffApi(s).count('110#1',11096221)).toBe(1);
    expect(p.buffApi(s).count('110#1',11096321)).toBe(0); // not born at the first cast event
    p.buffApi(s).add('boss',5011,'157');s=p.model.advance(s,.4).state;
    expect(p.buffApi(s).count('110',11096111)).toBeGreaterThan(0);
    expect(p.buffApi(s).count('110#1',11096121)).toBeGreaterThan(0);
    s=p.model.advance(s,3).state;s.ready['110:skill']=0;
    s=p.model.cast(s,'110:skill',3).state;
    expect(p.buffApi(s).count('110#1',11096321)).toBe(1);
    expect(p.buffApi(s).count('110#2',11096321)).toBe(0);
  });
  it.each([false,true])('settles exactly three original skill hits plus P1 extra hits (P1 %s)',enabled=>{
    const p=profile(0,enabled?{511001:1}:{});p.scenario.automatic=()=>null;
    const s=p.model.advance(p.model.cast(p.model.initial(),'110:skill',0).state,3).state;
    expect(s.hitCounts?.['110:110300001']).toBe(3);
    expect(s.hitCounts?.['110:110300005'] ?? 0).toBe(enabled?3:0);
  });
  it.each([0,...ids])('executes potential %s independently for 180s',id=>{
    const result=run(5,id?{[id]:Math.min(6,tables.potentials[id]!.MaxLevel!)}:{});
    expect(result.damage).toBeGreaterThan(0);expect(result.state.counts['110:skill']).toBeGreaterThan(0);expect(result.state.counts['110:ultimate']).toBeGreaterThan(0);
    expect(Object.keys(result.state.hitCounts ?? {}).some(key=>key.startsWith('110#'))).toBe(true);
    if(id===511001)expect(result.state.hitCounts?.['110:110300005']).toBeGreaterThan(0);
    if(id===511002)expect(result.state.hitCounts?.['110:110300002']).toBeGreaterThan(0);
    if(id===511004)expect(Object.keys(result.state.hitCounts ?? {}).some(key=>key.endsWith(':110900004'))).toBe(true);
    if(id===511005)expect(result.state.hitCounts?.['110:110300003']).toBeGreaterThan(0);
  });
  it.each([0,1,2,3,4,5])('replays all potentials and breakthrough %s deterministically',lb=>{
    const potentials=Object.fromEntries(ids.map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)]));
    const first=run(lb,potentials),again=run(lb,potentials);
    expect(first.damage).toBe(again.damage);expect(first.trace).toEqual(again.trace);
    expect(first.state.hitCounts?.['110:110000000']).toBeGreaterThan(0);
    const max=2+2+1;expect((first.state.supportScripts!['110']!.avatars as unknown[]).length).toBeLessThanOrEqual(max);
  });
  it('copies initial attributes, adds only summon buffs, and excludes owner-only post-hit effects',()=>{
    const p=profile(0,{511042:6}),initial=p.model.initial();
    p.scenario.automatic=()=>null;
    let s=p.model.cast(initial,'110:skill',0).state;
    s=p.model.advance(s,.1).state;
    const summon=Object.values(s.summons!)[0]!;
    expect(summon.attributes).toEqual(initial.initialAttributes!['110']);
    const snapshot=structuredClone(summon.attributes);
    p.buffApi(s).add('110',11042011,'110');
    expect(s.summons!['110#1']!.attributes).toEqual(snapshot);
    expect(s.summons!['110#1']!.attributes).not.toEqual(p.attributes(s,'110'));
    // Keep only the already-issued summon timeline. Its hits must not grant
    // the owner's P42 buff, SP, normal-hit counters or another summon.
    s.buffs={};s.motions={};s.queue=s.queue.filter(e=>e.data?.independentEntity!==undefined);
    const before=s.sp.ledger.pools['110']!.value;
    s=p.model.advance(s,2).state;
    expect(Object.keys(s.hitCounts ?? {}).some(key=>key.startsWith('110#'))).toBe(true);
    expect(p.buffApi(s).count('110',11042011)).toBe(0);
    expect(s.sp.ledger.pools['110']!.value).toBe(before);
  });
});

function apiFixture(){
  const buffs=new Map<string,number>();
  return {actor:'110',main:'110',party:['110','157','145'],time:0,distance:2,
    buffs:{add:(owner:string,id:number)=>buffs.set(`${owner}:${id}`,(buffs.get(`${owner}:${id}`) ?? 0)+1),remove:(owner:string,id:number)=>buffs.delete(`${owner}:${id}`),count:(owner:string,id:number)=>buffs.get(`${owner}:${id}`) ?? 0},
    actorsByElement:()=>['110','157','145'],parameter:(id:number)=>({11000011:2,11000012:5,11030011:1,11040011:1,11080011:1,11050901:3,11005011:40,11005012:80,11005013:1,11005014:2} as Record<number,number>)[id] ?? 0,
    summon:vi.fn(),despawn:vi.fn(),emitProc:vi.fn(),schedule:vi.fn(),independentLease:vi.fn(),independentCombo:vi.fn(()=>2),area:vi.fn(),hit:vi.fn(),randomPercent:()=>0,
  } as unknown as SupportCombatApi;
}
describe('Firen individual native state rules',()=>{
  it('uses other dark actors, not total party size, for the P4 avatar cap',()=>{
    const api=apiFixture();api.actorsByElement=()=>['110'];
    const r=createMain110({511004:6});let s=r.initialize(api);
    for(let n=0;n<3;n++)s=r.custom!(s,api,'110_Main_Skill_ZhaoHuanFenShen');
    expect(s.avatars).toHaveLength(2);expect(api.despawn).toHaveBeenCalledWith(1);
  });
  it('adds periodic and skill avatars but removes the oldest exactly once at the cap',()=>{
    const api=apiFixture(),r=createMain110({511003:1,511004:6,511008:6,511009:6});let s=r.initialize(api);
    for(let n=0;n<3;n++)s=r.custom!(s,api,'110_Main_Skill_ZhaoHuanFenShen');
    expect(s.avatars).toHaveLength(5);expect(api.despawn).toHaveBeenCalledTimes(1);
    expect(api.area).toHaveBeenCalledWith('AreaEffect_110_Main_FenShen_DieBoom','boss',{entity:1});
    s=r.event!(s,api,'avatar-expire',{id:1});expect(api.despawn).toHaveBeenCalledTimes(1);
    expect(api.schedule).toHaveBeenCalledWith('avatar-expire',8,{id:6});
  });
  it('absorbs all active avatars before the ultimate and clears only the temporary ultimate effects on end',()=>{
    const api=apiFixture(),r=createMain110({511041:1,511043:6});let s=r.initialize(api);
    s=r.custom!(s,api,'110_Main_Skill_ZhaoHuanFenShen');s=r.custom!(s,api,'110_Main_Skill_ZhaoHuanFenShen');
    s=r.cast!(s,api,'ultimate');expect(s.avatars).toHaveLength(0);expect(api.buffs.count('110',11054111)).toBe(2);
    r.end!(s,api,'ultimate',false);expect(api.buffs.count('110',11054111)).toBe(0);
  });
  it('does not stack command timelines or repeat the same active summon skill',()=>{
    const api=apiFixture(),r=createMain110({});let s=r.custom!(r.initialize(api),api,'110_Main_Skill_ZhaoHuanFenShen');
    s=r.custom!(s,api,'110_FenShen_ChongCi');s=r.custom!(s,api,'110_FenShen_ChongCi');
    expect(api.independentCombo).toHaveBeenCalledTimes(1);
    r.custom!(s,api,'110_FenShen_SanLianZhan');expect(api.independentLease).toHaveBeenCalledWith('avatar:1:1',0);
    expect(api.independentCombo).toHaveBeenCalledTimes(2);
  });
  it('P10 queues normal stage four, P7 ends at skill disable, and P13 grants three dodge charges',()=>{
    const api=apiFixture(),r=createMain110({511010:6,511007:6,511013:6});
    api.buffs.add('110',11050711);const s=r.end!(r.initialize(api),api,'skill',false);
    expect(s.stage).toBe(3);expect(api.buffs.count('110',11050711)).toBe(0);
    expect(r.actions(false).find(a=>a.kind==='dodge')!.charges).toBe(3);
  });
  it('P5 preserves the original strict cooldown/counter gate, including chained extra skill hits',()=>{
    const api=apiFixture(),r=createMain110({511005:6}),tags=[hash('110MainSanDuanZhanAtk')],hit={actor:'110',damageType:2,element:6,slot:2,tags};
    let s=r.initialize(api);for(let n=0;n<4;n++)s=r.afterHit!(s,api,tags,hit);
    expect(api.hit).toHaveBeenCalledTimes(3);api.time=1.01;s=r.afterHit!(s,api,tags,hit);expect(api.hit).toHaveBeenCalledTimes(4);
  });
});
