import type { RecordRuleBuffs } from './combat-record-rules';
import { combatTagHash } from './combat-tags';
import {runCombatProcs,initialCombatProcs,combatProcContext} from './combat-procs';
import {character162BreakthroughRules} from './combat-breakthrough-rules';
export interface SeinaScriptState {
  form: 'claymore' | 'rapier'; lastExtra: number; rapierLockedUntil: number;
  extraBoundAt: number | null; burstGeneration: number;
  lastMarkSword?:number;
}
export interface SeinaScriptApi {
  time: number; actor: string; balanceActors: string[]; lightActorCount: number;
  buffs: RecordRuleBuffs;
  parameter(id: number): number;
  /** Starts the exact coroutine generation; all older scheduled ticks cancel. */
  startBurstRegen(generation: number): void;
  sword(hitId: number): void;
  area(name: string, forwardOffset?:number): void;
}
const NORMAL = 1014643206, QING_AND_QI = -460925555, TRIGGER = -1219492980, SWORD = -583115216;
const GLIMMER_HIT = -722969706;
/** Selected preset's main-control script branches only. Every returned once
 * attribute is resolved with its own metadata/potential level by the caller. */
export function createSeinaRules(potentials: Record<number, number>, breakthrough: number, glimmerId: number) {
  const has = (id: number) => (potentials[id] ?? 0) > 0;
  const burst = has(516243) ? 16243011 : 16290003;
  const run=(api:SeinaScriptApi,event:string,tags:number[]=[],hpFraction=1,eliteOrBoss=true)=>runCombatProcs(character162BreakthroughRules,initialCombatProcs(),
    combatProcContext(api,event,breakthrough,[api.actor],api.actor,tags,{hpFraction,eliteOrBoss,burstPotential43:has(516243),
      burstUltraBuff:api.buffs.count(api.actor,burst)>0,glimmer:api.buffs.count('boss',glimmerId)>0}));
  const addBurst = (state: SeinaScriptState, api: SeinaScriptApi) => {
    api.buffs.add(api.actor, burst, api.actor);
    const result = { ...state, burstGeneration: state.burstGeneration + 1 };
    if (has(516243)) api.startBurstRegen(result.burstGeneration);
    return result;
  };
  return {
    initialize(api: SeinaScriptApi): SeinaScriptState {
      if (has(516212)) for (let count = 0; count < api.lightActorCount; count++) api.buffs.add(api.actor, 16212011, api.actor);
      run(api,'initialize');
      return { form: 'claymore', lastExtra: 0, rapierLockedUntil: 0, extraBoundAt: null, burstGeneration: 0 };
    },
    staticEffects(): number[] { return [...(has(516211) ? [16211001] : []), ...(has(516241) ? [16241001] : [])]; },
    mainSpBudget(defaultBudget: number, api: SeinaScriptApi): number { return has(516201) ? api.parameter(16201011) * 10000 : defaultBudget; },
    beforeHit(api: SeinaScriptApi, tags: number[], hpFraction = 1, eliteOrBoss=true): { id: number; count: number }[] {
      const result: { id: number; count: number }[] = [];
      const glimmer = api.buffs.count('boss', glimmerId);
      if (tags.includes(NORMAL) && glimmer) result.push({ id: 16290001, count: glimmer });
      result.push(...run(api,'before-own-hit',tags,hpFraction,eliteOrBoss).once.map(({id,count})=>({id,count})));
      if (tags.includes(QING_AND_QI)) {
        if (has(516205)) result.push({ id: 16205001, count: 1 });
        if (has(516206) && glimmer) result.push({ id: 16206001, count: 1 });
      }
      if (has(516211) && glimmer) result.push({ id: 16211001, count: 1 });
      if (has(516204) && tags.includes(combatTagHash('162NrmAtkZhong'))) result.push({id:16204011,count:1});
      if (tags.includes(combatTagHash('Zhong'))) {
        if (has(516208)) result.push({id:16208001,count:1});
        if (has(516210)) result.push({id:16210001,count:1});
      }
      return result;
    },
    afterHit(state: SeinaScriptState, api: SeinaScriptApi, tags: number[]): SeinaScriptState {
      if (tags.includes(GLIMMER_HIT)) api.buffs.add('boss', glimmerId, api.actor);
      if (breakthrough >= 1 && !api.buffs.count(api.actor, 16296111)) {
        run(api,'own-hit',tags);
        const result={...state,burstGeneration:state.burstGeneration+1};
        if(has(516243)) api.startBurstRegen(result.burstGeneration);
        return result;
      }
      return state;
    },
    canTriggerMark(tags: number[]): boolean { return tags.includes(TRIGGER) || (has(516207) && tags.includes(SWORD))
      || (has(516204) && tags.includes(combatTagHash('162NrmAtkZhong'))); },
    onMarkTrigger(api: SeinaScriptApi): void { run(api,'own-light-mark'); },
    onMarkSword(state:SeinaScriptState,api:SeinaScriptApi):SeinaScriptState {
      if(!has(516203)||state.lastMarkSword!==undefined&&api.time-state.lastMarkSword<=api.parameter(16203011))return state;
      api.area('AreaEffect_162_LeiDianZhongJian_Fall_Skil_Main');
      return {...state,lastMarkSword:api.time};
    },
    tick(state: SeinaScriptState, api: SeinaScriptApi, maximumSwordStacks: number, useWindow: number): SeinaScriptState {
      if (state.extraBoundAt !== null && api.time >= state.extraBoundAt + useWindow) {
        api.buffs.remove(api.actor, 16202011);
        return { ...state, extraBoundAt: null };
      }
      if (!has(516202) || state.extraBoundAt !== null || api.time < state.rapierLockedUntil
        || (state.lastExtra > 0 && api.time - state.lastExtra <= api.parameter(16202011))
        || api.buffs.count(api.actor, 16202011) < maximumSwordStacks) return state;
      return { ...state, extraBoundAt: api.time };
    },
    cast(state: SeinaScriptState, api: SeinaScriptApi, kind: 'main' | 'extra' | 'ultimate', rapierDuration = 0): SeinaScriptState {
      let result = { ...state };
      if (kind === 'ultimate') {
        result.form = state.form === 'claymore' ? 'rapier' : 'claymore';
        return addBurst(result, api);
      }
      if (has(516207)) {
        api.buffs.add(api.actor, 16207011, api.actor);
        for (const actor of api.balanceActors) api.buffs.add(actor, 16207012, api.actor);
      }
      if (kind === 'extra') {
        result.lastExtra = api.time;
        result.extraBoundAt = null;
        api.buffs.remove(api.actor, 16202011);
        if (has(516206)) result.form = 'rapier';
      } else result.rapierLockedUntil = api.time + rapierDuration;
      return result;
    },
    endMain(state: SeinaScriptState, api: SeinaScriptApi): SeinaScriptState { return { ...state, rapierLockedUntil: api.time }; },
    custom(api: SeinaScriptApi, name: string, action?:string): void {
      const sword = (id: number) => {
        api.sword(id);
        if (has(516202)) api.buffs.add(api.actor, 16202011, api.actor);
      };
      if (name === '162NrmAtkJianQI') sword(162100004);
      else if (name === '162SkillMainJianQi' && has(516201)) sword(162310005);
      else if (name === '162UltraJianQi' && has(516241)) sword(162400006);
      else if (name === '162P42ZhongJianArea' && has(516242)) api.area('AreaEffect_162_LeiDianArea_P42',5);
      else if (name === '162P8LeiDianArea' && has(516208)) api.area('AreaEffect_162_LeiDianArea_P8',4);
      else if (name === '162P3' && has(516203)&&action==='162:skill') api.area('AreaEffect_162_LeiDianZhongJian_Fall_Skil_Main');
      else if (name === '162P2' && has(516202)) sword(162310009);
      else if (name === '162SkilMainZhongJianFall') api.area('AreaEffect_162_LeiDianZhongJian_Fall_Skil_Main');
    },
    returningSword(): number | null { return has(516205) ? 162310006 : null; },
    burstBuff: burst,
  };
}
