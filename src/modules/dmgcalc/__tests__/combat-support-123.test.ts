import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {createSupport123,crossesAnzuWall} from '../core/combat-support-123';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import type {SupportCombatApi} from '../core/combat-support-adapter';
import {combatTagHash as hash} from '../core/combat-tags';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const tables=await loadExampleCombatTables(async n=>JSON.parse(readFileSync(`public/data/${n}.json`,'utf8')),[114,123,137,142]);
const weapon=tables.timings.characters.find(c=>c.id===123)!.weapons.find(w=>w.name==='AreaEffect_123_B2_WindWall')!;
const geometry=weapon.components.find(c=>c.type==='AreaEffectEntity')!.data;
function profile(potentials:Record<number,number>,distance=2,main=137,lb=0){
  const live={actors:[main,123,142].map(id=>({id,level:90,ascension:8,limitBreak:id===123?lb:0,potentials:id===123?potentials:{},skillSlots:{1:8,2:8,4:8,5:8}})),records:fixture.records,notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
  return createExampleCombatModel({...fixture,live},tables,{boss:29,distance,cinematics:true});
}
function apiFixture(){
  const stacks=new Map<string,number>();
  return {actor:'123',main:'137',party:['137','123','142'],time:1,distance:5,
    buffs:{add:(o:string,id:number)=>stacks.set(`${o}:${id}`,(stacks.get(`${o}:${id}`)??0)+1),remove:(o:string,id:number)=>stacks.delete(`${o}:${id}`),count:(o:string,id:number)=>stacks.get(`${o}:${id}`)??0},
    area:vi.fn(()=>8),schedule:vi.fn(),shield:vi.fn(),emitProc:vi.fn(),directSp:vi.fn(),activeAreas:()=>0,actorInfo:()=>({element:4,job:0}),randomPercent:()=>0,
    weaponData:(_name:string,type:string)=>weapon.components.find(c=>c.type===type)!.data,
  } as unknown as SupportCombatApi;
}
describe('안즈 지원 원본 실행',()=>{
  it('장벽 실제 직사각형: 근접 탄환은 통과하지 않고 원거리는 통과',()=>{
    expect(crossesAnzuWall(2,0,geometry)).toBe(false);expect(crossesAnzuWall(5,0,geometry)).toBe(true);
    expect(crossesAnzuWall(2,45,geometry)).toBe(false);expect(crossesAnzuWall(5,45,geometry)).toBe(true);
  });
  it.each([false,true])('P21=%s: 장벽과 동행 영역을 1개/3개 생성하고 수명 결속',enabled=>{
    const a=createSupport123(enabled?{512321:1,512323:1}:{512323:1}),api=apiFixture();
    const s=a.custom!(a.initialize(api),api,'123WindWallShoot');expect(s.walls).toHaveLength(enabled?3:1);
    expect(api.area).toHaveBeenCalledTimes(enabled?9:3);expect(s.walls.every(w=>w.expires===9)).toBe(true);
  });
  it('P24는 통과한 메인 탄환만 강화, 만료 후에는 새 탄환 강화 없음',()=>{
    const a=createSupport123({512324:6}),api=apiFixture(),s=a.custom!(a.initialize(api),api,'123WindWallShoot');
    expect(a.projectileModifiers!(s,api,'137','bullet',2).attributes).toEqual([]);
    expect(a.projectileModifiers!(s,api,'142','bullet',5).attributes).toEqual([]);
    expect(a.projectileModifiers!(s,api,'137','bullet',5).attributes).toEqual([{id:12324001,count:1,source:'123'}]);
    api.time=9;expect(a.projectileModifiers!(s,api,'137','bullet',5).attributes).toEqual([]);
  });
  it('P25/P28 실제 풍벽 피해와 P31 일회 계수',()=>{
    const a=createSupport123({512325:6,512328:6,512331:6}),api=apiFixture(),tags=[hash('123WindWallAtk')];
    a.afterHit!(a.initialize(api),api,tags,{} as any);expect(api.buffs.count('boss',12352511)).toBe(1);expect(api.buffs.count('boss',12352811)).toBe(1);
    expect(a.beforeHit!(a.initialize(api),api,tags)).toEqual([{id:12353101,count:1}]);
  });
  it('P33는 바람 캐릭터만 독립 35% 판정',()=>{
    const a=createSupport123({512333:6}),api=apiFixture(),hit={actor:'137',element:4,slot:1,damageType:1,tags:[]};
    const s=a.preparePartyHit!(a.initialize(api),api,hit);expect(a.beforePartyHit!(s,api,hit)).toEqual([{id:12353301,count:1}]);
    api.actorInfo=()=>({element:2,job:0});expect(a.preparePartyHit!(s,api,hit).p33Hit).toBe(false);
  });
  it('P32는 마지막 안즈 영역이 종료될 때 제거',()=>{
    const a=createSupport123({512332:6}),api=apiFixture();let s=a.initialize(api);
    s=a.weaponBegin!(s,api,'AreaEffect_A');s=a.weaponBegin!(s,api,'AreaEffect_B');s=a.areaEnd!(s,api,'AreaEffect_A',{x:0,z:0});
    expect(api.buffs.count('137',12353211)).toBe(1);a.areaEnd!(s,api,'AreaEffect_B',{x:0,z:0});expect(api.buffs.count('137',12353211)).toBe(0);
  });
  it('피격·이탈·탄환 차단이 없는 고정 프로필에서 해당 효과를 공짜로 주지 않음',()=>{
    const a=createSupport123({512322:6,512327:6,512329:6,512341:6,512343:6}),api=apiFixture();let s=a.custom!(a.initialize(api),api,'123WindWallShoot');
    expect(api.buffs.count('137',12352211)).toBe(0);expect(api.buffs.count('137',12352711)).toBe(0);expect(api.buffs.count('137',12352911)).toBe(0);
    s=a.custom!(s,api,'xingzihoujiao');expect(api.shield).toHaveBeenCalledWith(12354101,'137');expect(api.directSp).not.toHaveBeenCalled();
    s=a.event!(s,api,'main-wall-exit',{});expect(api.shield).toHaveBeenCalledWith(12322001,'137');
    a.event!(s,api,'blocked-bullet',{});expect(api.buffs.count('137',12352711)).toBe(1);
  });
  it('P23 3장벽의 실제 동행 피해와 자연 종료를 계산',()=>{
    const p=profile({512321:1,512323:1,512330:6,512332:6});p.scenario.automatic=()=>null;
    let s=p.model.cast(p.model.initial(),'123:skill',0).state;s=p.model.advance(s,2).state;
    expect(p.buffApi(s).count('137',12353211)).toBe(1);expect(p.buffApi(s).count('boss',12353011)).toBeGreaterThan(0);
    expect(s.hitCounts?.['123:123320002']).toBeGreaterThan(0);
    s=p.model.advance(s,12).state;expect(p.buffApi(s).count('137',12353211)).toBe(0);expect(p.buffApi(s).count('boss',12353011)).toBe(0);
  });
  it('장벽 통과 실제 메인 투사체에 Anzu 계수를 보존',()=>{
    const p=profile({512324:1},5,114);p.scenario.automatic=()=>null;
    let s=p.model.cast(p.model.initial(),'123:skill',0).state;s=p.model.advance(s,1.5).state;
    s=p.model.cast(s,'114:normal',1.5).state;s=p.model.advance(s,1.6).state;
    expect(s.queue.some(e=>e.actor==='114'&&e.additionalAttributes?.some(a=>a.id===12324001&&a.source==='123'))).toBe(true);
  });
  it('바람 파티 180초와 돌파5를 함께 실행하고 궁극기 피해 확인',()=>{
    const ids=[21,22,23,24,25,26,27,28,29,30,31,32,33,41,42,43].map(n=>512300+n);
    const p=profile(Object.fromEntries(ids.map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel!)])),5,137,5);
    const r=evaluateCombatPolicies(p.model,[{name:'ready',choose:(_s,legal)=>legal.find(k=>k.includes('ultimate'))??legal[0]??null}],180,60,p.boss.switchRate)[0]!;
    expect(r.damage).toBeGreaterThan(0);expect(r.state.counts['123:ultimate']).toBeGreaterThan(0);expect(r.state.hitCounts?.['123:123300001']).toBeGreaterThan(0);
  });
});
