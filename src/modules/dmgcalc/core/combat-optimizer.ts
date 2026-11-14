import { createExampleCombatModel, type ExampleCombatOptions, type ExampleCombatTables } from './combat-example-model';
import type { CombatBuildExample } from './combat-build';
import { evaluateCombatPolicies, type CombatPolicy } from './combat-policy-search';
import type { CombatRuntimeState,CombatActionLog } from './combat-runtime';
import { combatBuffCount } from './combat-buffs';
import type { LiveCombatInput } from './combat-live-build';
import { createCombatRuntime } from './combat-runtime';
import { withNormalDodgeCancel } from './combat-normal-cancel';
import {MAX_SEARCH_WORKERS} from './combat-search-limits';

export interface CyclePolicy { hotaruHold: number; tiliaHold: number; ultimateHold: number; mainHold: number; supportsFirst: boolean; longSkillHold?:boolean;transform?:'tank'|'cannon'; normalCancelEvery?: number }
export interface CycleCast { time: number; action: string; sp: number; requiredSp: number }
export interface CycleCandidate {
  name: string; policy: CyclePolicy; damage: number; damageScore: number; improvement: number;
  casts: CycleCast[]; counts: Record<string, number>; bossLevel: number;
  sp: CombatRuntimeState['sp']['ledger']['pools'];
  actions:CombatActionLog[];
  strategyIndex:number;
}
export interface CycleSearchResult {
  input?: LiveCombatInput;
  candidates: CycleCandidate[]; baseline: number; tested: number; duration: number; switchRate: number;
  options: ExampleCombatOptions; assumptions: string[]; notes: Record<number, number>; buildRank: number;
  technical: { once: number; maximum: number; description: string };
}

export function makeCyclePolicy(config: CyclePolicy, main: string, supports: string[]): CombatPolicy<CombatRuntimeState> {
  return { name: `지원 대기 ${config.hotaruHold}/${config.tiliaHold}초 · 궁 대기 ${config.ultimateHold}초 · 메인 대기 ${config.mainHold}초${config.longSkillHold?' · 길게 유지':''}${config.transform?` · ${config.transform==='tank'?'탱크':'기관포'} 변신`:''}${config.normalCancelEvery?` · 평타 ${config.normalCancelEvery}동작 후 회피 캔슬`:''}`,
    choose(state, legal, time) {
      const mainReady = legal.some(id=>id.startsWith(`${main}:skill`))?0:Math.max(0, (state.ready[`${main}:skill`] ?? 0) / 60 - time);
      const nearEnd = time > 172;
      const holdForMain = (maximum: number) => !nearEnd && mainReady > 0 && mainReady <= maximum;
      const allowed = legal.filter(id => {
        if (id === `${supports[0]}:skill`) return !holdForMain(config.hotaruHold);
        if (id === `${supports[1]}:skill`) return !holdForMain(config.tiliaHold);
        if (id.includes('ultimate')) return !holdForMain(config.ultimateHold);
        if (id === `${main}:skill` && config.mainHold && !nearEnd) {
          const skyStacks = combatBuffCount(state.buffs, main, 4039130, time);
          const supportReady = Math.min(...supports.map(actor => Math.max(0, (state.ready[`${actor}:skill`] ?? 0) / 60 - time)));
          if ((main!=='162'||skyStacks<3) && supportReady > 0 && supportReady <= config.mainHold) return false;
        }
        return true;
      });
      const forActor=(actor:string)=>allowed.filter(id=>id.startsWith(`${actor}:`));
      const supportSkills = supports.flatMap(actor=>forActor(actor).filter(id=>!id.includes('ultimate')));
      const supportUltimates = supports.flatMap(actor=>forActor(actor).filter(id=>id.includes('ultimate')));
      const mainActions = [...new Set([`${main}:extra`, `${main}:ultimate:rapier`, `${main}:ultimate:claymore`, `${main}:ultimate`, `${main}:skill`,
        ...forActor(main).sort((a,b)=>Number(b.endsWith('-hold')===Boolean(config.longSkillHold))-Number(a.endsWith('-hold')===Boolean(config.longSkillHold)))])];
      const priority = config.supportsFirst
        ? [...[...supportSkills].reverse(), ...[...supportUltimates].reverse(), ...mainActions]
        : [...mainActions, ...supportUltimates, ...supportSkills];
      return priority.find(id => allowed.includes(id)&&(!config.transform||!id.startsWith(`${main}:skill-`)
        ||!['tank','cannon'].includes(id.slice(`${main}:skill-`.length))||id===`${main}:skill-${config.transform}`)) ?? null;
    } };
}

