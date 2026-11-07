import {describe,it,expect} from 'vitest';
import {createMain119} from '../core/combat-main-119';
import {planCombatWeapon} from '../core/combat-weapons';
import {combatTagHash as hash} from '../core/combat-tags';
import {mockApi,profile,tables} from './combat-four-helpers';
describe('나노하 메인 원본 실행',()=>{
  it('P13 회피 충전 증가와 시전 버프',()=>{
    const a=createMain119({511913:1}),api=mockApi(119);expect(a.actions(true).find(a=>a.kind==='dodge')!.charges).toBe(2);
    a.cast!(a.initialize(api),api,'dodge');expect(api.buffs.count(api.actor,11951311)).toBe(1);
  });
  it('P6 궁극기 대기 보너스는 SP 부족이 아닌 실제 쿨타임 조건',()=>{
    const a=createMain119({511906:1}),api=mockApi(119),s=a.initialize(api),tags=[hash('119NrmAtk')];
    api.ultimateCooling=()=>false;expect(a.beforeHit!(s,api,tags)).not.toContainEqual({id:11950602,count:1});
    api.ultimateCooling=()=>true;expect(a.beforeHit!(s,api,tags)).toContainEqual({id:11950602,count:1});
  });
  it('부메랑은 전진·귀환에서 각각 명중하고 네이티브 접촉 시간을 사용',()=>{
    const weapon=tables.timings.characters.find(c=>c.id===119)!.weapons.find(w=>w.name==='Bullet_11901_Skill1_BulltA')!;
    const plan=planCombatWeapon(weapon,2,60);expect(plan.impacts).toHaveLength(2);expect(plan.impacts[0]!.time).toBeCloseTo(.1);expect(plan.impacts[1]!.time).toBeGreaterThan(.5);
    expect(planCombatWeapon(weapon,99,60).impacts).toHaveLength(0);
  });
  it('각 부메랑 연쇄는 8번째 투척에서 종료',()=>{
    const a=createMain119({}),api=mockApi(119);a.event!(a.initialize(api),api,'boomerang-return',{count:8});expect(api.projectile).toHaveBeenCalledTimes(1);expect(api.schedule).not.toHaveBeenCalled();
  });
  it('분신 2/3개, 수명 증가, 기존 명령 교체와 본체 귀속 타격',()=>{
    const a=createMain119({511906:1,511942:1,511943:1}),api=mockApi(119);api.parameter=()=>5;
    const s=a.custom!(a.initialize(api),api,'119Summon');expect(s.avatars).toHaveLength(3);expect(s.avatars.every(a=>a.expires===31)).toBe(true);
    expect(api.buffs.count(api.actor,11950611)).toBe(2);expect(api.independentCombo).toHaveBeenCalledWith('Birth',expect.not.objectContaining({entity:expect.anything()}));
    a.custom!(s,api,'119Summon');expect(api.despawn).toHaveBeenCalledTimes(3);expect(api.buffs.count(api.actor,11950611)).toBe(2);
  });
  it('P10은 분신 두 개까지만 스킬 명령',()=>{
    const a=createMain119({511910:1,511942:1}),api=mockApi(119);let s=a.custom!(a.initialize(api),api,'119Summon');s=a.cast!(s,api,'skill');
    expect(s.avatars.filter(a=>a.generation===2)).toHaveLength(2);
  });
  it('궁극기 후 분신 일반 공격을 계산하고 만료시 버프 제거',()=>{
    const p=profile(119,'main',{511906:1,511942:1});p.scenario.automatic=()=>null;let s=p.model.initial();s.sp.ledger.pools['119']!.value=s.sp.ledger.pools['119']!.capacity;
    s=p.model.cast(s,'119:ultimate',0).state;s=p.model.advance(s,10).state;expect(s.supportScripts!['119']!.avatars).toHaveLength(3);expect(s.damage).toBeGreaterThan(0);
    s=p.model.advance(s,35).state;expect(s.supportScripts!['119']!.avatars).toHaveLength(0);expect(p.buffApi(s).count('119',11950611)).toBe(0);
  });
});
