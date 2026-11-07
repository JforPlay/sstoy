import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {createSupport126} from '../core/combat-support-126';
import type {SupportCombatApi,SupportCombatHit} from '../core/combat-support-adapter';
import {combatTagHash as hash} from '../core/combat-tags';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const tables=await loadExampleCombatTables(async n=>JSON.parse(readFileSync(`public/data/${n}.json`,'utf8')),[114,126,158]);
function apiFixture(){
  const map=new Map<string,number>();
  return {actor:'126',main:'114',party:['114','126','158'],time:1,distance:2,
    buffs:{add:(o:string,id:number)=>map.set(`${o}:${id}`,(map.get(`${o}:${id}`)??0)+1),remove:(o:string,id:number)=>map.delete(`${o}:${id}`),count:(o:string,id:number)=>map.get(`${o}:${id}`)??0},
    actorInfo:()=>({element:2,job:0}),actorsByElement:()=>['114','126','158'],randomPercent:()=>0,buffDuration:()=>10,
    projectile:vi.fn(),projectileAs:vi.fn(),area:vi.fn(),schedule:vi.fn(),hasBuffTag:()=>true,
  } as unknown as SupportCombatApi;
}
const hit:SupportCombatHit={actor:'114',element:2,damageType:1,slot:1,tags:[]};
describe('플로라 지원 원본 실행',()=>{
  it('샤통 차지·플로라 전체 잠재력을 함께 180초 실행하고 실제 메인 추가탄·나비 만료 연사 확인',()=>{
    const flora=[21,22,23,24,25,26,27,28,29,30,31,32,33,41,42,43].map(n=>512600+n);
    const chaton=[1,2,3,4,5,6,7,8,9,10,11,12,13,41,42,43].map(n=>511400+n);
    const live={actors:[114,126,158].map(id=>({id,level:90,ascension:8,limitBreak:5,potentials:Object.fromEntries((id===114?chaton:id===126?flora:[]).map(n=>[n,Math.min(6,tables.potentials[n]!.MaxLevel!)])),skillSlots:{1:8,2:8,4:8,5:8}})),records:fixture.records,notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
    const p=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:true});
    const r=evaluateCombatPolicies(p.model,[{name:'charge',choose:(_s,legal)=>legal.find(k=>k.includes('ultimate'))??legal.find(k=>k==='114:skill-long')??legal[0]??null}],180,60,p.boss.switchRate)[0]!;
    expect(r.state.counts['114:skill-long']).toBeGreaterThan(0);expect(r.state.counts['126:ultimate']).toBeGreaterThan(0);
    expect(r.state.hitCounts?.['114:126522001']).toBeGreaterThan(0);
    expect(Object.keys(r.state.hitCounts??{}).some(k=>k.startsWith('126:126530'))).toBe(true);
  });
  it.each([false,true])('P21/P23=%s: 불꽃/잿빛 나비 3개 또는 5개',enabled=>{
    const a=createSupport126(enabled?{512621:1,512623:1}:{}),api=apiFixture();a.custom!(a.initialize(api),api,'126SupportAttack');
    expect(api.projectile).toHaveBeenCalledTimes(enabled?5:3);expect(api.buffs.count('114',12632003)).toBe(enabled?5:3);
  });
  it('P22 단일 보스 재타격은 플로라가 아닌 메인 명의 탄환',()=>{
    const a=createSupport126({512622:1}),api=apiFixture();api.buffs.add('boss',12632001);
    let s=a.preparePartyHit!(a.initialize(api),api,hit);expect(api.projectileAs).toHaveBeenCalledWith('114','Bullet_12601_Skill2_ButterflyFire_Perk22_Self',.3);
    a.preparePartyHit!(s,api,hit);expect(api.projectileAs).toHaveBeenCalledTimes(1);
  });
  it('P24는 메인 불 피해만 확률 검사, 현재 타격의 추가 계수 제공',()=>{
    const a=createSupport126({512624:6}),api=apiFixture();api.buffs.add('114',12632003);
    let s=a.preparePartyHit!(a.initialize(api),api,hit);expect(a.beforePartyHit!(s,api,hit)).toContainEqual({id:12652401,count:1});
    s=a.preparePartyHit!(s,api,{...hit,actor:'158'});expect(s.p24Hit).toBe(false);
  });
  it('P27/P28/P32는 실제 파티 치명타 때만 발동',()=>{
    const a=createSupport126({512627:6,512628:6,512632:6}),api=apiFixture();let s=a.partyCrit!(a.initialize(api),api,hit);
    expect(api.buffs.count('114',12652811)).toBe(1);expect(api.buffs.count('114',12653211)).toBe(1);expect(api.projectile).toHaveBeenCalledTimes(1);
    api.time=2;s=a.partyCrit!(s,api,{...hit,actor:'158'});expect(api.buffs.count('114',12653211)).toBe(1);
  });
  it('P30 잿빛 나비 만료 시 0.08초 간격의 별도 연사',()=>{
    const a=createSupport126({512630:6,512623:1}),api=apiFixture();let s=a.custom!(a.initialize(api),api,'126SupportAttack');api.buffs.remove('114',12632003);
    s=a.event!(s,api,'ash-expire',{ashGeneration:s.ashGeneration});
    expect(api.schedule).toHaveBeenCalledWith('ash-volley',.32,{volleyGeneration:s.volleyGeneration,index:4});
    a.event!(s,api,'ash-volley',{volleyGeneration:s.volleyGeneration,index:0});expect(api.projectile).toHaveBeenLastCalledWith('Bullet_12601_Skill2_ButterflyFire_Perk30_2');
  });
  it('P41 화환 디버프는 정산 전, 메인에게도 적용',()=>{
    const a=createSupport126({512641:6}),api=apiFixture();a.beforePartySettlement!(a.initialize(api),api,{...hit,tags:[hash('126_Ultra_FireRing')]});
    expect(api.buffs.count('boss',12654111)).toBe(1);
  });
  it.each([[],[512642],[512643],[512642,512643]].map(ids=>({ids})))('궁극기 알 조합 $ids의 생성과 실제 피해',({ids})=>{
    const live={actors:[114,126,158].map(id=>({id,level:90,ascension:8,limitBreak:0,potentials:id===126?Object.fromEntries(ids.map(n=>[n,6])):{},skillSlots:{1:8,2:8,4:8,5:8}})),records:fixture.records,notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
    const p=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:true});p.scenario.automatic=()=>null;
    let s=p.model.initial();s.sp.ledger.pools['126']!.value=s.sp.ledger.pools['126']!.capacity;
    s=p.model.cast(s,'126:ultimate',0).state;s=p.model.advance(s,2).state;
    expect(Object.values(s.weapons??{}).some(w=>w.name.includes('PhoenixEgg'))).toBe(true);
    s=p.model.advance(s,15).state;
    expect(Object.entries(s.hitCounts??{}).some(([key,count])=>key.startsWith('126:')&&count>0)).toBe(true);
  });
});