/** Bounded, reproducible policy search, not a claim of a global optimum.
 * Every candidate is replayed for the whole 180 seconds at the client logic rate.
 */
export function optimizeExampleCycles(example: CombatBuildExample, tables: ExampleCombatTables, options: ExampleCombatOptions,
  progress?: (done: number, total: number) => void,partition={index:0,count:1}): CycleSearchResult {
  if(!Number.isInteger(partition.count)||partition.count<1||partition.count>MAX_SEARCH_WORKERS||!Number.isInteger(partition.index)||partition.index<0||partition.index>=partition.count)throw new Error('Invalid search partition');
  const profile = createExampleCombatModel(example, tables, options);
  const main = profile.scenario.actors.find(actor => actor.main)!.id;
  const supports = profile.scenario.actors.filter(actor => !actor.main).map(actor => actor.id);
  const configurations: CyclePolicy[] = [{ hotaruHold: 0, tiliaHold: 0, ultimateHold: 0, mainHold: 0, supportsFirst: false }];
  for (const hotaruHold of [0, 2, 4, 6]) for (const tiliaHold of [0, 1.5, 3]) for (const ultimateHold of [0, 2, 4]) {
    configurations.push({ hotaruHold, tiliaHold, ultimateHold, mainHold: ultimateHold ? 1 : 0, supportsFirst: true });
  }
  // Compare both actor priorities; support order also matters for mark/buff
  // applications on the same tick. Keep the previous 37 as a strict subset.
  for(const config of configurations.slice(1))configurations.push({...config,supportsFirst:false});
  for(const hotaruHold of [1,3,8])for(const tiliaHold of [0,2,6])for(const ultimateHold of [0,3])
    configurations.push({hotaruHold,tiliaHold,ultimateHold,mainHold:2,supportsFirst:true});
  if(options.searchDepth==='deep'){
    for(const hotaruHold of [0,1,2,4,6,8])for(const tiliaHold of [0,1,2,3,4,6])for(const ultimateHold of [0,2,4,6])
      for(const supportsFirst of [false,true])configurations.push({hotaruHold,tiliaHold,ultimateHold,mainHold:ultimateHold?3:0,supportsFirst});
  }
  const uniqueConfigs=new Set<string>();
  for(let index=0;index<configurations.length;){const key=JSON.stringify(configurations[index]);if(uniqueConfigs.has(key))configurations.splice(index,1);else{uniqueConfigs.add(key);index++;}}
  if(profile.scenario.actions.some(action=>action.id.endsWith('-hold'))){
    for(const config of [...configurations])configurations.push({...config,longSkillHold:true});
  }
  if(['tank','cannon'].every(form=>profile.scenario.actions.some(action=>action.id===`${main}:skill-${form}`))){
    for(const config of [...configurations])configurations.push({...config,transform:'cannon'});
    for(const config of configurations)config.transform ??='tank';
  }
  // Explore cancel timing against all existing support/ultimate policies, not
  // just the winning non-cancel policy: SP and buff alignment can change.
  if (profile.scenario.actions.some(action => action.actor === main && action.flag === 16)) {
    for (const config of [...configurations]) for (const every of [1, 2, 3, 4])
      configurations.push({ ...config, normalCancelEvery: every });
  }
  const results: { config: CyclePolicy; index:number; result: ReturnType<typeof evaluateCombatPolicies<CombatRuntimeState>>[number] }[] = [];
  const modelFor = (config: CyclePolicy,recordActions=false) => createCombatRuntime({...(
    config.normalCancelEvery?withNormalDodgeCancel(profile.scenario, config.normalCancelEvery):profile.scenario),recordActions});
  const assigned=configurations.map((config,index)=>({config,index})).filter(row=>row.index%partition.count===partition.index);
  progress?.(0,assigned.length);
  for (const [completed,{index,config}] of assigned.entries()) {
    const result = evaluateCombatPolicies(modelFor(config), [makeCyclePolicy(config, main, supports)], example.durationSeconds, 60, profile.boss.switchRate, 1)[0]!;
    results.push({ config,index, result });
    progress?.(completed + 1, assigned.length);
  }
  const baseline = results.find(row=>row.index===0)?.result.damageScore ?? evaluateCombatPolicies(modelFor(configurations[0]!),[makeCyclePolicy(configurations[0]!,main,supports)],example.durationSeconds,60,profile.boss.switchRate,1)[0]!.damageScore;
  const unique = new Set<string>();
  const candidates: CycleCandidate[] = [];
  for (const entry of results.sort((a, b) => b.result.damage - a.result.damage||a.index-b.index)) {
    const key = JSON.stringify([entry.result.trace, entry.result.damage]);
    if (unique.has(key)) continue;
    unique.add(key);
    // Replay the selected candidates to attach actual SP immediately before
    // each cast. This is also a second legality check, not a generated timeline.
    const model = modelFor(entry.config,true);
    let state = model.initial();
    const casts: CycleCast[] = [];
    for (const cast of entry.result.trace) {
      state = model.advance(state, cast.time).state;
      const action = profile.scenario.actions.find(action => action.id === cast.action)!;
      casts.push({ ...cast, sp: state.sp.ledger.pools[action.actor]!.value / 10000, requiredSp: action.spCost / 10000 });
      state = model.cast(state, cast.action, cast.time).state;
    }
    state = model.advance(state, example.durationSeconds).state;
    if (Math.abs(state.damage - entry.result.damage) > .01) throw new Error('Cycle replay disagrees with search');
    candidates.push({ name: entry.result.name, policy: entry.config, damage: entry.result.damage, damageScore: entry.result.damageScore,
      improvement: entry.result.damageScore - baseline, casts, counts: state.counts, bossLevel: state.boss!.level, sp: state.sp.ledger.pools,
      actions:(state.actionLog??[]).map(row=>({...row,end:Math.min(row.end,example.durationSeconds)})),strategyIndex:entry.index });
    if (candidates.length === 5) break;
  }
  const control = tables.bossTables.technical[tables.bossTables.levels[options.boss].NonDamageScoreGet];
  return { candidates, baseline, tested: assigned.length, duration: example.durationSeconds, switchRate: profile.boss.switchRate, options, input: example.live,
    notes: profile.build.notes, buildRank: profile.build.rank,
    technical: { once: control.OnceScore, maximum: control.MaxLimit,
      description: String(tables.bossTables.technicalText[control.Desc] ?? control.Desc)
        .replace(/<[^>]*>/g, '').replaceAll('&Param1&', String(control.OnceScore))
        .replaceAll('&Param2&', String(Math.floor(control.MaxLimit / control.OnceScore))).replaceAll('&Param3&', String(control.MaxLimit)) },
    assumptions: [
      `캐릭터 레벨 ${profile.build.assumedActorLevels.join(' / ')} · 스킬 레벨 ${profile.build.assumedSkillLevels.join(' / ')}`,
      '돌파 능력치 노드: 모두 활성',
      ...(example.live ? ['입력값: 현재 파티·잠재력·소리·배지·레코드',
        `레코드 ${example.live.records.map(record => record.id ? `${record.id} Lv.${record.level} 돌파 ${record.limitBreak}` : '빈 슬롯').join(' / ')}`,
        `활성 협주 ${Object.entries(profile.build.actors[0]!.context.concertos).map(([id, level]) => `${id} Lv.${level}`).join(' / ') || '없음'}`]
        : ['레코드 Lv81 / 돌파 511111 · 협주 555331', '음표는 협주 최소치 · 배지 옵션 없음 · 프리셋은 제공된 코드 사용']),
      '대상: 보스 1명, 명중 유지 · 이동·피격 손실 제외',
      ...(main==='110'?['분신: 시작 능력치 복사 · 버프·수명·명령 공격·흡수·소멸 피해 반영']:[]),
      ...(profile.scenario.actors.some(actor=>actor.id==='133')?['회전 무기: 보스 접촉 유지, 재타격 간격 반영',
        '곡선 유도탄: 비행 종료 후 첫 타격에 명중']:[]),
      '치명타: 확률 평균 · 시간: 초당 60프레임, 연출 정지 제외',
      '회피 캔슬: 평타 1~4동작 후 비교 · 취소 가능 구간·충전·쿨타임 반영 · 이동 캔슬 제외',
      `확률 효과: 고정 난수 시드 ${options.randomSeed ?? 108162}로 1회 계산`,
      '기술 점수: 성공 횟수 직접 입력 · 결과: 탐색한 조합 중 최고 점수',
      '예측값이며 실전과 차이가 날 수 있습니다.',
    ] };
}
