import {describe,it,expect} from 'vitest';
import {createMain155} from '../core/combat-main-155';
import {combatTagHash as hash} from '../core/combat-tags';
import {mockApi,profile} from './combat-four-helpers';
describe('시아 메인 원본 실행',()=>{
  it('궤도는 기본 백2 흑1, P6 백3 흑1, 최대 궤도3개',()=>{
    for(const p6 of [false,true]){const a=createMain155(p6?{515506:1}:{}),api=mockApi(155);let s=a.initialize(api);
      for(let i=0;i<4;i++)s=a.custom!(s,api,'Summon_Orbit');expect(s.orbits).toHaveLength(3);expect(s.drones).toHaveLength(p6?12:9);
    }
  });
  it('P2는 궤도 수명을 1.85초 연장',()=>{
    const a=createMain155({515502:1}),api=mockApi(155),s=a.custom!(a.initialize(api),api,'Summon_Orbit');expect(s.orbits[0]!.expires).toBeCloseTo(12.85);
  });
  it('일반 공격 명령은 백1·흑2·백3·흑4 순서',()=>{
    const a=createMain155({}),api=mockApi(155);let s=a.event!(a.initialize(api),api,'companions',{});
    for(let n=1;n<=4;n++)s=a.custom!(s,api,`Attack_${n}`);
    expect(api.independentCombo).toHaveBeenNthCalledWith(1,'15501_White_Attack_1',expect.anything());expect(api.independentCombo).toHaveBeenNthCalledWith(4,'15501_Black_Attack_4',expect.anything());
  });
  it('궁극기 연사 40회 / P43 50회, 대상 주위 반경4 산포 유지',()=>{
    for(const p43 of [false,true]){const a=createMain155(p43?{515543:1}:{}),api=mockApi(155);a.event!(a.initialize(api),api,'ult-start',{burst:0});
      expect(api.schedule).toHaveBeenCalledTimes(p43?51:41);
    }
  });
  it('P42는 나머지 지원 궁극기가 모두 쿨타임일 때만 적용',()=>{
    const a=createMain155({515542:1}),api=mockApi(155);api.ultimateCooling=()=>false;a.cast!(a.initialize(api),api,'ultimate');expect(api.buffs.count(api.actor,15542011)).toBe(0);
    api.ultimateCooling=()=>true;a.cast!(a.initialize(api),api,'ultimate');expect(api.buffs.count(api.actor,15542011)).toBe(1);
  });
  it('P1/P2 20스택 폭발, P13 체력 조건을 분리',()=>{
    const a=createMain155({515501:1,515513:1}),api=mockApi(155);let s=a.initialize(api);
    for(let i=0;i<20;i++){api.time+=.01;s=a.afterHit!(s,api,[hash('155_P01_Boom')],{} as any);}expect(api.hit).toHaveBeenCalledWith(155310101);
    api.bossHpPercent=()=>.6;expect(a.beforeHit!(s,api,[])).toEqual([]);api.bossHpPercent=()=>.49;expect(a.beforeHit!(s,api,[])).toContainEqual({id:15513001,count:1});
  });
  it.each([true,false])('궁극기 실탄 영역 피해 및 궤도 자연 종료 (연출=%s)',cinematics=>{
    const p=profile(155,'main',{},cinematics);p.scenario.automatic=()=>null;let s=p.model.cast(p.model.initial(),'155:skill',0).state;s=p.model.advance(s,2).state;
    expect(s.supportScripts!['155']!.orbits).toHaveLength(1);s.sp.ledger.pools['155']!.value=s.sp.ledger.pools['155']!.capacity;
    s=p.model.cast(s,'155:ultimate',2).state;s=p.model.advance(s,16).state;expect(s.supportScripts!['155']!.orbits).toHaveLength(0);expect(s.damage).toBeGreaterThan(0);
    expect(Object.keys(s.hitCounts??{}).some(k=>k.startsWith('155:1554'))).toBe(true);
  });
});
