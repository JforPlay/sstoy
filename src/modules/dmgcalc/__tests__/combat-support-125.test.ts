import {describe,it,expect} from 'vitest';
import {createSupport125,freesiaFlowers} from '../core/combat-support-125';
import {combatTagHash as hash} from '../core/combat-tags';
import {mockApi,profile} from './combat-four-helpers';
describe('프리지아 지원 원본 실행',()=>{
  it('세 갈래의 첫 꽃을 중복 생성하지 않음',()=>{expect(freesiaFlowers(false)).toHaveLength(16);expect(freesiaFlowers(true)).toHaveLength(22);});
  it('겹친 꽃은 개화와 폭발 각각 하나의 공격 ID만 사용',()=>{
    const a=createSupport125({512521:1,512522:1}),api=mockApi(125);a.custom!(a.initialize(api),api,'Start_Hurt');
    expect(api.schedule).toHaveBeenCalledTimes(2);expect(api.schedule).toHaveBeenCalledWith('flower-hit',0,{id:125320001});
    expect(api.schedule).toHaveBeenCalledWith('flower-hit',43/60,{id:125320002});
  });
  it('P27은 명중 여부와 무관하게 모든 꽃의 종료 위치에 생성',()=>{
    const a=createSupport125({512527:1}),api=mockApi(125);api.distance=100;a.custom!(a.initialize(api),api,'Start_Hurt');
    expect(api.schedule).toHaveBeenCalledTimes(16);
  });
  it('P30은 3초를 더하고 원본 20스택 상한 유지',()=>{
    const a=createSupport125({512530:1}),api=mockApi(125);let s=a.custom!(a.initialize(api),api,'StartRage');
    api.removeStacks(api.actor,12500002,5);s={...s,rage:15};s=a.cast!(s,api,'skill');expect(s.rage).toBe(18);
    s=a.cast!(s,api,'skill');expect(s.rage).toBe(20);
  });
  it('ReceiveAttack의 냉기·동결 조건 및 엄격한 P24 재발동 간격',()=>{
    const a=createSupport125({512524:1}),api=mockApi(125),tags=[hash('125_P24')];let s=a.attacked!(a.initialize(api),api,tags);
    expect(api.schedule).not.toHaveBeenCalled();api.hasBuffTag=()=>true;s=a.attacked!(s,api,tags);expect(api.schedule).toHaveBeenCalledTimes(1);
    api.time=2;s=a.attacked!(s,api,tags);expect(api.schedule).toHaveBeenCalledTimes(1);api.time=2.01;a.attacked!(s,api,tags);expect(api.schedule).toHaveBeenCalledTimes(2);
  });
  it.each([true,false])('궁극기→상주 일반 공격→광폭 종료 (연출=%s)',cinematics=>{
    const p=profile(125,'support',{},cinematics);let s=p.model.initial();s.sp.ledger.pools['125']!.value=s.sp.ledger.pools['125']!.capacity;
    s=p.model.cast(s,'125:ultimate',0).state;s=p.model.advance(s,12).state;
    expect(s.counts['125:normal']).toBeGreaterThan(0);expect(s.supportScripts!['125']!.rage).toBeGreaterThan(0);
    s=p.model.advance(s,32).state;expect(s.supportScripts!['125']!.rage).toBe(0);
  });
  it('꽃 피해가 실제 물 표식을 부여',()=>{
    const p=profile(125,'support');p.scenario.automatic=()=>null;let s=p.model.cast(p.model.initial(),'125:skill',0).state;s=p.model.advance(s,2).state;
    expect(s.hitCounts?.['125:125320001']).toBe(1);expect(s.hitCounts?.['125:125320002']).toBe(1);expect(p.buffApi(s).count('boss',4011)).toBeGreaterThan(0);
  });
});
