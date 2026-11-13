import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {createSupport161} from '../core/combat-support-161';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import {makeCyclePolicy} from '../core/combat-optimizer';
const read=(name:string)=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8'));
const tables=await loadExampleCombatTables(async name=>read(name),[139,161,142,162]);
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const pool=read('CharPotential')[161];
const ids=[...pool.AssistSpecificPotentialIds,...pool.AssistNormalPotentialIds,...pool.CommonPotentialIds] as number[];
const all=Object.fromEntries(ids.map(id=>[id,Math.min(6,tables.potentials[id]!.MaxLevel ?? 1)]));
function profile(potentials:Record<number,number>,limitBreak=0,main=139,distance=2){
  const live={actors:[main,161,142].map(id=>({id,level:90,ascension:8,limitBreak:id===161?limitBreak:0,potentials:id===161?potentials:{},skillSlots:{1:8,2:8,4:8,5:8}})),records:fixture.records,notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
  return createExampleCombatModel({...fixture,live},tables,{boss:29,distance,cinematics:false});
}
describe('스구하 지원 원본 실행',()=>{
  it('소환물 범위 밖의 보스에게 지원 스킬 피해를 공짜로 부여하지 않음',()=>{
    const p=profile(all,0,139,30);p.scenario.automatic=()=>null;
    const s=p.model.advance(p.model.cast(p.model.initial(),'161:skill',0).state,16).state;
    expect(s.damage).toBe(0);
  });
  it('1돌파는 다른 캐릭터가 부여한 땅 표식에도 반응',()=>{
    const p=profile({},1),s=p.model.initial();
    p.buffApi(s).add('boss',6011,'139');
    expect(p.buffApi(s).count('boss',16196111)).toBe(1);
  });
  it('3돌파 지원 스킬 버프는 땅 속성 파티원에만 적용',()=>{
    const p=profile({},3,162),s=p.model.cast(p.model.initial(),'161:skill',0).state;
    expect(p.buffApi(s).count('161',16196311)).toBe(1);
    expect(p.buffApi(s).count('162',16196311)).toBe(0);
  });
  it('P21은 두 관측 지점 공존, P23은 연장 수명보다 우선 만료',()=>{
    const p=profile({516121:1});let s=p.model.advance(p.model.cast(p.model.initial(),'161:skill',0).state,14).state;
    s=p.model.cast(s,'161:skill',14).state;s=p.model.advance(s,15).state;
    expect(s.supportScripts!['161']!.beacons).toHaveLength(2);
    const q=profile({516121:1,516123:1});const t=q.model.advance(q.model.cast(q.model.initial(),'161:skill',0).state,13).state;
    expect(t.supportScripts!['161']!.beacons).toHaveLength(0);
  });
  it('P43 궁 사용 불가 버프를 유지하되 준비되면 제거',()=>{
    const p=profile({516143:1}),s=p.model.advance(p.model.initial(),.1).state;
    expect(p.buffApi(s).count('161',16143012)).toBe(1);
    s.sp.ledger.pools['161']!.value=s.sp.ledger.pools['161']!.capacity;
    const t=p.model.advance(s,.2).state;
    expect(p.buffApi(t).count('161',16143012)).toBe(0);
  });
  it('지원 잠재력 전부를 등록하고 각 분기를 별도로 실행',()=>{
    expect([...createSupport161({}).potentials].sort()).toEqual([...ids].sort());
    for(const id of [0,...ids]){
      const p=profile(id?{[id]:all[id]!}:{}),s=p.model.advance(p.model.cast(p.model.initial(),'161:skill',0).state,16).state;
      expect(Number.isFinite(s.damage),String(id)).toBe(true);
      expect(s.damage,String(id)).toBeGreaterThan(0);
    }
  },30000);
  it('첫 시전부터 승급하고 두 단계 승급도 4회에서 제한',()=>{
    const p=profile({516122:1,516127:1});
    let s=p.model.cast(p.model.initial(),'161:skill',0).state;
    expect(s.supportScripts!['161']!.level).toBe(2);
    s=p.model.advance(s,14).state;s=p.model.cast(s,'161:skill',14).state;
    expect(s.supportScripts!['161']!.level).toBe(4);
  });
  it('관측 지점 만료 후 장판 피해가 계속 남지 않음',()=>{
    const p=profile({});p.scenario.automatic=()=>null;
    let s=p.model.advance(p.model.cast(p.model.initial(),'161:skill',0).state,15).state;
    expect(s.supportScripts!['161']!.beacons).toHaveLength(0);
    const damage=s.damage;s=p.model.advance(s,25).state;expect(s.damage).toBe(damage);
  });
  it('지연 폭발이 발생하고 강화 분기는 3스택 즉시 폭발',()=>{
    const variants:Record<number,number>[]=[{516123:1},{516123:1,516124:1,516130:1}];
    for(const potentials of variants){
      const p=profile(potentials),s=p.model.advance(p.model.cast(p.model.initial(),'161:skill',0).state,16).state;
      expect(s.hitCounts?.['161:161320003']).toBeGreaterThan(0);
    }
  });
  for(let limitBreak=0;limitBreak<=5;limitBreak++)it(`전체 잠재력 ${limitBreak}돌파 180초 계산`,()=>{
    const p=profile(all,limitBreak);
    const result=evaluateCombatPolicies(p.model,[makeCyclePolicy({hotaruHold:0,tiliaHold:0,ultimateHold:0,mainHold:0,supportsFirst:true},'139',['161','142'])],180,60,p.boss.switchRate,1)[0]!;
    expect(result.damage).toBeGreaterThan(0);
    expect(result.trace.some(c=>c.action==='161:ultimate')).toBe(true);
    expect(result.trace.filter(c=>c.action==='161:skill').length).toBeGreaterThan(10);
  },30000);
});
